"use client";

import { useRef, useState } from "react";
import { GrapheModal } from "@/components/charts/GrapheModalIde";
import { downloadPNG } from "@/components/charts/outilsExport";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

// ── Carte statique ────────────────────────────────────────────────────────────
// La présentation du tableau de bord : titre en petites capitales, pastille de
// période, aucun effet de survol sur le cadre, et un graphe vivant sur place —
// l'infobulle donne l'année et la valeur sans passer par une modale.
//
// Le téléchargement, lui, ne peut pas disparaître avec la modale : c'est le
// geste qui fait entrer un graphe dans une note ou une présentation. Il devient
// donc un bouton de la carte, en haut à droite.
function CarteStatique({ titre, tag, unite, series, grapheId, hideLegend, sansExport, children }: any) {
  const boite = useRef<HTMLDivElement>(null);
  const visibles = (series || []).filter((s: any) => s.data.some((d: any) => d.valeur !== null));
  const telecharger = () => {
    const svg = boite.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    // Le PNG porte son propre en-tête : sorti de la page, il doit encore dire
    // ce qu'il montre, sur quelle période et avec quelles séries.
    downloadPNG(svg, grapheId || titre || "graphe", {
      titre: unite ? `${titre} · ${unite}` : titre,
      annees: tag ? tag.replace("–", " – ") : "",
      legende: visibles.map((s: any) => ({ nom: s.nom, couleur: s.couleur })),
    });
  };
  return (
    <div style={{ background:"var(--carte)", borderRadius:14, border:"1px solid rgb(var(--encre-rgb) / 0.12)", padding:"16px 18px", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:14 }}>
        <p style={{ fontSize:11, fontWeight:800, color:"var(--bleu)", letterSpacing:"0.14em", textTransform:"uppercase" as const,
          margin:0, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, minWidth:0 }}>
          <span>{titre}</span>
          {tag && <span style={{ fontSize:9, fontWeight:700, color:"var(--gris)", background:"var(--bleu-voile)", padding:"2px 8px",
            borderRadius:5, letterSpacing:"0.04em", textTransform:"none" as const, fontVariantNumeric:"tabular-nums" }}>{tag}</span>}
        </p>
        {/* Pas de bouton quand le contenu n'est pas un SVG (un tableau, par
            exemple) : il n'y aurait rien a exporter, et un bouton inerte est
            pire que pas de bouton. */}
        {!sansExport && <button onClick={telecharger} title="Télécharger le graphe en PNG" aria-label={`Télécharger « ${titre} » en PNG`}
          style={{ flexShrink:0, width:28, height:28, borderRadius:8, border:"1px solid var(--bordure)", background:"var(--carte)",
            color:"var(--gris)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s, color 0.15s, border-color 0.15s" }}
          onMouseEnter={e=>{ e.currentTarget.style.background="var(--bleu-voile)"; e.currentTarget.style.color="var(--bleu)"; e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.background="var(--carte)"; e.currentTarget.style.color="var(--gris)"; e.currentTarget.style.borderColor="var(--bordure)"; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>}
      </div>
      {!hideLegend && visibles.length > 0 && <LegendeGraphe series={visibles} style={{ marginBottom: 8 }} />}
      <div ref={boite}>{children}</div>
    </div>
  );
}

// ── Card graphe miniature (page IDE) ──────────────────────────────────────────
export function GrapheCard({ titre, sous_titre, unite, source, children, fullChildren, analyse, series, grapheId, hideLegend, hideSousTitre, statique, tag, sansExport }: any) {
  // La carte, elle, n'a ni pied ni place pour trois lignes : unité, source et
  // note s'y recomposent en une seule légende discrète. Les ANNÉES n'y figurent
  // plus — la modale les porte déjà en pastille.
  const legende = [unite, source, sous_titre].filter(Boolean).join(" · ");
  const [open, setOpen] = useState(false);

  // Carte statique — la présentation du tableau de bord : pas de clic, pas de
  // modale, et le graphe reste vivant sur place (le survol y donne l'année et
  // la valeur). Réservée aux graphes qui occupent déjà toute la largeur : ils
  // n'ont plus rien à gagner à s'agrandir, et une carte qui se soulève au
  // survol sans mener nulle part promet une action qui n'existe pas.
  if (statique) return <CarteStatique titre={titre} tag={tag} unite={unite} series={series} grapheId={grapheId} hideLegend={hideLegend} sansExport={sansExport}>{children}</CarteStatique>;

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
