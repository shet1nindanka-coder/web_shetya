// Шим типов для legacy-сборки pdf.js (реальные типы подтянутся из pdfjs-dist после npm install).
declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export type PdfPageViewport = {
    width: number;
    height: number;
  };

  export type PdfRenderTask = {
    promise: Promise<void>;
    cancel: () => void;
  };

  export type PdfPageProxy = {
    getViewport(options: { scale: number }): PdfPageViewport;
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfPageViewport }): PdfRenderTask;
  };

  export type PdfDocumentProxy = {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
    destroy(): Promise<void>;
  };

  export type PdfLoadingTask = {
    promise: Promise<PdfDocumentProxy>;
    destroy(): Promise<void>;
  };

  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: { url: string; withCredentials?: boolean }): PdfLoadingTask;
}
