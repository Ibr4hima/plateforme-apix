/**
 * Lire sur le serveur, sans aucun cache — ni celui du navigateur, ni celui de
 * l'API (en-tête `Cache-Control: no-cache`, cf. backend/app/core/cache.py).
 *
 * Pour l'administration, qui modifie : les listes y sont légères (les champs
 * des cartes), et la fiche complète se relit au moment de l'ouvrir ou de la
 * modifier. Une version gardée en cache, même de quelques secondes, pourrait
 * réécrire en l'enregistrant ce qu'un autre a changé entre-temps, ou ne pas
 * montrer ce qu'on vient d'enregistrer.
 */
export const SANS_CACHE: RequestInit = { cache: "no-store", headers: { "Cache-Control": "no-cache" } };

export async function lireFrais<T>(url: string): Promise<T> {
  const r = await fetch(url, SANS_CACHE);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
