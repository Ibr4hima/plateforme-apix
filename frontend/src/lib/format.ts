// ── Formatage des nombres — style unique de la plateforme ────────────────────
// Règles : locale fr-FR (virgule décimale, espaces de milliers), suffixes
// « Md $ / M $ / k $ » avec espaces. Toute nouvelle vue doit passer par ces
// helpers plutôt que redéfinir son propre formatteur.
//
// LA PRÉCISION D'UN MONTANT : TROIS CHIFFRES SIGNIFICATIFS. Un arrondi ne doit
// jamais tromper. Des flux d'IDE de 0,64 M $ (640 000 $ — l'ordre
// des sortants du Sénégal en 2025) s'affichaient « 1 M $ », plus de la moitié en trop ;
// 18,6 M $ devenait « 19 M $ », et 1 049 M $ « 1 Md $ ». La règle est celle
// des tableaux financiers — aucune décimale à partir de 100, une entre 10 et
// 100, deux en dessous de 10 —, et un montant qui ne vaut pas 1 dans son
// unité passe à l'unité inférieure au lieu de s'arrondir à 0 ou à 1 :
// 0,64 M $ s'écrit « 640 k $ ». L'écart d'affichage ne dépasse jamais 0,5 %.
// La même règle vaut dans l'app mobile (mobile/src/lib/format.ts). Les taux,
// ratios, durées et effectifs gardent leur écriture propre, et les exports
// (xlsx, csv) leurs valeurs brutes.

const nf1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

// Nombre nu en fr-FR, « — » si absent. C'est LE formateur de base : tout ce
// qui affiche un nombre sans suffixe doit passer par lui.
export const nf = (v: number | null | undefined, d = 0) =>
  v != null && isFinite(v) ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—";

/** Le nombre de décimales qui garde trois chiffres significatifs. */
export const decimalesSignificatives = (a: number): number => (a >= 100 ? 0 : a >= 10 ? 1 : 2);

/** Un nombre à trois chiffres significatifs (au plus deux décimales), sans
    zéro final : 2,90 s'écrit « 2,9 ». Un négatif que l'arrondi efface
    (−0,004) s'écrit « 0 » — `toLocaleString` rendait « -0 ». */
export const nfSig = (v: number): string => {
  const s = v.toLocaleString("fr-FR", { maximumFractionDigits: decimalesSignificatives(Math.abs(v)) });
  return s === "-0" ? "0" : s;
};

// Les paliers d'unité se franchissent à 999,5 et non à 1 000 : arrondi à
// l'entier, 999,7 M $ s'écrirait « 1 000 M $ » au lieu de « 1 Md $ »
const PALIER = 999.5;

type Paliers = readonly (readonly [string, number])[];
const PALIERS_USD: Paliers = [["Md $", 1e9], ["M $", 1e6], ["k $", 1e3]];
const PALIERS_FCFA: Paliers = [["Md FCFA", 1e9], ["M FCFA", 1e6], ["k FCFA", 1e3]];

/** Un montant à l'échelle de ses paliers — ["Md", 1e9], ["M", 1e6]… : la
    plus grande unité où il vaut au moins 1 —, en deux morceaux, le nombre et
    son unité. */
function echelonneParts(v: number, paliers: Paliers, base: string): { nombre: string; unite: string } {
  const a = Math.abs(v);
  for (const [unite, facteur] of paliers) {
    if (a >= PALIER * facteur / 1000) return { nombre: nfSig(v / facteur), unite };
  }
  return { nombre: nfSig(v), unite: base };
}

function echelonne(v: number, paliers: Paliers, base: string): string {
  const { nombre, unite } = echelonneParts(v, paliers, base);
  return unite ? `${nombre} ${unite}` : nombre;
}

// Montant en USD (valeur brute en dollars) — « 2,94 Md $ », « 640 k $ »
export function fmtUSD(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, PALIERS_USD, "$");
}

// Montant dont la valeur d'entrée est déjà en MILLIONS d'USD (séries CNUCED,
// fDi) — 0,64 → « 640 k $ », 18,55 → « 18,6 M $ », 2 940 → « 2,94 Md $ »
export function fmtMillionsUSD(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return fmtUSD(v * 1e6);
}

/** Le même montant en deux morceaux, pour les fiches qui posent l'unité en
    petit à côté du chiffre : 2 940 → { nombre: "2,94", unite: "Md $" }. */
export function fmtMillionsUSDParts(v?: number | null): { nombre: string; unite: string } {
  if (v == null || !isFinite(v)) return { nombre: "—", unite: "" };
  return echelonneParts(v * 1e6, PALIERS_USD, "$");
}

// ── FCFA ─────────────────────────────────────────────────────────────────────
// Deux unités d'entrée coexistent selon la source, d'où deux noms explicites :
// se tromper de formateur décale les montants d'un facteur mille sans que rien
// ne le signale — c'est arrivé, le nom porte donc l'unité attendue.

