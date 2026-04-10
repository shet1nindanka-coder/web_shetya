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
import { normalizeLoginInput, roleHome } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const login = normalizeLoginInput(String(formData.get("login") ?? formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
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
