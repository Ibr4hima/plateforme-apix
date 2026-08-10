// ── Formatage des nombres — style unique de la plateforme ────────────────────
// Règles : locale fr-FR (virgule décimale, espaces de milliers), 1 décimale
// maximum, suffixes « Md $ / M $ / k $ » avec espaces. Toute nouvelle vue doit
// passer par ces helpers plutôt que redéfinir son propre formatteur.

const nf1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

// Nombre nu en fr-FR, « — » si absent. C'est LE formateur de base : tout ce
// qui affiche un nombre sans suffixe doit passer par lui.
export const nf = (v: number | null | undefined, d = 0) =>
  v != null && isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—";

// Montant en USD (valeur brute en dollars)
export function fmtUSD(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)} Md $`;
  if (a >= 1e6) return `${nf1(v / 1e6)} M $`;
  if (a >= 1e3) return `${nf1(v / 1e3)} k $`;
  return `${Math.round(v).toLocaleString("fr-FR")} $`;
}

// Montant dont la valeur d'entrée est déjà en MILLIONS d'USD (séries CNUCED)
export function fmtMillionsUSD(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1000) return `${nf1(v / 1000)} Md $`;
  return `${Math.round(v).toLocaleString("fr-FR")} M $`;
}

// ── FCFA ─────────────────────────────────────────────────────────────────────
// Deux unités d'entrée coexistent selon la source, d'où deux noms explicites :
// se tromper de formateur décale les montants d'un facteur mille sans que rien
// ne le signale — c'est arrivé, le nom porte donc l'unité attendue.

// Entrée en MILLIONS de FCFA (familles NACE).
export function fmtMFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return `${nf1(v / 1000)} Md FCFA`;
  return `${nf(v)} M FCFA`;
}

// Entrée en FCFA bruts (séries des graphes du tableau de bord).
export function fmtFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${nf1(v / 1e9)} Md FCFA`;
}

// Poids en tonnes (NACE) : Mt / kt / t.
export function fmtTonnes(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Mt`;
  if (Math.abs(v) >= 1000) return `${nf(v / 1000)} kt`;
  return `${nf(v)} t`;
}

// Grandeur sans devise (axes et tooltips multi-unités : population, USD, %…)
export function fmtCompact(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)} Md`;
  if (a >= 1e6) return `${nf1(v / 1e6)} M`;
  if (a >= 1e3) return `${nf1(v / 1e3)} k`;
  return `${Math.round(v).toLocaleString("fr-FR")}`;
}

// Graduations d'axe (compact, sans espace, pour ne pas déborder des marges)
export function fmtAxe(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)}Md`;
  if (a >= 1e6) return `${nf1(v / 1e6)}M`;
  if (a >= 1e3) return `${nf1(v / 1e3)}k`;
  return `${Math.round(v)}`;
}

// Les grandeurs « par habitant » s'écrivent en entier — 2 873,6 $ et non
// 2,9 k $. L'abréviation gagne trois caractères et perd l'information : entre
// deux pays, l'écart de PIB par habitant se joue sur les centaines. Le partage
// se fait par CODE d'indicateur et non par unité, car « USD » sert aussi aux
// flux de commerce extérieur, qui se comptent en milliards et se lisent mieux
// abrégés.
const PAR_HABITANT = new Set(["pib_hab"]);

// Valeur avec unité métier (fiches et cartes KPI des indicateurs).
// `code` est facultatif : il ne sert qu'aux indicateurs dont le rendu ne se
// déduit pas de la seule unité.
export function fmtUnite(valeur: number | null | undefined, unite: string, code?: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
  if (unite === "USD") {
    if (code && PAR_HABITANT.has(code)) return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`;
    return fmtUSD(v);
  }
  if (unite === "Md USD") return `${nf1(v)} Md $`;
  if (unite === "hab/km²") return `${nf1(v)} hab/km²`;
  if (unite === "km²") return `${Math.round(v).toLocaleString("fr-FR")} km²`;
  if (unite === "habitants") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M hab.`;
    return `${Math.round(v).toLocaleString("fr-FR")} hab.`;
  }
  return v.toLocaleString("fr-FR");
}

// ── Dates fr-FR (format court par défaut : « 5 août 2016 » → « 5 août 2016 ») ─
// Deux conventions officielles seulement : courte (listes, cards) et longue
// (fiches détaillées). Renvoie "" si la date est absente — les vues gèrent
// leur propre marqueur de vide (« — », « Non définie »…).
export function fmtDate(d?: string | null): string {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Plage de dates au format le plus court qui reste sans ambiguïté : les
 * parties communes aux deux bornes ne sont écrites qu'une fois.
 *   6 → 10 juin 2026        (même mois)
 *   28 févr. → 3 mars 2026  (même année)
 *   28 déc. 2026 → 3 janv. 2027
 * Une plage écrite en entier des deux côtés ne tient pas dans une colonne de
 * carte et se retrouve tronquée : c'est la date, l'information principale.
 */
export function fmtPlageDates(debut?: string | null, fin?: string | null): string {
  if (!debut) return fin ? fmtDate(fin) : "";
  if (!fin || fin === debut) return fmtDate(debut);
  const [ad, md, jd] = debut.split("-").map(Number);
  const [af, mf, jf] = fin.split("-").map(Number);
  const dDeb = new Date(ad, md - 1, jd);
  const moisDe = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" });
  if (ad === af && md === mf) return `${jd} → ${jf} ${moisDe(dDeb)} ${af}`;
  if (ad === af) return `${jd} ${moisDe(dDeb)} → ${fmtDate(fin)}`;
  return `${fmtDate(debut)} → ${fmtDate(fin)}`;
}

export function fmtDateLong(d?: string | null): string {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
