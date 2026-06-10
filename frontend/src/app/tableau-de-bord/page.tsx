"use client";

import Navbar from "@/components/layout/Navbar";
import * as d3 from "d3";
import {
  Activity, BarChart2, Building2, Calendar, ChevronDown, ChevronRight,
  DollarSign, Handshake, Layers, Loader2, MapPin,
  RotateCcw, Settings2, Table2, Target, TrendingUp, X
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
  kpisActifs: ["entreprises_total","zones_total","accords_vigueur","evenements_a_venir","prospects_total"],
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
      .attr("height",y.bandwidth()).attr("rx",5).attr("fill",(_,i)=>COLORS[i%COLORS.length]).attr("opacity",0.85).attr("width",0)
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
      .attr("width",x.bandwidth()).attr("height",0).attr("rx",3).attr("fill",color).attr("opacity",0.85)
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

// ─── Card visualisation ───────────────────────────────────────────────────────
function VizCard({ card, viz, onRemove, onChangeType, onChangeSize, onChangeParams }: {
  card:CardConfig; viz:Visualisation; onRemove:()=>void;
  onChangeType:(t:ChartType)=>void; onChangeSize:(s:"sm"|"md"|"lg")=>void; onChangeParams:(p:Record<string,any>)=>void;
}) {
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [showSettings,setShowSettings]=useState(false);
  const chartH=card.size==="sm"?160:card.size==="md"?240:340;
  const fetchData=useCallback(()=>{
    setLoading(true);
    const params=new URLSearchParams();
    Object.entries(card.params||{}).forEach(([k,v])=>{if(v!=null)params.set(k,String(v));});
    const url=`${API}${viz.endpoint}${params.toString()?"?"+params.toString():""}`;
    fetch(url).then(r=>r.json()).then(d=>{setData(Array.isArray(d)?d:[]);}).catch(()=>setData([])).finally(()=>setLoading(false));
  },[viz.endpoint,card.params]);
  useEffect(()=>{fetchData();},[fetchData]);
  const hasParams=(viz.params||[]).length>0;
  const missingRequired=hasParams&&(viz.params||[]).some(p=>!p.dependsOn&&!card.params[p.key]);
  return (
    <div style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",boxShadow:"0 1px 6px rgba(0,0,0,0.05)",overflow:"hidden",gridColumn:card.size==="lg"?"span 2":"span 1",display:"flex",flexDirection:"column" as const}}>
      <div style={{padding:"14px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viz.titre}</p>
          {viz.description&&<p style={{fontSize:11,color:"#9aa5b4"}}>{viz.description}</p>}
        </div>
        <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
          <button onClick={()=>setShowSettings(s=>!s)} style={{background:showSettings?"#F2F0EF":"transparent",border:"none",cursor:"pointer",borderRadius:6,padding:5,color:"#4a5568"}}><Settings2 size={13}/></button>
          <button onClick={fetchData} style={{background:"transparent",border:"none",cursor:"pointer",borderRadius:6,padding:5,color:"#4a5568"}}><RotateCcw size={13}/></button>
          <button onClick={onRemove} style={{background:"transparent",border:"none",cursor:"pointer",borderRadius:6,padding:5,color:"#9aa5b4"}}><X size={13}/></button>
        </div>
      </div>
      {showSettings&&(
        <div style={{margin:"10px 16px",padding:"12px",background:"#F8F7F6",borderRadius:10,border:"1px solid #E8E5E3"}}>
          <p style={{fontSize:11,fontWeight:700,color:"#4a5568",marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Type</p>
          <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {(["auto","bar_h","bar_v","donut"] as ChartType[]).map(t=>(
              <button key={t} onClick={()=>onChangeType(t)}
                style={{padding:"4px 10px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",borderColor:card.chartType===t?"#004f91":"#E8E5E3",background:card.chartType===t?"#004f91":"#fff",color:card.chartType===t?"#fff":"#4a5568"}}>
                {t==="auto"?"Auto":t==="bar_h"?"Barres H":t==="bar_v"?"Barres V":"Donut"}
              </button>
            ))}
          </div>
          <p style={{fontSize:11,fontWeight:700,color:"#4a5568",marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Taille</p>
          <div style={{display:"flex",gap:4,marginBottom:hasParams?12:0}}>
            {(["sm","md","lg"] as const).map(s=>(
              <button key={s} onClick={()=>onChangeSize(s)}
                style={{padding:"4px 14px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",borderColor:card.size===s?"#ca631f":"#E8E5E3",background:card.size===s?"#ca631f":"#fff",color:card.size===s?"#fff":"#4a5568"}}>
                {s==="sm"?"S":s==="md"?"M":"L"}
              </button>
            ))}
          </div>
          {hasParams&&(
            <div style={{marginTop:12}}>
              <p style={{fontSize:11,fontWeight:700,color:"#4a5568",marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Paramètres</p>
              {(viz.params||[]).map(p=>(
                <ParamSelect key={p.key} param={p} value={card.params[p.key]}
                  parentValue={p.dependsOn?card.params[p.dependsOn]:undefined}
                  onChange={v=>onChangeParams({...card.params,[p.key]:v})}/>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{padding:"12px 16px 16px",flex:1}}>
        {loading?(
          <div style={{height:chartH,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#9aa5b4"}}>
            <Loader2 size={18} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:12}}>Chargement…</span>
          </div>
        ):missingRequired?(
          <div style={{height:chartH,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:8}}>
            <Settings2 size={22} style={{color:"#E8E5E3"}}/><span style={{fontSize:12,color:"#9aa5b4"}}>Configurez les paramètres</span>
            <button onClick={()=>setShowSettings(true)} style={{fontSize:11,color:"#004f91",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Ouvrir les paramètres</button>
          </div>
        ):(
          <AutoChart data={data} chartType={card.chartType} height={chartH}/>
        )}
      </div>
    </div>
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
function Sidebar({ config, onAddCard, onAddTable, onToggleKPI }: {
  config:DashConfig; onAddCard:(viz:Visualisation)=>void;
  onAddTable:(tableId:string)=>void; onToggleKPI:(id:string)=>void;
}) {
  const [openSections,setOpenSections]=useState<Record<string,boolean>>({kpis:true,viz:true,tables:true});
  const [openCats,setOpenCats]=useState<Record<string,boolean>>({entreprises:true});
  const [search,setSearch]=useState("");
  const toggle=(k:string)=>setOpenSections(s=>({...s,[k]:!s[k]}));
  const toggleCat=(k:string)=>setOpenCats(s=>({...s,[k]:!s[k]}));
  const filtered=CATALOGUE.filter(v=>!search||v.titre.toLowerCase().includes(search.toLowerCase()));
  const filteredTables=TABLES_ANALYTIQUES.filter(t=>!search||t.titre.toLowerCase().includes(search.toLowerCase()));
  const catColors: Record<string,string>={entreprises:"#ca631f",zones:"#004f91",croisements:"#7c3aed",accords:"#059669",evenements:"#d97706",intentions:"#0891b2",prospects:"#E35336"};

  return (
    <aside style={{width:280,flexShrink:0,background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 122px)",overflowY:"auto",position:"sticky" as const,top:122,display:"flex",flexDirection:"column" as const}}>
      <style>{`::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#E8E5E3;border-radius:4px}.sb-item:hover{background:#F8F7F6!important}`}</style>
      <div style={{padding:"14px 16px 12px",borderBottom:"1px solid #F2F0EF",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Personnaliser</span>
      </div>
      <div style={{padding:"12px 16px 8px",borderBottom:"1px solid #F2F0EF"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
          style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid #E8E5E3",fontSize:12,color:"#1a1a2e",outline:"none",boxSizing:"border-box" as const,background:"#F8F7F6",fontFamily:"var(--font-google-sans)"}}/>
      </div>

      {/* KPIs */}
      <div style={{borderBottom:"1px solid #F2F0EF"}}>
        <button onClick={()=>toggle("kpis")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",background:"none",border:"none",cursor:"pointer"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>KPIs</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,color:"#9aa5b4"}}>{config.kpisActifs.length}/5</span>
            {openSections.kpis?<ChevronDown size={13} color="#9aa5b4"/>:<ChevronRight size={13} color="#9aa5b4"/>}
          </div>
        </button>
        {openSections.kpis&&(
          <div style={{paddingBottom:8}}>
            {KPIS_DISPONIBLES.map(kpi=>{
              const active=config.kpisActifs.includes(kpi.id);
              const disabled=!active&&config.kpisActifs.length>=5;
              return (
                <label key={kpi.id} className="sb-item" style={{display:"flex",alignItems:"center",gap:10,padding:"7px 16px",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1}}>
                  <input type="checkbox" checked={active} disabled={disabled} onChange={()=>onToggleKPI(kpi.id)} style={{accentColor:kpi.color,width:13,height:13}}/>
                  <div style={{width:6,height:6,borderRadius:2,background:kpi.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:"#4a5568",flex:1}}>{kpi.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Visualisations */}
      <div style={{borderBottom:"1px solid #F2F0EF"}}>
        <button onClick={()=>toggle("viz")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",background:"none",border:"none",cursor:"pointer"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Visualisations</span>
          {openSections.viz?<ChevronDown size={13} color="#9aa5b4"/>:<ChevronRight size={13} color="#9aa5b4"/>}
        </button>
        {openSections.viz&&(
          <div style={{paddingBottom:8}}>
            {CATEGORIES.map(cat=>{
              const items=filtered.filter(v=>v.categorie===cat.key);
              if(!items.length) return null;
              return (
                <div key={cat.key}>
                  <button onClick={()=>toggleCat(cat.key)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 16px 6px 14px",background:"none",border:"none",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:6,height:6,borderRadius:2,background:catColors[cat.key]||"#9aa5b4"}}/>
                      <span style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{cat.label}</span>
                    </div>
                    {openCats[cat.key]?<ChevronDown size={11} color="#9aa5b4"/>:<ChevronRight size={11} color="#9aa5b4"/>}
                  </button>
                  {openCats[cat.key]&&items.map(viz=>(
                    <button key={viz.id} className="sb-item" onClick={()=>onAddCard(viz)}
                      style={{width:"100%",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,padding:"7px 16px 7px 24px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,color:"#1a1a2e",fontWeight:500,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viz.titre}</p>
                        {viz.params?.length?<span style={{fontSize:10,color:"#9aa5b4"}}>⚙ Paramétrable</span>:null}
                      </div>
                      <span style={{fontSize:18,color:"#c8d4e0",lineHeight:1,marginTop:1}}>+</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tableaux analytiques */}
      <div style={{flex:1}}>
        <button onClick={()=>toggle("tables")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",background:"none",border:"none",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <Table2 size={12} color="#4a5568"/>
            <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Tableaux</span>
          </div>
          {openSections.tables?<ChevronDown size={13} color="#9aa5b4"/>:<ChevronRight size={13} color="#9aa5b4"/>}
        </button>
        {openSections.tables&&(
          <div style={{paddingBottom:16}}>
            {filteredTables.map(t=>(
              <button key={t.id} className="sb-item" onClick={()=>onAddTable(t.id)}
                style={{width:"100%",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,padding:"8px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,color:"#1a1a2e",fontWeight:500,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.titre}</p>
                  <p style={{fontSize:10,color:"#9aa5b4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</p>
                </div>
                <span style={{fontSize:18,color:"#c8d4e0",lineHeight:1,marginTop:2,flexShrink:0}}>+</span>
              </button>
            ))}
          </div>
        )}
      </div>
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

  const addCard=useCallback((viz:Visualisation)=>{
    const c:CardConfig={id:`${viz.id}_${Date.now()}`,vizId:viz.id,params:{},chartType:"auto",size:viz.defaultSize,col:0};
    setConfig(prev=>({...prev,cards:[...prev.cards,c]}));
  },[]);

  const addTable=useCallback((tableId:string)=>{
    const c:TableCardConfig={id:`table_${tableId}_${Date.now()}`,tableId,size:"md"};
    setConfig(prev=>({...prev,tableCards:[...prev.tableCards,c]}));
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
        <div style={{padding:"0 0 0 280px",display:"flex",alignItems:"center"}}>
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

      {/* ── Contenu ──────────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"flex-start"}}>
        <Sidebar config={config} onAddCard={addCard} onAddTable={addTable} onToggleKPI={toggleKPI}/>
        <main style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>

          {/* KPIs — toujours visibles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:28}}>
            {config.kpisActifs.map(id=><KPICard key={id} kpiId={id} value={kpis[id]}/>)}
            {Array.from({length:Math.max(0,5-config.kpisActifs.length)}).map((_,i)=>(
              <div key={`empty-${i}`} style={{background:"#fff",borderRadius:12,padding:"13px 14px",border:"1.5px dashed #E8E5E3",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:4,minHeight:72}}>
                <span style={{fontSize:20,color:"#C5BFBB",lineHeight:1}}>+</span>
                <span style={{fontSize:10,color:"#C5BFBB",textAlign:"center" as const,lineHeight:1.5}}>Choisir dans<br/>le filtre</span>
              </div>
            ))}
          </div>

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
                  return <VizCard key={card.id} card={card} viz={viz} onRemove={()=>removeCard(card.id)} onChangeType={t=>updateCard(card.id,{chartType:t})} onChangeSize={s=>updateCard(card.id,{size:s})} onChangeParams={p=>updateCard(card.id,{params:p})}/>;
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
