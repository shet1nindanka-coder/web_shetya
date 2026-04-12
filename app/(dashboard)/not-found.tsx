import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-display text-[4rem] font-bold text-[var(--theme-text-muted)] sm:text-[5rem]">
        404
      </p>

      <h1 className="mt-2 font-display text-xl font-semibold text-[var(--theme-text-strong)] sm:text-2xl">
        Страница не найдена
      </h1>

      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--theme-text-muted)]">
        Возможно, эта страница была удалена или вы перешли по неверной ссылке.
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          href="/student"
          className="ui-pressable rounded-[12px] bg-[var(--theme-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--theme-accent-hover)] sm:rounded-[14px]"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
