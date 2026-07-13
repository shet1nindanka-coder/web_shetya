import Image from "next/image";
import { PdfPreview } from "@/components/pdf-preview";
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
      <div className="ui-file-card-header flex flex-col gap-4 border-b pb-5">
        <div className="space-y-1.5">
          <p className="ui-kicker">{title}</p>
          <h3 className="ui-file-card-title font-display text-[1.35rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.45rem] lg:text-[1.6rem]">
            {file ? file.originalName : "Файл не загружен"}
          </h3>
          {description ? <p className="ui-hint ui-copy-muted text-sm leading-6">{description}</p> : null}
        </div>

        {file ? (
          <div className="ui-file-card-meta ui-copy-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>{formatFileSize(file.size)}</span>
            <span>Загружен {formatDateTime(file.uploadedAt)}</span>
            <span>{file.mimeType}</span>
          </div>
        ) : null}
      </div>

      {!file ? (
        <div className="ui-card-soft ui-hint ui-copy-muted mt-5 rounded-[16px] border border-dashed px-4 py-6 text-sm leading-6">
          Файл пока не загружен.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="ui-file-card-actions flex flex-wrap gap-3">
            <a
              href={`/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[12px] px-4 py-2 text-sm font-semibold transition sm:w-auto"
            >
              Открыть в браузере
            </a>
            <a
              href={`/files/${file.id}?download=1`}
              className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[12px] px-4 py-2 text-sm font-semibold transition sm:w-auto"
            >
              Скачать файл
            </a>
          </div>

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
                maxHeightClassName={isExpanded ? "max-h-[380px] sm:max-h-[520px] lg:max-h-[760px]" : "max-h-[300px] sm:max-h-[380px] lg:max-h-[420px]"}
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
                    ? "max-h-[380px] h-auto w-full rounded-[12px] object-contain sm:max-h-[520px] lg:max-h-[760px]"
                    : "max-h-[300px] h-auto w-full rounded-[12px] object-contain sm:max-h-[380px] lg:max-h-[420px]"
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
