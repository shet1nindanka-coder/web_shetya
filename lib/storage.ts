import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { getSafeUploadFileName } from "@/lib/upload-file-name";
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

function getBlobStoreId() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    return null;
  }

  const [, , , storeId = null] = token.split("_");
  return storeId;
}

function createStorageFileName(fileName: string) {
  return `${Date.now()}-${randomUUID()}-${getSafeUploadFileName(fileName)}`;
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

function buildBlobPathCandidates(pathname: string) {
  const candidates = new Set<string>();
  const normalizedValue = pathname.trim();

  if (normalizedValue) {
    candidates.add(normalizedValue);
  }

  try {
    candidates.add(encodeURI(normalizedValue));
  } catch {
    // Ignore malformed URI candidates.
  }

  for (const form of ["NFC", "NFD", "NFKC", "NFKD"] as const) {
    const nextValue = normalizedValue.normalize(form);
    if (!nextValue) {
      continue;
    }

    candidates.add(nextValue);

    try {
      candidates.add(encodeURI(nextValue));
    } catch {
      // Ignore malformed URI candidates.
    }
  }

  return Array.from(candidates);
}

function getBlobLookupPrefix(pathname: string) {
  const match = pathname.match(/^(uploads\/\d+-[0-9a-fA-F-]{36}-)/);
  return match?.[1] ?? null;
}

async function resolveBlobPathname(pathname: string) {
  const prefix = getBlobLookupPrefix(pathname);

  if (!prefix) {
    return null;
  }

  try {
    const result = await list({
      prefix,
      limit: 10
    });

    const exactMatch = result.blobs.find((blob) => blob.pathname === pathname);

    if (exactMatch) {
      return exactMatch.pathname;
    }

    if (result.blobs.length === 1) {
      return result.blobs[0]?.pathname ?? null;
    }

    return result.blobs[0]?.pathname ?? null;
  } catch {
    return null;
  }
}

export async function getPublicBlobUrl(storageKey: string, download = false) {
  if (getBlobAccessMode() !== "public") {
    return null;
  }

  const parsed = parseStorageKey(storageKey);

  if (parsed.backend !== "blob") {
    return null;
  }

  const storeId = getBlobStoreId();

  if (!storeId) {
    return null;
  }

  const resolvedPathname = (await resolveBlobPathname(parsed.value)) ?? parsed.value;
  const url = new URL(`https://${storeId}.public.blob.vercel-storage.com/${resolvedPathname}`);

  if (download) {
    url.searchParams.set("download", "1");
  }

  return url.toString();
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
    const candidates = buildBlobPathCandidates(parsed.value);

    for (const candidate of candidates) {
      await del(candidate).catch(() => undefined);
    }

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
    const candidates = new Set(buildBlobPathCandidates(parsed.value));
    const resolvedPathname = await resolveBlobPathname(parsed.value);

    if (resolvedPathname) {
      candidates.add(resolvedPathname);
    }

    for (const candidate of candidates) {
      const blobResponse = await get(candidate, {
        access: getBlobAccessMode(),
        useCache: false
      }).catch(() => null);

      if (!blobResponse || blobResponse.statusCode !== 200 || !blobResponse.stream || blobResponse.blob.size == null) {
        continue;
      }

      return {
        body: blobResponse.stream,
        size: blobResponse.blob.size
      };
    }

    return null;
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
