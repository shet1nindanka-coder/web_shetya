import * as Sentry from "@sentry/nextjs";

const serverDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: serverDsn,
  enabled: Boolean(serverDsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate:
    Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "") || (process.env.NODE_ENV === "production" ? 0.1 : 1),
  sendDefaultPii: false,
  ignoreErrors: [/NEXT_REDIRECT/, /NEXT_NOT_FOUND/]
});
