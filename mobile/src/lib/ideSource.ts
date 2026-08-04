// La SOURCE d'une lecture IDE — ce que le sélecteur de l'en-tête choisit :
// un pays, une zone du monde (le total mondial, un continent, une région, un
// groupement économique) ou un secteur d'activité. Les trois sections de
// l'onglet — Flux & Stocks, Greenfield, Fusion & Acquisition — lisent la même
// forme de données quelle que soit la source, ce fichier s'occupant de
// traduire chaque source dans l'endpoint qui lui correspond.
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getJson } from "@/lib/api";

export type SourceIde =
  | { type: "pays";    nom: string }
  | { type: "monde";   code: string | null; label: string }   // code null = le total mondial
  | { type: "secteur"; id: number; label: string };

export const libelleSource = (s: SourceIde) => s.type === "pays" ? s.nom : s.label;

export type LigneIde = { direction: string; indicateur: string; annee: number; valeur: number };

// Les séries d'une source, ramenées à une forme unique.
// · pays    → /ide/cnuced (toutes les séries du pays d'un coup)
// · monde   → /ide/monde/global, un appel par indicateur (le total mondial
//             quand le code est nul, sinon les pays membres du groupement)
// · secteur → /ide/cnuced-secteurs, le jeu complet mis en cache puis filtré ;
//             le « Global des secteurs » (id 0) agrège les trois grands
//             secteurs, comme sur le site
export function useSeriesIde(source: SourceIde, indicateurs: string[], bornes: [number, number]) {
  const params = useMemo(() => new URLSearchParams({
    pays_list: source.type === "pays" ? source.nom : "",
    annee_min: String(bornes[0]), annee_max: String(bornes[1]),
  }).toString(), [source, bornes[0], bornes[1]]);

  const qPays = useQuery({
    queryKey: ["ide-cnuced", params], enabled: source.type === "pays",
    queryFn: () => getJson<any[]>(`/ide/cnuced?${params}`),
  });

  const qMonde = useQueries({
    queries: indicateurs.map(ind => {
      const p = new URLSearchParams({ indicateur: ind, annee_min: String(bornes[0]), annee_max: String(bornes[1]) });
      if (source.type === "monde" && source.code) p.set("code", source.code);
      const qs = p.toString();
      return {
        queryKey: ["ide-monde-global", qs], enabled: source.type === "monde",
        queryFn: () => getJson<any>(`/ide/monde/global?${qs}`),
        staleTime: 30 * 60 * 1000,
      };
    }),
  });

  const qSecteurs = useQuery({
    queryKey: ["ide-cnuced-secteurs"], enabled: source.type === "secteur",
    queryFn: () => getJson<any[]>("/ide/cnuced-secteurs"), staleTime: 30 * 60 * 1000,
  });

  const rows: LigneIde[] = useMemo(() => {
    if (source.type === "pays") {
      return (qPays.data || [])
        .filter((d: any) => d.valeur != null && indicateurs.includes(d.indicateur))
        .map((d: any) => ({ direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.valeur }));
    }
    if (source.type === "monde") {
      const out: LigneIde[] = [];
      indicateurs.forEach((ind, i) => {
        const s = qMonde[i]?.data?.series;
        (["entrant", "sortant"] as const).forEach(dir => {
          (s?.[dir] || []).forEach((pt: any) => {
            if (pt.valeur != null) out.push({ direction: dir, indicateur: ind, annee: pt.annee, valeur: pt.valeur });
          });
        });
      });
      return out;
    }
    // Secteurs : le Global agrège les trois grands secteurs (ids 1-3)
    const brut = (qSecteurs.data || []).filter((d: any) =>
      d.valeur != null && indicateurs.includes(d.indicateur) &&
      d.annee >= bornes[0] && d.annee <= bornes[1]);
    if (source.id !== 0) {
      return brut.filter((d: any) => d.secteur_id === source.id)
        .map((d: any) => ({ direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.valeur }));
    }
    const agg = new Map<string, LigneIde>();
    brut.forEach((d: any) => {
      if (![1, 2, 3].includes(d.secteur_id)) return;
      const cle = `${d.annee}|${d.direction}|${d.indicateur}`;
      const cur = agg.get(cle);
      if (cur) cur.valeur += d.valeur;
      else agg.set(cle, { direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.valeur });
    });
    return [...agg.values()];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, qPays.data, qSecteurs.data, qMonde.map(q => q.dataUpdatedAt).join(","), indicateurs.join(","), bornes[0], bornes[1]]);

  const chargement = source.type === "pays" ? qPays.isLoading
    : source.type === "monde" ? qMonde.some(q => q.isLoading)
    : qSecteurs.isLoading;

  return { rows, chargement };
}
