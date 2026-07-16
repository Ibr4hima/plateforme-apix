"use client";

// État synchronisé avec l'URL (?cle=valeur) : les onglets et vues des pages
// deviennent partageables par lien et survivent au rafraîchissement.
// Implémenté sur window.location + history.replaceState (pas de
// useSearchParams : les pages restent prérendables statiquement sans
// Suspense, et le changement d'onglet ne déclenche aucune navigation Next).

import { useCallback, useEffect, useState } from "react";

export function useEtatUrl<T extends string>(
  cle: string,
  defaut: T,
  valides?: readonly T[],
): [T, (v: T) => void] {
  const [valeur, setValeur] = useState<T>(defaut);

  // Lecture initiale côté client uniquement (pages 100 % client)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(cle) as T | null;
    if (v && v !== valeur && (!valides || valides.includes(v))) setValeur(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changer = useCallback((v: T) => {
    setValeur(v);
    const p = new URLSearchParams(window.location.search);
    if (v === defaut) p.delete(cle); else p.set(cle, v);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [cle, defaut]);

  return [valeur, changer];
}
