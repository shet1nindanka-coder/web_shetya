"use client";

import { useEffect, useRef, useState } from "react";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";

/*
 * Условие задачи в карточке выбора номера (ручное составление занятия и выдача ДЗ).
 * Свёрнуто: компактная математика, ограничение по высоте, фейд вместо жёсткого
 * обреза и кнопка «Показать целиком». Развёрнуто: полный рендер, как в чер-
 * новиках ИИ. Кнопка живёт вне кнопки-выбора карточки, поэтому клик по ней
 * не трогает выбор номера.
 */

const COLLAPSED_MAX_PX = 128;

type NumberConditionClampProps = {
  value: string;
};

export function NumberConditionClamp({ value }: NumberConditionClampProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // KaTeX-шрифты доезжают позже первого рендера и меняют высоту — меряем
  // содержимое наблюдателем, а не один раз на маунте.
  useEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    const measure = () => {
      setOverflowing(element.scrollHeight > COLLAPSED_MAX_PX + 2);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [value]);

  const clamped = !expanded;

  return (
    <div className="mt-2 text-left text-sm">
      <div
        className="relative overflow-hidden"
        style={clamped ? { maxHeight: `${COLLAPSED_MAX_PX}px` } : undefined}
      >
        <div ref={contentRef}>
          <LatexAnswerPreview value={value} compact={clamped} />
        </div>
        {clamped && overflowing ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-2xl"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--theme-surface-soft))"
            }}
          />
        ) : null}
      </div>
      {overflowing || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((current) => !current);
          }}
          className="pointer-events-auto relative z-[1] mt-1.5 text-[12.5px] font-semibold transition hover:opacity-75"
          style={{ color: "var(--shbz-accent-solid)" }}
        >
          {expanded ? "Скрыть" : "Показать целиком"}
        </button>
      ) : null}
    </div>
  );
}
