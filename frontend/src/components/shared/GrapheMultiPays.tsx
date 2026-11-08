"use client";

// ── Le graphe des séries annuelles — un seul dessin pour toute la plateforme ──
// Tableau de bord, Fiche Pays, IDE (pays, monde, secteurs, national),
// Statistiques, Commerce extérieur, rapports.
//
// LE DESSIN, sur le modèle de la vedette de l'accueil :
//  - une courbe nette de 2 px, en segments droits : une année est un point
//    mesuré, et un lissage inventait ce qui se passe entre deux mesures ;
//  - sous une courbe seule, un lavis de sa couleur qui s'efface vers la base :
//    un simple dégradé. L'ancienne trame demi-teinte (motif, masque flouté,
//    filtre) était la peinture la plus chère des pages qui en portaient huit ;
//  - une grille de filets pleins très clairs, des graduations grises écrites en
//    entier sous 10 000, la ligne de zéro un cran plus marquée ;
//  - le dernier point marqué, sa valeur écrite au bout de la courbe ; quand
//    deux étiquettes se chevauchent, elles s'écartent, reliées à leur point ;
//  - au survol, un filet vertical aimanté à l'année, un point par série et une
//    infobulle sombre : l'année, la valeur, la variation sur l'année d'avant ;
//  - des barres fines (24 px au plus), arrondies à leur bout, carrées sur la
//    ligne de base, séparées de 2 px.
//
// DES ORDRES DE GRANDEUR DIFFÉRENTS — le Sénégal et les États-Unis, un flux et
// un stock : sur une échelle commune, la petite série s'aplatissait jusqu'à
// disparaître. L'ancien remède, un second axe à droite, trompait : l'accord
// entre deux échelles est arbitraire, il fabrique des croisements qui
// n'existent pas, et au-delà de deux séries les suivantes n'avaient plus
// d'axe du tout. Quand les amplitudes s'écartent de plus d'un facteur 5,
// chaque série reçoit son panneau et son échelle (petits multiples), sur les
// mêmes années ; une bascule « Même échelle / Une échelle par série » ramène
// à la comparaison directe des niveaux.
//
// Rendu STATIQUE : aucune animation d'entrée (elle rejouait à chaque
// redimensionnement), et un nouveau dessin seulement quand les données ou la
// largeur changent — pas à chaque rendu de la page qui le porte.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Selection } from "d3";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { fmtCompact } from "@/lib/format";
import { showD3Tooltip as montrerTooltip, hideD3Tooltip as cacherTooltip } from "@/components/charts/outilsTooltip";

type Point = { annee: number; valeur: number | null };
type PointValide = { annee: number; valeur: number };
export type SerieGraphe = {
  nom: string;
  couleur: string;
  data: Point[];
  /** Motif de tiret (ex. "6,4") : une courbe de référence, sans aire ni point. */
  dash?: string;
  /** Forcer / retirer le lavis sous la courbe (par défaut : sous une courbe seule). */
  aire?: boolean;
};
/** « auto » : une échelle par série dès que les amplitudes divergent. */
export type EchelleGraphe = "auto" | "commune" | "separee";

/** Au-delà de ce rapport entre amplitudes, une échelle commune écrase la petite série. */
const ECART_AMPLITUDES = 5;

const estValide = (d: Point): d is PointValide => d.valeur !== null && Number.isFinite(d.valeur);
const valides = (s: SerieGraphe): PointValide[] => s.data.filter(estValide).sort((a, b) => a.annee - b.annee);

/** Les séries ont-elles des ordres de grandeur trop éloignés pour une même échelle ? */
export function echellesDivergent(series: SerieGraphe[]): boolean {
  const amplitudes = series
    .map(s => s.data.filter(estValide).reduce((m, d) => Math.max(m, Math.abs(d.valeur)), 0))
    .filter(a => a > 0);
  return amplitudes.length > 1 && Math.max(...amplitudes) / Math.min(...amplitudes) > ECART_AMPLITUDES;
}

/** Les graduations d'un axe : en entier sous 10 000 (0 / 2 000 / 4 000), avec
    autant de décimales que le pas en demande — l'ancien format arrondissait
    9,8 / 9,9 / 10,0 en « 10 / 10 / 10 » ; au-delà, en abrégé, chaque
    graduation dans son unité (200 k, 1 M, 1,5 M, 8 000 Md) plutôt qu'en
    fractions d'une unité trop grande (0,2M). */
