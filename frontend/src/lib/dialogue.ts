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

/** Verrous de défilement en cours, et l'état du corps avant le premier. */
let verrous = 0;
let avant = { corps: "", racine: "", paddingRight: "" };

export function useDialogue(actif: boolean, etiquette?: string) {
  const ref = useRef<HTMLDivElement>(null);

  // ── Le fond ne bouge pas ────────────────────────────────────────────────
  // Une fiche ouverte, la molette faisait défiler la page DERRIÈRE elle : au
  // moment de fermer, on ne retrouvait plus l'endroit d'où l'on venait. Le
  // défilement du document est gelé tant qu'une surface modale est ouverte.
  //
  // Le compteur est global : deux fiches superposées (une fiche ouverte
  // depuis une autre) posent chacune leur verrou, et c'est la FERMETURE DE LA
  // DERNIÈRE qui rend le défilement — sinon la première refermée le rendrait
  // alors qu'une modale est encore à l'écran.
  //
  // La largeur de l'ascenseur est reportée en marge : le masquer sans
  // compenser élargit la page de ~15 px, et tout son contenu sursaute au
  // moment précis où la fiche s'ouvre.
  useEffect(() => {
    if (!actif) return;
    const corps = document.body, racine = document.documentElement;
    if (verrous === 0) {
      const ascenseur = window.innerWidth - racine.clientWidth;
      avant = { corps: corps.style.overflow, racine: racine.style.overflow, paddingRight: corps.style.paddingRight };
      // Les DEUX : selon la page, l'ascenseur appartient à <body> ou à
      // <html>. Ne geler que <body> laissait l'accueil défiler sous la
      // fiche — mesuré, 75 px à la molette.
      corps.style.overflow = "hidden";
      racine.style.overflow = "hidden";
      if (ascenseur > 0) corps.style.paddingRight = `${ascenseur}px`;
    }
    verrous++;
    return () => {
      verrous = Math.max(0, verrous - 1);
      if (verrous === 0) {
        corps.style.overflow = avant.corps;
        racine.style.overflow = avant.racine;
        corps.style.paddingRight = avant.paddingRight;
      }
    };
  }, [actif]);

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
