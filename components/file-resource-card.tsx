import Image from "next/image";
import { Badge } from "@/components/badge";
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
};

export function FileResourceCard({
  title,
  description,
  file,
  previewSize = "default"
}: FileResourceCardProps) {
  const isExpanded = previewSize === "expanded";

  return (
    <article className="ui-fade-slide ui-surface relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
      <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-brand-100/45 blur-3xl" />
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <h3 className="font-display text-2xl font-semibold text-slate-950">{file ? file.originalName : "Файл не загружен"}</h3>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>

        {file ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-brand-200 bg-brand-50 text-brand-700">{file.mimeType}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-600">{formatFileSize(file.size)}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-600">
              Загружен {formatDateTime(file.uploadedAt)}
            </Badge>
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
              className="ui-pressable rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Открыть в браузере
            </a>
            <a
              href={`/files/${file.id}?download=1`}
              className="ui-pressable rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Скачать файл
            </a>
          </div>

          {isPdfMime(file.mimeType) ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-inner">
              <iframe
                src={`/files/${file.id}`}
                title={file.originalName}
                className={isExpanded ? "h-[620px] w-full lg:h-[760px]" : "h-[420px] w-full"}
              />
            </div>
          ) : null}

          {!isPdfMime(file.mimeType) && isImageMime(file.mimeType) ? (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-2 shadow-inner">
              <Image
                src={`/files/${file.id}`}
                alt={file.originalName}
                width={1200}
                height={900}
                unoptimized
                className={
                  isExpanded
                    ? "max-h-[620px] h-auto w-full rounded-[18px] object-contain lg:max-h-[760px]"
                    : "max-h-[420px] h-auto w-full rounded-[18px] object-contain"
                }
              />
            </div>
          ) : null}

          {!isPdfMime(file.mimeType) && !isImageMime(file.mimeType) && isOfficeMime(file.mimeType) ? (
            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
              Для DOCX встроенный предпросмотр зависит от браузера. Файл можно открыть отдельной вкладкой или скачать.
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
