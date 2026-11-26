"use client";

/**
 * Les données d'une page, demandées dès qu'on s'apprête à l'ouvrir.
 *
 * POURQUOI. Une page s'affiche tout de suite, mais ses chiffres arrivent
 * après : le navigateur ne les demande qu'une fois la page ouverte, et
 * certaines requêtes en attendent d'autres (la liste des pays, puis les
 * données du Sénégal). Sur une liaison ordinaire, cela fait entre un quart de
 * seconde et une seconde de cartes grises à chaque première ouverture. Or le
 * pointeur s'arrête sur un lien bien avant le clic — deux à trois dixièmes de
 * seconde, souvent davantage dans un menu. Ce temps suffit : les données sont
 * demandées au survol, et la page s'ouvre complète.
 *
 * COMMENT, SANS LISTE À TENIR. Tenir à la main « ce que chaque page demande »
 * serait faux à la première évolution d'une page. On le RELÈVE : pendant les
 * deux premières secondes d'une page, chaque ressource à laquelle elle
 * s'abonne est notée sous son adresse. La fois suivante — dans une autre
 * session comprise, la note est gardée par le navigateur —, le survol d'un
 * lien vers cette adresse redemande ces mêmes ressources. Le relevé se refait
 * à chaque visite : une page qui change de requêtes est suivie sans qu'on y
 * pense, et une première visite se passe simplement comme avant.
 *
 * CE QUI N'EST PAS RELEVÉ : l'administration, qui relit toujours la base, et
 * la page Prospects — rien de ce qui la concerne n'est noté dans le
 * navigateur. Seules trois familles de ressources sont rejouées, celles dont
 * la clé EST l'adresse : les données (lib/donnees), la première page des
 * listes (lib/listePaginee) et les référentiels (lib/referentiels).
 *
 * Le préchargement passe par le cache des données : une ressource encore
 * fraîche n'est pas redemandée, et une requête déjà en vol est partagée.
 */

import type { QueryClient } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { requeteDonnees } from "@/lib/donnees";
import { requetePremierePage } from "@/lib/listePaginee";
import { estReferentiel, requeteRef } from "@/lib/referentiels";

type Demande = ["donnees" | "liste-paginee" | "ref", string];

const CLE_STOCKAGE = "apix:donnees-initiales:v1";
const FENETRE_MS = 2000;     // ce qu'une page demande à son ouverture, pas ce qu'on y fait ensuite
const MAX_PAR_PAGE = 30;
const MAX_PAGES = 60;
const INTENTION_MS = 65;     // le pointeur doit s'arrêter : le survol en passant ne demande rien

const exclue = (chemin: string) => chemin.startsWith("/admin") || chemin.startsWith("/prospects")
  || chemin.startsWith("/login") || chemin.startsWith("/register");

/** L'adresse d'une page, paramètres triés : « /ide?section=projetes ». */
function clePage(chemin: string, recherche: string): string {
  const p = new URLSearchParams(recherche);
  p.sort();
  const qs = p.toString();
  return qs ? `${chemin}?${qs}` : chemin;
}

function lire(): Record<string, Demande[]> {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) || "{}");
    return brut && typeof brut === "object" ? brut : {};
  } catch { return {}; }
}

function ecrire(releves: Record<string, Demande[]>) {
  try {
    const cles = Object.keys(releves);
    // Les plus anciennes pages sortent quand la note grossit trop.
    for (const c of cles.slice(0, Math.max(0, cles.length - MAX_PAGES))) delete releves[c];
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(releves));
  } catch { /* stockage indisponible (navigation privée) : on s'en passe */ }
}

/** Une ressource que l'on sait redemander à l'identique. */
function demandeDe(cle: readonly unknown[]): Demande | null {
  const [famille, cible] = cle;
  if (typeof cible !== "string") return null;
  if (famille === "ref") return estReferentiel(cible) ? ["ref", cible] : null;
  if (famille !== "donnees" && famille !== "liste-paginee") return null;
  // Uniquement notre API, ou un fichier du site (le fond de carte).
  return cible.startsWith(API_BASE) || cible.startsWith("/") ? [famille, cible] : null;
}

// La note, partagée par le relevé et par le survol. Lue une fois, au premier
// besoin — jamais sur le serveur.
let releves: Record<string, Demande[]> | null = null;
const note = () => (releves ??= lire());

