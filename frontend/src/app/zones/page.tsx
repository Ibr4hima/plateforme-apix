"use client";

import Navbar from "@/components/layout/Navbar";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import { ZONE_TYPE_META } from "@/components/shared/zoneTypes";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
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
        fetch(`${API_BASE}/entreprises/${p.data.data.id}`)
          .then(r=>r.json()).then(d=>setFicheEnt(d)).catch(()=>{});
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

  const types = Object.entries(byType).map(([type, zs]) => ({
    type,
    meta: TYPE_META[type] || { label: type, color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.2)" },
    zones: zs,
    installed: zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length, 0),
    eligible:  zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "eligible").length, 0),
    superficie: zs.reduce((s, z) => s + (Number(z.superficie) || 0), 0),
  }));

  const selectedInfo = selectedType ? types.find(t => t.type === selectedType) : null;

  return (
    <div>
      {/* ── Cards types ── */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(types.length, 3)},1fr)`, gap:18, marginBottom: selectedType ? 32 : 0 }}>
        {types.map(t => {
          const active = selectedType === t.type;
          const c = t.meta.color;
          const entreprises = t.installed + t.eligible;
          const Stat = ({ value, label, accent }: { value:string; label:string; accent?:boolean }) => (
            <div style={{ flex:1, textAlign:"center" as const }}>
              <div style={{ fontSize:25, fontWeight:800, color: accent?c:"#1a1a2e", lineHeight:1.05, letterSpacing:"-0.015em" }}>{value}</div>
              <div style={{ fontSize:10, fontWeight:600, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.07em", marginTop:5 }}>{label}</div>
            </div>
          );
          return (
            <div key={t.type} onClick={() => setSelectedType(active ? null : t.type)}
              style={{ position:"relative" as const, borderRadius:18, overflow:"hidden", cursor:"pointer", background:"#fff",
                border:`1px solid ${active ? c : "#EAE7E4"}`,
                boxShadow: active ? `0 16px 40px ${c}1f` : "0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.03)",
                transform: active ? "translateY(-3px)" : "none",
                transition:"box-shadow 0.2s, transform 0.2s, border-color 0.2s" }}
              onMouseEnter={ev => { if (!active) { ev.currentTarget.style.boxShadow=`0 12px 30px rgba(0,0,0,0.08)`; ev.currentTarget.style.transform="translateY(-3px)"; } }}
              onMouseLeave={ev => { if (!active) { ev.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.03)"; ev.currentTarget.style.transform="none"; } }}>

              {/* Liseré d'accent supérieur */}
              <div style={{ height:3, background:c, opacity:active?1:0.85 }}/>

              <div style={{ padding:"20px 22px 0" }}>
                {/* En-tête : chip acronyme + libellé */}
                <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:22 }}>
                  <div style={{ width:46, height:46, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:t.meta.bg, border:`1px solid ${t.meta.border}` }}>
                    <span style={{ fontSize:19, fontWeight:800, color:c, lineHeight:1 }}>{t.zones.length}</span>
                  </div>
                  <div style={{ fontWeight:700, fontSize:15, color:"#1a1a2e", lineHeight:1.3 }}>{t.meta.label}</div>
                </div>

                {/* Statistiques ouvertes */}
                <div style={{ display:"flex", alignItems:"stretch", paddingBottom:4 }}>
                  <Stat value={String(entreprises)} label={entreprises>1?"Entreprises":"Entreprise"} />
                  <div style={{ width:1, background:"#EEEBE8", margin:"4px 0" }}/>
                  <Stat value={t.superficie>0 ? Number(t.superficie).toLocaleString("fr-FR") : "—"} label="ha" />
                </div>
              </div>

              {/* Pied : CTA centré */}
              <div style={{ display:"flex", justifyContent:"center", padding:"14px 22px 18px", marginTop:16, borderTop:"1px solid #F4F2F0" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 20px", borderRadius:999, fontSize:12.5, fontWeight:700, background: active ? c : `${c}12`, color: active ? "#fff" : c, transition:"all 0.15s" }}>
                  {active ? "Affiché" : "Voir les zones"} <ChevronRight size={15}/>
                </span>
              </div>

              {/* Coche sélection */}
              {active && (
                <div style={{ position:"absolute" as const, top:14, right:14, width:22, height:22, borderRadius:"50%", background:c, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 2px 8px ${c}55` }}>
                  <svg width="11" height="8" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
            {selectedInfo.zones.map((z: any) => <ZoneBigCard key={z.id} zone={z} onClick={()=>setDetailZone(z)} />)}
          </div>
        </div>
      )}

      {detailZone && <ZoneDetailModal zone={detailZone} onClose={()=>setDetailZone(null)} />}
    </div>
  );
}

