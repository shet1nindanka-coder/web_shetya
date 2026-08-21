"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { cx } from "@/lib/utils";

/*
 * Условие задачи в карточке выбора номера (ручное составление занятия и выдача ДЗ).
 * Свёрнуто: компактная математика, ограничение по высоте и фейд-маска вместо
 * жёсткого обреза; при переполнении — кнопка «Показать целиком». Развёрнуто:
 * полный рендер, как в черновиках ИИ. Фейд сделан CSS-маской: содержимое само
 * растворяется в фон карточки, поэтому не зависит от токенов темы.
 */

// Держать в синхроне с max-h-32 (8rem) на контейнере обрезки.
const COLLAPSED_MAX_PX = 128;

const FADE_MASK = "linear-gradient(to bottom, rgb(0 0 0) calc(100% - 44px), rgb(0 0 0 / 0))";

type NumberConditionClampProps = {
  value: string;
};

export function NumberConditionClamp({ value }: NumberConditionClampProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const regionId = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    // Замер только из колбэка ResizeObserver: он приходит после layout (и сам
    // доставляет первый замер), поэтому не форсит рефлоу поддеревьев, которые
    // content-visibility: auto пропустил. Пропущенная карточка отдаёт нулевую
    // высоту — её не трактуем как «влезло», а ждём замера при попадании в
    // вьюпорт. Заодно ловим горизонтальное переполнение неразрывных формул.
    const observer = new ResizeObserver((entries) => {
      const height = entries[entries.length - 1]?.contentRect.height ?? 0;

      if (height === 0) {
        return;
      }

      const heightOverflow = element.scrollHeight > COLLAPSED_MAX_PX;
      const widthOverflow = element.scrollWidth > element.clientWidth + 1;

      setOverflowing(heightOverflow || widthOverflow);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const clamped = !expanded;
  const showFade = clamped && overflowing;

  return (
    <div className="mt-2 text-left text-sm">
      <div
        id={regionId}
        className={cx("relative", clamped && "max-h-32 overflow-hidden")}
        style={showFade ? { WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK } : undefined}
      >
        <div ref={contentRef}>
          <LatexAnswerPreview value={value} compact={clamped} />
        </div>
      </div>
      {overflowing || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1.5 text-[12.5px] font-semibold transition hover:opacity-75"
          style={{ color: "var(--shbz-accent-solid)" }}
        >
          {expanded ? "Скрыть" : "Показать целиком"}
        </button>
      ) : null}
    </div>
  );
}
