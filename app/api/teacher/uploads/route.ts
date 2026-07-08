import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  assertRateLimit,
  getClientIpFromHeaders,
  getRetryAfterSeconds,
  RateLimitExceededError
} from "@/lib/rate-limit";
import { deleteOwnedStoredFileIfUnused } from "@/lib/stored-files";
import { saveUploadedFile } from "@/lib/storage";
import { allowedUploadExtensions, allowedUploadMimeTypes, getFileExtension } from "@/lib/utils";

export const runtime = "nodejs";
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

function isValidUploadPathname(pathname: string) {
  return pathname.startsWith("uploads/") && !pathname.includes("..") && pathname.length <= 512;
}

function validateUploadedMetadata(fileName: string, mimeType: string, size: number) {
  const extension = getFileExtension(fileName);

  if (!allowedUploadExtensions.includes(extension)) {
    throw new Error("Поддерживаются только PDF, DOCX, PNG и JPG.");
  }

  if (!allowedUploadMimeTypes.has(mimeType)) {
    throw new Error("Неподдерживаемый тип файла.");
  }

  if (size > MAX_UPLOAD_SIZE) {
    throw new Error("Файл слишком большой. Максимальный размер — 15 МБ.");
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);

  try {
    assertRateLimit(
      {
        scope: "teacher-uploads",
        identifier: getClientIpFromHeaders(request.headers),
        limit: 60,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много запросов к загрузке файлов."
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      logWarnEvent(
        "teacher.upload.rate_limited",
        requestContext,
        error,
        "Teacher upload request was rate limited."
      );
      return NextResponse.json(
        {
          error: "Слишком много запросов к загрузке файлов. Подождите пару минут и попробуйте снова."
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(getRetryAfterSeconds(error.retryAfterMs))
          }
        }
      );
    }

    throw error;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | (HandleUploadBody & {
          action?: never;
        })
      | {
          action?: string;
          pathname?: string;
          contentType?: string;
          originalName?: string;
          size?: number;
          previousFileId?: string | null;
        }
      | null;

    if (body && "type" in body && (body.type === "blob.generate-client-token" || body.type === "blob.upload-completed")) {
      let blobUserId: string | undefined;

      if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
        return NextResponse.json({ error: "Blob storage is not configured" }, { status: 400 });
      }

      if (body.type === "blob.generate-client-token") {
        const user = await tryGetCurrentUser();

        if (!user || user.role !== UserRole.DEVELOPER) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        blobUserId = user.id;
      }

      try {
        const jsonResponse = await handleUpload({
          request,
          body,
          onBeforeGenerateToken: async () => ({
            allowedContentTypes: Array.from(allowedUploadMimeTypes),
            maximumSizeInBytes: MAX_UPLOAD_SIZE,
            addRandomSuffix: false
          })
        });

        return NextResponse.json(jsonResponse);
      } catch (error) {
        logErrorEvent(
          "teacher.upload.blob_token.failed",
          {
            ...requestContext,
            userId: blobUserId,
            uploadMode: body.type
          },
          error,
          "Failed to generate Vercel Blob upload token."
        );
        return NextResponse.json({ error: "Blob upload token generation failed" }, { status: 500 });
      }
    }

    if (body?.action === "register-blob") {
      const user = await tryGetCurrentUser();

      if (!user || user.role !== UserRole.DEVELOPER) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const pathname = String(body.pathname ?? "").trim();
      const uploadedMimeType = String(body.contentType ?? "").trim();
      const originalName = String(body.originalName ?? "").trim();
      const size = Number(body.size ?? 0);
      const previousFileId = String(body.previousFileId ?? "").trim();

      if (!pathname || !uploadedMimeType || !originalName || !Number.isFinite(size) || size <= 0) {
        return NextResponse.json({ error: "Blob metadata is incomplete" }, { status: 400 });
      }

      if (!isValidUploadPathname(pathname)) {
        return NextResponse.json({ error: "Некорректный путь загруженного файла." }, { status: 400 });
      }

      try {
        validateUploadedMetadata(originalName, uploadedMimeType, size);

        const storedFile = await prisma.storedFile.create({
          data: {
            originalName,
            storageKey: `blob:${pathname}`,
            mimeType: uploadedMimeType,
            size,
            uploadedById: user.id
          }
        });

        if (previousFileId && previousFileId !== storedFile.id) {
          await deleteOwnedStoredFileIfUnused(previousFileId, user.id);
        }

        logInfoEvent(
          "teacher.upload.blob_register.succeeded",
          {
            ...requestContext,
            userId: user.id,
            previousFileId: previousFileId || undefined,
            pathname,
            originalName,
            storedFileId: storedFile.id
          },
          "Blob upload was registered successfully."
        );

        return NextResponse.json({
          file: {
            id: storedFile.id,
            originalName: storedFile.originalName,
            mimeType: storedFile.mimeType,
            size: storedFile.size,
            uploadedAt: storedFile.uploadedAt.toISOString()
          }
        });
      } catch (error) {
        logErrorEvent(
          "teacher.upload.blob_register.failed",
          {
            ...requestContext,
            userId: user.id,
            previousFileId: previousFileId || undefined,
            pathname
          },
          error,
          "Failed to register uploaded blob in the database."
        );

        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Blob registration failed"
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: "Unsupported upload request" }, { status: 400 });
  }

  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const previousFileId = String(formData.get("previousFileId") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  try {
    const uploaded = await saveUploadedFile(file);
    const storedFile = await prisma.storedFile.create({
      data: {
        ...uploaded,
        uploadedById: user.id
      }
    });

    if (previousFileId && previousFileId !== storedFile.id) {
      await deleteOwnedStoredFileIfUnused(previousFileId, user.id);
    }

    logInfoEvent(
      "teacher.upload.form.succeeded",
      {
        ...requestContext,
        userId: user.id,
        previousFileId: previousFileId || undefined,
        fileName: file.name,
        fileSize: file.size,
        storedFileId: storedFile.id
      },
      "Teacher topic form upload completed."
    );

    return NextResponse.json({
      file: {
        id: storedFile.id,
        originalName: storedFile.originalName,
        mimeType: storedFile.mimeType,
        size: storedFile.size,
        uploadedAt: storedFile.uploadedAt.toISOString()
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.upload.form.failed",
      {
        ...requestContext,
        userId: user.id,
        previousFileId: previousFileId || undefined,
        fileName: file.name,
        fileSize: file.size
      },
      error,
      "Failed to upload file for teacher topic form."
    );
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
