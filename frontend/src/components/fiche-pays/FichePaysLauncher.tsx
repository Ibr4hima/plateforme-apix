"use client";

// Lien « Fiche Pays » de la navbar : ouvre la page /fiche-pays (la fiche
// n'est plus une modal). L'événement apix:fiche-pays (recherche globale ⌘K)
// y navigue directement avec le pays choisi face au Sénégal.

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function FichePaysLauncher({ textColor, textHover }: { textColor: string; textHover: string }) {
  const [senId, setSenId] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${API}/statistiques/pays`).then(r => r.json())
      .then((ps: any[]) => setSenId(ps.find(p => p.code_iso3 === "SEN")?.id ?? null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: Event) => {
      const paysId = (e as CustomEvent).detail?.paysId;
      if (paysId == null) return;
      const ids = senId !== null && senId !== paysId ? [senId, paysId] : [paysId];
      window.location.href = `/fiche-pays?pays=${ids.join(",")}`;
    };
    window.addEventListener("apix:fiche-pays", h);
    return () => window.removeEventListener("apix:fiche-pays", h);
  }, [senId]);
  return (
    <Link href="/fiche-pays"
      style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em", textDecoration: "none" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
      Fiche Pays
    </Link>
  );
}
