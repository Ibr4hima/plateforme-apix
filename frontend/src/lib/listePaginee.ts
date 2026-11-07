"use client";

/**
 * Une liste paginée par le serveur, lue page après page au fil du défilement.
 *
 * Les pages de listes aspiraient leur collection entière (fetchTous) : à
 * 20 000 prospects, 201 requêtes et 94 Mo pour ouvrir une page, et la
 * plateforme tombait dès quelques agents (perf/RESULTATS-2026-11-07.md).
 * Avec ce crochet, la page demande ses cartes par paquets (trente par défaut),
 * filtres et recherche compris dans l'adresse, et la suivante quand le bas de
 * la liste approche.
 *
 * La clé de cache est l'adresse : changer un filtre ouvre une autre liste,
 * revenir au filtre précédent la retrouve en cache. Pendant le chargement d'un
 * nouveau filtre, les cartes du précédent restent affichées (keepPreviousData)
 * au lieu d'un squelette qui clignote.
 */

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

export type PageServeur<T> = { data: T[]; total: number; page: number; pages: number };

export function useListePaginee<T>(url: string | null, opts?: {
  /** Relue à chaque ouverture de la page plutôt que servie du cache : pour
   *  l'administration, où l'on modifie ce qu'on lit. */
  frais?: boolean;
}) {
  const q = useInfiniteQuery({
    // Pas de clé `staleTime: undefined` : elle écraserait la fraîcheur par défaut
    ...(opts?.frais ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
    queryKey: ["liste-paginee", url],
    queryFn: async ({ pageParam }): Promise<PageServeur<T>> => {
      const r = await fetch(`${url}${url!.includes("?") ? "&" : "?"}page=${pageParam}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    initialPageParam: 1,
    getNextPageParam: (derniere: PageServeur<T>) => (derniere.page < derniere.pages ? derniere.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: url !== null,
  });
  const elements = useMemo(() => q.data?.pages.flatMap(p => p.data) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  return { ...q, elements, total };
}

/**
 * Le témoin de bas de liste : un élément posé après la dernière carte. Quand
 * il approche du bas du panneau qui défile (un écran d'avance), la page
 * suivante est demandée. `racine` est ce panneau : l'observer lui-même, et non
 * la fenêtre, permet de charger avant que le témoin ne soit à l'écran.
 */
export function useTemoinDeFin(suivante: () => void, actif: boolean, racine: HTMLElement | null) {
  const observateur = useRef<IntersectionObserver | null>(null);
  return useCallback((el: HTMLElement | null) => {
    observateur.current?.disconnect();
    if (!el || !actif) return;
    observateur.current = new IntersectionObserver(
      entrees => { if (entrees.some(e => e.isIntersecting)) suivante(); },
      { root: racine, rootMargin: "0px 0px 800px 0px" },
    );
    observateur.current.observe(el);
  }, [suivante, actif, racine]);
}
