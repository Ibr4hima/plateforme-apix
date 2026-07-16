"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { d3, Plot, useD3Pret } from "@/lib/d3lazy";
import {
  Activity, BarChart2, Building2, Calendar, ChevronDown, ChevronUp,
  DollarSign, Handshake, Layers, MapPin, Maximize2, Search,
  SlidersHorizontal, Table2, Target, TrendingUp, X
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CATALOGUE, TABLES_ANALYTIQUES, type Visualisation } from "./catalogue";
import { AnalyticTable } from "@/components/dashboard/DataTable";
import { zoneTypeMeta } from "@/components/shared/zoneTypes";
import { Skeleton } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { demarrerRedimension } from "@/lib/redimension";
import { CHIFFRE_KPI } from "@/lib/typo";

// Layout effect côté client, effet classique côté serveur (évite le warning SSR)
const useIsoLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const COLORS = ["#ca631f","#004f91","#059669","#7c3aed","#0891b2","#d97706","#E35336","#188038","#dc2626","#65a30d","#f59e0b","#6366f1","#14b8a6","#f43f5e","#84cc16"];

const ICON_MAP: Record<string, any> = {
  Building2, MapPin, Handshake, Calendar, TrendingUp, Layers, Target, DollarSign, Activity
};

// ─── Persistance ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "apix_dashboard_v4";
interface DashConfig {
  kpisActifs: string[];
  cards: CardConfig[];
  tableCards: TableCardConfig[];
}
interface CardConfig {
  id: string; vizId: string; params: Record<string,any>;
  chartType: ChartType; size: "sm"|"md"|"lg"; col: number;
}
interface TableCardConfig {
  id: string; tableId: string; size: "md"|"lg";
}
type ChartType = "auto"|"bar_h"|"bar_v"|"donut"|"line"|"table";

const DEFAULT_CONFIG: DashConfig = {
  kpisActifs: [],
  cards: [],
  tableCards: [],
};

function loadConfig(): DashConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}
function saveConfig(c: DashConfig) {
  if(typeof window!=="undefined") localStorage.setItem(STORAGE_KEY,JSON.stringify(c));
}

function detectChartType(data: any[]): ChartType {
  if(!data.length) return "bar_h";
  const keys = Object.keys(data[0]);
  if(keys.includes("label") && !isNaN(Number(data[0].label)) && Number(data[0].label) > 1900) return "bar_v";
  if(keys.includes("label") && keys.includes("valeur") && data.length <= 6) return "donut";
  if(keys.length > 3) return "table";
  return "bar_h";
}

// ─── Graphiques d3 ────────────────────────────────────────────────────────────
function BarH({ data, height, palette=COLORS }: { data:any[]; height:number; palette?:string[] }) {
  const ref=useRef<SVGSVGElement>(null); const cRef=useRef<HTMLDivElement>(null); const [w,setW]=useState(400);
  useEffect(()=>{ let _t:ReturnType<typeof setTimeout>; const obs=new ResizeObserver(e=>{ const cw=e[0].contentRect.width; clearTimeout(_t); _t=setTimeout(()=>setW(cw),140); }); if(cRef.current)obs.observe(cRef.current); return()=>{ clearTimeout(_t); obs.disconnect(); }; },[]);
  useEffect(()=>{
    if(!ref.current||!data.length) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const m={top:4,right:44,bottom:4,left:130}; const W=w-m.left-m.right,H=height-m.top-m.bottom;
    const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const x=d3.scaleLinear().domain([0,d3.max(data,d=>d.valeur)||1]).range([0,W]);
    const y=d3.scaleBand().domain(data.map(d=>String(d.label))).range([0,H]).padding(0.28);
    g.selectAll("rect").data(data).join("rect").attr("x",0).attr("y",d=>y(String(d.label))??0)
      .attr("height",y.bandwidth()).attr("fill",(_,i)=>palette[i%palette.length]).attr("opacity",0.9).attr("width",0)
      .transition().duration(450).delay((_,i)=>i*35).attr("width",d=>x(d.valeur));
    g.selectAll(".lbl").data(data).join("text").attr("class","lbl").attr("x",-7)
      .attr("y",d=>(y(String(d.label))??0)+y.bandwidth()/2).attr("dy","0.35em")
      .attr("text-anchor","end").style("font-size","11px").style("fill","#4a5568").style("font-weight","500")
      .text(d=>{const t=String(d.label);return t.length>17?t.slice(0,16)+"…":t;});
    g.selectAll(".val").data(data).join("text").attr("class","val")
      .attr("x",d=>x(d.valeur)+5).attr("y",d=>(y(String(d.label))??0)+y.bandwidth()/2).attr("dy","0.35em")
      .style("font-size","10px").style("fill","#9aa5b4").style("font-weight","700")
      .text(d=>Number(d.valeur).toLocaleString("fr-FR"));
  },[data,w,height]);
  if(!data.length) return <EmptyState/>;
  return <div ref={cRef} style={{width:"100%"}}><svg ref={ref} width={w} height={height}/></div>;
}

// ─── Barres horizontales (Observable Plot) — libellés à gauche, valeur en blanc ──
// Libellé AU-DESSUS de chaque barre (idéal pour les noms longs) — barres pleine largeur.
function HBarAxisChart({ data, height, palette=COLORS }: { data:any[]; height:number; palette?:string[] }) {
  const cRef=useRef<HTMLDivElement>(null); const ref=useRef<SVGSVGElement>(null); const [w,setW]=useState(0);
  const animSig=useRef<string>("");
  useIsoLayout(()=>{ const el=cRef.current; if(!el) return; const measure=()=>setW(p=>{ const cw=Math.round(el.clientWidth); return cw&&cw!==p?cw:p; }); measure(); let _t:ReturnType<typeof setTimeout>; const obs=new ResizeObserver(()=>{ clearTimeout(_t); _t=setTimeout(measure,140); }); obs.observe(el); return()=>{ clearTimeout(_t); obs.disconnect(); }; },[]);
  useEffect(()=>{
    if(!ref.current||!data.length||!w) return;
    // Animer seulement quand les données changent, pas au redimensionnement
    const sig=data.map((d:any)=>`${d.label}:${d.valeur}`).join("|");
    const animate=sig!==animSig.current; animSig.current=sig;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const W=w, H=height, mRight=10;
    const sorted=[...data].sort((a:any,b:any)=>b.valeur-a.valeur);
    const N=sorted.length;
    const x=d3.scaleLinear().domain([0, d3.max(sorted,(d:any)=>d.valeur)||1]).range([0, W-mRight]);
    const rowH=H/N;
    const barH=Math.max(12, Math.min(30, rowH-26));
    const barY=18;
    const maxChars=Math.max(8, Math.floor((W-mRight)/6.7));

    svg.attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet").attr("style","max-width:100%;height:auto;font-family:var(--font-google-sans),sans-serif;");
    const rows=svg.append("g").selectAll("g.row").data(sorted).join("g").attr("transform",(_:any,i:number)=>`translate(0,${i*rowH})`);

    // Libellé au-dessus
    rows.append("text").attr("x",1).attr("y",13)
      .style("font-size","12.5px").style("font-weight","400").style("fill","#4a5568")
      .text((d:any)=>{ const s=String(d.label); return s.length>maxChars?s.slice(0,maxChars-1)+"…":s; });

    // Barre
    const bars=rows.append("rect").attr("x",0).attr("y",barY).attr("height",barH)
      .attr("fill",(d:any,i:number)=>d._c ?? palette[i%palette.length]);
    if(animate){
      bars.attr("width",0).transition().duration(450).delay((_:any,i:number)=>i*45)
        .attr("width",(d:any)=>Math.max(2, x(d.valeur)));
    } else {
      bars.attr("width",(d:any)=>Math.max(2, x(d.valeur)));
    }

    // Valeur (dans la barre, sinon à droite) — texte à contraste adaptatif
    rows.append("text").attr("y",barY+barH/2).attr("dy","0.35em")
      .style("font-size","11px").style("font-weight","700")
      .attr("x",(d:any)=>x(d.valeur)<28 ? x(d.valeur)+6 : x(d.valeur)-7)
      .attr("text-anchor",(d:any)=>x(d.valeur)<28 ? "start":"end")
      .attr("fill",(d:any,i:number)=>{
        if(x(d.valeur)<28) return "#4a5568";
        const col=d._c ?? palette[i%palette.length];
        const rgb=d3.color(col)?.rgb();
        const lum=rgb ? (0.299*rgb.r+0.587*rgb.g+0.114*rgb.b)/255 : 0;
        return lum>0.62 ? "#1a1a2e" : "#fff";
      })
      .text((d:any)=>Number(d.valeur).toLocaleString("fr-FR"));
  },[data,w,height,palette]);

  if(!data.length) return <EmptyState h={height}/>;
  return <div ref={cRef} style={{ width:"100%" }}><svg ref={ref} style={{ width:"100%", height, display:"block" }}/></div>;
}

