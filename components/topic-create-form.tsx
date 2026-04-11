"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileDropInput } from "@/components/file-drop-input";
import { ProgressBar } from "@/components/progress-bar";
import { TopicNumbersField } from "@/components/topic-numbers-field";
import { getSafeUploadFileName } from "@/lib/upload-file-name";

type UploadMode = "local" | "blob";
type BlobAccessMode = "private" | "public";

type UploadedFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type UploadState = {
  status: "idle" | "uploading" | "uploaded" | "error";
  progress: number;
  file: UploadedFile | null;
  error: string | null;
};

const initialUploadState: UploadState = {
  status: "idle",
  progress: 0,
  file: null,
  error: null
};

function formatUploadFileSize(size: number) {
  if (size < 1024) {
    return `${size} Б`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function getUploadErrorMessage(request: XMLHttpRequest) {
  if (request.status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (request.status === 400) {
    return "Файл не прошёл валидацию. Проверьте формат и размер.";
  }

  return "Не удалось загрузить файл. Попробуйте ещё раз.";
}

function getCreateErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 400) {
    return "Проверьте форму: название, описание, оба файла и список номеров обязательны.";
  }

  return "Не удалось создать тему. Проверьте подключение к базе данных и повторите попытку.";
}

function getBlobRegistrationErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 400) {
    return "Файл не прошёл валидацию. Проверьте формат и размер.";
  }

  return "Не удалось завершить загрузку файла. Попробуйте ещё раз.";
}

function createBlobPathname(fileName: string) {
  return `uploads/${Date.now()}-${crypto.randomUUID()}-${getSafeUploadFileName(fileName)}`;
}

function FileUploadField({
  name,
  label,
  state,
  onFileSelect
}: {
  name: string;
  label: string;
  state: UploadState;
  onFileSelect: (file: File | null) => void;
}) {
  const uploadBadgeClassName =
    "inline-flex items-center rounded-[12px] border border-[var(--theme-success-border)] bg-[var(--theme-surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-success-text)]";

  return (
    <div className="space-y-3">
      <FileDropInput
        name={name}
        label={label}
        accept=".pdf,.docx,.png,.jpg,.jpeg"
        onFileSelect={onFileSelect}
        helperText="Поддерживаются PDF, DOCX, PNG и JPG. Можно выбрать файл или просто перетащить его в это поле."
      />

      {state.status === "uploading" ? (
        <div className="space-y-2 rounded-2xl border border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] px-4 py-4" aria-live="polite">
          <div className="flex items-center justify-between text-sm text-[var(--theme-text-default)]">
            <span>Загрузка файла...</span>
            <span className="font-semibold">{state.progress}%</span>
          </div>
          <ProgressBar value={state.progress} size="lg" />
        </div>
      ) : null}

      {state.status === "uploaded" && state.file ? (
        <div className="ui-notice-success space-y-3 rounded-2xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={uploadBadgeClassName}>Загружено</span>
            <span className={uploadBadgeClassName}>{state.file.mimeType}</span>
            <span className={uploadBadgeClassName}>
              {formatUploadFileSize(state.file.size)}
            </span>
          </div>
          <p className="text-sm font-medium">{state.file.originalName}</p>
        </div>
      ) : null}

      {state.status === "error" && state.error ? (
        <div className="ui-notice-error rounded-2xl px-4 py-4 text-sm font-medium" aria-live="polite">
          {state.error}
        </div>
      ) : null}
    </div>
  );
}

