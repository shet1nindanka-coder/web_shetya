import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
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
      if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
        return NextResponse.json({ error: "Blob storage is not configured" }, { status: 400 });
      }

      if (body.type === "blob.generate-client-token") {
        const user = await tryGetCurrentUser();

        if (!user || user.role !== UserRole.TEACHER) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
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
        console.error("Failed to generate Vercel Blob upload token.", error);
        return NextResponse.json({ error: "Blob upload token generation failed" }, { status: 500 });
      }
    }

    if (body?.action === "register-blob") {
      const user = await tryGetCurrentUser();

      if (!user || user.role !== UserRole.TEACHER) {
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
        console.error("Failed to register Vercel Blob upload in database.", error);

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

  if (!user || user.role !== UserRole.TEACHER) {
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
    console.error("Failed to upload file for teacher topic form.", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
