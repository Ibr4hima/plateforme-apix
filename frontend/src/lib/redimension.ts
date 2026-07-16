// Redimensionnement des sidebars de filtres — logique unique remplaçant les
// copies locales de startResize dans chaque page.
import type { RefObject } from "react";

export function demarrerRedimension(
  e: React.MouseEvent,
  largeur: number,
  setLargeur: (w: number) => void,
  enCours: RefObject<boolean>,
  min = 200,
  max = 520,
) {
  e.preventDefault();
  enCours.current = true;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  const startX = e.clientX, startW = largeur;
  const onMove = (ev: MouseEvent) => {
    if (!enCours.current) return;
    setLargeur(Math.max(min, Math.min(max, startW + ev.clientX - startX)));
  };
  const onUp = () => {
    enCours.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
