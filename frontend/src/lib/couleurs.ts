// Couleurs partagées de la plateforme — source unique de vérité pour les
// palettes et les dérivations, à la place des copies locales par page.
//
// ── Deux natures de couleur, deux mécanismes ─────────────────────────────────
// Les habillages (fonds voilés, badges, bordures) sont du CSS : ils s'écrivent
// en jetons — var(--bleu), rgb(var(--bleu-rgb) / 0.16) — et suivent l'apparence
// sans que personne ait à s'en occuper, y compris depuis les constantes de
// module calculées une fois pour toutes ci-dessous.
//
// Les palettes de SÉRIES le sont aussi : depuis que les graphes posent leurs
// couleurs en style inline plutôt qu'en attribut de présentation, d3 accepte
// parfaitement un var(--…) — c'est le navigateur qui résout, à la peinture. Un
// graphe se recolore donc sans être redessiné.
//
// Reste une exception irréductible : ce que JavaScript CALCULE. Une rampe
// interpolée (d3.interpolateRgb) doit décomposer ses bornes en canaux, ce
// qu'une variable CSS ne permet pas. Ces rares cas gardent des hexadécimaux et
// passent par la table NUIT — le dispositif de mobile/src/lib/couleurs.ts.

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useSombre } from "@/lib/apparence";

// Palette catégorielle des graphes — validée CVD/contraste (skill dataviz :
// séparation adjacente ΔE ≥ 8, plancher vision normale ≥ 15, contraste ≥ 3:1
// sur surface claire). Bleu + orange de marque en tête (ancre identitaire),
// séries 3-8 re-calées pour éviter les collisions vert↔orange et brun↔rouge.
// L'ordre est FIXE : la couleur suit l'entité, jamais son rang.
//
// En jetons : chaque teinte porte sa valeur de nuit dans la palette.
export const PALETTE_COMPARAISON = ["var(--bleu)", "var(--orange)", "var(--emeraude)", "var(--prune)", "var(--azur)", "var(--framboise)", "var(--or)", "var(--bleuroi)"] as const;

// Sous-ensemble 4 séries (cas courant : IDE, BDEF, opportunités…)
export const COMP_PALETTE: readonly string[] = PALETTE_COMPARAISON.slice(0, 4);

// ── La palette, la nuit ──────────────────────────────────────────────────────
//
// Les couleurs de catégorie sont des IDENTITÉS, pas des jetons de surface :
// elles ne passent pas par le mécanisme clair/sombre des variables CSS. Sur le
// fond de minuit, le bleu profond de la plateforme disparaissait purement et
// simplement — « SECTEUR TERTIAIRE » se lisait en noir sur noir.
//
// Chacune reçoit ici son équivalent de nuit : même teinte, remontée en
// luminosité jusqu'à passer le seuil AA sur le fond sombre. La table est la
// contrepartie exacte des jetons --bleu / --orange / --vert, et reprend celle
// de l'application mobile.
const NUIT: Record<string, string> = {
  "#004f91": "#85B9EC", // bleu APIX
  "#ca631f": "#FFA45C", // orange — réchauffé et éclairci
  "#188038": "#48C9B0", // vert → teal : la famille froide du bleu de nuit
  "#6a1b9a": "#C79BEB", // violet
  "#0891b2": "#5FC7DE", // cyan
  "#0e7490": "#58C6CE", // sarcelle
  "#b91c1c": "#F08A8A", // rouge
  "#dc2626": "#F08A8A", // rouge vif
  "#a16207": "#DCA84B", // ocre
  "#4338ca": "#9AA0F0", // indigo
  "#b45309": "#E0A458", // ambre
  "#4d7c0f": "#9FCA5E", // olive
  "#be185d": "#EE8AB0", // rose
  "#6b7280": "#9AA7B8", // gris
  // Les six séries de comparaison qui ne sont pas des couleurs de marque
  "#1b9e77": "#4FD1AE", // émeraude
  "#7b3294": "#C79BEB", // prune
  "#2a8fb0": "#5FC2DC", // azur
  "#d6336c": "#E67C99", // framboise
  "#b8860b": "#E4C55F", // or
  "#3b4cc0": "#9AA0F0", // bleu roi
  // Les pastels des pôles territoriaux. Ils sont déjà clairs, mais délavés sur
  // du minuit : la nuit les resature au lieu de les éclaircir.
  "#9dc3e6": "#6FB2E8", "#9dd3de": "#5FC2DC", "#9ddec2": "#4FD1AE",
  "#b4de9d": "#7ACF85", "#d2de9d": "#A8D268", "#e6de9d": "#CBD35C",
  "#e6c79d": "#EDAA62", "#e6ac9d": "#F09571", "#c9b8e6": "#B79BE8",
  "#9db0e6": "#8FA6E8", "#e6b8d2": "#DC8AC4", "#bee6c2": "#7ACF85",
  "#e6d4b0": "#E4C55F", "#a8dede": "#58C6CE",
};

