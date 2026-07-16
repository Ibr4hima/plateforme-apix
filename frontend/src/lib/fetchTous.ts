// Charge TOUTES les pages d'un endpoint paginé { total, data } : la première
// page donne le total, les suivantes sont chargées en parallèle. Évite la
// troncature silencieuse des listes limitées à per_page éléments.
export async function fetchTous(base: string, perPage = 100): Promise<any[]> {
  const sep = base.includes("?") ? "&" : "?";
  const url = (page: number) => `${base}${sep}page=${page}&per_page=${perPage}`;
  const premiere = await fetch(url(1)).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  let data: any[] = premiere.data || [];
  const total: number = premiere.total ?? data.length;
  const nbPages = Math.ceil(total / perPage);
  if (nbPages > 1) {
    const suites = await Promise.all(
      Array.from({ length: nbPages - 1 }, (_, i) =>
        fetch(url(i + 2)).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })),
    );
    for (const s of suites) data = data.concat(s.data || []);
  }
  return data;
}
