import { getSession } from "next-auth/react";

/**
 * En-tête Authorization: Bearer pour les mutations côté client.
 *
 * Le cookie de session NextAuth est httpOnly : impossible à lire via
 * document.cookie. On récupère donc le jeton d'API (`session.accessToken`,
 * un JWT signé HS256 avec AUTH_SECRET — voir le callback session() dans
 * src/auth.ts) au travers de getSession(), directement vérifiable par le
 * backend FastAPI (app/core/auth.py).
 *
 * Asynchrone : à utiliser en `headers: await authHeaders()` ou
 * `headers: { "Content-Type": "application/json", ...(await authHeaders()) }`.
 * Renvoie un objet vide côté serveur ou si aucune session n'est présente.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const session = await getSession();
    const token = (session as { accessToken?: string } | null)?.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
