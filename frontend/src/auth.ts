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
      return { id: user.email, email: user.email, role: user.role, modules: user.modules || [], prenom: user.prenom || "", nom: user.nom || "" }
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

  // L'app tourne derrière le reverse proxy Caddy : sans trustHost, Auth.js v5
  // rejette l'en-tête Host (« UntrustedHost ») et renvoie 500 sur /api/auth/*.
  trustHost: true,

  // Session par JWT — 12 h : back-office institutionnel, pas de session d'un mois
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },

  // Utilise notre encodage HS256 au lieu du JWE chiffré par défaut
  jwt: { encode, decode },

  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Connexion email/mot de passe : rôle et modules viennent du backend (authorize)
      if (user?.role) {
        token.email = user.email ?? token.email
        token.role = user.role
        token.modules = user.modules ?? []
        token.prenom = user.prenom ?? ""
        token.nom = user.nom ?? ""
      }
      // Connexion Microsoft Entra ID : identité garantie par Azure ; les droits
      // (rôle/modules) restent gérés en base — le backend les relit à chaque
      // requête, le token ne porte que des valeurs indicatives pour l'UI.
      if (account && profile) {
        token.email = (profile.email as string) || token.email
        const devEmails = (process.env.DEV_EMAILS || "")
          .split(",").map((e) => e.trim().toLowerCase())
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",").map((e) => e.trim().toLowerCase())
        const em = (token.email || "").toLowerCase()
        token.role = devEmails.includes(em) ? "dev" : adminEmails.includes(em) ? "admin_plus" : "agent"
        token.modules = []
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.modules = token.modules ?? []
        session.user.prenom = token.prenom ?? ""
        session.user.nom = token.nom ?? ""
        if (token.email) session.user.email = token.email
      }
      // Jeton d'API : même JWT HS256 que la session, à joindre en
      // Authorization: Bearer sur les appels au backend protégés.
      session.accessToken = await new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 12 * 60 * 60)
        .sign(secret)
      return session
    },
  },

  pages: {
    signIn: "/login",
  },
})
