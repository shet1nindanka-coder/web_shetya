export function getSafeUploadFileName(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? fileName.slice(extensionIndex).toLowerCase() : "";
  const baseName = extensionIndex >= 0 ? fileName.slice(0, extensionIndex) : fileName;
  const cleanedBaseName =
    baseName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "file";

  return `${cleanedBaseName}${extension}`;
}
