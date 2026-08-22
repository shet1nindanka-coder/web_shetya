"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogExit } from "@/lib/animation-hooks";

/*
 * Кнопка «Предпросмотр»: открывает файл во весь экран поверх страницы
 * (вкладка «Теория» ученика). Сами предпросмотры не грузятся, пока кнопку
 * не нажали — iframe создаётся только в открытом окне.
 */

type FileFullscreenPreviewProps = {
  fileId: string;
  fileName: string;
};

export function FileFullscreenPreview({ fileId, fileName }: FileFullscreenPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { closing, close } = useDialogExit(useCallback(() => setIsOpen(false), []));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="shbz-btn-primary px-[20px] py-2.5 text-[13.5px]"
      >
        Открыть
      </button>

      {isOpen
        ? createPortal(
            <div
              data-closing={String(closing)}
              className="shbz-modal-overlay fixed inset-0 z-50 flex flex-col bg-[rgba(15,23,42,0.78)] p-3 sm:p-6"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Предпросмотр файла ${fileName}`}
                data-closing={String(closing)}
                className="shbz-modal-card shbz-card mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden p-0"
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                  style={{ borderBottom: "1px solid var(--shbz-row-border)" }}
                >
                  <span className="truncate text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                    {fileName}
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <a href={`/files/${fileId}?download=1`} className="shbz-btn-outline no-underline">
                      Скачать файл
                    </a>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Закрыть предпросмотр"
                      className="shbz-btn-outline"
                    >
                      Закрыть
                    </button>
                  </span>
                </div>
                <iframe
                  src={`/files/${fileId}`}
                  title={`Предпросмотр: ${fileName}`}
                  className="w-full flex-1 border-0"
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
