import { UserRole } from "@prisma/client";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { canAccessStoredFile, summarizeStoredFileAccess } from "@/lib/file-access";
import { getRequestLogContext, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getBlobAccessMode, getPublicBlobUrl, getStorageBackend, readStoredFile } from "@/lib/storage";

type FileRouteProps = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(request: Request, { params }: FileRouteProps) {
  const user = await tryGetCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:file-read", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { fileId } = await params;
  const requestContext = getRequestLogContext(request, { userId: user.id, fileId });
  const file = await prisma.storedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      storageKey: true,
      uploadedById: true,
      _count: {
        select: {
          theoryForTopics: true,
          homeworkForTopics: true,
          answerForNumberEntries: true,
          checkPhotoEntries: true
        }
      }
    }
  });

  if (!file) {
    logWarnEvent(
      "file.read.record_missing",
      {
        ...requestContext,
        storageBackend: getStorageBackend(),
        blobAccess: getBlobAccessMode()
      },
      undefined,
      "Stored file record was not found."
    );
    return new Response("Not found", { status: 404 });
  }

  const accessSnapshot = {
    uploadedById: file.uploadedById,
    counts: {
      theoryForTopics: file._count.theoryForTopics,
      homeworkForTopics: file._count.homeworkForTopics,
      answerForNumberEntries: file._count.answerForNumberEntries,
      checkPhotoEntries: file._count.checkPhotoEntries
    }
  };

  let ownsStudentPhoto = false;

  // Фото решений: ученик видит свои, учитель — фото СВОИХ учеников (SEC-003).
  if (user.role === UserRole.STUDENT || user.role === UserRole.TEACHER) {
    const assignmentScope =
      user.role === UserRole.STUDENT ? { studentId: user.id } : { student: { teacherId: user.id } };

    ownsStudentPhoto = await prisma.storedFile
      .count({
        where: {
          id: file.id,
          OR: [
            {
              submissionPhotoEntries: {
                some: {
                  assignment: assignmentScope
                }
              }
            },
            {
              checkPhotoEntries: {
                some: {
                  check: {
                    assignment: assignmentScope
                  }
                }
              }
            }
          ]
        }
      })
      .then((count) => count > 0)
      .catch(() => false);
  }

  if (!canAccessStoredFile(user, accessSnapshot) && !ownsStudentPhoto) {
    logWarnEvent(
      "file.read.denied",
      {
        ...requestContext,
        userRole: user.role,
        ...summarizeStoredFileAccess(accessSnapshot)
      },
      undefined,
      "Stored file access was denied."
    );
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const publicBlobUrl = await getPublicBlobUrl(file.storageKey, download);

  if (publicBlobUrl) {
    return Response.redirect(publicBlobUrl, 302);
  }

  const storedFile = await readStoredFile(file.storageKey);

  if (!storedFile) {
    logWarnEvent(
      "file.read.payload_missing",
      {
        ...requestContext,
        storageKey: file.storageKey,
        storageBackend: getStorageBackend(),
        blobAccess: getBlobAccessMode(),
        download
      },
      undefined,
      "Stored file payload was not found."
    );
    return new Response("Not found", { status: 404 });
  }

  const dispositionType = download ? "attachment" : "inline";
  const responseBody =
    storedFile.body instanceof ReadableStream
      ? storedFile.body
      : new Uint8Array(storedFile.body).buffer;

  return new Response(responseBody, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(storedFile.size),
      "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
