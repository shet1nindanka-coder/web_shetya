import { Fragment } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { splitLineIntoItems } from "@/lib/latex-line-items";

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
    <div className="min-w-0 max-w-full space-y-4 text-sm leading-7 text-[var(--theme-text-default)]">
      {blocks.map((block, blockIndex) => {
        const isDisplayMath =
          (block.startsWith("$$") && block.endsWith("$$") && block.length > 4) ||
          (block.startsWith("\\[") && block.endsWith("\\]") && block.length > 4);

        if (isDisplayMath) {
          const math = block.startsWith("$$") ? block.slice(2, -2).trim() : block.slice(2, -2).trim();

          return (
            <div key={`block-${blockIndex}`} className="min-w-0 max-w-full rounded-2xl bg-[var(--theme-surface-soft)] px-3 py-3">
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

              return (
                <p key={`line-${blockIndex}-${lineIndex}`}>
                  {labeled
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
