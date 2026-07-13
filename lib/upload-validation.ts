import { allowedUploadExtensions, getFileExtension, getMimeTypeFromExtension } from "@/lib/utils";

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_ORIGINAL_FILE_NAME_LENGTH = 255;

const PDF_SIGNATURE = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Uint8Array.from([0xff, 0xd8, 0xff]);
const ZIP_LOCAL_FILE_SIGNATURE = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function startsWithBytes(bytes: Uint8Array, signature: Uint8Array) {
  if (bytes.byteLength < signature.byteLength) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function findZipEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.byteLength - 22 - MAX_ZIP_COMMENT_LENGTH);

  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32LE(bytes, offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      const commentLength = readUint16LE(bytes, offset + 20);

      if (offset + 22 + commentLength === bytes.byteLength) {
        return offset;
      }
    }
  }

  return -1;
}

function isDocxPackage(bytes: Uint8Array) {
  if (!startsWithBytes(bytes, ZIP_LOCAL_FILE_SIGNATURE)) {
    return false;
  }

  const endOffset = findZipEndOfCentralDirectory(bytes);

  if (endOffset < 0) {
    return false;
  }

  const entryCount = readUint16LE(bytes, endOffset + 10);
  const centralDirectorySize = readUint32LE(bytes, endOffset + 12);
  const centralDirectoryOffset = readUint32LE(bytes, endOffset + 16);

  // ZIP64 is unnecessary for a file capped at 15 MiB and is rejected so that
  // truncated 32-bit offsets cannot make the parser inspect the wrong bytes.
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    return false;
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  if (centralDirectoryOffset < 4 || centralDirectoryEnd > endOffset || centralDirectoryEnd < centralDirectoryOffset) {
    return false;
  }

  let cursor = centralDirectoryOffset;
  let hasContentTypes = false;
  let hasWordPart = false;
  const decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > centralDirectoryEnd || readUint32LE(bytes, cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
        return false;
      }

      const fileNameLength = readUint16LE(bytes, cursor + 28);
      const extraLength = readUint16LE(bytes, cursor + 30);
      const commentLength = readUint16LE(bytes, cursor + 32);
      const fileNameStart = cursor + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      const nextCursor = fileNameEnd + extraLength + commentLength;

      if (fileNameLength === 0 || fileNameEnd > centralDirectoryEnd || nextCursor > centralDirectoryEnd) {
        return false;
      }

      const fileName = decoder.decode(bytes.subarray(fileNameStart, fileNameEnd)).replaceAll("\\", "/");

      if (fileName === "[Content_Types].xml") {
        hasContentTypes = true;
      }

      if (fileName.startsWith("word/") && fileName.length > "word/".length) {
        hasWordPart = true;
      }

      cursor = nextCursor;
    }
  } catch {
    return false;
  }

  return cursor === centralDirectoryEnd && hasContentTypes && hasWordPart;
}

function hasExpectedSignature(bytes: Uint8Array, extension: string) {
  switch (extension) {
    case ".pdf":
      return startsWithBytes(bytes, PDF_SIGNATURE);
    case ".docx":
      return isDocxPackage(bytes);
    case ".png":
      return startsWithBytes(bytes, PNG_SIGNATURE);
    case ".jpg":
    case ".jpeg":
      return startsWithBytes(bytes, JPEG_SIGNATURE);
    default:
      return false;
  }
}

export function validateUploadMetadata(fileName: string, declaredMimeType: string, size: number) {
  const normalizedFileName = fileName.trim();

  if (!normalizedFileName || normalizedFileName.length > MAX_ORIGINAL_FILE_NAME_LENGTH) {
    throw new UploadValidationError(
      `Имя файла должно содержать не больше ${MAX_ORIGINAL_FILE_NAME_LENGTH} символов.`
    );
  }

  if (/[\u0000-\u001f\u007f]/.test(normalizedFileName)) {
    throw new UploadValidationError("Имя файла содержит недопустимые символы.");
  }

  const extension = getFileExtension(normalizedFileName);

  if (!allowedUploadExtensions.includes(extension)) {
    throw new UploadValidationError("Поддерживаются только PDF, DOCX, PNG и JPG.");
  }

  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new UploadValidationError("Файл пуст или имеет некорректный размер.");
  }

  if (size > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError("Файл слишком большой. Максимальный размер — 15 МБ.");
  }

  const mimeType = getMimeTypeFromExtension(extension);
  const normalizedDeclaredMimeType = declaredMimeType.trim().toLowerCase();

  if (
    normalizedDeclaredMimeType &&
    normalizedDeclaredMimeType !== "application/octet-stream" &&
    normalizedDeclaredMimeType !== mimeType
  ) {
    throw new UploadValidationError("Тип файла не соответствует его расширению.");
  }

  return {
    originalName: normalizedFileName,
    extension,
    mimeType
  };
}

export function validateUploadedBytes(
  bytes: Uint8Array,
  fileName: string,
  declaredMimeType: string,
  declaredSize: number = bytes.byteLength
) {
  const metadata = validateUploadMetadata(fileName, declaredMimeType, declaredSize);

  if (bytes.byteLength !== declaredSize) {
    throw new UploadValidationError("Фактический размер файла не совпадает с заявленным.");
  }

  if (!hasExpectedSignature(bytes, metadata.extension)) {
    throw new UploadValidationError("Содержимое файла не соответствует заявленному формату.");
  }

  return metadata;
}
