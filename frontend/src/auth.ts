import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { SignJWT, jwtVerify } from "jose"

// Auth secret partagé avec le backend (HS256)
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

// Encodage custom : JWT signé HS256 (lisible par le backend FastAPI)
async function encode({ token, maxAge = 30 * 24 * 60 * 60 }: { token: Record<string, unknown>; maxAge?: number; salt?: string }): Promise<string> {
  return await new SignJWT(token)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secret)
}

// Décodage custom : vérifie la signature HS256
async function decode({ token }: { token?: string; secret: string | string[]; salt?: string }): Promise<Record<string, unknown> | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],

  // Utilise notre encodage HS256 au lieu du JWE chiffré par défaut
  jwt: { encode, decode },

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.email = (profile as Record<string, unknown>).email as string || token.email
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
        token.role = adminEmails.includes(
          ((token.email as string) || "").toLowerCase()
        )
          ? "admin"
          : "viewer"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).role = token.role as string
        session.user.email = token.email as string
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
  },
})
