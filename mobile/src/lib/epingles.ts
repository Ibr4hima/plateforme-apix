// Personnalisation de l'accueil — persistée sur l'appareil :
// · ordre des modules (réorganisation dans la grille de l'accueil)
// · KPIs épinglés (appui long sur une card de carrousel) avec leur
//   dernière valeur connue, rafraîchie à chaque passage dans le module.
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLE_ORDRE = "accueil.ordre-modules-v1";
const CLE_KPIS = "accueil.kpis-epingles-v1";
export const MAX_EPINGLES = 8;

export type KpiEpingle = {
  id: string;           // `${source}:${cle}` — unique inter-modules
  cle: string;
  label: string;
  valeur: string;
  note?: string | null;
  sourceLabel: string;  // « Inv. privés », « Flux bilatéraux »…
  href: string;         // destination du tap depuis l'accueil
};

// Petits abonnements pour que l'accueil se mette à jour immédiatement
const abonnes = new Set<() => void>();
export function abonnerEpingles(fn: () => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}
const notifier = () => abonnes.forEach(fn => fn());

// ── Ordre des modules ────────────────────────────────────────────────────────
export async function chargerOrdre(): Promise<string[] | null> {
  try { const brut = await AsyncStorage.getItem(CLE_ORDRE); return brut ? JSON.parse(brut) : null; }
  catch { return null; }
}
export async function sauverOrdre(cles: string[]) {
  try { await AsyncStorage.setItem(CLE_ORDRE, JSON.stringify(cles)); } catch {}
}

// ── KPIs épinglés ────────────────────────────────────────────────────────────
export async function chargerEpingles(): Promise<KpiEpingle[]> {
  try { const brut = await AsyncStorage.getItem(CLE_KPIS); return brut ? JSON.parse(brut) : []; }
  catch { return []; }
}

async function sauverEpingles(liste: KpiEpingle[]) {
  try { await AsyncStorage.setItem(CLE_KPIS, JSON.stringify(liste)); } catch {}
  notifier();
}

// Épingle ou retire ; renvoie la liste et si l'ajout a eu lieu
export async function basculerEpingle(k: KpiEpingle): Promise<{ liste: KpiEpingle[]; ajoute: boolean }> {
  const liste = await chargerEpingles();
  const dedans = liste.some(e => e.id === k.id);
  const suivante = dedans ? liste.filter(e => e.id !== k.id) : [...liste, k].slice(-MAX_EPINGLES);
  await sauverEpingles(suivante);
  return { liste: suivante, ajoute: !dedans };
}

export async function retirerEpingle(id: string) {
  const liste = await chargerEpingles();
  await sauverEpingles(liste.filter(e => e.id !== id));
}

// Rafraîchit la valeur des épinglés qui viennent d'être recalculés à l'écran
export async function rafraichirEpingles(source: string, kpis: { cle: string; valeur: string; note?: string | null }[]) {
  const liste = await chargerEpingles();
  if (!liste.length) return;
  const index = new Map(kpis.map(k => [`${source}:${k.cle}`, k]));
  let change = false;
  const suivante = liste.map(e => {
    const frais = index.get(e.id);
    if (frais && (frais.valeur !== e.valeur || frais.note !== e.note)) {
      change = true;
      return { ...e, valeur: frais.valeur, note: frais.note };
    }
    return e;
  });
  if (change) await sauverEpingles(suivante);
}
