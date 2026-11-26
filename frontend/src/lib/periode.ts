"use client";

import { useState } from "react";

/** La période d'un onglet : celle qu'on a RÉGLÉE au curseur, sinon les bornes
 *  des données.
 *
 *  L'ÉTAT NE GARDE QUE LE CHOIX. Les bornes étaient recopiées dans l'état par
 *  un effet (« alignement sur les bornes réelles ») : un affichage avec les
 *  bornes d'avant, une requête sur elles, puis tout recommençait avec les
 *  bonnes. `null` veut dire « toute la période » — l'année affichée se déduit
 *  alors des bornes pendant le rendu, et la requête ne porte aucune année :
 *  elle ne dépend plus des bornes et part en même temps qu'elles.
 *
 *  Quand les bornes changent (une autre catégorie de données), la période
 *  réglée n'y tient plus : elle est remise à « toute la période », comme
 *  avant — mais pendant le rendu, sans image intermédiaire. */
export function usePeriodeChoisie(borneMin: number, borneMax: number) {
  const [choix, setChoix] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const cle = `${borneMin}|${borneMax}`;
  const [vue, setVue] = useState(cle);
  if (cle !== vue) {
    setVue(cle);
    if (choix.min !== null || choix.max !== null) setChoix({ min: null, max: null });
  }
  return {
    anneeMin: choix.min ?? borneMin,
    anneeMax: choix.max ?? borneMax,
    /** Les années réglées — null sur une borne : rien à envoyer au service. */
    choisieMin: choix.min, choisieMax: choix.max,
    /** Une borne atteinte ne « choisit » plus rien. */
    regler: (min: number, max: number) =>
      setChoix({ min: min === borneMin ? null : min, max: max === borneMax ? null : max }),
    remettre: () => setChoix({ min: null, max: null }),
  };
}
