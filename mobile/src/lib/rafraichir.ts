// Tirer pour rafraîchir : la roue ne tourne que sous le geste. `isRefetching`
// est vrai à CHAQUE rechargement de fond — données vieilles de cinq minutes,
// retour du réseau, recherche qui garde la réponse précédente : la roue
// apparaissait seule et, sur iOS, la liste sautait d'une soixantaine de points.
import { useCallback, useRef, useState } from "react";

/** La roue et son geste : `tire` pour `refreshing`, `rafraichir` pour
    `onRefresh`. Relance toutes les requêtes données, attend la dernière. */
export function useRafraichir(...relances: (() => Promise<unknown>)[]) {
  const [tire, setTire] = useState(false);
  const courantes = useRef(relances);
  courantes.current = relances;
  const rafraichir = useCallback(async () => {
    setTire(true);
    try { await Promise.all(courantes.current.map(r => r())); } finally { setTire(false); }
  }, []);
  return { tire, rafraichir };
}