function formateurGraduations(ticks: number[]): (v: number) => string {
  const max = Math.max(0, ...ticks.map(t => Math.abs(t)));
  const pas = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : (max || 1);
  const moins = (s: string) => s.replace("-", "−");
  if (max < 1e4) {
    const dec = pas >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(pas) - 1e-9));
    return v => (Math.abs(v) < pas * 1e-9 ? "0" : moins(v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec })));
  }
  return v => {
    const a = Math.abs(v);
    if (a < pas * 1e-9) return "0";
    const [div, suffixe] = a >= 1e9 ? [1e9, "Md"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "k"] : [1, ""];
    const s = moins((v / div).toLocaleString("fr-FR", { maximumFractionDigits: 2 }));
    return suffixe ? `${s} ${suffixe}` : s;
  };
}

/** Les années écrites sous l'axe : des multiples ronds (2000, 2005…), douze
    au plus, que la largeur laisse tenir ; la première et la dernière année
    toujours écrites — elles disent la période. En vignette, seulement ces
    deux-là. Sur une courbe, l'axe est CONTINU : des années manquantes dans les
    données (2014, 2015, puis 2020) ne serrent plus deux étiquettes l'une
    contre l'autre. Sous des barres, seules les années présentes ont une place. */
function graduationsAnnees(xs: number[], largeur: number, vignette: boolean, continu: boolean): number[] {
  if (xs.length <= 2) return xs;
  const premier = xs[0], dernier = xs[xs.length - 1];
  if (vignette) return [premier, dernier];
  const maxN = Math.max(2, Math.min(12, Math.floor(largeur / 62)));
  const candidats = continu ? Array.from({ length: dernier - premier + 1 }, (_, i) => premier + i) : xs;
  if (candidats.length <= maxN) return candidats;
  const pas = [1, 2, 5, 10, 20, 25, 50, 100].find(p => Math.floor((dernier - premier) / p) + 1 <= maxN - 1) ?? 100;
  const t = candidats.filter(v => v % pas === 0);
  // Les bornes s'ajoutent aux multiples ronds quand il reste la place d'une
  // étiquette entre elles (≈ 52 px) ; sinon elles prennent leur place
  const parAn = largeur / Math.max(1, dernier - premier), place = 52;
  if (!t.length || (t[0] - premier) * parAn >= place) t.unshift(premier); else t[0] = premier;
  if ((dernier - t[t.length - 1]) * parAn >= place) t.push(dernier); else t[t.length - 1] = dernier;
  return [...new Set(t)];
}

/** Une barre : arrondie au bout (4 px), carrée sur la ligne de base. */
function cheminBarre(x: number, w: number, yBase: number, yVal: number, rayon = 4): string {
  const h = Math.abs(yVal - yBase);
  if (h < 0.5 || w <= 0) return "";
  const r = Math.min(rayon, w / 2, h);
  if (yVal < yBase) // vers le haut
    return `M${x},${yBase}V${yVal + r}A${r},${r} 0 0 1 ${x + r},${yVal}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${yVal + r}V${yBase}Z`;
  return `M${x},${yBase}V${yVal - r}A${r},${r} 0 0 0 ${x + r},${yVal}H${x + w - r}A${r},${r} 0 0 0 ${x + w},${yVal - r}V${yBase}Z`;
}

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const signe = (d: number) => (d > 0 ? "+" : d < 0 ? "−" : "");
const un = (v: number) => Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La variation d'une année sur la précédente, au sens statistique : un écart
    en points pour un taux, un taux de variation pour un niveau (seulement sur
    une base positive, où il a un sens). */
function variationTexte(prec: number, v: number, enPoints: boolean): string {
  if (enPoints) { const d = v - prec; return `${signe(d)}${un(d)} pt`; }
  if (!(prec > 0)) return "";
  const d = (v / prec - 1) * 100;
  return Number.isFinite(d) ? `${signe(d)}${un(d)} %` : "";
}

// Mise en page verticale (px)
const HAUT = 12;                                   // au-dessus de la zone de tracé
const AXE = 24, AXE_VIGNETTE = 20;                 // bande des années
const TETE = 22, TETE_VIGNETTE = 16;               // nom de la série, en petits multiples
const PANNEAU_MIN = 64, PANNEAU_MIN_VIGNETTE = 38; // hauteur de tracé d'un petit multiple
const ECART_COLONNES = 28;