/**
 * Le relevé : ce à quoi chaque page s'abonne pendant ses deux premières
 * secondes. À installer DÈS LA CRÉATION du client de données — les
 * abonnements de la première page se font avant les effets de la racine, et
 * un relevé installé là les manquerait tous.
 */
export function installerReleve(client: QueryClient): void {
  if (typeof window === "undefined") return;
  let chemin = window.location.pathname;
  let page: string | null = null;        // la page en cours de relevé
  let arrivee = 0;
  let enCours = new Map<string, Demande>();
  let minuterie: ReturnType<typeof setTimeout> | null = null;

  const clore = () => {
    if (minuterie) { clearTimeout(minuterie); minuterie = null; }
    if (page && enCours.size) {
      const r = note();
      delete r[page];                      // réinscrite en dernier : la plus récente
      r[page] = [...enCours.values()].slice(0, MAX_PAR_PAGE);
      ecrire(r);
    }
    page = null;
  };
  const ouvrir = () => {
    clore();
    chemin = window.location.pathname;
    if (exclue(chemin)) return;
    page = clePage(chemin, window.location.search);
    arrivee = performance.now();
    enCours = new Map();
    minuterie = setTimeout(clore, FENETRE_MS);
  };
  ouvrir();   // la page sur laquelle on arrive

  client.getQueryCache().subscribe(evenement => {
    if (evenement.type !== "observerAdded") return;
    // Un autre chemin : une nouvelle page s'ouvre. L'adresse est déjà la
    // sienne à cet instant — les abonnements se font après l'écriture de
    // l'adresse par le routeur.
    if (window.location.pathname !== chemin) ouvrir();
    if (!page || performance.now() - arrivee > FENETRE_MS) return;
    const d = demandeDe(evenement.query.queryKey);
    if (d) enCours.set(`${d[0]}|${d[1]}`, d);
  });
}

/**
 * Le préchargement : au survol (ou au focus, ou au toucher) d'un lien interne,
 * les données que sa page a demandées la dernière fois. À installer dans un
 * effet ; rend la fonction qui le retire.
 */
export function installerSurvol(client: QueryClient): () => void {
  const precharger = (href: string) => {
    let url: URL;
    try { url = new URL(href, window.location.origin); } catch { return; }
    if (url.origin !== window.location.origin || exclue(url.pathname)) return;
    for (const [famille, cible] of note()[clePage(url.pathname, url.search)] ?? []) {
      if (famille === "donnees") void client.prefetchQuery(requeteDonnees(cible));
      else if (famille === "liste-paginee") void client.prefetchInfiniteQuery(requetePremierePage(cible));
      else if (estReferentiel(cible)) void client.prefetchQuery(requeteRef(cible));
    }
  };

  let intention: ReturnType<typeof setTimeout> | null = null;
  let vise: Element | null = null;
  const lienDe = (cible: EventTarget | null) =>
    cible instanceof Element ? cible.closest("a[href^='/']") : null;
  const annuler = () => { if (intention) { clearTimeout(intention); intention = null; } vise = null; };
  const surSurvol = (e: Event) => {
    const lien = lienDe(e.target);
    if (!lien || lien === vise) return;
    annuler();
    vise = lien;
    const href = lien.getAttribute("href");
    if (href) intention = setTimeout(() => { intention = null; precharger(href); }, INTENTION_MS);
  };
  const surSortie = (e: Event) => {
    const lien = lienDe(e.target);
    // On ne quitte le lien que si le pointeur va ailleurs que dans le lien.
    if (lien && lien === vise && !lien.contains((e as MouseEvent).relatedTarget as Node | null)) annuler();
  };
  // Au clavier et au doigt, pas de survol : l'intention est déjà claire.
  const sansAttendre = (e: Event) => { const href = lienDe(e.target)?.getAttribute("href"); if (href) precharger(href); };

  document.addEventListener("mouseover", surSurvol, { passive: true });
  document.addEventListener("mouseout", surSortie, { passive: true });
  document.addEventListener("focusin", sansAttendre, { passive: true });
  document.addEventListener("touchstart", sansAttendre, { passive: true });

  return () => {
    annuler();
    document.removeEventListener("mouseover", surSurvol);
    document.removeEventListener("mouseout", surSortie);
    document.removeEventListener("focusin", sansAttendre);
    document.removeEventListener("touchstart", sansAttendre);
  };
}
