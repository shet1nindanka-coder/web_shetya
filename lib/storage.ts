import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import {
  allowedUploadExtensions,
  allowedUploadMimeTypes,
  getFileExtension,
  getMimeTypeFromExtension,
  sanitizeFileName
} from "@/lib/utils";

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const LOCAL_STORAGE_PREFIX = "local:";
const BLOB_STORAGE_PREFIX = "blob:";
const BLOB_UPLOADS_PREFIX = "uploads";

type StorageBackend = "local" | "blob";
export type BlobAccessMode = "private" | "public";

type StoredUpload = {
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
};

type StoredFilePayload = {
  body: Uint8Array | ReadableStream<Uint8Array>;
  size: number;
};

function getStorageBackend(): StorageBackend {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local";
}

export function getBlobAccessMode(): BlobAccessMode {
  return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

function createStorageFileName(fileName: string) {
  const extension = getFileExtension(fileName);
  const cleanedBaseName = sanitizeFileName(path.basename(fileName, extension)) || "file";

  return `${Date.now()}-${randomUUID()}-${cleanedBaseName}${extension}`;
}

function createBlobPathname(fileName: string) {
  return `${BLOB_UPLOADS_PREFIX}/${createStorageFileName(fileName)}`;
}

function createLocalStorageKey(fileName: string) {
  return `${LOCAL_STORAGE_PREFIX}${createStorageFileName(fileName)}`;
}

function createBlobStorageKey(pathname: string) {
  return `${BLOB_STORAGE_PREFIX}${pathname}`;
}

function parseStorageKey(storageKey: string): { backend: StorageBackend; value: string } {
  if (storageKey.startsWith(BLOB_STORAGE_PREFIX)) {
    return {
      backend: "blob",
      value: storageKey.slice(BLOB_STORAGE_PREFIX.length)
    };
  }

  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    return {
      backend: "local",
      value: storageKey.slice(LOCAL_STORAGE_PREFIX.length)
    };
  }

  return {
    backend: "local",
    value: storageKey
  };
}

export function getStorageRoot() {
  const configuredPath = process.env.STORAGE_DIR?.trim();

  if (configuredPath) {
    return path.resolve(process.cwd(), configuredPath);
  }

  if (process.env.NODE_ENV === "production") {
    return path.join("/tmp", "uploads");
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

async function saveToLocalStorage(body: Buffer | File, fileName: string, mimeType: string, size: number): Promise<StoredUpload> {
  await ensureStorageRoot();

  const fileKey = createStorageFileName(fileName);
  const absolutePath = path.join(getStorageRoot(), fileKey);
  const buffer = body instanceof File ? Buffer.from(await body.arrayBuffer()) : body;

  await fs.writeFile(absolutePath, buffer);

  return {
    originalName: fileName,
    storageKey: `${LOCAL_STORAGE_PREFIX}${fileKey}`,
    mimeType,
    size
  };
}

async function saveToBlobStorage(body: Buffer | File, fileName: string, mimeType: string, size: number): Promise<StoredUpload> {
  const pathname = createBlobPathname(fileName);
  const uploadedBlob = await put(pathname, body, {
    access: getBlobAccessMode(),
    addRandomSuffix: false,
    contentType: mimeType
  });

  return {
    originalName: fileName,
    storageKey: createBlobStorageKey(uploadedBlob.pathname),
    mimeType: uploadedBlob.contentType,
    size
  };
}

export async function saveUploadedFile(file: File) {
  const { mimeType } = validateUploadedFile(file);

  if (getStorageBackend() === "blob") {
    return saveToBlobStorage(file, file.name, mimeType, file.size);
  }

  return saveToLocalStorage(file, file.name, mimeType, file.size);
}

export async function saveBufferToStorage(buffer: Buffer, fileName: string, mimeType?: string) {
  const resolvedMimeType = mimeType || getMimeTypeFromExtension(getFileExtension(fileName));

  if (getStorageBackend() === "blob") {
    return saveToBlobStorage(buffer, fileName, resolvedMimeType, buffer.byteLength);
  }

  return saveToLocalStorage(buffer, fileName, resolvedMimeType, buffer.byteLength);
}

export async function removeStoredFile(storageKey: string | null | undefined) {
  if (!storageKey) {
    return;
  }

  const parsed = parseStorageKey(storageKey);

  if (parsed.backend === "blob") {
    await del(parsed.value).catch(() => undefined);
    return;
  }

  const absolutePath = path.join(getStorageRoot(), parsed.value);
  await fs.unlink(absolutePath).catch(() => undefined);
}

export function getStoredFileAbsolutePath(storageKey: string) {
  const parsed = parseStorageKey(storageKey);
  return path.join(getStorageRoot(), parsed.value);
}

export async function readStoredFile(storageKey: string): Promise<StoredFilePayload | null> {
  const parsed = parseStorageKey(storageKey);

  if (parsed.backend === "blob") {
    const blobResponse = await get(parsed.value, {
      access: getBlobAccessMode(),
      useCache: false
    }).catch(() => null);

    if (!blobResponse || blobResponse.statusCode !== 200 || !blobResponse.stream || blobResponse.blob.size == null) {
      return null;
    }

    return {
      body: blobResponse.stream,
      size: blobResponse.blob.size
    };
  }

  try {
    const buffer = await fs.readFile(getStoredFileAbsolutePath(storageKey));

    return {
      body: new Uint8Array(buffer),
      size: buffer.byteLength
    };
  } catch {
    return null;
  }
}
