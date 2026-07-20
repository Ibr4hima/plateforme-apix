"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtMillionsUSD } from "@/lib/format";
import { SkeletonRows } from "@/components/shared/Skeleton";

// Palette de l'analyse comparative (page IDE)
const COMP_PALETTE = ["#004f91","#ca631f","#188038","#6A1B9A"];

// ── Barres horizontales Top 10 (vue Monde, page IDE) ──────────────────────────
export function HBarChart({ donnees, mini=false }: { donnees: any[]; mini?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [annee, setAnnee] = useState<number|null>(null);
  const [ind,   setInd]   = useState("flux");
  const [dir,   setDir]   = useState("entrant");

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();
    if (!donnees.length) return;

    const curInd = mini ? "flux"    : ind;
    const curDir = mini ? "entrant" : dir;

    const annees = [...new Set(donnees.map((d:any)=>d.annee as number))].sort((a,b)=>b-a);
    const curAnnee = mini ? annees[0] : (annee ?? annees[0]);

    const data = donnees
      .filter((d:any)=>d.annee===curAnnee && d.indicateur===curInd && d.direction===curDir && d.valeur!==null)
      .sort((a:any,b:any)=>b.valeur-a.valeur)
      .slice(0, 10);

    if (!data.length) return;

    const W    = wrapRef.current.clientWidth || 600;
    const rowH = mini ? 18 : 46;
    const longestName = mini ? 3 : Math.max(...data.map((d:any)=>(d.pays as string).length));
    const M    = mini
      ? { top:4, right:12, bottom:4, left:34 }
      : { top:10, right:90, bottom:10, left: Math.max(80, longestName * 7 + 12) };
    const H    = data.length * rowH + M.top + M.bottom;

    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");

    const maxVal = d3.max(data,(d:any)=>d.valeur) as number;
    const x = d3.scalePow().exponent(0.5).domain([0, maxVal]).range([M.left, W-M.right]);
    const y = d3.scaleBand().domain(data.map((d:any)=>d.pays)).range([M.top, H-M.bottom]).padding(0.18);

    const fmtLabel = (v:number) => fmtMillionsUSD(v);
    const minLabelInside = mini ? 40 : 80;
    const label = (d:any) => mini
      ? ((d.code_iso3 as string|null) ?? (d.pays as string).slice(0,3).toUpperCase())
      : (d.pays as string);

    svg.selectAll<SVGRectElement,any>("rect.bar")
      .data(data).enter().append("rect")
      .attr("x",     M.left)
      .attr("y",     (d:any)=>y(d.pays)!)
      .attr("width", (d:any)=>Math.max(2, x(d.valeur)-M.left))
      .attr("height",y.bandwidth())
      .attr("fill",  COMP_PALETTE[0]);

    svg.selectAll<SVGTextElement,any>("text.val")
      .data(data).enter().append("text")
      .attr("x",  (d:any)=>{
        const barW = x(d.valeur)-M.left;
        return barW >= minLabelInside ? x(d.valeur)-5 : x(d.valeur)+5;
      })
      .attr("y",  (d:any)=>y(d.pays)! + y.bandwidth()/2)
      .attr("dy", "0.35em")
      .attr("text-anchor",(d:any)=>(x(d.valeur)-M.left)>=minLabelInside?"end":"start")
      .attr("font-size", mini ? 7 : 11)
      .attr("font-weight","600")
      .attr("fill",(d:any)=>(x(d.valeur)-M.left)>=minLabelInside?"white":COMP_PALETTE[0])
      .text((d:any)=>fmtLabel(d.valeur));

    // Étiquette ISO3 à gauche de la barre
    svg.selectAll<SVGTextElement,any>("text.iso")
      .data(data).enter().append("text")
      .attr("x",  M.left-4)
      .attr("y",  (d:any)=>y(d.pays)! + y.bandwidth()/2)
      .attr("dy", "0.35em")
      .attr("text-anchor","end")
      .attr("font-size", mini ? 7 : 11)
      .attr("font-weight","600")
      .attr("fill","#374151")
      .text(label);

  }, [donnees, annee, ind, dir, mini]);

  useEffect(()=>{ draw(); },[draw]);
  useEffect(()=>{
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(()=>draw());
    obs.observe(wrapRef.current);
    return ()=>obs.disconnect();
  },[draw]);

  const annees = [...new Set(donnees.map((d:any)=>d.annee as number))].sort((a,b)=>b-a);

  const Pill = ({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) => (
    <button onClick={onClick} style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, background:active?"#004f91":"#F2F0EF", color:active?"#fff":"#9aa5b4", transition:"all 0.15s" }}>{label}</button>
  );

  return (
    <div>
      {!mini && (
        <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" as const, alignItems:"center" }}>
          <select value={annee??annees[0]} onChange={e=>setAnnee(Number(e.target.value))}
            style={{ fontSize:11, padding:"3px 8px", borderRadius:6, border:"1px solid #E8E5E3", background:"#F8F7F6", color:"#1a1a2e", cursor:"pointer", outline:"none" }}>
            {annees.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{ width:1, background:"#E8E5E3", margin:"0 2px" }}/>
          <Pill label="Flux"    active={ind==="flux"}    onClick={()=>setInd("flux")}/>
          <Pill label="Stock"   active={ind==="stock"}   onClick={()=>setInd("stock")}/>
          <div style={{ width:1, background:"#E8E5E3", margin:"0 2px" }}/>
          <Pill label="Entrant" active={dir==="entrant"} onClick={()=>setDir("entrant")}/>
          <Pill label="Sortant" active={dir==="sortant"} onClick={()=>setDir("sortant")}/>
        </div>
      )}
      <div ref={wrapRef} style={{ width:"100%", overflow:"hidden" }}>
        <svg ref={svgRef} style={{ width:"100%", height:"auto", display:"block" }}/>
      </div>
      {donnees.length===0&&!mini&&<div style={{ marginTop:16 }}><SkeletonRows n={10} h={36}/></div>}
    </div>
  );
}
