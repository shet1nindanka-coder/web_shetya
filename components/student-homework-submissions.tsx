"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

type SubmissionAssignment = {
  id: string;
  label: string;
  topicId: string;
  topicTitle: string;
  deadlineAt: string | null;
  totalNumbers: number;
  solvedCount: number;
  solvedPercent: number;
  photos: Array<{
    id: string;
    fileId: string;
    originalName: string;
  }>;
};

type StudentHomeworkSubmissionsProps = {
  assignments: SubmissionAssignment[];
};

export function StudentHomeworkSubmissions({ assignments }: StudentHomeworkSubmissionsProps) {
  const router = useRouter();
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadPhotos = async (assignmentId: string, files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    setUploadingId(assignmentId);
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
      setUploadingId(null);

      const input = fileInputsRef.current[assignmentId];

      if (input) {
        input.value = "";
      }
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!window.confirm("Удалить это фото?")) {
      return;
    }

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
    }
  };

  return (
    <div className="space-y-4">
      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      {assignments.map((assignment) => {
        const isUploading = uploadingId === assignment.id;

        return (
          <article key={assignment.id} className="shbz-card px-[26px] py-6" style={{ borderRadius: 18 }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
                  {assignment.label} · {assignment.topicTitle}
                </div>
                <div className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                  {assignment.deadlineAt ? `ДЗ до ${formatDate(assignment.deadlineAt)} · ` : ""}
                  Выполнено {assignment.solvedCount} из {assignment.totalNumbers}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <input
                  ref={(element) => {
                    fileInputsRef.current[assignment.id] = element;
                  }}
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={(event) => void uploadPhotos(assignment.id, event.target.files)}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputsRef.current[assignment.id]?.click()}
                  className="shbz-btn-primary px-5 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? "Загружаем..." : "Прикрепить фото"}
                </button>
              </div>
            </div>

            {assignment.photos.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {assignment.photos.map((photo) => (
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
                      onClick={() => void deletePhoto(photo.id)}
                      aria-label="Удалить фото"
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--theme-surface-strong)] text-xs font-bold text-[var(--theme-text-muted)] shadow transition hover:text-[var(--theme-danger-text)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderColor: "var(--shbz-soft-border)" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[13px]" style={{ color: "var(--shbz-kicker)" }}>
                Фото пока не прикреплены. Можно загрузить до 10 фото (PNG или JPG).
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
