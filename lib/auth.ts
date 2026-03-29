import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashSessionToken, verifyPassword } from "@/lib/password";
import { roleHome } from "@/lib/utils";

const SESSION_COOKIE = "tutor_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

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

  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt
    }
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });

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

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
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

    cookieStore.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: "/"
    });

    return null;
  }

  return session.user;
}

export async function tryGetCurrentUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error("Failed to resolve current user.", error);
    return null;
  }
}

export async function requireUser(role?: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (role && user.role !== role) {
    redirect(roleHome(user.role));
  }

  return user;
}
