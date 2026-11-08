"use client";

/**
 * L'état d'une fiche ouverte depuis une page lourde (graphes, tableaux), dans
 * un petit magasin : la page l'ouvre (`magasin.ouvrir(x)`), seul l'hôte de la
 * fiche s'y abonne (`useFicheOuverte`). Ouvrir ou fermer la fiche ne réaffiche
 * donc que l'hôte — la page, ses graphes, ses cartes ne bougent pas.
 *
 * Portée par un `useState` de la page, la fiche réaffichait la page entière à
 * chaque ouverture et chaque fermeture ; chaque graphe, recalculé sur des
 * séries neuves, s'y redessinait (perf : 8 graphes et jusqu'à 117 ms d'image
 * sur les IDE).
 *
 *   const [fiche] = useState(() => creerMagasinFiche<Kpi>());
 *   <Carte onClick={() => fiche.ouvrir(kpi)} />
 *   <HoteFiche magasin={fiche} />      // useFicheOuverte(magasin) dedans
 */

import { useSyncExternalStore } from "react";

export function creerMagasinFiche<T>() {
  let ouverte: T | null = null;
  const abonnes = new Set<() => void>();
  const changer = (valeur: T | null) => { ouverte = valeur; abonnes.forEach(prevenir => prevenir()); };
  return {
    ouvrir: (valeur: T) => changer(valeur),
    fermer: () => changer(null),
    lire: () => ouverte,
    abonner: (prevenir: () => void) => { abonnes.add(prevenir); return () => { abonnes.delete(prevenir); }; },
  };
}

export type MagasinFiche<T> = ReturnType<typeof creerMagasinFiche<T>>;

/** La fiche ouverte (ou null) — à n'appeler que dans l'hôte de la fiche */
export function useFicheOuverte<T>(magasin: MagasinFiche<T>): T | null {
  return useSyncExternalStore(magasin.abonner, magasin.lire, () => null);
}
