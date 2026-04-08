"use client";

import { RouteErrorState } from "@/components/app-state-shells";

type AuthErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthErrorPage({ reset }: AuthErrorPageProps) {
  return (
    <main className="soft-grid min-h-screen">
      <RouteErrorState
        title="Не удалось открыть вход"
        description="Страница входа временно недоступна. Попробуйте повторить загрузку или вернуться на главную."
        reset={reset}
        homeHref="/"
        homeLabel="На главную"
      />
    </main>
  );
}
