import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authSession = request.cookies.get("auth_session");
  const isAuthenticated = authSession?.value === "authenticated";
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthApi = request.nextUrl.pathname.startsWith("/api/auth");

  // Allow auth API routes
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from login page
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users to login page
  if (!isLoginPage && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|catalog-images|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};
