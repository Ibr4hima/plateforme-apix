// Index de la recherche globale — port mobile de la palette ⌘K du site.
// Chargé à la première ouverture puis conservé pour la session.
import Fuse from "@/lib/fuse";
import { fetchTous, getJson } from "@/lib/api";

export type Resultat = {
  type: "pays" | "accord" | "evenement" | "entreprise" | "zone";
  nom: string;
  sous?: string;
  item: any;
};

export const GROUPES: Record<Resultat["type"], string> = {
  pays: "Pays", accord: "Accords", evenement: "Événements",
  entreprise: "Entreprises", zone: "Zones",
};

let cache: Resultat[] | null = null;
let enCours: Promise<Resultat[]> | null = null;

export async function chargerIndex(): Promise<Resultat[]> {
  if (cache) return cache;
  if (enCours) return enCours;
  enCours = (async () => {
    const [pays, accords, evenements, entreprises, zones] = await Promise.allSettled([
      getJson<any[]>("/statistiques/pays"),
      fetchTous("/accords"),
      fetchTous("/evenements"),
      fetchTous("/entreprises"),
      getJson<any[]>("/zones-types"),
    ]);
    const ok = (r: PromiseSettledResult<any>): any[] => r.status === "fulfilled" && Array.isArray(r.value) ? r.value : [];
    const index: Resultat[] = [
      ...ok(pays).map((p: any): Resultat => ({ type: "pays", nom: p.nom, sous: p.continent || undefined, item: p })),
      ...ok(accords).map((a: any): Resultat => ({ type: "accord", nom: a.titre, item: a })),
      ...ok(evenements).map((e: any): Resultat => ({ type: "evenement", nom: e.nom_event, sous: e.pays_hote_nom || undefined, item: e })),
      ...ok(entreprises).map((e: any): Resultat => ({ type: "entreprise", nom: e.nom, sous: e.forme_juridique || undefined, item: e })),
      ...ok(zones).map((z: any): Resultat => ({ type: "zone", nom: z.nom_zone, sous: z.type_zone || undefined, item: z })),
    ].filter(r => r.nom);
    if (index.length) cache = index;
    enCours = null;
    return index;
  })();
  return enCours;
}

export function creerFuse(index: Resultat[]) {
  return new (Fuse as any)(index, { keys: ["nom", "sous"], threshold: 0.34, ignoreLocation: true, minMatchCharLength: 2 });
}
