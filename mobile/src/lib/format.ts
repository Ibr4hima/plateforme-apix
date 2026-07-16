// ── Formatage des nombres — style unique de la plateforme ────────────────────
// Règles : locale fr-FR (virgule décimale, espaces de milliers), 1 décimale
// maximum, suffixes « Md $ / M $ / k $ » avec espaces. Toute nouvelle vue doit
// passer par ces helpers plutôt que redéfinir son propre formatteur.

const nf1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

// Montant en USD (valeur brute en dollars)
export function fmtUSD(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)} Md $`;
  if (a >= 1e6) return `${nf1(v / 1e6)} M $`;
  if (a >= 1e3) return `${nf1(v / 1e3)} k $`;
  return `${Math.round(v).toLocaleString("fr-FR")} $`;
}

// Montant dont la valeur d'entrée est déjà en MILLIONS d'USD (séries CNUCED)
export function fmtMillionsUSD(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  const a = Math.abs(v);
  if (a >= 1000) return `${nf1(v / 1000)} Md $`;
  return `${Math.round(v).toLocaleString("fr-FR")} M $`;
}

// Grandeur sans devise (axes et tooltips multi-unités : population, USD, %…)
export function fmtCompact(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
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

// Valeur avec unité métier (fiches et cartes KPI des indicateurs)
export function fmtUnite(valeur: number | null | undefined, unite: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
  if (unite === "USD") return fmtUSD(v);
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

export function fmtDateLong(d?: string | null): string {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
