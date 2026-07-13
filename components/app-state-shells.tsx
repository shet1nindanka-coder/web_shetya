import Link from "next/link";

type RouteErrorStateProps = {
  title: string;
  description: string;
  reset: () => void;
  homeHref: string;
  homeLabel: string;
};

export function AuthLoadingState() {
  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_55%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-[rgba(54,224,164,0.14)] blur-3xl" />

      <div className="content-shell mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="ui-state-shell w-full max-w-md rounded-[12px] p-6 sm:rounded-[12px] sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="ui-skeleton h-14 w-14 rounded-[8px]" />
            <div className="ui-skeleton mt-4 h-3 w-28 rounded-full" />
            <div className="ui-skeleton mt-5 h-10 w-52 rounded-[8px]" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="ui-skeleton h-3 w-16 rounded-full" />
              <div className="ui-skeleton h-12 w-full rounded-[8px]" />
            </div>
            <div className="space-y-2">
              <div className="ui-skeleton h-3 w-20 rounded-full" />
              <div className="ui-skeleton h-12 w-full rounded-[8px]" />
            </div>
            <div className="ui-skeleton h-12 w-full rounded-[8px]" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function DashboardLoadingState({ showSectionTabs = false }: { showSectionTabs?: boolean }) {
  return (
    <div className="soft-grid min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--theme-border-soft)] bg-[var(--theme-header)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="ui-skeleton h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <div className="ui-skeleton h-4 w-28 rounded-full" />
                <div className="ui-skeleton h-3 w-44 rounded-full" />
              </div>
            </div>
          </div>

          <div className="ui-state-shell rounded-[16px] px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="space-y-2">
                <div className="ui-skeleton h-4 w-32 rounded-full" />
                <div className="ui-skeleton h-3 w-40 rounded-full" />
              </div>
              <div className="ui-skeleton h-10 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </header>

      <main className="content-shell mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardSectionLoadingState showSectionTabs={showSectionTabs} />
      </main>
    </div>
  );
}

export function DashboardSectionLoadingState({ showSectionTabs = false }: { showSectionTabs?: boolean }) {
  return (
    <>
      {showSectionTabs ? (
        <div className="ui-toolbar-shell mb-8 flex flex-wrap gap-2 rounded-[16px] p-2.5">
          <div className="ui-skeleton h-11 w-28 rounded-full" />
          <div className="ui-skeleton h-11 w-28 rounded-full" />
          <div className="ui-skeleton h-11 w-32 rounded-full" />
          <div className="ui-skeleton h-11 w-36 rounded-full" />
        </div>
      ) : null}

      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="ui-skeleton h-40 rounded-[16px]" />
          <div className="ui-skeleton h-40 rounded-[16px]" />
          <div className="ui-skeleton h-40 rounded-[16px]" />
          <div className="ui-skeleton h-40 rounded-[16px]" />
        </div>

        <div className="ui-skeleton h-[220px] rounded-[12px]" />
        <div className="ui-skeleton h-[340px] rounded-[12px]" />
      </div>
    </>
  );
}

export function RouteErrorState({ title, description, reset, homeHref, homeLabel }: RouteErrorStateProps) {
  return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="ui-pop-in ui-state-shell w-full rounded-[12px] p-6 text-center sm:rounded-[12px] sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] bg-[var(--theme-danger-soft)] text-lg font-semibold text-[var(--theme-danger-text)] shadow-sm">
          !
        </div>
        <h1 className="font-display mt-5 text-3xl font-semibold text-[var(--theme-text-strong)]">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--theme-text-muted)]">{description}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="ui-pressable ui-button-primary rounded-[12px] px-5 py-3 text-sm font-semibold transition"
          >
            Попробовать снова
          </button>
          <Link
            href={homeHref}
            className="ui-pressable ui-button-secondary rounded-[12px] px-5 py-3 text-sm font-semibold transition"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
