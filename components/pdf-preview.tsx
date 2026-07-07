"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

type PdfPreviewProps = {
  fileId: string;
  fileName: string;
  maxHeightClassName?: string;
};

export function PdfPreview({ fileId, fileName, maxHeightClassName = "max-h-[420px]" }: PdfPreviewProps) {
  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PdfDocumentProxy | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const loadingTask = pdfjs.getDocument({ url: `/files/${fileId}`, withCredentials: true });
        loadedDoc = await loadingTask.promise;

        if (cancelled) {
          void loadedDoc.destroy();
          return;
        }

        setDoc(loadedDoc);
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setStatus("error");

          if (process.env.NODE_ENV !== "production") {
            console.error("Failed to load PDF preview.", error);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadedDoc?.destroy().catch(() => undefined);
    };
  }, [fileId]);

  if (status === "error") {
    return (
      <div className="px-4 py-6 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
        Не удалось показать предпросмотр. Откройте файл кнопкой выше.
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto ${maxHeightClassName}`}
      style={{ WebkitOverflowScrolling: "touch", background: "var(--shbz-progress-track)" }}
      aria-label={`Предпросмотр: ${fileName}`}
    >
      {status === "loading" ? (
        <div className="px-4 py-6 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Загружаем предпросмотр...
        </div>
      ) : null}
      {doc
        ? Array.from({ length: doc.numPages }, (_, index) => (
            <PdfPageCanvas key={index + 1} doc={doc} pageNumber={index + 1} />
          ))
        : null}
    </div>
  );
}

function PdfPageCanvas({ doc, pageNumber }: { doc: PdfDocumentProxy; pageNumber: number }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return;
    }

    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await doc.getPage(pageNumber);

        if (cancelled) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) {
          return;
        }

        const containerWidth = wrapper.clientWidth || 320;
        const baseViewport = page.getViewport({ scale: 1 });
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (containerWidth / baseViewport.width) * devicePixelRatio;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        await page.render({ canvasContext: context, viewport }).promise;

        if (!cancelled) {
          setIsRendered(true);
        }
      } catch (error) {
        if (!cancelled && process.env.NODE_ENV !== "production") {
          console.error(`Failed to render PDF page ${pageNumber}.`, error);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void renderPage();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(wrapper);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [doc, pageNumber]);

  return (
    <div ref={wrapperRef} className="px-1.5 pt-1.5 last:pb-1.5" style={{ minHeight: isRendered ? undefined : 220 }}>
      <canvas ref={canvasRef} className="block w-full rounded-[8px]" style={{ background: "#ffffff" }} />
    </div>
  );
}
