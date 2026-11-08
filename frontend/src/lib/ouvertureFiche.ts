"use client";

/**
 * Quand ouvrir une fiche : dès qu'elle est complète, ou au plus tard après un
 * court délai.
 *
 * Une fiche qui s'ouvre sur les seuls champs de sa carte, puis se complète
 * quand la fiche entière arrive (description, thématiques, documents), change
 * de taille sous les yeux du lecteur : c'est l'ouverture « saccadée ». Or la
 * fiche est presque toujours déjà là — demandée dès le survol de la carte.
 * On attend donc qu'elle soit complète, sans jamais faire attendre plus que
 * `delai` : passé ce délai, la fiche s'ouvre sur sa carte, et ce qui manque
 * arrive à sa place, en fondu (FicheAttente, FicheRubrique `arrivee`).
 *
 *   const prete = useOuvertureFiche(selId, !!qFiche.data);
 *   const fiche = selId == null || !prete ? null : qFiche.data ?? carte;
 */

import { useEffect, useState } from "react";

export function useOuvertureFiche(id: unknown, complete: boolean, delai = 250): boolean {
  const [ecoule, setEcoule] = useState<unknown>(null);   // la fiche dont le délai est passé
  useEffect(() => {
    if (id == null || complete) return;
    const t = setTimeout(() => setEcoule(id), delai);
    return () => clearTimeout(t);
  }, [id, complete, delai]);
  return id != null && (complete || ecoule === id);
}
