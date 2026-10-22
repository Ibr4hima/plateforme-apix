// Accès à l'API FastAPI de la plateforme — la même que le site web.
// L'URL vient de EXPO_PUBLIC_API_URL (fichier .env du dossier mobile) :
//  · en développement : l'IP locale du Mac (ex. http://192.168.1.20:8000/api/v1),
//    « localhost » désignerait le téléphone lui-même ;
//  · en production : https://demo-plateforme-apix.com/api/v1 avec
//    EXPO_PUBLIC_API_AUTH=utilisateur:motdepasse (le basic-auth Caddy de la démo).

export const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Basic-auth de la démo (optionnel) — encodé sans dépendre de btoa (Hermes)
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(texte: string): string {
  let sortie = "";
  for (let i = 0; i < texte.length; i += 3) {
    const a = texte.charCodeAt(i), b = texte.charCodeAt(i + 1), c = texte.charCodeAt(i + 2);
    sortie += B64[a >> 2] + B64[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)]
      + (isNaN(b) ? "=" : B64[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)])
      + (isNaN(c) ? "=" : B64[c & 63]);
  }
  return sortie;
}
const AUTH = process.env.EXPO_PUBLIC_API_AUTH || "";
export const ENTETES: Record<string, string> = AUTH ? { Authorization: `Basic ${base64(AUTH)}` } : {};

/**
 * L'empreinte de la configuration d'accès — elle sert de « buster » au cache
 * persisté (voir app/_layout).
 *
 * Le cache garde une semaine de réponses sur l'appareil. Quand l'URL ou les
 * identifiants changent d'un build à l'autre, ce qu'il contient ne décrit plus
 * la même source : une version livrée sans identifiants a ainsi laissé des
 * entrées que la version corrigée continuait de servir — un écran restait vide
 * alors que l'API répondait. Lier l'empreinte à la configuration fait tomber
 * le cache de lui-même dès qu'elle bouge.
 */
export const EMPREINTE_API = `${API}|${AUTH ? "auth" : "libre"}`;

/**
 * Une requête est EN PANNE quand elle a échoué SANS rien laisser à montrer.
 *
 * React Query conserve la dernière réponse connue quand un rafraîchissement
 * échoue : `isError` devient vrai, mais `data` tient toujours. Les écrans
 * traitaient pourtant l'erreur comme une absence — ils vidaient la liste et
 * affichaient « impossible de joindre la plateforme » alors que la donnée
 * était là. Hors ligne, l'app paraissait vide en ayant tout en cache.
 *
 * On ne montre donc l'erreur que lorsqu'il n'y a réellement rien.
 */
export const enPanne = (q: { isError: boolean; data?: unknown }): boolean =>
  q.isError && q.data === undefined;

// La relecture du cache persisté (app/_layout) : tant qu'elle court, les
// requêtes restent immobiles (« idle ») sans être vides pour autant — elles
// attendent leur réponse en cache. Le fournisseur appelle `finRestauration`
// avant de rendre la main aux écrans, qui se redessinent alors tous.
let restauration = true;
export const finRestauration = () => { restauration = false; };

/**
 * Une requête EN ATTENTE : rien n'est encore arrivé et elle attend — elle
 * charge, le réseau manque (requête mise en pause) ou le cache se relit. Ce
 * n'est PAS une absence de données : on montre l'attente, jamais « aucun
 * résultat ». `isLoading` (en attente ET en train de charger) ne suffisait
 * pas : hors ligne, une requête en pause n'est pas « en chargement », et
 * l'écran affirmait alors que rien n'existait. Une requête désactivée
 * n'attend rien.
 */
export const enAttente = (q: { isPending: boolean; fetchStatus: string }): boolean =>
  q.isPending && (q.fetchStatus !== "idle" || restauration);

/** Hors ligne, sans rien à montrer : la requête attend le retour du réseau. */
export const horsLigne = (q: { isPending: boolean; fetchStatus: string }): boolean =>
  q.isPending && q.fetchStatus === "paused";

// Le délai d'une requête, corps compris. Sans lui, un réseau qui cale (salon,
// 3G, bascule Wi-Fi → 4G) laissait la requête ouverte à jamais : Android ne
// fixe AUCUN délai à ses connexions, iOS seulement celui d'inactivité du
// système. Le squelette restait affiché, la relance ne partait jamais, et la
// file du préchargement s'arrêtait là pour toute la session. Passé ce délai,
// la requête échoue : React Query la relance, puis l'écran le dit.
const DELAI = 20_000;

export async function getJson<T = any>(chemin: string): Promise<T> {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI);
  try {
    const r = await fetch(`${API}${chemin}`, { headers: ENTETES, signal: ctrl.signal });
    if (!r.ok) throw new Error(`API ${r.status} sur ${chemin}`);
    return await r.json();
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`Délai dépassé sur ${chemin}`);
    throw e;
  } finally {
    clearTimeout(minuterie);
  }
}

// Port de lib/fetchTous du site : charge toutes les pages d'un endpoint
// paginé { total, data } en parallèle.
export async function fetchTous(chemin: string, parPage = 100): Promise<any[]> {
  const sep = chemin.includes("?") ? "&" : "?";
  const premiere = await getJson<{ total: number; data: any[] }>(`${chemin}${sep}page=1&per_page=${parPage}`);
  const total = premiere.total ?? premiere.data?.length ?? 0;
  const pages = Math.ceil(total / parPage);
  if (pages <= 1) return premiere.data || [];
  const restes = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      getJson<{ data: any[] }>(`${chemin}${sep}page=${i + 2}&per_page=${parPage}`)),
  );
  return [...(premiere.data || []), ...restes.flatMap(r => r.data || [])];
}
