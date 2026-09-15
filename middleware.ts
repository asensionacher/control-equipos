import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAdmin = req.auth?.user?.rol === "ADMIN";

  const esRutaAdmin = nextUrl.pathname.startsWith("/admin");
  const esRutaProtegida = nextUrl.pathname.startsWith("/dashboard") || esRutaAdmin;
  const esRutaAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/registro");

  if (esRutaProtegida && !isLoggedIn) {
    const url = new URL("/login", nextUrl.origin);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (esRutaAdmin && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  if (esRutaAuth && isLoggedIn) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
