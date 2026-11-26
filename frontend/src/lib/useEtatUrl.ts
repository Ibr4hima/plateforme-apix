"use client";

// État synchronisé avec l'adresse (?cle=valeur) : les onglets et les vues des
// pages se partagent par lien et survivent au rafraîchissement.
//
// L'ADRESSE EST LUE AU PREMIER RENDU, PAS APRÈS. L'état partait de sa valeur
// par défaut, et un effet le corrigeait une fois la page affichée : arriver sur
// « /ide?section=projetes » montrait donc un instant les investissements
// RÉALISÉS — chiffres et graphes compris, quand ils étaient en mémoire — avant
// de basculer. C'était le clignotement le plus visible de la plateforme, et il
// lançait au passage les requêtes de l'onglet qu'on ne regardait pas.
//
// `useSearchParams` donne l'adresse de DESTINATION dès le rendu qui ouvre la
// page — `window.location`, lui, porte encore l'adresse quittée à ce
// moment-là : Next ne l'écrit qu'à la validation du rendu. Contrepartie : une
// page qui l'emploie ne se prérend plus à la construction ; la limite Suspense
// de TransitionPage sert sa barre de titre en attendant (AttentePage).
//
// L'ADRESSE FAIT FOI. Si elle change sans passer par `changer` — un lien du
// menu vers la même page, le bouton « précédent » du navigateur — l'état la
// suit, au lieu de rester sur l'onglet d'avant sous une adresse qui en dit un
// autre. À l'inverse, le clic n'attend jamais l'adresse : l'onglet change tout
// de suite, l'adresse est réécrite dans la foulée.

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

/** La valeur de `cle` dans ces paramètres, si elle est admise ; sinon le défaut. */
export function lireParam<T extends string>(
  params: { get(cle: string): string | null }, cle: string, defaut: T, valides?: readonly T[],
): T {
  const v = params.get(cle) as T | null;
  return v && (!valides || valides.includes(v)) ? v : defaut;
}

/** Réécrit l'adresse sans navigation : `null` retire la clé. Les autres
    paramètres sont conservés. */
export function ecrireParams(valeurs: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search);
  for (const [cle, v] of Object.entries(valeurs)) {
    if (v === null || v === "") p.delete(cle); else p.set(cle, v);
  }
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

/** Les paramètres de l'adresse tels qu'ils étaient À L'OUVERTURE de la page :
    lus au premier rendu, figés ensuite. Pour les écrans qui portent beaucoup
    d'état dans l'adresse (filtres d'une vue, adresse de retour d'un rapport) et
    l'initialisent d'un coup, sans effet de reprise après l'affichage. */
export function useAdresseInitiale(): URLSearchParams {
  const params = useSearchParams();
  const [initiale] = useState(() => new URLSearchParams(params.toString()));
  return initiale;
}

export function useEtatUrl<T extends string>(
  cle: string,
  defaut: T,
  valides?: readonly T[],
): [T, (v: T) => void] {
  const params = useSearchParams();
  const dansAdresse = lireParam(params, cle, defaut, valides);
  // `valeur` : ce que l'écran montre — elle change AU CLIC, sans attendre que
  // l'adresse suive. `adresse` : la dernière valeur vue dans l'adresse.
  // `attendues` : nos propres écritures que l'adresse n'a pas encore reflétées.
  const [etat, setEtat] = useState<{ valeur: T; adresse: T; attendues: T[] }>(
    () => ({ valeur: dansAdresse, adresse: dansAdresse, attendues: [] }));

  // L'adresse a bougé depuis le dernier rendu — décidé pendant le rendu, sans
  // effet, donc sans image intermédiaire. Deux cas à ne pas confondre :
  //  · l'ÉCHO d'une de nos écritures, qui arrive un instant après le clic. Si
  //    l'on a déjà cliqué ailleurs entre-temps, l'adopter ramènerait l'écran
  //    un cran en arrière le temps d'une image ;
  //  · une navigation VENUE D'AILLEURS (un lien du menu vers la même page) :
  //    celle-là, l'état la suit.
  if (dansAdresse === etat.valeur) {
    if (etat.adresse !== dansAdresse || etat.attendues.length)
      setEtat({ valeur: etat.valeur, adresse: dansAdresse, attendues: [] });
  } else if (dansAdresse !== etat.adresse) {
    const rang = etat.attendues.indexOf(dansAdresse);
    setEtat(rang >= 0
      ? { valeur: etat.valeur, adresse: dansAdresse, attendues: etat.attendues.slice(rang + 1) }
      : { valeur: dansAdresse, adresse: dansAdresse, attendues: [] });
  }

  const changer = useCallback((v: T) => {
    setEtat(e => e.valeur === v ? e : { valeur: v, adresse: e.adresse, attendues: [...e.attendues, v] });
    ecrireParams({ [cle]: v === defaut ? null : v });
  }, [cle, defaut]);

  return [etat.valeur, changer];
}
