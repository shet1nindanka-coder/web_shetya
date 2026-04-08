"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RouteErrorState } from "@/components/app-state-shells";

type AuthErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthErrorPage({ error, reset }: AuthErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
