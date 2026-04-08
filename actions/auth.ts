"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { getHeadersLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import {
  assertRateLimit,
  getClientIpFromHeaders,
  RateLimitExceededError,
  resetRateLimit
} from "@/lib/rate-limit";
import { roleHome } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    redirect("/login?error=empty");
  }

  const normalizedLogin = login.trim().toLowerCase();
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
        identifier: `${clientIp}:${normalizedLogin}`,
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
          login: normalizedLogin
        }),
        error,
        "Login request was rate limited."
      );
      redirect("/login?error=rateLimited");
    }

    throw error;
  }

  let user = null;

  try {
    user = await signIn(login, password);
  } catch (error) {
    logErrorEvent(
      "auth.login.failed",
      getHeadersLogContext(requestHeaders, {
        login: normalizedLogin
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
        login: normalizedLogin
      }),
      undefined,
      "Login was rejected due to invalid credentials."
    );
    redirect("/login?error=invalid");
  }

  resetRateLimit("login:ip-login", `${clientIp}:${normalizedLogin}`);
  logInfoEvent(
    "auth.login.succeeded",
    getHeadersLogContext(requestHeaders, {
      login: normalizedLogin,
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
