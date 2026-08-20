import Link from "next/link";

/**
 * «Пустое занятие» — единый вход в создание урока (решение владельца):
 * пунктирная карточка с плюсом первой в любом списке занятий, без отдельных кнопок.
 */
export function LessonComposeCard({ href, hint }: { href: string; hint: string }) {
  return (
    <Link
      href={href}
      className="ui-pressable flex items-center gap-3.5 rounded-[16px] border-[1.5px] border-dashed px-5 py-4 no-underline transition hover:bg-[var(--shbz-tab-hover)]"
      style={{ borderColor: "var(--shbz-input-border)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] font-bold"
        style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
        aria-hidden="true"
      >
        +
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Составить занятие
        </span>
        <span className="ui-hint block text-xs" style={{ color: "var(--shbz-text-muted)" }}>
          {hint}
        </span>
      </span>
    </Link>
  );
}
