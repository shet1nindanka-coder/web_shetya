import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteOwnedStoredFileIfUnused } from "@/lib/stored-files";
import { readStoredFileBuffer, removeStoredFile, saveUploadedFile } from "@/lib/storage";
import {
  MAX_UPLOAD_SIZE_BYTES,
  UploadValidationError,
  validateUploadMetadata,
  validateUploadedBytes
} from "@/lib/upload-validation";
import { allowedUploadMimeTypes } from "@/lib/utils";

export const runtime = "nodejs";

function isValidUploadPathname(pathname: string) {
  return pathname.startsWith("uploads/") && !pathname.includes("..") && pathname.length <= 512;
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);

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

        const rateLimitResponse = await enforceApiRateLimit(
          "api:teacher-uploads",
          user.id,
          60,
          10 * 60_000
        );

        if (rateLimitResponse) {
          return rateLimitResponse;
        }

        blobUserId = user.id;
      }

      try {
        const jsonResponse = await handleUpload({
          request,
          body,
          onBeforeGenerateToken: async () => ({
            allowedContentTypes: Array.from(allowedUploadMimeTypes),
            maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
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

      const rateLimitResponse = await enforceApiRateLimit(
        "api:teacher-uploads",
        user.id,
        60,
        10 * 60_000
      );

      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const pathname = String(body.pathname ?? "").trim();
      const uploadedMimeType = String(body.contentType ?? "").trim();
      const originalName = String(body.originalName ?? "").trim();
      const size = Number(body.size ?? 0);
      const previousFileId = String(body.previousFileId ?? "").trim();

      if (!pathname) {
        return NextResponse.json({ error: "Blob metadata is incomplete" }, { status: 400 });
      }

      if (!isValidUploadPathname(pathname)) {
        return NextResponse.json({ error: "Некорректный путь загруженного файла." }, { status: 400 });
      }

      const storageKey = `blob:${pathname}`;
      const existingStoredFile = await prisma.storedFile.findUnique({
        where: { storageKey },
        select: { id: true }
      });

      if (existingStoredFile) {
        return NextResponse.json({ error: "Этот файл уже зарегистрирован." }, { status: 409 });
      }

      if (!uploadedMimeType || !originalName || !Number.isFinite(size) || size <= 0) {
        await removeStoredFile(storageKey);
        return NextResponse.json({ error: "Blob metadata is incomplete" }, { status: 400 });
      }

      let validatedFile: ReturnType<typeof validateUploadedBytes>;
      let validatedSize: number;

      try {
        validateUploadMetadata(originalName, uploadedMimeType, size);
        const buffer = await readStoredFileBuffer(storageKey, MAX_UPLOAD_SIZE_BYTES);

        if (!buffer) {
          throw new UploadValidationError("Загруженный Blob не найден.");
        }

        validatedFile = validateUploadedBytes(buffer, originalName, uploadedMimeType, size);
        validatedSize = buffer.byteLength;
      } catch (error) {
        await removeStoredFile(storageKey);
        logErrorEvent(
          "teacher.upload.blob_validation.failed",
          {
            ...requestContext,
            userId: user.id,
            previousFileId: previousFileId || undefined,
            pathname
          },
          error,
          "Uploaded blob failed server-side validation."
        );

        return NextResponse.json(
          {
            error: error instanceof UploadValidationError ? error.message : "Не удалось проверить загруженный Blob."
          },
          { status: 400 }
        );
      }

      let storedFile;

      try {
        storedFile = await prisma.storedFile.create({
          data: {
            originalName: validatedFile.originalName,
            storageKey,
            mimeType: validatedFile.mimeType,
            size: validatedSize,
            uploadedById: user.id
          }
        });
      } catch (error) {
        // Два параллельных register-запроса могут столкнуться на unique storageKey.
        // Не удаляем Blob, если победивший запрос уже создал на него ссылку.
        const registeredByConcurrentRequest = await prisma.storedFile
          .findUnique({ where: { storageKey }, select: { id: true } })
          .catch(() => null);

        if (!registeredByConcurrentRequest) {
          await removeStoredFile(storageKey);
        }

        logErrorEvent(
          "teacher.upload.blob_register.failed",
          {
            ...requestContext,
            userId: user.id,
            previousFileId: previousFileId || undefined,
            pathname
          },
          error,
          "Failed to register validated blob in the database."
        );

        return NextResponse.json({ error: "Не удалось зарегистрировать загруженный Blob." }, { status: 409 });
      }

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
          originalName: storedFile.originalName,
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
    }

    return NextResponse.json({ error: "Unsupported upload request" }, { status: 400 });
  }

  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit(
    "api:teacher-uploads",
    user.id,
    60,
    10 * 60_000
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
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
    return NextResponse.json(
      { error: error instanceof UploadValidationError ? error.message : "Upload failed" },
      { status: error instanceof UploadValidationError ? 400 : 500 }
    );
  }
}
