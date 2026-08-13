"use client";

// Confirmation maison remplaçant les confirm() natifs (hors charte pour des
// suppressions définitives). Usage : `if (!(await confirmer("Supprimer ?"))) return;`
// — même contrat booléen que confirm(). L'hôte <ConfirmationHote/> est monté
// une seule fois dans Providers ; s'il n'est pas monté (cas limite), on
// retombe sur window.confirm pour ne jamais bloquer une action.

import { useEffect, useState } from "react";
import { useDialogue } from "@/lib/dialogue";
import { createPortal } from "react-dom";

type Options = { titre?: string; boutonOk?: string };
type Demande = Options & { message: string };

let ouvrirHote: ((d: Demande) => void) | null = null;
let resoudre: ((ok: boolean) => void) | null = null;

export function confirmer(message: string, options: Options = {}): Promise<boolean> {
  return new Promise(res => {
    if (!ouvrirHote) { res(window.confirm(message)); return; }
    resoudre = res;
    ouvrirHote({ message, ...options });
  });
}

export default function ConfirmationHote() {
  const [demande, setDemande] = useState<Demande | null>(null);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    setMonte(true);
    ouvrirHote = setDemande;
    return () => { ouvrirHote = null; };
  }, []);

  const repondre = (ok: boolean) => {
    setDemande(null);
    resoudre?.(ok);
    resoudre = null;
  };

  useEffect(() => {
    if (!demande) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") repondre(false);
      if (e.key === "Enter") repondre(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Contrat clavier : piège de Tab, focus pris puis restitué au déclencheur.
  const dial = useDialogue(monte && !!demande);

  if (!monte || !demande) return null;

  return createPortal(
    <div onClick={() => repondre(false)}
      style={{ position: "fixed", inset: 0, background: "rgb(var(--encre-rgb) / 0.45)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div {...dial} onClick={e => e.stopPropagation()} role="alertdialog"
        style={{ background: "var(--carte)", borderRadius: 20, width: "100%", maxWidth: 440, overflow: "hidden", border: "1px solid var(--bordure)", boxShadow: "var(--ombre-2)", animation: "vueIn 0.18s ease" }}>
        <div style={{ padding: "22px 26px 18px" }}>
          <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--encre)", margin: 0, lineHeight: 1.3 }}>
            {demande.titre || "Confirmation"}
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--texte)", lineHeight: 1.65, marginTop: 10, whiteSpace: "pre-line" }}>
            {demande.message}
          </p>
        </div>
        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--bordure)", background: "var(--carte-douce)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => repondre(false)} autoFocus
            style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--texte)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
            Annuler
          </button>
          <button onClick={() => repondre(true)}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--danger-action)", color: "var(--sur-bleu)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.25)", fontFamily: "var(--font-google-sans)" }}>
            {demande.boutonOk || "Confirmer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
