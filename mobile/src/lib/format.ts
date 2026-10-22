// ── Formatage des nombres — style unique de la plateforme ────────────────────
// Règles : locale fr-FR (virgule décimale, espaces de milliers), suffixes
// « Md $ / M $ / k $ » avec espaces. Toute nouvelle vue doit passer par ces
// helpers plutôt que redéfinir son propre formatteur.
//
// LA PRÉCISION D'UN MONTANT : TROIS CHIFFRES SIGNIFICATIFS. Un arrondi ne doit
// jamais tromper : 0,64 M $ (640 000 $) s'affichait « 1 M $ », la moitié en
// plus ; 1 049 M $ devenait « 1 Md $ ». La règle est celle des tableaux
// financiers — aucune décimale à partir de 100, une entre 10 et 100, deux en
// dessous de 10 — et, sous l'unité, le montant passe à l'unité inférieure
// (0,64 M $ → « 640 k $ »). L'écart d'affichage ne dépasse jamais 0,5 %. La
// même règle vaut sur le site (frontend/src/lib/format.ts).

const nf1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Le nombre de décimales qui garde trois chiffres significatifs. */
export const decimalesSignificatives = (a: number): number => (a >= 100 ? 0 : a >= 10 ? 1 : 2);

/** Un nombre à trois chiffres significatifs (au plus deux décimales) — un
    petit négatif arrondi à zéro s'écrit « 0 », pas « -0 ». */
export const nfSig = (v: number): string => {
  const s = v.toLocaleString("fr-FR", { maximumFractionDigits: decimalesSignificatives(Math.abs(v)) });
  return s === "-0" ? "0" : s;
};

// Les paliers d'unité se franchissent à 999,5 et non à 1 000 : arrondi à
// l'entier, 999,7 M $ s'écrirait « 1 000 M $ » au lieu de « 1 Md $ »
const PALIER = 999.5;

/** Un montant à l'échelle de ses paliers — ["Md", 1e9], ["M", 1e6]… : la
    plus grande unité où il vaut au moins 1. */
function echelonne(v: number, paliers: readonly [string, number][], base: string): string {
  const a = Math.abs(v);
  for (const [unite, facteur] of paliers) {
    if (a >= PALIER * facteur / 1000) return `${nfSig(v / facteur)} ${unite}`;
  }
  return `${nfSig(v)}${base ? ` ${base}` : ""}`;
}

const PALIERS_USD = [["Md $", 1e9], ["M $", 1e6], ["k $", 1e3]] as const;

// Montant en USD (valeur brute en dollars)
export function fmtUSD(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, PALIERS_USD as unknown as [string, number][], "$");
}

// Montant dont la valeur d'entrée est déjà en MILLIONS d'USD (séries CNUCED,
// fDi) — 0,64 → « 640 k $ », 18,55 → « 18,6 M $ », 2 940 → « 2,94 Md $ »
export function fmtMillionsUSD(v: number | null): string {
  if (v === null || v === undefined || !isFinite(v)) return "N/A";
  return fmtUSD(v * 1e6);
}

// Grandeur sans devise (axes et tooltips multi-unités : population, USD, %…)
export function fmtCompact(v: number | null): string {
  if (v === null || v === undefined || !isFinite(v)) return "N/A";
  return echelonne(v, [["Md", 1e9], ["M", 1e6], ["k", 1e3]], "");
}

