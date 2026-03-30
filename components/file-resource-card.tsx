import Image from "next/image";
import { formatDateTime, formatFileSize, isImageMime, isOfficeMime, isPdfMime } from "@/lib/utils";

type FileResource = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
};

type FileResourceCardProps = {
  title: string;
  description: string;
  file: FileResource | null;
  previewSize?: "default" | "expanded";
  showPreview?: boolean;
};

export function FileResourceCard({
  title,
  description,
  file,
  previewSize = "default",
  showPreview = true
}: FileResourceCardProps) {
  const isExpanded = previewSize === "expanded";

  return (
    <article className="ui-fade-slide ui-surface rounded-[22px] border border-slate-200/80 bg-white/94 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:rounded-[24px] sm:p-5 lg:rounded-[26px]">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.45rem] lg:text-[1.6rem]">
            {file ? file.originalName : "Файл не загружен"}
          </h3>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </div>

        {file ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>{formatFileSize(file.size)}</span>
            <span>Загружен {formatDateTime(file.uploadedAt)}</span>
            <span>{file.mimeType}</span>
          </div>
        ) : null}
      </div>

      {!file ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-white/92 px-4 py-6 text-sm leading-6 text-slate-500">
          Преподаватель ещё не прикрепил файл для этого блока.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-3">
            <a
              href={`/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="ui-pressable inline-flex w-full justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition sm:w-auto"
            >
              Открыть в браузере
            </a>
            <a
              href={`/files/${file.id}?download=1`}
              className="ui-pressable inline-flex w-full justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition sm:w-auto"
            >
              Скачать файл
            </a>
          </div>

          {!showPreview ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
              Предпросмотр скрыт, чтобы редактор оставался быстрее. Файл всё равно можно открыть в отдельной вкладке
              или скачать.
            </div>
          ) : null}

          {showPreview && isPdfMime(file.mimeType) ? (
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
              <iframe
                src={`/files/${file.id}`}
                title={file.originalName}
                className={isExpanded ? "h-[380px] w-full sm:h-[520px] lg:h-[760px]" : "h-[300px] w-full sm:h-[380px] lg:h-[420px]"}
              />
            </div>
          ) : null}

          {showPreview && !isPdfMime(file.mimeType) && isImageMime(file.mimeType) ? (
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 p-2">
              <Image
                src={`/files/${file.id}`}
                alt={file.originalName}
                width={1200}
                height={900}
                unoptimized
                className={
                  isExpanded
                    ? "max-h-[380px] h-auto w-full rounded-[18px] object-contain sm:max-h-[520px] lg:max-h-[760px]"
                    : "max-h-[300px] h-auto w-full rounded-[18px] object-contain sm:max-h-[380px] lg:max-h-[420px]"
                }
              />
            </div>
          ) : null}

          {showPreview && !isPdfMime(file.mimeType) && !isImageMime(file.mimeType) && isOfficeMime(file.mimeType) ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
              Для DOCX встроенный предпросмотр зависит от браузера. Файл можно открыть отдельной вкладкой или скачать.
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
