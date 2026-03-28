import { promises as fs } from "node:fs";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredFileAbsolutePath } from "@/lib/storage";

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
  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const absolutePath = getStoredFileAbsolutePath(file.storageKey);
  const download = new URL(request.url).searchParams.get("download") === "1";

  try {
    const buffer = await fs.readFile(absolutePath);
    const dispositionType = download ? "attachment" : "inline";

    return new Response(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
