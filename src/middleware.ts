import { NextRequest, NextResponse } from "next/server";

const LOCAL_COOKIE = "fb_local";

function isLocalHost(request: NextRequest): boolean {
  const hostHeader = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const local = isLocalHost(request);

  // The desktop admin is intentionally local-only. Remote HTTPS access is
  // reserved for the mini program's authenticated /api/* endpoints.
  if (!pathname.startsWith("/api") && !local) {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = NextResponse.next();
  const token = process.env.FLOWBACK_LOCAL_TOKEN?.trim();
  if (local && token && request.cookies.get(LOCAL_COOKIE)?.value !== token) {
    response.cookies.set(LOCAL_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
