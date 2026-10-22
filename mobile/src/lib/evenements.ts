// Les dates des événements — partagées par l'agenda, sa fiche et l'accueil.
//
// Un événement a une date arrêtée (date_debut, date_fin) ou seulement une
// prochaine édition annoncée (prochain_jour / prochain_mois / prochain_annee),
// souvent partielle : « novembre 2027 », « 2028 ». Une annonce partielle se
// lit avec sa précision — jamais un « 1er janvier » inventé pour combler
// le jour et le mois qui manquent.
import { premierDuMois } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";

export type Precision = "jour" | "mois" | "annee";
export type DateEvenement = { date: Date; precision: Precision };

export function dateEvenementDe(e: any): DateEvenement | null {
  if (e.date_debut) return { date: new Date(e.date_debut.slice(0, 10) + "T00:00:00"), precision: "jour" };
  if (!e.prochain_annee) return null;
  const precision: Precision = e.prochain_mois ? (e.prochain_jour ? "jour" : "mois") : "annee";
  return { date: new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1), precision };
}

/** Le dernier jour que couvre la date : le jour même, la fin du mois ou de
    l'année. Les annonces vagues se rangent ainsi APRÈS les dates précises
    de la même période. */
export function finDePeriode({ date, precision }: DateEvenement): Date {
  if (precision === "jour") return date;
  if (precision === "mois") return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return new Date(date.getFullYear(), 11, 31);
}

const aujourdhui = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** À venir, en cours ou terminé. Une édition annoncée dont la période est
    passée n'est plus « à venir ». */
export function statutEvenement(e: any): "a_venir" | "en_cours" | "termine" | null {
  const calcule = computeStatutEvenement(e);
  if (calcule) return calcule;
  const de = dateEvenementDe(e);
  if (de) return finDePeriode(de) < aujourdhui() ? "termine" : "a_venir";
  return e.prochain_mois ? "a_venir" : null;
}

const moisCourt = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase();

/** Le bloc date : « 20 NOV », « NOV 2027 », « 2027 ». `textuel` : le haut
    est un mot, pas un nombre — il se compose plus petit. */
export function tuileDate(de: DateEvenement): { haut: string; bas: string | null; textuel: boolean } {
  if (de.precision === "jour") return { haut: String(de.date.getDate()), bas: moisCourt(de.date), textuel: false };
  if (de.precision === "mois") return { haut: moisCourt(de.date), bas: String(de.date.getFullYear()), textuel: true };
  return { haut: String(de.date.getFullYear()), bas: null, textuel: false };
}

/** La date en toutes lettres, à sa précision : « 20 novembre 2027 »,
    « novembre 2027 », « 2027 ». */
export function dateEnLettres(de: DateEvenement): string {
  if (de.precision === "jour") return premierDuMois(de.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
  if (de.precision === "mois") return de.date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return String(de.date.getFullYear());
}

/** « Dans 2 ans / 3 mois / 12 jours », à la précision de la date : une
    édition annoncée pour « novembre » n'est pas « dans 10 jours ». */
export function dansCombienEvenement(e: any): string | null {
  const de = dateEvenementDe(e);
  if (!de) return null;
  const maintenant = aujourdhui();
  const d = de.date;
  if (de.precision === "annee") {
    const ans = d.getFullYear() - maintenant.getFullYear();
    return ans < 0 ? null : ans === 0 ? "Cette année" : `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  }
  let mois = (d.getFullYear() - maintenant.getFullYear()) * 12 + (d.getMonth() - maintenant.getMonth());
  if (de.precision === "mois") {
    if (mois < 0) return null;
    if (mois === 0) return "Ce mois-ci";
    const ans = Math.floor(mois / 12);
    return ans >= 1 ? `Dans ${ans} an${ans > 1 ? "s" : ""}` : `Dans ${mois} mois`;
  }
  const jours = Math.round((d.getTime() - maintenant.getTime()) / 86400000);
  if (jours <= 0) return null;
  if (d.getDate() < maintenant.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return jours === 1 ? "Demain" : `Dans ${jours} jours`;
}

/** L'ordre du calendrier : la date précise d'abord, l'annonce vague en fin
    de sa période ; les événements sans date ferment la marche. */
export function comparerEvenements(a: any, b: any): number {
  const da = dateEvenementDe(a), db = dateEvenementDe(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return finDePeriode(da).getTime() - finDePeriode(db).getTime();
}

/** Le prochain événement daté — celui que l'agenda signale en bleu plein. */
export function prochainEvenement(evs: any[] | undefined): any | null {
  return (evs || [])
    .filter(e => statutEvenement(e) === "a_venir" && dateEvenementDe(e))
    .sort(comparerEvenements)[0] ?? null;
}

/** Ce que l'accueil met en avant : l'événement en cours s'il y en a un, sinon
    le prochain. */
export function evenementPhare(evs: any[] | undefined): { ev: any; enCours: boolean } | null {
  const enCours = (evs || []).filter(e => statutEvenement(e) === "en_cours").sort(comparerEvenements)[0];
  if (enCours) return { ev: enCours, enCours: true };
  const prochain = prochainEvenement(evs);
  return prochain ? { ev: prochain, enCours: false } : null;
}

/** « 1re édition », « 2e édition » — l'abréviation française des ordinaux. */
export const ordinal = (n: number) => (n === 1 ? "1re édition" : `${n}e édition`);
