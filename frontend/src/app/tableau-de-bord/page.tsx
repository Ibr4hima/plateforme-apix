"use client";

import Navbar from "@/components/layout/Navbar";
import * as d3 from "d3";
import * as Plot from "@observablehq/plot";
import {
  Activity, BarChart2, Building2, Calendar,
  DollarSign, Handshake, Layers, Loader2, MapPin,
  Search, SlidersHorizontal, Table2, Target, TrendingUp, X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATALOGUE, KPIS_DISPONIBLES, CATEGORIES, TABLES_ANALYTIQUES, type Visualisation } from "./catalogue";
import { AnalyticTable } from "@/components/dashboard/DataTable";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const COLORS = ["#ca631f","#004f91","#059669","#7c3aed","#0891b2","#d97706","#E35336","#188038","#dc2626","#65a30d","#f59e0b","#6366f1","#14b8a6","#f43f5e","#84cc16"];

const ICON_MAP: Record<string, any> = {
  Building2, MapPin, Handshake, Calendar, TrendingUp, Layers, Target, DollarSign, Activity
};

// ─── Persistance ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "apix_dashboard_v2";
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
function BarH({ data, height }: { data:any[]; height:number }) {
  const ref=useRef<SVGSVGElement>(null); const cRef=useRef<HTMLDivElement>(null); const [w,setW]=useState(400);
  useEffect(()=>{ const obs=new ResizeObserver(e=>setW(e[0].contentRect.width)); if(cRef.current)obs.observe(cRef.current); return()=>obs.disconnect(); },[]);
  useEffect(()=>{
    if(!ref.current||!data.length) return;
    const svg=d3.select(ref.current); svg.selectAll("*").remove();
    const m={top:4,right:44,bottom:4,left:130}; const W=w-m.left-m.right,H=height-m.top-m.bottom;
    const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const x=d3.scaleLinear().domain([0,d3.max(data,d=>d.valeur)||1]).range([0,W]);
    const y=d3.scaleBand().domain(data.map(d=>String(d.label))).range([0,H]).padding(0.28);
    g.selectAll("rect").data(data).join("rect").attr("x",0).attr("y",d=>y(String(d.label))??0)
      .attr("height",y.bandwidth()).attr("fill",(_,i)=>COLORS[i%COLORS.length]).attr("opacity",0.85).attr("width",0)
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

function BarV({ data, height, color="#004f91" }: { data:any[]; height:number; color?:string }) {
  const ref=useRef<SVGSVGElement>(null); const cRef=useRef<HTMLDivElement>(null); const [w,setW]=useState(400);
  useEffect(()=>{ const obs=new ResizeObserver(e=>setW(e[0].contentRect.width)); if(cRef.current)obs.observe(cRef.current); return()=>obs.disconnect(); },[]);
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

function DonutChart({ data, size }: { data:any[]; size:number }) {
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
      .attr("fill",(_,i)=>COLORS[i%COLORS.length]).attr("opacity",.85).attr("d",arc as any)
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
              <div style={{width:8,height:8,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>
              <span style={{fontSize:11,color:"#4a5568"}}>{String(it.label)}</span>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:"#1a1a2e"}}>{Number(it.valeur).toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
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
      .text(d => compact
        ? d.label.slice(0, 3).toUpperCase()
        : d.label);

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

// ─── Proportion Plot (Entreprises par secteur) ────────────────────────────────
const PROPORTION_COLORS = ["#598db8", "#dc9a6d", "#69ac7d"];

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
          text: (d: any) => `${d.value}%`,
          textAnchor: "end", dx: -7, fill: "#4a5568", fontSize: 11,
        })),
        Plot.text(rows, stack({
          filter: (d: any) => d.col === "Entreprises en zone",
          text: (d: any) => `${d.value}%`,
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
        range: secteurs.map((_, i) => PROPORTION_COLORS[i % PROPORTION_COLORS.length]),
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
  if (vizId === "entreprises-par-region")  return <RegionBarPlot  data={data} height={height} compact={compact} />;
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
function downloadPNG(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const W = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
  const H = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 400;
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url = URL.createObjectURL(blob);
  const img = new Image(); img.width=W*2; img.height=H*2;
  img.onload = () => {
    const canvas = document.createElement("canvas"); canvas.width=W*2; canvas.height=H*2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,W*2,H*2);
    ctx.drawImage(img,0,0,W*2,H*2);
    const a = document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=`${filename}.png`; a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Modal visualisation ──────────────────────────────────────────────────────
function VizModal({ open, onClose, titre, vizId, children }: { open:boolean; onClose:()=>void; titre:string; vizId:string; children:React.ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement|null;
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:1100,maxHeight:"90vh",overflowY:"auto",border:"1px solid #E8E5E3",boxShadow:"0 40px 100px rgba(0,0,0,0.25)"}}>
        <div style={{height:3,background:"linear-gradient(90deg,#ca631f,#004f91)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"22px 28px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{fontWeight:800,fontSize:"1.05rem",color:"#1a1a2e",margin:0}}>{titre}</h3>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>{const svg=getSvg();if(svg)downloadPNG(svg,vizId);}}
                style={{fontSize:12,fontWeight:600,padding:"7px 14px",borderRadius:8,border:"1px solid #E8E5E3",background:"#fff",color:"#4a5568",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Télécharger
              </button>
              <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:8}}><X size={15} color="#4a5568"/></button>
            </div>
          </div>
          <div ref={modalRef}>{children}</div>
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
        style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",padding:"16px 18px",cursor:loading||data.length===0?"default":"pointer",transition:"all 0.18s",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}
        onMouseEnter={e=>{if(!loading&&data.length>0){e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="#d4d0cd";}}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor="#E8E5E3";}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontWeight:700,fontSize:12,color:"#1a1a2e",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viz.titre}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
            <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"transparent",border:"none",cursor:"pointer",borderRadius:6,padding:4,color:"#C5BFBB"}}><X size={11}/></button>
          </div>
        </div>
        <div style={{pointerEvents:"none"}}>
          {loading?(
            <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#9aa5b4"}}>
              <Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:12}}>Chargement…</span>
            </div>
          ):data.length===0?(
            <EmptyState h={160}/>
          ):(
            <VizChart vizId={viz.id} data={data} height={160} compact/>
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
    <div style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",
      boxShadow:"0 1px 6px rgba(0,0,0,0.05)",overflow:"hidden",
      gridColumn:"span 2"}}>
      {/* Badge type + bouton fermer */}
      <div style={{padding:"10px 16px 0",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginRight:"auto"}}>
          <div style={{width:20,height:20,borderRadius:5,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Table2 size={10} color="#004f91"/>
          </div>
          <span style={{fontSize:10,fontWeight:700,color:"#004f91",textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Tableau analytique</span>
        </div>
        <button onClick={onRemove}
          style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:6,padding:5,color:"#9aa5b4"}}>
          <X size={13}/>
        </button>
      </div>
      <AnalyticTable tableId={card.tableId} titre={def.titre} description={def.description} embedded/>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ kpiId, value }: { kpiId:string; value:any }) {
  const def=KPIS_DISPONIBLES.find(k=>k.id===kpiId);
  if(!def) return null;
  const displayValue=kpiId==="intentions_usd"?`${(Number(value)/1_000_000||0).toFixed(1)} M$`:Number(value||0).toLocaleString("fr-FR");
  return (
    <div
      style={{background:"#fff",borderRadius:12,padding:"13px 14px",border:"1px solid #E8E5E3",borderLeft:`3px solid ${def.color}`,cursor:"default",transition:"all 0.15s"}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)";}}>
      <p style={{fontSize:9,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.07em",marginBottom:6,lineHeight:1.4}}>{def.label}</p>
      <p style={{fontSize:"1.1rem",fontWeight:800,color:def.color,lineHeight:1}}>{displayValue}</p>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ config, onToggleCard, onToggleTable, onToggleKPI, onReset,
  sidebarOpen, setSidebarOpen, sidebarWidth, setSidebarWidth, onglet }: {
  config: DashConfig; onToggleCard:(viz:Visualisation)=>void;
  onToggleTable:(tableId:string)=>void; onToggleKPI:(id:string)=>void;
  onReset:()=>void;
  sidebarOpen: boolean; setSidebarOpen:(v:boolean)=>void;
  sidebarWidth: number; setSidebarWidth:(v:number)=>void;
  onglet: "viz"|"tables";
}) {
  const [search,setSearch]             = useState("");
  const isResizing                     = useRef(false);

  const filtered       = CATALOGUE.filter(v=>!search||v.titre.toLowerCase().includes(search.toLowerCase()));
  const filteredTables = TABLES_ANALYTIQUES.filter(t=>!search||t.titre.toLowerCase().includes(search.toLowerCase()));

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp   = () => { isResizing.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const hasAdded = config.kpisActifs.length>0||config.cards.length>0||config.tableCards.length>0;
  const nbActifs = (config.kpisActifs.length>0?1:0)+(config.cards.length>0?1:0)+(config.tableCards.length>0?1:0);

  return (
    <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 122px)", overflowY:"auto" as const, position:"sticky" as const, top:122, display:"flex", flexDirection:"column" as const }}>
      <style>{`::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#E8E5E3;border-radius:4px}.sb-item:hover{background:#F8F7F6!important}`}</style>

      {/* Poignée de redimensionnement */}
      {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(202,99,31,0.3)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}

      {/* En-tête */}
      <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
        {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Personnaliser</span>}
        <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
          <SlidersHorizontal size={14} style={{ color:"#ca631f" }}/>
          {sidebarOpen&&nbActifs>0&&<span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbActifs}</span>}
        </button>
      </div>

      {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>

        {/* Recherche */}
        <div style={{ position:"relative" as const, marginBottom:18 }}>
          <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une visualisation…"
            style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
          {search&&<button onClick={()=>setSearch("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
        </div>
        <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

        {/* KPIs — onglet viz uniquement */}
        {onglet==="viz"&&<>
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Key Performance Indicators</span>
            {config.kpisActifs.length>0&&<span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.18)", padding:"1px 6px", borderRadius:999 }}>{config.kpisActifs.length}/5</span>}
          </div>
          <div>
            {KPIS_DISPONIBLES.map(kpi=>{
              const active=config.kpisActifs.includes(kpi.id);
              const disabled=!active&&config.kpisActifs.length>=5;
              return (
                <label key={kpi.id} className="sb-item" style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1 }}>
                  <div style={{ width:13, height:13, borderRadius:3, border:`2px solid ${active?kpi.color:"#C5BFBB"}`, background:active?kpi.color:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {active&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" checked={active} disabled={disabled} onChange={()=>onToggleKPI(kpi.id)} style={{ display:"none" }}/>
                  <span style={{ fontSize:12, color:active?kpi.color:"#4a5568", fontWeight:active?500:400, flex:1 }}>{kpi.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

        {/* Visualisations */}
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            {config.cards.length>0&&<span style={{ width:6, height:6, borderRadius:"50%", background:"#ca631f", display:"inline-block" }}/>}
            <span style={{ fontSize:11, fontWeight:700, color:config.cards.length>0?"#ca631f":"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Visualisation de données</span>
            {config.cards.length>0&&<span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.18)", padding:"1px 6px", borderRadius:999 }}>{config.cards.length}</span>}
          </div>
          <div>
            {filtered.map(viz=>{
              const active = config.cards.some(c=>c.vizId===viz.id);
              return (
                <label key={viz.id} className="sb-item" style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, cursor:"pointer" }}>
                  <div onClick={()=>onToggleCard(viz)} style={{ width:13, height:13, borderRadius:3, border:`2px solid ${active?"#004f91":"#C5BFBB"}`, background:active?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                    {active&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div onClick={()=>onToggleCard(viz)} style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:12, color:active?"#004f91":"#1a1a2e", fontWeight:active?500:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{viz.titre}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
        <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
        </>}

        {/* Tableaux analytiques — onglet tables uniquement */}
        {onglet==="tables"&&
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            {config.tableCards.length>0&&<span style={{ width:6, height:6, borderRadius:"50%", background:"#ca631f", display:"inline-block" }}/>}
            <span style={{ fontSize:11, fontWeight:700, color:config.tableCards.length>0?"#ca631f":"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Tableaux analytiques</span>
            {config.tableCards.length>0&&<span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.18)", padding:"1px 6px", borderRadius:999 }}>{config.tableCards.length}</span>}
          </div>
          <div>
            {filteredTables.map(t=>{
              const active = config.tableCards.some(c=>c.tableId===t.id);
              return (
                <label key={t.id} className="sb-item" style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, cursor:"pointer" }}>
                  <div onClick={()=>onToggleTable(t.id)} style={{ width:13, height:13, borderRadius:3, border:`2px solid ${active?"#004f91":"#C5BFBB"}`, background:active?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                    {active&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div onClick={()=>onToggleTable(t.id)} style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:12, color:active?"#004f91":"#1a1a2e", fontWeight:active?500:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{t.titre}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>}

      </div>}
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

  useEffect(() => { setConfig(loadConfig()); setHydrated(true); }, []);
  useEffect(() => { fetch(`${API}/dashboard/stats`).then(r=>r.json()).then(setKpis).catch(()=>{}); }, []);
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
  const toggleKPI=useCallback((kpiId:string)=>setConfig(p=>{
    const actifs=p.kpisActifs.includes(kpiId)?p.kpisActifs.filter(k=>k!==kpiId):p.kpisActifs.length<5?[...p.kpisActifs,kpiId]:p.kpisActifs;
    return {...p,kpisActifs:actifs};
  }),[]);

  const totalItems=config.cards.length+config.tableCards.length;
  const [onglet, setOnglet] = useState<"viz"|"tables">("viz");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  return (
    <div style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"100px 40px 32px"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:16}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase" as const}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{fontWeight:800,fontSize:"clamp(2rem,3.5vw,2.8rem)",color:"#fff",lineHeight:1.1,marginBottom:20}}>Tableau de bord</h1>
          <span style={{display:"inline-flex",alignItems:"center",fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>
            Vue consolidée · {totalItems} élément{totalItems!==1?"s":""} · {config.kpisActifs.length} KPI{config.kpisActifs.length!==1?"s":""}
          </span>
        </div>
      </section>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      <div style={{background:"#fff",borderBottom:"1px solid #E8E5E3",position:"sticky" as const,top:72,zIndex:10,flexShrink:0}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex"}}>
            {([
              {v:"viz",    l:"Visualisation de données"},
              {v:"tables", l:"Tableaux analytiques"},
            ] as const).map(o=>(
              <button key={o.v} onClick={()=>setOnglet(o.v)}
                style={{padding:"16px 22px",border:"none",borderBottom:`2px solid ${onglet===o.v?"#ca631f":"transparent"}`,background:"transparent",fontSize:13,fontWeight:600,color:onglet===o.v?"#ca631f":"#9aa5b4",cursor:"pointer",transition:"all 0.15s",fontFamily:"var(--font-google-sans)"}}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenu ──────────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"flex-start"}}>
        <Sidebar config={config} onToggleCard={toggleCard} onToggleTable={toggleTable} onToggleKPI={toggleKPI}
          onReset={resetConfig}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}
          onglet={onglet}/>
        <main style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>

          {/* KPIs — onglet viz uniquement */}
          {onglet==="viz"&&<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:28}}>
            {config.kpisActifs.map(id=><KPICard key={id} kpiId={id} value={kpis[id]}/>)}
            {Array.from({length:Math.max(0,5-config.kpisActifs.length)}).map((_,i)=>(
              <div key={`empty-${i}`} style={{background:"#fff",borderRadius:12,padding:"13px 14px",border:"1.5px dashed #E8E5E3",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:4,minHeight:72}}>
                <span style={{fontSize:20,color:"#C5BFBB",lineHeight:1}}>+</span>
                <span style={{fontSize:10,color:"#C5BFBB",textAlign:"center" as const,lineHeight:1.5}}>Choisir dans<br/>le filtre</span>
              </div>
            ))}
          </div>}

          {/* ── Onglet Visualisation de données ────────────────────────────── */}
          {onglet==="viz" && (
            config.cards.length===0?(
              <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"80px 40px",background:"#fff",borderRadius:20,border:"2px dashed #E8E5E3",textAlign:"center" as const,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
                <BarChart2 size={48} style={{color:"#E8E5E3",marginBottom:16}}/>
                <p style={{fontSize:16,fontWeight:700,color:"#4a5568",marginBottom:8}}>Aucune visualisation</p>
                <p style={{fontSize:13,color:"#9aa5b4",maxWidth:360}}>Utilisez la barre latérale pour ajouter des graphiques et visualisations.</p>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:18,alignItems:"start"}}>
                {config.cards.map(card=>{
                  const viz=CATALOGUE.find(v=>v.id===card.vizId);
                  if(!viz) return null;
                  return <VizCard key={card.id} card={card} viz={viz} onRemove={()=>removeCard(card.id)}/>;
                })}
              </div>
            )
          )}

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
