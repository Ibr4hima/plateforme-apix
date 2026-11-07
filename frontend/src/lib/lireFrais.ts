/**
 * Une réponse JSON relue sur le serveur, jamais servie d'un cache.
 *
 * Pour l'administration, qui modifie : les listes y sont légères (les champs
 * des cartes), et la fiche complète se relit au moment de l'ouvrir ou de la
 * modifier. Une version gardée en cache, même de quelques minutes, pourrait
 * réécrire en l'enregistrant ce qu'un autre a changé entre-temps.
 */
export async function lireFrais<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
