import { Fragment } from "react";
import { BlockMath, InlineMath } from "react-katex";

type LatexAnswerPreviewProps = {
  value: string;
};

function renderInlineLine(line: string, lineIndex: number) {
  const parts = line.split(/(\$[^$]+\$)/g).filter(Boolean);

  return parts.map((part, partIndex) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const math = part.slice(1, -1);

      return (
        <InlineMath
          key={`math-${lineIndex}-${partIndex}`}
          math={math}
          renderError={(error) => <code className="rounded bg-rose-50 px-1 py-0.5 text-rose-700">{error.name}</code>}
        />
      );
    }

    return <Fragment key={`text-${lineIndex}-${partIndex}`}>{part}</Fragment>;
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
    <div className="space-y-4 text-sm leading-7 text-slate-700">
      {blocks.map((block, blockIndex) => {
        const isDisplayMath =
          (block.startsWith("$$") && block.endsWith("$$") && block.length > 4) ||
          (block.startsWith("\\[") && block.endsWith("\\]") && block.length > 4);

        if (isDisplayMath) {
          const math = block.startsWith("$$") ? block.slice(2, -2).trim() : block.slice(2, -2).trim();

          return (
            <div key={`block-${blockIndex}`} className="overflow-x-auto rounded-2xl bg-slate-50 px-3 py-3">
              <BlockMath
                math={math}
                renderError={(error) => (
                  <code className="block whitespace-pre-wrap rounded bg-rose-50 px-3 py-2 text-rose-700">
                    {error.name}: {error.message}
                  </code>
                )}
              />
            </div>
          );
        }

        return (
          <div key={`text-block-${blockIndex}`} className="space-y-2">
            {block.split("\n").map((line, lineIndex) => (
              <p key={`line-${blockIndex}-${lineIndex}`}>{renderInlineLine(line, lineIndex)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
