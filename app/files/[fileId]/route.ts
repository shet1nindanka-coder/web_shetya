import { UserRole } from "@prisma/client";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { canAccessStoredFile, summarizeStoredFileAccess } from "@/lib/file-access";
import { buildThumbnail, isThumbnailable } from "@/lib/image-thumbnail";
import { getRequestLogContext, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  getBlobAccessMode,
  getPublicBlobUrl,
  getStorageBackend,
  readStoredFile,
  readStoredFileBuffer
} from "@/lib/storage";

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

  const answersForTopics = await prisma.topic.count({ where: { answersFileId: file.id } });

  const accessSnapshot = {
    uploadedById: file.uploadedById,
    counts: {
      theoryForTopics: file._count.theoryForTopics,
      homeworkForTopics: file._count.homeworkForTopics,
      answersForTopics,
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

  const requestUrl = new URL(request.url);
  const download = requestUrl.searchParams.get("download") === "1";
  const wantsThumbnail = requestUrl.searchParams.get("thumb") === "1" && !download && isThumbnailable(file.mimeType);

  if (wantsThumbnail) {
    const source = await readStoredFileBuffer(file.storageKey).catch(() => null);
    const thumbnail = source ? await buildThumbnail(source, { ...requestContext, fileId: file.id }) : null;

    if (thumbnail) {
      const thumbEtag = `"${file.id}-thumb-${thumbnail.body.byteLength}"`;

      if (request.headers.get("if-none-match") === thumbEtag) {
        return new Response(null, {
          status: 304,
          headers: { ETag: thumbEtag, "Cache-Control": "private, max-age=31536000, immutable" }
        });
      }

      return new Response(new Uint8Array(thumbnail.body), {
        headers: {
          "Content-Type": thumbnail.mimeType,
          "Content-Length": String(thumbnail.body.byteLength),
          "Cache-Control": "private, max-age=31536000, immutable",
          ETag: thumbEtag,
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    // Превью не собралось — ниже отдаём оригинал, как раньше.
  }

  const publicBlobUrl = await getPublicBlobUrl(file.storageKey, download);

  if (publicBlobUrl && !wantsThumbnail) {
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

  // Файл иммутабелен: id выдаётся один раз на загрузку, содержимое не меняется.
  // Прежний no-store заставлял браузер перекачивать каждое фото ДЗ при любом
  // возврате на страницу; private-кэш держит их только в кэше самого клиента,
  // а доступ всё равно проверяется на каждом промахе кэша.
  const etag = `"${file.id}-${storedFile.size}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  }

  return new Response(responseBody, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(storedFile.size),
      "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
