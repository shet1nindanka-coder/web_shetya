"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RouteErrorState } from "@/components/app-state-shells";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="soft-grid min-h-screen">
        <RouteErrorState
          title="Раздел временно недоступен"
          description="Во время загрузки страницы что-то пошло не так. Попробуйте повторить запрос или вернуться на главную."
          reset={reset}
          homeHref="/"
          homeLabel="На главную"
        />
      </body>
    </html>
  );
}
