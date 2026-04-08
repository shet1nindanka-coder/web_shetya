"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RouteErrorState } from "@/components/app-state-shells";

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ error, reset }: DashboardErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="soft-grid min-h-screen">
      <RouteErrorState
        title="Раздел временно недоступен"
        description="Во время загрузки кабинета что-то пошло не так. Попробуйте повторить запрос или вернуться на главную страницу."
        reset={reset}
        homeHref="/"
        homeLabel="На главную"
      />
    </div>
  );
}
