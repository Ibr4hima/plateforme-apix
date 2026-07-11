"use client";

import { useEffect, useRef } from "react";

// ── Accessibilité des modals ──────────────────────────────────────────────────
// À poser sur le conteneur du dialogue (pas l'overlay) :
//   const dlgRef = useModalA11y(onClose);
//   <div ref={dlgRef} role="dialog" aria-modal="true" …>
// Fournit : fermeture à Échap, piège de focus (Tab/Shift+Tab bouclent dans le
// dialogue), focus initial sur le premier élément focalisable, et restauration
// du focus à l'élément déclencheur à la fermeture.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const declencheur = document.activeElement as HTMLElement | null;
    // Focus initial : premier élément focalisable du dialogue
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(document.activeElement)) return; // ex. autoFocus déjà posé
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      (first || el).focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(f => f.offsetParent !== null || f === document.activeElement);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Piège : boucler aux extrémités, et rapatrier le focus s'il est sorti
      if (!active || !el.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      declencheur?.focus?.();
    };
  }, []);

  return ref;
}
