"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { d3 } from "@/lib/d3lazy";

// ── Diverging bars — Net (entrant − sortant) (vue Monde, page IDE) ────────────
export function DivergingBars({ donnees, mini=false }: { donnees: any[]; mini?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [annee, setAnnee] = useState<number|null>(null);
  const [ind,   setInd]   = useState("flux");

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();
    if (!donnees.length) return;

    const curInd = mini ? "flux" : ind;
    const annees = [...new Set(donnees.map((d:any)=>d.annee as number))].sort((a,b)=>b-a);
    const curAnnee = mini ? annees[0] : (annee ?? annees[0]);

    type Row = { pays: string; iso3: string|null; net: number };
    const paysList = [...new Set(donnees.map((d:any)=>d.pays as string))];
    const data: Row[] = paysList.map(pays => {
      const ent = donnees.find((d:any)=>d.pays===pays&&d.annee===curAnnee&&d.indicateur===curInd&&d.direction==="entrant");
      const sor = donnees.find((d:any)=>d.pays===pays&&d.annee===curAnnee&&d.indicateur===curInd&&d.direction==="sortant");
      return { pays, iso3: ent?.code_iso3??sor?.code_iso3??null, net:(ent?.valeur??0)-(sor?.valeur??0) };
    })
    .filter(d=>d.net!==0)
    .sort((a,b)=>Math.abs(b.net)-Math.abs(a.net)).slice(0, 10)
    .sort((a,b)=>b.net-a.net);   // positifs en haut, négatifs en bas

    if (!data.length) return;

    const COLOR_POS = "#188038";
    const COLOR_NEG = "#A50E0E";
    const rowH = mini ? 16 : 28;
    const W    = wrapRef.current.clientWidth || 500;
    const MT   = mini ? 4  : 26;
    const MB   = mini ? 4  : 8;
    const MH   = mini ? 18 : 58;
    const H    = MT + data.length * rowH + MB;

    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");

    // 0 fixé au centre, deux échelles indépendantes gauche (négatif) et droite (positif)
    const cx  = MH + (W - 2*MH) / 2;
    const maxPos = Math.max(1, d3.max(data.filter(d=>d.net>0), d=>d.net) ?? 1);
    const maxNeg = Math.max(1, d3.max(data.filter(d=>d.net<0), d=>-d.net) ?? 1);
    const xPos = d3.scalePow().exponent(0.5).domain([0, maxPos*1.08]).range([cx, W-MH]);
    const xNeg = d3.scalePow().exponent(0.5).domain([0, maxNeg*1.08]).range([cx, MH]);

    // px position d'une valeur nette
    const xOf = (v: number) => v >= 0 ? xPos(v) : xNeg(-v);

    const y = d3.scaleBand().domain(data.map(d=>d.pays)).range([MT, MT+data.length*rowH]).padding(0.2);

    const fmt = (v:number) => {
      const abs = Math.abs(v), sign = v>0?"+":"-";
      return abs>=1000 ? `${sign}${(abs/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})}k` : `${sign}${Math.round(abs)}`;
    };

    // Axes indépendants en haut (full uniquement)
    if (!mini) {
      // Axe droite (positif)
      svg.append("g").attr("transform",`translate(0,${MT})`)
        .call(d3.axisTop(xPos).ticks(4).tickFormat(v=>v===0?"":fmt(+v)))
        .call(g=>{g.select(".domain").remove();
          g.selectAll(".tick line").attr("stroke","#f3f4f6").attr("y2",data.length*rowH);
          g.selectAll(".tick text").attr("fill","#9aa5b4").attr("font-size",9);});
      // Axe gauche (négatif) — inverser le signe pour l'affichage
      svg.append("g").attr("transform",`translate(0,${MT})`)
        .call(d3.axisTop(xNeg).ticks(3).tickFormat(v=>v===0?"":fmt(-(+v))))
        .call(g=>{g.select(".domain").remove();
          g.selectAll(".tick line").attr("stroke","#f3f4f6").attr("y2",data.length*rowH);
          g.selectAll(".tick text").attr("fill","#9aa5b4").attr("font-size",9);});
    }

    // Barres
    svg.selectAll<SVGRectElement,Row>("rect")
      .data(data).enter().append("rect")
      .attr("x",     d=>d.net>=0 ? cx : xOf(d.net))
      .attr("y",     d=>y(d.pays)!)
      .attr("width", d=>Math.max(1, Math.abs(xOf(d.net)-cx)))
      .attr("height",y.bandwidth())
      .attr("fill",  d=>d.net>=0 ? COLOR_POS : COLOR_NEG);

    // Règle X=0
    svg.append("line")
      .attr("x1",cx).attr("x2",cx).attr("y1",MT).attr("y2",MT+data.length*rowH)
      .attr("stroke","#374151").attr("stroke-width",mini?0.8:1.2);

    // Noms pays au centre — positifs à gauche du centre, négatifs à droite
    data.forEach(d=>{
      const isPos = d.net >= 0;
      const name  = mini
        ? (d.iso3 ?? d.pays.slice(0,3).toUpperCase())
        : d.pays;
      svg.append("text")
        .attr("x",  isPos ? cx-5 : cx+5)
        .attr("y",  (y(d.pays)??0)+y.bandwidth()/2)
        .attr("dy","0.35em")
        .attr("text-anchor", isPos ? "end" : "start")
        .attr("font-size", mini ? 6 : 9.5)
        .attr("font-weight","600")
        .attr("fill","#374151")
        .text(name);
    });

    // Valeurs aux extrémités des barres (full uniquement)
    if (!mini) {
      svg.selectAll<SVGTextElement,Row>("text.val")
        .data(data).enter().append("text")
        .attr("x",  d=>d.net>=0 ? xOf(d.net)+5 : xOf(d.net)-5)
        .attr("y",  d=>(y(d.pays)??0)+y.bandwidth()/2)
        .attr("dy","0.35em")
        .attr("text-anchor",d=>d.net>=0?"start":"end")
        .attr("font-size",8).attr("font-weight","600")
        .attr("fill",d=>d.net>=0?COLOR_POS:COLOR_NEG)
        .text(d=>fmt(d.net));
    }
  }, [donnees, annee, ind, mini]);

  useEffect(()=>{draw();},[draw]);
  useEffect(()=>{
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(()=>draw());
    obs.observe(wrapRef.current);
    return ()=>obs.disconnect();
  },[draw]);

  const annees = [...new Set(donnees.map((d:any)=>d.annee as number))].sort((a,b)=>b-a);
  const Pill = ({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}) => (
    <button onClick={onClick} style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:active?"#004f91":"#F2F0EF",color:active?"#fff":"#9aa5b4",transition:"all 0.15s"}}>{label}</button>
  );

  return (
    <div>
      {!mini&&(
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>
          <select value={annee??annees[0]} onChange={e=>setAnnee(Number(e.target.value))}
            style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:"1px solid #E8E5E3",background:"#F8F7F6",color:"#1a1a2e",cursor:"pointer",outline:"none"}}>
            {annees.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <div style={{width:1,background:"#E8E5E3",margin:"0 2px"}}/>
          <Pill label="Flux net"  active={ind==="flux"}  onClick={()=>setInd("flux")}/>
          <Pill label="Stock net" active={ind==="stock"} onClick={()=>setInd("stock")}/>
        </div>
      )}
      <div ref={wrapRef} style={{width:"100%",overflow:"hidden"}}>
        <svg ref={svgRef} style={{width:"100%",height:"auto",display:"block"}}/>
      </div>
    </div>
  );
}