// ─── Barres verticales (Observable Plot) — libellés inclinés ─────────────────
function VBarChart({ data, height, palette=COLORS, rotateX=false }: { data:any[]; height:number; palette?:string[]; rotateX?:boolean }) {
  const cRef=useRef<HTMLDivElement>(null); const ref=useRef<SVGSVGElement>(null); const [w,setW]=useState(440);
  useEffect(()=>{ let _t:ReturnType<typeof setTimeout>; const obs=new ResizeObserver(e=>{ const cw=e[0].contentRect.width; clearTimeout(_t); _t=setTimeout(()=>setW(cw),140); }); if(cRef.current)obs.observe(cRef.current); return()=>{ clearTimeout(_t); obs.disconnect(); }; },[]);
  useEffect(()=>{
    if(!ref.current) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    if(!data.length) return;
    const sorted=[...data].sort((a:any,b:any)=>b.valeur-a.valeur).map((d:any,i:number)=>({ ...d, _c: d._c ?? palette[i%palette.length] }));
    const W=w, H=height, M={top:18,right:8,bottom:rotateX?64:26,left:30};
    const x=d3.scaleBand().domain(sorted.map((d:any)=>String(d.label))).rangeRound([M.left,W-M.right]).padding(0.2);
    const maxVal=d3.max(sorted,(d:any)=>d.valeur)||1;
    const y=d3.scaleLinear().domain([0,maxVal]).nice().rangeRound([H-M.bottom,M.top]);
    svg.attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet")
       .attr("style","max-width:100%;height:auto;font-family:var(--font-google-sans),sans-serif;");

    // Grille horizontale
    svg.append("g").selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1",M.left).attr("x2",W-M.right).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","#EFEDEA");

    // Barres
    svg.append("g").selectAll("rect").data(sorted).join("rect")
      .attr("x",(d:any)=>x(String(d.label))!).attr("width",x.bandwidth())
      .attr("y",(d:any)=>y(d.valeur)).attr("height",(d:any)=>y(0)-y(d.valeur))
      .attr("fill",(d:any)=>d._c);

    // Valeurs au-dessus
    svg.append("g").selectAll("text").data(sorted).join("text")
      .attr("x",(d:any)=>x(String(d.label))!+x.bandwidth()/2).attr("y",(d:any)=>y(d.valeur)-6)
      .attr("text-anchor","middle").style("font-size","11px").style("font-weight","700").style("fill","#4a5568")
      .text((d:any)=>Number(d.valeur).toLocaleString("fr-FR"));

    // Axe X (style « zone économique » : gras, sans rotation)
    const ax=svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call((g:any)=>g.selectAll(".domain").remove());
    if(rotateX){
      ax.call((g:any)=>g.selectAll("text").style("font-size","10px").style("fill","#9aa5b4")
        .attr("transform","rotate(-30)").style("text-anchor","end")
        .text((d:any)=>{ const s=String(d); return s.length>14?s.slice(0,13)+"…":s; }));
    } else {
      ax.call((g:any)=>g.selectAll("text").style("font-size","11px").style("font-weight","700").style("fill","#4a5568"));
    }

    // Axe Y (style « zone économique »)
    svg.append("g").attr("transform",`translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .call((g:any)=>g.select(".domain").remove())
      .call((g:any)=>g.selectAll("line").remove())
      .call((g:any)=>g.selectAll("text").style("font-size","10px").style("fill","#9aa5b4"));
  },[data,w,height,palette,rotateX]);
  if(!data.length) return <EmptyState h={height}/>;
  return <div ref={cRef} style={{ width:"100%", position:"relative" as const }}><svg ref={ref} style={{ width:"100%", height, display:"block" }}/></div>;
}

function BarV({ data, height, color="#004f91" }: { data:any[]; height:number; color?:string }) {
  const ref=useRef<SVGSVGElement>(null); const cRef=useRef<HTMLDivElement>(null); const [w,setW]=useState(400);
  useEffect(()=>{ let _t:ReturnType<typeof setTimeout>; const obs=new ResizeObserver(e=>{ const cw=e[0].contentRect.width; clearTimeout(_t); _t=setTimeout(()=>setW(cw),140); }); if(cRef.current)obs.observe(cRef.current); return()=>{ clearTimeout(_t); obs.disconnect(); }; },[]);
  useEffect(()=>{
    if(!ref.current||!data.length) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const m={top:10,right:10,bottom:30,left:34}; const W=w-m.left-m.right,H=height-m.top-m.bottom;
    const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const x=d3.scaleBand().domain(data.map(d=>String(d.label))).range([0,W]).padding(0.2);
    const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.valeur)||1]).range([H,0]);
    g.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .call(g=>g.select(".domain").remove()).call(g=>g.selectAll(".tick line").attr("stroke","#F2F0EF").attr("x2",W))
      .call(g=>g.selectAll(".tick text").style("font-size","10px").style("fill","#9aa5b4"));
    const ticks=x.domain().filter((_,i,a)=>i===0||i===a.length-1||i%Math.ceil(a.length/6)===0);
    g.append("g").attr("transform",`translate(0,${H})`).call(d3.axisBottom(x).tickValues(ticks))
      .call(g=>g.select(".domain").remove()).call(g=>g.selectAll(".tick line").remove())
      .call(g=>g.selectAll(".tick text").style("font-size","10px").style("fill","#9aa5b4"));
    g.selectAll("rect").data(data).join("rect").attr("x",d=>x(String(d.label))??0).attr("y",H)
      .attr("width",x.bandwidth()).attr("height",0).attr("fill",color).attr("opacity",0.85)
      .transition().duration(450).delay((_,i)=>i*12).attr("y",d=>y(d.valeur)).attr("height",d=>H-y(d.valeur));
  },[data,w,height,color]);
  if(!data.length) return <EmptyState h={height}/>;
  return <div ref={cRef} style={{width:"100%"}}><svg ref={ref} width={w} height={height}/></div>;
}

function DonutChart({ data, size, palette=COLORS }: { data:any[]; size:number; palette?:string[] }) {
  const ref=useRef<SVGSVGElement>(null);
  useEffect(()=>{
    if(!ref.current||!data.length) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const R=size/2-12;
    const g=svg.append("g").attr("transform",`translate(${size/2},${size/2})`);
    const pie=d3.pie<any>().value(d=>d.valeur).sort(null);
    const arc=d3.arc<d3.PieArcDatum<any>>().innerRadius(R*.58).outerRadius(R);
    const arcH=d3.arc<d3.PieArcDatum<any>>().innerRadius(R*.58).outerRadius(R+5);
    g.selectAll("path").data(pie(data)).join("path")
      .attr("fill",(_,i)=>palette[i%palette.length]).attr("opacity",.85).attr("d",arc as any)
      .style("cursor","pointer")
      .on("mouseenter",function(_,d){d3.select(this).attr("d",arcH(d) as string).attr("opacity",1);})
      .on("mouseleave",function(_,d){d3.select(this).attr("d",arc(d) as string).attr("opacity",.85);})
      .transition().duration(600).attrTween("d",function(d){
        const i=d3.interpolate({startAngle:0,endAngle:0},d); return t=>arc(i(t)) as string;
      });
    const total=d3.sum(data,d=>d.valeur);
    g.append("text").attr("text-anchor","middle").attr("dy","-.1em").style("font-size","17px").style("font-weight","800").style("fill","#1a1a2e").text(total.toLocaleString("fr-FR"));
    g.append("text").attr("text-anchor","middle").attr("dy","1.2em").style("font-size","10px").style("fill","#9aa5b4").text("total");
  },[data,size]);
  if(!data.length) return <EmptyState h={size}/>;
  return (
    <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <svg ref={ref} width={size} height={size}/>
      <div style={{display:"flex",flexDirection:"column" as const,gap:6,flex:1,minWidth:100}}>
        {data.slice(0,7).map((it,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:8,height:8,borderRadius:2,background:palette[i%palette.length],flexShrink:0}}/>
              <span style={{fontSize:11,color:"#4a5568"}}>{String(it.label)}</span>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:"#1a1a2e"}}>{Number(it.valeur).toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut avec étiquettes reliées par des lignes (leader lines) ─────────────
function DonutLabeled({ data, height, palette=COLORS, compact=false }: { data:any[]; height:number; palette?:string[]; compact?:boolean }) {
  const cRef=useRef<HTMLDivElement>(null); const ref=useRef<SVGSVGElement>(null); const [w,setW]=useState(0);
  const animSig=useRef<string>("");
  useIsoLayout(()=>{ const el=cRef.current; if(!el) return; const measure=()=>setW(p=>{ const cw=Math.round(el.clientWidth); return cw&&cw!==p?cw:p; }); measure(); let _t:ReturnType<typeof setTimeout>; const obs=new ResizeObserver(()=>{ clearTimeout(_t); _t=setTimeout(measure,140); }); obs.observe(el); return()=>{ clearTimeout(_t); obs.disconnect(); }; },[]);
  useEffect(()=>{
    if(!ref.current||!data.length||!w) return;
    // Animer seulement quand les données changent, pas au redimensionnement
    const sig=data.map((d:any)=>`${d.label}:${d.valeur}`).join("|");
    const animate=sig!==animSig.current; animSig.current=sig;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const W=w, H=height;
    const radius = Math.max(40, Math.min(H/2 - 10, W/2 - (compact?80:140)));
    svg.attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet").attr("style","max-width:100%;height:auto;");
    const g = svg.append("g").attr("transform",`translate(${W/2},${H/2})`);

    const pie = d3.pie<any>().value(d=>d.valeur).sort(null);
    const arc = d3.arc<d3.PieArcDatum<any>>().innerRadius(radius*0.6).outerRadius(radius);
    const outer = d3.arc<d3.PieArcDatum<any>>().innerRadius(radius*1.06).outerRadius(radius*1.06);
    const arcs = pie(data);
    const mid = (d:any)=>d.startAngle+(d.endAngle-d.startAngle)/2;

    // Parts
    const parts = g.selectAll("path").data(arcs).join("path")
      .attr("fill",(d:any,i:number)=>d.data._c ?? palette[i%palette.length]).attr("opacity",0.92);
    if(animate){
      parts.attr("d",arc as any)
        .transition().duration(550).attrTween("d",function(d:any){ const i=d3.interpolate({startAngle:0,endAngle:0},d); return (t:number)=>arc(i(t)) as string; });
    } else {
      parts.attr("d",arc as any);
    }

    // Total au centre
    const total=d3.sum(data,d=>d.valeur);
    g.append("text").attr("text-anchor","middle").attr("dy","-.05em").style("font-size","18px").style("font-weight","800").style("fill","#1a1a2e").text(total.toLocaleString("fr-FR"));
    g.append("text").attr("text-anchor","middle").attr("dy","1.4em").style("font-size","9.5px").style("fill","#9aa5b4").text("total");

    // Lignes de repère (coude + segment horizontal)
    const lineEnd = radius*(compact?1.12:1.16);
    g.selectAll("polyline").data(arcs).join("polyline")
      .attr("fill","none").attr("stroke","#D5D0CC").attr("stroke-width",1).attr("stroke-linejoin","round")
      .attr("points",(d:any)=>{ const p0=arc.centroid(d); const p1=outer.centroid(d); const p2:[number,number]=[lineEnd*(mid(d)<Math.PI?1:-1), p1[1]]; return [p0,p1,p2] as any; });

    // Étiquettes (nom + badge valeur, sur une ligne, alignées sur le trait)
    const esc=(s:string)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const ABBR:Record<string,string>={ primaire:"Prim.", secondaire:"Sec.", tertiaire:"Tert." };
    const shortLbl=(s:string)=>{ const c=String(s).replace(/^secteur\s+/i,"").trim(); const cap=c.charAt(0).toUpperCase()+c.slice(1); return compact ? (ABBR[c.toLowerCase()]||cap.slice(0,4)+".") : cap; };
    const FO_W=compact?100:190, FO_H=24;
    const fo = g.selectAll("foreignObject.lbl").data(arcs).join("foreignObject").attr("class","lbl")
      .attr("width",FO_W).attr("height",FO_H)
      .attr("x",(d:any)=>{ const right=mid(d)<Math.PI; const lx=(lineEnd+6)*(right?1:-1); return right?lx:lx-FO_W; })
      .attr("y",(d:any)=>outer.centroid(d)[1]-FO_H/2)
      .style("overflow","visible").style("pointer-events","none");
    fo.append("xhtml:div")
      .style("display","flex").style("align-items","center").style("gap","7px").style("height",`${FO_H}px`)
      .style("justify-content",(d:any)=>mid(d)<Math.PI?"flex-start":"flex-end")
      .style("white-space","nowrap").style("font-family","var(--font-google-sans),sans-serif")
      .html((d:any,i:number)=>{
        const c=d.data._c ?? palette[i%palette.length];
        const rgb=d3.color(c)?.rgb();
        const lum=rgb ? (0.299*rgb.r+0.587*rgb.g+0.114*rgb.b)/255 : 0;
        const txt=lum>0.62?"#1a1a2e":"#fff";
        return `<span style="font-size:12.5px;color:#4a5568">${esc(shortLbl(d.data.label))}</span>`+
               `<span style="font-size:11px;font-weight:800;color:${txt};background:${c};padding:1px 8px;border-radius:999px;line-height:1.5">${Number(d.data.valeur).toLocaleString("fr-FR")}</span>`;
      });
  },[data,w,height,palette]);

  if(!data.length) return <EmptyState h={height}/>;
  return <div ref={cRef} style={{width:"100%"}}><svg ref={ref} style={{width:"100%",height,display:"block"}}/></div>;
}

// ─── Line Chart (Créations par année) — style IDE ────────────────────────────
function CreationsLineChart({ data, height }: { data: { label: number; valeur: number }[]; height: number }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data.length) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();

    const W = wrapRef.current.clientWidth || 600;
    const H = height;
    const M = { top: 12, right: 20, bottom: 34, left: 52 };

    const sorted   = [...data].sort((a, b) => a.label - b.label);
    const annees   = sorted.map(d => d.label);
    const maxVal   = d3.max(sorted, d => d.valeur) ?? 1;
    const minAnnee = annees[0];
    const maxAnnee = annees[annees.length - 1];

    const xLin = d3.scaleLinear().domain([minAnnee, maxAnnee]).range([M.left, W - M.right]);
    const y    = d3.scaleLinear().domain([0, maxVal * 1.08]).nice().range([H - M.bottom, M.top]);

    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    // Grille horizontale
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#EBEBEB").attr("stroke-width", 1);

    // Ligne y=0 pointillée
    svg.append("line")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", "#C5BFBB").attr("stroke-width", 1.2).attr("stroke-dasharray", "4,3");

    const COLOR = "#004f91";

    // Gradient de remplissage
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "cpa-grad").attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    grad.append("stop").attr("offset", "0%").attr("stop-color", COLOR).attr("stop-opacity", 0.1);
    grad.append("stop").attr("offset", "100%").attr("stop-color", COLOR).attr("stop-opacity", 0);

    // Aire
    svg.append("path").datum(sorted)
      .attr("fill", "url(#cpa-grad)")
      .attr("d", d3.area<typeof sorted[0]>()
        .x(d => xLin(d.label))
        .y0(y(0)).y1(d => y(d.valeur))
        .curve(d3.curveMonotoneX));

    // Courbe
    svg.append("path").datum(sorted)
      .attr("fill", "none").attr("stroke", COLOR).attr("stroke-width", 2.2)
      .attr("d", d3.line<typeof sorted[0]>()
        .x(d => xLin(d.label))
        .y(d => y(d.valeur))
        .curve(d3.curveMonotoneX));

    // Points + tooltip
    const rBase = sorted.length > 25 ? 0 : sorted.length > 18 ? 1.5 : 2.5;
    const tip   = d3.select("#d3-tooltip") as any;
    // Points visibles (décoratifs : les événements passent par les cibles invisibles)
    let dots: any = null;
    if (rBase > 0) {
      dots = svg.selectAll<SVGCircleElement, typeof sorted[0]>("circle.pt")
        .data(sorted).enter().append("circle").attr("class", "pt")
        .attr("cx", d => xLin(d.label)).attr("cy", d => y(d.valeur)).attr("r", rBase)
        .attr("fill", "#fff").attr("stroke", COLOR).attr("stroke-width", 1.5)
        .style("pointer-events", "none");
    }
    // Larges cibles de survol invisibles : le tooltip se déclenche à coup sûr
    svg.selectAll<SVGCircleElement, typeof sorted[0]>("circle.ph")
      .data(sorted).enter().append("circle").attr("class", "ph")
      .attr("cx", d => xLin(d.label)).attr("cy", d => y(d.valeur)).attr("r", Math.max(10, rBase + 6))
      .attr("fill", "transparent").attr("stroke", "none").style("cursor", "pointer")
      .on("mouseover", (e, d) => {
        if (dots) dots.filter((p: any) => p === d).attr("r", rBase + 2);
        showD3Tooltip(tip, e, `<strong>${d.label}</strong><br/>${d.valeur.toLocaleString("fr-FR")} créations`);
      })
      .on("mousemove", (e) => showD3Tooltip(tip, e))
      .on("mouseout", (e, d) => { if (dots) dots.filter((p: any) => p === d).attr("r", rBase); hideD3Tooltip(tip); });

    // Axe X
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(xLin).ticks(8).tickFormat(d3.format("d")).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#E8E5E3"))
      .call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));

    // Axe Y
    const fmtY = (v: d3.NumberValue) => { const n = +v; return n >= 1000 ? `${(n/1000).toFixed(0)}k` : `${n}`; };
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtY))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));

  }, [data, height]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height, display: "block" }} />
    </div>
  );
}

// ─── HBarChart Région (Entreprises par région) — style IDE ───────────────────
function RegionBarPlot({ data, height, compact = false }: { data: { label: string; valeur: number }[]; height: number; compact?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data.length) return;
    const el = svgRef.current;
    d3.select(el).selectAll("*").remove();

    const rows = [...data].sort((a, b) => b.valeur - a.valeur).slice(0, compact ? 6 : 14);
    const W    = wrapRef.current.clientWidth || 500;
    const rowH = compact ? 20 : 38;
    const longestName = compact ? 3 : Math.max(...rows.map(d => d.label.length));
    const M = compact
      ? { top: 4, right: 10, bottom: 4, left: 36 }
      : { top: 8, right: 72, bottom: 8, left: Math.max(90, longestName * 6.8 + 12) };
    const H = rows.length * rowH + M.top + M.bottom;

    const maxVal = d3.max(rows, d => d.valeur) ?? 1;
    const x = d3.scaleLinear().domain([0, maxVal]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(rows.map(d => d.label)).range([M.top, H - M.bottom]).padding(0.2);

    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const minInside = compact ? 30 : 60;

    // Barres
    svg.selectAll<SVGRectElement, typeof rows[0]>("rect.bar")
      .data(rows).enter().append("rect")
      .attr("class", "bar")
      .attr("x",      M.left)
      .attr("y",      d => y(d.label)!)
      .attr("width",  d => Math.max(2, x(d.valeur) - M.left))
      .attr("height", y.bandwidth())
      .attr("fill",   "#004f91");

    // Valeur (intérieur ou extérieur selon la largeur de barre)
    svg.selectAll<SVGTextElement, typeof rows[0]>("text.val")
      .data(rows).enter().append("text")
      .attr("class", "val")
      .attr("x",  d => {
        const bw = x(d.valeur) - M.left;
        return bw >= minInside ? x(d.valeur) - 5 : x(d.valeur) + 5;
      })
      .attr("y",           d => y(d.label)! + y.bandwidth() / 2)
      .attr("dy",          "0.35em")
      .attr("text-anchor", d => (x(d.valeur) - M.left) >= minInside ? "end" : "start")
      .attr("font-size",   compact ? 8 : 11)
      .attr("font-weight", "600")
      .attr("fill",        d => (x(d.valeur) - M.left) >= minInside ? "white" : "#004f91")
      .text(d => d.valeur.toLocaleString("fr-FR"));

    // Label gauche
    svg.selectAll<SVGTextElement, typeof rows[0]>("text.lbl")
      .data(rows).enter().append("text")
      .attr("class",       "lbl")
      .attr("x",           M.left - 6)
      .attr("y",           d => y(d.label)! + y.bandwidth() / 2)
      .attr("dy",          "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size",   compact ? 8 : 11)
      .attr("font-weight", "500")
      .attr("fill",        "#374151")
      .text(d => compact ? regionISO(d.label) : d.label);

  }, [data, compact]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div ref={wrapRef} style={{ width: "100%", height }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

const REGION_ISO: Record<string, string> = {
  "Dakar": "DK", "Diourbel": "DB", "Fatick": "FK", "Kaffrine": "KA",
  "Kaolack": "KL", "Kédougou": "KE", "Kolda": "KD", "Louga": "LO",
  "Matam": "MT", "Saint-Louis": "SL", "Sédhiou": "SE",
  "Tambacounda": "TC", "Thiès": "TH", "Ziguinchor": "ZG",
};
const regionISO = (nom: string) => REGION_ISO[nom] ?? nom.slice(0, 2).toUpperCase();


type DeptRow = { region: string; departement: string; valeur: number };

function DeptStackedBars({ data, height, compact = false }: { data: DeptRow[]; height: number; compact?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef  = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data.length) return;
    d3.select(svgRef.current).selectAll("*").remove();

    // Group by region, sort regions by total desc
    const byRegion = d3.group(data, d => d.region);
    const regions  = Array.from(byRegion.entries())
      .map(([r, rows]) => ({ region: r, total: d3.sum(rows, d => d.valeur), depts: rows }))
      .sort((a, b) => b.total - a.total);

    const W    = wrapRef.current.clientWidth || 600;
    const M    = compact
      ? { top: 4, right: 4, bottom: 28, left: 4 }
      : { top: 8, right: 8, bottom: 52, left: 8 };
    const innerW = W - M.left - M.right;
    const innerH = height - M.top - M.bottom;

    const x = d3.scaleBand()
      .domain(regions.map(r => r.region))
      .range([0, innerW])
      .padding(0.18);

    const maxTotal = d3.max(regions, r => r.total) ?? 1;
    const y = d3.scaleLinear().domain([0, maxTotal]).range([innerH, 0]);

    // Fixed color palette for departments (per region, cycling)
    const DEPT_PALETTE = ["#004f91", "#2a6faa", "#4d8fc3", "#70afdc", "#93cff5",
                          "#0a5c2d", "#1e7a40", "#3d9e5f", "#62bf84", "#91dba8"];

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${W} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // X axis labels
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick text")
        .style("font-size", compact ? "7px" : "10px")
        .style("fill", "#4a5568")
        .style("font-weight", "500")
        .attr("dy", "1.1em")
        .text((d: any) => compact
          ? regionISO(String(d))
          : (String(d).length > 10 ? String(d).slice(0, 9) + "…" : String(d))));

    // Stacked bars
    regions.forEach(({ region, depts }) => {
      const bx    = x(region) ?? 0;
      const bw    = x.bandwidth();
      let   cumY  = innerH; // stack from bottom

      depts.forEach((dept, di) => {
        const barH = innerH - y(dept.valeur);
        const barY = cumY - barH;
        cumY = barY;

        const fill = DEPT_PALETTE[di % DEPT_PALETTE.length];

        g.append("rect")
          .attr("x",      bx)
          .attr("y",      barY)
          .attr("width",  bw)
          .attr("height", Math.max(0, barH))
          .attr("fill",   fill)
          .style("cursor", "pointer")
          .on("mouseenter", function(event) {
            d3.select(this).attr("opacity", 0.75);
            if (!tipRef.current) return;
            tipRef.current.style.opacity = "1";
            tipRef.current.style.left    = `${event.offsetX + 12}px`;
            tipRef.current.style.top     = `${event.offsetY - 8}px`;
            tipRef.current.innerHTML     =
              `<strong>${dept.departement}</strong><br/>${dept.valeur.toLocaleString("fr-FR")} entreprises`;
          })
          .on("mousemove", function(event) {
            if (!tipRef.current) return;
            tipRef.current.style.left = `${event.offsetX + 12}px`;
            tipRef.current.style.top  = `${event.offsetY - 8}px`;
          })
          .on("mouseleave", function() {
            d3.select(this).attr("opacity", 1);
            if (tipRef.current) tipRef.current.style.opacity = "0";
          });

        // Dept label inside segment if tall enough
        if (!compact && barH > 14) {
          g.append("text")
            .attr("x",           bx + bw / 2)
            .attr("y",           barY + barH / 2)
            .attr("dy",          "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size",  "8px")
            .style("fill",       "white")
            .style("pointer-events", "none")
            .text(dept.departement.length > 8 ? dept.departement.slice(0, 7) + "…" : dept.departement);
        }
      });
    });

  }, [data, height, compact]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div ref={wrapRef} style={{ width: "100%", height, position: "relative" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <div ref={tipRef} style={{
        position: "absolute", pointerEvents: "none", opacity: 0, transition: "opacity 0.1s",
        background: "rgba(26,26,46,0.92)", color: "#fff", borderRadius: 8,
        padding: "7px 11px", fontSize: 12, lineHeight: 1.5, whiteSpace: "nowrap",
        backdropFilter: "blur(4px)", zIndex: 10,
      }} />
    </div>
  );
}

// ─── Branches par secteur (pills + HBarChart) ────────────────────────────────
type BrancheRow = { secteur: string; branche: string; valeur: number };

const shortSecteur = (s: string) => s.replace(/^[Ss]ecteur\s+/i, "");

function BrancheBarChart({ data, height, compact = false }: { data: BrancheRow[]; height: number; compact?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const secteurs   = Array.from(new Set(data.map(d => d.secteur)));
  const [active, setActive] = useState<string>("");
  useEffect(() => { if (data.length && !active) setActive(secteurs[0] ?? ""); }, [data]);

  const PILL_H   = 34;
  const chartH   = compact ? height : height - PILL_H;
  const rows     = data.filter(d => d.secteur === active).sort((a, b) => b.valeur - a.valeur);
  const barColor = secteurColor(active, secteurs.indexOf(active));

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !rows.length) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const W    = wrapRef.current.clientWidth || 500;
    const rowH = compact ? 18 : 36;
    const longestName = compact ? 10 : Math.max(...rows.map(d => d.branche.length));
    const M = compact
      ? { top: 2, right: 8,  bottom: 2, left: 60 }
      : { top: 6, right: 68, bottom: 6, left: Math.max(100, longestName * 6.6 + 12) };
    const H = rows.length * rowH + M.top + M.bottom;

    const maxVal   = d3.max(rows, d => d.valeur) ?? 1;
    const x = d3.scaleLinear().domain([0, maxVal]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(rows.map(d => d.branche)).range([M.top, H - M.bottom]).padding(0.18);

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const minInside = compact ? 28 : 55;

    svg.selectAll<SVGRectElement, BrancheRow>("rect.bar")
      .data(rows).enter().append("rect")
      .attr("class",  "bar")
      .attr("x",      M.left)
      .attr("y",      d => y(d.branche)!)
      .attr("width",  d => Math.max(2, x(d.valeur) - M.left))
      .attr("height", y.bandwidth())
      .attr("fill",   barColor);

    svg.selectAll<SVGTextElement, BrancheRow>("text.val")
      .data(rows).enter().append("text")
      .attr("class",       "val")
      .attr("x",           d => (x(d.valeur) - M.left) >= minInside ? x(d.valeur) - 5 : x(d.valeur) + 5)
      .attr("y",           d => y(d.branche)! + y.bandwidth() / 2)
      .attr("dy",          "0.35em")
      .attr("text-anchor", d => (x(d.valeur) - M.left) >= minInside ? "end" : "start")
      .attr("font-size",   compact ? 8 : 11)
      .attr("font-weight", "600")
      .attr("fill",        d => (x(d.valeur) - M.left) >= minInside ? "white" : barColor)
      .text(d => d.valeur.toLocaleString("fr-FR"));

    svg.selectAll<SVGTextElement, BrancheRow>("text.lbl")
      .data(rows).enter().append("text")
      .attr("class",       "lbl")
      .attr("x",           M.left - 6)
      .attr("y",           d => y(d.branche)! + y.bandwidth() / 2)
      .attr("dy",          "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size",   compact ? 8 : 11)
      .attr("font-weight", "500")
      .attr("fill",        "#374151")
      .text(d => compact
        ? (d.branche.length > 10 ? d.branche.slice(0, 9) + "…" : d.branche)
        : d.branche);

  }, [rows, compact, barColor]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div style={{ width: "100%", height }}>
      {!compact && (
        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" as const }}>
          {secteurs.map(s => (
            <button key={s} onClick={() => setActive(s)} style={{
              padding: "4px 12px", border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, borderRadius: 6,
              background: active === s ? secteurColor(s, secteurs.indexOf(s)) : "#F2F0EF",
              color:      active === s ? "#fff" : "#9aa5b4",
              transition: "all 0.15s",
            }}>{shortSecteur(s)}</button>
          ))}
        </div>
      )}
      <div ref={wrapRef} style={{ width: "100%", height: chartH, overflowY: "auto" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    </div>
  );
}

function _BrancheTreemap_UNUSED({ data, height, compact = false }: { data: BrancheRow[]; height: number; compact?: boolean }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef  = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data.length) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const W = wrapRef.current.clientWidth || 500;
    const H = height;

    // Hierarchy : root → secteur → branche
    const root = d3.hierarchy<any>({
      name: "root",
      children: Array.from(
        d3.group(data, d => d.secteur),
        ([secteur, rows]) => ({
          name: secteur,
          children: rows.map(r => ({ name: r.branche, value: r.valeur, secteur })),
        })
      ),
    }).sum(d => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3.treemap<any>().size([W, H]).padding(compact ? 1 : 2).paddingTop(compact ? 0 : 16)(root);

    const secteurNames = Array.from(new Set(data.map(d => d.secteur)));

    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const leaves = root.leaves() as d3.HierarchyRectangularNode<any>[];

    // Rects
    svg.selectAll<SVGRectElement, typeof leaves[0]>("rect.cell")
      .data(leaves).enter().append("rect")
      .attr("class", "cell")
      .attr("x",      d => d.x0)
      .attr("y",      d => d.y0)
      .attr("width",  d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .attr("fill",   d => {
        const idx = secteurNames.indexOf(d.data.secteur);
        const base = idx === 0 ? "#004f91" : idx === 1 ? "#9195BB" : "#BBB791";
        // Vary lightness slightly per child index within sector
        const siblings = leaves.filter(l => l.data.secteur === d.data.secteur);
        const si = siblings.indexOf(d);
        const t = siblings.length > 1 ? si / (siblings.length - 1) : 0;
        return d3.color(base)!.brighter(t * 0.5).formatHex();
      })
      .style("cursor", "pointer")
      .on("mouseenter", function(event) {
        d3.select(this).attr("opacity", 0.8);
        if (!tipRef.current) return;
        const d = d3.select<SVGRectElement, typeof leaves[0]>(this).datum();
        tipRef.current.style.opacity = "1";
        tipRef.current.style.left    = `${event.offsetX + 12}px`;
        tipRef.current.style.top     = `${event.offsetY - 8}px`;
        tipRef.current.innerHTML =
          `<span style="opacity:.7;font-size:10px">${d.data.secteur}</span><br/>`+
          `<strong>${d.data.name}</strong><br/>${(d.value ?? 0).toLocaleString("fr-FR")} entreprises`;
      })
      .on("mousemove", function(event) {
        if (tipRef.current) {
          tipRef.current.style.left = `${event.offsetX + 12}px`;
          tipRef.current.style.top  = `${event.offsetY - 8}px`;
        }
      })
      .on("mouseleave", function() {
        d3.select(this).attr("opacity", 1);
        if (tipRef.current) tipRef.current.style.opacity = "0";
      });

    if (!compact) {
      // Section headers (secteur)
      const secteurNodes = root.children as d3.HierarchyRectangularNode<any>[];
      secteurNodes?.forEach(sNode => {
        svg.append("text")
          .attr("x", sNode.x0 + 4)
          .attr("y", sNode.y0 + 11)
          .style("font-size", "9px")
          .style("font-weight", "700")
          .style("fill", "#fff")
          .style("text-transform", "uppercase")
          .style("letter-spacing", "0.08em")
          .style("pointer-events", "none")
          .text(sNode.data.name);
      });
    }

    // Branch labels on leaves
    svg.selectAll<SVGTextElement, typeof leaves[0]>("text.lbl")
      .data(leaves).enter().append("text")
      .attr("class", "lbl")
      .attr("x",     d => d.x0 + 4)
      .attr("y",     d => d.y0 + (compact ? (d.y1 - d.y0) / 2 + 4 : 28))
      .style("font-size",     d => {
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        return Math.min(compact ? 8 : 11, Math.max(7, w / 9, h / 3)) + "px";
      })
      .style("fill",          "white")
      .style("font-weight",   "600")
      .style("pointer-events","none")
      .text(d => {
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        if (w < 28 || h < 14) return "";
        const maxChars = Math.floor(w / (compact ? 5 : 6.5));
        const t = d.data.name as string;
        return t.length > maxChars ? t.slice(0, maxChars - 1) + "…" : t;
      });

    // Value labels on leaves (full view only, if enough space)
    if (!compact) {
      svg.selectAll<SVGTextElement, typeof leaves[0]>("text.val")
        .data(leaves).enter().append("text")
        .attr("class", "val")
        .attr("x",   d => d.x0 + 4)
        .attr("y",   d => d.y0 + 40)
        .style("font-size",      "9px")
        .style("fill",           "rgba(255,255,255,0.75)")
        .style("pointer-events", "none")
        .text(d => {
          const w = d.x1 - d.x0, h = d.y1 - d.y0;
          return h > 46 && w > 40 ? (d.value ?? 0).toLocaleString("fr-FR") : "";
        });
    }
  }, [data, height, compact]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div ref={wrapRef} style={{ width: "100%", height, position: "relative" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <div ref={tipRef} style={{
        position: "absolute", pointerEvents: "none", opacity: 0, transition: "opacity 0.12s",
        background: "rgba(26,26,46,0.92)", color: "#fff", borderRadius: 8,
        padding: "7px 11px", fontSize: 12, lineHeight: 1.6, whiteSpace: "nowrap",
        backdropFilter: "blur(4px)", zIndex: 10,
      }} />
    </div>
  );
}

// ─── Proportion Plot (Entreprises par secteur) ────────────────────────────────
const PROPORTION_COLORS = ["#598db8", "#dc9a6d", "#69ac7d"];
const SECTEUR_COLOR: Record<string, string> = {
  primaire:   "#004f91",
  secondaire: "#9195BB",
  tertiaire:  "#BBB791",
};
function secteurColor(nom: string, i: number): string {
  const key = nom.toLowerCase().replace(/^secteur\s+/i, "").trim();
  return SECTEUR_COLOR[key] ?? PROPORTION_COLORS[i % PROPORTION_COLORS.length];
}

function ProportionPlot({ data, height, compact = false }: { data: { label: string; valeur: number }[]; height: number; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [dataZone, setDataZone] = useState<{ label: string; valeur: number }[]>([]);

  useEffect(() => {
    const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetch(`${API}/dashboard/viz/entreprises-en-zone-par-secteur`)
      .then(r => r.json()).then(d => setDataZone(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!plotRef.current || !data.length) return;
    plotRef.current.innerHTML = "";

    const totalAll  = d3.sum(data, d => d.valeur);
    const totalZone = d3.sum(dataZone, d => d.valeur) || 1;
    const secteurs  = Array.from(new Set([...data.map(d => d.label), ...dataZone.map(d => d.label)]));

    const rows = secteurs.flatMap(s => {
      const all  = data.find(d => d.label === s);
      const zone = dataZone.find(d => d.label === s);
      return [
        all  ? { col: "Toutes entreprises",  secteur: s, value: +((all.valeur  / totalAll)  * 100).toFixed(1), count: all.valeur  } : null,
        zone ? { col: "Entreprises en zone",  secteur: s, value: +((zone.valeur / totalZone) * 100).toFixed(1), count: zone.valeur } : null,
      ].filter(Boolean);
    }) as { col: string; secteur: string; value: number; count: number }[];

    const columns = ["Toutes entreprises", "Entreprises en zone"];
    const stack = (opts: object) =>
      Plot.stackY({}, { x: "col", y: "value", z: "secteur", ...opts });

    const marks: any[] = [
      Plot.areaY(rows, stack({ curve: "bump-x", fill: "secteur", stroke: "white", strokeWidth: 0.8 })),
    ];

    const shortLabel = (s: string) => {
      const clean = s.replace(/^[Ss]ecteur\s+/i, "");
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    if (compact) {
      marks.push(
        Plot.text(rows, stack({
          filter: (d: any) => d.col === "Toutes entreprises",
          text: (d: any) => shortLabel(d.secteur),
          textAnchor: "start", dx: 8,
          fill: "white", fontWeight: "bold", fontSize: 10,
        })),
      );
    } else {
      marks.push(
        Plot.text(rows, stack({
          filter: (d: any) => d.col === "Toutes entreprises",
          text: (d: any) => `${d.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`,
          textAnchor: "end", dx: -7, fill: "#4a5568", fontSize: 11,
        })),
        Plot.text(rows, stack({
          filter: (d: any) => d.col === "Entreprises en zone",
          text: (d: any) => `${d.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`,
          textAnchor: "start", dx: 7, fill: "#4a5568", fontSize: 11,
        })),
        Plot.text(rows, stack({
          filter: (d: any) => d.col === "Toutes entreprises",
          text: (d: any) => d.secteur,
          textAnchor: "start", dx: 8,
          fill: "white", fontWeight: "bold", fontSize: 11,
        })),
      );
    }

    const chart = Plot.plot({
      width: w,
      height,
      x: {
        domain: columns,
        axis: compact ? null : "top",
        label: null,
        tickFormat: (d: string) => d,
        tickSize: 0,
        padding: 0,
      },
      y: { axis: null, reverse: true },
      color: {
        domain: secteurs,
        range: secteurs.map((s, i) => secteurColor(s, i)),
      },
      marginLeft:  compact ? 0 : 50,
      marginRight: compact ? 0 : 60,
      marginTop:   compact ? 0 : 20,
      style: {
        fontSize: "12px",
        fontFamily: "var(--font-google-sans, sans-serif)",
        border: "none",
        outline: "none",
        background: "transparent",
        overflow: "visible",
      },
      marks,
    });

    // Retire le border que Plot ajoute parfois via l'élément figure
    (chart as HTMLElement).style.border = "none";
    (chart as HTMLElement).style.outline = "none";

    plotRef.current.appendChild(chart);
  }, [data, dataZone, w, height, compact]);

  if (!data.length) return <EmptyState h={height} />;
  return (
    <div ref={containerRef} style={{ width: "100%", overflow: "hidden" }}>
      <div ref={plotRef} />
    </div>
  );
}

function EmptyState({ h=100 }: { h?:number }) {
  return (
    <div style={{height:h,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:8}}>
      <BarChart2 size={24} style={{color:"#E8E5E3"}}/><span style={{fontSize:12,color:"#C5BFBB"}}>Aucune donnée</span>
    </div>
  );
}

function AutoChart({ data, chartType, height }: { data:any[]; chartType:ChartType; height:number }) {
  const type=chartType==="auto"?detectChartType(data):chartType;
  if(type==="donut") return <DonutChart data={data} size={Math.min(height,160)}/>;
  if(type==="bar_v") return <BarV data={data} height={height}/>;
  return <BarH data={data} height={height}/>;
}

function VizChart({ vizId, data, height, compact }: { vizId: string; data: any[]; height: number; compact?: boolean }) {
  if (vizId === "entreprises-par-secteur") return <ProportionPlot data={data} height={height} compact={compact} />;
  if (vizId === "entreprises-par-region")  return <RegionBarPlot   data={data} height={height} compact={compact} />;
  if (vizId === "entreprises-par-dept")    return <DeptStackedBars   data={data} height={height} compact={compact} />;
  if (vizId === "creations-par-annee")     return <CreationsLineChart data={data} height={height} />;
  return <AutoChart data={data} chartType="auto" height={height} />;
}

function ParamSelect({ param, value, onChange, parentValue }: { param:any; value:any; onChange:(v:any)=>void; parentValue?:any }) {
  const [options,setOptions]=useState<any[]>([]); const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(param.type!=="select_api") return;
    if(param.dependsOn&&!parentValue){setOptions([]);return;}
    setLoading(true);
    const url=param.dependsOn?`${API}${param.endpoint}?${param.dependsOn}=${encodeURIComponent(parentValue)}`:`${API}${param.endpoint}`;
    fetch(url).then(r=>r.json()).then(setOptions).catch(()=>setOptions([])).finally(()=>setLoading(false));
  },[param,parentValue]);
  return (
    <div style={{marginBottom:6}}>
      <label style={{fontSize:11,fontWeight:600,color:"#4a5568",display:"block",marginBottom:3}}>{param.label}</label>
      <select value={value||""} onChange={e=>onChange(e.target.value||null)} disabled={loading||(param.dependsOn&&!parentValue)}
        style={{width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid #E8E5E3",fontSize:12,background:loading?"#F8F7F6":"#fff",color:"#1a1a2e",outline:"none",cursor:"pointer",fontFamily:"var(--font-google-sans)"}}>
        <option value="">{loading?"Chargement…":"Sélectionner…"}</option>
        {options.map((o,i)=><option key={i} value={o[param.valueField]}>{o[param.labelField]}</option>)}
      </select>
    </div>
  );
}

// ─── Download PNG ─────────────────────────────────────────────────────────────
function downloadPNG(svgEl: SVGSVGElement, filename: string, opts?: { titre?: string; annees?: string; legende?: { nom: string; couleur: string }[] }) {
  const SCALE = 3; // suréchantillonnage : rendu net, identique au modal
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const W = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
  const H = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 400;
  // Dimensions explicites en pixels : sans elles le navigateur rastérise le SVG
  // à une taille par défaut puis l'agrandit, d'où une image floue.
  clone.removeAttribute("style");
  clone.setAttribute("width",  String(W * SCALE));
  clone.setAttribute("height", String(H * SCALE));
  clone.setAttribute("font-family", "'Google Sans','Product Sans',Arial,sans-serif");
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url = URL.createObjectURL(blob);
  // Repli : si le canvas est « teinté » (SVG contenant un foreignObject, ex. donut),
  // toDataURL lève une SecurityError → on exporte alors le SVG.
  const downloadSvg = () => {
    const a = document.createElement("a"); a.href=url; a.download=`${filename}.svg`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  };
  const img = new Image();
  img.onload = () => {
    try {
      const PAD    = 26;
      const FONT   = "'Google Sans','Product Sans',Arial,sans-serif";
      const titre  = opts?.titre  || "";
      const annees = opts?.annees || "";
      const legende = opts?.legende || [];

      // ── Mesure du bandeau (titre + badge d'années + légende, avec retours à la ligne)
      const mctx = document.createElement("canvas").getContext("2d")!;
      let headerH = 0;
      const legLines: { nom: string; couleur: string; w: number }[][] = [];
      if (titre || legende.length) {
        headerH = PAD + 26;
        if (legende.length) {
          mctx.font = `700 11px ${FONT}`;
          const maxW = W - PAD * 2;
          let line: { nom: string; couleur: string; w: number }[] = []; let x = 0;
          legende.forEach(l => {
            const w = Math.ceil(mctx.measureText(l.nom).width) + 22;
            if (x + w > maxW && line.length) { legLines.push(line); line = []; x = 0; }
            line.push({ ...l, w }); x += w + 8;
          });
          if (line.length) legLines.push(line);
          headerH += 6 + legLines.length * 26;
        }
        headerH += 10;
      }

      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE; canvas.height = (H + headerH) * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(SCALE, SCALE);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H + headerH);

      if (headerH) {
        ctx.textBaseline = "middle";
        const ty = PAD + 12;
        ctx.font = `700 11px ${FONT}`;
        const badgeW = annees ? Math.ceil(ctx.measureText(annees).width) + 20 : 0;
        ctx.font = `700 16px ${FONT}`; ctx.fillStyle = "#1a1a2e";
        let t = titre;
        const maxTitre = W - PAD * 2 - (badgeW ? badgeW + 10 : 0);
        while (t && ctx.measureText(t).width > maxTitre) t = t.slice(0, -2);
        if (t !== titre) t += "…";
        ctx.fillText(t, PAD, ty);
        if (annees) {
          const bx = PAD + ctx.measureText(t).width + 10;
          ctx.fillStyle = "#ECEAE8";
          ctx.beginPath(); ctx.roundRect(bx, ty - 10, badgeW, 20, 999); ctx.fill();
          ctx.font = `700 11px ${FONT}`; ctx.fillStyle = "#4a5568";
          ctx.fillText(annees, bx + 10, ty + 0.5);
        }
        let ly = PAD + 26 + 6 + 13;
        ctx.font = `700 11px ${FONT}`;
        legLines.forEach(line => {
          let lx = PAD;
          line.forEach(l => {
            ctx.fillStyle = l.couleur + "1F";
            ctx.beginPath(); ctx.roundRect(lx, ly - 10, l.w, 20, 999); ctx.fill();
            ctx.fillStyle = l.couleur;
            ctx.fillText(l.nom, lx + 11, ly + 0.5);
            lx += l.w + 8;
          });
          ly += 26;
        });
      }

      ctx.drawImage(img, 0, headerH, W, H);
      const a = document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`${filename}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      downloadSvg();
    }
  };
  img.onerror = downloadSvg;
  img.src = url;
}

// ─── Tooltip D3 : coordonnées viewport (le tooltip est en position:fixed) et
// repli automatique aux bords pour rester toujours visible à l'écran.
function showD3Tooltip(tooltip: any, e: MouseEvent, html?: string) {
  if (html !== undefined) tooltip.html(html);
  tooltip.style("opacity", 1);
  const node = tooltip.node() as HTMLElement | null;
  const tw = node?.offsetWidth || 120, th = node?.offsetHeight || 44;
  let x = e.clientX + 14, y = e.clientY - th - 14;
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
  if (y < 8) y = e.clientY + 18;
  if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
  tooltip.style("left", x + "px").style("top", y + "px");
}
function hideD3Tooltip(tooltip: any) { tooltip.style("opacity", 0); }

// ─── Modal visualisation ──────────────────────────────────────────────────────
function VizModal({ open, onClose, titre, vizId, children }: { open:boolean; onClose:()=>void; titre:string; vizId:string; children:React.ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement|null;
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:1100,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête fixe */}
        <div style={{padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
          <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",margin:0,lineHeight:1.35}}>{titre}</h2>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:"#F5F4F3",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div style={{padding:"22px 28px",overflowY:"auto" as const,flex:1}}>
          <div ref={modalRef}>{children}</div>
        </div>

        {/* Pied fixe */}
        <div style={{padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
          <button onClick={()=>{const svg=getSvg();if(svg)downloadPNG(svg,vizId,{titre});}}
            style={{padding:"9px 20px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontSize:12.5,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,boxShadow:"0 3px 12px rgba(0,79,145,0.25)",fontFamily:"var(--font-google-sans)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card visualisation ───────────────────────────────────────────────────────
function VizCard({ card, viz, onRemove }: {
  card:CardConfig; viz:Visualisation; onRemove:()=>void;
}) {
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [open,setOpen]=useState(false);
  const fetchData=useCallback(()=>{
    setLoading(true);
    const params=new URLSearchParams();
    Object.entries(card.params||{}).forEach(([k,v])=>{if(v!=null)params.set(k,String(v));});
    const url=`${API}${viz.endpoint}${params.toString()?"?"+params.toString():""}`;
    fetch(url).then(r=>r.json()).then(d=>{setData(Array.isArray(d)?d:[]);}).catch(()=>setData([])).finally(()=>setLoading(false));
  },[viz.endpoint,card.params]);
  useEffect(()=>{fetchData();},[fetchData]);

  return (
    <>
      <div onClick={()=>!loading&&data.length>0&&setOpen(true)}
        style={{background:"#fff",borderRadius:14,border:"1px solid #ECEAE7",padding:"16px 18px",cursor:loading||data.length===0?"default":"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",minWidth:0}}
        onMouseEnter={e=>{if(!loading&&data.length>0){e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const sp=box.firstElementChild as HTMLElement|null; if(!sp) return; const d=sp.scrollWidth-(box as HTMLElement).clientWidth; if(d>0){ sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; } });}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor="#ECEAE7";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const sp=box.firstElementChild as HTMLElement|null; if(!sp) return; sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; });}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div data-marquee style={{flex:1,minWidth:0,overflow:"hidden",whiteSpace:"nowrap" as const}}>
            <p style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",margin:0,display:"inline-block"}}>{viz.titre}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:8}}>
            <span style={{width:26,height:26,borderRadius:8,background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
              <Maximize2 size={11} style={{color:"#9aa5b4"}}/>
            </span>
            <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"transparent",border:"none",cursor:"pointer",borderRadius:6,padding:4,color:"#C5BFBB"}}><X size={11}/></button>
          </div>
        </div>
        <div style={{pointerEvents:"none"}}>
          {loading?(
            <Skeleton w="100%" h={160} r={10}/>
          ):data.length===0?(
            <EmptyState h={160}/>
          ):(
            <div className="charge-in"><VizChart vizId={viz.id} data={data} height={160} compact/></div>
          )}
        </div>
      </div>

      <VizModal open={open} onClose={()=>setOpen(false)} titre={viz.titre} vizId={viz.id}>
        <VizChart vizId={viz.id} data={data} height={400}/>
      </VizModal>
    </>
  );
}

// ─── Card tableau — toujours affiché, toujours pleine largeur ────────────────
function TableCard({ card, onRemove }: {
  card: TableCardConfig; onRemove: ()=>void;
}) {
  const def = TABLES_ANALYTIQUES.find(t=>t.id===card.tableId);
  if(!def) return null;
  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid #ECEAE7",
      boxShadow:"0 1px 3px rgba(0,0,0,0.03)",overflow:"hidden",
      gridColumn:"span 2"}}>
      <AnalyticTable tableId={card.tableId} titre={def.titre} description={def.description} embedded onClose={onRemove}/>
    </div>
  );
}

// ─── Indicateurs Global (fixes, toujours affichés) ───────────────────────────
// Affichage façon IDE. Les valeurs viennent de /dashboard/stats (statKey) ;
// en attendant le branchement des calculs, on affiche « — ».
const KPI_ACCENT = "#004f91";
const GLOBAL_KPIS: { key:string; label:string; statKey:string; unit?:"jours"|"%" }[] = [
  { key:"installees", label:"Entreprises installées",          statKey:"global_installees" },
  { key:"ciblees",    label:"Entreprises ciblées",             statKey:"global_ciblees" },
  { key:"contactees", label:"Entreprises en contact",          statKey:"global_contactees" },
  { key:"duree",      label:"Durée de transformation",         statKey:"global_duree",  unit:"jours" },
  { key:"taux",       label:"Taux de transformation",          statKey:"global_taux",   unit:"%" },
];

// ─── KPI Card (fixe, style IDE) ──────────────────────────────────────────────
function KPICard({ def, value }: { def: typeof GLOBAL_KPIS[number]; value:any }) {
  const num = Number(value);
  const hasVal = value!=null && value!=="" && !Number.isNaN(num);
  const nb = hasVal ? num.toLocaleString("fr-FR") : "—";
  const display = !hasVal ? "—"
    : def.unit==="%"     ? `${nb} %`
    : def.unit==="jours" ? `${nb} jours`
    : nb;
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1px solid #ECEAE7", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", minWidth:0 }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor="#ECEAE7";}}>
      <p style={{ fontSize:9, fontWeight:800, color:KPI_ACCENT, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:7, lineHeight:1.4 }}>{def.label}</p>
      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
        <p style={{ ...CHIFFRE_KPI }}>{display}</p>
        {def.unit==="jours" && <span style={{ fontSize:8.5, fontWeight:700, color:"#9aa5b4", background:"#F2F0EF", padding:"1px 6px", borderRadius:5, textTransform:"uppercase" as const, letterSpacing:"0.04em" }}>moy.</span>}
      </div>
    </div>
  );
}

// ─── Cascade dimension → indicateur (filtre des visualisations) ──────────────
const KPI_DIMENSIONS = [
  { key:"global",    label:"Global",                color:"#004f91" },
  { key:"secteurs",  label:"Secteurs d'activités",  color:"#004f91" },
  { key:"branches",  label:"Branches d'activités",  color:"#004f91" },
  { key:"activites", label:"Activités",             color:"#004f91" },
  { key:"pays",      label:"Pays",                  color:"#004f91" },
];
const KPI_INDICATEURS = [
  { key:"ciblees",    label:"Entreprises ciblées" },
  { key:"contactees", label:"Entreprises contactées" },
  { key:"installees", label:"Entreprises installées" },
  { key:"duree",      label:"Durée de transformation" },
  { key:"taux",       label:"Taux de transformation" },
];
function indicMeta(id:string) {
  const [dimKey, indKey] = id.split("__");
  const dim = KPI_DIMENSIONS.find(d=>d.key===dimKey);
  const ind = KPI_INDICATEURS.find(i=>i.key===indKey);
  if(!dim||!ind) return null;
  return { dim, ind };
}

// ─── Carte du Sénégal + heatmap de concentration des entreprises ─────────────
// topojson "Thies" → ref_regions "Thiès"
const SEN_NAME_MAP: Record<string,string> = {
  "Dakar":"Dakar","Thies":"Thiès","Diourbel":"Diourbel","Louga":"Louga",
  "Saint-Louis":"Saint-Louis","Matam":"Matam","Tambacounda":"Tambacounda",
  "Kedougou":"Kédougou","Fatick":"Fatick","Kaolack":"Kaolack","Kaffrine":"Kaffrine",
  "Kolda":"Kolda","Sedhiou":"Sédhiou","Ziguinchor":"Ziguinchor",
};

// Données fictives de densité par région (le temps de remplir la bdd) —
// densite = entreprises / km² (affichée ×100). Réparties pour bien voir la heatmap.
const REGION_DENSITE_FICTIF = [
  { label:"Dakar",       valeur:300, densite:0.050 },
  { label:"Thiès",       valeur:228, densite:0.038 },
  { label:"Diourbel",    valeur:192, densite:0.032 },
  { label:"Kaolack",     valeur:162, densite:0.027 },
  { label:"Ziguinchor",  valeur:138, densite:0.023 },
  { label:"Fatick",      valeur:114, densite:0.019 },
  { label:"Saint-Louis", valeur:96,  densite:0.016 },
  { label:"Kolda",       valeur:78,  densite:0.013 },
  { label:"Sédhiou",     valeur:66,  densite:0.011 },
  { label:"Kaffrine",    valeur:54,  densite:0.009 },
  { label:"Louga",       valeur:42,  densite:0.007 },
  { label:"Matam",       valeur:30,  densite:0.005 },
  { label:"Tambacounda", valeur:24,  densite:0.004 },
  { label:"Kédougou",    valeur:18,  densite:0.003 },
];

// Rampe thermique (densité faible → forte) — chaude, cohérente avec l'app
const HEAT_STOPS = ["#EDF4FB", "#C5DCF2", "#90BDE5", "#5596D4", "#2872B8", "#004f91", "#003468"];
const heatRamp = (t:number) => d3.interpolateRgbBasis(HEAT_STOPS)(Math.max(0, Math.min(1, t)));

function CarteSenegal({ height=200, legend=true, legendVertical=false }: { height?:number; legend?:boolean; legendVertical?:boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[:]/g,"");
  const [tip, setTip] = useState<{nom:string; valeur:number; densite:number; x:number; y:number}|null>(null);
  const [bornes, setBornes] = useState<{min:number; max:number}|null>(null);

  useEffect(()=>{
    const container = ref.current; if(!container) return;
    let cancelled=false;
    const loadTopojson = () => new Promise<any>((res,rej)=>{
      const w:any = window;
      const poll=()=>{ if(w.topojson) res(w.topojson); else setTimeout(poll,50); };
      if(w.topojson){ res(w.topojson); return; }
      if(document.querySelector('script[data-lib="topojson"]')){ poll(); return; }
      const s=document.createElement("script"); s.setAttribute("data-lib","topojson");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onerror=rej; s.onload=poll; document.head.appendChild(s);
    });
    Promise.all([
      loadTopojson().then(()=>fetch("https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/sen.topo.json")).then(r=>r.json()),
      Promise.resolve(REGION_DENSITE_FICTIF),
    ])
      .then(([topo, regionData]:any)=>{
        if(cancelled||!ref.current) return;
        const topojson:any = (window as any).topojson;
        const W = container.clientWidth || 480;
        const H = height;
        // Densité + valeur par région (nom ref → {valeur, densite})
        const info: Record<string,{valeur:number; densite:number}> = {};
        (Array.isArray(regionData)?regionData:[]).forEach((d:any)=>{ info[d.label]={ valeur:Number(d.valeur)||0, densite:Number(d.densite)||0 }; });
        const densVals = Object.values(info).map(d=>d.densite).filter(d=>d>0);
        const maxDens = Math.max(1e-9, ...densVals);
        const minDens = densVals.length ? Math.min(...densVals) : 0;
        setBornes({ min:minDens, max:maxDens });

        container.innerHTML="";
        const svg = d3.select(container).append("svg")
          .attr("width","100%").attr("viewBox",`0 0 ${W} ${H}`).style("display","block");
        const geojson = topojson.feature(topo, topo.objects.sen);
        const projection = d3.geoMercator().fitExtent([[8,8],[W-8,H-8]], geojson);
        const pathGen = d3.geoPath().projection(projection);

        // Fond : régions + frontières
        svg.selectAll("path.reg").data(geojson.features).join("path")
          .attr("d", (d:any)=>pathGen(d)).attr("fill","#C4C4C4")
          .attr("stroke","#666666").attr("stroke-width",0.6).attr("stroke-linejoin","round");

        // Flou partagé
        const defs = svg.append("defs");
        const minHW = Math.min(W,H);
        defs.append("filter").attr("id",`heat-blur-${uid}`)
          .attr("x","-40%").attr("y","-40%").attr("width","180%").attr("height","180%")
          .append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation", Math.max(4, minHW*0.035));

        // Heatmap : un blob par région, clippé à sa région. Couleur = densité.
        geojson.features.forEach((f:any,i:number)=>{
          const nom = SEN_NAME_MAP[f.properties?.name||""] || f.properties?.name || "";
          const v = info[nom]?.densite || 0;
          if (v<=0) return;
          defs.append("clipPath").attr("id",`heat-clip-${uid}-${i}`).append("path").attr("d", pathGen(f) as string);
          const c = pathGen.centroid(f);
          const [[x0,y0],[x1,y1]] = pathGen.bounds(f);
          const r = Math.max(x1-x0, y1-y0)/2 * 0.98;
          svg.append("g")
            .attr("clip-path",`url(#heat-clip-${uid}-${i})`).attr("filter",`url(#heat-blur-${uid})`).attr("opacity",0.88)
            .append("circle").attr("cx",c[0]).attr("cy",c[1]).attr("r",r).attr("fill", heatRamp(v/maxDens));
        });

        // Contour extérieur
        svg.append("path").datum(topojson.mesh(topo, topo.objects.sen, (a:any,b:any)=>a===b))
          .attr("d", pathGen as any).attr("fill","none").attr("stroke","#666666").attr("stroke-width",1.2).attr("stroke-linejoin","round");

        // Couche d'interaction (tooltip) : paths transparents par région, au-dessus
        svg.selectAll("path.hit").data(geojson.features).join("path").attr("class","hit")
          .attr("d",(d:any)=>pathGen(d)).attr("fill","transparent").style("cursor","pointer")
          .on("mousemove", function(event:any, d:any){
            const nom = SEN_NAME_MAP[d.properties?.name||""] || d.properties?.name || "";
            const rect = container.getBoundingClientRect();
            const r = info[nom] || { valeur:0, densite:0 };
            setTip({ nom, valeur:r.valeur, densite:r.densite, x:event.clientX-rect.left, y:event.clientY-rect.top });
          })
          .on("mouseleave", ()=>setTip(null));
      })
      .catch(console.error);
    return ()=>{ cancelled=true; if(ref.current) ref.current.innerHTML=""; };
  },[height]);

  const fmtDens = (d:number) => (d*100).toLocaleString("fr-FR",{maximumFractionDigits:1});

  return (
    <div style={{ position:"relative" as const }}>
      <div ref={ref} style={{ width:"100%", height }}/>

      {/* Légende d'intensité */}
      {legend && bornes && (legendVertical ? (
        <div style={{ position:"absolute" as const, right:16, top:"50%", transform:"translateY(-50%)", display:"flex", flexDirection:"column" as const, alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, fontWeight:600, color:"#9aa5b4" }}>Forte</span>
          <div style={{ width:16, height:240, borderRadius:999, background:`linear-gradient(to top, ${HEAT_STOPS.join(",")})` }}/>
          <span style={{ fontSize:12, fontWeight:600, color:"#9aa5b4" }}>Faible</span>
        </div>
      ) : (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:10 }}>
          <span style={{ fontSize:10, fontWeight:600, color:"#9aa5b4" }}>Faible</span>
          <div style={{ width:200, height:8, borderRadius:999, background:`linear-gradient(90deg, ${HEAT_STOPS.join(",")})` }}/>
          <span style={{ fontSize:10, fontWeight:600, color:"#9aa5b4" }}>Forte</span>
        </div>
      ))}

      {/* Tooltip */}
      {tip && (
        <div style={{ position:"absolute" as const, left:Math.min(tip.x+12, (ref.current?.clientWidth||300)-150), top:Math.max(tip.y-10,4), background:"#1a1a2e", color:"#fff", borderRadius:9, padding:"8px 11px", fontSize:12, lineHeight:1.5, pointerEvents:"none" as const, zIndex:20, boxShadow:"0 6px 20px rgba(0,0,0,0.25)", whiteSpace:"nowrap" as const }}>
          <div style={{ fontWeight:700, marginBottom:2 }}>{tip.nom}</div>
          <div style={{ opacity:0.85 }}>{tip.valeur.toLocaleString("fr-FR")} entreprise{tip.valeur>1?"s":""}</div>
          <div style={{ opacity:0.85 }}>Densité : {fmtDens(tip.densite)} / 100 km²</div>
        </div>
      )}
    </div>
  );
}

