import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logErrorEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashSessionToken, verifyPassword } from "@/lib/password";
import { roleHome } from "@/lib/utils";

const SESSION_COOKIE = "tutor_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

async function shouldUseSecureSessionCookie() {
  const forwardedProto = (await headers()).get("x-forwarded-proto");

  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_SESSION_COOKIE !== "true";
}

async function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: await shouldUseSecureSessionCookie(),
    expires,
    path: "/"
  };
}

export async function signIn(login: string, password: string) {
  const normalizedLogin = login.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedLogin }
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  try {
    await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
  } catch {
    // Чистка просроченных сессий не должна блокировать вход.
  }

  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, await getSessionCookieOptions(expiresAt));

  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(sessionToken)
      }
    });
  }

  cookieStore.set(SESSION_COOKIE, "", await getSessionCookieOptions(new Date(0)));
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken)
    },
    include: {
      user: true
    }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({
      where: {
        id: session.id
      }
    });

    cookieStore.set(SESSION_COOKIE, "", await getSessionCookieOptions(new Date(0)));

    return null;
  }

  return session.user;
}

export async function tryGetCurrentUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    logErrorEvent("auth.current_user.resolve_failed", {}, error, "Failed to resolve current user.");
    return null;
  }
}

export async function requireUser(role?: UserRole | UserRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const allowedRoles = Array.isArray(role) ? role : role ? [role] : null;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(roleHome(user.role));
  }

  return user;
}
