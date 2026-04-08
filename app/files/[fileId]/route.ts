import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getBlobAccessMode, getPublicBlobUrl, getStorageBackend, readStoredFile } from "@/lib/storage";

type FileRouteProps = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(request: Request, { params }: FileRouteProps) {
  const user = await tryGetCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { fileId } = await params;
  const requestContext = getRequestLogContext(request, { userId: user.id, fileId });
  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file) {
    logWarnEvent(
      "file.read.record_missing",
      {
        ...requestContext,
        storageBackend: getStorageBackend(),
        blobAccess: getBlobAccessMode()
      },
      undefined,
      "Stored file record was not found."
    );
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const publicBlobUrl = await getPublicBlobUrl(file.storageKey, download);

  if (publicBlobUrl) {
    return Response.redirect(publicBlobUrl, 302);
  }

  const storedFile = await readStoredFile(file.storageKey);

  if (!storedFile) {
    logWarnEvent(
      "file.read.payload_missing",
      {
        ...requestContext,
        storageKey: file.storageKey,
        storageBackend: getStorageBackend(),
        blobAccess: getBlobAccessMode(),
        download
      },
      undefined,
      "Stored file payload was not found."
    );
    return new Response("Not found", { status: 404 });
  }

  const dispositionType = download ? "attachment" : "inline";
  const responseBody =
    storedFile.body instanceof ReadableStream
      ? storedFile.body
      : new Uint8Array(storedFile.body).buffer;

  return new Response(responseBody, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(storedFile.size),
      "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
