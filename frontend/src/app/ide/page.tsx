"use client";

import Navbar from "@/components/layout/Navbar";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { TrendingUp, TrendingDown, Minus, Info, X, Maximize2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BLEU   = "#004f91";
const ORANGE = "#ca631f";
const VERT   = "#188038";

function fmtVal(v: number|null, unite: string) {
  if (v === null || v === undefined) return "N/A";
  if (unite === "M$") return Math.abs(v)>=1000 ? `${(v/1000).toFixed(1)} Md$` : `${v.toFixed(0)} M$`;
  if (unite === "×")  return `×${v}`;
  if (unite === "%")  return `${v>0?"+":""}${v}%`;
  if (unite === "ans") return `${v} an${v>1?"s":""}`;
  return String(v);
}

// ── Graphe D3 courbe (réutilisable, taille variable) ─────────────────────────
function CourbeLine({ data, couleur, label, height=280 }: { data:{annee:number;valeur:number|null}[]; couleur:string; label:string; height?:number }) {
  const ref   = useRef<SVGSVGElement>(null);
  const valid = data.filter(d => d.valeur !== null) as {annee:number;valeur:number}[];

  useEffect(() => {
    if (!ref.current || valid.length === 0) return;
    const el = ref.current;
    const W  = el.clientWidth || 600;
    const H  = height;
    const M  = { top:12, right:12, bottom:30, left:55 };

    d3.select(el).selectAll("*").remove();
    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");

    const x = d3.scaleLinear().domain(d3.extent(valid,d=>d.annee) as [number,number]).range([M.left,W-M.right]);
    const y = d3.scaleLinear().domain([Math.min(0,d3.min(valid,d=>d.valeur)!), d3.max(valid,d=>d.valeur)!*1.1]).range([H-M.bottom,M.top]);

    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1",M.left).attr("x2",W-M.right).attr("y1",d=>y(d)).attr("y2",d=>y(d))
      .attr("stroke","#F2F0EF").attr("stroke-width",1);

    if (d3.min(valid,d=>d.valeur)! < 0)
      svg.append("line").attr("x1",M.left).attr("x2",W-M.right).attr("y1",y(0)).attr("y2",y(0))
        .attr("stroke","#C5BFBB").attr("stroke-width",1).attr("stroke-dasharray","4,3");

    const defs = svg.append("defs");
    const gradId = `grad-${label.replace(/\s/g,"")}`;
    const grad = defs.append("linearGradient").attr("id",gradId).attr("x1","0").attr("x2","0").attr("y1","0").attr("y2","1");
    grad.append("stop").attr("offset","0%").attr("stop-color",couleur).attr("stop-opacity",0.18);
    grad.append("stop").attr("offset","100%").attr("stop-color",couleur).attr("stop-opacity",0.01);

    svg.append("path").datum(valid).attr("fill",`url(#${gradId})`)
      .attr("d",d3.area<{annee:number;valeur:number}>().x(d=>x(d.annee)).y0(y(0)).y1(d=>y(d.valeur)).curve(d3.curveMonotoneX));

    svg.append("path").datum(valid).attr("fill","none").attr("stroke",couleur).attr("stroke-width",2.5)
      .attr("d",d3.line<{annee:number;valeur:number}>().x(d=>x(d.annee)).y(d=>y(d.valeur)).curve(d3.curveMonotoneX));

    const tooltip = d3.select("#d3-tooltip") as any;
    svg.selectAll("circle").data(valid).enter().append("circle")
      .attr("cx",d=>x(d.annee)).attr("cy",d=>y(d.valeur)).attr("r",3)
      .attr("fill","#fff").attr("stroke",couleur).attr("stroke-width",2).style("cursor","pointer")
      .on("mouseover",(event,d)=>{
        d3.select(event.currentTarget).attr("r",5);
        tooltip.style("opacity",1).style("left",(event.pageX+12)+"px").style("top",(event.pageY-28)+"px")
          .html(`<strong>${d.annee}</strong><br/>${d.valeur.toFixed(0)} M$`);
      })
      .on("mouseout",(event)=>{ d3.select(event.currentTarget).attr("r",3); tooltip.style("opacity",0); });

    svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")))
      .call(g=>g.select(".domain").remove()).call(g=>g.selectAll("line").remove())
      .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));

    svg.append("g").attr("transform",`translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d=>`${(+d/1000).toFixed(0)}Md`))
      .call(g=>g.select(".domain").remove()).call(g=>g.selectAll("line").remove())
      .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
  }, [valid, couleur, height]);

  return <svg ref={ref} style={{ width:"100%", height, display:"block" }} />;
}

function BarresEntrantSortant({ entrants, sortants, height=260 }: any) {
  const ref = useRef<SVGSVGElement>(null);
  const merged = entrants.map((e:any) => ({
    annee:e.annee, entrant:e.valeur??0, sortant:sortants.find((s:any)=>s.annee===e.annee)?.valeur??0
  })).filter((d:any)=>d.annee>=2005);

  useEffect(()=>{
    if (!ref.current || merged.length===0) return;
    const el=ref.current; const W=el.clientWidth||600; const H=height;
    const M={top:12,right:12,bottom:30,left:55};
    d3.select(el).selectAll("*").remove();
    const svg=d3.select(el).attr("viewBox",`0 0 ${W} ${H}`);
    const x0=d3.scaleBand().domain(merged.map((d:any)=>String(d.annee))).range([M.left,W-M.right]).padding(0.25);
    const x1=d3.scaleBand().domain(["e","s"]).range([0,x0.bandwidth()]).padding(0.05);
    const y=d3.scaleLinear().domain([0,d3.max(merged,(d:any)=>Math.max(d.entrant,d.sortant))!*1.1]).range([H-M.bottom,M.top]);
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line").attr("x1",M.left).attr("x2",W-M.right).attr("y1",(d:any)=>y(d)).attr("y2",(d:any)=>y(d)).attr("stroke","#F2F0EF");
    const tooltip=d3.select("#d3-tooltip") as any;
    const grp=svg.selectAll(".g").data(merged).enter().append("g").attr("transform",(d:any)=>`translate(${x0(String(d.annee))},0)`);
    grp.append("rect").attr("x",(d:any)=>x1("e")!).attr("width",x1.bandwidth()).attr("y",(d:any)=>y(d.entrant)).attr("height",(d:any)=>H-M.bottom-y(d.entrant)).attr("fill",BLEU).attr("rx",2).attr("opacity",0.85)
      .on("mouseover",(e:any,d:any)=>{tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px").html(`<strong>${d.annee} — Entrants</strong><br/>${d.entrant.toFixed(0)} M$`);}).on("mouseout",()=>tooltip.style("opacity",0));
    grp.append("rect").attr("x",(d:any)=>x1("s")!).attr("width",x1.bandwidth()).attr("y",(d:any)=>y(d.sortant)).attr("height",(d:any)=>H-M.bottom-y(d.sortant)).attr("fill",ORANGE).attr("rx",2).attr("opacity",0.85)
      .on("mouseover",(e:any,d:any)=>{tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px").html(`<strong>${d.annee} — Sortants</strong><br/>${d.sortant.toFixed(0)} M$`);}).on("mouseout",()=>tooltip.style("opacity",0));
    svg.append("g").attr("transform",`translate(0,${H-M.bottom})`).call(d3.axisBottom(x0).tickValues(merged.filter((_:any,i:number)=>i%3===0).map((d:any)=>String(d.annee)))).call((g:any)=>g.select(".domain").remove()).call((g:any)=>g.selectAll("line").remove()).call((g:any)=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
    svg.append("g").attr("transform",`translate(${M.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((d:any)=>`${(+d/1000).toFixed(1)}Md`)).call((g:any)=>g.select(".domain").remove()).call((g:any)=>g.selectAll("line").remove()).call((g:any)=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
    // Légende
    const leg=svg.append("g").attr("transform",`translate(${M.left+8},${M.top})`);
    leg.append("rect").attr("width",10).attr("height",10).attr("fill",BLEU).attr("rx",2);
    leg.append("text").attr("x",14).attr("y",9).text("Entrants").style("font-size","10px").style("fill","#4a5568");
    leg.append("rect").attr("x",72).attr("width",10).attr("height",10).attr("fill",ORANGE).attr("rx",2);
    leg.append("text").attr("x",86).attr("y",9).text("Sortants").style("font-size","10px").style("fill","#4a5568");
  },[merged,height]);
  return <svg ref={ref} style={{width:"100%",height,display:"block"}} />;
}

function BarresBalance({ entrants, sortants, height=200 }: any) {
  const ref=useRef<SVGSVGElement>(null);
  const data=entrants.map((e:any)=>({annee:e.annee,balance:(e.valeur??0)-(sortants.find((s:any)=>s.annee===e.annee)?.valeur??0)})).filter((d:any)=>d.annee>=2005);
  useEffect(()=>{
    if (!ref.current||data.length===0) return;
    const el=ref.current; const W=el.clientWidth||600; const H=height; const M={top:12,right:12,bottom:30,left:55};
    d3.select(el).selectAll("*").remove();
    const svg=d3.select(el).attr("viewBox",`0 0 ${W} ${H}`);
    const x=d3.scaleBand().domain(data.map((d:any)=>String(d.annee))).range([M.left,W-M.right]).padding(0.2);
    const y=d3.scaleLinear().domain([d3.min(data,(d:any)=>d.balance)!*1.1,d3.max(data,(d:any)=>d.balance)!*1.1]).range([H-M.bottom,M.top]);
    svg.append("line").attr("x1",M.left).attr("x2",W-M.right).attr("y1",y(0)).attr("y2",y(0)).attr("stroke","#C5BFBB").attr("stroke-width",1);
    const tooltip=d3.select("#d3-tooltip") as any;
    svg.selectAll("rect").data(data).enter().append("rect").attr("x",(d:any)=>x(String(d.annee))!).attr("width",x.bandwidth()).attr("y",(d:any)=>d.balance>=0?y(d.balance):y(0)).attr("height",(d:any)=>Math.abs(y(d.balance)-y(0))).attr("fill",(d:any)=>d.balance>=0?VERT:"#dc2626").attr("rx",2).attr("opacity",0.8)
      .on("mouseover",(e:any,d:any)=>{tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px").html(`<strong>${d.annee}</strong><br/>Balance: ${d.balance.toFixed(0)} M$`);}).on("mouseout",()=>tooltip.style("opacity",0));
    svg.append("g").attr("transform",`translate(0,${H-M.bottom})`).call(d3.axisBottom(x).tickValues(data.filter((_:any,i:number)=>i%3===0).map((d:any)=>String(d.annee)))).call((g:any)=>g.select(".domain").remove()).call((g:any)=>g.selectAll("line").remove()).call((g:any)=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
    svg.append("g").attr("transform",`translate(${M.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((d:any)=>`${(+d/1000).toFixed(1)}Md`)).call((g:any)=>g.select(".domain").remove()).call((g:any)=>g.selectAll("line").remove()).call((g:any)=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
  },[data,height]);
  return <svg ref={ref} style={{width:"100%",height,display:"block"}} />;
}

// ── Modal graphe plein écran ───────────────────────────────────────────────────
function GrapheModal({ open, onClose, titre, sous_titre, children, analyse }: any) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:1000, maxHeight:"90vh", overflowY:"auto", border:"1px solid #E8E5E3", boxShadow:"0 40px 100px rgba(0,0,0,0.3)" }}>
        <div style={{ height:4, background:`linear-gradient(90deg,${BLEU},#1a6ab0)`, borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <h3 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", marginBottom:4 }}>{titre}</h3>
              {sous_titre && <p style={{ fontSize:12, color:"#9aa5b4" }}>{sous_titre}</p>}
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:8 }}><X size={15} color="#4a5568" /></button>
          </div>
          {children}
          {analyse && (
            <div style={{ marginTop:20, background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.12)", borderLeft:`3px solid ${BLEU}`, borderRadius:"0 10px 10px 0", padding:"14px 18px" }}>
              <p style={{ fontSize:13, fontWeight:700, color:BLEU, marginBottom:6 }}>{analyse.titre}</p>
              <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{analyse.commentaire}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card graphe miniature ─────────────────────────────────────────────────────
function GrapheCard({ titre, sous_titre, children, analyse, fullChildren }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={()=>setOpen(true)}
        style={{ background:"#fff", borderRadius:16, border:"1px solid #E8E5E3", padding:"16px 18px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", cursor:"pointer", transition:"all 0.15s" }}
        onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 24px rgba(0,79,145,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <h3 style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", marginBottom:2 }}>{titre}</h3>
            {sous_titre && <p style={{ fontSize:11, color:"#9aa5b4" }}>{sous_titre}</p>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {analyse && <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, fontWeight:600, color:BLEU, background:"rgba(0,79,145,0.08)", padding:"2px 7px", borderRadius:999 }}><Info size={9}/> Analyse</span>}
            <Maximize2 size={13} style={{ color:"#C5BFBB" }} />
          </div>
        </div>
        {/* Miniature du graphe — non interactive */}
        <div style={{ pointerEvents:"none" }}>
          {children}
        </div>
      </div>

      <GrapheModal open={open} onClose={()=>setOpen(false)} titre={titre} sous_titre={sous_titre} analyse={analyse}>
        {fullChildren || children}
      </GrapheModal>
    </>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function IdePage() {
  const [onglet,     setOnglet]     = useState("cnuced");
  const [feData,     setFeData]     = useState<any[]>([]);
  const [fsData,     setFsData]     = useState<any[]>([]);
  const [seData,     setSeData]     = useState<any[]>([]);
  const [analyses,   setAnalyses]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [kpisActifs, setKpisActifs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [feR, fsR, seR, anaR, kpiR] = await Promise.all([
          fetch(`${API}/ide/cnuced?direction=entrant&indicateur=flux`).then(r=>r.json()),
          fetch(`${API}/ide/cnuced?direction=sortant&indicateur=flux`).then(r=>r.json()),
          fetch(`${API}/ide/cnuced?direction=entrant&indicateur=stock`).then(r=>r.json()),
          fetch(`${API}/ide/analyses?source=cnuced&publie=true`).then(r=>r.json()),
          fetch(`${API}/ide/kpis-config/actifs`).then(r=>r.json()),
        ]);
        setFeData(feR); setFsData(fsR); setSeData(seR);
        setAnalyses(anaR); setKpisActifs(kpiR||[]);
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    };
    if (onglet === "cnuced") load();
  }, [onglet]);

  const getAnalyse = (direction:string, indicateur:string) =>
    analyses.find(a => a.direction===direction && a.indicateur===indicateur) || null;

  const GRAPHES = [
    {
      titre:"Flux d'IDE entrants (1990–2024)",
      sous_titre:"Montants annuels en millions USD",
      analyse: getAnalyse("entrant","flux"),
      mini: <CourbeLine data={feData} couleur={BLEU}   label="fe-mini" height={140} />,
      full: <CourbeLine data={feData} couleur={BLEU}   label="fe-full" height={340} />,
    },
    {
      titre:"Stock d'IDE entrant (1990–2024)",
      sous_titre:"Cumul des investissements étrangers en M$",
      analyse: getAnalyse("entrant","stock"),
      mini: <CourbeLine data={seData} couleur={VERT}   label="se-mini" height={140} />,
      full: <CourbeLine data={seData} couleur={VERT}   label="se-full" height={340} />,
    },
    {
      titre:"Flux entrants vs sortants (2005–2024)",
      sous_titre:"Comparaison annuelle en millions USD",
      analyse: getAnalyse("les_deux","flux"),
      mini: <BarresEntrantSortant entrants={feData} sortants={fsData} height={140} />,
      full: <BarresEntrantSortant entrants={feData} sortants={fsData} height={340} />,
    },
    {
      titre:"Balance des IDE (2005–2024)",
      sous_titre:"Flux entrants – sortants · Vert = solde positif",
      analyse: getAnalyse("les_deux","stock"),
      mini: <BarresBalance entrants={feData} sortants={fsData} height={140} />,
      full: <BarresBalance entrants={feData} sortants={fsData} height={340} />,
    },
    {
      titre:"Flux d'IDE sortants (1990–2024)",
      sous_titre:"Investissements sénégalais à l'étranger en M$",
      analyse: getAnalyse("sortant","flux"),
      mini: <CourbeLine data={fsData} couleur={ORANGE} label="fs-mini" height={140} />,
      full: <CourbeLine data={fsData} couleur={ORANGE} label="fs-full" height={340} />,
    },
  ];

  return (
    <main style={{ minHeight:"100vh", background:"#F2F0EF", fontFamily:"var(--font-google-sans)" }}>
      <div id="d3-tooltip" style={{ position:"fixed", pointerEvents:"none", background:"rgba(26,26,46,0.92)", color:"#fff", borderRadius:8, padding:"8px 12px", fontSize:12, lineHeight:1.5, opacity:0, zIndex:9999, transition:"opacity 0.15s", backdropFilter:"blur(4px)" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding:"100px 40px 40px", background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", position:"relative" as const, overflow:"hidden" }}>
        <div style={{ position:"absolute" as const, inset:0, pointerEvents:"none" }}>
          <div style={{ position:"absolute" as const, bottom:"-20%", left:"-5%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)" }} />
        </div>
        <div style={{ maxWidth:1280, margin:"0 auto", position:"relative" as const, zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(202,99,31,0.1)", border:"1px solid rgba(202,99,31,0.25)", borderRadius:999, padding:"6px 14px", marginBottom:17 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#D96D3B", letterSpacing:"0.15em", textTransform:"uppercase" as const }}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{ fontWeight:800, fontSize:"clamp(2.2rem,4vw,3.2rem)", color:"#fff", lineHeight:1.1, marginBottom:16 }}>Investissements Directs Étrangers</h1>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:15, maxWidth:600, lineHeight:1.7 }}>Analyse des flux et stocks d'IDE du Sénégal — données officielles CNUCED, 1990–2024.</p>
        </div>
      </section>

      {/* Onglets */}
      <div style={{ background:"#fff", borderBottom:"1px solid #E8E5E3" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 40px", display:"flex" }}>
          {[{value:"cnuced",label:"CNUCED"},{value:"fdi_markets",label:"FDI Markets"}].map(o=>(
            <button key={o.value} onClick={()=>setOnglet(o.value)}
              style={{ padding:"16px 24px", border:"none", borderBottom:`3px solid ${onglet===o.value?BLEU:"transparent"}`, background:"transparent", fontSize:14, fontWeight:onglet===o.value?700:500, color:onglet===o.value?BLEU:"#9aa5b4", cursor:"pointer", transition:"all 0.15s" }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <section style={{ padding:"36px 40px 80px", maxWidth:1280, margin:"0 auto" }}>
        {onglet === "cnuced" ? (
          loading ? (
            <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
              <div style={{ width:32, height:32, border:`3px solid ${BLEU}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column" as const, gap:28 }}>

              {/* KPI Cards — max 4 */}
              {kpisActifs.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
                  {kpisActifs.slice(0,4).map(k => {
                    const isPos = k.variation > 0;
                    const Icon  = !k.variation ? Minus : isPos ? TrendingUp : TrendingDown;
                    const couleur = k.sens==="hausse_bien" ? BLEU : k.sens==="baisse_bien" ? ORANGE : VERT;
                    return (
                      <div key={k.code} style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid #E8E5E3", borderTop:`3px solid ${couleur}` }}>
                        <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:10, lineHeight:1.4 }}>{k.label}</p>
                        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:8 }}>
                          <div>
                            <p style={{ fontSize:"1.7rem", fontWeight:800, color:"#1a1a2e", lineHeight:1 }}>{fmtVal(k.valeur, k.unite)}</p>
                            {k.annee && <p style={{ fontSize:11, color:"#9aa5b4", marginTop:5 }}>en {k.annee}</p>}
                          </div>
                          {k.variation !== null && k.variation !== undefined && (
                            <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, fontWeight:700, color:isPos?VERT:"#dc2626", background:isPos?"rgba(24,128,56,0.08)":"rgba(220,38,38,0.08)", padding:"5px 10px", borderRadius:999, flexShrink:0 }}>
                              <Icon size={12} /> {isPos?"+":""}{k.variation}%
                            </div>
                          )}
                        </div>
                        {k.variation !== null && k.variation !== undefined && (
                          <p style={{ fontSize:10, color:"#C5BFBB", marginTop:6 }}>vs année précédente</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grille graphes en cards miniatures */}
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:16 }}>
                  Graphes — Cliquez pour agrandir
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))", gap:14 }}>
                  {GRAPHES.map((g, i) => (
                    <GrapheCard key={i} titre={g.titre} sous_titre={g.sous_titre} analyse={g.analyse} fullChildren={g.full}>
                      {g.mini}
                    </GrapheCard>
                  ))}
                </div>
              </div>

            </div>
          )
        ) : (
          <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
            <p style={{ fontSize:18, fontWeight:700, color:"#4a5568", marginBottom:8 }}>FDI Markets</p>
            <p style={{ fontSize:14 }}>Les données FDI Markets seront disponibles prochainement.</p>
          </div>
        )}
      </section>
    </main>
  );
}
