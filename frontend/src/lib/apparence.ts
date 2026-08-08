"use client";
// Le schéma d'apparence de la plateforme — clair, sombre, ou celui du système.
//
// Pendant de mobile/src/lib/apparence.ts, avec les mêmes noms : les deux
// surfaces se lisent pareil. Le mécanisme, lui, diffère — le web n'a ni
// DynamicColorIOS ni feuilles de style à construire en double. Tout est déjà
// dans les variables CSS de globals.css ; il ne reste qu'à dire au document
// quel schéma appliquer.
//
// ── L'attribut est TOUJOURS posé ─────────────────────────────────────────────
// On aurait pu ne rien écrire en mode « système » et laisser la règle
// @media (prefers-color-scheme) faire le travail. Mais alors rien, dans le
// document, ne dit quel schéma est en vigueur — et le JavaScript qui doit le
// savoir (les graphes qui peignent sur un canevas, l'export PNG) en serait
// réduit à interroger matchMedia à chaque fois. On écrit donc toujours la
// valeur RÉSOLUE dans data-theme, et la préférence, elle, vit dans le stockage
// local. La règle @media reste en place : elle sert quand JavaScript est
// indisponible.

import { useEffect, useSyncExternalStore } from "react";
import { CLE_STOCKAGE } from "./apparenceAmorce";

export { CLE_STOCKAGE };

/** Ce que l'utilisateur a choisi. `systeme` = suivre le réglage de l'appareil. */
export type Schema = "clair" | "sombre" | "systeme";

const estSchema = (v: unknown): v is Schema =>
  v === "clair" || v === "sombre" || v === "systeme";

/** La préférence enregistrée, `systeme` par défaut. */
export function schemaChoisi(): Schema {
  if (typeof localStorage === "undefined") return "systeme";
  const v = localStorage.getItem(CLE_STOCKAGE);
  return estSchema(v) ? v : "systeme";
}

const systemeEnSombre = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Le schéma en vigueur, lu sur le document.
 *
 * Synchrone et sans état React : utilisable partout, y compris dans le code
 * impératif de d3 et dans les fonctions d'export.
 */
export const estSombreCourant = (): boolean =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

// ── Diffusion du changement ──────────────────────────────────────────────────
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

/** Applique un schéma : écrit la préférence, met le document à jour. */
export function appliquerSchema(schema: Schema) {
  if (typeof document === "undefined") return;
  if (schema === "systeme") localStorage.removeItem(CLE_STOCKAGE);
  else localStorage.setItem(CLE_STOCKAGE, schema);

  const sombre = schema === "systeme" ? systemeEnSombre() : schema === "sombre";
  const racine = document.documentElement;

  // Sans cette parenthèse, les transitions de couleur déclarées un peu partout
  // (boutons, cartes, chips) se déclenchent toutes en même temps : la page
  // entière ondule pendant un tiers de seconde au lieu de basculer d'un coup.
  racine.dataset.bascule = "";
  racine.dataset.theme = sombre ? "dark" : "light";
  requestAnimationFrame(() => requestAnimationFrame(() => delete racine.dataset.bascule));

  prevenir();
}

/** Le schéma suivant dans le cycle système → clair → sombre → système. */
export const schemaSuivant = (courant: Schema): Schema =>
  courant === "systeme" ? "clair" : courant === "clair" ? "sombre" : "systeme";

// ── Les crochets React ───────────────────────────────────────────────────────
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
};

/**
 * Vrai si la page est en mode sombre — et le composant se re-rend quand cela
 * change.
 *
 * Presque tout se recolore sans lui : les couleurs sont des variables CSS, et
 * c'est le navigateur qui tranche. Il est réservé à ce que CSS ne peut pas
 * atteindre — un canevas, une échelle de couleurs interpolée en JavaScript,
 * une palette de séries.
 *
 * Au premier rendu serveur, il vaut `false` : le serveur ne connaît pas le
 * réglage de l'appareil. La valeur réelle arrive à l'hydratation, d'où le
 * `false` en instantané serveur — sans quoi React signalerait une divergence.
 */
export function useSombre(): boolean {
  return useSyncExternalStore(abonner, estSombreCourant, () => false);
}

/**
 * La préférence enregistrée, suivie au fil de ses changements.
 *
 * Même précaution que useSombre : le serveur ne peut pas connaître le choix de
 * l'utilisateur, il rend donc « systeme », et la vraie valeur arrive à
 * l'hydratation. useSyncExternalStore est fait pour ce cas et n'y voit pas une
 * divergence.
 */
export function useSchema(): Schema {
  return useSyncExternalStore(abonner, schemaChoisi, () => "systeme" as Schema);
}

/**
 * À poser une fois : suit le réglage du système tant que l'utilisateur n'a rien
 * choisi. Sans cela, ouvrir la page de jour puis passer sa machine en sombre ne
 * changerait rien jusqu'au rechargement.
 */
export function useSuivreSysteme() {
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => { if (schemaChoisi() === "systeme") appliquerSchema("systeme"); };
    mq.addEventListener("change", surChangement);
    // Un autre onglet a pu changer la préférence : on s'aligne.
    const surStockage = (e: StorageEvent) => {
      if (e.key === CLE_STOCKAGE) appliquerSchema(schemaChoisi());
    };
    addEventListener("storage", surStockage);
    return () => {
      mq.removeEventListener("change", surChangement);
      removeEventListener("storage", surStockage);
    };
  }, []);
}
