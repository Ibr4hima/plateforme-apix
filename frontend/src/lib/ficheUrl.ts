"use client";

// Deep-link « ?fiche=<id> » : la recherche globale (⌘K) navigue vers une page
// avec ce paramètre ; la page ouvre la fiche correspondante dès que sa liste
// est chargée, puis retire le paramètre de l'URL (fermer la fiche ne la
// rouvre pas au rafraîchissement).

import { useEffect } from "react";

export function useFicheUrl(liste: any[], ouvrir: (item: any) => void) {
  useEffect(() => {
    if (!liste.length) return;
    const verifier = () => {
      const p = new URLSearchParams(window.location.search);
      const id = p.get("fiche");
      if (!id) return;
      const item = liste.find(x => String(x.id) === id);
      p.delete("fiche");
      const qs = p.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
      if (item) ouvrir(item);
    };
    verifier();
    // La palette émet cet événement quand on est déjà sur la bonne page
    window.addEventListener("apix:fiche", verifier);
    return () => window.removeEventListener("apix:fiche", verifier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste]);
}
