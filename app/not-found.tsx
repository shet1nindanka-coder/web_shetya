import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <div className="ui-state-shell ui-pop-in w-full max-w-xl rounded-[12px] px-6 py-8 sm:px-8">
        <p className="font-display text-[4rem] font-bold text-[var(--theme-text-muted)] sm:text-[5rem]">404</p>

        <h1 className="mt-2 font-display text-xl font-semibold text-[var(--theme-text-strong)] sm:text-2xl">
          Страница не найдена
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--theme-text-muted)]">
          Возможно, эта страница была удалена или вы перешли по неверной ссылке.
        </p>

        <div className="mt-6">
          <Link
            href="/"
            className="ui-pressable ui-button-primary rounded-[12px] px-4 py-2.5 text-sm font-semibold transition"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
