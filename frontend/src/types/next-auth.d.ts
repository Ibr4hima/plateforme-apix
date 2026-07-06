import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      role?: string
      modules?: string[]
      prenom?: string
      nom?: string
    } & DefaultSession["user"]
    /** JWT HS256 à envoyer au backend en Authorization: Bearer */
    accessToken?: string
  }
  interface User {
    role?: string
    modules?: string[]
    prenom?: string
    nom?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    modules?: string[]
    prenom?: string
    nom?: string
    email?: string
  }
}
