"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

type StudentHomeworkPhotosProps = {
  assignmentId: string;
  photos: Array<{
    id: string;
    fileId: string;
    originalName: string;
  }>;
};

export function StudentHomeworkPhotos({ assignmentId, photos }: StudentHomeworkPhotosProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [confirmPhotoId, setConfirmPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("assignmentId", assignmentId);

      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const response = await fetch("/api/student/homework-submissions", {
        method: "POST",
        body: formData
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось загрузить фото.");
      }

      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить фото.");
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const deletePhoto = async (photoId: string) => {
    setDeletingPhotoId(photoId);
    setError(null);

    try {
      const response = await fetch("/api/student/homework-submissions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photoId })
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось удалить фото.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить фото.");
    } finally {
      setDeletingPhotoId(null);
      setConfirmPhotoId(null);
    }
  };

  return (
    <div className="shbz-card shbz-section-pad">
      {error ? <div className="ui-notice-error mb-4 rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ui-hint text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Прикрепите фото решённого ДЗ — учитель увидит их при проверке. До 10 фото (PNG или JPG).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(event) => void uploadPhotos(event.target.files)}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="shbz-btn-primary ml-auto px-5 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Загружаем..." : "Прикрепить фото"}
        </button>
      </div>

      {photos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              <a href={`/files/${photo.fileId}`} target="_blank" rel="noreferrer" title={photo.originalName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/files/${photo.fileId}`}
                  alt={photo.originalName}
                  className="h-24 w-24 rounded-[12px] border object-cover"
                  style={{ borderColor: "var(--shbz-soft-border)" }}
                />
              </a>
              <button
                type="button"
                disabled={deletingPhotoId === photo.id}
                onClick={() => setConfirmPhotoId(photo.id)}
                aria-label="Удалить фото"
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--theme-surface-strong)] text-xs font-bold text-[var(--theme-text-muted)] shadow transition hover:text-[var(--theme-danger-text)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: "var(--shbz-soft-border)" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmPhotoId !== null}
        title="Удалить фото?"
        description="Фото решения будет удалено. Это действие нельзя отменить."
        isPending={deletingPhotoId !== null}
        onConfirm={() => {
          if (confirmPhotoId) {
            void deletePhoto(confirmPhotoId);
          }
        }}
        onCancel={() => setConfirmPhotoId(null)}
      />
    </div>
  );
}
