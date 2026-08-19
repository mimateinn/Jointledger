import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/auth/cookie";

const publicPaths = new Set(["/login", "/api/auth/invalidate"]);
/** Route handler returns 401/405 — do not 307 to /login. */
const authInHandler = new Set(["/api/update"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = publicPaths.has(pathname);

  if (!token && !isPublic && !authInHandler.has(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Do not treat cookie *presence* as authenticated. An expired or wiped
  // session still sends jl_session; /login must stay reachable so
  // getSessionUser() can invalidate and render the form.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon|apple-icon|favicon.ico|manifest.webmanifest|sw.js|swe-worker).*)",
  ],
};