// Graduations d'axe (compact, sans espace, pour ne pas déborder des marges)
export function fmtAxe(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)}Md`;
  if (a >= 1e6) return `${nf1(v / 1e6)}M`;
  if (a >= 1e3) return `${nf1(v / 1e3)}k`;
  return `${Math.round(v)}`;
}

// Les grandeurs « par habitant » s'écrivent en entier — 1 789 $ et non
// 1,79 k $ : entre deux pays, l'écart de PIB par habitant se joue sur les
// centaines (même règle que le site, frontend/src/lib/format.ts)
const PAR_HABITANT = new Set(["pib_hab"]);

// Valeur avec unité métier (fiches et cartes KPI des indicateurs). `code` ne
// sert qu'aux indicateurs dont le rendu ne se déduit pas de la seule unité.
export function fmtUnite(valeur: number | null | undefined, unite: string, code?: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  // La virgule décimale, et non le point de toFixed : « +4,3 % »
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  if (unite === "USD") {
    if (code && PAR_HABITANT.has(code)) return `${Math.round(v).toLocaleString("fr-FR")} $`;
    return fmtUSD(v);
  }
  if (unite === "Md USD") return fmtUSD(v * 1e9);
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

// Un montant dans sa devise, à l'échelle : « 200 M FCFA », « 1,2 Md € »,
// « 640 k $ » — trois chiffres significatifs, comme les autres montants
const ECHELLES = [["Md", 1e9], ["M", 1e6], ["k", 1e3]] as const;
function echelleDe(a: number): readonly [string, number] | null {
  for (const e of ECHELLES) if (a >= PALIER * e[1] / 1000) return e;
  return null;
}
export function fmtMontantDevise(v: number, sym: string): string {
  const e = echelleDe(Math.abs(v));
  return e ? `${nfSig(v / e[1])} ${e[0]} ${sym}`.trim() : `${Math.round(v).toLocaleString("fr-FR")} ${sym}`.trim();
}
/** Un intervalle de montants : l'unité une fois quand les deux bornes la
    partagent — « 200 — 600 M FCFA » —, à chacune sinon — « 800 M — 1,2 Md FCFA ». */
export function fmtIntervalleDevise(min: number, max: number | null, sym: string): string {
  if (max == null) return `${fmtMontantDevise(min, sym)} et plus`;
  const e1 = echelleDe(Math.abs(min)), e2 = echelleDe(Math.abs(max));
  if (e1 && e2 && e1[0] === e2[0]) return `${nfSig(min / e1[1])} — ${nfSig(max / e2[1])} ${e1[0]} ${sym}`.trim();
  // La devise une fois, au bout : « 800 M — 1,2 Md FCFA »
  return `${fmtMontantDevise(min, "")} — ${fmtMontantDevise(max, sym)}`;
}

// Montant en FCFA bruts — « 6 974 Md FCFA », « 52,1 M FCFA », « 420 k FCFA »
// (les paliers de la BDEF du site)
export function fmtFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, [["Md FCFA", 1e9], ["M FCFA", 1e6], ["k FCFA", 1e3]], "FCFA");
}

// Montant dont la valeur d'entrée est en MILLIONS de FCFA (familles NACE) —
// même règle que le site : « Md FCFA » au-delà du millier de millions
export function fmtMFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return fmtFCFA(v * 1e6);
}

/** Le pluriel d'un mot compté — « pays » est invariable, la Présidence lit. */
export const accorder = (n: number, mot: string): string =>
  `${mot}${n > 1 && !/[sx]$/.test(mot) ? "s" : ""}`;

// ── Le texte replié, pour chercher ───────────────────────────────────────────
// Sans accents, sans casse, sans espaces aux bords : « senegal » trouve
// « Sénégal », « thies » trouve « Thiès ». Toute recherche de l'app compare
// des textes repliés des deux côtés.
export const plier = (s: string | null | undefined): string =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ── La variation d'une année à l'autre ───────────────────────────────────────
// Un taux varie en POINTS : de 5 % à 6 %, il gagne 1 point — « +20 % » ferait
// croire à un bond, et se lisait « 6 % ↗ 20 % ». Les autres grandeurs varient
// en pourcentage de la valeur précédente, sans variation lisible depuis zéro.
// `delta` porte le sens (et la flèche) ; `texte`, la valeur absolue.
export function variation(dernier: number, precedent: number, unite?: string | null): { delta: number; texte: string } | null {
  const ecrire = (x: number, suffixe: string) => `${Math.abs(x).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${suffixe}`;
  if (unite === "%") {
    const d = dernier - precedent;
    return { delta: d, texte: ecrire(d, "pt") };
  }
  if (precedent === 0) return null;
  const d = ((dernier - precedent) / Math.abs(precedent)) * 100;
  return { delta: d, texte: ecrire(d, "%") };
}

// ── Les entités HTML d'un texte saisi sur le site ────────────────────────────
// Une seule passe : « &amp;nbsp; » reste « &nbsp; » à l'écran, comme dans
// un navigateur. L'espace insécable le reste (« article 12 : »).
const ENTITES: Record<string, string> = {
  nbsp: "\u00A0", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", laquo: "«", raquo: "»",
  hellip: "…", ndash: "–", mdash: "—", euro: "€", deg: "°",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î",
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Ccedil: "Ç",
};
export const decoderEntites = (t: string): string =>
  t.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (brut, e: string) => {
    if (e[0] !== "#") return ENTITES[e] ?? brut;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return isNaN(n) ? brut : String.fromCodePoint(n);
  });
