import { getSession } from "next-auth/react";

/**
 * Le jeton d'API de la session, et l'en-tête Authorization qui le porte.
 *
 * Le cookie de session NextAuth est httpOnly : impossible à lire via
 * document.cookie. On récupère donc le jeton d'API (`session.accessToken`,
 * un JWT signé HS256 avec AUTH_SECRET — voir le callback session() dans
 * src/auth.ts) au travers de getSession(), directement vérifiable par le
 * backend FastAPI (app/core/auth.py).
 *
 * LE JETON EST GARDÉ UNE MINUTE. getSession() est une requête au serveur
 * (/api/auth/session), et elle partait avant CHAQUE appel à l'API : une page
 * d'administration qui lit huit ressources en demandait huit de suite avant
 * même de commencer, et chaque enregistrement attendait la sienne — le double
 * du temps de chaque action. Le jeton vaut douze heures ; une minute de
 * mémoire supprime ces allers-retours sans rien changer à ce qu'il autorise.
 * Les appels simultanés partagent la même demande. L'absence de session n'est
 * retenue que deux secondes — le temps d'une rafale —, et `oublierJeton()`
 * l'efface à la connexion : on ne reste pas « déconnecté » en mémoire.
 */
const DUREE_JETON_MS = 60_000;
const DUREE_ABSENCE_MS = 2_000;

let connu: { jeton: string | null; quand: number } | null = null;
let enVol: Promise<string | null> | null = null;

/** À appeler quand la session change sans rechargement (connexion). */
export function oublierJeton(): void {
  connu = null;
  enVol = null;
}

export async function jetonSession(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (connu && Date.now() - connu.quand < (connu.jeton ? DUREE_JETON_MS : DUREE_ABSENCE_MS)) return connu.jeton;
  if (!enVol) {
    const demande: Promise<string | null> = getSession()
      .then(session => (session as { accessToken?: string } | null)?.accessToken ?? null)
      .catch(() => null)
      .then(jeton => {
        // Une connexion entre-temps (oublierJeton) a rendu cette réponse caduque.
        if (enVol === demande) { connu = { jeton, quand: Date.now() }; enVol = null; }
        return jeton;
      });
    enVol = demande;
  }
  return enVol;
}

/**
 * En-tête Authorization: Bearer pour les appels authentifiés côté client.
 *
 * Asynchrone : à utiliser en `headers: await authHeaders()` ou
 * `headers: { "Content-Type": "application/json", ...(await authHeaders()) }`.
 * Renvoie un objet vide côté serveur ou si aucune session n'est présente.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const jeton = await jetonSession();
  return jeton ? { Authorization: `Bearer ${jeton}` } : {};
}
