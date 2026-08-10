import type { CSSProperties } from "react";

/**
 * La grille des cartes des pages à barre de filtres — entreprises, accords,
 * événements.
 *
 * Elle était figée à deux colonnes. Replier la barre de filtres libérait alors
 * 230 px qui ne servaient à rien : les deux cartes s'étiraient au lieu qu'une
 * troisième apparaisse. Même chose en élargissant la barre à la poignée, ou sur
 * un écran étroit où deux colonnes deviennent illisibles.
 *
 * `auto-fill` répond à la largeur RÉELLE de la zone, quelle qu'en soit la
 * cause : plus d'état à faire remonter du panneau vers la page, et le cas du
 * panneau redimensionné est traité par la même règle.
 *
 * Le seuil de 360 px est choisi pour que, sur un écran de bureau courant, la
 * troisième colonne apparaisse quand la barre se replie et pas avant.
 */
export const MIN_CARTE = 360;

export const GRILLE_CARTES: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_CARTE}px, 1fr))`,
  gap: 14,
};
