"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
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
    "inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700";

  return (
    <label className="block space-y-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="file"
        name={name}
        accept=".pdf,.docx,.png,.jpg,.jpeg"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
      />

      {state.status === "uploading" ? (
        <div className="space-y-2 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Загрузка файла...</span>
            <span className="font-semibold">{state.progress}%</span>
          </div>
          <ProgressBar value={state.progress} />
        </div>
      ) : null}

      {state.status === "uploaded" && state.file ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={uploadBadgeClassName}>Загружено</span>
            <span className={uploadBadgeClassName}>{state.file.mimeType}</span>
            <span className={uploadBadgeClassName}>
              {formatUploadFileSize(state.file.size)}
            </span>
          </div>
          <p className="text-sm font-medium text-emerald-900">{state.file.originalName}</p>
        </div>
      ) : null}

      {state.status === "error" && state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
          {state.error}
        </div>
      ) : null}
    </label>
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

  const handleUpload = (
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

          console.error("Blob upload failed in topic create form.", error);
          setState({
            status: "error",
            progress: 0,
            file: null,
            error: "Не удалось загрузить файл в storage. Проверьте BLOB_READ_WRITE_TOKEN и повторите попытку."
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
  };

  const isUploading = theoryUpload.status === "uploading" || homeworkUpload.status === "uploading";
  const isReadyToCreate =
    theoryUpload.status === "uploaded" &&
    homeworkUpload.status === "uploaded" &&
    Boolean(theoryUpload.file?.id) &&
    Boolean(homeworkUpload.file?.id);
  const hasRequiredFields = Boolean(title.trim() && description.trim() && numbers.trim());
  const isSubmitDisabled = !isReadyToCreate || isUploading || isSubmitting || !hasRequiredFields;

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
        <span className="text-sm font-medium text-slate-700">Название темы</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, Логарифмы и их свойства"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
          required
        />
      </label>

      <label className="block space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-slate-700">Описание</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Что нужно изучить в теории и на что обратить внимание в домашнем задании."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
          required
        />
      </label>

      <FileUploadField
        name="theoryFile"
        label="Файл теории"
        state={theoryUpload}
        onFileSelect={(file) => handleUpload(file, theoryUpload, setTheoryUpload, theoryAbortRef)}
      />

      <FileUploadField
        name="homeworkFile"
        label="Файл домашнего задания"
        state={homeworkUpload}
        onFileSelect={(file) => handleUpload(file, homeworkUpload, setHomeworkUpload, homeworkAbortRef)}
      />

      <label className="block space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-slate-700">Номера домашнего задания</span>
        <input
          type="text"
          value={numbers}
          onChange={(event) => setNumbers(event.target.value)}
          placeholder="12, 14, 18, 22"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
          required
        />
      </label>

      <div className="space-y-3 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          {isUploading
            ? "Дождитесь окончания загрузки файлов. Кнопка создания станет доступной автоматически."
            : isReadyToCreate
              ? "Оба файла загружены. Теперь можно создавать тему."
              : "Сначала загрузите файл теории и файл домашнего задания."}
        </div>

        {submitError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {isSubmitting ? "Создаем тему..." : "Создать тему"}
        </button>
      </div>
    </form>
  );
}
