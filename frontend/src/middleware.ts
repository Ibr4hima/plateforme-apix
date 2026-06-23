import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  const isAdminRoute = nextUrl.pathname.startsWith("/admin")
  const isLoginPage = nextUrl.pathname === "/login"

  // Rediriger un utilisateur déjà connecté depuis /login vers l'accueil
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Protéger les routes /admin/*
  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", nextUrl))
    }
    if (session.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*", "/login"],
}
