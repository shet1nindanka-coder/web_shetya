import type { ReactNode } from "react";

type NavCardStat = {
  label: string;
  value: ReactNode;
};

type ShbzNavCardProps = {
  kicker: string;
  title: string;
  stats?: NavCardStat[];
  meta?: string;
  footer?: ReactNode;
};

export function ShbzNavCard({ kicker, title, stats, meta, footer }: ShbzNavCardProps) {
  return (
    <article
      className="shbz-card shbz-card-hover flex h-full flex-col overflow-hidden"
      style={{ borderRadius: 16, padding: 0 }}
    >
      <div className="h-[5px] shrink-0" style={{ background: "var(--shbz-accent-grad)" }} />
      <div className="flex flex-1 flex-col gap-[18px] p-[22px]">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            {kicker}
          </div>
          {/* Всегда резерв под две строки (и не больше двух) — карточки в сетке
              одной высоты независимо от длины названия. */}
          <div
            className="mt-1.5 text-[17px] font-bold"
            title={title}
            style={{
              color: "var(--shbz-text-strong)",
              lineHeight: 1.35,
              minHeight: "2.7em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {title}
          </div>
        </div>

        {stats && stats.length > 0 ? (
          <div className="flex gap-[26px]">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.6px]"
                  style={{ color: "var(--shbz-kicker)" }}
                >
                  {stat.label}
                </div>
                <div className="mt-0.5 text-[23px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {meta ? (
          <div className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            {meta}
          </div>
        ) : null}

        {footer ? <div className="mt-auto flex flex-wrap items-center gap-2.5">{footer}</div> : null}
      </div>
    </article>
  );
}
