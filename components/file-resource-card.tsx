import Image from "next/image";
import { PdfPreview } from "@/components/pdf-preview";
import { isImageMime, isOfficeMime, isPdfMime } from "@/lib/utils";

type FileResource = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
};

type FileResourceCardProps = {
  title: string;
  description?: string;
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
    <article className="ui-file-card ui-fade-slide ui-surface rounded-[16px] border p-4 sm:rounded-[16px] sm:p-5">
      {/* Шапка без имени файла, веса и даты — решение владельца: карточка
          нужна ради предпросмотра, метаданные только отнимали у него место. */}
      <div className="ui-file-card-header flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="ui-kicker">{title}</p>
          {!showPreview && file ? (
            <p className="ui-copy-muted truncate text-sm" title={file.originalName}>
              {file.originalName}
            </p>
          ) : null}
          {description ? <p className="ui-hint ui-copy-muted text-sm leading-6">{description}</p> : null}
        </div>

        {file ? (
          <div className="ui-file-card-actions flex flex-wrap gap-2.5">
            <a
              href={`/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="ui-pressable ui-button-primary inline-flex justify-center rounded-[12px] px-4 py-2 text-sm font-semibold transition"
            >
              Открыть в браузере
            </a>
            <a
              href={`/files/${file.id}?download=1`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[12px] px-4 py-2 text-sm font-semibold transition"
            >
              Скачать файл
            </a>
          </div>
        ) : null}
      </div>

      {!file ? (
        <div className="ui-card-soft ui-hint ui-copy-muted mt-4 rounded-[16px] border border-dashed px-4 py-6 text-sm leading-6">
          Файл пока не загружен.
        </div>
      ) : (
        <div className="mt-4">
          {!showPreview ? (
            <div className="ui-card-soft ui-hint ui-copy-muted rounded-[16px] px-4 py-5 text-sm leading-6">
              Предпросмотр скрыт. Файл можно открыть или скачать.
            </div>
          ) : null}

          {showPreview && isPdfMime(file.mimeType) ? (
            <div className="ui-card-soft overflow-hidden rounded-[16px]">
              <PdfPreview
                fileId={file.id}
                fileName={file.originalName}
                maxHeightClassName={isExpanded ? "max-h-[480px] sm:max-h-[640px] lg:max-h-[900px]" : "max-h-[420px] sm:max-h-[560px] lg:max-h-[680px]"}
              />
            </div>
          ) : null}

          {showPreview && !isPdfMime(file.mimeType) && isImageMime(file.mimeType) ? (
            <div className="ui-card-soft overflow-hidden rounded-[16px] p-2">
              <Image
                src={`/files/${file.id}`}
                alt={file.originalName}
                width={1200}
                height={900}
                unoptimized
                className={
                  isExpanded
                    ? "max-h-[480px] h-auto w-full rounded-[12px] object-contain sm:max-h-[640px] lg:max-h-[900px]"
                    : "max-h-[420px] h-auto w-full rounded-[12px] object-contain sm:max-h-[560px] lg:max-h-[680px]"
                }
              />
            </div>
          ) : null}

          {showPreview && !isPdfMime(file.mimeType) && !isImageMime(file.mimeType) && isOfficeMime(file.mimeType) ? (
            <div className="ui-card-soft ui-hint ui-copy-muted rounded-[16px] px-4 py-5 text-sm leading-6">
              Для DOCX встроенный предпросмотр зависит от браузера.
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