/** La couleur de catégorie, dans le schéma demandé. */
export const enNuit = (couleur: string, sombre: boolean): string =>
  (sombre && NUIT[couleur.toLowerCase()]) || couleur;

/**
 * Le traducteur de palette du schéma courant.
 *
 * En crochet plutôt qu'en fonction libre : c'est lui qui abonne le composant au
 * changement d'apparence. Sans cet abonnement, un graphe déjà dessiné garderait
 * ses couleurs de jour jusqu'à son prochain rendu.
 */
export function useTeinte(): (couleur: string) => string {
  const sombre = useSombre();
  return useMemo(() => (couleur: string) => enNuit(couleur, sombre), [sombre]);
}

/**
 * Les bornes d'une rampe bleue continue, dans le schéma courant.
 *
 * Les rampes sont interpolées par d3, qui décompose ses bornes en canaux : le
 * seul endroit du code où une variable CSS ne peut pas servir. De jour la
 * rampe descend du bleu profond vers le voile clair ; de nuit elle part d'un
 * bleu lumineux vers le bleu d'élévation des cartes — sans quoi elle finirait
 * dans le fond.
 */
export function useRampeBleue(): [string, string] {
  const sombre = useSombre();
  return sombre ? ["#9FC8F0", "#22406A"] : ["#003468", "#EDF4FB"];
}

// Couleurs des pôles territoriaux (par nom normalisé) — alignées sur la carte.
// Pastels de jour, resaturés la nuit : sur du minuit, un pastel se délave au
// lieu de s'éclaircir. Les deux valeurs vivent dans la palette.
export const POLE_COULEURS: Record<string, string> = {
  "dakar": "var(--pole-dakar)",
  "thies": "var(--pole-thies)",
  "diourbel louga": "var(--pole-diourbel-louga)",
  "centre": "var(--pole-centre)",
  "nord": "var(--pole-nord)",
  "nord est": "var(--pole-nord-est)",
  "sud": "var(--pole-sud)",
  "sud est": "var(--pole-sud-est)",
};

export const normPole = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/pole/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();

// ── Les 4 couleurs canoniques + fonds voilés et badges dérivés ────────────────
// Une seule source pour les habillages « bloc voilé » (fond dégradé + bordure)
// et « badge » (pastille) déclinés dans les 4 teintes de la plateforme.
//
// Tout s'exprime en jetons : ces constantes sont calculées une seule fois au
// chargement du module, mais leurs valeurs étant des var(--…), c'est le
// navigateur qui tranche à chaque peinture. Elles suivent donc l'apparence sans
// être recalculées.
export const COULEURS_4 = {
  bleu: "var(--bleu)",
  orange: "var(--orange)",
  vert: "var(--vert)",
  violet: "var(--violet)",
} as const;
export type Teinte = keyof typeof COULEURS_4;

/**
 * Une couleur voilée — le remplaçant des suffixes d'opacité hexadécimaux qui
 * parsemaient le code (`couleur + "15"`).
 *
 * Cette concaténation exigeait un hexadécimal. Avec un jeton, elle produisait
 * « var(--bleu)15 » : une valeur invalide, silencieusement ignorée, et le fond
 * disparaissait. color-mix, lui, accepte n'importe quelle expression de
 * couleur — variable CSS comprise — et laisse donc ces voiles suivre
 * l'apparence.
 */
export const voile = (couleur: string, pourcent: number): string =>
  `color-mix(in srgb, ${couleur} ${pourcent}%, transparent)`;

/** Le triplet RGB d'une teinte, pour composer des opacités variables. */
const tripletDe = (nom: string) => `var(--${nom}-rgb)`;

// Fond voilé en dégradé (comme la carte « Balance commerciale ») : à étaler
// sur une carte via  style={{ ...fond_bleu, padding: … }}  ou className ds-carte.
export const fondVoile = (teinte: Teinte): CSSProperties => {
  const rgb = tripletDe(teinte);
  return {
    background: `linear-gradient(180deg, rgb(${rgb} / 0.06), rgb(${rgb} / 0.02))`,
    border: `1px solid rgb(${rgb} / 0.16)`,
  };
};

// Badge / pastille (comme les accords et entreprises de la Fiche Pays) :
// pastille de la surface haute, translucide, à bordure teintée, texte de la
// couleur.
export const badge = (teinte: Teinte): CSSProperties => {
  const rgb = tripletDe(teinte);
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 11, fontWeight: 600, color: COULEURS_4[teinte],
    background: "rgb(var(--carte-rgb) / 0.7)", border: `1px solid rgb(${rgb} / 0.20)`,
    padding: "4px 11px", borderRadius: 999,
  };
};

