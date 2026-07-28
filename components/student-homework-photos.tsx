"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/delete-button";
import { cx } from "@/lib/utils";

const MAX_PHOTOS = 10;

type StudentHomeworkPhotosProps = {
  assignmentId: string;
  maxPhotos?: number;
  photos: Array<{
    id: string;
    fileId: string;
    originalName: string;
  }>;
};

export function StudentHomeworkPhotos({ assignmentId, maxPhotos = MAX_PHOTOS, photos }: StudentHomeworkPhotosProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const atLimit = photos.length >= maxPhotos;

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
    setError(null);

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
  };

  return (
    <div className="shbz-card shbz-section-pad">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            Фото решений
          </h2>
          <p className="ui-hint mt-1 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Учитель увидит их при проверке
          </p>
        </div>
        <span
          className="rounded-[8px] px-3 py-1.5 text-[13px] font-bold"
          style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}
        >
          {photos.length} / {maxPhotos}
        </span>
      </div>

      {error ? <div className="ui-notice-error mb-4 rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!isUploading && !atLimit) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!isUploading && !atLimit) {
            void uploadPhotos(event.dataTransfer.files);
          }
        }}
        className={cx(
          "flex flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed px-6 py-7 text-center transition",
          atLimit ? "cursor-not-allowed" : "cursor-pointer"
        )}
        style={{
          borderColor: isDragging ? "var(--shbz-green-text)" : "var(--shbz-input-border)",
          background: isDragging ? "var(--shbz-green-soft)" : "var(--shbz-dropzone-bg)"
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={isUploading || atLimit}
          className="hidden"
          onChange={(event) => void uploadPhotos(event.target.files)}
        />
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-[12px]"
          style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
          aria-hidden="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[14.5px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          {isUploading
            ? "Загружаем..."
            : atLimit
              ? `Достигнут лимит — ${maxPhotos} фото`
              : "Перетащите фото сюда или нажмите"}
        </span>
        <span className="text-[12.5px]" style={{ color: "var(--shbz-kicker)" }}>
          {`До ${maxPhotos} фото · PNG или JPG`}
        </span>
      </label>

      {photos.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              <a href={`/files/${photo.fileId}`} target="_blank" rel="noreferrer" title={photo.originalName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/files/${photo.fileId}`}
                  loading="lazy"
                  alt={photo.originalName}
                  className="h-24 w-24 rounded-[12px] border object-cover"
                  style={{ borderColor: "var(--shbz-soft-border)" }}
                />
              </a>
              <DeleteButton
                variant="icon"
                ariaLabel="Удалить фото"
                title="Удалить фото?"
                description="Фото решения будет удалено. Это действие нельзя отменить."
                className="shbz-btn-danger-icon--raised absolute -right-2 -top-2"
                onConfirm={() => deletePhoto(photo.id)}
                onError={(deleteError) =>
                  setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить фото.")
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
