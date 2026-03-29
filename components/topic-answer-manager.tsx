"use client";

import Image from "next/image";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { ProgressBar } from "@/components/progress-bar";
import { getSafeUploadFileName } from "@/lib/upload-file-name";
import { cx, formatFileSize } from "@/lib/utils";

type UploadMode = "local" | "blob";
type BlobAccessMode = "private" | "public";

type AnswerFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type NumberAnswerCard = {
  id: string;
  number: number;
  answerFile: AnswerFile | null;
  uploadStatus: "idle" | "uploading" | "error";
  progress: number;
  error: string | null;
  isDeleting: boolean;
};

type TopicAnswerManagerProps = {
  uploadMode: UploadMode;
  blobAccess: BlobAccessMode;
  topicId: string;
  numbers: Array<{
    id: string;
    number: number;
    answerFile: AnswerFile | null;
  }>;
};

function createBlobPathname(fileName: string) {
  return `uploads/${Date.now()}-${crypto.randomUUID()}-${getSafeUploadFileName(fileName)}`;
}

function getRegisterErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 400) {
    return "Файл не прошел валидацию. Для ответа подходят только PNG и JPG.";
  }

  return "Не удалось завершить загрузку файла.";
}

function getAttachErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  if (status === 400) {
    return "Не удалось привязать ответ к номеру.";
  }

  return "Сохранение ответа не удалось.";
}

function getDeleteErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  return "Не удалось удалить ответ.";
}

