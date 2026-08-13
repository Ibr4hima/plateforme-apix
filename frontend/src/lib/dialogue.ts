"use client";

/**
 * Le contrat clavier d'une surface modale — LE hook commun aux 23 modales de
 * la plateforme.
 *
 * Trois manques, invisibles à la souris, rédhibitoires au clavier et au
 * lecteur d'écran :
 *  - Tab sortait de la modale et continuait dans la page recouverte ;
 *  - à l'ouverture, le focus restait sur le bouton déclencheur, sous le voile ;
 *  - à la fermeture, il était perdu (renvoyé au <body>), et l'utilisateur
 *    repartait du début de la page.
 *
 * Le hook pose les trois : piège de Tab (cycle premier ↔ dernier élément
 * focalisable), prise de focus à l'ouverture, restitution à l'élément
 * déclencheur à la fermeture. Échap reste l'affaire de useEchap, déjà en
 * place partout.
 *
 * Usage — étaler les propriétés sur le PANNEAU de la modale (pas le voile) :
 *
 *   const dial = useDialogue(open, "Fiche de l'entreprise");
 *   …
 *   <div {...dial} onClick={e => e.stopPropagation()} style={…}>
 *
 * `actif` compte pour les modales qui restent montées fermées (elles rendent
 * null) : le piège ne s'installe qu'ouvert. Passer une étiquette SEULEMENT si
 * la surface n'a pas de titre visible ; sinon, préférer aria-labelledby posé
 * par l'appelant.
 */

import { useEffect, useRef } from "react";

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogue(actif: boolean, etiquette?: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actif) return;
    const el = ref.current;
    if (!el) return;
    const declencheur = document.activeElement as HTMLElement | null;

    // Le panneau lui-même prend le focus (tabIndex −1) : le premier Tab part
    // du début de la modale, et un lecteur d'écran annonce le dialogue.
    el.focus({ preventScroll: true });

    const pieger = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Les éléments réellement atteignables — offsetParent écarte les cachés
      // (display:none), sauf l'élément déjà focalisé (position:fixed n'a pas
      // d'offsetParent).
      const focalisables = [...el.querySelectorAll<HTMLElement>(FOCALISABLES)]
        .filter(f => f.offsetParent !== null || f === document.activeElement);
      if (!focalisables.length) { e.preventDefault(); return; }
      const premier = focalisables[0], dernier = focalisables[focalisables.length - 1];
      const courant = document.activeElement;
      if (!el.contains(courant)) { e.preventDefault(); premier.focus(); }
      else if (e.shiftKey && (courant === premier || courant === el)) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && courant === dernier) { e.preventDefault(); premier.focus(); }
    };
    // En capture : les modales posent leurs propres onKeyDown, le piège doit
    // passer avant.
    document.addEventListener("keydown", pieger, true);
    return () => {
      document.removeEventListener("keydown", pieger, true);
      // Restitution — seulement si le déclencheur est encore dans la page.
      if (declencheur && document.contains(declencheur)) declencheur.focus({ preventScroll: true });
    };
  }, [actif]);

  return {
    ref,
    role: "dialog" as const,
    "aria-modal": true as const,
    tabIndex: -1,
    ...(etiquette ? { "aria-label": etiquette } : {}),
  };
}
