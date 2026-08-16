"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="shbz-btn-primary px-[20px] py-2.5 text-[13.5px]"
      >
        Предпросмотр
      </button>

      {isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex flex-col bg-[rgba(15,23,42,0.78)] p-3 backdrop-blur-sm sm:p-6"
              onClick={() => setIsOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Предпросмотр файла ${fileName}`}
                className="shbz-card mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden p-0"
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
                      onClick={() => setIsOpen(false)}
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
