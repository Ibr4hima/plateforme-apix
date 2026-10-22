// Index de la recherche globale — port mobile de la palette ⌘K du site.
import Fuse from "@/lib/fuse";
import { fetchTous, getJson } from "@/lib/api";
import { plier } from "@/lib/format";

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

// LES SOURCES DE L'INDEX SONT CELLES DES MODULES : mêmes clés, mêmes
// requêtes que leurs écrans et que le préchargement. L'index se rafraîchit
// avec eux — une entreprise ajoutée hier se trouve aujourd'hui — et rien ne
// se télécharge deux fois. Il était figé pour la session et persisté tel
// quel : une source en échec le jour de sa construction manquait ensuite
// pour de bon.
export const SOURCES_INDEX = [
  { cle: ["stat-pays"], fn: () => getJson<any[]>("/statistiques/pays") },
  { cle: ["accords"], fn: () => fetchTous("/accords") },
  { cle: ["evenements"], fn: () => fetchTous("/evenements") },
  { cle: ["entreprises"], fn: () => fetchTous("/entreprises") },
  { cle: ["zones-types"], fn: () => getJson<any[]>("/zones-types") },
] as const;

/** L'index, depuis les réponses des cinq sources (une source absente ne
    retire que sa famille). */
export function construireIndex([pays, accords, evenements, entreprises, zones]: (any[] | undefined)[]): Resultat[] {
  const ok = (x: any[] | undefined): any[] => (Array.isArray(x) ? x : []);
  return [
    ...ok(pays).map((p: any): Resultat => ({ type: "pays", nom: p.nom, sous: p.continent || undefined, item: p })),
    ...ok(accords).map((a: any): Resultat => ({ type: "accord", nom: a.titre, item: a })),
    ...ok(evenements).map((e: any): Resultat => ({ type: "evenement", nom: e.nom_event, sous: e.pays_hote_nom || undefined, item: e })),
    ...ok(entreprises).map((e: any): Resultat => ({ type: "entreprise", nom: e.nom, sous: e.forme_juridique || undefined, item: e })),
    ...ok(zones).map((z: any): Resultat => ({ type: "zone", nom: z.nom_zone, sous: z.type_zone || undefined, item: z })),
  ].filter(r => r.nom);
}

// Accents et casse repliés, des deux côtés : « senegal » trouve « Sénégal »
// sans y laisser de score, et une faute de frappe en plus reste tolérée —
// comme les listes des feuilles. La requête se replie avec `plier`.
export function creerFuse(index: Resultat[]) {
  return new (Fuse as any)(index, {
    keys: [
      { name: "nom", getFn: (r: Resultat) => plier(r.nom) },
      { name: "sous", getFn: (r: Resultat) => plier(r.sous) },
    ],
    threshold: 0.34, ignoreLocation: true, minMatchCharLength: 2,
  });
}
