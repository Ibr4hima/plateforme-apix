import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import Credentials from "next-auth/providers/credentials"
import { SignJWT, jwtVerify } from "jose"

// Auth secret partagé avec le backend (HS256)
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

// Microsoft Entra ID n'est activé que si les vraies valeurs Azure sont fournies
// (pas les PLACEHOLDER). Tant que ce n'est pas le cas, on s'appuie sur la
// connexion email + mot de passe @apix.sn.
const azureConfigured =
  !!process.env.AZURE_AD_CLIENT_ID &&
  !process.env.AZURE_AD_CLIENT_ID.startsWith("PLACEHOLDER")

const providers = [
  Credentials({
    name: "Email APIX",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials?.email,
          password: credentials?.password,
        }),
      })
      if (!res.ok) return null
      const user = await res.json()
      return { id: user.email, email: user.email, role: user.role }
    },
  }),
  ...(azureConfigured
    ? [
        MicrosoftEntraID({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
        }),
      ]
    : []),
]

// Encodage custom : JWT signé HS256 (lisible par le backend FastAPI)
async function encode(params: {
  token?: JWT
  maxAge?: number
  salt: string
}): Promise<string> {
  const { token = {}, maxAge = 30 * 24 * 60 * 60 } = params
  return await new SignJWT(token as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secret)
}

// Décodage custom : vérifie la signature HS256
async function decode(params: {
  token?: string
  salt: string
}): Promise<JWT | null> {
  if (!params.token) return null
  try {
    const { payload } = await jwtVerify(params.token, secret, { algorithms: ["HS256"] })
    return payload as JWT
  } catch {
    return null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,

  // Session par JWT (connexion par formulaire email/mot de passe)
  session: { strategy: "jwt" },

  // Utilise notre encodage HS256 au lieu du JWE chiffré par défaut
  jwt: { encode, decode },

  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Connexion email/mot de passe : le rôle vient du backend (authorize)
      if (user?.role) {
        token.email = user.email ?? token.email
        token.role = user.role
      }
      // Connexion Microsoft Entra ID : rôle dérivé de la liste ADMIN_EMAILS
      if (account && profile) {
        token.email = (profile.email as string) || token.email
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
        token.role = adminEmails.includes((token.email || "").toLowerCase())
          ? "admin"
          : "viewer"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        if (token.email) session.user.email = token.email
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
  },
})
