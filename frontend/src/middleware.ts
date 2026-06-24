import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Auth temporairement désactivée — à réactiver quand le backend sera configuré
export default function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
}
