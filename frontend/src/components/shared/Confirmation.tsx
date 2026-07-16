"use client";

// Confirmation maison remplaçant les confirm() natifs (hors charte pour des
// suppressions définitives). Usage : `if (!(await confirmer("Supprimer ?"))) return;`
// — même contrat booléen que confirm(). L'hôte <ConfirmationHote/> est monté
// une seule fois dans Providers ; s'il n'est pas monté (cas limite), on
// retombe sur window.confirm pour ne jamais bloquer une action.

import { useEffect, useState } from "react";
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

  if (!monte || !demande) return null;

  return createPortal(
    <div onClick={() => repondre(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true"
        style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.18s ease" }}>
        <div style={{ height: 4, background: "#dc2626", flexShrink: 0 }} />
        <div style={{ padding: "22px 26px 18px" }}>
          <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: 0, lineHeight: 1.3 }}>
            {demande.titre || "Confirmation"}
          </h2>
          <p style={{ fontSize: 13.5, color: "#4a5568", lineHeight: 1.65, marginTop: 10, whiteSpace: "pre-line" }}>
            {demande.message}
          </p>
        </div>
        <div style={{ padding: "14px 26px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => repondre(false)} autoFocus
            style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
            Annuler
          </button>
          <button onClick={() => repondre(true)}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(220,38,38,0.25)", fontFamily: "var(--font-google-sans)" }}>
            {demande.boutonOk || "Confirmer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