// Entrée en MILLIONS de FCFA (familles NACE) — 52,1 → « 52,1 M FCFA »,
// 0,42 → « 420 k FCFA », 6 973,9 → « 6,97 Md FCFA »
export function fmtMFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return fmtFCFA(v * 1e6);
}

// Entrée en FCFA bruts (séries des graphes du tableau de bord, BDEF) — les
// mêmes paliers que les dollars : « 6 974 Md FCFA », « 52,1 M FCFA »,
// « 420 k FCFA ». Il écrivait tout en milliards : 420 000 FCFA s'y lisaient
// « 0 Md FCFA ».
export function fmtFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, PALIERS_FCFA, "FCFA");
}

// ── Tableaux à échelle commune ───────────────────────────────────────────────
// Un tableau de montants peut poser l'unité une fois, en tête de ligne
// (« Chiffre d'affaires · Md FCFA »), et n'écrire que des nombres nus. L'échelle
// est celle du plus grand terme, choisie aux mêmes paliers que les montants ;
// les termes plus petits ne doivent pas pour autant tomber à « 0 » : 40 M FCFA
// dans une ligne en Md FCFA s'écrit « 0,04 ».

/** L'échelle commune d'une série de montants en FCFA : celle de son plus grand
    terme (en valeur absolue). */
export function echelleFCFA(max: number): { unite: string; facteur: number } {
  const a = Math.abs(max);
  for (const [unite, facteur] of PALIERS_FCFA) {
    if (a >= PALIER * facteur / 1000) return { unite, facteur };
  }
  return { unite: "FCFA", facteur: 1 };
}

/** Un nombre nu à l'échelle `facteur` de son tableau, trois chiffres
    significatifs. Sous l'unité de l'échelle, il en garde deux : 0,004 et non
    « 0 », qui ferait d'un montant réel un montant nul. */
export function nfEchelle(v: number, facteur: number): string {
  const x = v / facteur;
  if (x !== 0 && Math.abs(x) < 1) return x.toLocaleString("fr-FR", { maximumSignificantDigits: 2 });
  return nfSig(x);
}

// Poids en tonnes (NACE) : Mt / kt / t, à la précision des montants — l'écriture
// à l'entier faisait de 1 499 t « 1 kt »
export function fmtTonnes(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, [["Mt", 1e6], ["kt", 1e3]], "t");
}

// Grandeur sans devise (étiquettes et tooltips multi-unités : population, USD,
// %…) — même précision que les montants : « 2,94 Md », « 640 k »
export function fmtCompact(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return echelonne(v, [["Md", 1e9], ["M", 1e6], ["k", 1e3]], "");
}

// Graduations d'axe (compact, sans espace, pour ne pas déborder des marges).
// Elles restent à une décimale : ce sont des valeurs rondes — 250k, 1,5Md —,
// que trois chiffres significatifs n'éclaireraient pas davantage.
export function fmtAxe(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)}Md`;
  if (a >= 1e6) return `${nf1(v / 1e6)}M`;
  if (a >= 1e3) return `${nf1(v / 1e3)}k`;
  return `${Math.round(v)}`;
}

// Les grandeurs « par habitant » s'écrivent en entier — 2 873,6 $ et non
// 2,87 k $. L'abréviation n'y gagne qu'un caractère et perd le détail : entre
// deux pays proches, l'écart de PIB par habitant se lit au dollar près. Le
// partage se fait par CODE d'indicateur et non par unité, car « USD » sert
// aussi aux flux de commerce extérieur, qui se comptent en milliards et se
// lisent mieux abrégés.
const PAR_HABITANT = new Set(["pib_hab"]);

// Valeur avec unité métier (fiches et cartes KPI des indicateurs).
// `code` est facultatif : il ne sert qu'aux indicateurs dont le rendu ne se
// déduit pas de la seule unité.
export function fmtUnite(valeur: number | null | undefined, unite: string, code?: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  // LA VIRGULE DÉCIMALE, et non le point : « +4,3 % ». `toFixed` écrit à
  // l'anglaise, et le défaut se voyait sur chaque taux de croissance de la
  // plateforme — fiche pays, statistiques, flux bilatéraux.
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  if (unite === "USD") {
    if (code && PAR_HABITANT.has(code)) return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`;
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
  return premierDuMois(new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }));
}

/** « 1er mars », et non « 1 mars » : le premier jour du mois s'écrit en
    ordinal, en français — le système ne le fait pas. Même règle que
    l'application mobile. */
export const premierDuMois = (texte: string): string =>
  texte.replace(/(^|[\s(])1(?= (?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc))/g, "$11er");

/** Le numéro du jour, « 1er » pour le premier. */
const jour = (n: number): string => (n === 1 ? "1er" : String(n));

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
  if (ad === af && md === mf) return `${jour(jd)} → ${jf} ${moisDe(dDeb)} ${af}`;
  if (ad === af) return `${jour(jd)} ${moisDe(dDeb)} → ${fmtDate(fin)}`;
  return `${fmtDate(debut)} → ${fmtDate(fin)}`;
}

export function fmtDateLong(d?: string | null): string {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return premierDuMois(new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
}
