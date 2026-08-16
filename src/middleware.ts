import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/auth/cookie";

const publicPaths = new Set(["/login"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = publicPaths.has(pathname);

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon|apple-icon|manifest.webmanifest|sw.js|swe-worker).*)"],
};
