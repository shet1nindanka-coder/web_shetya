import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  allowedUploadExtensions,
  allowedUploadMimeTypes,
  getFileExtension,
  getMimeTypeFromExtension,
  sanitizeFileName
} from "@/lib/utils";

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

export function getStorageRoot() {
  const configuredPath = process.env.STORAGE_DIR?.trim();

  if (configuredPath) {
    return path.resolve(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), "storage", "uploads");
}

export async function ensureStorageRoot() {
  await fs.mkdir(getStorageRoot(), { recursive: true });
}

function validateUploadedFile(file: File) {
  const extension = getFileExtension(file.name);
  const fallbackMimeType = getMimeTypeFromExtension(extension);
  const mimeType = file.type || fallbackMimeType;

  if (!allowedUploadExtensions.includes(extension)) {
    throw new Error("Поддерживаются только PDF, DOCX, PNG и JPG.");
  }

  if (!allowedUploadMimeTypes.has(mimeType)) {
    throw new Error("Неподдерживаемый тип файла.");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("Файл слишком большой. Максимальный размер — 15 МБ.");
  }

  return { extension, mimeType };
}

export async function saveUploadedFile(file: File) {
  const { extension, mimeType } = validateUploadedFile(file);

  await ensureStorageRoot();

  const cleanedBaseName = sanitizeFileName(path.basename(file.name, extension)) || "file";
  const storageKey = `${Date.now()}-${randomUUID()}-${cleanedBaseName}${extension}`;
  const absolutePath = path.join(getStorageRoot(), storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(absolutePath, buffer);

  return {
    originalName: file.name,
    storageKey,
    mimeType,
    size: buffer.byteLength
  };
}

export async function saveBufferToStorage(buffer: Buffer, fileName: string, mimeType?: string) {
  await ensureStorageRoot();

  const extension = getFileExtension(fileName);
  const cleanedBaseName = sanitizeFileName(path.basename(fileName, extension)) || "file";
  const storageKey = `${Date.now()}-${randomUUID()}-${cleanedBaseName}${extension}`;
  const absolutePath = path.join(getStorageRoot(), storageKey);

  await fs.writeFile(absolutePath, buffer);

  return {
    originalName: fileName,
    storageKey,
    mimeType: mimeType || getMimeTypeFromExtension(extension),
    size: buffer.byteLength
  };
}

export async function removeStoredFile(storageKey: string | null | undefined) {
  if (!storageKey) {
    return;
  }

  const absolutePath = path.join(getStorageRoot(), storageKey);
  await fs.unlink(absolutePath).catch(() => undefined);
}

export function getStoredFileAbsolutePath(storageKey: string) {
  return path.join(getStorageRoot(), storageKey);
}
