import { useEffect } from "react";

/**
 * Ferme au clavier ce qui s'ouvre à la souris. Toute surcouche (modale,
 * mini-fiche, panneau) doit répondre à Échap : c'est le contrat clavier des
 * modales partagées (FicheModal, Confirmation…), que ce hook étend aux
 * modales définies dans les pages.
 */
export function useEchap(actif: boolean, fermer: () => void) {
  useEffect(() => {
    if (!actif) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [actif, fermer]);
}
