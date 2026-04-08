import * as Sentry from "@sentry/nextjs";

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: clientDsn,
  enabled: Boolean(clientDsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate:
    Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "") ||
    (process.env.NODE_ENV === "production" ? 0.1 : 1),
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  ignoreErrors: [/NEXT_REDIRECT/, /NEXT_NOT_FOUND/]
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
