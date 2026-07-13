import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ORIGINAL_FILE_NAME_LENGTH,
  UploadValidationError,
  validateUploadedBytes
} from "../lib/upload-validation";

function createZip(entries: string[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(name.byteLength, 26);
    localParts.push(localHeader, name);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(name.byteLength, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.byteLength + name.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

test("accepts PDF, PNG and JPEG only when their magic bytes match", () => {
  const pdf = Buffer.from("%PDF-1.7\n", "ascii");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  assert.equal(validateUploadedBytes(pdf, "document.pdf", "application/pdf").mimeType, "application/pdf");
  assert.equal(validateUploadedBytes(png, "image.png", "image/png").mimeType, "image/png");
  assert.equal(validateUploadedBytes(jpeg, "image.jpeg", "image/jpeg").mimeType, "image/jpeg");

  assert.throws(
    () => validateUploadedBytes(Buffer.from("not a pdf"), "document.pdf", "application/pdf"),
    UploadValidationError
  );
  assert.throws(() => validateUploadedBytes(pdf, "image.png", "image/png"), UploadValidationError);
});

test("accepts a structurally valid DOCX package with OOXML markers", () => {
  const docx = createZip(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  const result = validateUploadedBytes(
    docx,
    "homework.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  assert.equal(result.extension, ".docx");
  assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("rejects ZIP files that are not DOCX packages", () => {
  const missingContentTypes = createZip(["word/document.xml"]);
  const missingWordPart = createZip(["[Content_Types].xml", "docProps/core.xml"]);
  const fakeZip = Buffer.from("PK\u0003\u0004[Content_Types].xml word/document.xml", "binary");
  const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  assert.throws(
    () => validateUploadedBytes(missingContentTypes, "homework.docx", mimeType),
    UploadValidationError
  );
  assert.throws(() => validateUploadedBytes(missingWordPart, "homework.docx", mimeType), UploadValidationError);
  assert.throws(() => validateUploadedBytes(fakeZip, "homework.docx", mimeType), UploadValidationError);
});

test("rejects mismatched MIME, claimed size and overlong originalName", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.throws(() => validateUploadedBytes(png, "image.png", "application/pdf"), UploadValidationError);
  assert.throws(() => validateUploadedBytes(png, "image.png", "image/png", png.byteLength + 1), UploadValidationError);
  assert.throws(
    () => validateUploadedBytes(png, `${"a".repeat(MAX_ORIGINAL_FILE_NAME_LENGTH)}.png`, "image/png"),
    UploadValidationError
  );

  assert.equal(validateUploadedBytes(png, "image.png", "application/octet-stream").mimeType, "image/png");
});
