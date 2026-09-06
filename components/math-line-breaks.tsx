"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MATH_LINE_BREAKS_GLOBAL } from "@/lib/math-line-breaks";

/*
 * Обёртка, которая после раскладки применяет математическое правило переноса
 * ко всем формулам KaTeX внутри (знак операции повторяется в начале новой
 * строки). Пересчитывает при изменении ширины контейнера и после загрузки шрифтов.
 */
export function MathLineBreaks({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    // Сама функция подключена инлайн-скриптом в app/layout.tsx (CSP без eval).
    const apply = (window as unknown as Record<string, unknown>)[MATH_LINE_BREAKS_GLOBAL];

    if (typeof apply !== "function") {
      return;
    }

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (apply as (node: ParentNode) => void)(root));
    };

    schedule();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(root);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule).catch(() => undefined);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
