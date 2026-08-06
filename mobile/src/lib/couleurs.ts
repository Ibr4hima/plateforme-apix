// Couleurs partagées de la plateforme — source unique de vérité pour les
// palettes et les dérivations, à la place des copies locales par page.
import { useMemo } from "react";
import { useSombre } from "@/lib/apparence";

// Palette des vues comparatives (jusqu'à 4 séries : IDE, BDEF, opportunités…)
export const COMP_PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A"] as const;

// Palette longue des comparaisons multi-pays (fiche pays, statistiques)
export const PALETTE_COMPARAISON = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"] as const;

// Couleurs des pôles territoriaux (par nom normalisé) — alignées sur la carte
export const POLE_COULEURS: Record<string, string> = {
  "dakar": "#9DC3E6",          // bleu clair
  "thies": "#9DD3DE",          // bleu-teal
  "diourbel louga": "#9DDEC2", // menthe
  "centre": "#B4DE9D",         // vert tendre
  "nord": "#D2DE9D",           // vert-jaune
  "nord est": "#E6DE9D",       // jaune doux
  "sud": "#E6C79D",            // pêche
  "sud est": "#E6AC9D",        // corail clair
};

export const normPole = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/pole/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();

// ── La palette, la nuit ──────────────────────────────────────────────────────
//
// Les couleurs de catégorie (secteurs, niveaux territoriaux, types de zone,
// statuts) sont écrites en dur : ce sont des IDENTITÉS, pas des jetons de
// surface, et elles ne passent donc pas par le mécanisme clair/sombre. Sur le
// fond de minuit, le bleu profond de la plateforme disparaissait purement et
// simplement — « SECTEUR TERTIAIRE » se lisait en noir sur noir.
//
// Chacune reçoit ici son équivalent de nuit : même teinte, remontée en
// luminosité jusqu'à passer le seuil AA sur le fond sombre. Le tableau est la
// contrepartie exacte des jetons T.bleu / T.orange / T.vert.
const NUIT: Record<string, string> = {
  "#004f91": "#85B9EC", // bleu APIX
  "#ca631f": "#FFA45C", // orange — réchauffé et éclairci
  "#188038": "#48C9B0", // vert → teal : la famille froide du bleu de nuit
  "#6A1B9A": "#C79BEB", // violet
  "#0891b2": "#5FC7DE", // cyan
  "#b91c1c": "#F08A8A", // rouge
  "#a16207": "#DCA84B", // ocre
  "#4338ca": "#9AA0F0", // indigo
  "#b45309": "#E0A458", // ambre
};

/** La couleur de catégorie, dans le schéma demandé. */
export const enNuit = (couleur: string, sombre: boolean): string =>
  (sombre && NUIT[couleur]) || couleur;

/**
 * Le traducteur de palette du schéma courant.
 *
 * En hook plutôt qu'en fonction libre : c'est lui qui abonne le composant au
 * changement d'apparence. Sans cet abonnement, une carte déjà montée garderait
 * ses couleurs de jour jusqu'à son prochain rendu.
 */
export function useTeinte(): (couleur: string) => string {
  const sombre = useSombre();
  return useMemo(() => (couleur: string) => enNuit(couleur, sombre), [sombre]);
}

// Version foncée et saturée d'un pastel — texte lisible sur fond `${pastel}40`
export const foncerPastel = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mn = Math.min(r, g, b);
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, ((v - mn) * 2 + mn * 0.22) * 0.85)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
