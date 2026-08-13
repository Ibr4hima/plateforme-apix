"use client";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import { badge_gris } from "@/lib/couleurs";
import { fmtCompact as fmtValGen } from "@/lib/format";
/**
 * Symboles partagés par les trois onglets de la page Statistiques.
 * Chaque onglet vit dans son module (commerce-exterieur, flux-bilateraux,
 * page pour les indicateurs) ; ce fichier porte ce qu'ils partagent et rien
 * d'autre — un symbole utilisé par un seul onglet appartient à son module.
 */

// Couleurs du sens des échanges, communes aux onglets Commerce extérieur et
// Flux bilatéraux : bleu = exportations, orange = importations.
export const NACE_BLEU = "var(--bleu)";
export const NACE_ORANGE = "var(--orange)";

export { API_BASE as API } from "@/lib/api";

export type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
export type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
export type Donnee = { pays_id: number; pays: string; annee: number; indicateur: string; valeur: number | null };

// ── Regroupement des pays par continent ───────────────────────────────────────
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
/**
 * Les continents à présenter, dans l'ordre.
 *
 * `sansAutre` retire le groupe « Autre » de la liste — c'est le fourre-tout des
 * entrées sans continent renseigné, pour l'essentiel des agrégats de la CNUCED
 * (« Bunkers », zones économiques…) plutôt que des pays. Le masquer ne masque
 * QUE le filtre : ces entrées continuent d'alimenter les données, et
 * apparaissent normalement comme partenaires dans les tableaux et les graphes.
 */
export function sortContinents(conts: string[], sansAutre = false) {
  return [...conts].filter(c => !sansAutre || c !== "Autre").sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Pastilles (pays / période) ────────────────────────────────────────────────
export function BadgePeriode({ children }: { children: React.ReactNode }) {
  return <span style={{ ...badge_gris, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>{children}</span>;
}


// ── Graphe D3 (repris de la page IDE) ─────────────────────────────────────────

export function GrapheMultiPays(props: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  height?: number; type?: "line" | "bar"; titre?: string;
  fmt?: (v: number | null) => string; showDots?: boolean; lineWidth?: number;
}) {
  return <GrapheSignature {...props} fmt={props.fmt || fmtValGen} />;
}
