"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ProgressBar } from "@/components/progress-bar";

type TopicCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

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

function CreateTopicSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
    >
      {pending ? "Создаем тему..." : "Создать тему"}
    </button>
  );
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

export function TopicCreateForm({ action }: TopicCreateFormProps) {
  const [theoryUpload, setTheoryUpload] = useState<UploadState>(initialUploadState);
  const [homeworkUpload, setHomeworkUpload] = useState<UploadState>(initialUploadState);
  const theoryRequestRef = useRef<XMLHttpRequest | null>(null);
  const homeworkRequestRef = useRef<XMLHttpRequest | null>(null);

  const handleUpload = (
    nextFile: File | null,
    currentState: UploadState,
    setState: (value: UploadState) => void,
    requestRef: { current: XMLHttpRequest | null }
  ) => {
    requestRef.current?.abort();

    if (!nextFile) {
      setState(initialUploadState);
      return;
    }

    const formData = new FormData();
    formData.append("file", nextFile);

    if (currentState.file?.id) {
      formData.append("previousFileId", currentState.file.id);
    }

    const request = new XMLHttpRequest();
    requestRef.current = request;

    setState({
      status: "uploading",
      progress: 0,
      file: null,
      error: null
    });

    request.open("POST", "/api/teacher/uploads");
    request.responseType = "json";

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

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-2">
      <input type="hidden" name="theoryFileId" value={theoryUpload.file?.id ?? ""} />
      <input type="hidden" name="homeworkFileId" value={homeworkUpload.file?.id ?? ""} />

      <label className="block space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-slate-700">Название темы</span>
        <input
          type="text"
          name="title"
          placeholder="Например, Логарифмы и их свойства"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
          required
        />
      </label>

      <label className="block space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-slate-700">Описание</span>
        <textarea
          name="description"
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
        onFileSelect={(file) => handleUpload(file, theoryUpload, setTheoryUpload, theoryRequestRef)}
      />

      <FileUploadField
        name="homeworkFile"
        label="Файл домашнего задания"
        state={homeworkUpload}
        onFileSelect={(file) => handleUpload(file, homeworkUpload, setHomeworkUpload, homeworkRequestRef)}
      />

      <label className="block space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-slate-700">Номера домашнего задания</span>
        <input
          type="text"
          name="numbers"
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

        <CreateTopicSubmitButton disabled={!isReadyToCreate} />
      </div>
    </form>
  );
}
