import type { CSSProperties } from "react";

/**
 * La grille des cartes des pages à volet de filtres — entreprises, accords,
 * événements : deux colonnes.
 *
 * Le nombre de colonnes est fixé, pas confié à une grille `auto-fill` : celle-ci
 * répond à la largeur réelle de la zone, et le nombre de colonnes y dépend
 * alors de la fenêtre — sur un écran d'environ 1100 px, le cas courant sur les
 * postes de la Présidence, elle hésitait entre deux et trois. La grille en
 * prenait trois quand le volet de filtres se repliait ; le volet est fixe
 * désormais, et la grille aussi.
 *
 * `minmax(0, 1fr)` plutôt que `1fr` : sans cela une carte au contenu large
 * (un nom d'entreprise sans espace) élargit sa colonne au détriment des autres.
 */
export const COLONNES_CARTES = 2;

export const GRILLE_CARTES: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(${COLONNES_CARTES}, minmax(0, 1fr))`,
  gap: 14,
};