// Dégradés de marque par type de zone (clair → foncé)
const ZONE_GRAD: Record<string,[string,string]> = {
  ZES: ["#EDF4FB", "#003468"], // bleu
  ZAI: ["#FDF3EC", "#943F0C"], // orange
  ZFI: ["#ECF5F3", "#065549"], // teal
};
// Données fictives temporaires (en attendant le remplissage de la BDD)
const ZONE_ECO_FICTIF = [
  { groupe:"ZES", label:"Dakar",       valeur:47 },
  { groupe:"ZES", label:"Rufisque",    valeur:39 },
  { groupe:"ZES", label:"Mbour",       valeur:33 },
  { groupe:"ZES", label:"Thiès",       valeur:27 },
  { groupe:"ZES", label:"Bambey",      valeur:19 },
  { groupe:"ZES", label:"Podor",       valeur:13 },
  { groupe:"ZAI", label:"Tivaouane",   valeur:45 },
  { groupe:"ZAI", label:"Mbacké",      valeur:38 },
  { groupe:"ZAI", label:"Kaolack",     valeur:31 },
  { groupe:"ZAI", label:"Louga",       valeur:24 },
  { groupe:"ZAI", label:"Fatick",      valeur:18 },
  { groupe:"ZAI", label:"Bignona",     valeur:12 },
  { groupe:"ZFI", label:"Ziguinchor",  valeur:43 },
  { groupe:"ZFI", label:"Kolda",       valeur:36 },
  { groupe:"ZFI", label:"Tambacounda", valeur:28 },
  { groupe:"ZFI", label:"Saint-Louis", valeur:22 },
  { groupe:"ZFI", label:"Matam",       valeur:15 },
  { groupe:"ZFI", label:"Kédougou",    valeur:11 },
];

