import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeStoredFile, saveUploadedFile } from "@/lib/storage";

export const runtime = "nodejs";

async function deleteOwnedStoredFileIfUnused(fileId: string | null | undefined, userId: string) {
  if (!fileId) {
    return;
  }

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId }
  });

  if (!file || file.uploadedById !== userId) {
    return;
  }

  const usageCount = await prisma.topic.count({
    where: {
      OR: [{ theoryFileId: fileId }, { homeworkFileId: fileId }]
    }
  });

  if (usageCount > 0) {
    return;
  }

  await prisma.storedFile.delete({
    where: { id: fileId }
  });

  await removeStoredFile(file.storageKey);
}

export async function POST(request: Request) {
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