// ── Grande card zone (ouvre le modal détail) ──────────────────────────────────
function ZoneBigCard({ zone, onClick }: { zone:any; onClick:()=>void }) {
  const meta = TYPE_META[zone.type_zone] || TYPE_META.ZES;
  const c = meta.color;
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee").length;
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible").length;
  const Stat = ({ value, label, color }: { value:string; label:string; color:string }) => (
    <div style={{ flex:1, textAlign:"center" as const }}>
      <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1.05, letterSpacing:"-0.01em" }}>{value}</div>
      <div style={{ fontSize:9.5, fontWeight:600, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.06em", marginTop:4 }}>{label}</div>
    </div>
  );
  return (
    <div onClick={onClick}
      style={{ background:"#fff", border:"1px solid #EAE7E4", borderRadius:18, overflow:"hidden", cursor:"pointer",
        boxShadow:"0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.03)", transition:"box-shadow 0.2s, transform 0.2s, border-color 0.2s" }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow=`0 14px 32px ${c}22`; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor=c; }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.03)"; e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor="#EAE7E4"; }}>
      <div style={{ height:4, background:c }}/>
      <div style={{ padding:"20px 22px" }}>
        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:13, marginBottom:18 }}>
          <div style={{ width:50,height:50,borderRadius:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:meta.bg,border:`1px solid ${meta.border}` }}>
            <span style={{ fontSize:13, fontWeight:800, letterSpacing:"0.02em", color:c }}>{zone.type_zone}</span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:17, color:"#1a1a2e", lineHeight:1.25, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{zone.nom_zone}</div>
            {(zone.departement_nom||zone.region_nom) && (
              <div style={{ fontSize:12.5, color:"#9aa5b4", marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{[zone.departement_nom,zone.region_nom].filter(Boolean).join(", ")}</div>
            )}
          </div>
          {zone.pole_nom && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11.5, fontWeight:600, color:c, background:meta.bg, border:`1px solid ${meta.border}`, padding:"3px 10px", borderRadius:999, flexShrink:0, whiteSpace:"nowrap" as const, marginTop:2 }}>{zone.pole_nom}</span>
          )}
        </div>
        {/* Bande de stats */}
        <div style={{ display:"flex", alignItems:"stretch", background:"#FAFAF9", border:"1px solid #F2F0EF", borderRadius:13, padding:"14px 4px" }}>
          <Stat value={zone.superficie?Number(zone.superficie).toLocaleString("fr-FR"):"—"} label="ha" color={c} />
          <div style={{ width:1, background:"#EEEBE8", margin:"3px 0" }}/>
          <Stat value={String(installes)} label="Installées" color={installes>0?"#059669":"#C5BFBB"} />
          <div style={{ width:1, background:"#EEEBE8", margin:"3px 0" }}/>
          <Stat value={String(eligibles)} label="Éligibles" color={eligibles>0?"#b45309":"#C5BFBB"} />
        </div>
      </div>
      {/* Pied : CTA */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", padding:"13px 22px 15px", borderTop:"1px solid #F4F2F0" }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:12.5, fontWeight:700, color:c, whiteSpace:"nowrap" as const }}>Voir les détails <ChevronRight size={15}/></span>
      </div>
    </div>
  );
}

