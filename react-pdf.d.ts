// Шим типов для @react-pdf/renderer до npm install (после установки используются типы пакета).
declare module "@react-pdf/renderer" {
  import type { ReactElement } from "react";

  export const Document: any;
  export const Page: any;
  export const View: any;
  export const Text: any;
  export const StyleSheet: { create<T>(styles: T): T };
  export const Font: {
    register(options: unknown): void;
    registerHyphenationCallback(callback: (word: string) => string[]): void;
  };
  export function renderToBuffer(element: ReactElement): Promise<Buffer>;
}
