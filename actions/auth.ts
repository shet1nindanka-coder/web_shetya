"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { getHeadersLogContext, logError, logWarn } from "@/lib/logger";
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
      logWarn(
        "Login rate limit exceeded.",
        getHeadersLogContext(requestHeaders, {
          login: normalizedLogin,
          scope: "login"
        }),
        error
      );
      redirect("/login?error=rateLimited");
    }

    throw error;
  }

  let user = null;

  try {
    user = await signIn(login, password);
  } catch (error) {
    logError(
      "Failed to sign in.",
      getHeadersLogContext(requestHeaders, {
        login: normalizedLogin,
        scope: "login"
      }),
      error
    );
    redirect("/login?error=database");
  }

  if (!user) {
    redirect("/login?error=invalid");
  }

  resetRateLimit("login:ip-login", `${clientIp}:${normalizedLogin}`);
  redirect(roleHome(user.role));
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
