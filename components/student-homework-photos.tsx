"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedDropzone, type AnimatedDropzoneHandle } from "@/components/animated-dropzone";
import { DeleteButton } from "@/components/delete-button";
import { cx } from "@/lib/utils";

const MAX_PHOTOS = 10;

/** Черновая карточка под дропзоной: превью файла, пока идёт загрузка. */
type PendingUpload = {
  id: string;
  name: string;
  previewUrl: string;
};

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
  const dropzoneRef = useRef<AnimatedDropzoneHandle>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const pendingRef = useRef<PendingUpload[]>([]);
  // Фото первого рендера не анимируем: появление — только для новых карточек.
  const initialPhotoIdsRef = useRef<Set<string> | null>(null);

  if (initialPhotoIdsRef.current === null) {
    initialPhotoIdsRef.current = new Set(photos.map((photo) => photo.id));
  }

  const flushPendingUploads = useCallback(() => {
    if (!pendingRef.current.length) {
      return;
    }

    for (const upload of pendingRef.current) {
      URL.revokeObjectURL(upload.previewUrl);
    }

    pendingRef.current = [];
    setPendingUploads([]);
  }, []);

  // Сервер прислал обновлённый список фото — черновые карточки своё отработали.
  useEffect(() => {
    flushPendingUploads();
    return flushPendingUploads;
  }, [photos, flushPendingUploads]);

  const atLimit = photos.length >= maxPhotos;

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    setIsUploading(true);
    setError(null);

    // Файлы видны под дропзоной сразу после дропа — ещё до ответа сервера.
    const pending = Array.from(files).map((file, index) => ({
      id: `pending-${Date.now()}-${index}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file)
    }));
    pendingRef.current = pending;
    setPendingUploads(pending);

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
      flushPendingUploads();
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
    // Без собственной карточки: на странице ДЗ фото и автопроверка живут в одной плашке.
    <div>
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

      <AnimatedDropzone
        ref={dropzoneRef}
        className={cx(
          "flex flex-col items-center gap-2 px-6 py-7 text-center",
          atLimit ? "cursor-not-allowed" : "cursor-pointer"
        )}
        disabled={isUploading || atLimit}
        onDropFiles={(files) => void uploadPhotos(files)}
        title={
          isUploading
            ? "Загружаем..."
            : atLimit
              ? `Достигнут лимит — ${maxPhotos} фото`
              : "Перетащите фото сюда или нажмите"
        }
        dragTitle="Отпустите файлы"
        successTitle="Файлы добавлены"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
          </svg>
        }
        subtitle={
          <span className="ui-hint text-[12.5px]" style={{ color: "var(--shbz-kicker)" }}>
            {`До ${maxPhotos} фото · PNG или JPG`}
          </span>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={isUploading || atLimit}
          aria-label="Загрузить фото решения"
          // Визуально скрыт, но остаётся в таб-порядке: display:none выбрасывал
          // input из фокуса, и сдать ДЗ с клавиатуры было нельзя.
          className="sr-only"
          onChange={(event) => {
            const files = event.target.files;

            // То же подтверждение, что при дропе: выбор через диалог — равноценный путь.
            if (files?.length) {
              dropzoneRef.current?.confirm();
            }

            void uploadPhotos(files);
          }}
        />
      </AnimatedDropzone>

      {photos.length > 0 || pendingUploads.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={cx("relative", !initialPhotoIdsRef.current?.has(photo.id) && "shbz-file-card-enter")}
            >
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
          {pendingUploads.map((upload, index) => (
            <div key={upload.id} className="shbz-file-card-enter" style={{ animationDelay: `${index * 45}ms` }}>
              <div
                className="shbz-file-uploading h-24 w-24 overflow-hidden rounded-[12px] border"
                style={{ borderColor: "var(--shbz-soft-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upload.previewUrl} alt={upload.name} className="h-full w-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
