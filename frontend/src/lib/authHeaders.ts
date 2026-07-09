/**
 * En-tête Authorization: Bearer pour les mutations côté client.
 *
 * Le cookie de session NextAuth (`authjs.session-token`) est un JWT signé
 * HS256 avec AUTH_SECRET — directement vérifiable par le backend FastAPI
 * (voir app/core/auth.py). On le lit ici pour l'ajouter aux requêtes
 * POST/PATCH/DELETE quand AUTH_ENFORCED est actif côté backend.
 *
 * Renvoie un objet vide côté serveur ou si aucune session n'est présente.
 */
export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const cookieName = window.location.protocol === "https:"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const match = document.cookie.split("; ").find(r => r.startsWith(cookieName + "="));
  return match ? { Authorization: `Bearer ${match.slice(cookieName.length + 1)}` } : {};
}
