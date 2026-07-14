import { Fragment } from "react";
import { BlockMath, InlineMath } from "react-katex";

type LatexAnswerPreviewProps = {
  value: string;
};

function renderInlineLine(line: string, lineKey: string) {
  const parts = line.split(/(\$[^$]+\$)/g).filter(Boolean);

  return parts.map((part, partIndex) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1);

      return (
        <InlineMath
          key={`math-${lineKey}-${partIndex}`}
          math={math}
          renderError={(error) => (
            <code className="rounded bg-[var(--theme-danger-soft)] px-1 py-0.5 text-[var(--theme-danger-text)]">
              {error.name}
            </code>
          )}
        />
      );
    }

    return <Fragment key={`text-${lineKey}-${partIndex}`}>{part}</Fragment>;
  });
}

// Делит строку на пункты по меткам «А)», «Б)», «1)» вне формул: каждый пункт
// рендерится неразрывным inline-block и переносится на новую строку целиком,
// а не рвётся посередине.
function splitLineIntoItems(line: string): string[] {
  const boundaries: number[] = [];
  let inMath = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === "$") {
      inMath = !inMath;
      continue;
    }

    if (inMath || (i > 0 && !/\s/.test(line[i - 1]))) {
      continue;
    }

    if (/^(?:[А-ЯЁA-Z]|\d{1,2})\)/.test(line.slice(i, i + 3))) {
      boundaries.push(i);
    }
  }

  if (boundaries.length < 2) {
    return [line];
  }

  if (boundaries[0] !== 0) {
    boundaries.unshift(0);
  }

  const items: string[] = [];

  for (let b = 0; b < boundaries.length; b++) {
    const item = line.slice(boundaries[b], boundaries[b + 1] ?? line.length).trim();

    if (item) {
      items.push(item);
    }
  }

  return items;
}

export function LatexAnswerPreview({ value }: LatexAnswerPreviewProps) {
  const blocks = value
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 text-sm leading-7 text-[var(--theme-text-default)]">
      {blocks.map((block, blockIndex) => {
        const isDisplayMath =
          (block.startsWith("$$") && block.endsWith("$$") && block.length > 4) ||
          (block.startsWith("\\[") && block.endsWith("\\]") && block.length > 4);

        if (isDisplayMath) {
          const math = block.startsWith("$$") ? block.slice(2, -2).trim() : block.slice(2, -2).trim();

          return (
            <div key={`block-${blockIndex}`} className="overflow-x-auto rounded-2xl bg-[var(--theme-surface-soft)] px-3 py-3">
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
              const items = splitLineIntoItems(line);

              return (
                <p key={`line-${blockIndex}-${lineIndex}`}>
                  {items.length > 1
                    ? items.map((item, itemIndex) => (
                        <Fragment key={`item-${blockIndex}-${lineIndex}-${itemIndex}`}>
                          {itemIndex > 0 ? " " : null}
                          <span className="inline-block max-w-full align-baseline">
                            {renderInlineLine(item, `${lineIndex}-${itemIndex}`)}
                          </span>
                        </Fragment>
                      ))
                    : renderInlineLine(line, `${lineIndex}`)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