// ─── Grouped bar chart : entreprises par zone, groupées par type de zone ─────
function GroupedBarZones({ height=200, fill=false }: { height?:number; fill?:boolean }) {
  const cRef=useRef<HTMLDivElement>(null); const ref=useRef<SVGSVGElement>(null);
  const [w,setW]=useState(480); const [h,setH]=useState(height);
  const data = ZONE_ECO_FICTIF;
  const [tip,setTip]=useState<{nom:string; groupe:string; valeur:number; x:number; y:number}|null>(null);

  useEffect(()=>{ const obs=new ResizeObserver(e=>{ setW(e[0].contentRect.width); if(fill && e[0].contentRect.height>0) setH(e[0].contentRect.height); }); if(cRef.current)obs.observe(cRef.current); return()=>obs.disconnect(); },[fill]);

  useEffect(()=>{
    if(!ref.current) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    if(!data.length) return;
    const W=w, H=fill?h:height, M={top:12,right:8,bottom:26,left:30};
    const ORDER=["ZES","ZAI","ZFI"];
    const groups=Array.from(new Set(data.map((d:any)=>d.groupe)))
      .sort((a:any,b:any)=>((ORDER.indexOf(a)+1)||99)-((ORDER.indexOf(b)+1)||99));
    const byGroup=d3.group(data, (d:any)=>d.groupe);
    const fx=d3.scaleBand().domain(groups as string[]).rangeRound([M.left, W-M.right]).paddingInner(0.2);
    const maxVal=d3.max(data,(d:any)=>d.valeur)||1;
    const y=d3.scaleLinear().domain([0,maxVal]).nice().rangeRound([H-M.bottom, M.top]);

    svg.attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet")
       .attr("style","max-width:100%;height:auto;font-family:var(--font-google-sans),sans-serif;");

    // Grille horizontale
    svg.append("g").selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1",M.left).attr("x2",W-M.right).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","#EFEDEA");

    // Barres groupées
    (groups as string[]).forEach(g=>{
      const items=[...(byGroup.get(g)||[])].sort((a:any,b:any)=>b.valeur-a.valeur);
      const [lo,hi]=ZONE_GRAD[g] || [zoneTypeMeta(g).color,"#ffffff"];
      const xIn=d3.scaleBand().domain(items.map((d:any)=>d.label)).rangeRound([0, fx.bandwidth()!]).padding(0.14);
      const gg=svg.append("g").attr("transform",`translate(${fx(g)},0)`);
      gg.selectAll("rect").data(items).join("rect")
        .attr("x",(d:any)=>xIn(d.label)!).attr("width",xIn.bandwidth())
        .attr("y",(d:any)=>y(d.valeur)).attr("height",(d:any)=>y(0)-y(d.valeur))
        .attr("fill",(_:any,i:number)=> d3.interpolateRgb(hi, lo)(items.length>1 ? Math.min(0.82, i/(items.length-1)) : 0) as string)
        .style("cursor","pointer")
        .on("mousemove",function(e:any,d:any){ const rect=cRef.current!.getBoundingClientRect(); setTip({nom:d.label, groupe:g, valeur:d.valeur, x:e.clientX-rect.left, y:e.clientY-rect.top}); })
        .on("mouseleave",()=>setTip(null));
    });

    // Axe X (types)
    svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
      .call(d3.axisBottom(fx).tickSizeOuter(0))
      .call((g:any)=>g.selectAll(".domain").remove())
      .call((g:any)=>g.selectAll("text").style("font-size","11px").style("font-weight","700").style("fill","#4a5568"));
    // Axe Y
    svg.append("g").attr("transform",`translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .call((g:any)=>g.select(".domain").remove())
      .call((g:any)=>g.selectAll("line").remove())
      .call((g:any)=>g.selectAll("text").style("font-size","10px").style("fill","#9aa5b4"));
  },[data,w,h,height,fill]);

  if(!data.length) return <EmptyState h={height}/>;
  return (
    <div ref={cRef} style={{ width:"100%", height: fill?"100%":undefined, position:"relative" as const }}>
      <svg ref={ref} style={{ width:"100%", height: fill?"100%":height, display:"block" }}/>
      {tip && (
        <div style={{ position:"absolute" as const, left:Math.min(tip.x+12, (cRef.current?.clientWidth||300)-160), top:Math.max(tip.y-10,4), background:"#1a1a2e", color:"#fff", borderRadius:9, padding:"8px 11px", fontSize:12, lineHeight:1.5, pointerEvents:"none" as const, zIndex:20, boxShadow:"0 6px 20px rgba(0,0,0,0.25)", whiteSpace:"nowrap" as const }}>
          <div style={{ fontWeight:700, marginBottom:2 }}>{tip.nom}</div>
          <div style={{ opacity:0.85 }}>{tip.groupe} · {tip.valeur.toLocaleString("fr-FR")} entreprise{tip.valeur>1?"s":""}</div>
        </div>
      )}
    </div>
  );
}

// Palettes des visualisations du tableau de bord
const BAR_PALETTE5  = ["#E2862F", "#2E7FB8", "#239B8C", "#74A368", "#E8AD22"]; // secteurs (donut) + top 5 (vignette)
const BAR_PALETTE7  = ["#E2862F", "#2E7FB8", "#239B8C", "#74A368", "#E8AD22", "#5E84BC", "#E25F40"]; // top 7 (modal)
// Dégradé bleu (rang 0 = plus foncé → plus clair) pour les bandes « Pays »
const paysRamp = (n:number,i:number) => d3.interpolateRgb("#003468","#EDF4FB")(n>1 ? Math.min(i,n-1)/(n-1) : 0) as string;

// Codes ISO3 des pays (libellé court pour les vignettes)
const PAYS_ISO3: Record<string,string> = {
  "France":"FRA","Maroc":"MAR","Chine":"CHN","Turquie":"TUR","Inde":"IND",
  "Émirats arabes unis":"ARE","Espagne":"ESP","Liban":"LBN","États-Unis":"USA","Mali":"MLI",
  "Côte d'Ivoire":"CIV","Allemagne":"DEU","Portugal":"PRT","Tunisie":"TUN","Belgique":"BEL",
};
const toIso3 = (label:string) => PAYS_ISO3[label] || label;

// Données fictives par secteur d'activité (le temps de remplir la bdd)
const mkRows = (vals:[string,number][]) => vals.map(([label,valeur])=>({label,valeur}));
const SECTEUR_FICTIF: Record<string, {label:string; valeur:number}[]> = {
  ciblees:    mkRows([["Tertiaire",64],["Secondaire",41],["Primaire",23]]),
  contactees: mkRows([["Tertiaire",45],["Secondaire",29],["Primaire",16]]),
  installees: mkRows([["Tertiaire",30],["Secondaire",19],["Primaire",11]]),
};

// Données fictives par branche d'activité (le temps de remplir la bdd)
const BRANCHE_FICTIF: Record<string, {label:string; valeur:number}[]> = {
  ciblees:    mkRows([["Agro-industrie",52],["Énergie & Mines",44],["BTP & Construction",37],["Tourisme & Hôtellerie",31],["Numérique & Télécoms",26],["Transport & Logistique",21],["Services financiers",16],["Textile & Habillement",11]]),
  contactees: mkRows([["Agro-industrie",37],["Énergie & Mines",31],["BTP & Construction",26],["Tourisme & Hôtellerie",22],["Numérique & Télécoms",18],["Transport & Logistique",14],["Services financiers",11],["Textile & Habillement",8]]),
  installees: mkRows([["Agro-industrie",24],["Énergie & Mines",20],["BTP & Construction",17],["Tourisme & Hôtellerie",14],["Numérique & Télécoms",11],["Transport & Logistique",8],["Services financiers",6],["Textile & Habillement",4]]),
};

// Données fictives par activité (le temps de remplir la bdd)
const ACTIVITE_FICTIF: Record<string, {label:string; valeur:number}[]> = {
  ciblees:    mkRows([["Culture & maraîchage",48],["Transformation alimentaire",41],["Production d'électricité",35],["Extraction minière",29],["Construction de bâtiments",24],["Hébergement & restauration",19],["Développement logiciel",14],["Transport routier",9]]),
  contactees: mkRows([["Culture & maraîchage",34],["Transformation alimentaire",29],["Production d'électricité",24],["Extraction minière",20],["Construction de bâtiments",16],["Hébergement & restauration",12],["Développement logiciel",9],["Transport routier",6]]),
  installees: mkRows([["Culture & maraîchage",22],["Transformation alimentaire",18],["Production d'électricité",15],["Extraction minière",12],["Construction de bâtiments",10],["Hébergement & restauration",7],["Développement logiciel",5],["Transport routier",3]]),
};

// Données fictives par pays d'origine (le temps de remplir la bdd)
const mkPays = (vals:[string,number][]) => vals.map(([label,valeur])=>({label,valeur}));
const PAYS_FICTIF: Record<string, {label:string; valeur:number}[]> = {
  ciblees: mkPays([
    ["France",58],["Maroc",49],["Chine",44],["Turquie",38],["Inde",33],
    ["Émirats arabes unis",29],["Espagne",25],["Liban",21],["États-Unis",18],["Mali",15],
    ["Côte d'Ivoire",13],["Allemagne",11],["Portugal",9],["Tunisie",7],["Belgique",5],
  ]),
  contactees: mkPays([
    ["France",41],["Maroc",35],["Chine",31],["Turquie",27],["Inde",23],
    ["Émirats arabes unis",20],["Espagne",17],["Liban",14],["États-Unis",12],["Mali",10],
    ["Côte d'Ivoire",8],["Allemagne",7],["Portugal",5],["Tunisie",4],["Belgique",3],
  ]),
  installees: mkPays([
    ["France",27],["Maroc",22],["Chine",19],["Turquie",16],["Inde",13],
    ["Émirats arabes unis",11],["Espagne",9],["Liban",7],["États-Unis",6],["Mali",5],
    ["Côte d'Ivoire",4],["Allemagne",3],["Portugal",2],["Tunisie",2],["Belgique",1],
  ]),
};

// ─── Carte visualisation d'un indicateur ─────────────────────────────────────
function IndicViz({ id, onRemove }: { id:string; onRemove:()=>void }) {
  const meta = indicMeta(id);
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur]   = useState(false);
  const [tick, setTick]       = useState(0);

  useEffect(()=>{
    if(!meta) return;
    setLoading(true); setErreur(false);
    fetch(`${API}/dashboard/indicateur?dimension=${meta.dim.key}&indicateur=${meta.ind.key}`)
      .then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>setData(Array.isArray(d)?d:[]))
      .catch(()=>{ setData([]); setErreur(true); }).finally(()=>setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id, tick]);

  if(!meta) return null;
  const { dim, ind } = meta;
  const titre = `${ind.label} — ${dim.label}`;
  // Dimensions à forte cardinalité : top 3 en vignette, top 7 en grand
  const isSecteurs = dim.key==="secteurs";
  const isPays     = dim.key==="pays";
  const isBranches = dim.key==="branches";
  const isActivites = dim.key==="activites";
  const isLong    = dim.key==="branches" || dim.key==="activites" || dim.key==="pays";
  const cardN  = isPays ? 7 : 5;
  const modalN = isPays ? 15 : 7;
  // Données fictives tant que le nombre d'entreprises reste faible
  // (Pays : seuil 15 pour les installées, 5 sinon ; Secteurs : total réel faible)
  const paysSeuil = ind.key==="installees" ? 15 : 5;
  const realSum = data.reduce((s:number,d:any)=> s + (Number(d.valeur)||0), 0);
  const baseData =
    (isPays && data.length<=paysSeuil && PAYS_FICTIF[ind.key]) ? PAYS_FICTIF[ind.key]
    : (isSecteurs && realSum<=10 && SECTEUR_FICTIF[ind.key]) ? SECTEUR_FICTIF[ind.key]
    : (isBranches && realSum<=10 && BRANCHE_FICTIF[ind.key]) ? BRANCHE_FICTIF[ind.key]
    : (isActivites && realSum<=10 && ACTIVITE_FICTIF[ind.key]) ? ACTIVITE_FICTIF[ind.key]
    : data;
  // Tri déterministe (valeur desc, libellé asc) + couleur figée par rang →
  // un même item garde sa couleur entre la vignette et le modal (même en cas d'égalité).
  const sortedAll = [...baseData]
    .sort((a:any,b:any)=> (b.valeur-a.valeur) || String(a.label).localeCompare(String(b.label),"fr"));
  // Pays & Secteurs : dégradé bleu (foncé = plus élevé) réparti sur l'ensemble affiché.
  // Autres : palette catégorielle figée par rang.
  const useRamp = isPays || isSecteurs || isBranches || isActivites;
  const colorize = (rows:any[]) => rows.map((d:any,i:number)=>({
    ...d,
    _c: useRamp ? paysRamp(rows.length, i) : BAR_PALETTE7[i%BAR_PALETTE7.length],
  }));
  const colored   = colorize(sortedAll);
  // Vignettes « Pays » : libellés courts en code ISO3 ; le modal garde les noms complets.
  const cardData  = colorize(isLong ? sortedAll.slice(0,cardN) : sortedAll)
    .map((d:any)=> isPays ? { ...d, label: toIso3(String(d.label)) } : d);
  const modalData = colorize(isLong ? sortedAll.slice(0,modalN) : sortedAll);
  const cardH  = 200; // vignettes : taille uniforme pour tous les indicateurs
  const modalH = isSecteurs ? 380 : isPays ? 440 : 26 + Math.max(1, modalData.length)*44 + 8;

  const body = (h:number) => loading
    ? <Skeleton w="100%" h={h} r={10}/>
    : erreur ? <div style={{pointerEvents:"auto" as const}}><ErreurChargement compact onRetry={()=>setTick(t=>t+1)}/></div>
    : cardData.length===0 ? <EmptyState h={h}/>
    : <div className="charge-in">{isSecteurs ? <DonutLabeled data={cardData} height={h} palette={BAR_PALETTE5} compact/>
    : isPays ? <VBarChart data={cardData} height={h} palette={BAR_PALETTE5}/>
    : <HBarAxisChart data={cardData} height={h} palette={BAR_PALETTE5}/>}</div>;

  return (
    <>
      <div onClick={()=>!loading&&colored.length>0&&setOpen(true)}
        style={{ background:"#fff", borderRadius:14, border:"1px solid #ECEAE7", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", overflow:"hidden", cursor:loading||colored.length===0?"default":"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", minWidth:0 }}
        onMouseEnter={e=>{ if(!loading&&colored.length>0){ e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.25)"; }
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const sp=box.firstElementChild as HTMLElement|null; if(!sp) return; const d=sp.scrollWidth-(box as HTMLElement).clientWidth; if(d>0){ sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; } }); }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#ECEAE7";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const sp=box.firstElementChild as HTMLElement|null; if(!sp) return; sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; }); }}>
        <div style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
              <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                <p style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", margin:0, display:"inline-block" }}>{ind.label}</p>
              </span>
              <span style={{ fontSize:9.5, fontWeight:700, color:"#9aa5b4", background:"#F2F0EF", padding:"2px 8px", borderRadius:999, textTransform:"uppercase" as const, letterSpacing:"0.04em", flexShrink:0 }}>{dim.label}</span>
              {isLong && <span style={{ fontSize:9.5, fontWeight:700, color:"#9aa5b4", background:"#F2F0EF", padding:"2px 8px", borderRadius:999, textTransform:"uppercase" as const, letterSpacing:"0.04em", flexShrink:0 }}>Top {cardN}</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
              <span style={{ width:26, height:26, borderRadius:8, background:"#F5F4F3", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                <Maximize2 size={11} style={{ color:"#9aa5b4" }}/>
              </span>
              <button onClick={e=>{e.stopPropagation();onRemove();}} style={{ background:"transparent", border:"none", cursor:"pointer", borderRadius:6, padding:4, color:"#C5BFBB" }}><X size={13}/></button>
            </div>
          </div>
          <div style={{ pointerEvents:"none" as const }}>{body(cardH)}</div>
        </div>
      </div>

      <VizModal open={open} onClose={()=>setOpen(false)} titre={isLong?`${titre} · Top ${modalN}`:titre} vizId={id}>
        {isSecteurs
          ? <DonutLabeled data={modalData} height={Math.max(340, modalH)} palette={BAR_PALETTE5}/>
          : isPays
          ? <VBarChart data={modalData} height={Math.max(320, modalH)} palette={BAR_PALETTE7} rotateX/>
          : <HBarAxisChart data={modalData} height={Math.max(300, modalH)} palette={BAR_PALETTE7}/>}
      </VizModal>
    </>
  );
}

// ─── Section repliable (style IDE) ────────────────────────────────────────────
function SbSection({ title, count, accent="#004f91", defaultOpen=true, children }:{
  title:string; count?:number; accent?:string; defaultOpen?:boolean; children:React.ReactNode;
}) {
  const [open,setOpen]=useState(defaultOpen);
  const on = (count??0)>0;
  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"none", border:"none", cursor:"pointer", padding:"4px 0", marginBottom:open?8:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {on&&<span style={{ width:6, height:6, borderRadius:"50%", background:accent }}/>}
          <span style={{ fontSize:11, fontWeight:700, color:on?accent:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>{title}</span>
          {on&&<span style={{ fontSize:10, fontWeight:700, color:accent, background:`${accent}26`, padding:"1px 6px", borderRadius:999 }}>{count}</span>}
        </div>
        <span style={{ width:20, height:20, borderRadius:"50%", background:"#F5F4F3", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {open?<ChevronUp size={11} style={{ color:"#4a5568" }}/>:<ChevronDown size={11} style={{ color:"#4a5568" }}/>}
        </span>
      </button>
      {open&&children}
    </div>
  );
}

const SbCheck = ({ active }:{ active:boolean }) => (
  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${active?"#004f91":"#C5BFBB"}`, background:active?"#004f91":"transparent", flexShrink:0 }}/>
);