// Constantes nommées prêtes à l'emploi
export const fond_bleu = fondVoile("bleu");
export const fond_orange = fondVoile("orange");
export const fond_vert = fondVoile("vert");
export const fond_violet = fondVoile("violet");

export const badge_bleu = badge("bleu");
export const badge_orange = badge("orange");
export const badge_vert = badge("vert");
export const badge_violet = badge("violet");

// ── Constructeurs génériques, à partir d'un jeton nommé ──────────────────────
export const badgeJeton = (nom: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, color: `var(--${nom})`,
  background: "rgb(var(--carte-rgb) / 0.7)", border: `1px solid rgb(var(--${nom}-rgb) / 0.24)`,
  padding: "4px 11px", borderRadius: 999,
});
export const fondJeton = (nom: string): CSSProperties => ({
  background: `linear-gradient(180deg, rgb(var(--${nom}-rgb) / 0.06), rgb(var(--${nom}-rgb) / 0.02))`,
  border: `1px solid rgb(var(--${nom}-rgb) / 0.16)`,
});

// ── Constructeurs à partir d'une couleur quelconque ─────────────────────────
// Ils reçoivent aussi bien un hexadécimal qu'un var(--…) : color-mix compose
// l'opacité sans avoir à décomposer la couleur en canaux, ce qu'un jeton ne
// permettrait pas.
export const badgeDe = (couleur: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, color: couleur,
  background: "rgb(var(--carte-rgb) / 0.7)", border: `1px solid ${voile(couleur, 24)}`,
  padding: "4px 11px", borderRadius: 999,
});
export const fondDe = (couleur: string): CSSProperties => ({
  background: `linear-gradient(180deg, ${voile(couleur, 6)}, ${voile(couleur, 2)})`,
  border: `1px solid ${voile(couleur, 16)}`,
});

// 5e teinte, distincte des 4 mais assortie : ambre / or (ex. Sponsor)
export const badge_ambre = badgeJeton("ambre");
export const fond_ambre = fondJeton("ambre");

// Badge neutre (états inactifs / expirés) : gris, même gabarit que les autres
export const badge_gris: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, color: "var(--gris-fort)",
  background: "rgb(var(--carte-rgb) / 0.7)", border: "1px solid rgb(var(--gris-rgb) / 0.40)",
  padding: "4px 11px", borderRadius: 999,
};
export const fond_gris: CSSProperties = {
  background: "linear-gradient(180deg, rgb(var(--gris-rgb) / 0.08), rgb(var(--gris-rgb) / 0.03))",
  border: "1px solid rgb(var(--gris-rgb) / 0.18)",
};

// 4 teintes supplémentaires assorties aux 4 canoniques (complètent le cercle
// chromatique : sarcelle, indigo, rose, olive)
export const badge_sarcelle = badgeJeton("sarcelle");
export const badge_indigo = badgeJeton("indigo");
export const badge_rose = badgeJeton("rose");
export const badge_olive = badgeJeton("olive");
// Rouge (états critiques : inactif) — réservé aux alertes ailleurs
export const badge_rouge = badgeJeton("danger");
export const fond_rouge = fondJeton("danger");
export const fond_sarcelle = fondJeton("sarcelle");
export const fond_indigo = fondJeton("indigo");
export const fond_rose = fondJeton("rose");
export const fond_olive = fondJeton("olive");

// ── Pôles territoires : couleur unique partagée (entreprises, zones…) ─────────
// Nom du pôle (normalisé) → teinte du badge et accent de survol.
const POLE_JETON: Record<string, string> = {
  "dakar": "bleu",             // bleu
  "thies": "orange",           // orange
  "centre": "vert",            // vert
  "sud": "violet",             // violet
  "nord": "sarcelle",          // sarcelle
  "sud est": "rose",           // rose
  "diourbel louga": "indigo",  // indigo
  "nord est": "olive",         // olive
};
export const poleAccent = (nom: string): string => {
  const jeton = POLE_JETON[normPole(nom)];
  return jeton ? `var(--${jeton})` : "var(--bordure-forte)";
};
export const badgePole = (nom: string): CSSProperties => {
  const jeton = POLE_JETON[normPole(nom)];
  return jeton ? badgeJeton(jeton) : badge_gris;
};

// Fond survolé d'un badge cliquable (bordure et fond renforcés) — à appliquer
// dans onMouseEnter/Leave, ou via le composant <Badge> ci-dessous.
export const badgeSurvol = (teinte: Teinte) => {
  const rgb = tripletDe(teinte);
  return { background: `rgb(${rgb} / 0.10)`, borderColor: `rgb(${rgb} / 0.35)` };
};
