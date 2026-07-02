import type { ReactNode } from "react";

type ShbzPageHeaderProps = {
  kicker?: string;
  title: string;
  aside?: ReactNode;
};

export function ShbzPageHeader({ kicker, title, aside }: ShbzPageHeaderProps) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        {kicker ? <div className="shbz-kicker">{kicker}</div> : null}
        <h1 className="shbz-h1">
          {title}
          <span className="shbz-dot h-3 w-3 shrink-0 self-center" />
        </h1>
      </div>
      {aside}
    </div>
  );
}
