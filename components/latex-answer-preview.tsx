import { Fragment, type ReactNode } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { MathLineBreaks } from "@/components/math-line-breaks";
import { mergeSoftWrappedLines, splitLineIntoItems, splitMathIntoItems } from "@/lib/latex-line-items";

type LatexAnswerPreviewProps = {
  value: string;
};

function renderInlineMathError(error: Error) {
  return (
    <code className="rounded-[8px] bg-[var(--theme-danger-soft)] px-1 py-0.5 text-[var(--theme-danger-text)]">
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

/** Дисплейная формула: пункты «А) … Б) …» переносятся по одному, остальное — BlockMath со скроллом. */
function renderDisplayMath(math: string, key: string): ReactNode {
  const mathItems = splitMathIntoItems(math);

  if (mathItems.labeled && mathItems.items.length > 1) {
    return (
      <div key={key} className="min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {mathItems.items.map((item, itemIndex) => (
            <span key={`${key}-item-${itemIndex}`} className="inline-block max-w-full py-0.5">
              <InlineMath math={`\\displaystyle ${item}`} renderError={renderInlineMathError} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div key={key} className="min-w-0 max-w-full overflow-x-auto">
      <BlockMath
        math={math}
        renderError={(error) => (
          <code className="block whitespace-pre-wrap rounded-[8px] bg-[var(--theme-danger-soft)] px-3 py-2 text-[var(--theme-danger-text)]">
            {error.name}: {error.message}
          </code>
        )}
      />
    </div>
  );
}

function renderTextLines(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, lineIndex) => {
      const { items, labeled } = splitLineIntoItems(line);

      // Пункты «А) … Б) …» раскладываются flex-сеткой: строки сетки не
      // пересекаются по вертикали, даже когда в пунктах высокие дроби —
      // обычный абзац с фиксированным межстрочным интервалом здесь
      // давал наезжание строк друг на друга.
      if (labeled) {
        return (
          <div key={`${keyPrefix}-line-${lineIndex}`} className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
            {items.map((item, itemIndex) => (
              <span key={`${keyPrefix}-item-${lineIndex}-${itemIndex}`} className="inline-block max-w-full py-0.5">
                {renderInlineLine(item, `${keyPrefix}-${lineIndex}-${itemIndex}`)}
              </span>
            ))}
          </div>
        );
      }

      return <p key={`${keyPrefix}-line-${lineIndex}`}>{renderInlineLine(line, `${keyPrefix}-${lineIndex}`)}</p>;
    });
}

export function LatexAnswerPreview({ value }: LatexAnswerPreviewProps) {
  // Типографские переносы из задачника склеиваются в цельные абзацы,
  // прежде чем текст разбивается на блоки и строки.
  const blocks = mergeSoftWrappedLines(value)
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    // Обёртка повторяет знак операции в начале перенесённой строки (правило переноса формул).
    <MathLineBreaks className="min-w-0 max-w-full space-y-4 rounded-2xl bg-[var(--theme-surface-soft)] px-3 py-3 text-sm leading-7 text-[var(--theme-text-default)]">
      {blocks.map((block, blockIndex) => {
        // \[…\] поддерживается только целым блоком (как исторически).
        if (block.startsWith("\\[") && block.endsWith("\\]") && block.length > 4) {
          return renderDisplayMath(block.slice(2, -2).trim(), `block-${blockIndex}`);
        }

        // $$…$$ в реальных условиях бывает приклеен к тексту («Вычислите.\n$$…$$»)
        // и растянут на несколько строк — режем блок на сегменты, иначе от
        // «$$» остаются половинки-«$», а высокая формула рендерится инлайном
        // и вылезает за карточку.
        const segments = block.split(/(\$\$[\s\S]+?\$\$)/g).filter((segment) => segment.trim().length > 0);

        return (
          <div key={`block-${blockIndex}`} className="space-y-2">
            {segments.map((segment, segmentIndex) => {
              const key = `seg-${blockIndex}-${segmentIndex}`;

              if (segment.startsWith("$$") && segment.endsWith("$$") && segment.length > 4) {
                return renderDisplayMath(segment.slice(2, -2).trim(), key);
              }

              return <Fragment key={key}>{renderTextLines(segment, key)}</Fragment>;
            })}
          </div>
        );
      })}
    </MathLineBreaks>
  );
}
