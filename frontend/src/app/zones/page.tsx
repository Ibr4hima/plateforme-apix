"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import { ZONE_TYPE_META, ZONE_TYPE_ORDER } from "@/components/shared/zoneTypes";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards, SkeletonChart } from "@/components/shared/Skeleton";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { Building2, ChevronRight, FileText, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

const TYPE_META = ZONE_TYPE_META;

const POLE_COLORS = ["#FFD9B3","#FFF4A3","#C8EEC8","#A8DFE8","#B8C8F8","#D8B8F0","#FADADD","#F0D8C8"];

// ── Sunburst par type ─────────────────────────────────────────────────────────
function SunburstZones({ zones }: { zones:any[] }) {
  const gate = useAuthGate();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ficheEnt, setFicheEnt] = useState<any>(null);

  useEffect(() => {
    if (!zones.length || !svgRef.current || !wrapRef.current) return;
    const W = wrapRef.current.clientWidth || 900;
    const H = 500;

    const byType: Record<string,any[]> = {};
    zones.forEach(z => { if (!byType[z.type_zone]) byType[z.type_zone] = []; byType[z.type_zone].push(z); });

    const tree = {
      name: "Zones d'Investissement",
      children: Object.entries(byType).map(([type,zs]) => ({
        name: TYPE_META[type]?.label || type,
        type,
        children: zs.map(z => ({
          name: z.nom_zone, type,
          value: 1, data: z,
          children: z.entreprises?.filter((ze:any)=>ze.statut==="installee").length > 0
            ? z.entreprises.filter((ze:any)=>ze.statut==="installee").map((ze:any)=>({ name: ze.entreprise?.nom||"—", type, value:1, data:ze.entreprise }))
            : undefined,
        })),
      })),
    };

    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();

    const hierarchy = d3.hierarchy(tree).sum((d:any)=>d.children?0:1)
      .sort((a,b)=>(b.height-a.height)||((b.value||0)-(a.value||0)));
    const root = d3.partition<any>().size([H,(hierarchy.height+1)*W/3])(hierarchy as any);

    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("width",W).attr("height",H).attr("style","max-width:100%;height:auto;");

    const ZONE_COL: Record<string,string> = { ZES:POLE_COLORS[0], ZAI:POLE_COLORS[1], ZFI:POLE_COLORS[2] };
    const getColor = (d:any):string => {
      if (d.depth===0) return "#F2F2F2";
      let n=d; while(n.depth>1) n=n.parent;
      const c = ZONE_COL[n.data.type] || "#9aa5b4";
      const a = d.depth===1?0.45:d.depth===2?0.40:d.depth===3?0.37:0.12+d.depth*0.15;
      return c + Math.round(Math.min(a,0.85)*255).toString(16).padStart(2,"0");
    };
    const rectH = (d:any)=>Math.max(0,d.x1-d.x0-Math.min(1,(d.x1-d.x0)/2));
    const labelOk = (d:any)=>d.y1<=W&&d.y0>=0&&d.x1-d.x0>16;

    const cell = svg.selectAll<SVGGElement,any>("g").data(root.descendants()).join("g")
      .attr("transform",(d:any)=>`translate(${d.y0},${d.x0})`);

    cell.append("rect")
      .attr("width",(d:any)=>Math.max(0,d.y1-d.y0-1))
      .attr("height",(d:any)=>rectH(d))
      .attr("fill",getColor).attr("stroke","#F2F0EF").attr("stroke-width",0.05)
      .style("cursor","pointer");

    const text = cell.append("text").style("user-select","none").attr("pointer-events","none")
      .attr("x",6).attr("y",14)
      .attr("font-size",(d:any)=>d.depth===0?13:d.depth===1?12:11)
      .attr("font-weight",(d:any)=>d.depth<=1?700:400)
      .attr("font-family","var(--font-google-sans),sans-serif")
      .attr("fill","#1a1a2e").attr("fill-opacity",(d:any)=>+labelOk(d));

    text.append("tspan").text((d:any)=>{
      const w=(d.y1-d.y0)-12; const n=d.data.name||""; const c=Math.floor(w/6.5);
      return n.length>c?n.slice(0,Math.max(3,c-1))+"…":n;
    });

    // ── Badges via foreignObject (centrage CSS parfait) ───────────────────────
    const getTypeColor = (d:any):string => { let n=d; while(n.depth>1) n=n.parent; return TYPE_META[n.data.type]?.color||"#9aa5b4"; };

    // depth=1 : badge "N ZES" centré sous le titre
    cell.filter((d:any)=>d.depth===1&&d.children&&labelOk(d)&&(d.x1-d.x0)>32)
      .each(function(d:any) {
        const n=d.children?.length||0; if(!n) return;
        const col=getTypeColor(d);
        const w=Math.max(0,d.y1-d.y0-12);
        d3.select(this as SVGGElement).append("foreignObject")
          .attr("x",6).attr("y",18).attr("width",w).attr("height",26)
          .attr("pointer-events","none")
          .append("xhtml:div")
          .style("display","inline-flex").style("align-items","center").style("justify-content","center")
          .style("height","18px").style("padding","0 7px")
          .style("background",col+"22").style("border",`1px solid ${col}55`)
          .style("border-radius","8px").style("font-size","9px").style("font-weight","700")
          .style("font-family","var(--font-google-sans),sans-serif").style("color",col)
          .style("white-space","nowrap").style("line-height","18px")
          .text(`${n} ${d.data.type||""}`);
      });

    // depth=2 : badge numérique aligné à droite sur la ligne du nom
    cell.filter((d:any)=>d.depth===2&&labelOk(d)&&(d.x1-d.x0)>24)
      .each(function(d:any) {
        const ents=(d.data.data?.entreprises||[]).filter((ze:any)=>ze.statut==="installee").length;
        if(!ents) return;
        const col=getTypeColor(d);
        const w=Math.max(0,d.y1-d.y0-12);
        d3.select(this as SVGGElement).append("foreignObject")
          .attr("x",6).attr("y",2).attr("width",w).attr("height",18)
          .attr("pointer-events","none")
          .append("xhtml:div")
          .style("display","flex").style("justify-content","flex-end").style("align-items","center").style("height","18px")
          .append("xhtml:span")
          .style("display","inline-flex").style("align-items","center")
          .style("height","15px").style("padding","0 6px")
          .style("background",col+"22").style("border",`1px solid ${col}55`)
          .style("border-radius","6px").style("font-size","9px").style("font-weight","700")
          .style("font-family","var(--font-google-sans),sans-serif").style("color",col)
          .text(`${ents}`);
      });

    let focus=root;
    cell.select("rect").on("click",function(_:any,p:any){
      if(p.depth===3&&p.data.data?.id){
        gate(()=>{
          fetch(`${API_BASE}/entreprises/${p.data.data.id}`)
            .then(r=>r.json()).then(d=>setFicheEnt(d)).catch(()=>{});
        });
        return;
      }
      focus=focus===p?(p=p.parent):p;
      if(!p) return;
      root.each((d:any)=>{ d.target={
        x0:(d.x0-p.x0)/(p.x1-p.x0)*H, x1:(d.x1-p.x0)/(p.x1-p.x0)*H,
        y0:d.y0-p.y0, y1:d.y1-p.y0,
      };});
      const t=cell.transition().duration(750).ease(d3.easeCubicInOut)
        .attr("transform",(d:any)=>`translate(${d.target.y0},${d.target.x0})`);
      cell.select("rect").transition(t).attr("height",(d:any)=>rectH(d.target));
      text.transition(t).attr("fill-opacity",(d:any)=>+labelOk(d.target));
    });
    cell.append("title").text((d:any)=>d.ancestors().map((n:any)=>n.data.name).reverse().join(" › "));
  },[zones]);

  return (
    <div ref={wrapRef}>
      <svg ref={svgRef} style={{ width:"100%",height:500,display:"block" }}/>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={()=>setFicheEnt(null)}/>
    </div>
  );
}

