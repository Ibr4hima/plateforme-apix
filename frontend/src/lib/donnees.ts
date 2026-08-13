"use client";

/**
 * Données de page servies par React Query — le pendant « contenus » de
 * referentiels.ts.
 *
 * Avant : chaque page portait son trio useState loading / erreur / données et
 * son useEffect de chargement. Rien n'était conservé — revenir sur une page
 * visitée dix secondes plus tôt repartait de zéro, squelettes compris. Le
 * QueryClient (Providers.tsx) donne 5 minutes de fraîcheur : le retour est
 * instantané, le rafraîchissement se fait en arrière-plan.
 *
 * Deux hooks, deux formes de ressources :
 *  - useDonnees : une URL, une réponse JSON telle quelle ;
 *  - useTous    : une collection paginée aspirée en entier via fetchTous.
 *
 * La clé de cache EST l'URL : deux composants qui demandent la même ressource
 * partagent le même téléchargement et la même entrée de cache, sans se
 * connaître. Passer `null` suspend la requête (pays non choisi, onglet
 * inactif).
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchTous } from "@/lib/fetchTous";

const j = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

/** Repli stable : un littéral [] recréé à chaque render invaliderait les
 *  useMemo/useEffect qui en dépendent. */
export const VIDE: readonly any[] = [];

export function useDonnees<T = any>(url: string | null, opts?: {
  /** Garde la réponse précédente pendant qu'une nouvelle URL charge — pour les
   *  requêtes pilotées par un curseur ou une sélection, où un squelette à
   *  chaque cran ferait clignoter la page. `isPlaceholderData` dit alors
   *  qu'une transition est en cours. */
  garder?: boolean;
}) {
  return useQuery<T>({
    queryKey: ["donnees", url],
    queryFn: () => j(url!),
    enabled: url !== null,
    placeholderData: opts?.garder ? keepPreviousData : undefined,
  });
}

export function useTous<T = any>(url: string | null) {
  return useQuery<T[]>({
    queryKey: ["tous", url],
    queryFn: () => fetchTous(url!),
    enabled: url !== null,
  });
}
