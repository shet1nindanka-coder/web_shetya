declare module "react-katex" {
  import type { ReactNode } from "react";

  export function InlineMath(props: {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }): ReactNode;

  export function BlockMath(props: {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }): ReactNode;
}
