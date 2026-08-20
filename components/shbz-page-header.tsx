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
      {/* На телефоне aside (поиск, действия) всегда во всю ширину под заголовком —
          одно и то же место в каждом разделе; от sm — справа от заголовка. */}
      {aside ? <div className="w-full sm:ml-auto sm:w-auto">{aside}</div> : null}
    </div>
  );
}
