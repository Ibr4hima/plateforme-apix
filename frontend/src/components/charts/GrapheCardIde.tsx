"use client";

import { useState } from "react";
import { GrapheModal } from "@/components/charts/GrapheModalIde";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

// ── Card graphe miniature (page IDE) ──────────────────────────────────────────
export function GrapheCard({ titre, sous_titre, unite, source, children, fullChildren, analyse, series, grapheId, hideLegend, hideSousTitre }: any) {
  // La carte, elle, n'a ni pied ni place pour trois lignes : unité, source et
  // note s'y recomposent en une seule légende discrète. Les ANNÉES n'y figurent
  // plus — la modale les porte déjà en pastille.
  const legende = [unite, source, sous_titre].filter(Boolean).join(" · ");
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={()=>setOpen(true)}
        style={{ background:"var(--carte)", borderRadius:14, border:"1px solid rgb(var(--encre-rgb) / 0.12)", padding:"16px 18px", cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", minWidth:0 }}
        onMouseEnter={e=>{ e.currentTarget.style.boxShadow="var(--ombre-1)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const span=box.firstElementChild as HTMLElement|null; if(!span) return; const d=span.scrollWidth-(box as HTMLElement).clientWidth; if(d>0){ span.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; span.style.transform=`translateX(-${d}px)`; } }); }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const span=box.firstElementChild as HTMLElement|null; if(!span) return; span.style.transition="transform 0.4s ease"; span.style.transform="translateX(0)"; }); }}>

        {/* Header : titre + légende + expand */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const }}>
              <h3 style={{ fontWeight:700, fontSize:13.5, color:"var(--encre)", margin:0, display:"inline-block" }}>{titre}</h3>
            </div>
            {!hideLegend && series?.length > 0 && (
              <LegendeGraphe series={series.filter((s:any)=>s.data.some((d:any)=>d.valeur!==null))} style={{ marginTop: 5 }} />
            )}
            {!hideSousTitre && legende && <p style={{ fontSize:10.5, color:"var(--gris)", marginTop:4 }}>{legende}</p>}
          </div>
          {analyse && <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
            <span style={{ fontSize:9, fontWeight:800, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"2px 8px", borderRadius:999, letterSpacing:"0.08em" }}>ANALYSE</span>
          </div>}
        </div>
        <div style={{ pointerEvents:"none" }}>{children}</div>
      </div>

      <GrapheModal open={open} onClose={()=>setOpen(false)} titre={titre} sous_titre={sous_titre} unite={unite} source={source} analyse={analyse} series={series} grapheId={grapheId}>
        {fullChildren || children}
      </GrapheModal>
    </>
  );
}
