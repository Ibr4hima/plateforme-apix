"use client";

import { useState } from "react";

/** Les continents dépliés d'une liste de pays groupée, recherche comprise.
 *
 *  PENDANT UNE RECHERCHE, TOUT EST DÉPLIÉ — et cela se DÉDUIT de la recherche
 *  au lieu d'être écrit dans l'état par un effet. L'effet passait après
 *  l'affichage : à chaque lettre tapée, la liste filtrée apparaissait d'abord
 *  repliée, puis s'ouvrait à l'image suivante. Les continents refermés à la
 *  main pendant une recherche sont tenus à part, et oubliés dès que la
 *  recherche change ; vider la recherche rend la liste telle qu'on l'avait
 *  laissée. */
export function useContinentsOuverts(recherche: string) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [refermes, setRefermes] = useState<Set<string>>(new Set());
  const [rechercheVue, setRechercheVue] = useState(recherche);
  if (recherche !== rechercheVue) {
    setRechercheVue(recherche);
    if (refermes.size) setRefermes(new Set());
  }
  const enRecherche = recherche !== "";
  const basculerDans = (s: Set<string>, c: string) => {
    const n = new Set(s);
    if (n.has(c)) n.delete(c); else n.add(c);
    return n;
  };
  return {
    estOuvert: (c: string) => enRecherche ? !refermes.has(c) : ouverts.has(c),
    basculer: (c: string) => enRecherche
      ? setRefermes(s => basculerDans(s, c))
      : setOuverts(s => basculerDans(s, c)),
  };
}
