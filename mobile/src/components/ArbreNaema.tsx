// Arbre NAEMA secteur → branche → activité, à partir des ids d'une fiche.
// Il se dessine avec la hiérarchie UNIQUE des fiches (Thematiques) : le
// secteur pointé de bleu, les branches sur un rail fin, les activités en
// texte simple — et plus la cascade bleu / orange / vert, qui faisait lire un
// code couleur au lieu d'une indentation. Fiches Entreprise, Prospect, Zone,
// Projet et Potentialité ; Événement et Accord passent directement par
// Thematiques.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SecteurArbre } from "@/components/FiltresListe";
import Thematiques, { type ArbreThemes } from "@/components/Thematiques";
import { getJson } from "@/lib/api";

const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;

export function useNaema() {
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS }).data || [];
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS }).data || [];
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS }).data || [];
  return { secteurs, branches, activites };
}

// Arbre par noms pour la CascadeThema des feuilles de filtres, avec les
// listes plates pour convertir les noms sélectionnés en ids (comme le site).
export function useNaemaArbre() {
  const { secteurs, branches, activites } = useNaema();
  const arbre = useMemo<SecteurArbre[]>(() => secteurs.map((sec: any) => ({
    nom: sec.nom,
    branches: branches.filter((b: any) => b.secteur_id === sec.id).map((b: any) => ({
      nom: b.nom,
      activites: activites.filter((a: any) => a.branche_id === b.id).map((a: any) => ({ nom: a.nom })),
    })),
  })), [secteurs, branches, activites]);
  return { secteurs, branches, activites, arbre };
}

export default function ArbreNaema({ secIds, braIds, actIds }: { secIds: number[]; braIds: number[]; actIds: number[] }) {
  const { secteurs, branches, activites } = useNaema();
  // Les ids remontés en arbre par noms — secteur → branches → activités —,
  // la forme que lit la hiérarchie partagée des fiches
  const arbre = useMemo<ArbreThemes>(() => {
    const a: ArbreThemes = {};
    for (const secId of secIds) {
      const sec = secteurs.find((x: any) => x.id === secId);
      if (!sec) continue;
      a[sec.nom] = {};
      for (const bra of branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id))) {
        a[sec.nom][bra.nom] = activites
          .filter((x: any) => x.branche_id === bra.id && actIds.includes(x.id))
          .map((x: any) => x.nom);
      }
    }
    return a;
  }, [secteurs, branches, activites, secIds, braIds, actIds]);
  if (!secteurs.length) return null;
  return <Thematiques arbre={arbre} />;
}
