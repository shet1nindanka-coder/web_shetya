import { Fragment } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { splitLineIntoItems, splitMathIntoItems } from "@/lib/latex-line-items";

type LatexAnswerPreviewProps = {
  value: string;
  /**
   * Компактный режим для тесных карточек: блочные формулы ($$…$$) рендерятся
   * в текстовом размере и по левому краю, а не крупным центрированным дисплеем.
   */
  compact?: boolean;
};

function renderInlineMathError(error: Error) {
  return (
    <code className="rounded bg-[var(--theme-danger-soft)] px-1 py-0.5 text-[var(--theme-danger-text)]">
      {error.name}
    </code>
  );
}

function renderInlineLine(line: string, lineKey: string) {
  const parts = line.split(/(\$[^$]+\$)/g).filter(Boolean);

  return parts.map((part, partIndex) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1);

      return <InlineMath key={`math-${lineKey}-${partIndex}`} math={math} renderError={renderInlineMathError} />;
    }

    return <Fragment key={`text-${lineKey}-${partIndex}`}>{part}</Fragment>;
  });
}

export function LatexAnswerPreview({ value, compact = false }: LatexAnswerPreviewProps) {
  const blocks = value
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 rounded-2xl bg-[var(--theme-surface-soft)] px-3 py-3 text-sm leading-7 text-[var(--theme-text-default)]">
      {blocks.map((block, blockIndex) => {
        const isDisplayMath =
          (block.startsWith("$$") && block.endsWith("$$") && block.length > 4) ||
          (block.startsWith("\\[") && block.endsWith("\\]") && block.length > 4);

        if (isDisplayMath) {
          const math = block.slice(2, -2).trim();
          const mathItems = splitMathIntoItems(math);

          // В компактном режиме дисплейная формула заняла бы половину карточки —
          // рендерим текстовым размером по левому краю, сохраняя разбиение на
          // пункты «А) … Б) …», чтобы они переносились, а не уезжали за край.
          if (compact) {
            const compactItems = mathItems.labeled && mathItems.items.length > 1 ? mathItems.items : [math];

            return (
              <div key={`block-${blockIndex}`} className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-7 gap-y-2">
                {compactItems.map((item, itemIndex) => (
                  <span key={`compact-item-${blockIndex}-${itemIndex}`} className="inline-block max-w-full py-0.5">
                    <InlineMath math={item} renderError={renderInlineMathError} />
                  </span>
                ))}
              </div>
            );
          }

          // Формула с пунктами «А) … Б) …» на верхнем уровне: каждый пункт —
          // отдельная формула, переносится на новую строку целиком.
          if (mathItems.labeled && mathItems.items.length > 1) {
            return (
              <div key={`block-${blockIndex}`} className="min-w-0 max-w-full">
                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {mathItems.items.map((item, itemIndex) => (
                    <span key={`math-item-${blockIndex}-${itemIndex}`} className="inline-block max-w-full py-0.5">
                      <InlineMath math={`\\displaystyle ${item}`} renderError={renderInlineMathError} />
                    </span>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={`block-${blockIndex}`} className="min-w-0 max-w-full overflow-x-auto">
              <BlockMath
                math={math}
                renderError={(error) => (
                  <code className="block whitespace-pre-wrap rounded bg-[var(--theme-danger-soft)] px-3 py-2 text-[var(--theme-danger-text)]">
                    {error.name}: {error.message}
                  </code>
                )}
              />
            </div>
          );
        }

        return (
          <div key={`text-block-${blockIndex}`} className="space-y-2">
            {block.split("\n").map((line, lineIndex) => {
              const { items, labeled } = splitLineIntoItems(line);

              // Пункты «А) … Б) …» раскладываются flex-сеткой: строки сетки не
              // пересекаются по вертикали, даже когда в пунктах высокие дроби —
              // обычный абзац с фиксированным межстрочным интервалом здесь
              // давал наезжание строк друг на друга.
              if (labeled) {
                return (
                  <div
                    key={`line-${blockIndex}-${lineIndex}`}
                    className="flex flex-wrap items-baseline gap-x-7 gap-y-3"
                  >
                    {items.map((item, itemIndex) => (
                      <span
                        key={`item-${blockIndex}-${lineIndex}-${itemIndex}`}
                        className="inline-block max-w-full py-0.5"
                      >
                        {renderInlineLine(item, `${lineIndex}-${itemIndex}`)}
                      </span>
                    ))}
                  </div>
                );
              }

              return (
                <p key={`line-${blockIndex}-${lineIndex}`}>{renderInlineLine(line, `${lineIndex}`)}</p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
