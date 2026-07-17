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

export async function getJson<T = any>(chemin: string): Promise<T> {
  const r = await fetch(`${API}${chemin}`, { headers: ENTETES });
  if (!r.ok) throw new Error(`API ${r.status} sur ${chemin}`);
  return r.json();
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