export function TopicCreateForm({
  uploadMode,
  blobAccess
}: {
  uploadMode: UploadMode;
  blobAccess: BlobAccessMode;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [numbers, setNumbers] = useState("");
  const [theoryUpload, setTheoryUpload] = useState<UploadState>(initialUploadState);
  const [homeworkUpload, setHomeworkUpload] = useState<UploadState>(initialUploadState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const theoryAbortRef = useRef<(() => void) | null>(null);
  const homeworkAbortRef = useRef<(() => void) | null>(null);

  const handleUpload = useCallback((
    nextFile: File | null,
    currentState: UploadState,
    setState: (value: UploadState) => void,
    abortRef: { current: (() => void) | null }
  ) => {
    abortRef.current?.();
    abortRef.current = null;

    if (!nextFile) {
      setState(initialUploadState);
      return;
    }

    setState({
      status: "uploading",
      progress: 0,
      file: null,
      error: null
    });

    if (uploadMode === "blob") {
      const controller = new AbortController();
      abortRef.current = () => controller.abort();

      void (async () => {
        try {
          const blob = await uploadToBlob(createBlobPathname(nextFile.name), nextFile, {
            access: blobAccess,
            handleUploadUrl: "/api/teacher/uploads",
            contentType: nextFile.type || undefined,
            abortSignal: controller.signal,
            onUploadProgress: ({ percentage }) => {
              setState({
                status: "uploading",
                progress: Math.round(percentage),
                file: null,
                error: null
              });
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
              size: nextFile.size,
              previousFileId: currentState.file?.id ?? null
            })
          });

          const registerResult = (await registerResponse.json().catch(() => null)) as
            | { file?: UploadedFile; error?: string }
            | null;

          if (registerResponse.ok && registerResult?.file) {
            setState({
              status: "uploaded",
              progress: 100,
              file: registerResult.file,
              error: null
            });
            return;
          }

          setState({
            status: "error",
            progress: 0,
            file: null,
            error: registerResult?.error || getBlobRegistrationErrorMessage(registerResponse.status)
          });
        } catch (error) {
          if (controller.signal.aborted) {
            setState(initialUploadState);
            return;
          }

          if (process.env.NODE_ENV !== "production") {
            console.error("Blob upload failed in topic create form.", error);
          }
          setState({
            status: "error",
            progress: 0,
            file: null,
            error: "Не удалось загрузить файл в storage. Проверьте настройки файлового хранилища и повторите попытку."
          });
        } finally {
          abortRef.current = null;
        }
      })();

      return;
    }

    const formData = new FormData();
    formData.append("file", nextFile);

    if (currentState.file?.id) {
      formData.append("previousFileId", currentState.file.id);
    }

    const request = new XMLHttpRequest();
    request.open("POST", "/api/teacher/uploads");
    request.responseType = "json";
    abortRef.current = () => request.abort();

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      setState({
        status: "uploading",
        progress: Math.round((event.loaded / event.total) * 100),
        file: null,
        error: null
      });
    };

    request.onload = () => {
      const response = request.response as { file?: UploadedFile; error?: string } | null;

      if (request.status >= 200 && request.status < 300 && response?.file) {
        setState({
          status: "uploaded",
          progress: 100,
          file: response.file,
          error: null
        });
        return;
      }

      setState({
        status: "error",
        progress: 0,
        file: null,
        error: response?.error || getUploadErrorMessage(request)
      });
    };

    request.onerror = () => {
      setState({
        status: "error",
        progress: 0,
        file: null,
        error: "Сеть прервалась во время загрузки файла."
      });
    };

    request.onabort = () => {
      setState(initialUploadState);
    };

    request.send(formData);
  }, [blobAccess, uploadMode]);

  const isUploading = theoryUpload.status === "uploading" || homeworkUpload.status === "uploading";
  const isReadyToCreate =
    theoryUpload.status === "uploaded" &&
    homeworkUpload.status === "uploaded" &&
    Boolean(theoryUpload.file?.id) &&
    Boolean(homeworkUpload.file?.id);
  const hasRequiredFields = Boolean(title.trim() && description.trim() && numbers.trim());
  const isSubmitDisabled = !isReadyToCreate || isUploading || isSubmitting || !hasRequiredFields;

  const handleTheoryFileSelect = useCallback(
    (file: File | null) => handleUpload(file, theoryUpload, setTheoryUpload, theoryAbortRef),
    [handleUpload, theoryUpload]
  );
  const handleHomeworkFileSelect = useCallback(
    (file: File | null) => handleUpload(file, homeworkUpload, setHomeworkUpload, homeworkAbortRef),
    [handleUpload, homeworkUpload]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/teacher/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          numbers,
          theoryFileId: theoryUpload.file?.id,
          homeworkFileId: homeworkUpload.file?.id
        })
      });

      const result = (await response.json().catch(() => null)) as
        | { redirectTo?: string; error?: string }
        | null;

      if (response.ok && result?.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
        return;
      }

      setSubmitError(result?.error || getCreateErrorMessage(response.status));
    } catch {
      setSubmitError("Сеть прервалась во время создания темы. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
      <label className="block space-y-2 lg:col-span-2">
        <span className="ui-form-label">Название темы</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, Логарифмы и их свойства"
          className="ui-input w-full rounded-2xl px-4 py-3"
          required
        />
      </label>

      <label className="block space-y-2 lg:col-span-2">
        <span className="ui-form-label">Описание</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Что нужно изучить в теории и на что обратить внимание в заданиях по теме."
          className="ui-input w-full rounded-2xl px-4 py-3"
          required
        />
      </label>

      <FileUploadField
        name="theoryFile"
        label="Файл теории"
        state={theoryUpload}
        onFileSelect={handleTheoryFileSelect}
      />

      <FileUploadField
        name="homeworkFile"
        label="Файл заданий"
        state={homeworkUpload}
        onFileSelect={handleHomeworkFileSelect}
      />

      <div className="lg:col-span-2">
        <TopicNumbersField
          name="numbers"
          value={numbers}
          onValueChange={setNumbers}
          rows={5}
          description="Подходит и для коротких списков, и для больших тем на сотни номеров."
        />
      </div>

      <div className="space-y-3 lg:col-span-2">
        <div className="ui-hint ui-panel-soft rounded-2xl px-4 py-4 text-sm text-[var(--theme-text-muted)]">
          {isUploading
            ? "Дождитесь окончания загрузки файлов. Кнопка создания станет доступной автоматически."
            : isReadyToCreate
              ? "Оба файла загружены. Теперь можно создавать тему."
              : "Сначала загрузите файл теории и файл заданий."}
        </div>

        {submitError ? (
          <div className="ui-notice-error rounded-2xl px-4 py-4 text-sm font-medium" aria-live="polite">
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="ui-pressable ui-button-primary rounded-2xl px-5 py-3 text-sm font-semibold transition"
        >
          {isSubmitting ? "Создаем тему..." : "Создать тему"}
        </button>
      </div>
    </form>
  );
}
