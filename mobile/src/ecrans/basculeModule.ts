// Sélecteur de module de l'onglet Données (Inv. privés ⇄ Échanges) —
// injecté dans le hero des deux écrans par app/(onglets)/donnees.tsx.
import type { SegmentOption } from "@/components/HeroModule";

export type BasculeModule = {
  options: readonly SegmentOption[];
  valeur: string;
  onChange: (cle: string) => void;
};
