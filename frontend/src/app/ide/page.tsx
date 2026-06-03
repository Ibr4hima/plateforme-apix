"use client";

import Navbar from "@/components/layout/Navbar";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { X, Maximize2, Table, ChevronDown, ChevronUp, Filter, BarChart2, Settings2, Info } from "lucide-react";
import { calculerKpis, fmtKpi, KPI_DEFAUT, type KpiResult } from "@/lib/ideKpis";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Couleurs par pays ─────────────────────────────────────────────────────────
const PAYS_COLORS: Record<string,string> = {
  "Sénégal":  "#188038",
  "Cameroun": "#3b6bcc",
};
const PALETTE = ["#188038","#3b6bcc","#e07a2e","#7c3aed","#0891b2","#dc2626","#d97706","#059669"];
function getPaysColor(nom: string, index: number): string {
  return PAYS_COLORS[nom] || PALETTE[index % PALETTE.length];
}

function flag(iso2: string) {
  try { return String.fromCodePoint(...iso2.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0))); }
  catch { return "🌍"; }
}

function fmtVal(v: number|null) {
  if (v === null || v === undefined) return "N/A";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v/1000).toFixed(1)} Md$`;
  return `${v.toFixed(0)} M$`;
}

// ── Download graphe ───────────────────────────────────────────────────────────
function downloadSVG(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  // Fond blanc pour PNG
  const bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width","100%"); bg.setAttribute("height","100%"); bg.setAttribute("fill","white");
  clone.insertBefore(bg, clone.firstChild);
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href=url; a.download=`${filename}.svg`; a.click();
  URL.revokeObjectURL(url);
}

function downloadPNG(svgEl: SVGSVGElement, filename: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || 400;
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);
  const img  = new Image(); img.width=W*2; img.height=H*2;
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

// ── Graphe D3 multi-pays ──────────────────────────────────────────────────────
function GrapheMultiPays({ series, height=280, type="line", titre="" }: {
  series: {nom:string; couleur:string; data:{annee:number;valeur:number|null}[]}[];
  height?: number;
  type?:   "line"|"bar";
  titre?:  string;
}) {
  const ref    = useRef<SVGSVGElement>(null);
  const wrapRef= useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!ref.current || !series.length) return;
    const el = ref.current;
    const W  = el.parentElement?.clientWidth || el.clientWidth || 700;
    const H  = height;
    const M  = { top:12, right:20, bottom:34, left:64 };

    d3.select(el).selectAll("*").remove();
    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");

    const allData = series.flatMap(s => s.data.filter(d => d.valeur !== null) as {annee:number;valeur:number}[]);
    if (!allData.length) return;

    const allAnnees = [...new Set(allData.map(d=>d.annee))].sort();
    const minVal    = Math.min(0, d3.min(allData,d=>d.valeur)!);
    const maxVal    = d3.max(allData,d=>d.valeur)!;

    const xBand = d3.scaleBand().domain(allAnnees.map(String)).range([M.left,W-M.right]).padding(0.18);
    const xLin  = d3.scaleLinear().domain([allAnnees[0], allAnnees[allAnnees.length-1]]).range([M.left,W-M.right]);
    const y     = d3.scaleLinear().domain([minVal, maxVal*1.08]).nice().range([H-M.bottom,M.top]);

    // Grille horizontale légère
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1",M.left).attr("x2",W-M.right).attr("y1",d=>y(d)).attr("y2",d=>y(d))
      .attr("stroke","#EBEBEB").attr("stroke-width",1);

    if (minVal < 0)
      svg.append("line").attr("x1",M.left).attr("x2",W-M.right).attr("y1",y(0)).attr("y2",y(0))
        .attr("stroke","#C5BFBB").attr("stroke-width",1.2).attr("stroke-dasharray","4,3");

    const tooltip = d3.select("#d3-tooltip") as any;

    // ── BARRES (style D3 Observable) ────────────────────────────────────────
    if (type === "bar") {
      const nbSeries = series.length;
      const xGroup   = nbSeries > 1
        ? d3.scaleBand().domain(series.map(s=>s.nom)).range([0,xBand.bandwidth()]).padding(0.06)
        : null;

      series.forEach(s => {
        const valid = s.data.filter(d=>d.valeur!==null) as {annee:number;valeur:number}[];
        if (!valid.length) return;

        const getX = (d:{annee:number}) => {
          const base = xBand(String(d.annee))!;
          return xGroup ? base + xGroup(s.nom)! : base;
        };
        const getW = () => xGroup ? xGroup.bandwidth() : xBand.bandwidth();

        svg.selectAll(`.b${s.nom.replace(/\W/g,"")}`)
          .data(valid).enter().append("rect")
          .attr("class",`b${s.nom.replace(/\W/g,"")}`)
          .attr("x",d=>getX(d))
          .attr("width",getW())
          .attr("y",d=>d.valeur>=0?y(d.valeur):y(0))
          .attr("height",d=>Math.abs(y(d.valeur)-y(0)))
          .attr("fill",s.couleur)
          .attr("rx",3)
          .style("cursor","pointer")
          .on("mouseover",(e,d)=>{
            d3.select(e.currentTarget as SVGRectElement).attr("opacity",0.75);
            tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px")
              .html(`<strong>${d.annee}${nbSeries>1?" — "+s.nom:""}</strong><br/>${fmtVal(d.valeur)}`);
          })
          .on("mouseout",(e)=>{ d3.select(e.currentTarget as SVGRectElement).attr("opacity",1); tooltip.style("opacity",0); });
      });

      // Axe X barres
      const maxTicks = Math.floor((W - M.left - M.right) / 28);
      const step = Math.ceil(allAnnees.length / maxTicks);
      const tickVals = allAnnees.filter((_,i)=>i%step===0).map(String);
      svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
        .call(d3.axisBottom(xBand).tickValues(tickVals).tickSizeOuter(0))
        .call(g=>g.select(".domain").attr("stroke","#E8E5E3"))
        .call(g=>g.selectAll("line").remove())
        .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));

    // ── COURBES ──────────────────────────────────────────────────────────────
    } else {
      series.forEach(s => {
        const valid = s.data.filter(d=>d.valeur!==null) as {annee:number;valeur:number}[];
        if (!valid.length) return;

        // Dégradé aire
        const gid = `g${s.nom.replace(/\W/g,"")}`;
        const defs = svg.append("defs");
        const grad = defs.append("linearGradient").attr("id",gid).attr("x1","0").attr("x2","0").attr("y1","0").attr("y2","1");
        grad.append("stop").attr("offset","0%").attr("stop-color",s.couleur).attr("stop-opacity",0.1);
        grad.append("stop").attr("offset","100%").attr("stop-color",s.couleur).attr("stop-opacity",0);

        svg.append("path").datum(valid).attr("fill",`url(#${gid})`)
          .attr("d",d3.area<{annee:number;valeur:number}>().x(d=>xLin(d.annee)).y0(y(0)).y1(d=>y(d.valeur)).curve(d3.curveMonotoneX));

        svg.append("path").datum(valid).attr("fill","none").attr("stroke",s.couleur).attr("stroke-width",2.2)
          .attr("d",d3.line<{annee:number;valeur:number}>().x(d=>xLin(d.annee)).y(d=>y(d.valeur)).curve(d3.curveMonotoneX));

        const nb = valid.length;
        const rBase = nb > 25 ? 0 : nb > 18 ? 1.5 : nb > 10 ? 2 : 2.5;
        if (rBase > 0) {
          svg.selectAll(`.p${s.nom.replace(/\W/g,"")}`)
            .data(valid).enter().append("circle")
            .attr("cx",d=>xLin(d.annee)).attr("cy",d=>y(d.valeur)).attr("r",rBase)
            .attr("fill","#fff").attr("stroke",s.couleur).attr("stroke-width",1.5).style("cursor","pointer")
            .on("mouseover",(e,d)=>{ d3.select(e.currentTarget as any).attr("r",rBase+2); tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px").html(`<strong>${d.annee} — ${s.nom}</strong><br/>${fmtVal(d.valeur)}`); })
            .on("mouseout",(e)=>{ d3.select(e.currentTarget as any).attr("r",rBase); tooltip.style("opacity",0); });
        } else {
          // Zone hover invisible pour tooltip même sans points visibles
          svg.selectAll(`.ph${s.nom.replace(/\W/g,"")}`)
            .data(valid).enter().append("circle")
            .attr("cx",d=>xLin(d.annee)).attr("cy",d=>y(d.valeur)).attr("r",6)
            .attr("fill","transparent").attr("stroke","none").style("cursor","pointer")
            .on("mouseover",(e,d)=>{ tooltip.style("opacity",1).style("left",(e.pageX+12)+"px").style("top",(e.pageY-28)+"px").html(`<strong>${d.annee} — ${s.nom}</strong><br/>${fmtVal(d.valeur)}`); })
            .on("mouseout",()=>{ tooltip.style("opacity",0); });
        }
      });

      // Axe X courbes
      svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
        .call(d3.axisBottom(xLin).ticks(8).tickFormat(d3.format("d")).tickSizeOuter(0))
        .call(g=>g.select(".domain").attr("stroke","#E8E5E3"))
        .call(g=>g.selectAll("line").remove())
        .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
    }

    // Axe Y commun
    svg.append("g").attr("transform",`translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d=>{
        const v = +d; const abs=Math.abs(v);
        return abs>=1e9?`${(v/1e9).toFixed(1)}Md`:abs>=1e6?`${(v/1e6).toFixed(0)}M`:`${v.toFixed(0)}`;
      }))
      .call(g=>g.select(".domain").remove())
      .call(g=>g.selectAll("line").remove())
      .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));

  }, [series, type, height]);

  // ResizeObserver — redessine quand la largeur change (sidebar pliée/dépliée)
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <div ref={wrapRef} style={{ position:"relative" as const }}>
      <svg ref={ref} style={{ width:"100%", height, display:"block" }} />
    </div>
  );
}

// ── Modal graphe plein écran ──────────────────────────────────────────────────
function GrapheModal({ open, onClose, titre, sous_titre, children, analyse, series, grapheId }: any) {
  const svgRef = useRef<SVGSVGElement|null>(null);

  // Trouver le SVG dans le contenu rendu
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement|null;

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:1100, maxHeight:"90vh", overflowY:"auto", border:"1px solid #E8E5E3", boxShadow:"0 40px 100px rgba(0,0,0,0.25)" }}>
        <div style={{ height:3, background:`linear-gradient(90deg,#188038,#3b6bcc,#e07a2e)`, borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"22px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" as const, marginBottom:4 }}>
                <h3 style={{ fontWeight:800, fontSize:"1.05rem", color:"#1a1a2e", margin:0 }}>{titre}</h3>
                {series?.length > 0 && (
                  <div style={{ display:"flex", gap:10 }}>
                    {series.filter((s:any)=>s.data.some((d:any)=>d.valeur!==null)).map((s:any) => (
                      <div key={s.nom} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:14, height:3, borderRadius:2, background:s.couleur }} />
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:500 }}>{s.nom}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {sous_titre && <p style={{ fontSize:12, color:"#9aa5b4" }}>{sous_titre}</p>}
            </div>
            {/* Boutons download + fermer */}
            <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:16 }}>
              <button onClick={()=>{ const svg=getSvg(); if(svg) downloadPNG(svg, grapheId||titre||"graphe"); }}
                style={{ fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:8, border:"1px solid #E8E5E3", background:"#fff", color:"#4a5568", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Télécharger
              </button>
              <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:8 }}><X size={15} color="#4a5568" /></button>
            </div>
          </div>
          <div ref={modalRef}>
            {children}
          </div>
          {analyse && (
            <div style={{ marginTop:18, background:"rgba(0,79,145,0.03)", border:"1px solid rgba(0,79,145,0.1)", borderLeft:`3px solid #3b6bcc`, borderRadius:"0 10px 10px 0", padding:"14px 18px" }}>
              <p style={{ fontSize:13, fontWeight:700, color:"#3b6bcc", marginBottom:6 }}>{analyse.titre}</p>
              <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{analyse.commentaire}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card graphe miniature ─────────────────────────────────────────────────────
function GrapheCard({ titre, sous_titre, children, fullChildren, analyse, series, grapheId }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={()=>setOpen(true)}
        style={{ background:"#fff", borderRadius:16, border:"1px solid #E8E5E3", padding:"16px 18px", cursor:"pointer", transition:"all 0.18s", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}
        onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.1)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="#d4d0cd"; }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#E8E5E3"; }}>

        {/* Header avec titre + légende + expand */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
              <h3 style={{ fontWeight:700, fontSize:12, color:"#1a1a2e", margin:0 }}>{titre}</h3>
              {/* Légende inline */}
              {series?.length > 0 && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                  {series.filter((s:any)=>s.data.some((d:any)=>d.valeur!==null)).map((s:any) => (
                    <div key={s.nom} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:10, height:3, borderRadius:2, background:s.couleur }} />
                      <span style={{ fontSize:10, color:"#6b7280", fontWeight:500 }}>{s.nom}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sous_titre && <p style={{ fontSize:10, color:"#9aa5b4", marginTop:3 }}>{sous_titre}</p>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, marginLeft:8 }}>
            {analyse && <span style={{ fontSize:9, fontWeight:700, color:"#6b7280", background:"#F2F0EF", padding:"2px 6px", borderRadius:999, letterSpacing:"0.05em" }}>ANALYSE</span>}
            <Maximize2 size={11} style={{ color:"#C5BFBB" }} />
          </div>
        </div>
        <div style={{ pointerEvents:"none" }}>{children}</div>
      </div>

      <GrapheModal open={open} onClose={()=>setOpen(false)} titre={titre} sous_titre={sous_titre} analyse={analyse} series={series} grapheId={grapheId}>
        {fullChildren || children}
      </GrapheModal>
    </>
  );
}

// ── Tableau de données ────────────────────────────────────────────────────────
function TableauDonnees({ donnees, paysSelectionnes }: any) {
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const series_list = [
    {dir:"entrant",ind:"flux",label:"Flux entrants"},
    {dir:"sortant",ind:"flux",label:"Flux sortants"},
    {dir:"entrant",ind:"stock",label:"Stock entrant"},
    {dir:"sortant",ind:"stock",label:"Stock sortant"},
  ];
  const get = (pays:string, dir:string, ind:string, annee:number) => {
    const r = donnees.find((d:any)=>d.pays===pays && d.direction===dir && d.indicateur===ind && d.annee===annee);
    return r?.valeur !== null && r?.valeur !== undefined ? fmtVal(r.valeur) : "—";
  };
  return (
    <div style={{ overflowX:"auto" as const }}>
      <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
        <thead>
          <tr style={{ background:"#F8F7F6" }}>
            <th style={{ padding:"8px 12px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#9aa5b4", position:"sticky" as const, left:0, background:"#F8F7F6", borderRight:"1px solid #E8E5E3" }}>Pays / Indicateur</th>
            {annees.map(a=><th key={a} style={{ padding:"8px 10px", fontSize:11, fontWeight:700, color:"#9aa5b4", textAlign:"center" as const, minWidth:70 }}>{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {paysSelectionnes.map((pays:any, pi:number) =>
            series_list.map((s,si) => (
              <tr key={`${pays.nom}-${s.dir}-${s.ind}`} style={{ borderBottom:"1px solid #F2F0EF", background:pi%2===0?"#fff":"#FAFAF9" }}>
                <td style={{ padding:"7px 12px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #E8E5E3", whiteSpace:"nowrap" as const }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {si===0 && <div style={{ width:8, height:8, borderRadius:"50%", background:pays.couleur, flexShrink:0 }} />}
                    {si===0 && <span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e" }}>{pays.nom}</span>}
                    {si>0 && <span style={{ width:8, flexShrink:0 }} />}
                    <span style={{ fontSize:11, color:"#4a5568" }}>{s.label}</span>
                  </div>
                </td>
                {annees.map(a=>(
                  <td key={a} style={{ padding:"7px 10px", textAlign:"center" as const, fontSize:12, color:"#1a1a2e" }}>
                    {get(pays.nom, s.dir, s.ind, a)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Export données pour ML ────────────────────────────────────────────────────
function exportCSV(donnees: any[], paysSelectionnes: any[], periode: string) {
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const series = [
    {dir:"entrant",ind:"flux",col:"flux_entrant_M_USD"},
    {dir:"sortant",ind:"flux",col:"flux_sortant_M_USD"},
    {dir:"entrant",ind:"stock",col:"stock_entrant_M_USD"},
    {dir:"sortant",ind:"stock",col:"stock_sortant_M_USD"},
  ];
  const get = (pays:string,dir:string,ind:string,annee:number) => {
    const r = donnees.find((d:any)=>d.pays===pays&&d.direction===dir&&d.indicateur===ind&&d.annee===annee);
    return r?.valeur!==null&&r?.valeur!==undefined ? r.valeur.toFixed(2) : "";
  };
  // Header
  const cols = ["pays","annee",...series.map(s=>s.col),"flux_net_M_USD","stock_net_M_USD"];
  const rows: string[] = [cols.join(",")];
  paysSelectionnes.forEach((p:any) => {
    annees.forEach(a => {
      const fe = donnees.find((d:any)=>d.pays===p.nom&&d.direction==="entrant"&&d.indicateur==="flux"&&d.annee===a)?.valeur;
      const fs = donnees.find((d:any)=>d.pays===p.nom&&d.direction==="sortant"&&d.indicateur==="flux"&&d.annee===a)?.valeur;
      const se = donnees.find((d:any)=>d.pays===p.nom&&d.direction==="entrant"&&d.indicateur==="stock"&&d.annee===a)?.valeur;
      const ss = donnees.find((d:any)=>d.pays===p.nom&&d.direction==="sortant"&&d.indicateur==="stock"&&d.annee===a)?.valeur;
      const fn = fe!==undefined&&fe!==null&&fs!==undefined&&fs!==null ? (fe-fs).toFixed(2) : "";
      const sn = se!==undefined&&se!==null&&ss!==undefined&&ss!==null ? (se-ss).toFixed(2) : "";
      rows.push([
        `"${p.nom}"`, a,
        fe!==null&&fe!==undefined?fe.toFixed(2):"",
        fs!==null&&fs!==undefined?fs.toFixed(2):"",
        se!==null&&se!==undefined?se.toFixed(2):"",
        ss!==null&&ss!==undefined?ss.toFixed(2):"",
        fn, sn
      ].join(","));
    });
  });
  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`IDE_CNUCED_${paysSelectionnes.map((p:any)=>p.nom.replace(/\s/g,"_")).join("_")}_${periode}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportJSON(donnees: any[], paysSelectionnes: any[], periode: string) {
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const result = paysSelectionnes.map((p:any) => ({
    pays: p.nom,
    source: "CNUCED",
    unite: "M$ USD",
    periode,
    donnees: annees.map(a => {
      const fe=donnees.find((d:any)=>d.pays===p.nom&&d.direction==="entrant"&&d.indicateur==="flux"&&d.annee===a)?.valeur??null;
      const fs=donnees.find((d:any)=>d.pays===p.nom&&d.direction==="sortant"&&d.indicateur==="flux"&&d.annee===a)?.valeur??null;
      const se=donnees.find((d:any)=>d.pays===p.nom&&d.direction==="entrant"&&d.indicateur==="stock"&&d.annee===a)?.valeur??null;
      const ss=donnees.find((d:any)=>d.pays===p.nom&&d.direction==="sortant"&&d.indicateur==="stock"&&d.annee===a)?.valeur??null;
      return {
        annee: a,
        flux_entrant_M_USD: fe,
        flux_sortant_M_USD: fs,
        flux_net_M_USD: fe!==null&&fs!==null?+(fe-fs).toFixed(2):null,
        stock_entrant_M_USD: se,
        stock_sortant_M_USD: ss,
        stock_net_M_USD: se!==null&&ss!==null?+(se-ss).toFixed(2):null,
      };
    })
  }));
  const blob = new Blob([JSON.stringify(result, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`IDE_CNUCED_${paysSelectionnes.map((p:any)=>p.nom.replace(/\s/g,"_")).join("_")}_${periode}.json`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Modal données ─────────────────────────────────────────────────────────────
function ModalDonnees({ open, onClose, donnees, paysSelectionnes }: any) {
  if (!open) return null;
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const periode = annees.length ? `${annees[0]}_${annees[annees.length-1]}` : "all";

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"90vh", display:"flex", flexDirection:"column" as const, border:"1px solid #E8E5E3", boxShadow:"0 40px 100px rgba(0,0,0,0.25)" }}>
        <div style={{ height:3, background:"linear-gradient(90deg,#188038,#3b6bcc,#e07a2e)", borderRadius:"20px 20px 0 0" }} />

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 26px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div>
              <h3 style={{ fontWeight:800, fontSize:"1.05rem", color:"#1a1a2e" }}>Données brutes</h3>
              <p style={{ fontSize:12, color:"#9aa5b4", marginTop:2 }}>Source CNUCED · Valeurs en M$ USD · {annees.length} années</p>
            </div>
            {/* Badges pays */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
              {paysSelectionnes.map((p:any)=>(
                <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:5, background:`${p.couleur}10`, border:`1.5px solid ${p.couleur}30`, borderRadius:999, padding:"3px 12px" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:p.couleur }} />
                  <span style={{ fontSize:12, fontWeight:700, color:p.couleur }}>{p.nom}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>exportCSV(donnees,paysSelectionnes,periode)}
                style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:9, border:"1px solid #E8E5E3", background:"#fff", color:"#1a1a2e", cursor:"pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
              <button onClick={()=>exportJSON(donnees,paysSelectionnes,periode)}
                style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:9, border:"1px solid #E8E5E3", background:"#fff", color:"#1a1a2e", cursor:"pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                JSON
              </button>
            </div>
            <div style={{ width:1, height:24, background:"#E8E5E3" }} />
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:8 }}><X size={14} color="#4a5568"/></button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:1 }}>
              <tr style={{ background:"#F8F7F6" }}>
                <th style={{ padding:"10px 16px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#9aa5b4", position:"sticky" as const, left:0, background:"#F8F7F6", borderRight:"1px solid #E8E5E3", whiteSpace:"nowrap" as const, minWidth:180 }}>Pays · Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:"#9aa5b4", textAlign:"right" as const, minWidth:80 }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map((pays:any, pi:number) => {
                const series = [
                  {dir:"entrant",ind:"flux",label:"Flux entrants"},
                  {dir:"sortant",ind:"flux",label:"Flux sortants"},
                  {dir:"entrant",ind:"stock",label:"Stock entrant"},
                  {dir:"sortant",ind:"stock",label:"Stock sortant"},
                ];
                return series.map((s,si)=>(
                  <tr key={`${pays.nom}-${s.dir}-${s.ind}`}
                    style={{ borderBottom: si===series.length-1?"2px solid #E8E5E3":"1px solid #F2F0EF", background:"#fff" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#F8F7F6"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <td style={{ padding:"9px 16px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #E8E5E3", whiteSpace:"nowrap" as const }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {si===0 ? (
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:pays.couleur, flexShrink:0 }} />
                            <span style={{ fontSize:12, fontWeight:800, color:pays.couleur }}>{pays.nom}</span>
                            <span style={{ fontSize:11, color:"#9aa5b4", fontWeight:400 }}>·</span>
                            <span style={{ fontSize:11, color:"#4a5568" }}>{s.label}</span>
                          </div>
                        ) : (
                          <div style={{ display:"flex", alignItems:"center", gap:7, paddingLeft:15 }}>
                            <span style={{ fontSize:11, color:"#4a5568" }}>{s.label}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {annees.map(a=>{
                      const r = donnees.find((d:any)=>d.pays===pays.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
                      const v = r?.valeur;
                      const display = v!==null&&v!==undefined ? fmtVal(v) : "—";
                      const isNeg = v!==null&&v!==undefined&&v<0;
                      return (
                        <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color:isNeg?"#dc2626":v===null||v===undefined?"#C5BFBB":"#1a1a2e", fontWeight:v!==null&&v!==undefined?500:400, fontVariantNumeric:"tabular-nums" }}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 26px", borderTop:"1px solid #F2F0EF", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, background:"#FAFAF9", borderRadius:"0 0 20px 20px" }}>
          <p style={{ fontSize:11, color:"#9aa5b4" }}>
            {paysSelectionnes.length} pays · {annees.length} années · {paysSelectionnes.length*4} séries · valeurs en M$ USD
          </p>
          <p style={{ fontSize:11, color:"#9aa5b4" }}>CSV et JSON formatés pour Python/R/ML</p>
        </div>
      </div>
    </div>
  );
}

// ── 25 KPIs fixes ─────────────────────────────────────────────────────────────
const KPI_25_IDS = [
  "fe_last","fs_last","fn_last","se_last","ss_last","sn_last",
  "g_fe","g_se","cagr_fe","mom_fe",
  "moy_fe","med_fe","max_fe","min_fe","std_fe",
  "trend_fe","accel_fe","tv5_fe","tv10_fe",
  "r_fe_fs","dist_max_fe","regularite_fe","vs_moy_fe",
  "n_pos_fe","cur_streak_fe"
];

// ── Interprétation contextuelle d'un KPI ─────────────────────────────────────
function interpreterKpi(k: KpiResult, pays: string, couleur: string): string {
  if (k.valeur === null || k.valeur === undefined || isNaN(k.valeur)) return "Données insuffisantes pour interpréter cet indicateur.";
  const v = k.valeur;
  const fmt = fmtKpi(k);
  switch(k.id) {
    case "fe_last": return v>0?`En ${k.annee}, ${pays} a attiré ${fmt} d'IDE entrants. ${v>1000?"C'est un niveau significatif, reflétant une attractivité forte pour les investisseurs étrangers.":v>100?"C'est un flux modéré, cohérent avec une économie en développement.":"Ce flux relativement faible peut refléter un manque d'attractivité ou des conditions conjoncturelles défavorables."}`:`En ${k.annee}, les flux entrants sont négatifs (${fmt}), ce qui signifie que les investisseurs étrangers ont rapatrié plus de capital qu'ils n'en ont investi — un signal de désinvestissement.`;
    case "fs_last": return `En ${k.annee}, ${pays} a investi ${fmt} à l'étranger. ${v>0?v>500?"C'est un niveau élevé, indiquant que le pays est lui-même un exportateur significatif de capitaux.":"Cela reflète une capacité à investir au-delà des frontières, signe d'entreprises dynamiques.":"Un flux sortant négatif signifie un rapatriement de capitaux investis à l'étranger."}`;
    case "fn_last": return v>0?`Le flux net de ${fmt} est positif : ${pays} reçoit plus d'IDE qu'il n'en envoie. Le pays est en position d'attractivité nette.`:`Le flux net de ${fmt} est négatif : ${pays} exporte plus de capitaux qu'il n'en reçoit. Le pays investit davantage à l'étranger qu'il n'attire.`;
    case "se_last": return `Le stock d'IDE entrant est de ${fmt} en ${k.annee}. ${v>5000?"Ce stock élevé témoigne d'une présence importante et durable des investisseurs étrangers.":v>1000?"C'est un stock intermédiaire qui reflète une accumulation progressive des investissements étrangers.":"Ce stock encore limité indique que l'accumulation d'IDE reste à consolider."}`;
    case "ss_last": return `Le stock d'IDE sortant est de ${fmt} en ${k.annee}, représentant le cumul des investissements de ${pays} à l'étranger.`;
    case "sn_last": return v>0?`Avec un stock net de ${fmt}, ${pays} est un récepteur net d'IDE : il accueille plus de capital étranger qu'il n'en détient à l'étranger.`:`Avec un stock net négatif de ${fmt}, ${pays} possède davantage d'actifs à l'étranger qu'il n'en reçoit — profil atypique pour un pays en développement.`;
    case "g_fe": return v>0?`Les flux entrants ont augmenté de ${fmt} en ${k.annee} par rapport à l'année précédente. ${v>50?"Hausse très significative, probablement liée à un grand projet ou une réforme favorable.":v>20?"Croissance solide, signe d'une attractivité en amélioration.":"Légère progression positive."}`:`Les flux entrants ont baissé de ${fmt} en ${k.annee}. ${v<-50?"Chute sévère, probablement liée à une crise ou un retrait d'investisseurs majeurs.":v<-20?"Recul notable qui mérite attention.":"Légère contraction."}`;
    case "g_se": return v>0?`Le stock entrant a progressé de ${fmt}, confirmant l'accumulation continue d'IDE.`:`Le stock entrant a diminué de ${fmt}, ce qui peut indiquer des cessions ou dépréciations d'actifs étrangers.`;
    case "cagr_fe": return v>0?`Le CAGR de ${fmt} signifie qu'en moyenne, les flux entrants ont cru de ${fmt} par an sur la période. ${v>10?"C'est une croissance composée excellente.":v>5?"Croissance soutenue sur le long terme.":"Progression modeste mais régulière."}`:`Un CAGR négatif de ${fmt} indique une tendance à la baisse des flux entrants sur la période analysée.`;
    case "mom_fe": return v>0?`Sur les 5 dernières années, les flux entrants ont progressé de ${fmt}. La dynamique récente est positive.`:`Sur les 5 dernières années, les flux entrants ont reculé de ${fmt}. La tendance récente est préoccupante.`;
    case "moy_fe": return `La moyenne des flux entrants sur la période est de ${fmt} par an. C'est la valeur de référence pour évaluer si une année donnée est exceptionnelle ou en dessous de la normale.`;
    case "med_fe": return `La médiane des flux entrants est de ${fmt}. Elle est moins sensible aux valeurs extrêmes que la moyenne — si médiane < moyenne, cela suggère quelques grandes années tirent la moyenne vers le haut.`;
    case "max_fe": return `Le pic historique des flux entrants est de ${fmt}, atteint en ${k.annee}. Toute valeur récente proche de ce niveau est remarquable.`;
    case "min_fe": return `Le minimum historique est de ${fmt} en ${k.annee}. ${v<0?"Ce minimum négatif représente une phase de désinvestissement.":"C'est le plancher de référence pour contextualiser les flux faibles."}`;
    case "std_fe": return `L'écart-type de ${fmt} mesure la volatilité des flux entrants. ${v>500?"Forte variabilité — les flux sont très irréguliers d'une année à l'autre.":v>100?"Variabilité modérée.":"Flux relativement stables dans le temps."}`;
    case "trend_fe": return v>0?`La tendance linéaire de +${fmt}/an indique une progression structurelle des flux entrants sur la période. Le pays gagne en attractivité sur le long terme.`:`La tendance de ${fmt}/an révèle une érosion structurelle des flux entrants. Sans redressement, la trajectoire est préoccupante.`;
    case "accel_fe": return v>0?`L'accélération positive (${fmt}) montre que la 2e moitié de la période a été meilleure que la 1ère — la dynamique s'améliore.`:`L'accélération négative (${fmt}) indique que la tendance ralentit — la 2e moitié est moins bonne que la 1ère.`;
    case "tv5_fe": return v>0?`Sur 5 ans, le taux de croissance annuel des flux entrants est de ${fmt}. ${v>15?"Dynamique très forte.":v>5?"Croissance soutenue.":"Progression modeste."}`:`Taux de variation négatif sur 5 ans (${fmt}) — déclin récent des flux entrants.`;
    case "tv10_fe": return v>0?`Sur 10 ans, le taux annuel moyen est de ${fmt}. Cela confirme une trajectoire de fond ${v>10?"très positive":"positive"}.`:`Sur 10 ans, tendance négative (${fmt}). Déclin structurel sur la décennie.`;
    case "r_fe_fs": return v>1?`Avec un ratio de ${fmt}, ${pays} reçoit ${fmt} fois plus d'IDE qu'il n'en envoie. Position nette de récepteur.`:v<1?`Le ratio de ${fmt} indique que ${pays} investit davantage à l'étranger qu'il n'en reçoit — profil d'exportateur net de capitaux.`:`Équilibre parfait entre flux entrants et sortants.`;
    case "dist_max_fe": return v>=0?`Les flux entrants actuels sont au niveau de leur pic historique — performance maximale.`:`${Math.abs(v).toFixed(1)}% en dessous du pic historique. ${Math.abs(v)<20?"Proche du sommet.":Math.abs(v)<50?"Récupération partielle.":"Loin du pic — fort potentiel de rebond."}`;
    case "regularite_fe": return `${fmt} des années ont connu des flux entrants positifs. ${v>80?"Très grande régularité — le pays attire des IDE de manière continue.":v>60?"Bonne régularité malgré quelques années de désinvestissement.":"Flux entrants irréguliers — forte dépendance à des cycles ou projets ponctuels."}`;
    case "vs_moy_fe": return v>0?`La dernière valeur est ${fmt} au-dessus de la moyenne historique. Performance récente supérieure à la norme.`:`La dernière valeur est ${fmt} en dessous de la moyenne historique. Performance récente inférieure à la normale.`;
    case "n_pos_fe": return `Sur la période, ${fmt} années ont connu une croissance des flux entrants. ${+fmt>20?"Majorité d'années positives — trajectoire haussière dominante.":"Autant ou plus d'années de baisse que de hausse."}`;
    case "cur_streak_fe": return +fmt>0?`${pays} enchaîne actuellement ${fmt} année${+fmt>1?"s":""} consécutive${+fmt>1?"s":""} de croissance des flux entrants. ${+fmt>=5?"Série impressionnante — momentum fort.":+fmt>=3?"Dynamique positive en cours.":"Début d'un cycle haussier."}`:(`${pays} n'est pas en série de croissance actuellement. La dernière année a vu les flux baisser.`);
    default: return `Cet indicateur mesure : ${k.description}`;
  }
}

// ── Mini modal KPI ────────────────────────────────────────────────────────────
function MiniModalKpi({ kpi, pays, couleur, onClose }: { kpi: KpiResult|null; pays: string; couleur: string; onClose: ()=>void }) {
  if (!kpi) return null;
  const interp = interpreterKpi(kpi, pays, couleur);
  const isPos = kpi.valeur !== null && kpi.valeur > 0;
  const isNeg = kpi.valeur !== null && kpi.valeur < 0;
  const signalColor = ["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe"].includes(kpi.id)
    ? (isPos?"#188038":isNeg?"#dc2626":"#9aa5b4") : couleur;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:16, width:"100%", maxWidth:480, border:"1px solid #E8E5E3", boxShadow:"0 24px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ height:3, background:`linear-gradient(90deg,${signalColor},${signalColor}88)`, borderRadius:"16px 16px 0 0" }} />
        <div style={{ padding:"20px 22px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div style={{ flex:1, paddingRight:12 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:5 }}>{kpi.label}</p>
              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                <p style={{ fontSize:"2rem", fontWeight:800, color:signalColor, lineHeight:1 }}>{fmtKpi(kpi)}</p>
                {kpi.annee && <p style={{ fontSize:12, color:"#9aa5b4" }}>en {kpi.annee}</p>}
              </div>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:7, padding:6, flexShrink:0 }}><X size={13} color="#4a5568"/></button>
          </div>
          <div style={{ background:isPos?"rgba(24,128,56,0.05)":isNeg?"rgba(220,38,38,0.05)":"rgba(0,0,0,0.03)", border:`1px solid ${isPos?"rgba(24,128,56,0.15)":isNeg?"rgba(220,38,38,0.15)":"#E8E5E3"}`, borderLeft:`3px solid ${signalColor}`, borderRadius:"0 10px 10px 0", padding:"12px 16px", marginBottom:12 }}>
            <p style={{ fontSize:13, color:"#1a1a2e", lineHeight:1.7 }}>{interp}</p>
          </div>
          <p style={{ fontSize:11, color:"#9aa5b4", lineHeight:1.6 }}>{kpi.description}</p>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Pays — analyse individuelle ────────────────────────────────────────
function OngletPays({ paysDispo }: { paysDispo: any[] }) {
  const [paysSelec,   setPaysSelec]   = useState<string>("Sénégal");
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [anneeMin,    setAnneeMin]    = useState(1990);
  const [anneeMax,    setAnneeMax]    = useState(2024);
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  const [showTable,   setShowTable]   = useState(false);
  const [kpisOrdre,   setKpisOrdre]   = useState<string[]>(KPI_25_IDS);
  const [kpisEpingles,setKpisEpingles]= useState<string[]>(KPI_DEFAUT); // max 5
  const [kpiActif,    setKpiActif]    = useState<KpiResult|null>(null);
  const [dragIdx,     setDragIdx]     = useState<number|null>(null);
  const [dragOver,    setDragOver]    = useState<number|null>(null);

  const couleur = getPaysColor(paysSelec, 0);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pays_list: paysSelec });
      if (modeAnnees==="specifiques" && anneesSpec.length>0) params.set("annees", anneesSpec.join(","));
      else { params.set("annee_min", String(anneeMin)); params.set("annee_max", String(anneeMax)); }
      const dataR = await fetch(`${API}/ide/cnuced?${params}`).then(r=>r.json());
      setDonnees(dataR||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [paysSelec, anneeMin, anneeMax, anneesSpec, modeAnnees]);

  useEffect(() => { charger(); }, [charger]);

  const tousKpis    = calculerKpis(donnees);
  // Sidebar : liste complète dans l'ordre choisi
  const kpisSidebar = kpisOrdre.map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];
  // Cards : seulement les épinglés (max 5)
  const kpisCards   = kpisEpingles.map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];

  const toggleEpingle = (id: string) => {
    setKpisEpingles(prev => {
      if (prev.includes(id)) return prev.filter(k=>k!==id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  // Drag & drop handlers
  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const handleDrop      = (i: number) => {
    if (dragIdx===null||dragIdx===i) return;
    const next=[...kpisOrdre];
    const [moved]=next.splice(dragIdx,1);
    next.splice(i,0,moved);
    setKpisOrdre(next);
    setDragIdx(null); setDragOver(null);
  };
  const handleDragEnd   = () => { setDragIdx(null); setDragOver(null); };

  const buildSerie = (dir: string, ind: string) => [{
    nom: paysSelec, couleur,
    data: donnees.filter(d=>d.direction===dir && d.indicateur===ind)
  }];

  const GRAPHES_PAYS = [
    { id:"fe", titre:"Flux entrants",       series: buildSerie("entrant","flux") },
    { id:"fs", titre:"Flux sortants",       series: buildSerie("sortant","flux") },
    { id:"se", titre:"Stock entrant",       series: buildSerie("entrant","stock") },
    { id:"ss", titre:"Stock sortant",       series: buildSerie("sortant","stock") },
    { id:"vs", titre:"Flux ent. vs sort.",  series: [
      { nom:`${paysSelec} — entrants`, couleur, data: donnees.filter(d=>d.direction==="entrant"&&d.indicateur==="flux") },
      { nom:`${paysSelec} — sortants`, couleur:couleur+"88", data: donnees.filter(d=>d.direction==="sortant"&&d.indicateur==="flux") },
    ]},
  ];

  // Indicatif grisé sous la valeur
  const getIndicatif = (k: KpiResult): string | null => {
    if (k.annee) return `en ${k.annee}`;
    if (k.id.includes("vs_moy")) return "vs moyenne hist.";
    if (k.id.includes("5_fe")||k.id.includes("5_fs")) return "5 dernières années";
    if (k.id.includes("10_fe")||k.id.includes("10_fs")) return "10 dernières années";
    if (k.id.includes("cagr")) return "période complète";
    if (k.id.includes("mom")) return "5 ans glissants";
    if (k.id.includes("n_pos")||k.id.includes("cur_streak")) return "sur la période";
    if (k.id.includes("dist_max")) return "vs pic historique";
    if (k.id.includes("regularite")) return "% années positives";
    return null;
  };

  return (
    <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 40px 80px", display:"flex", gap:24, alignItems:"flex-start" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div style={{ width:280, flexShrink:0, position:"sticky" as const, top:24 }}>
        <div style={{ background:"#FAFAF9", borderRadius:16, border:"1px solid #E8E5E3", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>

          {/* Header */}
          <div style={{ padding:"14px 20px", borderBottom:"1px solid #E8E5E3", background:"#fff", display:"flex", alignItems:"center", gap:8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span style={{ fontSize:13, fontWeight:700, color:"#1a1a2e" }}>Filtres</span>
          </div>

          {/* Section Pays */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #E8E5E3", background:"#fff" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:10 }}>Pays</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:4 }}>
              {[...paysDispo].sort((a,b)=>{ if(a.nom==="Sénégal") return -1; if(b.nom==="Sénégal") return 1; return a.nom.localeCompare(b.nom,"fr"); }).map(p=>{
                const sel=paysSelec===p.nom, col=getPaysColor(p.nom, paysDispo.indexOf(p));
                return (
                  <button key={p.nom} onClick={()=>setPaysSelec(p.nom)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:9, border:`1.5px solid ${sel?col+"40":"#E8E5E3"}`, background:sel?`${col}09`:"transparent", cursor:"pointer", textAlign:"left" as const, transition:"all 0.12s", width:"100%" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:sel?col:"#C5BFBB", flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:sel?700:400, color:sel?col:"#4a5568" }}>{p.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Période */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #E8E5E3", background:"#fff" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12 }}>Période</p>
            <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:14 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#1a1a2e" }}>{anneeMin}</span>
                  <span style={{ fontSize:11, color:"#C5BFBB" }}>→</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#1a1a2e" }}>{anneeMax}</span>
                </div>
                <input type="range" min={1990} max={2024} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))} style={{ width:"100%", accentColor:"#1a1a2e" }} />
                <input type="range" min={1990} max={2024} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))} style={{ width:"100%", accentColor:"#1a1a2e" }} />
                <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                  {Array.from({length:35},(_,i)=>1990+i).map(a=>{
                    const sel=anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"transparent":"#E8E5E3"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#1a1a2e":"#F8F7F6", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"#4a5568" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                  {anneesSpec.length>0&&<button onClick={()=>setAnneesSpec([])} style={{ fontSize:11, color:"#9aa5b4", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>

          {/* Section KPIs */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #E8E5E3", background:"#fff" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>KPIs</p>
              <span style={{ fontSize:11, fontWeight:600, color:kpisEpingles.length>=5?"#ca631f":"#9aa5b4", background:kpisEpingles.length>=5?"rgba(202,99,31,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{kpisEpingles.length}/5</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:1, maxHeight:280, overflowY:"auto" as const }}>
              {kpisSidebar.map((k,i)=>{
                const epingle = kpisEpingles.includes(k.id);
                const disabled = !epingle && kpisEpingles.length >= 5;
                const isDragging = dragIdx===i;
                const isOver = dragOver===i;
                return (
                  <div key={k.id}
                    draggable
                    onDragStart={()=>handleDragStart(i)}
                    onDragOver={e=>handleDragOver(e,i)}
                    onDrop={()=>handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    title={k.description}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 10px", borderRadius:8, background:isOver?"rgba(202,99,31,0.05)":epingle?"rgba(202,99,31,0.04)":"transparent", cursor:"grab", opacity:isDragging?0.3:disabled?0.3:1, transition:"background 0.1s", userSelect:"none" as const }}
                    onMouseEnter={ev=>{ if(!isDragging) ev.currentTarget.style.background = epingle?"rgba(202,99,31,0.07)":"#F8F7F6"; }}
                    onMouseLeave={ev=>{ ev.currentTarget.style.background = epingle?"rgba(202,99,31,0.04)":"transparent"; }}>
                    <span style={{ fontSize:12, color:epingle?"#1a1a2e":"#6b7280", flex:1, lineHeight:1.35, fontWeight:epingle?500:400 }}>{k.label}</span>
                    <button
                      onClick={ev=>{ ev.stopPropagation(); !disabled && toggleEpingle(k.id); }}
                      style={{ flexShrink:0, width:17, height:17, borderRadius:4, border:`1.5px solid ${epingle?"#ca631f":"#D1D5DB"}`, background:epingle?"#ca631f":"transparent", cursor:disabled?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
                      {epingle && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize:10, color:"#C5BFBB", marginTop:8, lineHeight:1.5 }}>Cochez jusqu'à 5 · glissez pour réorganiser</p>
          </div>

          {/* Appliquer */}
          <div style={{ padding:"14px 20px", background:"#FAFAF9" }}>
            <button onClick={charger}
              style={{ width:"100%", padding:"10px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#1a1a2e,#2d2d4e)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
              Appliquer
            </button>
          </div>
        </div>
      </div>

      {/* ── Zone principale ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, minWidth:0, minHeight:"80vh" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:couleur }} />
            <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e" }}>{paysSelec}</h2>
            <span style={{ fontSize:12, color:"#9aa5b4" }}>
              · {modeAnnees==="specifiques"&&anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}` : `${anneeMin}–${anneeMax}`}
            </span>
          </div>
          <button onClick={()=>setShowTable(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:999, border:"1.5px solid #E8E5E3", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:12, transition:"all 0.15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="#1a1a2e"; e.currentTarget.style.color="#1a1a2e"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E8E5E3"; e.currentTarget.style.color="#4a5568"; }}>
            <Table size={12}/> Prévisualiser les données
          </button>
        </div>

        {/* KPI cards — 5 max */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
          {kpisCards.map(k=>{
            const indicatif = getIndicatif(k);
            const isPos = k.valeur!==null&&["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe","fn_last","sn_last","dist_max_fe"].includes(k.id)&&k.valeur>0;
            const isNeg = k.valeur!==null&&["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe","fn_last","sn_last","dist_max_fe"].includes(k.id)&&k.valeur<0;
            const cardColor = isPos?"#188038":isNeg?"#dc2626":couleur;
            return (
              <div key={k.id} onClick={()=>setKpiActif(k)}
                style={{ background:"#fff", borderRadius:12, padding:"13px 14px", border:"1px solid #E8E5E3", borderTop:`3px solid ${cardColor}`, cursor:"pointer", transition:"all 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; }}>
                <p style={{ fontSize:9, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.07em", marginBottom:6, lineHeight:1.4 }}>{k.label}</p>
                <p style={{ fontSize:"1.1rem", fontWeight:800, color:cardColor, lineHeight:1 }}>{fmtKpi(k)}</p>
                {indicatif && <p style={{ fontSize:10, color:"#C5BFBB", marginTop:4, lineHeight:1 }}>{indicatif}</p>}
              </div>
            );
          })}
          {Array.from({length:Math.max(0,5-kpisCards.length)}).map((_,i)=>(
            <div key={`empty-${i}`}
              style={{ background:"#FAFAF9", borderRadius:12, padding:"13px 14px", border:"1.5px dashed #E8E5E3", display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90 }}>
              <span style={{ fontSize:20, color:"#C5BFBB", lineHeight:1 }}>+</span>
              <span style={{ fontSize:10, color:"#C5BFBB", textAlign:"center" as const, lineHeight:1.5 }}>Choisir dans<br/>le filtre</span>
            </div>
          ))}
        </div>

        {/* Graphes */}
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
            <div style={{ width:28, height:28, border:"2.5px solid #188038", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES_PAYS.map(g=>(
              <GrapheCard key={g.id} titre={g.titre} sous_titre={`M$ USD · CNUCED · ${anneeMin}–${anneeMax}`} series={g.series} grapheId={g.id}
                fullChildren={<GrapheMultiPays series={g.series} height={340} type="line" titre={g.id}/>}>
                <GrapheMultiPays series={g.series} height={145} type="line" titre={g.id}/>
              </GrapheCard>
            ))}
          </div>
        )}
      </div>

      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={[{nom:paysSelec,couleur}]} />
      <MiniModalKpi kpi={kpiActif} pays={paysSelec} couleur={couleur} onClose={()=>setKpiActif(null)} />
    </div>
  );
}

// ── Onglet Analyse comparative ────────────────────────────────────────────────
function OngletAnalyseComparative({ paysDispo }: { paysDispo: any[] }) {
  const [paysSelec,   setPaysSelec]   = useState<string[]>(["Sénégal"]);
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [anneeMin,    setAnneeMin]    = useState(1990);
  const [anneeMax,    setAnneeMax]    = useState(2024);
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [typeG,       setTypeG]       = useState<"line"|"bar">("line");
  const [showTable,   setShowTable]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const charger = useCallback(async () => {
    if (!paysSelec.length) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pays_list", paysSelec.join(","));
      if (modeAnnees==="specifiques" && anneesSpec.length>0) params.set("annees", anneesSpec.join(","));
      else { params.set("annee_min", String(anneeMin)); params.set("annee_max", String(anneeMax)); }
      const dataR = await fetch(`${API}/ide/cnuced?${params}`).then(r=>r.json());
      setDonnees(dataR||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [paysSelec, anneeMin, anneeMax, anneesSpec, modeAnnees]);

  useEffect(() => { charger(); }, [charger]);

  const paysAvecCouleur = paysSelec.map((nom,i) => ({ nom, couleur: getPaysColor(nom, i) }));

  const buildSeries = (dir: string, ind: string) =>
    paysAvecCouleur.map(p=>({ nom:p.nom, couleur:p.couleur, data:donnees.filter(d=>d.pays===p.nom&&d.direction===dir&&d.indicateur===ind) }));

  const GRAPHES = [
    { id:"fe", titre:"Flux d'IDE entrants",     series: buildSeries("entrant","flux") },
    { id:"fs", titre:"Flux d'IDE sortants",      series: buildSeries("sortant","flux") },
    { id:"se", titre:"Stock d'IDE entrant",      series: buildSeries("entrant","stock") },
    { id:"ss", titre:"Stock d'IDE sortant",      series: buildSeries("sortant","stock") },
    { id:"vs", titre:"Flux entrants vs sortants", series: [
      ...paysAvecCouleur.map(p=>({ nom:`${p.nom} — ent.`, couleur:p.couleur, data:donnees.filter(d=>d.pays===p.nom&&d.direction==="entrant"&&d.indicateur==="flux") })),
      ...paysAvecCouleur.map(p=>({ nom:`${p.nom} — sort.`, couleur:p.couleur+"88", data:donnees.filter(d=>d.pays===p.nom&&d.direction==="sortant"&&d.indicateur==="flux") })),
    ]},
  ];

  return (
    <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 40px 80px", display:"flex", gap:24, alignItems:"flex-start" }}>

      {/* Sidebar */}
      <div style={{ width:sidebarOpen?270:48, flexShrink:0, transition:"width 0.2s", position:"sticky" as const, top:24 }}>
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E8E5E3", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #F2F0EF", background:"#FAFAF9" }}>
            {sidebarOpen && <span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", display:"flex", alignItems:"center", gap:6 }}><Filter size={13} style={{color:"#188038"}}/>Filtres</span>}
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, marginLeft:"auto" }}>
              <BarChart2 size={16} style={{ color:"#9aa5b4" }} />
            </button>
          </div>
          {sidebarOpen && (
            <div style={{ padding:"16px", display:"flex", flexDirection:"column" as const, gap:18 }}>

              {/* Pays — multi-select */}
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:10 }}>Pays</p>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:4 }}>
                  {[...paysDispo].sort((a,b)=>{ if(a.nom==="Sénégal") return -1; if(b.nom==="Sénégal") return 1; return a.nom.localeCompare(b.nom,"fr"); }).map(p => {
                    const sel = paysSelec.includes(p.nom);
                    const col = getPaysColor(p.nom, paysDispo.indexOf(p));
                    return (
                      <label key={p.nom} style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", padding:"7px 10px", borderRadius:9, background:sel?`${col}0d`:"transparent", border:`1px solid ${sel?`${col}30`:"transparent"}`, transition:"all 0.12s" }}>
                        <input type="checkbox" checked={sel}
                          onChange={e=>{ if(!e.target.checked&&paysSelec.length<=1) return; if(e.target.checked) setPaysSelec(prev=>[...prev,p.nom]); else setPaysSelec(prev=>prev.filter(n=>n!==p.nom)); }}
                          style={{ accentColor:col, width:14, height:14, flexShrink:0 }} />
                        {sel && <div style={{ width:8, height:8, borderRadius:"50%", background:col, flexShrink:0 }} />}
                        <span style={{ fontSize:13, fontWeight:sel?600:400, color:sel?col:"#4a5568" }}>{p.nom}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Type graphe */}
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Type de graphe</p>
                <div style={{ display:"flex", gap:4, background:"#F2F0EF", borderRadius:10, padding:3 }}>
                  {[{v:"line",l:"Courbes"},{v:"bar",l:"Barres"}].map(t=>(
                    <button key={t.v} onClick={()=>setTypeG(t.v as "line"|"bar")}
                      style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:typeG===t.v?"#fff":"transparent", color:typeG===t.v?"#1a1a2e":"#9aa5b4", boxShadow:typeG===t.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Période */}
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Période</p>
                <div style={{ display:"flex", gap:4, background:"#F2F0EF", borderRadius:10, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:6 }}>
                    <div>
                      <label style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", display:"block", marginBottom:4, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>De</label>
                      <input type="number" min={1990} max={anneeMax-1} value={anneeMin} onChange={e=>setAnneeMin(Math.max(1990,Math.min(+e.target.value,anneeMax-1)))}
                        style={{ width:"100%", background:"#F2F0EF", border:"1px solid #E8E5E3", borderRadius:8, padding:"8px 10px", fontSize:13, fontWeight:600, color:"#1a1a2e", outline:"none", textAlign:"center" as const, boxSizing:"border-box" as const }} />
                    </div>
                    <span style={{ fontSize:14, color:"#C5BFBB", paddingTop:18 }}>→</span>
                    <div>
                      <label style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", display:"block", marginBottom:4, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>À</label>
                      <input type="number" min={anneeMin+1} max={2024} value={anneeMax} onChange={e=>setAnneeMax(Math.min(2024,Math.max(+e.target.value,anneeMin+1)))}
                        style={{ width:"100%", background:"#F2F0EF", border:"1px solid #E8E5E3", borderRadius:8, padding:"8px 10px", fontSize:13, fontWeight:600, color:"#1a1a2e", outline:"none", textAlign:"center" as const, boxSizing:"border-box" as const }} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:4, marginBottom:8 }}>
                      {Array.from({length:35},(_,i)=>1990+i).map(a=>{
                        const sel=anneesSpec.includes(a);
                        return (
                          <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                            style={{ padding:"5px 0", borderRadius:6, border:`1px solid ${sel?"transparent":"#E8E5E3"}`, cursor:"pointer", fontSize:11, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#1a1a2e":"#fff", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, color:anneesSpec.length>0?"#4a5568":"#9aa5b4" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                      {anneesSpec.length>0 && <button onClick={()=>setAnneesSpec([])} style={{ fontSize:11, color:"#9aa5b4", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={charger}
                style={{ padding:"10px 0", borderRadius:10, border:"none", background:"#1a1a2e", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                Appliquer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zone graphes */}
      <div style={{ flex:1, minWidth:0, minHeight:"80vh" }}>
        {/* Badges pays + bouton données */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:16, flexWrap:"wrap" as const }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
            <span style={{ fontSize:12, color:"#9aa5b4" }}>Comparaison :</span>
            {paysAvecCouleur.map(p=>(
              <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:6, background:`${p.couleur}12`, border:`1.5px solid ${p.couleur}35`, borderRadius:999, padding:"4px 14px" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:p.couleur }} />
                <span style={{ fontSize:12, fontWeight:700, color:p.couleur }}>{p.nom}</span>
              </div>
            ))}
            <span style={{ fontSize:12, color:"#9aa5b4" }}>· {modeAnnees==="plage"?`${anneeMin}–${anneeMax}`:anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
          </div>
          <button onClick={()=>setShowTable(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:999, border:"1.5px solid #E8E5E3", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:12, flexShrink:0 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="#1a1a2e"; e.currentTarget.style.color="#1a1a2e"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E8E5E3"; e.currentTarget.style.color="#4a5568"; }}>
            <Table size={12}/> Prévisualiser les données
          </button>
        </div>

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
            <div style={{ width:28, height:28, border:"2.5px solid #188038", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              {GRAPHES.map(g=>(
                <GrapheCard key={g.id} titre={g.titre} sous_titre="M$ USD · Source CNUCED" series={g.series} grapheId={g.id}
                  fullChildren={<GrapheMultiPays series={g.series} height={340} type={typeG} titre={g.id}/>}>
                  <GrapheMultiPays series={g.series} height={145} type={typeG} titre={g.id}/>
                </GrapheCard>
              ))}
            </div>
          </>
        )}
      </div>
      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={paysAvecCouleur} />
    </div>
  );
}

// ── Onglet Monde ──────────────────────────────────────────────────────────────
function OngletMonde() {
  return (
    <div style={{ maxWidth:1400, margin:"0 auto", padding:"80px 40px", textAlign:"center" as const }}>
      <div style={{ display:"inline-flex", flexDirection:"column" as const, alignItems:"center", gap:16 }}>
        <div style={{ width:64, height:64, borderRadius:16, background:"rgba(24,128,56,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:32 }}>🌍</span>
        </div>
        <h2 style={{ fontWeight:800, fontSize:"1.4rem", color:"#1a1a2e" }}>Données mondiales</h2>
        <p style={{ fontSize:14, color:"#9aa5b4", maxWidth:420, lineHeight:1.7 }}>
          Cette section affichera des KPIs et graphes globaux sur les IDE mondiaux une fois que suffisamment de pays auront été importés.
        </p>
        <div style={{ background:"rgba(24,128,56,0.07)", border:"1px solid rgba(24,128,56,0.2)", borderRadius:10, padding:"10px 20px" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#188038" }}>Disponible prochainement</span>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  const [source,    setSource]    = useState("cnuced");
  const [sousOnglet,setSousOnglet]= useState("pays");
  const [paysDispo, setPaysDispo] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/ide/cnuced/pays-disponibles`).then(r=>r.json()).then(d=>setPaysDispo(d||[])).catch(()=>{});
  }, []);

  return (
    <main style={{ minHeight:"100vh", background:"#F2F0EF", fontFamily:"var(--font-google-sans)" }}>
      <div id="d3-tooltip" style={{ position:"fixed", pointerEvents:"none", background:"rgba(26,26,46,0.92)", color:"#fff", borderRadius:8, padding:"8px 12px", fontSize:12, lineHeight:1.5, opacity:0, zIndex:9999, backdropFilter:"blur(4px)" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* ── Header avec onglets sources ─────────────────────────────────────── */}
      <section style={{ paddingTop:80, background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"32px 40px 0" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(24,128,56,0.15)", border:"1px solid rgba(24,128,56,0.3)", borderRadius:999, padding:"5px 14px", marginBottom:14 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#4ade80", letterSpacing:"0.15em", textTransform:"uppercase" as const }}>Données officielles</span>
          </div>
          <h1 style={{ fontWeight:800, fontSize:"clamp(1.8rem,4vw,2.8rem)", color:"#fff", lineHeight:1.1, marginBottom:10 }}>Investissements Directs Étrangers</h1>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, maxWidth:520, lineHeight:1.7, marginBottom:28 }}>
            Analysez les flux et stocks d'IDE par pays, comparez les économies et explorez les tendances mondiales.
          </p>

          {/* Onglets sources — dans le hero, style intégré */}
          <div style={{ display:"flex", gap:2 }}>
            {[{v:"cnuced",l:"CNUCED"},{v:"fdi_markets",l:"FDI Markets"}].map(o=>(
              <button key={o.v} onClick={()=>{ setSource(o.v); setSousOnglet("pays"); }}
                style={{ padding:"11px 22px", border:"none", borderRadius:"10px 10px 0 0", cursor:"pointer", fontSize:14, fontWeight:source===o.v?700:500,
                  background:source===o.v?"#F2F0EF":  "rgba(255,255,255,0.1)",
                  color:source===o.v?"#1a1a2e":"rgba(255,255,255,0.6)",
                  transition:"all 0.15s" }}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sous-onglets (si CNUCED) ─────────────────────────────────────────── */}
      {source === "cnuced" && (
        <div style={{ background:"#fff", borderBottom:"1px solid #E8E5E3" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 40px", display:"flex" }}>
            {[{v:"pays",l:"Pays"},{v:"comparative",l:"Analyse comparative"},{v:"monde",l:"Monde"}].map(o=>(
              <button key={o.v} onClick={()=>setSousOnglet(o.v)}
                style={{ padding:"14px 20px", border:"none", borderBottom:`3px solid ${sousOnglet===o.v?"#188038":"transparent"}`, background:"transparent", fontSize:13, fontWeight:sousOnglet===o.v?700:500, color:sousOnglet===o.v?"#188038":"#9aa5b4", cursor:"pointer", transition:"all 0.15s" }}>
                {o.l}
                {o.v==="monde" && <span style={{ marginLeft:6, fontSize:10, fontWeight:600, color:"#9aa5b4", background:"#F2F0EF", padding:"1px 6px", borderRadius:999 }}>Bientôt</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
      {source === "cnuced" ? (
        <>
          {sousOnglet === "pays"        && <OngletPays paysDispo={paysDispo} />}
          {sousOnglet === "comparative" && <OngletAnalyseComparative paysDispo={paysDispo} />}
          {sousOnglet === "monde"       && <OngletMonde />}
        </>
      ) : (
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"80px 40px", textAlign:"center" as const }}>
          <div style={{ display:"inline-flex", flexDirection:"column" as const, alignItems:"center", gap:16 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:"rgba(0,79,145,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:32 }}>📈</span>
            </div>
            <h2 style={{ fontWeight:800, fontSize:"1.4rem", color:"#1a1a2e" }}>FDI Markets</h2>
            <p style={{ fontSize:14, color:"#9aa5b4", maxWidth:380, lineHeight:1.7 }}>Les données FDI Markets seront disponibles prochainement.</p>
            <div style={{ background:"rgba(0,79,145,0.07)", border:"1px solid rgba(0,79,145,0.2)", borderRadius:10, padding:"10px 20px" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Disponible prochainement</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
