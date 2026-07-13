"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { getHeadersLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import {
  consumePersistentRateLimit,
  resetPersistentRateLimit
} from "@/lib/persistent-rate-limit";
import {
  assertRateLimit,
  getClientIpFromHeaders,
  RateLimitExceededError,
  resetRateLimit
} from "@/lib/rate-limit";
import { MAX_PASSWORD_LENGTH } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH, normalizeLoginInput, roleHome } from "@/lib/utils";

const PERSISTENT_LOGIN_RATE_LIMIT_SCOPE = "login:login";

export async function loginAction(formData: FormData) {
  const login = normalizeLoginInput(String(formData.get("login") ?? formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!login || !password || login.length > MAX_LOGIN_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    redirect("/login?error=empty");
  }

  const requestHeaders = await headers();
  const clientIp = getClientIpFromHeaders(requestHeaders);

  try {
    assertRateLimit(
      {
        scope: "login:ip",
        identifier: clientIp,
        limit: 25,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много попыток входа с этого адреса."
    );
    assertRateLimit(
      {
        scope: "login:ip-login",
        identifier: `${clientIp}:${login}`,
        limit: 8,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много попыток входа для этого логина."
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      logWarnEvent(
        "auth.login.rate_limited",
        getHeadersLogContext(requestHeaders, {
          login
        }),
        error,
        "Login request was rate limited."
      );
      redirect("/login?error=rateLimited");
    }

    throw error;
  }

  let persistentRateLimit: Awaited<ReturnType<typeof consumePersistentRateLimit>>;

  try {
    persistentRateLimit = await consumePersistentRateLimit({
      scope: PERSISTENT_LOGIN_RATE_LIMIT_SCOPE,
      identifier: login,
      limit: 20,
      windowMs: 15 * 60_000
    });
  } catch (error) {
    logErrorEvent(
      "auth.login.persistent_rate_limit_failed",
      getHeadersLogContext(requestHeaders, { login }),
      error,
      "Persistent login rate limit failed."
    );
    redirect("/login?error=database");
  }

  if (!persistentRateLimit.allowed) {
    logWarnEvent(
      "auth.login.rate_limited",
      getHeadersLogContext(requestHeaders, {
        login,
        retryAfterMs: persistentRateLimit.retryAfterMs
      }),
      undefined,
      "Login request was rate limited by the persistent account limit."
    );
    redirect("/login?error=rateLimited");
  }

  let user = null;

  try {
    user = await signIn(login, password);
  } catch (error) {
    logErrorEvent(
      "auth.login.failed",
      getHeadersLogContext(requestHeaders, {
        login
      }),
      error,
      "Failed to create login session."
    );
    redirect("/login?error=database");
  }

  if (!user) {
    logWarnEvent(
      "auth.login.invalid_credentials",
      getHeadersLogContext(requestHeaders, {
        login
      }),
      undefined,
      "Login was rejected due to invalid credentials."
    );
    redirect("/login?error=invalid");
  }

  resetRateLimit("login:ip-login", `${clientIp}:${login}`);

  try {
    await resetPersistentRateLimit(PERSISTENT_LOGIN_RATE_LIMIT_SCOPE, login);
  } catch (error) {
    logErrorEvent(
      "auth.login.persistent_rate_limit_reset_failed",
      getHeadersLogContext(requestHeaders, {
        login,
        userId: user.id
      }),
      error,
      "Persistent login rate limit could not be reset after successful authentication."
    );
  }

  logInfoEvent(
    "auth.login.succeeded",
    getHeadersLogContext(requestHeaders, {
      login,
      userId: user.id,
      role: user.role
    }),
    "Login session created successfully."
  );
  redirect(roleHome(user.role));
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