// ── Vue types de zones (cards + liste) ───────────────────────────────────────
function ZonesParType({ zones }: { zones: any[] }) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [detailZone, setDetailZone] = useState<any>(null);

  // Group zones by type_zone, preserving insertion order
  const byType: Record<string, any[]> = {};
  zones.forEach(z => {
    if (!byType[z.type_zone]) byType[z.type_zone] = [];
    byType[z.type_zone].push(z);
  });

  const ordreType = (t: string) => { const i = ZONE_TYPE_ORDER.indexOf(t); return i === -1 ? ZONE_TYPE_ORDER.length : i; };
  const types = Object.entries(byType).map(([type, zs]) => ({
    type,
    meta: TYPE_META[type] || { label: type, color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.2)" },
    zones: zs,
    installed: zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length, 0),
    eligible:  zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "eligible").length, 0),
    superficie: zs.reduce((s, z) => s + (Number(z.superficie) || 0), 0),
  })).sort((a, b) => ordreType(a.type) - ordreType(b.type));

  const selectedInfo = selectedType ? types.find(t => t.type === selectedType) : null;

  return (
    <div>
      {/* ── Cards types ── */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(types.length, 3)},1fr)`, gap:14, marginBottom: selectedType ? 32 : 0 }}>
        {types.map(t => {
          const active = selectedType === t.type;
          const c = t.meta.color;
          const entreprises = t.installed + t.eligible;
          const GRADS: Record<string,string> = {
            "#004f91":"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
            "#ca631f":"linear-gradient(90deg,#9c4a15 0%,#ca631f 60%,#e07a2e 100%)",
            "#188038":"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)",
          };
          const grad = GRADS[c] || `linear-gradient(90deg,${c} 0%,${c} 100%)`;
          return (
            <div key={t.type} onClick={() => setSelectedType(active ? null : t.type)}
              style={{ background:"#fff", border:`1.5px solid ${c}${active ? "99" : "73"}`, borderRadius:14, cursor:"pointer",
                transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",
                boxShadow: active ? `0 12px 28px ${c}2e` : `0 4px 18px ${c}26`,
                transform: active ? "translateY(-2px)" : "none",
                display:"flex", flexDirection:"column" as const, overflow:"hidden", minWidth:0 }}
              onMouseEnter={ev => {
                if (!active) { ev.currentTarget.style.boxShadow = `0 12px 28px ${c}2e`; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = `${c}99`; }
                // Titre trop long : glisse pour révéler la fin
                const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                const span = box?.firstElementChild as HTMLElement | null;
                if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
              }}
              onMouseLeave={ev => {
                if (!active) { ev.currentTarget.style.boxShadow = `0 4px 18px ${c}26`; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = `${c}73`; }
                const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
              }}>

              {/* Bandeau du type — même style que « Prochain événement » */}
              <div style={{ display:"flex", alignItems:"center", gap:7, background:grad, padding:"6px 16px" }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:"#fff", animation:"pulseDot 1.6s ease-out infinite", flexShrink:0 }}/>
                <span style={{ fontSize:10, fontWeight:800, color:"#fff", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>{t.type}</span>
                {active && (
                  <span style={{ marginLeft:"auto", width:16, height:16, borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </div>

              <div style={{ padding:"14px 16px 14px", flex:1 }}>
                {/* Libellé du type (défile au survol si trop long) */}
                <div data-marquee style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", lineHeight:1.35, overflow:"hidden", whiteSpace:"nowrap" as const }}>
                  <span style={{ display:"inline-block" }}>{t.meta.label}</span>
                </div>

                {/* Compteurs libellés */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                  <div style={{ background:`${c}0A`, border:`1px solid ${c}1F`, borderRadius:10, padding:"8px 11px" }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Entreprise{entreprises>1?"s":""}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:entreprises>0?"#1a1a2e":"#9aa5b4" }}>{entreprises}</p>
                  </div>
                  <div style={{ background:`${c}0A`, border:`1px solid ${c}1F`, borderRadius:10, padding:"8px 11px" }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Zone{t.zones.length>1?"s":""}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:t.zones.length>0?"#1a1a2e":"#9aa5b4" }}>{t.zones.length}</p>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div style={{ display:"flex", borderTop:"1px solid #F2F0EF" }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"10px 0", fontSize:11.5, color:c, fontWeight:700, transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background=`${c}0D`}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  {active ? "Affiché" : "Voir les zones"} <ChevronRight size={13}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Liste des zones du type sélectionné ── */}
      {selectedInfo && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:15, padding:"15px 20px", marginBottom:20, borderRadius:16,
            background:`linear-gradient(100deg, ${selectedInfo.meta.color}14 0%, ${selectedInfo.meta.color}06 42%, rgba(255,255,255,0) 100%)`,
            border:`1px solid ${selectedInfo.meta.color}22` }}>
            <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#fff", border:`1px solid ${selectedInfo.meta.border}`, boxShadow:`0 2px 6px ${selectedInfo.meta.color}1a` }}>
              <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.02em", color:selectedInfo.meta.color }}>{selectedInfo.type}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:selectedInfo.meta.color, textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:3 }}>Type de zone</div>
              <div style={{ fontWeight:800, fontSize:16, color:"#1a1a2e", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{selectedInfo.meta.label}</div>
            </div>
            <span style={{ display:"inline-flex", alignItems:"center", fontSize:12.5, fontWeight:700, color:"#fff", background:selectedInfo.meta.color, padding:"6px 15px", borderRadius:999, flexShrink:0, whiteSpace:"nowrap" as const, boxShadow:`0 2px 8px ${selectedInfo.meta.color}40` }}>
              {selectedInfo.zones.length} zone{selectedInfo.zones.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {selectedInfo.zones.map((z: any) => <ZoneBigCard key={z.id} zone={z} color={selectedInfo.meta.color} onClick={()=>setDetailZone(z)} />)}
          </div>
        </div>
      )}

      {detailZone && <ZoneDetailModal zone={detailZone} onClose={()=>setDetailZone(null)} />}
    </div>
  );
}

// ── Grande card zone (ouvre le modal détail) ──────────────────────────────────
function ZoneBigCard({ zone, color="#004f91", onClick }: { zone:any; color?:string; onClick:()=>void }) {
  const entreprises = (zone.entreprises||[]).length;
  const c = color;
  return (
    <div onClick={onClick}
      style={{ background:"#fff", border:"1px solid #ECEAE7", borderRadius:14, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", display:"flex", flexDirection:"column" as const, overflow:"hidden" }}
      onMouseEnter={e=>{
        e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor=`${c}40`;
        // Contenus trop longs : glissent pour révéler la fin
        e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
          const span = box.firstElementChild as HTMLElement | null;
          if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
        });
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor="#ECEAE7";
        e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
          const span = box.firstElementChild as HTMLElement | null;
          if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
        });
      }}>

      <div style={{ height:3, background:`linear-gradient(90deg,${c}CC 0%,${c} 50%,${c}99 100%)`, flexShrink:0 }}/>
      <div style={{ padding:"14px 16px 14px", flex:1 }}>
        {/* Pôle */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          {zone.pole_nom ? (
            <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:c, background:`${c}12`, padding:"3px 10px", borderRadius:999, overflow:"hidden", whiteSpace:"nowrap" as const, maxWidth:"100%" }}>{zone.pole_nom}</span>
          ) : <span/>}
        </div>

        {/* Nom de la zone */}
        <div style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{zone.nom_zone}</div>

        {/* Infos libellées */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
          <div style={{ background:`${c}0A`, border:`1px solid ${c}1F`, borderRadius:10, padding:"8px 11px", minWidth:0 }}>
            <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Localisation</p>
            <p data-marquee style={{ fontSize:12, fontWeight:600, color:(zone.departement_nom||zone.region_nom)?"#1a1a2e":"#9aa5b4", overflow:"hidden", whiteSpace:"nowrap" as const }}>
              <span style={{ display:"inline-block" }}>{[zone.departement_nom, zone.region_nom].filter(Boolean).join(", ") || "—"}</span>
            </p>
          </div>
          <div style={{ background:`${c}0A`, border:`1px solid ${c}1F`, borderRadius:10, padding:"8px 11px" }}>
            <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Entreprise{entreprises>1?"s":""}</p>
            <p style={{ fontSize:12, fontWeight:600, color:entreprises>0?"#1a1a2e":"#9aa5b4" }}>{entreprises}</p>
          </div>
        </div>
      </div>

      {/* Action */}
      <div style={{ display:"flex", borderTop:"1px solid #F2F0EF" }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"10px 0", fontSize:11.5, color:c, fontWeight:600, transition:"background 0.15s" }}
          onMouseEnter={ev=>ev.currentTarget.style.background=`${c}0D`}
          onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
          Voir les détails →
        </div>
      </div>
    </div>
  );
}

// ── Modal détail zone ─────────────────────────────────────────────────────────
function ZoneDetailModal({ zone, onClose }: { zone:any; onClose:()=>void }) {
  const gate = useAuthGate();
  const [ficheEnt,  setFicheEnt]  = useState<any>(null);
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(() => {
    setSecteurs([]); setBranches([]); setActivites([]);
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); })
      .catch(()=>{});
  }, [zone.id]);

  const ouvrirFiche = (id:number) => gate(async () => {
    try { const res=await fetch(`${API_BASE}/entreprises/${id}`); setFicheEnt(await res.json()); }
    catch(e){ console.error(e); }
  });

  const meta      = TYPE_META[zone.type_zone]||TYPE_META.ZES;
  const col       = meta.color;
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee");
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible");
  const secIds: number[] = zone.secteur_ids||[];
  const braIds: number[] = zone.branche_ids||[];
  const actIds: number[] = zone.activite_ids||[];
  const hasActivites = secIds.length>0||braIds.length>0||actIds.length>0;
  const locStr = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");

  const SecTitle = ({children}:{children:React.ReactNode}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );
  const LigneEnt = ({ze}:{ze:any}) => (
    <div onClick={()=>ouvrirFiche(ze.entreprise?.id)}
      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#FAFAF9",borderRadius:12,border:"1px solid #F0EEEC",cursor:"pointer",transition:"border-color 0.15s, background 0.15s"}}
      onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";ev.currentTarget.style.background="#fff";}}
      onMouseLeave={ev=>{ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ze.entreprise?.nom}</div>
        {ze.entreprise?.forme_juridique&&<div style={{fontSize:11,color:"#9aa5b4"}}>{ze.entreprise.forme_juridique}</div>}
      </div>
      <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,79,145,0.07)",borderRadius:7,padding:"5px 10px",fontSize:11,color:"#004f91",fontWeight:600,flexShrink:0}}>
        Fiche →
      </span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
          {/* Liseré d'accent */}
          <div style={{height:4,background:"#004f91",flexShrink:0}}/>

          {/* En-tête */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
            <div style={{minWidth:0}}>
              <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{zone.nom_zone}</h2>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:800,letterSpacing:"0.04em",color:col,background:`${col}12`,padding:"3px 10px",borderRadius:999}}>{zone.type_zone}</span>
                {zone.pole_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{zone.pole_nom}</span>}
              </div>
            </div>
            <button onClick={onClose}
              style={{background:"#F5F4F3",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
              onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
              onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
              <X size={15} color="#4a5568"/>
            </button>
          </div>

          {/* Corps */}
          <div style={{padding:"22px 28px",overflowY:"auto" as const,flex:1,display:"flex",flexDirection:"column" as const,gap:22}}>

            {/* Informations */}
            {(zone.date_creation||zone.superficie||locStr||zone.decret_creation)&&(
              <section>
                <SecTitle>Informations</SecTitle>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {locStr&&<Bloc label="Localisation"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p></Bloc>}
                  {zone.superficie&&<Bloc label="Superficie"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</p></Bloc>}
                  {zone.date_creation&&<Bloc label="Création"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(zone.date_creation)}</p></Bloc>}
                  {zone.decret_creation&&<Bloc label="Décret"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{zone.decret_creation}</p></Bloc>}
                </div>
              </section>
            )}

            {/* Description */}
            {zone.description&&(
              <section>
                <SecTitle>Description</SecTitle>
                <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                  <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                  <div data-rte dangerouslySetInnerHTML={{__html:zone.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
                </div>
              </section>
            )}

            {/* Activités autorisées */}
            {hasActivites&&secteurs.length>0&&(
              <section>
                <SecTitle>Activités autorisées</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {secIds.map((secId:number)=>{
                    const sec=secteurs.find((s:any)=>s.id===secId); if(!sec) return null;
                    const brasDuSec=branches.filter((b:any)=>b.secteur_id===secId&&braIds.includes(b.id));
                    return (
                      <div key={secId}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                        </div>
                        {brasDuSec.length>0&&(
                          <div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                            {brasDuSec.map((bra:any)=>{
                              const actsDeBra=activites.filter((a:any)=>a.branche_id===bra.id&&actIds.includes(a.id));
                              return (
                                <div key={bra.id}>
                                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                    <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                                  </div>
                                  {actsDeBra.length>0&&(
                                    <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                      {actsDeBra.map((act:any)=>(
                                        <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                          <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                          <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Entreprises installées */}
            {installes.length>0&&(
              <section>
                <SecTitle>Entreprises installées ({installes.length})</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:installes.length>3?200:undefined,overflowY:installes.length>3?"auto" as const:undefined,paddingRight:installes.length>3?4:undefined}}>
                  {installes.map((ze:any)=><LigneEnt key={ze.id||ze.entreprise?.id} ze={ze}/>)}
                </div>
              </section>
            )}

            {/* Entreprises éligibles */}
            {eligibles.length>0&&(
              <section>
                <SecTitle>Entreprises éligibles ({eligibles.length})</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:eligibles.length>3?200:undefined,overflowY:eligibles.length>3?"auto" as const:undefined,paddingRight:eligibles.length>3?4:undefined}}>
                  {eligibles.map((ze:any)=><LigneEnt key={ze.id||ze.entreprise?.id} ze={ze}/>)}
                </div>
              </section>
            )}

            {/* Documents PDF */}
            {zone.fichiers?.length>0&&(
              <section>
                <SecTitle>{zone.fichiers.length>1?"Documents":"Document"}</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                  {zone.fichiers.map((f:any)=>(
                    <a key={f.id} href={`${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                      <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                      <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{f.titre||f.nom}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Pied */}
          <div style={{display:"flex",justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",flexShrink:0}}>
            <button onClick={onClose}
              style={{padding:"10px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
              Fermer
            </button>
          </div>
        </div>
      </div>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={()=>setFicheEnt(null)}/>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ZonesPage() {
  const [zones,      setZones]      = useState<any[]>([]);
  const [polesCount, setPolesCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [erreur,     setErreur]     = useState(false);
  const [tick,       setTick]       = useState(0);
  const [onglet,     setOnglet]     = useState<"zones"|"territoire">("zones");

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  useEffect(()=>{
    setLoading(true); setErreur(false);
    fetch(`${API_BASE}/zones-types`)
      .then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>{ setZones(d||[]); })
      .catch(()=>setErreur(true)).finally(()=>setLoading(false));
    fetch(`${API_BASE}/zones-types/poles`)
      .then(r=>r.json()).then((d:any[])=>setPolesCount(d?.length||0)).catch(()=>{});
  },[tick]);

  const stats = {
    total:      zones.length,
    poles:      polesCount,
    zes:        zones.filter(z=>z.type_zone==="ZES").length,
    zai:        zones.filter(z=>z.type_zone==="ZAI").length,
    zfi:        zones.filter(z=>z.type_zone==="ZFI").length,
    installes:  zones.reduce((s,z)=>s+(z.entreprises||[]).filter((ze:any)=>ze.statut==="installee").length,0),
    eligibles:  zones.reduce((s,z)=>s+(z.entreprises||[]).filter((ze:any)=>ze.statut==="eligible").length,0),
  };

  return (
    <main style={{ minHeight:"100vh", background:"#F6F5F3", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>
      <Navbar/>

      {/* ── Hero ── */}
      <BarreTitre titre={"Zones d'Investissement"}>
        <BarreTitreSegment options={[{v:"zones",l:"Zones d'investissement"},{v:"territoire",l:"Pôles territoires"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Contenu ── */}
      <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
        {onglet==="zones" && (
          loading ? <SkeletonCards n={3} cols={3} height={190}/> : erreur ? <ErreurChargement onRetry={()=>setTick(t=>t+1)}/> : <ZonesParType zones={zones}/>
        )}
        {onglet==="territoire" && (
          loading ? <SkeletonChart height={520}/> : erreur ? <ErreurChargement onRetry={()=>setTick(t=>t+1)}/> : <VueTerritorialeSenegal zones={zones}/>
        )}
      </section>
    </main>
  );
}

