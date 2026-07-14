import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { del, get, list, put } from "@vercel/blob";
import { getSafeUploadFileName } from "@/lib/upload-file-name";
import {
  MAX_UPLOAD_SIZE_BYTES,
  UploadValidationError,
  validateUploadMetadata,
  validateUploadedBytes
} from "@/lib/upload-validation";
import { getFileExtension, getMimeTypeFromExtension } from "@/lib/utils";

const LOCAL_STORAGE_PREFIX = "local:";
const BLOB_STORAGE_PREFIX = "blob:";
const S3_STORAGE_PREFIX = "s3:";
const STORAGE_UPLOADS_PREFIX = "uploads";

export type StorageBackend = "local" | "blob" | "s3";
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

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

let cachedS3Client: S3Client | null = null;
let cachedS3ClientCacheKey: string | null = null;

function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION?.trim() || "ru-central1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true"
  };
}

function getS3Client(config: S3Config) {
  const cacheKey = JSON.stringify(config);

  if (!cachedS3Client || cachedS3ClientCacheKey !== cacheKey) {
    cachedS3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    cachedS3ClientCacheKey = cacheKey;
  }

  return cachedS3Client;
}

export function getStorageBackend(): StorageBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return "blob";
  }

  if (getS3Config()) {
    return "s3";
  }

  return "local";
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
  return `${STORAGE_UPLOADS_PREFIX}/${createStorageFileName(fileName)}`;
}

function createS3ObjectKey(fileName: string) {
  return `${STORAGE_UPLOADS_PREFIX}/${createStorageFileName(fileName)}`;
}

function createLocalStorageKey(fileName: string) {
  return `${LOCAL_STORAGE_PREFIX}${createStorageFileName(fileName)}`;
}

function createBlobStorageKey(pathname: string) {
  return `${BLOB_STORAGE_PREFIX}${pathname}`;
}

function createS3StorageKey(objectKey: string) {
  return `${S3_STORAGE_PREFIX}${objectKey}`;
}

function parseStorageKey(storageKey: string): { backend: StorageBackend; value: string } {
  if (storageKey.startsWith(BLOB_STORAGE_PREFIX)) {
    return {
      backend: "blob",
      value: storageKey.slice(BLOB_STORAGE_PREFIX.length)
    };
  }

  if (storageKey.startsWith(S3_STORAGE_PREFIX)) {
    return {
      backend: "s3",
      value: storageKey.slice(S3_STORAGE_PREFIX.length)
    };
  }

  if (storageKey.startsWith(LOCAL_STORAGE_PREFIX)) {
    return {
      backend: "local",
      value: storageKey.slice(LOCAL_STORAGE_PREFIX.length)
    };
  }

  return {
    backend: getStorageBackend() === "s3" ? "s3" : "local",
    value: storageKey
  };
}

export function getStorageRoot() {
  const configuredPath = process.env.STORAGE_DIR?.trim();

  if (configuredPath) {
    return path.resolve(process.cwd(), configuredPath);
  }

  if (process.env.NODE_ENV === "production") {
    // Раньше здесь молча падали в /tmp/uploads — файлы пропадали после reboot.
    throw new Error(
      "Хранилище не настроено: в production задайте STORAGE_DIR (или S3_*/BLOB_*) явно."
    );
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

async function saveToS3Storage(body: Buffer | File, fileName: string, mimeType: string, size: number): Promise<StoredUpload> {
  const config = getS3Config();

  if (!config) {
    throw new Error("S3 storage is not configured.");
  }

  const objectKey = createS3ObjectKey(fileName);
  const buffer = body instanceof File ? Buffer.from(await body.arrayBuffer()) : body;

  await getS3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType
    })
  );

  return {
    originalName: fileName,
    storageKey: createS3StorageKey(objectKey),
    mimeType,
    size
  };
}

export async function saveUploadedFile(file: File) {
  validateUploadMetadata(file.name, file.type, file.size);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { originalName, mimeType } = validateUploadedBytes(buffer, file.name, file.type, file.size);

  switch (getStorageBackend()) {
    case "blob":
      return saveToBlobStorage(buffer, originalName, mimeType, buffer.byteLength);
    case "s3":
      return saveToS3Storage(buffer, originalName, mimeType, buffer.byteLength);
    default:
      return saveToLocalStorage(buffer, originalName, mimeType, buffer.byteLength);
  }
}

export async function saveBufferToStorage(buffer: Buffer, fileName: string, mimeType?: string) {
  const resolvedMimeType = mimeType || getMimeTypeFromExtension(getFileExtension(fileName));
  const validated = validateUploadedBytes(buffer, fileName, resolvedMimeType);

  switch (getStorageBackend()) {
    case "blob":
      return saveToBlobStorage(buffer, validated.originalName, validated.mimeType, buffer.byteLength);
    case "s3":
      return saveToS3Storage(buffer, validated.originalName, validated.mimeType, buffer.byteLength);
    default:
      return saveToLocalStorage(buffer, validated.originalName, validated.mimeType, buffer.byteLength);
  }
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

  if (parsed.backend === "s3") {
    const config = getS3Config();

    if (!config) {
      return;
    }

    await getS3Client(config)
      .send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: parsed.value
        })
      )
      .catch(() => undefined);

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

  if (parsed.backend === "s3") {
    const config = getS3Config();

    if (!config) {
      return null;
    }

    try {
      const response = await getS3Client(config).send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: parsed.value
        })
      );

      if (!response.Body) {
        return null;
      }

      const body =
        "transformToWebStream" in response.Body && typeof response.Body.transformToWebStream === "function"
          ? response.Body.transformToWebStream()
          : new Uint8Array(await response.Body.transformToByteArray());

      const resolvedSize =
        typeof response.ContentLength === "number"
          ? response.ContentLength
          : body instanceof ReadableStream
            ? 0
            : body.byteLength;

      return {
        body,
        size: resolvedSize
      };
    } catch {
      return null;
    }
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

export async function readStoredFileBuffer(storageKey: string, maxSize = MAX_UPLOAD_SIZE_BYTES) {
  const storedFile = await readStoredFile(storageKey);

  if (!storedFile) {
    return null;
  }

  if (!Number.isSafeInteger(storedFile.size) || storedFile.size < 0 || storedFile.size > maxSize) {
    if (storedFile.body instanceof ReadableStream) {
      await storedFile.body.cancel().catch(() => undefined);
    }

    throw new UploadValidationError("Фактический размер файла превышает допустимый.");
  }

  let buffer: Buffer;

  if (storedFile.body instanceof ReadableStream) {
    const reader = storedFile.body.getReader();
    const chunks: Buffer[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalSize += value.byteLength;

        if (totalSize > maxSize) {
          await reader.cancel().catch(() => undefined);
          throw new UploadValidationError("Фактический размер файла превышает допустимый.");
        }

        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    buffer = Buffer.concat(chunks, totalSize);
  } else {
    buffer = Buffer.from(storedFile.body);
  }

  if (buffer.byteLength === 0 || buffer.byteLength > maxSize) {
    throw new UploadValidationError("Файл пуст или превышает допустимый размер.");
  }

  if (storedFile.size > 0 && buffer.byteLength !== storedFile.size) {
    throw new UploadValidationError("Фактический размер файла не совпадает с метаданными хранилища.");
  }

  return buffer;
}