export function TopicAnswerManager({ uploadMode, blobAccess, topicId, numbers }: TopicAnswerManagerProps) {
  const initialState = useMemo<NumberAnswerCard[]>(
    () =>
      numbers.map((number) => ({
        ...number,
        uploadStatus: "idle",
        progress: 0,
        error: null,
        isDeleting: false
      })),
    [numbers]
  );
  const numbersRef = useRef<NumberAnswerCard[]>(initialState);
  const [items, setItems] = useState(initialState);

  const updateItems = useCallback((updater: (current: NumberAnswerCard[]) => NumberAnswerCard[]) => {
    setItems((current) => {
      const next = updater(current);
      numbersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    numbersRef.current = initialState;
    setItems(initialState);
  }, [initialState]);

  const attachUploadedAnswer = useCallback(
    async (homeworkNumberId: string, fileId: string) => {
      const response = await fetch("/api/teacher/number-answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          homeworkNumberId,
          fileId
        })
      });

      const result = (await response.json().catch(() => null)) as
        | {
            answerFile?: AnswerFile;
            error?: string;
          }
        | null;

      if (!response.ok || !result?.answerFile) {
        throw new Error(result?.error || getAttachErrorMessage(response.status));
      }

      return result.answerFile;
    },
    []
  );

  const handleFileSelect = useCallback(
    async (homeworkNumberId: string, nextFile: File | null) => {
      if (!nextFile) {
        return;
      }

      const allowedMimeTypes = new Set(["image/png", "image/jpeg"]);
      const normalizedName = nextFile.name.toLowerCase();
      const isAllowedExtension =
        normalizedName.endsWith(".png") || normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg");

      if ((!nextFile.type || !allowedMimeTypes.has(nextFile.type)) && !isAllowedExtension) {
        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  uploadStatus: "error",
                  error: "Для ответа подходят только изображения PNG и JPG.",
                  progress: 0
                }
              : item
          )
        );
        return;
      }

      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                uploadStatus: "uploading",
                progress: 0,
                error: null
              }
            : item
        )
      );

      try {
        let uploadedFileId = "";

        if (uploadMode === "blob") {
          const blob = await uploadToBlob(createBlobPathname(nextFile.name), nextFile, {
            access: blobAccess,
            handleUploadUrl: "/api/teacher/uploads",
            contentType: nextFile.type || undefined,
            onUploadProgress: ({ percentage }) => {
              updateItems((current) =>
                current.map((item) =>
                  item.id === homeworkNumberId
                    ? {
                        ...item,
                        uploadStatus: "uploading",
                        progress: Math.round(percentage),
                        error: null
                      }
                    : item
                )
              );
            }
          });

          const registerResponse = await fetch("/api/teacher/uploads", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "register-blob",
              pathname: blob.pathname,
              contentType: blob.contentType,
              originalName: nextFile.name,
              size: nextFile.size
            })
          });

          const registerResult = (await registerResponse.json().catch(() => null)) as
            | {
                file?: AnswerFile;
                error?: string;
              }
            | null;

          if (!registerResponse.ok || !registerResult?.file) {
            throw new Error(registerResult?.error || getRegisterErrorMessage(registerResponse.status));
          }

          uploadedFileId = registerResult.file.id;
        } else {
          const response = await new Promise<Response>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();

            formData.append("file", nextFile);
            xhr.open("POST", "/api/teacher/uploads");

            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) {
                return;
              }

              updateItems((current) =>
                current.map((item) =>
                  item.id === homeworkNumberId
                    ? {
                        ...item,
                        uploadStatus: "uploading",
                        progress: Math.round((event.loaded / event.total) * 100),
                        error: null
                      }
                    : item
                )
              );
            };

            xhr.onload = () => {
              resolve(
                new Response(xhr.responseText, {
                  status: xhr.status,
                  statusText: xhr.statusText
                })
              );
            };

            xhr.onerror = () => {
              reject(new Error("Сеть прервалась во время загрузки изображения."));
            };

            xhr.send(formData);
          });

          const localResult = (await response.json().catch(() => null)) as
            | {
                file?: AnswerFile;
                error?: string;
              }
            | null;

          if (!response.ok || !localResult?.file) {
            throw new Error(localResult?.error || getRegisterErrorMessage(response.status));
          }

          uploadedFileId = localResult.file.id;
        }

        const answerFile = await attachUploadedAnswer(homeworkNumberId, uploadedFileId);

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  answerFile,
                  uploadStatus: "idle",
                  progress: 0,
                  error: null
                }
              : item
          )
        );
      } catch (error) {
        console.error("Failed to upload answer for homework number.", { topicId, homeworkNumberId, error });

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  uploadStatus: "error",
                  progress: 0,
                  error: error instanceof Error ? error.message : "Не удалось загрузить ответ."
                }
              : item
          )
        );
      }
    },
    [attachUploadedAnswer, blobAccess, topicId, updateItems, uploadMode]
  );

  const removeAnswer = useCallback(
    async (homeworkNumberId: string) => {
      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isDeleting: true,
                error: null
              }
            : item
        )
      );

      try {
        const response = await fetch("/api/teacher/number-answers", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            homeworkNumberId
          })
        });

        const result = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error || getDeleteErrorMessage(response.status));
        }

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  answerFile: null,
                  isDeleting: false,
                  error: null
                }
              : item
          )
        );
      } catch (error) {
        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  isDeleting: false,
                  error: error instanceof Error ? error.message : "Не удалось удалить ответ."
                }
              : item
          )
        );
      }
    },
    [updateItems]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ответ к заданию</p>
              <h3 className="font-display mt-2 text-2xl font-semibold text-slate-950">№ {item.number}</h3>
            </div>
            <Badge
              className={cx(
                "border-slate-200 bg-white text-slate-700",
                item.answerFile && "border-emerald-200 bg-emerald-50 text-emerald-700"
              )}
            >
              {item.answerFile ? "Ответ загружен" : "Ответа пока нет"}
            </Badge>
          </div>

          <div className="mt-4 space-y-4">
            {item.answerFile ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">{item.answerFile.originalName}</Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">{formatFileSize(item.answerFile.size)}</Badge>
                </div>
                <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                  <Image
                    src={`/files/${item.answerFile.id}`}
                    alt={`Ответ к номеру ${item.number}`}
                    width={1200}
                    height={900}
                    unoptimized
                    className="max-h-[280px] h-auto w-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-6 text-slate-500">
                Пока ответ к этому номеру не добавлен.
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Загрузить или заменить ответ</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={(event) => {
                  void handleFileSelect(item.id, event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
                disabled={item.uploadStatus === "uploading" || item.isDeleting}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              />
              <p className="text-sm leading-6 text-slate-500">
                Поддерживаются только изображения PNG и JPG, чтобы ученик видел ответ как spoiler.
              </p>
            </label>

            {item.uploadStatus === "uploading" ? (
              <div className="space-y-2 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-4">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span>Загрузка ответа...</span>
                  <span className="font-semibold">{item.progress}%</span>
                </div>
                <ProgressBar value={item.progress} />
              </div>
            ) : null}

            {item.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
                {item.error}
              </div>
            ) : null}

            {item.answerFile ? (
              <button
                type="button"
                onClick={() => void removeAnswer(item.id)}
                disabled={item.isDeleting || item.uploadStatus === "uploading"}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {item.isDeleting ? "Удаляем..." : "Удалить ответ"}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
