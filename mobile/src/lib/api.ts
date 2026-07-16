// Accès à l'API FastAPI de la plateforme — la même que le site web.
// L'URL vient de EXPO_PUBLIC_API_URL (fichier .env du dossier mobile) :
// sur un téléphone, « localhost » désigne le téléphone lui-même — utiliser
// l'adresse IP locale du Mac en développement (ex. http://192.168.1.20:8000/api/v1).

export const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function getJson<T = any>(chemin: string): Promise<T> {
  const r = await fetch(`${API}${chemin}`);
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
