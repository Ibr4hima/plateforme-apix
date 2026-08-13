"use client";

// ── Remplacement d'un KPI depuis sa card ──────────────────────────────────────
// Icône « échanger » (Material Symbols « cached ») révélée au survol de la
// card : popover listant les indicateurs non affichés (groupes facultatifs),
// avec recherche et aperçu de la valeur — un clic remplace le KPI de la card.

import { useEffect, useRef, useState } from "react";

export const IconeCached = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/>
  </svg>
);

// Feuille de style des cards KPI remplaçables (icône révélée au survol)
export const STYLE_KPI_SWAP = `.kpi-swap{opacity:0;transform:rotate(0deg);transition:opacity .15s, transform .3s ease, background .15s, color .15s;}
.kpi-card:hover .kpi-swap,.kpi-swap[data-open="true"]{opacity:1;}
.kpi-swap:hover,.kpi-swap[data-open="true"]{transform:rotate(180deg);}`;

// Bouton rond « remplacer » posé en haut à droite d'une card .kpi-card
export function BtnSwapKpi({ ouvert, onClick }: { ouvert: boolean; onClick: () => void }) {
  return (
    <button className="kpi-swap" data-open={ouvert} data-picker-trigger
      aria-label="Remplacer cet indicateur" title="Remplacer cet indicateur"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 999, border: "none",
        background: ouvert ? "var(--bleu-action)" : "rgb(var(--bleu-rgb) / 0.08)", color: ouvert ? "var(--sur-bleu)" : "var(--bleu)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      <IconeCached />
    </button>
  );
}

export type PickerItem = { id: string; label: string; badge?: string | null; valeur: string; title?: string; groupe?: string };

export default function PickerKpi({ items, alignDroite, onPick, onClose }: {
  items: PickerItem[];             // indicateurs proposés (non épinglés), dans l'ordre canonique
  alignDroite?: boolean;           // ancrage à droite pour les cards de fin de ligne
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Clic extérieur — en ignorant les déclencheurs (bouton « échanger », card
    // vide) : React délègue ses événements sur document, comme ce listener, si
    // bien que stopPropagation ne peut pas l'en empêcher ; sans cette garde le
    // reclic sur le déclencheur fermerait ici puis rouvrirait au click.
    const clic = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.("[data-picker-trigger]")) return;
      if (ref.current && !ref.current.contains(t)) onClose();
    };
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", touche); };
  }, [onClose]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const dispo = items.filter(it => !q || it.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} onClick={e => e.stopPropagation()}
      style={{ position:"absolute", top:"calc(100% + 8px)", ...(alignDroite ? { right: 0 } : { left: 0 }), zIndex:60, width:320,
        border:"1px solid var(--bordure-forte)", borderRadius:12, background:"var(--carte)", boxShadow:"var(--ombre-2)", overflow:"hidden", cursor:"default", textAlign:"left" as const }}>
      <div style={{ padding:8, borderBottom:"1px solid var(--bordure)" }}>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un indicateur…"
          style={{ width:"100%", boxSizing:"border-box" as const, background:"var(--carte)", borderWidth:1, borderStyle:"solid", borderColor:"var(--bordure-forte)", borderRadius:9, padding:"8px 11px", fontSize: "var(--t-125)", color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)" }} />
      </div>
      <div style={{ maxHeight:262, overflowY:"auto" as const }}>
        {dispo.map((it, i) => (
          <div key={it.id}>
            {/* Bandeau de groupe (facultatif) au premier item de chaque groupe */}
            {it.groupe && it.groupe !== dispo[i-1]?.groupe && (
              <div style={{ fontSize: "var(--t-10)", fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.04)", padding:"5px 12px", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, top:0, zIndex:1 }}>{it.groupe}</div>
            )}
            <button title={it.title} onClick={() => onPick(it.id)}
              style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 12px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" as const, borderBottom:"1px solid var(--bordure)", transition:"background 0.1s", fontFamily:"var(--font-google-sans)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: "var(--t-12)", color:"var(--encre)", fontWeight:500, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{it.label}</span>
              {it.badge && <span style={{ fontSize: "var(--t-9)", color:"var(--gris)", fontWeight:600, background:"var(--fond)", padding:"1px 5px", borderRadius:4, whiteSpace:"nowrap" as const, flexShrink:0 }}>{it.badge}</span>}
              {/* Aperçu de la valeur : on voit ce qu'on obtient avant de remplacer */}
              <span style={{ fontSize: "var(--t-115)", fontWeight:700, color:"var(--bleu)", whiteSpace:"nowrap" as const, flexShrink:0 }}>{it.valeur}</span>
            </button>
          </div>
        ))}
        {dispo.length === 0 && <p style={{ fontSize: "var(--t-12)", color:"var(--gris)", textAlign:"center" as const, padding:"14px 0" }}>Aucun indicateur trouvé</p>}
      </div>
    </div>
  );
}
