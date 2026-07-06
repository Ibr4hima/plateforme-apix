import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

// ── Contrôle d'accès des pages (RBAC) ─────────────────────────────────────────
// Public : accueil, code des investissements, événements, accords, zones,
// entreprises (les fiches détaillées y sont gérées au niveau des pages).
// Protégé : les routes ci-dessous exigent une session ; le rôle « restreint »
// doit en plus avoir le module dans sa liste. /admin exige admin ou dev.
// AUTH_ENFORCED=false (défaut) = mode développement : tout passe.

const PROTECTED_MODULES: Record<string, string> = {
  "/tableau-de-bord": "tableau-de-bord",
  "/ide": "ide",
  "/prospects": "prospects",
  "/opportunites": "opportunites",
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "")
const enforced = (process.env.AUTH_ENFORCED || "").toLowerCase() === "true"

async function getToken(req: NextRequest): Promise<Record<string, unknown> | null> {
  const raw =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(raw, secret, { algorithms: ["HS256"] })
    return payload
  } catch {
    return null
  }
}

export default async function middleware(req: NextRequest) {
  if (!enforced) return NextResponse.next()

  const { pathname } = req.nextUrl
  const token = await getToken(req)

  // Déjà connecté : les pages login/register redirigent vers l'accueil
  if (pathname === "/login" || pathname === "/register") {
    if (token) return NextResponse.redirect(new URL("/", req.url))
    return NextResponse.next()
  }

  const login = () => {
    const url = new URL("/login", req.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // Pages d'administration : admin (lecture seule), admin_plus (ses pages), dev
  if (pathname.startsWith("/admin")) {
    if (!token) return login()
    const role = String(token.role || "")
    if (role !== "admin" && role !== "admin_plus" && role !== "dev") return NextResponse.redirect(new URL("/unauthorized", req.url))
    const seg = pathname.split("/")[2] || ""
    if (seg && role === "admin_plus") {
      const mods = Array.isArray(token.modules) ? (token.modules as string[]) : []
      if (!mods.includes(seg)) return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
    if (seg && role === "admin") {
      const lecture = ["evenements", "accords", "entreprises", "gestion-zones", "opportunites", "intentions", "prospects"]
      if (!lecture.includes(seg)) return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
    return NextResponse.next()
  }

  // Modules protégés
  const entry = Object.entries(PROTECTED_MODULES).find(([prefix]) =>
    pathname === prefix || pathname.startsWith(prefix + "/"))
  if (entry) {
    if (!token) return login()
    const role = String(token.role || "")
    if (role === "dev" || role === "admin" || role === "admin_plus" || role === "agent") return NextResponse.next()
    const modules = Array.isArray(token.modules) ? (token.modules as string[]) : []
    if (!modules.includes(entry[1])) return NextResponse.redirect(new URL("/unauthorized", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/register",
    "/tableau-de-bord/:path*",
    "/ide/:path*",
    "/prospects/:path*",
    "/opportunites/:path*",
  ],
}
