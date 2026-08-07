// Remplir le cache pendant que personne ne regarde.
//
// L'app garde une semaine de réponses sur l'appareil, mais le cache ne se
// remplit qu'à l'usage : un module jamais ouvert reste vide hors ligne. Ce
// module va les chercher — sans jamais gêner l'écran qui est à l'écran.
//
// ── Ce qui rendrait le préchargement nuisible ────────────────────────────────
// Lancer dix requêtes au démarrage, c'est disputer la bande passante à
// l'écran que l'utilisateur regarde, et analyser plusieurs centaines de
// kilo-octets de JSON sur le fil JS pendant les animations d'entrée. L'app ne
// planterait pas : elle deviendrait poussive, ce qui est pire, parce que
// diffus. Quatre règles l'évitent.
//
//   1. On attend la fin des animations (InteractionManager) PUIS un délai :
//      les requêtes de l'accueil passent les premières, sans concurrence.
//   2. Une requête à la fois, jamais en parallèle, avec une pause entre
//      chacune : le fil JS respire, et une requête déclenchée par un tap
//      n'affronte au pire qu'un seul préchargement.
//   3. L'ordre suit celui d'Explorer, et les plus lourdes ferment la marche :
//      si l'utilisateur navigue avant la fin, il a déjà l'essentiel.
//   4. prefetchQuery respecte staleTime : ce qui est déjà frais ne repart
//      pas, et rien ne se relance à chaque lancement de l'app.
//
// Le préchargement s'interrompt de lui-même hors ligne, et à la sortie de
// l'écran d'accueil il est simplement abandonné — aucune requête n'est
// annulée en vol, elles alimentent le cache de toute façon.
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { onlineManager, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchTous, getJson } from "@/lib/api";

const MINUTE = 60 * 1000;

// Le calme avant de commencer : l'accueil a fini de se peindre et ses propres
// requêtes ont abouti
const ATTENTE_INITIALE = 3000;
// Entre deux préchargements — de quoi rendre la main au rendu
const RESPIRATION = 500;

type Tache = { cle: readonly unknown[]; fn: () => Promise<unknown>; frais?: number };

// L'ordre compte : les modules d'Explorer d'abord, du plus consulté au moins,
// puis les référentiels, puis les gros volumes.
const TACHES: Tache[] = [
  // ── Les listes des modules ──
  { cle: ["entreprises"], fn: () => fetchTous("/entreprises") },
  { cle: ["zones-types"], fn: () => getJson<any[]>("/zones-types") },
  { cle: ["zones-poles"], fn: () => getJson<any[]>("/zones-types/poles"), frais: Infinity },
  { cle: ["projets"], fn: () => fetchTous("/projets") },
  { cle: ["potentialites"], fn: () => fetchTous("/opportunites/potentialites") },
  { cle: ["avantages"], fn: () => fetchTous("/opportunites/avantages") },
  { cle: ["accords"], fn: () => fetchTous("/accords") },
  { cle: ["evenements"], fn: () => fetchTous("/evenements") },
  { cle: ["prospects", "cibles"], fn: () => fetchTous("/prospects?conclu=false&contactes=false") },
  { cle: ["prospects", "contact"], fn: () => fetchTous("/prospects?conclu=false&contactes=true") },
  { cle: ["prospects", "termines"], fn: () => fetchTous("/prospects?conclu=true") },

  // ── Les textes du code ──
  { cle: ["code", "code-investissement"], fn: () => getJson<any[]>("/code-investissement"), frais: 30 * MINUTE },
  { cle: ["code", "modalites-application"], fn: () => getJson<any[]>("/modalites-application"), frais: 30 * MINUTE },

  // ── Les référentiels, légers et durables ──
  { cle: ["accords-parties"], fn: () => getJson<any>("/accords/parties-distinctes"), frais: Infinity },
  { cle: ["stat-pays"], fn: () => getJson<any[]>("/statistiques/pays"), frais: 30 * MINUTE },
  { cle: ["stat-indicateurs"], fn: () => getJson<any[]>("/statistiques/indicateurs"), frais: Infinity },
  { cle: ["ref-atouts"], fn: () => getJson<any[]>("/ref-potentialites/flat"), frais: Infinity },
  { cle: ["ref-avg-types"], fn: () => getJson<any[]>("/ref-avantages"), frais: Infinity },
  { cle: ["ref", "regions"], fn: () => getJson<any[]>("/entreprises/ref/regions"), frais: Infinity },
  { cle: ["ref", "departements"], fn: () => getJson<any[]>("/entreprises/ref/departements"), frais: Infinity },
  { cle: ["ref", "arrondissements"], fn: () => getJson<any[]>("/entreprises/ref/arrondissements"), frais: Infinity },

  // ── Le commerce extérieur : les plus gros, donc les derniers ──
  { cle: ["nace-gu"], fn: () => getJson<any>("/nace/groupes-utilisation"), frais: 30 * MINUTE },
  { cle: ["nace-regroupes"], fn: () => getJson<any>("/nace/produits-regroupes"), frais: 30 * MINUTE },
  { cle: ["nace-continents"], fn: () => getJson<any>("/nace/continents"), frais: 30 * MINUTE },
  { cle: ["nace-regions"], fn: () => getJson<any>("/nace/regions"), frais: 30 * MINUTE },
  { cle: ["nace-pays"], fn: () => getJson<any>("/nace/pays"), frais: 30 * MINUTE },
];

const patienter = (ms: number) => new Promise(r => setTimeout(r, ms));

async function precharger(qc: QueryClient, arrete: () => boolean) {
  for (const t of TACHES) {
    if (arrete() || !onlineManager.isOnline()) return;
    // Un échec ne doit pas interrompre la file : le module suivant n'y est
    // pour rien, et la requête repartira à l'ouverture de l'écran
    await qc.prefetchQuery({
      queryKey: t.cle as unknown[],
      queryFn: t.fn,
      staleTime: t.frais ?? 5 * MINUTE,
    }).catch(() => {});
    await patienter(RESPIRATION);
  }
}

/**
 * À poser UNE fois, sur l'accueil : le cache se remplit en arrière-plan pour
 * que les autres modules soient consultables hors ligne.
 */
export function usePrechargement() {
  const qc = useQueryClient();
  useEffect(() => {
    let parti = false;
    const tache = InteractionManager.runAfterInteractions(async () => {
      await patienter(ATTENTE_INITIALE);
      if (parti) return;
      await precharger(qc, () => parti);
    });
    return () => { parti = true; tache.cancel(); };
  }, [qc]);
}
