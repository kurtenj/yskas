import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const PUBLIC_PATHS = ["/pin", "/api/verify-pin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets through
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icon-")
  ) {
    return NextResponse.next();
  }

  let verified = false;
  try {
    verified = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch { /* Fail closed if auth configuration is missing. */ }
  if (!verified) {
    const url = request.nextUrl.clone();
    url.pathname = "/pin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
