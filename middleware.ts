import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/student", "/teacher", "/developer"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("tutor_session")?.value);

  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Разработчик живёт на /developer/* (те же страницы через rewrite в next.config).
  // Кука роли — только для UX-маршрутизации, права проверяет requireUser.
  const role = request.cookies.get("tutor_role")?.value;
  const isTeacherPath = pathname === "/teacher" || pathname.startsWith("/teacher/");
  const isDeveloperPath = pathname === "/developer" || pathname.startsWith("/developer/");

  if (hasSession && role === "DEVELOPER" && isTeacherPath) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/teacher/, "/developer");
    return NextResponse.redirect(url);
  }

  if (hasSession && role && role !== "DEVELOPER" && isDeveloperPath) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/developer/, "/teacher");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*", "/teacher/:path*", "/developer", "/developer/:path*"]
};