// ── Modal détail zone ─────────────────────────────────────────────────────────
function ZoneDetailModal({ zone, onClose }: { zone:any; onClose:()=>void }) {
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

  const ouvrirFiche = async (id:number) => {
    try { const res=await fetch(`${API_BASE}/entreprises/${id}`); setFicheEnt(await res.json()); }
    catch(e){ console.error(e); }
  };

  const meta      = TYPE_META[zone.type_zone]||TYPE_META.ZES;
  const col       = meta.color;
  const poleColor = zone.pole_id ? POLE_COLORS[(zone.pole_id-1)%POLE_COLORS.length] : "#E8E5E3";
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee");
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible");
  const secIds: number[] = zone.secteur_ids||[];
  const braIds: number[] = zone.branche_ids||[];
  const actIds: number[] = zone.activite_ids||[];
  const hasActivites = secIds.length>0||braIds.length>0||actIds.length>0;

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden",display:"flex",flexDirection:"column" as const}}>
          <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)",borderRadius:"20px 20px 0 0",flexShrink:0}}/>
          <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,flex:1}}>

            {/* En-tête */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div style={{flex:1,paddingRight:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div>
                    <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:5}}>{zone.nom_zone}</h2>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                      {zone.pole_nom&&<span style={{fontSize:11,fontWeight:700,color:"#1a1a2e",background:poleColor+"55",border:"1px solid rgba(0,0,0,0.06)",padding:"2px 9px",borderRadius:999}}>{zone.pole_nom}</span>}
                      {zone.region_nom&&<span style={{fontSize:11,fontWeight:700,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>{zone.region_nom}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
            </div>

            {/* Infos principales */}
            {(zone.date_creation||zone.superficie||zone.departement_nom||zone.decret_creation)&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {zone.date_creation&&<div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Créée le</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(zone.date_creation)}</p></div>}
                {zone.superficie&&<div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Superficie</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</p></div>}
                {zone.departement_nom&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Département</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{zone.departement_nom}</p></div>}
                {zone.decret_creation&&<div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Décret</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{zone.decret_creation}</p></div>}
              </div>
            )}

            {/* Description */}
            {zone.description&&(
              <><style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
              <div data-rte dangerouslySetInnerHTML={{__html:zone.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.75,marginBottom:20,padding:"12px 16px",background:"#fff",borderRadius:10,border:"1px solid #E8E5E3"}}/></>
            )}

            {/* Activités autorisées */}
            {hasActivites&&secteurs.length>0&&(
              <div style={{marginBottom:20}}>
                <LBL>Activités autorisées</LBL>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {secIds.map((secId:number)=>{
                    const sec=secteurs.find((s:any)=>s.id===secId); if(!sec) return null;
                    const brasDuSec=branches.filter((b:any)=>b.secteur_id===secId&&braIds.includes(b.id));
                    return (
                      <div key={secId}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec.nom}</span>
                        </div>
                        {brasDuSec.length>0&&(
                          <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                            {brasDuSec.map((bra:any)=>{
                              const actsDeBra=activites.filter((a:any)=>a.branche_id===bra.id&&actIds.includes(a.id));
                              return (
                                <div key={bra.id}>
                                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                    <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra.nom}</span>
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
              </div>
            )}

            {/* Entreprises installées */}
            {installes.length>0&&(
              <div style={{marginBottom:16}}>
                <LBL>Entreprises installées</LBL>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:installes.length>3?200:undefined,overflowY:installes.length>3?"auto" as const:undefined,paddingRight:installes.length>3?4:undefined}}>
                  {installes.map((ze:any)=>(
                    <div key={ze.id||ze.entreprise?.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fff",borderRadius:10,border:"1px solid #E8E5E3"}}>
                      <div style={{width:32,height:32,borderRadius:8,background:"rgba(24,128,56,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <Building2 size={14} style={{color:"#059669"}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#1a1a2e",marginBottom:1}}>{ze.entreprise?.nom}</div>
                        {ze.entreprise?.forme_juridique&&<div style={{fontSize:11,color:"#9aa5b4"}}>{ze.entreprise.forme_juridique}</div>}
                      </div>
                      <button onClick={()=>ouvrirFiche(ze.entreprise?.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:11,fontWeight:600,color:"#4a5568",cursor:"pointer",flexShrink:0}}>
                        <Building2 size={11}/> Fiche
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entreprises éligibles */}
            {eligibles.length>0&&(
              <div style={{marginBottom:16}}>
                <LBL>Entreprises éligibles</LBL>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:eligibles.length>3?200:undefined,overflowY:eligibles.length>3?"auto" as const:undefined,paddingRight:eligibles.length>3?4:undefined}}>
                  {eligibles.map((ze:any)=>(
                    <div key={ze.id||ze.entreprise?.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fff",borderRadius:10,border:"1px solid #E8E5E3"}}>
                      <div style={{width:32,height:32,borderRadius:8,background:"rgba(180,83,9,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <Building2 size={14} style={{color:"#b45309"}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#1a1a2e",marginBottom:1}}>{ze.entreprise?.nom}</div>
                        {ze.entreprise?.forme_juridique&&<div style={{fontSize:11,color:"#9aa5b4"}}>{ze.entreprise.forme_juridique}</div>}
                      </div>
                      <button onClick={()=>ouvrirFiche(ze.entreprise?.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:11,fontWeight:600,color:"#4a5568",cursor:"pointer",flexShrink:0}}>
                        <Building2 size={11}/> Fiche
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents PDF */}
            {zone.fichiers?.length>0&&(
              <div style={{marginBottom:16}}>
                <LBL>Documents PDF</LBL>
                <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                  {zone.fichiers.map((f:any)=>(
                    <a key={f.id} href={`${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{display:"inline-flex",alignItems:"center",gap:5,background:"#fff",border:`1px solid ${meta.border}`,borderRadius:7,padding:"5px 12px",fontSize:11,color:col,textDecoration:"none",fontWeight:600}}>
                      <FileText size={11}/>{f.titre||f.nom}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:"flex",justifyContent:"flex-end",marginTop:20,borderTop:"1px solid #F2F0EF",paddingTop:18}}>
              <button onClick={onClose} style={{padding:"9px 20px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
            </div>

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
  const [onglet,     setOnglet]     = useState<"zones"|"territoire">("zones");

  useEffect(()=>{
    fetch(`${API_BASE}/zones-types`)
      .then(r=>r.json()).then(d=>{ setZones(d||[]); setLoading(false); })
      .catch(()=>setLoading(false));
    fetch(`${API_BASE}/zones-types/poles`)
      .then(r=>r.json()).then((d:any[])=>setPolesCount(d?.length||0)).catch(()=>{});
  },[]);

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
    <main style={{ minHeight:"100vh", background:"#F2F0EF", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* ── Hero ── */}
      <section style={{padding:"100px 40px 40px",background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute" as const,bottom:"-20%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)"}}/>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase" as const}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:20}}>Zones d&apos;Investissement</h1>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
            {stats.poles>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.poles} Pôles territoires</span>}
            {stats.zes>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.zes} ZES</span>}
            {stats.zai>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.zai} ZAI</span>}
            {stats.zfi>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.zfi} ZFI</span>}
          </div>
        </div>
      </section>

      {/* Onglets sticky */}
      <div style={{background:"#fff",borderBottom:"1px solid #E8E5E3",position:"sticky" as const,top:0,zIndex:10}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 40px",display:"flex",gap:0}}>
          {([
            {key:"zones",      label:"Zones d'investissement", color:"#ca631f"},
            {key:"territoire", label:"Pôles territoires",      color:"#ca631f"},
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setOnglet(t.key)}
              style={{padding:"16px 22px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-google-sans)",fontSize:13,fontWeight:600,color:onglet===t.key?t.color:"#9aa5b4",borderBottom:`2px solid ${onglet===t.key?t.color:"transparent"}`,transition:"all 0.15s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu ── */}
      <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
        {onglet==="zones" && (
          loading ? <Loader/> : <ZonesParType zones={zones}/>
        )}
        {onglet==="territoire" && (
          loading ? <Loader/> : <VueTerritorialeSenegal zones={zones}/>
        )}
      </section>
    </main>
  );
}

function Loader() {
  return (
    <div style={{ display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:10,color:"#9aa5b4" }}>
      <div style={{ width:20,height:20,border:"2px solid rgba(202,99,31,0.2)",borderTopColor:"#ca631f",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
      <span style={{ fontSize:14 }}>Chargement…</span>
    </div>
  );
}
