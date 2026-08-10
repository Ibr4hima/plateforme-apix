import type { CSSProperties } from "react";

/**
 * La grille des cartes des pages à barre de filtres — entreprises, accords,
 * événements.
 *
 * Elle était figée à deux colonnes : replier la barre libérait 230 px qui ne
 * servaient à rien, les deux cartes s'étiraient au lieu qu'une troisième
 * apparaisse.
 *
 * Une grille `auto-fill` avait d'abord été essayée : elle répond à la largeur
 * réelle de la zone, donc au pli comme au redimensionnement de la barre. Mais
 * le nombre de colonnes y dépend alors de la fenêtre, et sur un écran d'environ
 * 1100 px — le cas courant sur les postes de la Présidence — le pli ne suffit
 * pas à faire tenir la troisième : à l'écran, rien ne bougeait. Le nombre de
 * colonnes est donc décidé par l'état de la barre, pas par une largeur seuil.
 *
 * `minmax(0, 1fr)` plutôt que `1fr` : sans cela une carte au contenu large
 * (un nom d'entreprise sans espace) élargit sa colonne au détriment des autres.
 */
export const COLONNES_OUVERT = 2;
export const COLONNES_REPLIE = 3;

export const grilleCartes = (filtresOuverts: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${filtresOuverts ? COLONNES_OUVERT : COLONNES_REPLIE}, minmax(0, 1fr))`,
  gap: 14,
});