function SbEmpty() {
  return <p style={{ fontSize:12, color:"#C5BFBB", textAlign:"center" as const, padding:"10px 0" }}>Aucun résultat</p>;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ config, onToggleTable, onToggleKPI, onReset,
  sidebarOpen, setSidebarOpen, sidebarWidth, setSidebarWidth, onglet }: {
  config: DashConfig;
  onToggleTable:(tableId:string)=>void;
  onToggleKPI:(id:string)=>void;
  onReset:(scope:"viz"|"tables")=>void;
  sidebarOpen: boolean; setSidebarOpen:(v:boolean)=>void;
  sidebarWidth: number; setSidebarWidth:(v:number)=>void;
  onglet: "viz"|"tables";
}) {

  const isResizing = useRef(false);
  const [search, setSearch] = useState("");
  const [openDims, setOpenDims] = useState<Set<string>>(new Set(["global"]));
  const toggleDim = (k:string) => setOpenDims(prev=>{ const n=new Set(prev); n.has(k)?n.delete(k):n.add(k); return n; });
  const q = search.trim().toLowerCase();

  const tablesFiltered = TABLES_ANALYTIQUES.filter(t=>!q||t.titre.toLowerCase().includes(q)||t.description.toLowerCase().includes(q));

  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 520);

  const hasAdded = onglet==="tables" ? config.tableCards.length>0 : (config.kpisActifs.length>0||config.cards.length>0);
  const nbActifs = onglet==="tables" ? config.tableCards.length : config.kpisActifs.length+config.cards.length;

  return (
    <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 64px)", position:"sticky" as const, top:64, display:"flex", flexDirection:"column" as const }}>
      <style>{`::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#E8E5E3;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}.sb-item:hover{background:#F8F7F6!important}`}</style>

      {/* Poignée de redimensionnement */}
      {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}

      {/* En-tête */}
      <div style={{ padding:sidebarOpen?"14px 16px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
        {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
            <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
            {sidebarOpen&&nbActifs>0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbActifs}</span>}
          </button>
          {sidebarOpen&&hasAdded&&<button onClick={()=>onReset(onglet)} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
            <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
          </button>}
        </div>
      </div>

      {sidebarOpen&&<>

        {/* Sections */}
        <div style={{ padding:"8px 16px 16px", overflowY:"auto" as const, flex:1 }}>
          {onglet==="viz"&&
            <div>
              {(()=>{
                const dims = KPI_DIMENSIONS.filter(d=>d.key!=="global").map(dim=>{
                  const indics = KPI_INDICATEURS.filter(ind=>!q
                    || ind.label.toLowerCase().includes(q)
                    || dim.label.toLowerCase().includes(q));
                  return { dim, indics };
                }).filter(d=>d.indics.length>0);
                if (dims.length===0) return <SbEmpty/>;
                return dims.map(({dim, indics})=>{
                  const open = openDims.has(dim.key) || !!q;
                  return (
                    <div key={dim.key} style={{ marginBottom:1 }}>
                      {/* Dimension (repliable) — style continents */}
                      <button onClick={()=>toggleDim(dim.key)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 8px", marginBottom:3 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{dim.label}</span>
                        <ChevronDown size={11} style={{ color:"#004f91", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s", flexShrink:0 }}/>
                      </button>
                      {/* Indicateurs (feuilles) */}
                      {open && (
                        <div style={{ marginLeft:16, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1 }}>
                          {indics.map(ind=>{
                            const id = `${dim.key}__${ind.key}`;
                            const active = config.kpisActifs.includes(id);
                            return (
                              <div key={id} className="sb-item" onClick={()=>onToggleKPI(id)}
                                style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 8px", borderRadius:8, cursor:"pointer" }}>
                                <SbCheck active={active}/>
                                <span style={{ fontSize:12, color:"#4a5568", fontWeight:active?700:400 }}>{ind.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>}

          {onglet==="tables"&&
            <div>
              {tablesFiltered.length===0 ? <SbEmpty/> : tablesFiltered.map(t=>{
                const active = config.tableCards.some(c=>c.tableId===t.id);
                return (
                  <div key={t.id} className="sb-item" onClick={()=>onToggleTable(t.id)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 8px", borderRadius:8, cursor:"pointer" }}>
                    <SbCheck active={active}/>
                    <span style={{ fontSize:12, color:"#4a5568", fontWeight:active?700:400, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{t.titre}</span>
                  </div>
                );
              })}
            </div>}
        </div>

      </>}
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TableauDeBordPage() {
  // Toujours démarrer avec DEFAULT_CONFIG (identique SSR et client)
  // puis charger localStorage après le premier rendu côté client
  const [config, setConfig] = useState<DashConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const [kpis, setKpis] = useState<Record<string,any>>({});

  // Chargement principal des stats : en cas d'échec, état d'erreur avec relance (tick)
  const [erreurKpis, setErreurKpis] = useState(false);
  const [tickKpis, setTickKpis] = useState(0);

  useEffect(() => { setConfig(loadConfig()); setHydrated(true); }, []);
  useEffect(() => {
    setErreurKpis(false);
    fetch(`${API}/dashboard/stats`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(setKpis).catch(()=>setErreurKpis(true));
  }, [tickKpis]);
  useEffect(() => { if(hydrated) saveConfig(config); }, [config, hydrated]);

  const toggleCard=useCallback((viz:Visualisation)=>{
    setConfig(prev=>{
      const existing=prev.cards.find(c=>c.vizId===viz.id);
      if(existing) return {...prev,cards:prev.cards.filter(c=>c.id!==existing.id)};
      const c:CardConfig={id:`${viz.id}_${Date.now()}`,vizId:viz.id,params:{},chartType:"auto",size:viz.defaultSize,col:0};
      return {...prev,cards:[...prev.cards,c]};
    });
  },[]);

  const toggleTable=useCallback((tableId:string)=>{
    setConfig(prev=>{
      const existing=prev.tableCards.find(c=>c.tableId===tableId);
      if(existing) return {...prev,tableCards:prev.tableCards.filter(c=>c.id!==existing.id)};
      const c:TableCardConfig={id:`table_${tableId}_${Date.now()}`,tableId,size:"md"};
      return {...prev,tableCards:[...prev.tableCards,c]};
    });
  },[]);

  const removeCard=useCallback((id:string)=>setConfig(p=>({...p,cards:p.cards.filter(c=>c.id!==id)})),[]);
  const removeTable=useCallback((id:string)=>setConfig(p=>({...p,tableCards:p.tableCards.filter(c=>c.id!==id)})),[]);
  const updateCard=useCallback((id:string,patch:Partial<CardConfig>)=>setConfig(p=>({...p,cards:p.cards.map(c=>c.id===id?{...c,...patch}:c)})),[]);
  const updateTable=useCallback((id:string,patch:Partial<TableCardConfig>)=>setConfig(p=>({...p,tableCards:p.tableCards.map(c=>c.id===id?{...c,...patch}:c)})),[]);
  const toggleKPI=useCallback((kpiId:string)=>setConfig(p=>({
    ...p,
    kpisActifs: p.kpisActifs.includes(kpiId) ? p.kpisActifs.filter(k=>k!==kpiId) : [...p.kpisActifs, kpiId],
  })),[]);
  const removeKPI=useCallback((kpiId:string)=>setConfig(p=>({...p,kpisActifs:p.kpisActifs.filter(k=>k!==kpiId)})),[]);

  const totalItems=config.cards.length+config.tableCards.length;
  const [onglet, setOnglet] = useState<"viz"|"tables">("viz");
  const [mapOpen, setMapOpen] = useState(false);
  const [zoneEcoOpen, setZoneEcoOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const resetConfig = useCallback((scope:"viz"|"tables") => setConfig(p=> scope==="tables" ? {...p, tableCards:[]} : {...p, kpisActifs:[], cards:[]}), []);

  // d3 + Plot chargés dans un chunk séparé : garde avant tout rendu graphique
  const d3Pret = useD3Pret(true);
  if (!d3Pret) return <div style={{minHeight:"100vh",background:"#F6F5F3"}}><Navbar/></div>;

  return (
    <div style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div id="d3-tooltip" style={{position:"fixed",pointerEvents:"none",background:"rgba(26,26,46,0.92)",color:"#fff",borderRadius:8,padding:"8px 12px",fontSize:12,lineHeight:1.5,opacity:0,zIndex:9999,backdropFilter:"blur(4px)"}}/>
      <Navbar/>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <BarreTitre titre="Tableau de bord">
        <BarreTitreSegment options={[{v:"viz",l:"Visualisation de données"},{v:"tables",l:"Tableaux analytiques"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Contenu ──────────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"flex-start"}}>
        <Sidebar config={config} onToggleTable={toggleTable} onToggleKPI={toggleKPI}
          onReset={resetConfig}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}
          onglet={onglet}/>
        <main style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>


          {/* ── Onglet Visualisation ─────────────────────────────────────────── */}
          {onglet==="viz" && (<>
            {/* Indicateurs Global fixes */}
            {erreurKpis ? (
              <div style={{background:"#fff",borderRadius:14,border:"1px solid #ECEAE7",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",marginBottom:28}}>
                <ErreurChargement compact onRetry={()=>setTickKpis(t=>t+1)}/>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:28}}>
                {GLOBAL_KPIS.map(def=><KPICard key={def.key} def={def} value={kpis[def.statKey]}/>)}
              </div>
            )}

            {/* Visualisation permanente : Répartition des entreprises */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:18,marginBottom:28,alignItems:"stretch"}}>
              <div onClick={()=>setMapOpen(true)}
                style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",padding:"16px 18px",cursor:"pointer",transition:"all 0.18s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)";}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap" as const}}>
                  <p style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",margin:0}}>Répartition des entreprises</p>
                  <span style={{fontSize:9.5,fontWeight:700,color:"#9aa5b4",background:"#F2F0EF",padding:"2px 8px",borderRadius:999,textTransform:"uppercase" as const,letterSpacing:"0.04em"}}>ent./100 km²</span>
                </div>
                <CarteSenegal height={200}/>
              </div>

              {/* Répartition par zones économiques (grouped bar) */}
              <div onClick={()=>setZoneEcoOpen(true)}
                style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",padding:"16px 18px",cursor:"pointer",transition:"all 0.18s",display:"flex",flexDirection:"column" as const}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)";}}>
                <p style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",margin:"0 0 12px"}}>Répartition des entreprises par zone économique</p>
                <div style={{flex:1,minHeight:200}}><GroupedBarZones height={200} fill/></div>
              </div>
            </div>
            <VizModal open={mapOpen} onClose={()=>setMapOpen(false)} titre="Répartition des entreprises" vizId="repartition-entreprises">
              <CarteSenegal height={480} legendVertical/>
            </VizModal>
            <VizModal open={zoneEcoOpen} onClose={()=>setZoneEcoOpen(false)} titre="Répartition des entreprises par zone économique" vizId="entreprises-par-zone-eco">
              <GroupedBarZones height={460}/>
            </VizModal>

            {/* Visualisations sélectionnées dans le filtre */}
            {config.kpisActifs.length===0 ? (
              <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"64px 40px",background:"#fff",borderRadius:20,border:"2px dashed #E8E5E3",textAlign:"center" as const}}>
                <BarChart2 size={44} style={{color:"#E8E5E3",marginBottom:14}}/>
                <p style={{fontSize:15,fontWeight:700,color:"#4a5568",marginBottom:6}}>Aucune visualisation sélectionnée</p>
                <p style={{fontSize:13,color:"#9aa5b4",maxWidth:380}}>Choisissez un indicateur par dimension dans le filtre (Global, Secteurs, Branches, Activités, Pays) pour afficher des visualisations.</p>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:18,alignItems:"start"}}>
                {config.kpisActifs.map(id=><IndicViz key={id} id={id} onRemove={()=>removeKPI(id)}/>)}
              </div>
            )}
          </>)}

          {/* ── Onglet Tableaux analytiques ─────────────────────────────────── */}
          {onglet==="tables" && (
            config.tableCards.length===0?(
              <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"80px 40px",background:"#fff",borderRadius:20,border:"2px dashed #E8E5E3",textAlign:"center" as const,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
                <Table2 size={48} style={{color:"#E8E5E3",marginBottom:16}}/>
                <p style={{fontSize:16,fontWeight:700,color:"#4a5568",marginBottom:8}}>Aucun tableau</p>
                <p style={{fontSize:13,color:"#9aa5b4",maxWidth:360}}>Utilisez la barre latérale pour ajouter des tableaux analytiques.</p>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:18}}>
                {config.tableCards.map(card=>(
                  <TableCard key={card.id} card={card} onRemove={()=>removeTable(card.id)}/>
                ))}
              </div>
            )
          )}

        </main>
      </div>
    </div>
  );
}
