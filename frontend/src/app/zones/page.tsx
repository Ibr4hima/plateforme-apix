"use client";

import Navbar from "@/components/layout/Navbar";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronRight, ChevronUp, FileText, MapPin, Search, SlidersHorizontal, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

const TYPE_META: Record<string,{label:string;color:string;bg:string;border:string}> = {
  ZES: { label:"Zones Économiques Spéciales",           color:"#E35336", bg:"rgba(227,83,54,0.06)",  border:"rgba(227,83,54,0.2)" },
  ZAI: { label:"Zones Aménagées pour l'Investissement", color:"#174EA6", bg:"rgba(23,78,166,0.06)",  border:"rgba(23,78,166,0.2)" },
  ZFI: { label:"Zones Franches Industrielles",           color:"#188038", bg:"rgba(24,128,56,0.06)",  border:"rgba(24,128,56,0.2)" },
};

const POLE_COLORS = ["#efd0bc","#b2cade","#b9d9c3","#f5e6c8","#d4c5e8","#fadadd","#c8e6e8","#e8d5c4"];

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

// ── Sunburst par pôle ─────────────────────────────────────────────────────────
function SunburstPoles({ zones }: { zones:any[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ficheEnt, setFicheEnt] = useState<any>(null);

  useEffect(() => {
    if (!zones.length || !svgRef.current || !wrapRef.current) return;
    const W = wrapRef.current.clientWidth || 900;
    const H = 500;

    const byPole: Record<string,any[]> = {};
    const poleNoms: Record<string,string> = {};
    zones.forEach((z:any)=>{
      const pid=String(z.pole_id||"sans-pole");
      if (!byPole[pid]) { byPole[pid]=[]; poleNoms[pid]=z.pole_nom||"Sans pôle"; }
      byPole[pid].push(z);
    });

    const tree = {
      name: "Pôles Territoire",
      children: Object.entries(byPole).map(([pid,zs],pi)=>({
        name: poleNoms[pid], poleIndex:pi,
        children: zs.map((z:any)=>({
          name:z.nom_zone, poleIndex:pi, type:z.type_zone, value:1, data:z,
          children: z.entreprises?.filter((ze:any)=>ze.statut==="installee").length>0
            ? z.entreprises.filter((ze:any)=>ze.statut==="installee").map((ze:any)=>({ name:ze.entreprise?.nom||"—", poleIndex:pi, value:1, data:ze.entreprise }))
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

    const getColor=(d:any):string=>{
      if(d.depth===0) return "#F2F2F2";
      const pi=d.data.poleIndex??0;
      const c=POLE_COLORS[pi%POLE_COLORS.length];
      const a=d.depth===1?0.45:d.depth===2?0.40:d.depth===3?0.37:0.12+d.depth*0.15;
      return c+Math.round(Math.min(a,0.85)*255).toString(16).padStart(2,"0");
    };
    const rectH=(d:any)=>Math.max(0,d.x1-d.x0-Math.min(1,(d.x1-d.x0)/2));
    const labelOk=(d:any)=>d.y1<=W&&d.y0>=0&&d.x1-d.x0>16;

    const cell=svg.selectAll<SVGGElement,any>("g").data(root.descendants()).join("g")
      .attr("transform",(d:any)=>`translate(${d.y0},${d.x0})`);
    cell.append("rect")
      .attr("width",(d:any)=>Math.max(0,d.y1-d.y0-1)).attr("height",(d:any)=>rectH(d))
      .attr("fill",getColor).attr("stroke","#F2F0EF").attr("stroke-width",0.05).style("cursor","pointer");
    const text=cell.append("text").style("user-select","none").attr("pointer-events","none")
      .attr("x",6).attr("y",14)
      .attr("font-size",(d:any)=>d.depth===0?13:d.depth===1?12:11)
      .attr("font-weight",(d:any)=>d.depth<=1?700:400)
      .attr("font-family","var(--font-google-sans),sans-serif")
      .attr("fill","#1a1a2e").attr("fill-opacity",(d:any)=>+labelOk(d));
    text.append("tspan").text((d:any)=>{
      const w=(d.y1-d.y0)-12; const n=d.data.name||""; const c=Math.floor(w/6.5);
      return n.length>c?n.slice(0,Math.max(3,c-1))+"…":n;
    });

    // ── Badges dans SunburstPoles via foreignObject ───────────────────────────
    const TYPE_COLORS_MAP: Record<string,string> = { ZES:"#E35336", ZAI:"#366FE3", ZFI:"#188038" };

    // Badges par type pour les pôles (depth=1)
    cell.filter((d:any)=>d.depth===1&&d.children&&labelOk(d)&&(d.x1-d.x0)>40)
      .each(function(d:any) {
        const children = d.children || [];
        const byType: Record<string,number> = {};
        children.forEach((c:any)=>{ const t=c.data.type; if(t) byType[t]=(byType[t]||0)+1; });
        const parts = (Object.entries(byType) as [string,number][]).filter(([,n])=>n>0);
        if (!parts.length) return;
        const w = Math.max(0, d.y1-d.y0-12);
        const fo = d3.select(this as SVGGElement).append("foreignObject")
          .attr("x",6).attr("y",18).attr("width",w).attr("height",26)
          .attr("pointer-events","none");
        const div = fo.append("xhtml:div")
          .style("display","flex").style("gap","4px").style("align-items","center");
        parts.forEach(([type,n])=>{
          const col = TYPE_COLORS_MAP[type]||"#9aa5b4";
          div.append("xhtml:span")
            .style("display","inline-flex").style("align-items","center").style("height","18px")
            .style("padding","0 7px").style("background",col+"22").style("border",`1px solid ${col}55`)
            .style("border-radius","8px").style("font-size","9px").style("font-weight","700")
            .style("font-family","var(--font-google-sans),sans-serif").style("color",col)
            .style("white-space","nowrap")
            .text(`${n} ${type}`);
        });
      });

    // Badge numérique à l'extrême droite pour les zones (depth=2)
    cell.filter((d:any)=>d.depth===2&&labelOk(d)&&(d.x1-d.x0)>24)
      .each(function(d:any) {
        const ents=(d.data.data?.entreprises||[]).filter((ze:any)=>ze.statut==="installee").length;
        if(!ents) return;
        const col="#059669";
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
      focus=focus===p?(p=p.parent):p; if(!p) return;
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

// ── Card zone ─────────────────────────────────────────────────────────────────
function ZoneCard({ zone, defaultOpen=false }: { zone:any; defaultOpen?:boolean }) {
  const [open,        setOpen]        = useState(defaultOpen);
  const [ficheEnt, setFicheEnt] = useState<any>(null);
  const [loadingFiche, setLoadingFiche] = useState(false);

  const ouvrirFiche = async (entrepriseId: number) => {
    setLoadingFiche(true);
    try {
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`);
      setFicheEnt(await res.json());
    } catch(e) { console.error(e); }
    finally { setLoadingFiche(false); }
  };
  const meta     = TYPE_META[zone.type_zone] || TYPE_META.ZES;
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee");
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible");

  const EntRow = ({ ze, statut }: { ze:any; statut:"installee"|"eligible" }) => {
    const isI = statut==="installee";
    const col = isI?"#059669":"#b45309";
    const bg  = isI?"rgba(24,128,56,0.08)":"rgba(180,83,9,0.08)";
    return (
      <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#fff",borderRadius:10,border:"1px solid #E8E5E3" }}>
        <div style={{ width:32,height:32,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          <Building2 size={14} style={{ color:col }}/>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:600,fontSize:13,color:"#1a1a2e",marginBottom:1 }}>{ze.entreprise?.nom}</div>
          {ze.entreprise?.forme_juridique && <div style={{ fontSize:11,color:"#9aa5b4" }}>{ze.entreprise.forme_juridique}</div>}
        </div>
        <span style={{ fontSize:10,fontWeight:700,color:col,background:isI?"#dcfce7":"#fef9c3",border:`1px solid ${isI?"#86efac":"#fde68a"}`,padding:"2px 8px",borderRadius:999,flexShrink:0 }}>
          {isI?"Installée":"Éligible"}
        </span>
        <button onClick={()=>ouvrirFiche(ze.entreprise?.id)}
          style={{ display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:11,fontWeight:600,color:"#4a5568",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const }}>
          <Building2 size={11}/> Fiche
        </button>
      </div>
    );
  };

  return (
    <>
      <div style={{ background:"#fff",borderRadius:14,borderTop:`1px solid ${open?meta.color:"#E8E5E3"}`,borderRight:`1px solid ${open?meta.color:"#E8E5E3"}`,borderBottom:`1px solid ${open?meta.color:"#E8E5E3"}`,borderLeft:`4px solid ${meta.color}`,overflow:"hidden",transition:"all 0.15s",boxShadow:open?"0 4px 20px rgba(0,0,0,0.08)":"0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Header card */}
        <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 20px",cursor:"pointer" }}>
          {/* Badge type */}
          <div style={{ width:40,height:40,borderRadius:10,background:meta.bg,border:`1px solid ${meta.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span style={{ fontSize:10,fontWeight:800,color:meta.color }}>{zone.type_zone}</span>
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:5 }}>{zone.nom_zone}</div>
            {/* Infos alignées */}
            <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const }}>
              {zone.pole_nom && (
                <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 8px",borderRadius:999 }}>
                  {zone.pole_nom}
                </span>
              )}
              {(zone.departement_nom||zone.region_nom) && (
                <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:12,color:"#9aa5b4" }}>
                  <MapPin size={11} style={{ color:"#C5BFBB" }}/>
                  {[zone.departement_nom,zone.region_nom].filter(Boolean).join(", ")}
                </span>
              )}
              {zone.superficie && (
                <span style={{ fontSize:12,color:"#9aa5b4" }}>
                  {Number(zone.superficie).toLocaleString("fr-FR")} ha
                </span>
              )}
              {installes.length>0 && (
                <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#059669",background:"rgba(24,128,56,0.08)",border:"1px solid rgba(24,128,56,0.2)",padding:"2px 8px",borderRadius:999 }}>
                  {installes.length} installée{installes.length>1?"s":""}
                </span>
              )}
              {eligibles.length>0 && (
                <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#b45309",background:"rgba(180,83,9,0.08)",border:"1px solid rgba(180,83,9,0.2)",padding:"2px 8px",borderRadius:999 }}>
                  {eligibles.length} éligible{eligibles.length>1?"s":""}
                </span>
              )}
            </div>
          </div>
          {open?<ChevronDown size={16} style={{ color:"#9aa5b4",flexShrink:0 }}/>:<ChevronRight size={16} style={{ color:"#9aa5b4",flexShrink:0 }}/>}
        </div>

        {/* Contenu déplié */}
        {open && (
          <div style={{ borderTop:`1px solid ${meta.color}25`,padding:"16px 20px",background:meta.bg }}>
            {zone.description && <><style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style><div data-rte dangerouslySetInnerHTML={{__html:zone.description}} style={{ fontSize:13,color:"#4a5568",lineHeight:1.75,marginBottom:16,padding:"12px 16px",background:"#fff",borderRadius:10,border:`1px solid ${meta.border}` }}/></>}

            {(zone.date_creation||zone.decret_creation||zone.superficie) && (
              <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" as const }}>
                {zone.date_creation && (
                  <div style={{ background:"#fff",borderRadius:9,padding:"8px 14px",border:`1px solid ${meta.border}` }}>
                    <p style={{ fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:3 }}>Créée le</p>
                    <p style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{new Date(zone.date_creation+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>
                  </div>
                )}
                {zone.decret_creation && (
                  <div style={{ background:"#fff",borderRadius:9,padding:"8px 14px",border:`1px solid ${meta.border}` }}>
                    <p style={{ fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:3 }}>Décret</p>
                    <p style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{zone.decret_creation}</p>
                  </div>
                )}
                {zone.superficie && (
                  <div style={{ background:"#fff",borderRadius:9,padding:"8px 14px",border:`1px solid ${meta.border}` }}>
                    <p style={{ fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:3 }}>Superficie</p>
                    <p style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</p>
                  </div>
                )}
              </div>
            )}

            {installes.length>0 && (
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:11,fontWeight:700,color:"#059669",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8 }}>Entreprises installées</p>
                <div style={{ display:"flex",flexDirection:"column" as const,gap:6 }}>
                  {installes.map((ze:any)=><EntRow key={ze.id||ze.entreprise?.id} ze={ze} statut="installee"/>)}
                </div>
              </div>
            )}

            {eligibles.length>0 && (
              <div style={{ marginBottom:12 }}>
                <p style={{ fontSize:11,fontWeight:700,color:"#b45309",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8 }}>Entreprises éligibles</p>
                <div style={{ display:"flex",flexDirection:"column" as const,gap:6 }}>
                  {eligibles.map((ze:any)=><EntRow key={ze.id||ze.entreprise?.id} ze={ze} statut="eligible"/>)}
                </div>
              </div>
            )}

            {zone.fichiers?.length>0 && (
              <div style={{ display:"flex",flexWrap:"wrap" as const,gap:6,marginTop:8 }}>
                {zone.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex",alignItems:"center",gap:5,background:"#fff",border:`1px solid ${meta.border}`,borderRadius:7,padding:"5px 12px",fontSize:11,color:meta.color,textDecoration:"none",fontWeight:600 }}>
                    <FileText size={11}/>{f.titre||f.nom}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={()=>setFicheEnt(null)}/>
    </>
  );
}

// ── Card zone grille 3 colonnes ────────────────────────────────────────────────
function ZoneCardGrid({ zone, onClick }: { zone:any; onClick:()=>void }) {
  const col = (TYPE_META[zone.type_zone]||TYPE_META.ZES).color;
  return (
    <div onClick={onClick}
      style={{ background:"#fff", border:"1px solid #E8E5E3", borderLeft:`3px solid ${col}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", position:"relative" as const }}
      onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${col}20`;ev.currentTarget.style.borderColor=col;}}
      onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor=col;}}>
      <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", lineHeight:1.35, marginBottom:zone.pole_nom?2:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{zone.nom_zone}</div>
      {zone.pole_nom&&<div style={{ fontSize:11, fontWeight:500, color:"#9aa5b4", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{zone.pole_nom}</div>}
      <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:12 }}>
        {zone.date_creation&&<div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#188038", flexShrink:0 }}/>
          <span style={{ color:"#4a5568" }}>Créée le {fmtDate(zone.date_creation)}</span>
        </div>}
        {(zone.departement_nom||zone.region_nom)&&<div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#B7410E", flexShrink:0 }}/>
          <span style={{ color:"#4a5568", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{[zone.departement_nom,zone.region_nom].filter(Boolean).join(", ")}</span>
        </div>}
      </div>
      <div style={{ display:"flex", borderTop:"1px solid #F2F0EF", paddingTop:10 }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:col+"14", borderRadius:7, padding:"6px 0", fontSize:11, color:col, fontWeight:600 }}>
          Voir les détails →
        </div>
      </div>
    </div>
  );
}

// ── Sidebar filter générique ───────────────────────────────────────────────────
function ZoneSideFilter({ label, items, selected, onToggle, color, itemColors }: {
  label:string; items:string[]; selected:string[]; onToggle:(v:string)=>void; color:string; itemColors?:Record<string,string>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom:18 }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"none", border:"none", cursor:"pointer", padding:"4px 0", marginBottom:open?8:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {selected.length>0&&<span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block" }}/>}
          <span style={{ fontSize:11, fontWeight:700, color:selected.length>0?color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>{label}</span>
          {selected.length>0&&<span style={{ fontSize:10, fontWeight:700, color, background:color+"18", padding:"1px 6px", borderRadius:999 }}>{selected.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{ color:"#9aa5b4" }}/>:<ChevronDown size={12} style={{ color:"#9aa5b4" }}/>}
      </button>
      {open&&(
        <div style={{ display:"flex", flexDirection:"column" as const, gap:2, maxHeight:200, overflowY:"auto" as const }}>
          {items.map(item=>{
            const sel=selected.includes(item);
            const ic=itemColors?.[item]||color;
            return (
              <button key={item} onClick={()=>onToggle(item)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:sel?ic+"12":"transparent", textAlign:"left" as const }}
                onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLButtonElement).style.background="#F8F7F6";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=sel?ic+"12":"transparent";}}>
                <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${sel?ic:"#C5BFBB"}`, background:sel?ic:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize:12, color:sel?ic:"#4a5568", fontWeight:sel?600:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{item}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Vue détaillée ─────────────────────────────────────────────────────────────
function VueDetaillee({ zones }: { zones:any[] }) {
  const [search, setSearch]       = useState("");
  const [typesSel, setTypesSel]   = useState<string[]>([]);
  const [polesSel, setPolesSel]   = useState<string[]>([]);
  const [regionsSel, setRegionsSel] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  const allPoles   = Array.from(new Set(zones.map((z:any)=>z.pole_nom).filter(Boolean))).sort() as string[];
  const allRegions = Array.from(new Set(zones.map((z:any)=>z.region_nom).filter(Boolean))).sort() as string[];

  const TYPE_ORDER: Record<string,number> = { ZES:0, ZAI:1, ZFI:2 };
  const filtered = zones
    .filter((z:any)=>{
      if (search&&!z.nom_zone?.toLowerCase().includes(search.toLowerCase())) return false;
      if (typesSel.length>0&&!typesSel.includes(z.type_zone)) return false;
      if (polesSel.length>0&&!polesSel.includes(z.pole_nom)) return false;
      if (regionsSel.length>0&&!regionsSel.includes(z.region_nom)) return false;
      return true;
    })
    .sort((a:any,b:any)=>{
      const tDiff=(TYPE_ORDER[a.type_zone]??3)-(TYPE_ORDER[b.type_zone]??3);
      if (tDiff!==0) return tDiff;
      return (a.date_creation||"").localeCompare(b.date_creation||"");
    });

  const toggle=(setter:React.Dispatch<React.SetStateAction<string[]>>)=>(v:string)=>
    setter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  const hasFilter=!!search||typesSel.length>0||polesSel.length>0||regionsSel.length>0;
  const reinit=()=>{setSearch("");setTypesSel([]);setPolesSel([]);setRegionsSel([]);};
  const nbFiltres=(search?1:0)+typesSel.length+polesSel.length+regionsSel.length;

  return (
    <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
      {/* Sidebar */}
      <div style={{ width:sidebarOpen?260:52, flexShrink:0, transition:"width 0.25s" }}>
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E8E5E3", padding:sidebarOpen?"20px 16px":"10px 8px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", position:"sticky" as const, top:24, maxHeight:"calc(100vh - 80px)", overflowY:"auto" as const }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", marginBottom:sidebarOpen?18:0 }}>
            {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
              <SlidersHorizontal size={14} style={{ color:"#ca631f" }}/>
              {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
            </button>
          </div>
          {sidebarOpen&&<>
            {hasFilter&&<button onClick={reinit} style={{ display:"flex", alignItems:"center", gap:5, width:"100%", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:8, padding:"7px 10px", fontSize:12, fontWeight:600, cursor:"pointer", marginBottom:16 }}>
              <X size={12}/> Effacer tous les filtres
            </button>}
            <div style={{ position:"relative" as const, marginBottom:18 }}>
              <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une zone…"
                style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
              {search&&<button onClick={()=>setSearch("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
            </div>
            <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
            <ZoneSideFilter label="Type de zone" color="#ca631f" items={["ZES","ZAI","ZFI"]} selected={typesSel} onToggle={toggle(setTypesSel)} itemColors={{ ZES:"#E35336", ZAI:"#174EA6", ZFI:"#188038" }}/>
            {allPoles.length>0&&<><div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
            <ZoneSideFilter label="Pôle territorial" color="#ca631f" items={allPoles} selected={polesSel} onToggle={toggle(setPolesSel)}/></>}
            {allRegions.length>0&&<><div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
            <ZoneSideFilter label="Région" color="#366FE3" items={allRegions} selected={regionsSel} onToggle={toggle(setRegionsSel)}/></>}
          </>}
        </div>
      </div>

      {/* Grille */}
      <div style={{ flex:1, minWidth:0 }}>
        {filtered.length===0?(
          <div style={{ textAlign:"center", padding:"80px 24px", color:"#9aa5b4" }}>
            <p style={{ fontSize:16, fontWeight:600, color:"#4a5568" }}>Aucune zone trouvée</p>
            <p style={{ fontSize:14, marginTop:6 }}>Modifiez vos filtres pour affiner la recherche.</p>
            {hasFilter&&<button onClick={reinit} style={{ marginTop:16, padding:"8px 18px", borderRadius:10, border:"none", background:"#E35336", color:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>Effacer les filtres</button>}
          </div>
        ):(
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {filtered.map((z:any)=><ZoneCardGrid key={z.id} zone={z} onClick={()=>setSelectedZone(z)}/>)}
          </div>
        )}
      </div>

      {/* Modal détail */}
      {selectedZone&&(
        <div onClick={e=>{ if(e.target===e.currentTarget) setSelectedZone(null); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(8px)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ position:"relative" as const, maxWidth:680, width:"100%", maxHeight:"90vh", overflowY:"auto" as const }}>
            <button onClick={()=>setSelectedZone(null)}
              style={{ position:"absolute" as const, top:10, right:10, zIndex:10, background:"rgba(0,0,0,0.06)", border:"none", borderRadius:99, width:30, height:30, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            <ZoneCard zone={selectedZone} defaultOpen={true}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ZonesPage() {
  const [zones,      setZones]      = useState<any[]>([]);
  const [polesCount, setPolesCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [onglet,     setOnglet]     = useState<"zones"|"poles"|"liste"|"territoire">("zones");

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
            {key:"poles",      label:"Pôles territoires",      color:"#ca631f"},
            {key:"territoire", label:"Vue territoriale",       color:"#ca631f"},
            {key:"liste",      label:"Vue détaillée",          color:"#ca631f"},
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

        {/* Vue sunburst par type */}
        {onglet==="zones" && (
          loading
            ? <Loader/>
            : <SunburstZones zones={zones}/>
        )}

        {/* Vue sunburst par pôle */}
        {onglet==="poles" && (
          loading
            ? <Loader/>
            : <SunburstPoles zones={zones}/>
        )}

        {/* Liste détaillée */}
        {onglet==="territoire" && (
          loading
            ? <Loader/>
            : <VueTerritorialeSenegal zones={zones}/>
        )}

        {onglet==="liste" && (
          loading ? <Loader/> : <VueDetaillee zones={zones}/>
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