export default function GrapheMultiPays({ series, height = 280, type = "line", fmt, fmtX, showDots = true, dualAxis, echelle, epure, variation, facteurAxe = 1 }: {
  series: SerieGraphe[];
  height?: number;
  type?: "line" | "bar";
  titre?: string;
  fmt?: (v: number | null) => string;
  /** Libellé de l'axe X et des infobulles (défaut : l'année telle quelle) —
      permet un axe mensuel en passant x = numéro de mois. */
  fmtX?: (x: number) => string;
  /** Points sur les séries courtes (12 valeurs au plus). */
  showDots?: boolean;
  /** Conservé pour les appels existants : l'épaisseur suit désormais le dessin commun. */
  lineWidth?: number;
  /** false = l'échelle commune par défaut (séries de même nature). */
  dualAxis?: boolean;
  echelle?: EchelleGraphe;
  /** Vignette : seules la première et la dernière année en abscisse, pas
      d'étiquette de fin. Par défaut, déduit de la hauteur (moins de 200 px). */
  epure?: boolean;
  /** Variation de l'infobulle : en points (taux) ou en taux de variation.
      Par défaut, en points quand la valeur formatée finit par « % ». */
  variation?: "points" | "taux";
  /** Les graduations de l'axe lisent la valeur multipliée par ce facteur —
      pour des données stockées en millions (1e6) : l'axe écrit alors
      « 8 000 Md », comme les étiquettes, et non « 8 M » de millions. */
  facteurAxe?: number;
}) {
  const pret = useD3Pret();
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Les defs SVG (dégradés) se résolvent à l'échelle du document : un
  // identifiant propre à chaque graphe évite toute collision
  const uid = `g${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const fmtV = fmt || fmtCompact;

  // Les pages recréent leurs séries et leurs formateurs à chaque rendu : le
  // graphe se redessine sur leur CONTENU, pas sur leur identité
  const signatureSeries = useMemo(() => JSON.stringify(series.map(s => [s.nom, s.couleur, s.dash ?? "", s.aire ?? "", s.data])), [series]);
  const signatureFmt = `${fmtV(1234.5678)}|${fmtV(-0.0456)}|${fmtV(98765432.1)}|${fmtX ? fmtX(3) : ""}`;
  const courant = useRef({ series, fmtV, fmtX });
  useEffect(() => { courant.current = { series, fmtV, fmtX }; });

  const visibles = useMemo(() => series.filter(s => s.data.some(estValide)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signatureSeries]);
  const divergent = useMemo(() => echellesDivergent(visibles), [visibles]);
  const vignette = epure ?? height < 200;
  const parDefaut: "commune" | "separee" = echelle === "commune" || echelle === "separee" ? echelle
    : dualAxis === false && echelle !== "auto" ? "commune" : divergent ? "separee" : "commune";
  const [choix, setChoix] = useState<"commune" | "separee" | null>(null);
  const separee = visibles.length > 1 && (choix ?? parDefaut) === "separee";
  const avecBascule = !vignette && visibles.length > 1 && (divergent || choix !== null);

  // Petits multiples : un panneau par série, deux colonnes dès trois séries
  const nPanneaux = separee ? visibles.length : 1;
  const colonnes = separee && nPanneaux >= 3 ? 2 : 1;
  const rangees = Math.ceil(nPanneaux / colonnes);
  const tete = separee ? (vignette ? TETE_VIGNETTE : TETE) : 0;
  const axe = vignette ? AXE_VIGNETTE : AXE;
  const hauteur = separee
    ? Math.max(height, HAUT + rangees * (tete + axe + (vignette ? PANNEAU_MIN_VIGNETTE : PANNEAU_MIN)))
    : height;

  const draw = useCallback((W: number) => {
    const el = ref.current;
    if (!pret || !el || W <= 0) return;
    const { fmtV, fmtX } = courant.current;
    const fmtXv = fmtX || ((x: number) => String(x));
    const svg = d3.select(el);
    svg.selectAll("*").remove();
    if (!visibles.length) return;
    const H = hauteur;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const pts = visibles.map(valides);
    const annees = [...new Set(pts.flat().map(p => p.annee))].sort((a, b) => a - b);
    const nS = visibles.length;
    const barres = type === "bar";
    // Les séries de chaque panneau (un seul panneau en échelle commune)
    const groupes: number[][] = separee ? visibles.map((_, i) => [i]) : [visibles.map((_, i) => i)];

    // ── Mesure des étiquettes (police réelle de la page) ──
    const police = getComputedStyle(el).fontFamily || "sans-serif";
    const ctx = document.createElement("canvas").getContext("2d");
    const largeurTexte = (t: string, taille: number, graisse = 400) => {
      if (!ctx) return t.length * taille * 0.56;
      ctx.font = `${graisse} ${taille}px ${police}`;
      return ctx.measureText(t).width;
    };
    const tailleGrad = vignette ? 10 : 10.5;

    // ── Panneaux : position verticale, échelle Y ──
    const hTrace = (H - HAUT - rangees * (tete + axe)) / rangees;
    const nbGrad = separee ? (hTrace < 60 ? 2 : 3) : vignette ? 3 : 4;
    const ys = groupes.map((idx, k) => {
      const rangee = Math.floor(k / colonnes);
      const haut = HAUT + rangee * (tete + hTrace + axe) + tete;
      const vals = idx.flatMap(i => pts[i].map(p => p.valeur));
      let mn = Math.min(...vals), mx = Math.max(...vals);
      if (barres) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
      else {
        // Une série positive qui s'approche de zéro part de zéro : l'axe ne
        // grossit pas un écart de quelques pour cent en précipice
        if (mn > 0 && mn <= mx * 0.35) mn = 0;
        if (mx < 0 && mx >= mn * 0.35) mx = 0;
      }
      if (mn === mx) { const d = Math.abs(mn) * 0.1 || 1; mn -= d; mx += d; }
      return d3.scaleLinear().domain([mn, mx]).nice(nbGrad).range([haut + hTrace, haut]);
    });
    const grads = ys.map(y => y.ticks(nbGrad));
    const formats = grads.map(g => { const f = formateurGraduations(g.map(t => t * facteurAxe)); return (v: number) => f(v * facteurAxe); });

    // Marge gauche : la plus large graduation, mesurée — partagée par les
    // panneaux, qui restent alignés
    const mGauche = Math.round(Math.max(26, ...grads.flatMap((g, k) => g.map(t => largeurTexte(formats[k](t), tailleGrad)))) + 10);
    // Marge droite : la plus large valeur de fin de courbe
    const etiquettesFin = !barres && !vignette && W >= 420;
    const dernieres = pts.map(p => p[p.length - 1]);
    const mDroite = etiquettesFin
      ? Math.round(Math.max(...visibles.map((s, i) => s.dash || !dernieres[i] ? 0 : largeurTexte(fmtV(dernieres[i].valeur), 11, 600)))) + 22
      : vignette ? 12 : 16;

    // ── Panneaux : position horizontale, échelle X (une par colonne) ──
    const largeurColonne = (W - ECART_COLONNES * (colonnes - 1)) / colonnes;
    const colonne = (k: number) => k % colonnes;
    const bornesX = (c: number): [number, number] => {
      const x0 = c * (largeurColonne + ECART_COLONNES);
      return [x0 + mGauche, x0 + largeurColonne - mDroite];
    };
    const domaineX: [number, number] = annees.length > 1 ? [annees[0], annees[annees.length - 1]] : [annees[0] - 1, annees[0] + 1];
    const xLin = Array.from({ length: colonnes }, (_, c) => d3.scaleLinear().domain(domaineX).range(bornesX(c)));
    const xBand = Array.from({ length: colonnes }, (_, c) => d3.scaleBand<number>().domain(annees).range(bornesX(c)).paddingInner(0.24).paddingOuter(0.12));
    const xDe = (c: number, a: number) => barres ? (xBand[c](a) ?? 0) + xBand[c].bandwidth() / 2 : xLin[c](a);

    const defs = svg.append("defs");

    // ── Grille et graduations ──
    groupes.forEach((_, k) => {
      const y = ys[k], [x0, x1] = bornesX(colonne(k));
      const g = svg.append("g");
      grads[k].forEach(t => {
        const yy = Math.round(y(t)) + 0.5;
        g.append("line").attr("x1", x0).attr("x2", x1).attr("y1", yy).attr("y2", yy)
          .style("stroke", t === 0 ? "var(--bordure-forte)" : "var(--grille)").attr("stroke-width", 1);
        g.append("text").attr("x", x0 - 8).attr("y", yy).attr("dy", "0.32em").attr("text-anchor", "end")
          .attr("font-size", tailleGrad).style("fill", "var(--gris)").style("font-variant-numeric", "tabular-nums")
          .text(formats[k](t));
      });
      // La ligne de zéro, quand les valeurs la traversent sans qu'une graduation y tombe
      const [d0, d1] = y.domain();
      if (d0 < 0 && d1 > 0 && !grads[k].includes(0)) {
        const yz = Math.round(y(0)) + 0.5;
        g.append("line").attr("x1", x0).attr("x2", x1).attr("y1", yz).attr("y2", yz).style("stroke", "var(--bordure-forte)").attr("stroke-width", 1);
      }
    });

    // ── Petits multiples : le nom de la série au-dessus de son panneau ──
    if (separee) groupes.forEach((idx, k) => {
      const s = visibles[idx[0]];
      const [x0] = bornesX(colonne(k));
      const yNom = ys[k].range()[1] - (vignette ? 6 : 9);
      if (barres) svg.append("rect").attr("x", x0 - mGauche + 2).attr("y", yNom - 7).attr("width", 8).attr("height", 8).attr("rx", 2).style("fill", s.couleur);
      else svg.append("line").attr("x1", x0 - mGauche + 2).attr("x2", x0 - mGauche + 14).attr("y1", yNom - 3.5).attr("y2", yNom - 3.5)
        .style("stroke", s.couleur).attr("stroke-width", 3).attr("stroke-linecap", "round");
      svg.append("text").attr("x", x0 - mGauche + (barres ? 16 : 20)).attr("y", yNom).attr("font-size", vignette ? 10.5 : 11.5).attr("font-weight", 600)
        .style("fill", "var(--texte)").text(s.nom);
    });

    // ── Barres ──
    const parAnnee = new Map<number, Selection<SVGGElement, unknown, null, undefined>>();
    if (barres) {
      annees.forEach(a => parAnnee.set(a, svg.append("g")));
      groupes.forEach((idx, k) => {
        const c = colonne(k), bande = xBand[c].bandwidth(), y = ys[k];
        const n = idx.length, ecart = n > 1 ? 2 : 0;
        const wB = Math.max(1, Math.min(24, (bande - ecart * (n - 1)) / n));
        const wG = wB * n + ecart * (n - 1);
        idx.forEach((i, pos) => pts[i].forEach(d => {
          const x = (xBand[c](d.annee) ?? 0) + (bande - wG) / 2 + pos * (wB + ecart);
          const chemin = cheminBarre(x, wB, y(0), y(d.valeur));
          if (chemin) parAnnee.get(d.annee)!.append("path").attr("d", chemin).style("fill", visibles[i].couleur);
        }));
      });
    }

    // ── Courbes ──
    if (!barres) {
      const epaisseur = !separee && nS >= 3 ? 1.75 : 2;
      groupes.forEach((idx, k) => {
        const c = colonne(k), y = ys[k], x = xLin[c];
        const seule = idx.length === 1;
        idx.forEach(i => {
          const s = visibles[i], p = pts[i];
          const pointille = !!s.dash;
          if ((s.aire ?? (seule && !pointille)) && p.length > 1) {
            const gid = `${uid}-a${i}`;
            const grad = defs.append("linearGradient").attr("id", gid).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
            grad.append("stop").attr("offset", "0%").style("stop-color", s.couleur).attr("stop-opacity", 0.16);
            grad.append("stop").attr("offset", "100%").style("stop-color", s.couleur).attr("stop-opacity", 0.015);
            const [d0, d1] = y.domain();
            const base = y(Math.min(Math.max(0, d0), d1));
            svg.append("path").style("fill", `url(#${gid})`).style("pointer-events", "none")
              .attr("d", d3.area<PointValide>().x(d => x(d.annee)).y0(base).y1(d => y(d.valeur))(p) || "");
          }
          svg.append("path").style("fill", "none").style("stroke", s.couleur)
            .attr("stroke-width", pointille ? 1.5 : epaisseur).attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
            .attr("stroke-dasharray", s.dash || null)
            .attr("d", d3.line<PointValide>().x(d => x(d.annee)).y(d => y(d.valeur))(p) || "");
          if (pointille) return;
          // Une série courte se lit année par année : chaque mesure a son point
          // (pas au-delà de deux courbes sur un même panneau : les points s'y emmêlent)
          if (showDots && idx.length <= 2 && p.length > 1 && p.length <= 12)
            p.slice(0, -1).forEach(d => svg.append("circle").attr("cx", x(d.annee)).attr("cy", y(d.valeur)).attr("r", 2.75)
              .style("fill", s.couleur).style("stroke", "var(--carte)").attr("stroke-width", 1.5));
          const f = p[p.length - 1];
          svg.append("circle").attr("cx", x(f.annee)).attr("cy", y(f.valeur)).attr("r", 3.75)
            .style("fill", s.couleur).style("stroke", "var(--carte)").attr("stroke-width", 2);
        });

        // La valeur au bout de chaque courbe. Deux étiquettes trop proches
        // s'écartent — sans quitter le panneau —, et un trait fin relie
        // celle qui a bougé à son point.
        if (!etiquettesFin) return;
        const items = idx.filter(i => !visibles[i].dash && dernieres[i]).map(i => {
          const f = dernieres[i];
          return { x: x(f.annee), yPoint: y(f.valeur), y: y(f.valeur), texte: fmtV(f.valeur) };
        }).sort((a, b) => a.y - b.y);
        const PAS = 14, [bas, haut] = y.range();
        for (let j = 1; j < items.length; j++) if (items[j].y - items[j - 1].y < PAS) items[j].y = items[j - 1].y + PAS;
        const debord = items.length ? items[items.length - 1].y - bas : 0;
        if (debord > 0) items.forEach(it => { it.y -= debord; });
        items.forEach(it => { it.y = Math.max(haut - 4, it.y); });
        items.forEach(it => {
          const xT = it.x + 10;
          if (Math.abs(it.y - it.yPoint) > 3)
            svg.append("path").attr("d", `M${it.x + 5},${it.yPoint}L${xT - 3},${it.y}`)
              .style("fill", "none").style("stroke", "var(--bordure-forte)").attr("stroke-width", 1);
          svg.append("text").attr("x", xT).attr("y", it.y).attr("dy", "0.32em")
            .attr("font-size", 11).attr("font-weight", 600).style("fill", "var(--encre)").style("font-variant-numeric", "tabular-nums")
            .text(it.texte);
        });
      });
    }

    // ── Années ──
    groupes.forEach((_, k) => {
      // Sous le dernier panneau de chaque colonne
      if (k + colonnes < groupes.length) return;
      const c = colonne(k), [x0, x1] = bornesX(c);
      const yA = ys[k].range()[0] + (vignette ? 14 : 17);
      const tg = graduationsAnnees(annees, x1 - x0, vignette || colonnes > 1, !barres);
      tg.forEach((a, j) => {
        const x = xDe(c, a);
        const larg = largeurTexte(fmtXv(a), tailleGrad);
        const ancre = j === tg.length - 1 && x + larg / 2 > x1 + mDroite ? "end" : j === 0 && x - larg / 2 < x0 - mGauche ? "start" : "middle";
        svg.append("text").attr("x", x).attr("y", yA).attr("text-anchor", ancre).attr("font-size", tailleGrad)
          .style("fill", "var(--gris)").style("font-variant-numeric", "tabular-nums").text(fmtXv(a));
      });
    });

    // ── Survol : filet aimanté à l'année, un point par série, l'infobulle ──
    const tooltip = d3.select<HTMLDivElement, unknown>("#d3-tooltip");
    const gCurseur = svg.append("g").style("display", "none").style("pointer-events", "none");
    const filets = groupes.map((_, k) => gCurseur.append("line")
      .attr("y1", ys[k].range()[1]).attr("y2", ys[k].range()[0])
      .style("stroke", "rgb(var(--encre-rgb) / 0.22)").attr("stroke-width", 1));
    const marques = barres ? [] : visibles.map(s => gCurseur.append("circle").attr("r", 4.25)
      .style("fill", s.couleur).style("stroke", "var(--carte)").attr("stroke-width", 2));
    const panneauDe = (i: number) => (separee ? i : 0);
    const exemple = pts.flat()[0]?.valeur ?? 1;
    const enPoints = variation ? variation === "points" : /%\s*$/.test(fmtV(exemple));
    const precedente = (p: PointValide[], j: number) => (j > 0 && p[j - 1].annee === p[j].annee - 1 ? p[j - 1].valeur : null);

    let visee: number | null = null;
    const viser = (ev: PointerEvent) => {
      const [mx] = d3.pointer(ev, el);
      const c = colonnes > 1 && mx > largeurColonne + ECART_COLONNES / 2 ? 1 : 0;
      let a = annees[0];
      for (const an of annees) if (Math.abs(xDe(c, an) - mx) < Math.abs(xDe(c, a) - mx)) a = an;
      if (a !== visee) {
        visee = a;
        gCurseur.style("display", null);
        groupes.forEach((_, k) => { const x = xDe(colonne(k), a); filets[k].attr("x1", x).attr("x2", x); });
        parAnnee.forEach((g, an) => g.attr("opacity", an === a ? 1 : 0.42));
        const lignes: string[] = [];
        let avecVariation = false;
        for (let i = 0; i < nS; i++) {
          const s = visibles[i], p = pts[i], j = p.findIndex(d => d.annee === a);
          const marque = marques[i];
          if (j < 0) { marque?.style("display", "none"); continue; }
          const v = p[j].valeur, k = panneauDe(i);
          marque?.style("display", null).attr("cx", xDe(colonne(k), a)).attr("cy", ys[k](v));
          const prec = s.dash ? null : precedente(p, j);
          const vt = prec === null ? "" : variationTexte(prec, v, enPoints);
          if (vt) avecVariation = true;
          // La clé de couleur, éclaircie : sur le fond sombre de l'infobulle,
          // le bleu de tête se serait éteint
          const cle = nS > 1 ? `<span class="gt-cle${barres ? " est-barre" : ""}" style="background:color-mix(in srgb, ${s.couleur} 78%, white)"></span><span class="gt-nom">${echapper(s.nom)}</span>` : "";
          lignes.push(`<div class="gt-ligne">${cle}<span class="gt-val">${echapper(fmtV(v))}</span>${vt ? `<span class="gt-var">${vt}</span>` : ""}</div>`);
        }
        const pied = avecVariation ? `<div class="gt-pied">Variation par rapport à ${echapper(fmtXv(a - 1))}</div>` : "";
        montrerTooltip(tooltip, ev, `<div class="gt-titre">${echapper(fmtXv(a))}</div>${lignes.join("")}${pied}`);
      } else montrerTooltip(tooltip, ev);
    };
    const quitter = () => {
      visee = null;
      gCurseur.style("display", "none");
      parAnnee.forEach(g => g.attr("opacity", 1));
      cacherTooltip(tooltip);
    };
    svg.append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", H)
      .style("fill", "transparent")
      .on("pointermove", viser).on("pointerleave", quitter);
    // Les formateurs sont lus dans `courant` : leur signature redéclenche le dessin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, visibles, hauteur, type, separee, colonnes, rangees, tete, axe, vignette, showDots, variation, facteurAxe, uid, signatureFmt]);

  // Un dessin au montage et à chaque changement de données ; puis seulement
  // quand la LARGEUR change (le ResizeObserver signale aussi les hauteurs)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let largeur = -1, image = 0;
    const peindre = () => {
      const w = wrap.clientWidth;
      if (w === largeur) return;
      largeur = w;
      draw(w);
    };
    peindre();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(image); image = requestAnimationFrame(peindre); });
    ro.observe(wrap);
    return () => { ro.disconnect(); cancelAnimationFrame(image); };
  }, [draw]);

  // Libellé accessible : les séries et la période
  const anneesValides = visibles.flatMap(s => s.data.filter(estValide).map(d => d.annee));
  const libelleGraphe = visibles.length
    ? `${type === "bar" ? "Barres" : "Courbes"} : ${visibles.map(s => s.nom).filter(Boolean).join(", ")}${anneesValides.length ? ` — ${Math.min(...anneesValides)} à ${Math.max(...anneesValides)}` : ""}${separee ? " (une échelle par série)" : ""}`
    : "Graphique";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {avecBascule && (
        <div className="graphe-echelle" role="group" aria-label="Échelle des séries">
          <button type="button" aria-pressed={!separee} onClick={() => setChoix("commune")}>Même échelle</button>
          <button type="button" aria-pressed={separee} onClick={() => setChoix("separee")}>Une échelle par série</button>
        </div>
      )}
      <svg ref={ref} role="img" aria-label={libelleGraphe} style={{ width: "100%", height: hauteur, display: "block" }} />
    </div>
  );
}
