"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { X, Maximize2, Table, ChevronDown, ChevronUp, ChevronRight, SlidersHorizontal, Search, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { calculerKpis, fmtKpi, KPI_DEFAUT, type KpiResult } from "@/lib/ideKpis";
import { SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";

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

function downloadPNG(svgEl: SVGSVGElement, filename: string, opts?: { titre?: string; annees?: string; legende?: { nom: string; couleur: string }[] }) {
  const SCALE = 3; // suréchantillonnage : rendu net, identique au modal
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || 400;
  // Dimensions explicites en pixels : sans elles le navigateur rastérise le SVG
  // à une taille par défaut puis l'agrandit, d'où une image floue.
  clone.removeAttribute("style");
  clone.setAttribute("width",  String(W * SCALE));
  clone.setAttribute("height", String(H * SCALE));
  clone.setAttribute("font-family", "'Google Sans','Product Sans',Arial,sans-serif");
  const blob = new Blob([clone.outerHTML], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  img.onload = () => {
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
      // Badge d'années (réserve sa place à droite du titre)
      ctx.font = `700 11px ${FONT}`;
      const badgeW = annees ? Math.ceil(ctx.measureText(annees).width) + 20 : 0;
      // Titre, tronqué si besoin
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
      // Légende en pilules teintées, comme dans le modal
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
  };
  img.src = url;
}

// ── Tooltip D3 : coordonnées viewport (le tooltip est en position:fixed) et
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

// ── Graphe D3 multi-pays ──────────────────────────────────────────────────────
function GrapheMultiPays({ series, height=280, type="line", titre="", fmt, showDots=true, lineWidth }: {
  series: {nom:string; couleur:string; data:{annee:number;valeur:number|null}[]}[];
  height?: number;
  type?:   "line"|"bar";
  titre?:  string;
  fmt?:    (v:number|null)=>string;
  showDots?: boolean;
  lineWidth?: number;
}) {
  const ref    = useRef<SVGSVGElement>(null);
  const wrapRef= useRef<HTMLDivElement>(null);
  const fmtV   = fmt || fmtVal;

  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!series.length) return;
    const W  = el.parentElement?.clientWidth || el.clientWidth || 700;
    const H  = height;

    const allData = series.flatMap(s => s.data.filter(d => d.valeur !== null) as {annee:number;valeur:number}[]);
    if (!allData.length) return;

    // ── Détection double axe (courbes multi-séries à magnitudes très différentes)
    const serieRanges = series.map(s => {
      const vals = s.data.filter(d=>d.valeur!==null).map(d=>d.valeur as number);
      const mn = d3.min(vals) ?? 0;
      const mx = d3.max(vals) ?? 1;
      return { mn, mx, span: mx - mn };
    });
    const spanRatio = Math.max(...serieRanges.map(r=>r.span)) / Math.max(1, Math.min(...serieRanges.map(r=>r.span)));
    const useDual = type === "line" && series.length >= 2 && spanRatio > 4;

    const M = { top:12, right: useDual ? 58 : 20, bottom:34, left:64 };
    const svg = d3.select(el).attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");

    const allAnnees = [...new Set(allData.map(d=>d.annee))].sort();

    // ── Construction des échelles Y (une par série si dual, sinon partagée)
    const buildScale = (mn: number, mx: number, forBar: boolean) => {
      const pad = (mx - mn) * 0.08;
      const lo = forBar ? Math.min(0, mn) : mn - pad;
      return d3.scaleLinear().domain([lo, mx * 1.08]).nice().range([H-M.bottom, M.top]);
    };
    const yScales = useDual
      ? series.map((_,i) => buildScale(serieRanges[i].mn, serieRanges[i].mx, false))
      : (() => {
          const rawMin = d3.min(allData,d=>d.valeur)!;
          const maxVal = d3.max(allData,d=>d.valeur)!;
          const shared = buildScale(rawMin, maxVal, type === "bar");
          return series.map(() => shared);
        })();
    const y = yScales[0]; // échelle principale (axe gauche, grille)

    const xBand = d3.scaleBand().domain(allAnnees.map(String)).range([M.left,W-M.right]).padding(0.18);
    const xLin  = d3.scaleLinear().domain([allAnnees[0], allAnnees[allAnnees.length-1]]).range([M.left,W-M.right]);

    // Grille horizontale (basée sur l'échelle principale)
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1",M.left).attr("x2",W-M.right).attr("y1",d=>y(d)).attr("y2",d=>y(d))
      .attr("stroke","#EBEBEB").attr("stroke-width",1);

    if (y.domain()[0] < 0)
      svg.append("line").attr("x1",M.left).attr("x2",W-M.right).attr("y1",y(0)).attr("y2",y(0))
        .attr("stroke","#C5BFBB").attr("stroke-width",1.2).attr("stroke-dasharray","4,3");

    const tooltip = d3.select("#d3-tooltip") as any;
    const fmtAxis = (v: d3.NumberValue) => {
      const n = +v; const a = Math.abs(n);
      return a>=1e9?`${(n/1e9).toFixed(1)}Md`:a>=1e6?`${(n/1e6).toFixed(0)}M`:`${n.toFixed(0)}`;
    };

    // ── BARRES ────────────────────────────────────────────────────────────────
    if (type === "bar") {
      const nbSeries = series.length;
      const xGroup   = nbSeries > 1
        ? d3.scaleBand().domain(series.map(s=>s.nom)).range([0,xBand.bandwidth()]).padding(0.06)
        : null;

      series.forEach((s,si) => {
        const ys = yScales[si];
        const valid = s.data.filter(d=>d.valeur!==null) as {annee:number;valeur:number}[];
        if (!valid.length) return;
        const getX = (d:{annee:number}) => { const base=xBand(String(d.annee))!; return xGroup?base+xGroup(s.nom)!:base; };
        const getW = () => xGroup?xGroup.bandwidth():xBand.bandwidth();
        svg.selectAll(`.b${s.nom.replace(/\W/g,"")}`)
          .data(valid).enter().append("rect")
          .attr("x",d=>getX(d)).attr("width",getW())
          .attr("y",d=>d.valeur>=0?ys(d.valeur):ys(0))
          .attr("height",d=>Math.abs(ys(d.valeur)-ys(0)))
          .attr("fill",s.couleur).attr("rx",3).style("cursor","pointer")
          .on("mouseover",(e,d)=>{
            d3.select(e.currentTarget as SVGRectElement).attr("opacity",0.75);
            showD3Tooltip(tooltip, e, `<strong>${d.annee}${nbSeries>1?" — "+s.nom:""}</strong><br/>${fmtV(d.valeur)}`);
          })
          .on("mousemove",(e)=>showD3Tooltip(tooltip, e))
          .on("mouseout",(e)=>{ d3.select(e.currentTarget as SVGRectElement).attr("opacity",1); hideD3Tooltip(tooltip); });
      });

      const maxTicks = Math.floor((W - M.left - M.right) / 28);
      const step = Math.ceil(allAnnees.length / maxTicks);
      const tickVals = allAnnees.filter((_,i)=>i%step===0).map(String);
      svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
        .call(d3.axisBottom(xBand).tickValues(tickVals).tickSizeOuter(0))
        .call(g=>g.select(".domain").attr("stroke","#E8E5E3"))
        .call(g=>g.selectAll("line").remove())
        .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));

    // ── COURBES ───────────────────────────────────────────────────────────────
    } else {
      series.forEach((s,si) => {
        const ys = yScales[si];
        const valid = s.data.filter(d=>d.valeur!==null) as {annee:number;valeur:number}[];
        if (!valid.length) return;

        const areaBase = ys(Math.max(ys.domain()[0], 0));
        const gid = `g${s.nom.replace(/\W/g,"")}`;
        const defs = svg.append("defs");
        const grad = defs.append("linearGradient").attr("id",gid).attr("x1","0").attr("x2","0").attr("y1","0").attr("y2","1");
        grad.append("stop").attr("offset","0%").attr("stop-color",s.couleur).attr("stop-opacity",0.1);
        grad.append("stop").attr("offset","100%").attr("stop-color",s.couleur).attr("stop-opacity",0);

        svg.append("path").datum(valid).attr("fill",`url(#${gid})`)
          .attr("d",d3.area<{annee:number;valeur:number}>().x(d=>xLin(d.annee)).y0(areaBase).y1(d=>ys(d.valeur)).curve(d3.curveMonotoneX));

        svg.append("path").datum(valid).attr("fill","none").attr("stroke",s.couleur).attr("stroke-width",lineWidth ?? 2.2)
          .attr("d",d3.line<{annee:number;valeur:number}>().x(d=>xLin(d.annee)).y(d=>ys(d.valeur)).curve(d3.curveMonotoneX));

        const nb = valid.length;
        const rBase = nb > 25 ? 0 : nb > 18 ? 1.5 : nb > 10 ? 2 : 2.5;
        // Points visibles (décoratifs : les événements passent par les cibles invisibles)
        let dots: any = null;
        if (showDots && rBase > 0) {
          dots = svg.selectAll(`.p${s.nom.replace(/\W/g,"")}`)
            .data(valid).enter().append("circle")
            .attr("cx",d=>xLin(d.annee)).attr("cy",d=>ys(d.valeur)).attr("r",rBase)
            .attr("fill","#fff").attr("stroke",s.couleur).attr("stroke-width",1.5)
            .style("pointer-events","none");
        }
        // Larges cibles de survol invisibles : le tooltip se déclenche à coup sûr
        svg.selectAll(`.ph${s.nom.replace(/\W/g,"")}`)
          .data(valid).enter().append("circle")
          .attr("cx",d=>xLin(d.annee)).attr("cy",d=>ys(d.valeur)).attr("r",Math.max(10, rBase+6))
          .attr("fill","transparent").attr("stroke","none").style("cursor","pointer")
          .on("mouseover",(e,d)=>{
            if (dots) dots.filter((p:any)=>p===d).attr("r",rBase+2);
            showD3Tooltip(tooltip, e, `<strong>${d.annee} — ${s.nom}</strong><br/>${fmtV(d.valeur)}`);
          })
          .on("mousemove",(e)=>showD3Tooltip(tooltip, e))
          .on("mouseout",(e,d)=>{ if (dots) dots.filter((p:any)=>p===d).attr("r",rBase); hideD3Tooltip(tooltip); });
      });

      // Ticks = années entières uniquement (évite les doublons type "2020 2020"
      // produits par d3.ticks sur une plage courte) et plafonnées pour ne pas
      // s'entasser : au plus ~7 dans une carte, réparties entre min et max.
      const maxTicksLine = Math.max(2, Math.min(7, Math.floor((W - M.left - M.right) / 42)));
      let tickAnnees = allAnnees;
      if (allAnnees.length > maxTicksLine) {
        const stepA = Math.ceil((allAnnees.length - 1) / (maxTicksLine - 1));
        tickAnnees = allAnnees.filter((_,i)=>i%stepA===0);
        const last = allAnnees[allAnnees.length-1];
        if (tickAnnees[tickAnnees.length-1] !== last) tickAnnees.push(last);
      }
      svg.append("g").attr("transform",`translate(0,${H-M.bottom})`)
        .call(d3.axisBottom(xLin).tickValues(tickAnnees).tickFormat(d3.format("d")).tickSizeOuter(0))
        .call(g=>g.select(".domain").attr("stroke","#E8E5E3"))
        .call(g=>g.selectAll("line").remove())
        .call(g=>g.selectAll("text").style("fill","#9aa5b4").style("font-size","10px"));
    }

    // ── Axe Y gauche (série 0)
    svg.append("g").attr("transform",`translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtAxis))
      .call(g=>g.select(".domain").remove())
      .call(g=>g.selectAll("line").remove())
      .call(g=>g.selectAll("text").style("fill", useDual ? series[0].couleur : "#9aa5b4").style("font-size","10px").style("font-weight", useDual ? "600" : "400"));

    // ── Axe Y droit (série 1) si double axe
    if (useDual) {
      svg.append("g").attr("transform",`translate(${W-M.right},0)`)
        .call(d3.axisRight(yScales[1]).ticks(4).tickFormat(fmtAxis))
        .call(g=>g.select(".domain").remove())
        .call(g=>g.selectAll("line").remove())
        .call(g=>g.selectAll("text").style("fill", series[1].couleur).style("font-size","10px").style("font-weight","600"));
    }

  }, [series, type, height, fmtV]);

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
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement|null;

  // Intervalle d'années couvert par les séries (badge du titre + export PNG)
  const anneesRange = (() => {
    const as: number[] = (series||[]).flatMap((s:any)=>s.data.filter((d:any)=>d.valeur!==null).map((d:any)=>d.annee));
    if (!as.length) return "";
    const mn = Math.min(...as), mx = Math.max(...as);
    return mn === mx ? String(mn) : `${mn} – ${mx}`;
  })();
  const legendeExport = (series||[])
    .filter((s:any)=>s.data.some((d:any)=>d.valeur!==null))
    .map((s:any)=>({ nom: s.nom, couleur: s.couleur }));

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1100, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35, minWidth:0 }}>{titre}</h2>
                {anneesRange && (
                  <span style={{ flexShrink:0, fontSize:11, fontWeight:700, color:"#4a5568", background:"#ECEAE8", padding:"3px 10px", borderRadius:999, whiteSpace:"nowrap" as const }}>
                    {anneesRange}
                  </span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                {series?.length > 0 && series.filter((s:any)=>s.data.some((d:any)=>d.valeur!==null)).map((s:any) => (
                  <span key={s.nom} style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:s.couleur, background:`${s.couleur}12`, border:`1px solid ${s.couleur}30` }}>
                    {s.nom}
                  </span>
                ))}
                {sous_titre && <span style={{ fontSize:11.5, color:"#9aa5b4", fontWeight:500 }}>{sous_titre}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1 }}>
          <div ref={modalRef}>
            {children}
          </div>
          {analyse && (
            <div style={{ marginTop:22 }}>
              <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{analyse.titre}</p>
              <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 18px" }}>
                <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{analyse.commentaire}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"flex-end", gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
          <button onClick={()=>{ const svg=getSvg(); if(svg) downloadPNG(svg, grapheId||titre||"graphe", { titre, annees:anneesRange, legende:legendeExport }); }}
            style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgba(0,79,145,0.25)", fontFamily:"var(--font-google-sans)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card graphe miniature ─────────────────────────────────────────────────────
function GrapheCard({ titre, sous_titre, children, fullChildren, analyse, series, grapheId, hideLegend, hideSousTitre }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={()=>setOpen(true)}
        style={{ background:"#fff", borderRadius:14, border:"1px solid #ECEAE7", padding:"16px 18px", cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", minWidth:0 }}
        onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.25)";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const span=box.firstElementChild as HTMLElement|null; if(!span) return; const d=span.scrollWidth-(box as HTMLElement).clientWidth; if(d>0){ span.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; span.style.transform=`translateX(-${d}px)`; } }); }}
        onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#ECEAE7";
          e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{ const span=box.firstElementChild as HTMLElement|null; if(!span) return; span.style.transition="transform 0.4s ease"; span.style.transform="translateX(0)"; }); }}>

        {/* Header : titre + légende + expand */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const }}>
              <h3 style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", margin:0, display:"inline-block" }}>{titre}</h3>
            </div>
            {!hideLegend && series?.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const, marginTop:5 }}>
                {series.filter((s:any)=>s.data.some((d:any)=>d.valeur!==null)).map((s:any) => (
                  <span key={s.nom} style={{ display:"inline-flex", alignItems:"center", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:999, color:s.couleur, background:`${s.couleur}12` }}>
                    {s.nom}
                  </span>
                ))}
              </div>
            )}
            {!hideSousTitre && sous_titre && <p style={{ fontSize:10.5, color:"#9aa5b4", marginTop:4 }}>{sous_titre}</p>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
            {analyse && <span style={{ fontSize:9, fontWeight:800, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"2px 8px", borderRadius:999, letterSpacing:"0.08em" }}>ANALYSE</span>}
            <span style={{ width:26, height:26, borderRadius:8, background:"#F5F4F3", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Maximize2 size={11} style={{ color:"#9aa5b4" }} />
            </span>
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

// ── Export Excel (XLSX) ───────────────────────────────────────────────────────
function exportXLSX(donnees: any[], paysSelectionnes: any[], periode: string) {
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const series = [
    {dir:"entrant", ind:"flux",  label:"Flux entrants (M$ USD)"},
    {dir:"sortant", ind:"flux",  label:"Flux sortants (M$ USD)"},
    {dir:"entrant", ind:"stock", label:"Stock entrant (M$ USD)"},
    {dir:"sortant", ind:"stock", label:"Stock sortant (M$ USD)"},
  ];

  const wb = XLSX.utils.book_new();

  paysSelectionnes.forEach((p:any) => {
    // En-tête : Indicateur | 1990 | 1991 | ...
    const header = ["Indicateur", ...annees.map(String)];
    const rows: (string|number|null)[][] = [header];

    series.forEach(s => {
      const row: (string|number|null)[] = [s.label];
      annees.forEach(a => {
        const r = donnees.find((d:any)=>d.pays===p.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
        const v = r?.valeur;
        row.push(v !== null && v !== undefined ? Number(v.toFixed(2)) : null);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Largeur auto des colonnes
    const colWidths = rows[0].map((_:any, ci:number) => {
      const maxLen = Math.max(...rows.map(r => String(r[ci] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
    });
    ws["!cols"] = colWidths;

    // Nom de feuille = nom du pays (max 31 chars)
    XLSX.utils.book_append_sheet(wb, ws, p.nom.slice(0, 31));
  });

  XLSX.writeFile(wb, `IDE_CNUCED_${paysSelectionnes.map((p:any)=>p.nom.replace(/\s/g,"_")).join("_")}_${periode}.xlsx`);
}

// ── Modal données ─────────────────────────────────────────────────────────────
function ModalDonnees({ open, onClose, donnees, paysSelectionnes }: any) {
  if (!open) return null;
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const periode = annees.length ? `${annees[0]}_${annees[annees.length-1]}` : "all";
  const SERIES = [
    {dir:"entrant",ind:"flux",label:"Flux entrants"},
    {dir:"sortant",ind:"flux",label:"Flux sortants"},
    {dir:"entrant",ind:"stock",label:"Stock entrant"},
    {dir:"sortant",ind:"stock",label:"Stock sortant"},
  ];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:10.5, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
                  {annees[0]} — {annees[annees.length-1]}
                </span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, minWidth:0 }}>
                {paysSelectionnes.map((p:any)=>{
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={p.nom} title={p.label||p.nom}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:`${p.couleur}0D`, border:`1px solid ${p.couleur}2E`, fontSize:10.5, fontWeight:700, color:p.couleur, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:p.couleur, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{p.abrege||p.nom}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"#FAFAF9" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"#FAFAF9", borderRight:"1px solid #F0EEEC", borderBottom:"1px solid #F0EEEC", whiteSpace:"nowrap" as const, minWidth:170 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map((pays:any) => (
                <Fragment key={pays.nom}>
                  <tr>
                    <td colSpan={annees.length+1} style={{ padding:"12px 28px 6px", background:"#fff" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:pays.couleur, flexShrink:0 }} />
                        <span style={{ fontSize:12.5, fontWeight:800, color:pays.couleur }}>{pays.abrege||pays.nom}</span>
                      </div>
                    </td>
                  </tr>
                  {SERIES.map((s,si)=>(
                    <tr key={`${pays.nom}-${s.dir}-${s.ind}`}
                      style={{ borderBottom: si===SERIES.length-1?"1px solid #ECEAE7":"1px solid #F6F4F3", background:"#fff", transition:"background 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"}
                      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <td style={{ padding:"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #F0EEEC", whiteSpace:"nowrap" as const }}>
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:500 }}>{s.label}</span>
                      </td>
                      {annees.map(a=>{
                        const r = donnees.find((d:any)=>d.pays===pays.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
                        const v = r?.valeur;
                        const display = v!==null&&v!==undefined ? fmtVal(v) : "—";
                        const color = v===null||v===undefined ? "#C5BFBB" : v<0 ? "#dc2626" : "#4a5568";
                        return (
                          <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color, fontWeight:v!==null&&v!==undefined?600:400, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" as const }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>
            {paysSelectionnes.length} pays · {annees.length} années · valeurs en M$ USD · Source CNUCED
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={()=>exportXLSX(donnees,paysSelectionnes,periode)}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgba(0,79,145,0.25)", fontFamily:"var(--font-google-sans)" }}>
              <FileSpreadsheet size={13}/> Excel
            </button>
          </div>
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

// ── Découpe du libellé KPI : titre principal + précision (« dernière année », « période »…)
function splitKpiTitre(label: string): { main: string; suffix: string | null } {
  const dashMatch = label.match(/^(.+?)\s*—\s*(.+)$/);
  if (dashMatch) return { main: dashMatch[1], suffix: dashMatch[2] };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], suffix: parenMatch[2] };
  return { main: label, suffix: null };
}

// ── Mini modal KPI ────────────────────────────────────────────────────────────
function MiniModalKpi({ kpi, pays, couleur, onClose }: { kpi: KpiResult|null; pays: string; couleur: string; onClose: ()=>void }) {
  if (!kpi) return null;
  const interp = interpreterKpi(kpi, pays, couleur);
  const isTrend = ["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe"].includes(kpi.id);
  const isPos = kpi.valeur !== null && kpi.valeur > 0;
  const isNeg = kpi.valeur !== null && kpi.valeur < 0;
  const signalColor = isTrend ? (isPos?"#188038":isNeg?"#dc2626":"#9aa5b4") : couleur;
  const signalBg    = isTrend ? (isPos?"rgba(24,128,56,0.06)":isNeg?"rgba(220,38,38,0.05)":"#FAFAF9") : "rgba(0,79,145,0.04)";
  const signalBorder= isTrend ? (isPos?"rgba(24,128,56,0.18)":isNeg?"rgba(220,38,38,0.18)":"#F0EEEC") : "rgba(0,79,145,0.10)";
  const trendLabel  = isTrend ? (isPos?"Positif":isNeg?"Négatif":"Neutre") : null;
  const { main: titreMain, suffix: titreSuffix } = splitKpiTitre(kpi.label);
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35 }}>{titreMain}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:couleur, background:`${couleur}12`, border:`1px solid ${couleur}30` }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:couleur, display:"inline-block" }} />
                  {pays}
                </span>
                {titreSuffix && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {titreSuffix}
                  </span>
                )}
                {trendLabel && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:signalColor, background:signalBg, border:`1px solid ${signalBorder}` }}>
                    {trendLabel}
                  </span>
                )}
                {kpi.annee && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {kpi.annee}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtKpi(kpi)}</span>
              {kpi.annee && <span style={{ fontSize:13, color:"#9aa5b4", fontWeight:500 }}>en {kpi.annee}</span>}
            </div>
          </div>
          <div>
            <SecTitle>Interprétation</SecTitle>
            <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"#1a1a2e", lineHeight:1.75 }}>{interp}</p>
            </div>
          </div>
          <div>
            <SecTitle>Définition</SecTitle>
            <p style={{ fontSize:12, color:"#9aa5b4", lineHeight:1.65 }}>{kpi.description}</p>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers pays groupés ──────────────────────────────────────────────────────
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}
function groupByContinent(pays: any[]): Record<string, Record<string, any[]>> {
  const g: Record<string, Record<string, any[]>> = {};
  for (const p of pays) {
    const cont = p.continent || "Autre";
    const zone = p.region_geo || "Autre";
    if (!g[cont]) g[cont] = {};
    if (!g[cont][zone]) g[cont][zone] = [];
    g[cont][zone].push(p);
  }
  for (const cont of Object.keys(g))
    for (const zone of Object.keys(g[cont]))
      g[cont][zone].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
  return g;
}

// ── Onglet Pays — analyse individuelle ────────────────────────────────────────
function splitKpiLabel(label: string, dernAnnee: number): { main: string; badge: string | null } {
  const lastYearMatch = label.match(/^(.+?)\s*—\s*dernière année$/);
  if (lastYearMatch) return { main: lastYearMatch[1], badge: String(dernAnnee) };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], badge: parenMatch[2] };
  return { main: label, badge: null };
}

// ── Bouton « Tableau de données » responsive (plein → « Données » → icône) ─────
function BoutonDonnees({ onClick, dep }: { onClick: () => void; dep?: any }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"full" | "court" | "icone">("full");
  useEffect(() => {
    const btn = ref.current; const parent = btn?.parentElement;
    if (!btn || !parent) return;
    const calc = () => {
      let used = 0;
      Array.from(parent.children).forEach(ch => { if (ch !== btn) used += (ch as HTMLElement).offsetWidth + 8; });
      const avail = parent.clientWidth - used;
      setMode(avail >= 185 ? "full" : avail >= 112 ? "court" : "icone");
    };
    const raf = requestAnimationFrame(calc);
    const ro = new ResizeObserver(calc); ro.observe(parent);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dep]);
  return (
    <button ref={ref} onClick={onClick} title="Tableau de données"
      style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap: mode==="icone"?0:7, padding: mode==="icone"?"8px 10px":"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"var(--font-google-sans)", flexShrink:0, whiteSpace:"nowrap" as const }}
      onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
      <Table size={14} />{mode!=="icone" && <span>{mode==="full"?"Tableau de données":"Données"}</span>}
    </button>
  );
}

function OngletPays({ paysDispo, showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType }: { paysDispo: any[]; showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void }) {
  const [paysSelec,   setPaysSelec]   = useState<string>("Sénégal");
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [anneeMin,    setAnneeMin]    = useState(1990);
  const [anneeMax,    setAnneeMax]    = useState(2024);
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  const [kpisOrdre,   setKpisOrdre]   = useState<string[]>(KPI_25_IDS);
  const [kpisEpingles, setKpisEpingles] = useState<string[]>(KPI_DEFAUT);
  const [kpiActif,     setKpiActif]     = useState<KpiResult|null>(null);
  const [searchPays,   setSearchPays]   = useState("");
  const [openConts,    setOpenConts]    = useState<Set<string>>(new Set());
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const couleur = "#004f91";

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
  const kpisSidebar = kpisOrdre.map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];
  const kpisCards   = kpisEpingles.map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];

  const filteredPays = searchPays ? paysDispo.filter(p=>p.nom.toLowerCase().includes(searchPays.toLowerCase())) : paysDispo;
  const groupedPays  = groupByContinent(filteredPays);
  const toggleCont   = (c: string) => setOpenConts(prev => { const n=new Set(prev); n.has(c)?n.delete(c):n.add(c); return n; });

  const toggleEpingle = (id: string) => {
    setKpisEpingles(prev => {
      if (prev.includes(id)) return prev.filter(k=>k!==id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  // Drag & drop handlers

  const buildSerie = (dir: string, ind: string) => [{
    nom: paysSelec, couleur,
    data: donnees.filter(d=>d.direction===dir && d.indicateur===ind)
  }];

  const GRAPHES_PAYS = [
    { id:"fe", titre:"Flux entrants",       series: buildSerie("entrant","flux") },
    { id:"fs", titre:"Flux sortants",       series: buildSerie("sortant","flux") },
    { id:"se", titre:"Stock entrant",       series: buildSerie("entrant","stock") },
    { id:"ss", titre:"Stock sortant",       series: buildSerie("sortant","stock") },
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

  const hasFilter = paysSelec!=="Sénégal" || (modeAnnees==="specifiques"&&anneesSpec.length>0) || (modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024));
  const nbFiltres = (paysSelec!=="Sénégal"?1:0) + ((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024))?1:0);
  const reinit = () => { setPaysSelec("Sénégal"); setModeAnnees("plage"); setAnneeMin(1990); setAnneeMax(2024); setAnneesSpec([]); setKpisEpingles(KPI_DEFAUT); };

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>

        {/* Sidebar bande */}
        <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 64px)", overflowY:"auto" as const, position:"sticky" as const, top:64, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
          <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
            {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
                <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
                {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
              {/* Sélecteur de vue (avec sous-type par vue) */}
              <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                  {([{v:"pays",l:"Pays"},{v:"comparative",l:"Analyse comparative"},{v:"monde",l:"Monde"}] as const).map(o=>(
                    <div key={o.v}>
                      <button onClick={()=>setSousOnglet(o.v)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", background:sousOnglet===o.v?"rgba(0,79,145,0.08)":"transparent", fontSize:12, fontWeight:sousOnglet===o.v?700:600, color:sousOnglet===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                        {o.l}
                        <ChevronDown size={14} style={{ color:sousOnglet===o.v?"#004f91":"#9aa5b4", transform:sousOnglet===o.v?"none":"rotate(-90deg)", transition:"transform 0.15s", flexShrink:0 }}/>
                      </button>
                      {sousOnglet===o.v && (
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:1, marginTop:3 }}>
                          {([{t:"fluxstock",l:"Flux & Stocks"},{t:"greenfield",l:"Greenfield"},{t:"fusion",l:"Fusion & Acquisition"}] as const).map(st=>{
                            const actif = sousType===st.t;
                            return (
                              <button key={st.t} onClick={()=>setSousType(st.t)}
                                style={{ display:"flex", alignItems:"center", gap:9, width:"100%", textAlign:"left" as const, padding:"6px 10px 6px 20px", borderRadius:8, border:"none", cursor:"pointer", background:"transparent", fontSize:11.5, fontWeight:actif?600:500, color:actif?"#4a5568":"#6b7684", fontFamily:"var(--font-google-sans)" }}>
                                <span style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${actif?"#004f91":"#C5BFBB99"}`, background:actif?"#004f91":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
                                  {actif && <span style={{ width:3, height:3, borderRadius:"50%", background:"#fff" }}/>}
                                </span>
                                {st.l}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position:"relative" as const, marginBottom:18 }}>
                <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
                <input value={searchPays} onChange={e=>setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                  style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
                {searchPays&&<button onClick={()=>setSearchPays("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Pays */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Pays</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.18)", padding:"1px 6px", borderRadius:999 }}>1</span>
                </div>
                {/* Sénégal épinglé */}
                {(()=>{
                  const sel = paysSelec==="Sénégal";
                  const col = "#004f91";
                  return (
                    <div style={{ marginBottom:8, marginLeft:6 }}>
                      <button onClick={()=>setPaysSelec("Sénégal")}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          
                        </div>
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400 }}>Sénégal</span>
                        <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4", fontWeight:600, background:"#F2F0EF", padding:"1px 5px", borderRadius:4 }}>Réf.</span>
                      </button>
                    </div>
                  );
                })()}
                <div style={{ height:1, background:"#F2F0EF", marginBottom:8 }}/>
                <div style={{ maxHeight:200, overflowY:"auto" as const }}>
                  {sortContinents(Object.keys(groupedPays)).map(continent => {
                    const isOpen = openConts.has(continent);
                    const zones  = groupedPays[continent];
                    return (
                      <div key={continent} style={{ marginBottom:6 }}>
                        <button onClick={()=>toggleCont(continent)}
                          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", borderRadius:7, background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{continent}</span>
                          <ChevronDown size={11} style={{ color:"#004f91", transform:isOpen?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                        </button>
                        {isOpen&&Object.entries(zones).sort(([a],[b])=>a.localeCompare(b,"fr")).map(([zone,paysInZone]) => (
                          <div key={zone} style={{ marginLeft:6, marginBottom:4 }}>
                            <p style={{ fontSize:9, fontWeight:600, color:"#C5BFBB", textTransform:"uppercase" as const, letterSpacing:"0.1em", padding:"2px 8px", marginBottom:2 }}>{zone}</p>
                            {(paysInZone as any[]).map((p:any) => {
                              const sel = paysSelec === p.nom;
                              if (p.nom==="Sénégal") return (
                                <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, width:"100%", opacity:0.35, cursor:"not-allowed" as const }}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                  <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4" }}>Réf.</span>
                                </div>
                              );
                              return (
                                <button key={p.nom} onClick={()=>setPaysSelec(p.nom)}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                                  onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {Object.keys(groupedPays).length===0&&<p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun pays trouvé</p>}
                </div>
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Période */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                      <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-1990)/34)*100}%`, width:`${Math.max(0,((anneeMax-1990)/34)*100-((anneeMin-1990)/34)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <input type="range" min={1990} max={2024} value={anneeMin}
                        onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))}
                        className="drs-thumb"
                        style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                      <input type="range" min={1990} max={2024} value={anneeMax}
                        onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))}
                        className="drs-thumb"
                        style={{zIndex:3} as React.CSSProperties}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                    <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                      {Array.from({length:35},(_,i)=>1990+i).map(a=>{
                        const sel=anneesSpec.includes(a);
                        return (
                          <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                            style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#004f91":"#F8F7F6", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
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
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* KPI */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Key Performance Indicators</span>
                  <span style={{ fontSize:11, fontWeight:600, color:kpisEpingles.length>=5?"#004f91":"#9aa5b4", background:kpisEpingles.length>=5?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{kpisEpingles.length}/5</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:2, maxHeight:200, overflowY:"auto" as const }}>
                  {kpisSidebar.map((k,i)=>{
                    const epingle = kpisEpingles.includes(k.id);
                    const disabled = !epingle && kpisEpingles.length >= 5;
                    return (
                      <div key={k.id}
                        title={k.description}
                        onClick={()=>{ !disabled&&toggleEpingle(k.id); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, background:"transparent", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.3:1, transition:"background 0.1s" }}
                        onMouseEnter={ev=>{ ev.currentTarget.style.background="#F8F7F6"; }}
                        onMouseLeave={ev=>{ ev.currentTarget.style.background="transparent"; }}>
                        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${epingle?"#004f91":"#C5BFBB"}`, background:epingle?"#004f91":"transparent", flexShrink:0 }}/>
                        {(()=>{ const dernAnnee=modeAnnees==="specifiques"&&anneesSpec.length>0?anneesSpec[anneesSpec.length-1]:anneeMax; const {main,badge}=splitKpiLabel(k.label,dernAnnee); return (<><span style={{ fontSize:12, color:"#4a5568", flex:1, minWidth:0, lineHeight:1.35, fontWeight:epingle?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{main}</span>{badge&&<span style={{ fontSize:9, color:"#9aa5b4", fontWeight:600, background:"#F2F0EF", padding:"1px 5px", borderRadius:4, whiteSpace:"nowrap" as const, flexShrink:0 }}>{badge}</span>}</>); })()}
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        <div>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:couleur, flexShrink:0 }} />
              <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e" }}>{paysSelec}</h2>
              <span style={{ display:"inline-flex", alignItems:"center", padding:"4px 12px", borderRadius:999, background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", fontSize:12, fontWeight:700, color:"#fff", letterSpacing:"0.02em", flexShrink:0 }}>
                {modeAnnees==="specifiques"&&anneesSpec.length>0
                  ? `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                  : `${anneeMin} — ${anneeMax}`}
              </span>
            </div>
            <BoutonDonnees onClick={()=>setShowTable(true)} dep={paysSelec}/>
          </div>

          {/* KPI cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
            {kpisCards.map(k=>{
              const indicatif = getIndicatif(k);
              return (
                <div key={k.id} onClick={()=>setKpiActif(k)}
                  style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1px solid #ECEAE7", cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", minWidth:0 }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.25)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#ECEAE7"; }}>
                  {(()=>{ const { main, suffix } = splitKpiTitre(k.label); return (
                    <div style={{ marginBottom:7 }}>
                      <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, lineHeight:1.4 }}>{main}</p>
                      {suffix && <p style={{ fontSize:8.5, fontWeight:600, letterSpacing:"0.06em", color:"#9aa5b4", textTransform:"uppercase" as const, marginTop:2, lineHeight:1.3 }}>{suffix}</p>}
                    </div>
                  ); })()}
                  <p style={{ fontSize:"1.15rem", fontWeight:800, color:"#1a1a2e", lineHeight:1 }}>{fmtKpi(k)}</p>
                  {indicatif && <p style={{ fontSize:10, color:"#9aa5b4", marginTop:5, lineHeight:1 }}>{indicatif}</p>}
                </div>
              );
            })}
            {Array.from({length:Math.max(0,5-kpisCards.length)}).map((_,i)=>(
              <div key={`empty-${i}`} style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1.5px dashed #E8E5E3", display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90 }}>
                <span style={{ fontSize:20, color:"#C5BFBB", lineHeight:1 }}>+</span>
                <span style={{ fontSize:10, color:"#C5BFBB", textAlign:"center" as const, lineHeight:1.5 }}>Choisir dans<br/>le filtre</span>
              </div>
            ))}
          </div>

          {/* Graphes */}
          {loading ? (
            <SkeletonChartGrid n={4} cols={2} height={230}/>
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
      </div>

      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={[{nom:paysSelec,couleur}]} />
      <MiniModalKpi kpi={kpiActif} pays={paysSelec} couleur={couleur} onClose={()=>setKpiActif(null)} />
    </div>
  );
}

// ── Palette fixe pour l'analyse comparative ───────────────────────────────────
const COMP_PALETTE = ["#004f91","#ca631f","#188038","#6A1B9A"];

// ── Onglet Analyse comparative ────────────────────────────────────────────────
function OngletAnalyseComparative({ paysDispo, showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType }: { paysDispo: any[]; showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void }) {
  const [paysSelec,   setPaysSelec]   = useState<string[]>(["Sénégal"]);
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [anneeMin,    setAnneeMin]    = useState(1990);
  const [anneeMax,    setAnneeMax]    = useState(2024);
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
  const [searchPays,  setSearchPays]  = useState("");
  const [openConts,   setOpenConts]   = useState<Set<string>>(new Set());

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

  const paysAvecCouleur = paysSelec.map((nom,i) => ({ nom, couleur: COMP_PALETTE[i] ?? COMP_PALETTE[4] }));

  const buildSeries = (dir: string, ind: string) =>
    paysAvecCouleur.map(p=>({ nom:p.nom, couleur:p.couleur, data:donnees.filter(d=>d.pays===p.nom&&d.direction===dir&&d.indicateur===ind) }));

  const GRAPHES = [
    { id:"fe", titre:"Flux d'IDE entrants",     series: buildSeries("entrant","flux") },
    { id:"fs", titre:"Flux d'IDE sortants",      series: buildSeries("sortant","flux") },
    { id:"se", titre:"Stock d'IDE entrant",      series: buildSeries("entrant","stock") },
    { id:"ss", titre:"Stock d'IDE sortant",      series: buildSeries("sortant","stock") },
  ];

  const filteredPays = searchPays ? paysDispo.filter(p=>p.nom.toLowerCase().includes(searchPays.toLowerCase())) : paysDispo;
  const groupedPays  = groupByContinent(filteredPays);
  const toggleCont   = (c: string) => setOpenConts(prev => { const n=new Set(prev); n.has(c)?n.delete(c):n.add(c); return n; });

  const hasFilter = paysSelec.length>1||paysSelec[0]!=="Sénégal"||(modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024));
  const nbFiltres = (paysSelec.length>1||paysSelec[0]!=="Sénégal"?1:0)+((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024))?1:0);
  const reinit = () => { setPaysSelec(["Sénégal"]); setModeAnnees("plage"); setAnneeMin(1990); setAnneeMax(2024); setAnneesSpec([]); };

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>

        {/* Sidebar bande */}
        <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 64px)", overflowY:"auto" as const, position:"sticky" as const, top:64, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
          <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
            {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
                <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
                {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
              {/* Sélecteur de vue (avec sous-type par vue) */}
              <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                  {([{v:"pays",l:"Pays"},{v:"comparative",l:"Analyse comparative"},{v:"monde",l:"Monde"}] as const).map(o=>(
                    <div key={o.v}>
                      <button onClick={()=>setSousOnglet(o.v)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", background:sousOnglet===o.v?"rgba(0,79,145,0.08)":"transparent", fontSize:12, fontWeight:sousOnglet===o.v?700:600, color:sousOnglet===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                        {o.l}
                        <ChevronDown size={14} style={{ color:sousOnglet===o.v?"#004f91":"#9aa5b4", transform:sousOnglet===o.v?"none":"rotate(-90deg)", transition:"transform 0.15s", flexShrink:0 }}/>
                      </button>
                      {sousOnglet===o.v && (
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:1, marginTop:3 }}>
                          {([{t:"fluxstock",l:"Flux & Stocks"},{t:"greenfield",l:"Greenfield"},{t:"fusion",l:"Fusion & Acquisition"}] as const).map(st=>{
                            const actif = sousType===st.t;
                            return (
                              <button key={st.t} onClick={()=>setSousType(st.t)}
                                style={{ display:"flex", alignItems:"center", gap:9, width:"100%", textAlign:"left" as const, padding:"6px 10px 6px 20px", borderRadius:8, border:"none", cursor:"pointer", background:"transparent", fontSize:11.5, fontWeight:actif?600:500, color:actif?"#4a5568":"#6b7684", fontFamily:"var(--font-google-sans)" }}>
                                <span style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${actif?"#004f91":"#C5BFBB99"}`, background:actif?"#004f91":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
                                  {actif && <span style={{ width:3, height:3, borderRadius:"50%", background:"#fff" }}/>}
                                </span>
                                {st.l}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position:"relative" as const, marginBottom:18 }}>
                <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
                <input value={searchPays} onChange={e=>setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                  style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
                {searchPays&&<button onClick={()=>setSearchPays("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Pays */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Pays</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:paysSelec.length>=4?"#004f91":"#9aa5b4", background:paysSelec.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{paysSelec.length}/4</span>
                </div>
                {/* Sénégal épinglé */}
                {(()=>{
                  const sel = paysSelec.includes("Sénégal");
                  const col = COMP_PALETTE[paysSelec.indexOf("Sénégal")] ?? COMP_PALETTE[0];
                  const canAdd = !sel && paysSelec.length < 4;
                  return (
                    <div style={{ marginBottom:8, marginLeft:6 }}>
                      <button onClick={()=>{ if(sel){if(paysSelec.length>1)setPaysSelec(prev=>prev.filter(n=>n!=="Sénégal"));}else if(canAdd){setPaysSelec(prev=>[...prev,"Sénégal"]);} }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:sel||canAdd?"pointer":"not-allowed", background:"transparent", textAlign:"left" as const, width:"100%", opacity:!sel&&!canAdd?0.4:1 }}
                        onMouseEnter={e=>{if(sel||canAdd)(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          
                        </div>
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400 }}>Sénégal</span>
                        <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4", fontWeight:600, background:"#F2F0EF", padding:"1px 5px", borderRadius:4 }}>Réf.</span>
                      </button>
                    </div>
                  );
                })()}
                <div style={{ height:1, background:"#F2F0EF", marginBottom:8 }}/>
                <div style={{ maxHeight:200, overflowY:"auto" as const }}>
                  {sortContinents(Object.keys(groupedPays)).map(continent => {
                    const isOpen = openConts.has(continent);
                    const zones  = groupedPays[continent];
                    return (
                      <div key={continent} style={{ marginBottom:6 }}>
                        <button onClick={()=>toggleCont(continent)}
                          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", borderRadius:7, background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{continent}</span>
                          <ChevronDown size={11} style={{ color:"#004f91", transform:isOpen?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                        </button>
                        {isOpen&&Object.entries(zones).sort(([a],[b])=>a.localeCompare(b,"fr")).map(([zone,paysInZone]) => (
                          <div key={zone} style={{ marginLeft:6, marginBottom:4 }}>
                            <p style={{ fontSize:9, fontWeight:600, color:"#C5BFBB", textTransform:"uppercase" as const, letterSpacing:"0.1em", padding:"2px 8px", marginBottom:2 }}>{zone}</p>
                            {(paysInZone as any[]).map((p:any) => {
                              const sel = paysSelec.includes(p.nom);
                              const col = sel ? COMP_PALETTE[paysSelec.indexOf(p.nom)] : "#C5BFBB";
                              const canAdd = !sel && paysSelec.length < 4;
                              const disabled = !sel && !canAdd;
                              if (p.nom==="Sénégal") return (
                                <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, width:"100%", opacity:0.35, cursor:"not-allowed" as const }}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                  <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4" }}>Réf.</span>
                                </div>
                              );
                              return (
                                <button key={p.nom} onClick={()=>{ if(sel&&paysSelec.length>1) setPaysSelec(prev=>prev.filter(n=>n!==p.nom)); else if(canAdd) setPaysSelec(prev=>[...prev,p.nom]); }}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:disabled?"not-allowed":"pointer", background:"transparent", textAlign:"left" as const, width:"100%", opacity:disabled?0.4:1 }}
                                  onMouseEnter={e=>{if(!disabled&&!sel)(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {Object.keys(groupedPays).length===0&&<p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun pays trouvé</p>}
                </div>
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Période */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                      <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-1990)/34)*100}%`, width:`${Math.max(0,((anneeMax-1990)/34)*100-((anneeMin-1990)/34)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <input type="range" min={1990} max={2024} value={anneeMin}
                        onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))}
                        className="drs-thumb"
                        style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                      <input type="range" min={1990} max={2024} value={anneeMax}
                        onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))}
                        className="drs-thumb"
                        style={{zIndex:3} as React.CSSProperties}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                    <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                      {Array.from({length:35},(_,i)=>1990+i).map(a=>{
                        const sel=anneesSpec.includes(a);
                        return (
                          <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                            style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#004f91":"#F8F7F6", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
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
          </div>}
        </aside>

        {/* Zone graphes */}
        <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"nowrap" as const }}>
            <span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:12, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
              {modeAnnees==="specifiques"&&anneesSpec.length>0
                ? anneesSpec.length===1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                : `${anneeMin} — ${anneeMax}`}
            </span>
            {paysAvecCouleur.map(p=>(
              <span key={p.nom} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 13px", borderRadius:999, background:`${p.couleur}0D`, border:`1px solid ${p.couleur}2E`, fontSize:12, fontWeight:700, color:p.couleur, flexShrink:0, whiteSpace:"nowrap" as const }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:p.couleur, display:"inline-block" }} />
                {p.nom}
              </span>
            ))}
            <BoutonDonnees onClick={()=>setShowTable(true)} dep={paysSelec.join(",")}/>
          </div>

          {loading ? (
            <SkeletonChartGrid n={4} cols={2} height={230}/>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              {GRAPHES.map(g=>(
                <GrapheCard key={g.id} titre={g.titre} sous_titre="M$ USD · Source CNUCED" series={g.series} grapheId={g.id} hideLegend
                  fullChildren={<GrapheMultiPays series={g.series} height={340} type="line" titre={g.id} lineWidth={1.6}/>}>
                  <GrapheMultiPays series={g.series} height={145} type="line" titre={g.id} showDots={false} lineWidth={1.4}/>
                </GrapheCard>
              ))}
            </div>
          )}
        </div>
      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={paysAvecCouleur} />
    </div>
  );
}

// ── Onglet Monde ──────────────────────────────────────────────────────────────
// ── Horizontal bar chart top 10 ──────────────────────────────────────────────
function HBarChart({ donnees, mini=false }: { donnees: any[]; mini?: boolean }) {
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

    const fmtLabel = (v:number) => Math.abs(v)>=1000 ? `${(v/1000).toFixed(1)} Md$` : `${Math.round(v)} M$`;
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

// ── Diverging bars — Net (entrant − sortant) ──────────────────────────────────
function DivergingBars({ donnees, mini=false }: { donnees: any[]; mini?: boolean }) {
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
      return abs>=1000 ? `${sign}${(abs/1000).toFixed(1)}k` : `${sign}${Math.round(abs)}`;
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

function OngletMonde({ showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType }: { showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void }) {
  const [donnees,     setDonnees]    = useState<any[]>([]);
  const [loading,     setLoading]    = useState(false);
  const [anneeMin,    setAnneeMin]   = useState(1990);
  const [anneeMax,    setAnneeMax]   = useState(2024);
  const [anneesSpec,  setAnneesSpec] = useState<number[]>([]);
  const [modeAnnees,  setModeAnnees] = useState<"plage"|"specifiques">("plage");
  const [sidebarOpen, setSidebarOpen]= useState(true);
  const [sidebarWidth,setSidebarWidth]=useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const [groupements, setGroupements] = useState<{code:string; nom_fr:string; categorie:string}[]>([]);
  const [grpSelec,    setGrpSelec]    = useState<string[]>([]);
  const [searchGrp,   setSearchGrp]   = useState("");
  const [contExpanded,setContExpanded]= useState<Record<string,boolean>>({});
  const mondeInit = useRef(false);

  useEffect(() => {
    fetch(`${API}/ide/monde/groupements`).then(r=>r.json()).then(d=>setGroupements(d||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (mondeInit.current || !groupements.length) return;
    const defaultNames = ["Afrique","Amérique","Asie","Europe"];
    const codes = groupements
      .filter(g => g.categorie === "continent" && defaultNames.includes(g.nom_fr))
      .slice(0, 4)
      .map(g => g.code);
    if (codes.length > 0) { mondeInit.current = true; setGrpSelec(codes); }
  }, [groupements]);

  const grpAvecCouleur = grpSelec.map((code, i) => {
    const g = groupements.find(x => x.code === code);
    return { nom: code, label: g?.nom_fr || code, abrege: code.replace(/_/g, " "), couleur: COMP_PALETTE[i] ?? COMP_PALETTE[4] };
  });

  const charger = useCallback(async () => {
    if (!grpSelec.length) { setDonnees([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("codes_list", grpSelec.join(","));
      if (modeAnnees==="specifiques"&&anneesSpec.length>0) params.set("annees", anneesSpec.join(","));
      else { params.set("annee_min", String(anneeMin)); params.set("annee_max", String(anneeMax)); }
      const raw: any[] = await fetch(`${API}/ide/monde?${params}`).then(r=>r.json());
      setDonnees((raw||[]).map(d => ({
        pays: d.code, direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.somme,
      })));
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [grpSelec, anneeMin, anneeMax, anneesSpec, modeAnnees]);

  useEffect(() => { charger(); }, [charger]);

  const buildSeries = (dir:string, ind:string) =>
    grpAvecCouleur.map(g => ({ nom:g.abrege, couleur:g.couleur, data:donnees.filter(d=>d.pays===g.nom&&d.direction===dir&&d.indicateur===ind) }));

  const GRAPHES = [
    { id:"fe", titre:"Flux d'IDE entrants",  series: buildSeries("entrant","flux") },
    { id:"fs", titre:"Flux d'IDE sortants",  series: buildSeries("sortant","flux") },
    { id:"se", titre:"Stock d'IDE entrant",  series: buildSeries("entrant","stock") },
    { id:"ss", titre:"Stock d'IDE sortant",  series: buildSeries("sortant","stock") },
  ];

  const [donneesDetail, setDonneesDetail] = useState<any[]>([]);
  const modeDetail = grpSelec.length === 1;

  useEffect(() => {
    if (!modeDetail) { setDonneesDetail([]); return; }
    const params = new URLSearchParams({ code: grpSelec[0] });
    if (modeAnnees==="specifiques"&&anneesSpec.length>0) params.set("annees_spec", anneesSpec.join(","));
    else { params.set("annee_min", String(anneeMin)); params.set("annee_max", String(anneeMax)); }
    fetch(`${API}/ide/monde/details?${params}`).then(r=>r.json()).then(d=>setDonneesDetail(d||[])).catch(()=>{});
  }, [modeDetail, grpSelec, anneeMin, anneeMax, anneesSpec, modeAnnees]);

  const q = searchGrp.toLowerCase();
  const matchGrp = (g: {code:string; nom_fr:string}) => !q || g.nom_fr.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
  const continents = groupements.filter(g => g.categorie === 'continent');
  const groupes    = groupements.filter(g => g.categorie === 'groupe');
  const revenus    = groupements.filter(g => g.categorie === 'revenu');
  const regionsDe  = (cont: string) => groupements.filter(g => g.categorie === cont);
  const toggle = (code: string) => {
    if (grpSelec.includes(code)) setGrpSelec(p => p.filter(c => c !== code));
    else if (grpSelec.length < 4) setGrpSelec(p => [...p, code]);
  };
  const hasFilter = grpSelec.length>0||(modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024));
  const nbFiltres = (grpSelec.length>0?1:0)+((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==1990||anneeMax!==2024))?1:0);
  const reinit = () => { setGrpSelec([]); setModeAnnees("plage"); setAnneeMin(1990); setAnneeMax(2024); setAnneesSpec([]); };

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 64px)", overflowY:"auto" as const, position:"sticky" as const, top:64, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
              <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
              {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
            </button>}
          </div>
        </div>
        {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
          {/* Sélecteur de vue (avec sous-type par vue) */}
          <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
              {([{v:"pays",l:"Pays"},{v:"comparative",l:"Analyse comparative"},{v:"monde",l:"Monde"}] as const).map(o=>(
                <div key={o.v}>
                  <button onClick={()=>setSousOnglet(o.v)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", background:sousOnglet===o.v?"rgba(0,79,145,0.08)":"transparent", fontSize:12, fontWeight:sousOnglet===o.v?700:600, color:sousOnglet===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                    {o.l}
                    <ChevronDown size={14} style={{ color:sousOnglet===o.v?"#004f91":"#9aa5b4", transform:sousOnglet===o.v?"none":"rotate(-90deg)", transition:"transform 0.15s", flexShrink:0 }}/>
                  </button>
                  {sousOnglet===o.v && (
                    <div style={{ display:"flex", flexDirection:"column" as const, gap:1, marginTop:3 }}>
                      {([{t:"fluxstock",l:"Flux & Stocks"},{t:"greenfield",l:"Greenfield"},{t:"fusion",l:"Fusion & Acquisition"}] as const).map(st=>{
                        const actif = sousType===st.t;
                        return (
                          <button key={st.t} onClick={()=>setSousType(st.t)}
                            style={{ display:"flex", alignItems:"center", gap:9, width:"100%", textAlign:"left" as const, padding:"6px 10px 6px 20px", borderRadius:8, border:"none", cursor:"pointer", background:"transparent", fontSize:11.5, fontWeight:actif?600:500, color:actif?"#4a5568":"#6b7684", fontFamily:"var(--font-google-sans)" }}>
                            <span style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${actif?"#004f91":"#C5BFBB99"}`, background:actif?"#004f91":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
                              {actif && <span style={{ width:3, height:3, borderRadius:"50%", background:"#fff" }}/>}
                            </span>
                            {st.l}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:18 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
            <input value={searchGrp} onChange={e=>setSearchGrp(e.target.value)} placeholder="Rechercher un groupement…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {searchGrp&&<button onClick={()=>setSearchGrp("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
          </div>
          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* Période */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                  <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-1990)/34)*100}%`, width:`${Math.max(0,((anneeMax-1990)/34)*100-((anneeMin-1990)/34)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <input type="range" min={1990} max={2024} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                  <input type="range" min={1990} max={2024} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                  {Array.from({length:35},(_,i)=>1990+i).map(a=>{
                    const sel=anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#004f91":"#F8F7F6", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
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
          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* compteur global */}
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:grpSelec.length>=4?"#004f91":"#9aa5b4", background:grpSelec.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{grpSelec.length}/4</span>
          </div>

          {groupements.length===0&&<div style={{ padding:"8px 0" }}><SkeletonRows n={8} h={26}/></div>}

          {/* Helper render d'un item */}
          {(() => {
            const Item = ({ g }: { g: {code:string; nom_fr:string}; }) => {
              const sel = grpSelec.includes(g.code);
              const col = sel ? COMP_PALETTE[grpSelec.indexOf(g.code)] : "#C5BFBB";
              const disabled = !sel && grpSelec.length >= 4;
              return (
                <button key={g.code} onClick={()=>toggle(g.code)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:disabled?"not-allowed":"pointer", background:"transparent", textAlign:"left" as const, width:"100%", opacity:disabled?0.4:1, marginBottom:1 }}
                  onMouseEnter={e=>{
                    if(!disabled&&!sel)(e.currentTarget as HTMLElement).style.background="#F8F7F6";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ const d=sp.scrollWidth-box.clientWidth; if(d>0){ sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; } }
                  }}
                  onMouseLeave={e=>{
                    (e.currentTarget as HTMLElement).style.background="transparent";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; }
                  }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>

                  </div>
                  <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0, flex:1 }}>
                    <span style={{ display:"inline-block", fontSize:12, color:"#4a5568", fontWeight:sel?700:400 }}>{g.nom_fr}</span>
                  </span>
                </button>
              );
            };

            const SectionTitle = ({ label }: { label: string }) => (
              <div style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:6, marginTop:2 }}>{label}</div>
            );

            const filtCont  = continents.filter(matchGrp);
            const filtGrp   = groupes.filter(matchGrp);
            const filtRev   = revenus.filter(matchGrp);

            const showContSection = filtCont.length > 0 || continents.some(c => regionsDe(c.nom_fr).some(matchGrp));
            const showGrpSection  = filtGrp.length > 0;
            const showRevSection  = filtRev.length > 0;

            return (
              <>
                {/* ── Continents & Régions ───────────────── */}
                {showContSection && <>
                  <SectionTitle label="Continents & Régions"/>
                  {continents.map(cont => {
                    const regions  = regionsDe(cont.nom_fr);
                    const visRegs  = regions.filter(matchGrp);
                    const contMatch= matchGrp(cont);
                    if (!contMatch && visRegs.length === 0) return null;
                    const expanded = q ? true : (contExpanded[cont.code] ?? false);
                    return (
                      <div key={cont.code} style={{ marginBottom:2 }}>
                        {/* Ligne continent */}
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <button onClick={()=>setContExpanded(p=>({...p,[cont.code]:!expanded}))}
                            style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 2px", flexShrink:0, color:"#9aa5b4", display:"flex", alignItems:"center" }}>
                            {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </button>
                          {contMatch ? <div style={{ flex:1 }}><Item g={cont}/></div>
                            : <span style={{ fontSize:12, fontWeight:600, color:"#4a5568", padding:"5px 4px", flex:1 }}>{cont.nom_fr}</span>}
                        </div>
                        {/* Régions du continent */}
                        {expanded && visRegs.length > 0 && (
                          <div style={{ paddingLeft:20, borderLeft:"2px solid #F2F0EF", marginLeft:8, marginBottom:4 }}>
                            {visRegs.map(r => <Item key={r.code} g={r}/>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {/* ── Groupements ───────────────────────── */}
                {showGrpSection && <>
                  <SectionTitle label="Groupements"/>
                  {filtGrp.map(g => <Item key={g.code} g={g}/>)}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {/* ── Niveau de revenu ──────────────────── */}
                {showRevSection && <>
                  <SectionTitle label="Niveau de revenu"/>
                  {filtRev.map(g => <Item key={g.code} g={g}/>)}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {!showContSection && !showGrpSection && !showRevSection && q &&
                  <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
              </>
            );
          })()}


        </div>}
      </aside>

      {/* Zone graphes */}
      <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"nowrap" as const }}>
          <span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:12, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
            {modeAnnees==="specifiques"&&anneesSpec.length>0
              ? anneesSpec.length===1?`${anneesSpec[0]}`:`${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
              : `${anneeMin} — ${anneeMax}`}
          </span>
          {grpAvecCouleur.map(g=>(
            <span key={g.nom} title={g.label} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 13px", borderRadius:999, background:`${g.couleur}0D`, border:`1px solid ${g.couleur}2E`, fontSize:12, fontWeight:700, color:g.couleur, flexShrink:0, whiteSpace:"nowrap" as const }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:g.couleur, display:"inline-block" }} />
              {g.abrege}
            </span>
          ))}
          {grpSelec.length>0 && <BoutonDonnees onClick={()=>setShowTable(true)} dep={grpSelec.join(",")}/>}
        </div>

        {grpSelec.length===0 ? (
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", height:300, gap:12, color:"#9aa5b4" }}>
            <span style={{ fontSize:32 }}>🌍</span>
            <p style={{ fontSize:14, fontWeight:600, color:"#4a5568" }}>Sélectionnez un ou plusieurs groupements</p>
            <p style={{ fontSize:13 }}>Les statistiques agrégées s'afficheront ici.</p>
          </div>
        ) : loading ? (
          <SkeletonChartGrid n={4} cols={2} height={230}/>
        ) : (
          <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES.map(g=>(
              <GrapheCard key={g.id} titre={g.titre} sous_titre="M$ USD · Somme pays membres · CNUCED" series={g.series} grapheId={g.id} hideLegend
                fullChildren={<GrapheMultiPays series={g.series} height={340} type="line" titre={g.id} lineWidth={1.6}/>}>
                <GrapheMultiPays series={g.series} height={145} type="line" titre={g.id} showDots={false} lineWidth={1.4}/>
              </GrapheCard>
            ))}
          </div>

          {modeDetail && (
            <div style={{ marginTop:28, display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              <GrapheCard titre={`Flux entrant — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} sous_titre="Flux IDE entrant · dernière année · M$ USD" grapheId="hbar"
                fullChildren={<HBarChart donnees={donneesDetail}/>}>
                <HBarChart donnees={donneesDetail} mini/>
              </GrapheCard>
              <GrapheCard titre={`Ent. vs Sort. — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} sous_titre="Top 10 · net entrant − sortant · vert positif / rouge négatif" grapheId="divbar"
                fullChildren={<DivergingBars donnees={donneesDetail}/>}>
                <DivergingBars donnees={donneesDetail} mini/>
              </GrapheCard>
            </div>
          )}
          </>
        )}
      </div>
      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={grpAvecCouleur} />
    </div>
  );
}

// ── BDEF (Investissements nationaux) ──────────────────────────────────────────
const BDEF_CAT_COULEURS = ["#004f91","#ca631f","#188038","#7c3aed","#0891b2","#dc2626","#d97706","#059669"];

function fmtBdef(v: number|null, unite: string, short = false): string {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  if (unite === "%")     return `${v.toFixed(2)} %`;
  if (unite === "ratio") return v.toFixed(3);
  if (unite === "jours") return `${v.toFixed(0)} j`;
  // Montants en FCFA réels (le fichier source était en millions de FCFA).
  const suf = short ? "" : " FCFA";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v/1e9).toFixed(2)} Md${suf}`;
  if (a >= 1e6) return `${(v/1e6).toFixed(1)} M${suf}`;
  if (a >= 1e3) return `${(v/1e3).toFixed(0)} k${suf}`;
  return `${v.toFixed(0)} FCFA`;
}

type BdefNode = { id:number; code:string; libelle:string; macro_secteur_id?:number; groupe_id?:number };
type BdefRefs = { macro_secteur:BdefNode[]; groupe:BdefNode[]; secteur:BdefNode[] };
type BdefIndic = { code:string; libelle:string; unite:string; categorie:string; valeurs:Record<string,number|null> };
type BdefSel = { niveau:"global"|"macro_secteur"|"groupe"|"secteur"; cible_id:number|null; libelle:string };

// ── Définitions simples des indicateurs BDEF (affichées au survol) ────────────
const BDEF_DEFINITIONS: Record<string,string> = {
  act_ca:           "Le chiffre d'affaires, c'est le total des ventes réalisées par les entreprises du secteur sur l'année. Autrement dit : combien d'argent le secteur a généré en vendant ses produits et services.",
  act_tx_ca:        "Mesure l'évolution du chiffre d'affaires d'une année à l'autre, en pourcentage. Un taux positif signifie que les ventes du secteur progressent ; négatif, qu'elles reculent.",
  act_production:   "Valeur de tout ce que le secteur a produit sur l'année (vendu ou mis en stock). Elle reflète l'activité réelle, au-delà des seules ventes.",
  act_tx_prod:      "Évolution de la production d'une année sur l'autre, en pourcentage. Indique si l'activité du secteur s'accélère ou ralentit.",
  act_va:           "Richesse réellement créée par le secteur : ce qui reste de la production une fois retranchés les achats de matières et de services extérieurs. C'est sa contribution à l'économie.",
  act_tx_va:        "Part de la production qui se transforme en valeur ajoutée. Plus il est élevé, plus le secteur crée de richesse par rapport à ce qu'il consomme.",
  rent_ebe:         "Ce que le secteur gagne grâce à son activité courante, avant de payer les intérêts, les impôts et l'usure du matériel. Un bon indicateur de la rentabilité « brute ».",
  rent_rex:         "Bénéfice tiré de l'activité principale, une fois prise en compte l'usure des équipements (amortissements). Il montre si le métier de base est rentable.",
  rent_eco:         "Mesure ce que rapporte l'activité par rapport aux moyens investis (l'actif). Autrement dit : l'argent mobilisé travaille-t-il efficacement ?",
  rent_fin:         "Mesure ce que l'entreprise rapporte à ses propriétaires par rapport à leur mise de départ. Répond à : « mon argent investi rapporte-t-il bien ? »",
  sf_pression_fisc: "Part de la richesse créée par le secteur qui part en impôts et taxes. Plus il est élevé, plus la charge fiscale pèse sur les entreprises.",
  sf_autonomie:     "Indique dans quelle mesure le secteur se finance par ses propres fonds plutôt que par l'endettement. Plus elle est élevée, plus les entreprises sont indépendantes des banques.",
  sf_solvabilite:   "Mesure si les entreprises sont capables de rembourser l'ensemble de leurs dettes sur le long terme. Autrement dit : « l'entreprise survivrait-elle si elle devait tout rembourser aujourd'hui ? »",
  sf_dettes_fin:    "Importance des dettes contractées auprès des banques par rapport aux ressources du secteur. Plus il est élevé, plus le secteur est endetté.",
  sf_cap_rembours:  "Indique combien d'années il faudrait au secteur pour rembourser ses dettes avec ce qu'il dégage chaque année. Plus c'est court, plus la situation est saine.",
  liq_fdr:          "Marge de sécurité financière : les ressources stables qui restent disponibles une fois les investissements financés. Un fonds de roulement positif protège contre les imprévus.",
  liq_bfr:          "Argent dont le secteur a besoin en permanence pour financer son cycle d'exploitation (stocks et délais de paiement). Plus il est élevé, plus il faut de trésorerie pour fonctionner.",
  eff_prod_travail: "Richesse créée en moyenne par chaque travailleur. Mesure l'efficacité de la main-d'œuvre du secteur.",
  eff_prod_capital: "Richesse créée pour chaque franc de capital investi dans les équipements. Mesure si les machines et installations sont bien exploitées.",
  eff_vetuste:      "Degré d'usure des équipements du secteur. Plus il est élevé, plus le matériel est ancien et proche de devoir être renouvelé.",
  eff_stock_mp:     "Nombre de jours pendant lesquels les matières premières restent en stock avant d'être utilisées. Plus c'est court, plus la gestion est efficace.",
  eff_stock_march:  "Nombre de jours pendant lesquels les marchandises restent en stock avant d'être vendues. Un délai court signale un bon écoulement.",
  eff_stock_pf:     "Nombre de jours pendant lesquels les produits finis attendent en stock avant d'être vendus. Plus c'est court, mieux le secteur écoule sa production.",
  inv_actif_immo:   "Valeur de tout ce que le secteur possède durablement pour produire : terrains, bâtiments, machines, équipements. Reflète l'effort d'investissement accumulé.",
  inv_amortiss:     "Constatation comptable de l'usure des équipements sur l'année. Représente la part de valeur que les biens perdent à force d'être utilisés.",
  inv_tx_autofin:   "Capacité du secteur à financer ses investissements par ses propres ressources, sans emprunter. Plus il est élevé, plus le secteur est autonome pour investir.",
  _raw_caf:         "Capacité d'autofinancement : l'argent que le secteur dégage réellement par son activité et qu'il peut consacrer à investir ou à rembourser ses dettes.",
};
const defBdef = (code:string, libelle:string) =>
  BDEF_DEFINITIONS[code] || `${libelle} — indicateur issu de la Banque de Données Économiques et Financières (BDEF).`;

// KPIs affichés par défaut (onglet national)
const BDEF_KPI_DEFAUT = ["act_ca", "inv_tx_autofin", "sf_pression_fisc", "sf_autonomie", "rent_ebe"];
// Graphes affichés par défaut (onglet national), dans cet ordre
const BDEF_GRAPHES_DEFAUT = [
  "act_ca", "eff_vetuste", "inv_actif_immo", "inv_tx_autofin",
  "liq_fdr", "sf_pression_fisc", "sf_autonomie", "rent_ebe",
];
// Couleurs distinctes pour la comparaison macro-secteurs sur la vue globale
const BDEF_MACRO_COULEURS = ["#004f91", "#ca631f", "#188038", "#6A1B9A"];

// ── Case à cocher (sélection unique) ──────────────────────────────────────────
const BDEF_NIVEAU_STYLE: Record<string,{color:string;fs:number;fw:number;base:string}> = {
  macro_secteur: { color:"#004f91", fs:13,   fw:700, base:"#1a1a2e" },
  groupe:        { color:"#ca631f", fs:12.5, fw:600, base:"#3a4452" },
  secteur:       { color:"#188038", fs:12,   fw:500, base:"#5a6472" },
};
const BDEF_NIVEAU_LABEL: Record<string,string> = {
  macro_secteur:"Macro-secteur", groupe:"Groupe", secteur:"Secteur",
};

function BdefRow({ label, niveau, selected, onSelect, expandable, expanded, onToggle }: {
  label:string; niveau?:string; selected:boolean;
  onSelect:()=>void; expandable?:boolean; expanded?:boolean; onToggle?:()=>void;
}) {
  const st = (niveau && BDEF_NIVEAU_STYLE[niveau]) || { color:"#004f91", fs:12.5, fw:600, base:"#1a1a2e" };
  const selBg = `${st.color}10`;
  const dotColor = niveau ? st.color : "#C5BFBB";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {expandable ? (
        <button onClick={onToggle} style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex", flexShrink:0 }}>
          <ChevronDown size={12} style={{ color:"#9aa5b4", transform:expanded?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
        </button>
      ) : <span style={{ width:16, flexShrink:0 }}/>}
      <button onClick={onSelect}
        style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 9px", borderRadius:8, border:"none", cursor:"pointer", background:(selected&&!niveau)?selBg:"transparent", textAlign:"left" as const, width:"100%" }}
        onMouseEnter={e=>{if(!(selected&&!niveau))(e.currentTarget as HTMLElement).style.background="#F6F5F4";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=(selected&&!niveau)?selBg:"transparent";}}>
        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${selected?st.color:dotColor+"99"}`, background:selected?st.color:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
          {selected&&!niveau&&<div style={{ width:3, height:3, borderRadius:"50%", background:"#fff" }}/>}
        </div>
        <span style={{ fontSize:st.fs, color:"#4a5568", fontWeight:selected?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, letterSpacing:niveau==="macro_secteur"?"-0.01em":"0" }}>{label}</span>
      </button>
    </div>
  );
}

// ── Modal tableau BDEF ────────────────────────────────────────────────────────
function ModalBdefTable({ open, onClose, blocs, annees }: {
  open:boolean; onClose:()=>void; blocs:{libelle:string; couleur:string; indicateurs:BdefIndic[]}[]; annees:number[];
}) {
  if (!open) return null;
  const parCatDe = (indicateurs:BdefIndic[]) => {
    const parCat: {cat:string; inds:BdefIndic[]}[] = [];
    indicateurs.forEach(ind=>{ let g=parCat.find(x=>x.cat===ind.categorie); if(!g){g={cat:ind.categorie,inds:[]};parCat.push(g);} g.inds.push(ind); });
    return parCat;
  };
  const multi = blocs.length > 1;
  const nbInds = blocs.reduce((n,b)=>n+b.indicateurs.length,0);
  // Unité affichée à côté du libellé (échelle commune par indicateur) — valeurs nues dans les cellules
  const uniteEtEchelle = (ind: BdefIndic): { unite:string; scale:number } => {
    if (ind.unite==="%"||ind.unite==="ratio"||ind.unite==="jours") return { unite:ind.unite, scale:1 };
    const m = Math.max(0, ...annees.map(a=>Math.abs((ind.valeurs[a] as number)||0)));
    if (m>=1e9) return { unite:"Md FCFA", scale:1e9 };
    if (m>=1e6) return { unite:"M FCFA", scale:1e6 };
    if (m>=1e3) return { unite:"k FCFA", scale:1e3 };
    return { unite:"FCFA", scale:1 };
  };
  const fmtNu = (ind: BdefIndic, v: number, scale: number) =>
    ind.unite==="%" ? v.toFixed(2)
    : ind.unite==="ratio" ? v.toFixed(3)
    : ind.unite==="jours" ? v.toFixed(0)
    : (v/scale).toFixed(scale>=1e9?2:scale>=1e6?1:0);

  const exporter = () => {
    const wb = XLSX.utils.book_new();
    blocs.forEach((b,bi)=>{
      const header = ["Catégorie","Indicateur","Unité",...annees.map(String)];
      const rows:(string|number|null)[][] = [header];
      parCatDe(b.indicateurs).forEach(({cat,inds})=>inds.forEach(ind=>{
        rows.push([cat, ind.libelle, ind.unite, ...annees.map(a=>{ const v=ind.valeurs[a]; return v!==null&&v!==undefined?Number(v):null; })]);
      }));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = header.map((_,ci)=>({ wch: Math.min(Math.max(...rows.map(r=>String(r[ci]??"").length))+2,50) }));
      const nomFeuille = ((multi?`${bi+1}. `:"") + b.libelle.replace(/[\\\/\?\*\[\]:]/g," ")).slice(0,31);
      XLSX.utils.book_append_sheet(wb, ws, nomFeuille);
    });
    XLSX.writeFile(wb, `BDEF_${blocs.map(b=>b.libelle.replace(/[^\w]/g,"_").slice(0,20)).join("_").slice(0,80)}.xlsx`);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:10.5, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
                  {annees.length===1 ? `${annees[0]}` : `${annees[0]} — ${annees[annees.length-1]}`}
                </span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, minWidth:0 }}>
                {blocs.map(b=>{
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={b.libelle} title={b.libelle}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:`${b.couleur}0D`, border:`1px solid ${b.couleur}2E`, fontSize:10.5, fontWeight:700, color:b.couleur, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:b.couleur, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{b.libelle}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"#FAFAF9" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"#FAFAF9", borderRight:"1px solid #F0EEEC", borderBottom:"1px solid #F0EEEC", whiteSpace:"nowrap" as const, minWidth:200 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {blocs.map(b=>(
                <Fragment key={b.libelle}>
                  {multi&&(
                    <tr>
                      <td colSpan={annees.length+1} style={{ padding:"14px 28px 6px", background:"#fff" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:b.couleur, flexShrink:0 }} />
                          <span style={{ fontSize:12.5, fontWeight:800, color:b.couleur }}>{b.libelle}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {parCatDe(b.indicateurs).map(({cat,inds})=>(
                    <Fragment key={`${b.libelle}-${cat}`}>
                      <tr><td colSpan={annees.length+1} style={{ padding:multi?"9px 28px 4px 44px":"10px 28px 4px", fontSize:10, fontWeight:800, color:b.couleur, letterSpacing:"0.1em", textTransform:"uppercase" as const, background:"#fff" }}>{cat}</td></tr>
                      {inds.map(ind=>{
                        const { unite:uAff, scale } = uniteEtEchelle(ind);
                        return (
                        <tr key={ind.code} style={{ borderBottom:"1px solid #F6F4F3", background:"#fff", transition:"background 0.1s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"}
                          onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                          <td style={{ padding:multi?"9px 28px 9px 58px":"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #F0EEEC", whiteSpace:"nowrap" as const }}>
                            <span style={{ fontSize:12, color:"#4a5568", fontWeight:500 }}>{ind.libelle}</span> <span style={{ fontSize:10, color:"#C5BFBB" }}>· {uAff}</span>
                          </td>
                          {annees.map(a=>{
                            const v = ind.valeurs[a];
                            const display = v!==null&&v!==undefined ? fmtNu(ind, v, scale) : "—";
                            const color = v===null||v===undefined ? "#C5BFBB" : v<0 ? "#dc2626" : "#4a5568";
                            return (
                              <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color, fontWeight:v!==null&&v!==undefined?600:400, fontVariantNumeric:"tabular-nums" as const, whiteSpace:"nowrap" as const }}>{display}</td>
                            );
                          })}
                        </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>
            {multi?`${blocs.length} éléments · `:""}{nbInds} indicateurs · {annees.length} année{annees.length>1?"s":""} · Source BDEF (ANSD)
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={exporter}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgba(0,79,145,0.25)", fontFamily:"var(--font-google-sans)" }}>
              <FileSpreadsheet size={13}/> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini-modal KPI BDEF ───────────────────────────────────────────────────────
function MiniModalBdefKpi({ ind, annees, libelle, onClose }: {
  ind: BdefIndic | null; annees: number[]; libelle: string; onClose: ()=>void;
}) {
  if (!ind) return null;
  const lastA  = annees.length ? annees[annees.length - 1] : null;
  const v      = lastA !== null ? (ind.valeurs[lastA] ?? null) : null;
  const isTaux = ind.unite === "%" || ind.unite === "ratio";
  const isPos  = v !== null && v > 0;
  const isNeg  = v !== null && v < 0;
  const signalColor  = isNeg ? "#dc2626" : "#004f91";
  const signalBg     = isNeg ? "rgba(220,38,38,0.05)" : "rgba(0,79,145,0.04)";
  const signalBorder = isNeg ? "rgba(220,38,38,0.18)" : "rgba(0,79,145,0.10)";
  const definition = defBdef(ind.code, ind.libelle);
  const historique = annees.filter(a=>ind.valeurs[a]!=null).slice(-5);
  // Échelle commune de l'historique : unité affichée à côté du titre, valeurs nues dans les blocs
  const estMontant = !isTaux && ind.unite !== "jours";
  const histMax = Math.max(0, ...historique.map(a=>Math.abs(ind.valeurs[a] as number)));
  const histScale = estMontant ? (histMax>=1e9 ? 1e9 : histMax>=1e6 ? 1e6 : histMax>=1e3 ? 1e3 : 1) : 1;
  const histUnite = estMontant ? (histScale===1e9 ? "Md FCFA" : histScale===1e6 ? "M FCFA" : histScale===1e3 ? "k FCFA" : "FCFA") : ind.unite;
  const fmtHist = (val:number) =>
    ind.unite==="%" ? val.toFixed(2)
    : ind.unite==="ratio" ? val.toFixed(3)
    : ind.unite==="jours" ? val.toFixed(0)
    : (val/histScale).toFixed(histScale>=1e9?2:histScale>=1e6?1:0);
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35 }}>{ind.libelle}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#004f91", background:"rgba(0,79,145,0.07)", border:"1px solid rgba(0,79,145,0.19)" }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#004f91", display:"inline-block" }} />
                  {libelle}
                </span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                  {ind.categorie}
                </span>
                {lastA && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {lastA}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtBdef(v, ind.unite)}</span>
              {lastA && <span style={{ fontSize:13, color:"#9aa5b4", fontWeight:500 }}>en {lastA}</span>}
            </div>
          </div>
          {historique.length > 0 && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
                <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, margin:0 }}>Historique récent</p>
                <span style={{ fontSize:10.5, fontWeight:600, color:"#9aa5b4" }}>en {histUnite}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(historique.length,5)},1fr)`, gap:8 }}>
                {historique.map(a=>(
                  <div key={a} style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", margin:"0 0 3px" }}>{a}</p>
                    <p style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", margin:0, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>{fmtHist(ind.valeurs[a] as number)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <SecTitle>Définition</SecTitle>
            <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"#1a1a2e", lineHeight:1.75, margin:0 }}>{definition}</p>
            </div>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>Unité : {ind.unite} · Source BDEF (ANSD)</span>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function OngletNational() {
  const [refs, setRefs]               = useState<BdefRefs|null>(null);
  const [sel, setSel]                 = useState<BdefSel>({ niveau:"global", cible_id:null, libelle:"Global des secteurs" });
  const [indicateurs, setIndicateurs] = useState<BdefIndic[]>([]);
  const [anneesData, setAnneesData]   = useState<number[]>([]);
  const [loading, setLoading]         = useState(true);

  // Vue : sectorielle | comparative
  const [sousVue, setSousVue]         = useState<"sectorielle"|"comparative">("sectorielle");
  // Analyse comparative
  const [compType, setCompType]       = useState<"macro_secteur"|"groupe"|"secteur">("macro_secteur");
  const [compSelec, setCompSelec]     = useState<number[]>([]);
  const compInit = useRef(false);
  const [compData, setCompData]       = useState<Record<number,BdefIndic[]>>({});
  const [compAnneesData, setCompAnneesData] = useState<number[]>([]);
  const [compSearch, setCompSearch]   = useState("");
  const [compCatOuverts, setCompCatOuverts] = useState<Set<string>>(new Set());
  const toggleCompCat = (k:string) => setCompCatOuverts(p=>{ const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n; });
  const [loadingComp, setLoadingComp] = useState(false);

  // Période (bornes dérivées des données)
  const [bornes, setBornes]           = useState<[number,number]>([2019,2024]);
  const [anneeMin, setAnneeMin]       = useState(2019);
  const [anneeMax, setAnneeMax]       = useState(2024);
  const [modeAnnees, setModeAnnees]   = useState<"plage"|"specifiques">("plage");
  const [anneesSpec, setAnneesSpec]   = useState<number[]>([]);
  const initBornes = useRef(false);

  // Sidebar
  const [search, setSearch]           = useState("");
  const [openMacros, setOpenMacros]   = useState<Set<number>>(new Set());
  const [openGroupes, setOpenGroupes] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const isResizing = useRef(false);
  const [showTable, setShowTable]     = useState(false);

  // KPIs
  const [kpisEpingles, setKpisEpingles] = useState<string[]>(BDEF_KPI_DEFAUT);
  const [kpiActif, setKpiActif]         = useState<BdefIndic | null>(null);
  const [catKpiOuverts, setCatKpiOuverts] = useState<Set<string>>(new Set());
  // Données des macro-secteurs (uniquement chargées pour la vue globale)
  const [macroIndicateurs, setMacroIndicateurs] = useState<{id:number;libelle:string;inds:BdefIndic[]}[]>([]);
  const [tip, setTip] = useState<{text:string;x:number;y:number}|null>(null);
  const montrerTip = (e:React.MouseEvent, text:string) => setTip({ text, x:e.clientX, y:e.clientY });

  // Couleur d'accent du panneau de droite = couleur du niveau sélectionné
  const couleur = (sel.niveau && BDEF_NIVEAU_STYLE[sel.niveau]?.color) || "#004f91";

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(220, Math.min(540, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  useEffect(()=>{ fetch(`${API}/bdef/secteurs`).then(r=>r.json()).then((d:BdefRefs)=>setRefs(d)).catch(()=>{}); }, []);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const qs = sel.niveau==="global" ? `niveau=global` : `niveau=${sel.niveau}&cible_id=${sel.cible_id}`;
      const d = await fetch(`${API}/bdef/valeurs?${qs}`).then(r=>r.json());
      setIndicateurs(d?.indicateurs||[]);
      setAnneesData(d?.annees||[]);
      if (sel.niveau==="global" && refs) {
        const macros = await Promise.all(
          refs.macro_secteur.map(m=>
            fetch(`${API}/bdef/valeurs?niveau=macro_secteur&cible_id=${m.id}`)
              .then(r=>r.json())
              .then((md:any)=>({ id:m.id, libelle:m.libelle, inds:(md?.indicateurs||[]) as BdefIndic[] }))
              .catch(()=>({ id:m.id, libelle:m.libelle, inds:[] as BdefIndic[] }))
          )
        );
        setMacroIndicateurs(macros);
      } else {
        setMacroIndicateurs([]);
      }
    } catch(e){ console.error(e); setIndicateurs([]); setAnneesData([]); setMacroIndicateurs([]); }
    finally { setLoading(false); }
  }, [sel, refs]);
  useEffect(()=>{ charger(); }, [charger]);

  // Chargement comparatif : quand compSelec ou compType change
  useEffect(()=>{
    if (sousVue!=="comparative" || compSelec.length===0) return;
    let cancelled = false;
    (async()=>{
      setLoadingComp(true);
      const results = await Promise.all(
        compSelec.map(id=>
          fetch(`${API}/bdef/valeurs?niveau=${compType}&cible_id=${id}`)
            .then(r=>r.json())
            .then((d:any)=>({ id, inds:(d?.indicateurs||[]) as BdefIndic[], annees:(d?.annees||[]) as number[] }))
            .catch(()=>({ id, inds:[] as BdefIndic[], annees:[] as number[] }))
        )
      );
      if (!cancelled) {
        const newData: Record<number,BdefIndic[]> = {};
        let allAnnees: number[] = [];
        results.forEach(r=>{ newData[r.id]=r.inds; allAnnees=[...new Set([...allAnnees,...r.annees])].sort(); });
        setCompData(newData);
        setCompAnneesData(allAnnees);
      }
      setLoadingComp(false);
    })();
    return ()=>{ cancelled=true; };
  }, [compSelec, compType, sousVue]);

  // Sélection par défaut : les 4 macro-secteurs (une seule fois, dès que refs est chargé)
  useEffect(()=>{
    if (!compInit.current && refs?.macro_secteur?.length) {
      compInit.current = true;
      setCompSelec(refs.macro_secteur.slice(0,4).map(m=>m.id));
    }
  }, [refs]);

  // Initialiser les bornes années au 1er chargement contenant des données
  useEffect(()=>{
    if (!initBornes.current && anneesData.length) {
      initBornes.current = true;
      const mn=anneesData[0], mx=anneesData[anneesData.length-1];
      setBornes([mn,mx]); setAnneeMin(mn); setAnneeMax(mx);
    }
  }, [anneesData]);

  const anneesAffichees = (modeAnnees==="specifiques" && anneesSpec.length>0)
    ? anneesSpec.filter(a=>anneesData.includes(a))
    : anneesData.filter(a=>a>=anneeMin && a<=anneeMax);
  const anneesCompAff = (modeAnnees==="specifiques" && anneesSpec.length>0)
    ? anneesSpec.filter(a=>compAnneesData.includes(a))
    : compAnneesData.filter(a=>a>=anneeMin && a<=anneeMax);

  // Regroupement des indicateurs par catégorie (ordre conservé)
  const parCategorie: {cat:string; inds:BdefIndic[]}[] = [];
  indicateurs.forEach(ind=>{ let g=parCategorie.find(x=>x.cat===ind.categorie); if(!g){g={cat:ind.categorie,inds:[]};parCategorie.push(g);} g.inds.push(ind); });

  // Cascade
  const groupesDe  = (mid:number) => refs?.groupe.filter(g=>g.macro_secteur_id===mid) || [];
  const secteursDe = (gid:number) => refs?.secteur.filter(s=>s.groupe_id===gid) || [];
  const toggleMacro  = (id:number) => setOpenMacros(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleGroupe = (id:number) => setOpenGroupes(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleComp   = (id:number) => setCompSelec(p=>p.includes(id)?p.filter(x=>x!==id):p.length<4?[...p,id]:p);

  const choisir = (niveau:BdefSel["niveau"], node:BdefNode|null) =>
    setSel({ niveau, cible_id: node?node.id:null, libelle: node?node.libelle:"Global des secteurs" });
  const estSel = (niveau:string, id:number|null) => sel.niveau===niveau && sel.cible_id===id;

  // Recherche : résultats à plat tous niveaux confondus
  const q = search.trim().toLowerCase();
  const resultats = q && refs ? [
    ...refs.macro_secteur.filter(m=>m.libelle.toLowerCase().includes(q)||m.code.includes(q)).map(n=>({niveau:"macro_secteur" as const,node:n})),
    ...refs.groupe.filter(g=>g.libelle.toLowerCase().includes(q)||g.code.includes(q)).map(n=>({niveau:"groupe" as const,node:n})),
    ...refs.secteur.filter(s=>s.libelle.toLowerCase().includes(q)||s.code.includes(q)).map(n=>({niveau:"secteur" as const,node:n})),
  ] : [];

  const periodeFiltree = (modeAnnees==="specifiques"&&anneesSpec.length>0) || (modeAnnees==="plage"&&(anneeMin!==bornes[0]||anneeMax!==bornes[1]));
  const hasFilter = sousVue==="comparative"
    ? compSelec.length>0 || periodeFiltree
    : sel.niveau!=="global" || periodeFiltree;
  const reinit = () => {
    if (sousVue==="comparative") { setCompSelec([]); setCompData({}); setCompType("macro_secteur"); }
    else { choisir("global",null); }
    setModeAnnees("plage"); setAnneeMin(bornes[0]); setAnneeMax(bornes[1]); setAnneesSpec([]); setSearch("");
  };
  const span = Math.max(1, bornes[1]-bornes[0]);

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"calc(100vh - 64px)", overflowY:"auto" as const, position:"sticky" as const, top:64, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center" }}>
              <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
            </button>}
          </div>
        </div>

        {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
          {/* Sélecteur de vue */}
          <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
              {([{v:"sectorielle",l:"Analyse sectorielle"},{v:"comparative",l:"Analyse comparative"}] as const).map(o=>(
                <button key={o.v} onClick={()=>setSousVue(o.v)}
                  style={{ textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:sousVue===o.v?700:500, background:sousVue===o.v?"rgba(0,79,145,0.08)":"transparent", color:sousVue===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {sousVue==="comparative" ? (
            <>
              {/* Sélecteur de type */}
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Comparer par</p>
                <div style={{ display:"flex", gap:6 }}>
                  {([{v:"macro_secteur",l:"Macro-sect."},{v:"groupe",l:"Groupes"},{v:"secteur",l:"Secteurs"}] as const).map(o=>(
                    <button key={o.v} onClick={()=>{ setCompType(o.v); setCompSelec([]); setCompData({}); }}
                      style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${compType===o.v?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11.5, fontWeight:compType===o.v?700:500, background:compType===o.v?"rgba(0,79,145,0.08)":"#F8F7F6", color:compType===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compteur sélection */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Sélection</span>
                <span style={{ fontSize:11, fontWeight:600, color:compSelec.length>=4?"#004f91":"#9aa5b4", background:compSelec.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{compSelec.length}/4</span>
              </div>

              {/* Liste (groupée par parent, non dépliante) */}
              {(()=>{
                const matchS = (n:BdefNode)=>!compSearch||n.libelle.toLowerCase().includes(compSearch.toLowerCase())||n.code.includes(compSearch);
                const renderItem = (n:BdefNode)=>{
                  const sel = compSelec.includes(n.id);
                  const disabled = !sel && compSelec.length>=4;
                  const colIdx = compSelec.indexOf(n.id);
                  const col = colIdx>=0 ? BDEF_MACRO_COULEURS[colIdx%BDEF_MACRO_COULEURS.length] : "#004f91";
                  return (
                    <div key={n.id} onClick={()=>{ if(!disabled) toggleComp(n.id); }}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:6, background:"transparent", opacity:disabled?0.35:1, cursor:disabled?"not-allowed":"pointer", transition:"background 0.1s" }}
                      onMouseEnter={e=>{ if(!disabled) (e.currentTarget as HTMLElement).style.background="#F8F7F6"; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                      <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, lineHeight:1.3, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.libelle}</span>
                    </div>
                  );
                };
                const CatHeader = ({txt, open, onToggle}:{txt:string; open:boolean; onToggle:()=>void})=>(
                  <button onClick={onToggle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px", marginTop:6, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{txt}</span>
                    <ChevronDown size={11} style={{ color:"#004f91", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                  </button>
                );
                let sections: React.ReactNode;
                if (compType==="macro_secteur") {
                  sections = (refs?.macro_secteur||[]).filter(matchS).map(renderItem);
                } else if (compType==="groupe") {
                  sections = (refs?.macro_secteur||[]).map(macro=>{
                    const enfants = groupesDe(macro.id).filter(matchS);
                    if (!enfants.length) return null;
                    const open = compCatOuverts.has(`m${macro.id}`);
                    return <div key={macro.id}><CatHeader txt={macro.libelle} open={open} onToggle={()=>toggleCompCat(`m${macro.id}`)}/>{open&&enfants.map(renderItem)}</div>;
                  });
                } else {
                  sections = (refs?.groupe||[]).map(groupe=>{
                    const enfants = secteursDe(groupe.id).filter(matchS);
                    if (!enfants.length) return null;
                    const open = compCatOuverts.has(`g${groupe.id}`);
                    return <div key={groupe.id}><CatHeader txt={groupe.libelle} open={open} onToggle={()=>toggleCompCat(`g${groupe.id}`)}/>{open&&enfants.map(renderItem)}</div>;
                  });
                }
                return <div style={{ maxHeight:420, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:1 }}>{sections}</div>;
              })()}

              <div style={{ height:1, background:"#F2F0EF", margin:"18px 0" }}/>

              {/* Période */}
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                      <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-bornes[0])/span)*100}%`, width:`${Math.max(0,((anneeMax-bornes[0])/span)*100-((anneeMin-bornes[0])/span)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax?4:2} as React.CSSProperties}/>
                      <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                    {(compAnneesData.length?compAnneesData:anneesData).map(a=>{ const s=anneesSpec.includes(a); return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"#004f91":"#F8F7F6", color:s?"#fff":"#4a5568" }}>{a}</button>
                    ); })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:16 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {search&&<button onClick={()=>setSearch("")} style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
          </div>

          {/* Activités */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Activités</span>
              {sel.niveau!=="global"&&(()=>{ const c=BDEF_NIVEAU_STYLE[sel.niveau]?.color||"#004f91"; return <span style={{ fontSize:10, fontWeight:700, color:c, background:`${c}1a`, padding:"1px 6px", borderRadius:999 }}>1</span>; })()}
            </div>

            {/* Global */}
            <BdefRow label="Global des secteurs" selected={sel.niveau==="global"} onSelect={()=>choisir("global",null)} />
            <div style={{ height:1, background:"#F2F0EF", margin:"8px 0" }}/>

            {/* Recherche → résultats à plat */}
            {q ? (
              <div style={{ maxHeight:360, overflowY:"auto" as const }}>
                {resultats.length===0 && <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
                {resultats.map(({niveau,node})=>(
                  <div key={`${niveau}-${node.id}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <BdefRow label={node.libelle} niveau={niveau} selected={estSel(niveau,node.id)} onSelect={()=>choisir(niveau,node)} />
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:BDEF_NIVEAU_STYLE[niveau]?.color||"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.06em", flexShrink:0, paddingRight:4 }}>{BDEF_NIVEAU_LABEL[niveau]||""}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* Cascade Macro → Groupe → Secteur (arbre avec lignes de guidage) */
              <div style={{ maxHeight:420, overflowY:"auto" as const }}>
                {(refs?.macro_secteur||[]).map(macro=>{
                  const mOpen = openMacros.has(macro.id);
                  return (
                    <div key={macro.id} style={{ marginBottom:1 }}>
                      <BdefRow label={macro.libelle} niveau="macro_secteur" selected={estSel("macro_secteur",macro.id)}
                        onSelect={()=>choisir("macro_secteur",macro)} expandable expanded={mOpen} onToggle={()=>toggleMacro(macro.id)} />
                      {mOpen && (
                        <div style={{ marginLeft:17, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1 }}>
                          {groupesDe(macro.id).map(groupe=>{
                            const gOpen = openGroupes.has(groupe.id);
                            return (
                              <div key={groupe.id}>
                                <BdefRow label={groupe.libelle} niveau="groupe" selected={estSel("groupe",groupe.id)}
                                  onSelect={()=>choisir("groupe",groupe)} expandable expanded={gOpen} onToggle={()=>toggleGroupe(groupe.id)} />
                                {gOpen && (
                                  <div style={{ marginLeft:17, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1, marginBottom:3 }}>
                                    {secteursDe(groupe.id).map(secteur=>(
                                      <BdefRow key={secteur.id} label={secteur.libelle} niveau="secteur" selected={estSel("secteur",secteur.id)}
                                        onSelect={()=>choisir("secteur",secteur)} />
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
            )}
          </div>

          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* Période */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                  <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-bornes[0])/span)*100}%`, width:`${Math.max(0,((anneeMax-bornes[0])/span)*100-((anneeMin-bornes[0])/span)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax?4:2} as React.CSSProperties}/>
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                {anneesData.map(a=>{ const s=anneesSpec.includes(a); return (
                  <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                    style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"#004f91":"#F8F7F6", color:s?"#fff":"#4a5568" }}>{a}</button>
                ); })}
              </div>
            )}
          </div>

          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* KPI */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Key Performance Indicators</span>
              <span style={{ fontSize:11, fontWeight:600, color:kpisEpingles.length>=5?"#004f91":"#9aa5b4", background:kpisEpingles.length>=5?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{kpisEpingles.length}/5</span>
            </div>
            {parCategorie.length===0 && !loading && (
              <p style={{ fontSize:12, color:"#C5BFBB", textAlign:"center" as const, padding:"8px 0", lineHeight:1.5 }}>Importez des données BDEF<br/>pour voir les indicateurs.</p>
            )}
            {parCategorie.map(({cat,inds},ci)=>{
              const col = BDEF_CAT_COULEURS[ci%BDEF_CAT_COULEURS.length];
              const ouvert = catKpiOuverts.has(cat);
              const nbEpCat = inds.filter(i=>kpisEpingles.includes(i.code)).length;
              return (
                <div key={cat} style={{ marginBottom:3 }}>
                  <button onClick={()=>setCatKpiOuverts(p=>{const n=new Set(p);n.has(cat)?n.delete(cat):n.add(cat);return n;})}
                    style={{ display:"flex", alignItems:"center", gap:7, width:"100%", background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 8px", textAlign:"left" as const }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const, flex:1 }}>{cat}</span>
                    {nbEpCat>0&&<span style={{ fontSize:9, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.1)", padding:"1px 5px", borderRadius:4 }}>{nbEpCat}</span>}
                    <ChevronRight size={11} style={{ color:"#9aa5b4", transform:ouvert?"rotate(90deg)":"none", transition:"transform 0.15s", flexShrink:0 }}/>
                  </button>
                  {ouvert&&(
                    <div style={{ paddingLeft:8, display:"flex", flexDirection:"column" as const, gap:1, marginTop:2 }}>
                      {inds.map(ind=>{
                        const epingle = kpisEpingles.includes(ind.code);
                        const disabled = !epingle && kpisEpingles.length>=5;
                        return (
                          <div key={ind.code}
                            style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:6, background:"transparent", opacity:disabled?0.35:1, cursor:disabled?"not-allowed":"pointer", transition:"background 0.1s" }}
                            onClick={()=>{ if(!disabled) setKpisEpingles(p=>epingle?p.filter(c=>c!==ind.code):[...p,ind.code]); }}
                            onMouseEnter={ev=>{ if(!disabled) ev.currentTarget.style.background="#F8F7F6"; montrerTip(ev, defBdef(ind.code, ind.libelle)); }}
                            onMouseMove={ev=>montrerTip(ev, defBdef(ind.code, ind.libelle))}
                            onMouseLeave={ev=>{ ev.currentTarget.style.background="transparent"; setTip(null); }}>
                            <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${epingle?"#004f91":"#C5BFBB"}`, background:epingle?"#004f91":"transparent", flexShrink:0 }}/>
                            <span style={{ fontSize:12, color:"#4a5568", flex:1, lineHeight:1.3, fontWeight:epingle?700:400, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>{ind.libelle}</span>
                            <span style={{ fontSize:9, color:"#9aa5b4", fontWeight:500, flexShrink:0 }}>{ind.unite}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>)}
        </div>}
      </aside>

      {/* Zone principale */}
      <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        {sousVue==="comparative" ? (
          /* ── Analyse comparative ── */
          (()=>{
          const compNodes = compType==="groupe" ? (refs?.groupe||[]) : compType==="secteur" ? (refs?.secteur||[]) : (refs?.macro_secteur||[]);
          const nodeDe = (id:number)=>compNodes.find(n=>n.id===id);
          const typeLabel = compType==="groupe" ? "par groupe" : compType==="secteur" ? "par secteur d'activité" : "par macro-secteur";
          const typePluriel = compType==="groupe" ? "groupes" : compType==="secteur" ? "secteurs" : "macro-secteurs";
          const anneesComp = anneesCompAff;
          return (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:compSelec.length>0?10:20, flexWrap:"wrap" as const }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e", margin:0 }}>Analyse comparative {typeLabel}</h2>
                {anneesComp.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:12, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
                  {anneesComp.length===1 ? `${anneesComp[0]}` : `${anneesComp[0]} — ${anneesComp[anneesComp.length-1]}`}
                </span>}
              </div>
              {compSelec.length>0&&!loadingComp&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
                <Table size={14}/> Tableau de données
              </button>}
            </div>
            {compSelec.length>0&&(
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, minWidth:0 }}>
                {compSelec.map((id,ci)=>{
                  const node = nodeDe(id);
                  const col = BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length];
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={id} title={node?.libelle}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 13px", borderRadius:999, background:`${col}0D`, border:`1px solid ${col}2E`, fontSize:12, fontWeight:700, color:col, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:col, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{node?.libelle}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {compSelec.length===0 ? (
              <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"#9aa5b4" }}>
                <p style={{ fontSize:14, lineHeight:1.7 }}>Sélectionnez jusqu'à 4 {typePluriel} dans le filtre pour comparer leurs données.</p>
              </div>
            ) : loadingComp ? (
              <SkeletonChartGrid n={8} cols={2} height={215}/>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
                  {BDEF_GRAPHES_DEFAUT.map(code=>{
                    const fmt = (v:number|null)=>fmtBdef(v, (compData[compSelec[0]]||[]).find(i=>i.code===code)?.unite||"FCFA");
                    const compAffichees = (modeAnnees==="specifiques"&&anneesSpec.length>0)
                      ? anneesSpec.filter(a=>compAnneesData.includes(a))
                      : compAnneesData.filter(a=>a>=anneeMin && a<=anneeMax);
                    const series = compSelec.map((id,ci)=>{
                      const inds = compData[id]||[];
                      const ind = inds.find(i=>i.code===code);
                      const node = nodeDe(id);
                      return { nom:node?.libelle||String(id), couleur:BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length], data:compAffichees.map(a=>({ annee:a, valeur:(ind?.valeurs[a]??null) as number|null })) };
                    }).filter(s=>s.data.some(d=>d.valeur!==null));
                    if (!series.length) return null;
                    return (
                      <GrapheCard key={code} titre={(compData[compSelec[0]]||[]).find(i=>i.code===code)?.libelle||code} series={series} grapheId={code} hideLegend hideSousTitre
                        fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={fmt} lineWidth={1.6}/>}>
                        <GrapheMultiPays series={series} height={130} type="line" fmt={fmt} showDots={false} lineWidth={1.4}/>
                      </GrapheCard>
                    );
                  }).filter(Boolean)}
                </div>
              </>
            )}
          </div>
          );
          })()
        ) : (
        <>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap" as const, gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:couleur, flexShrink:0 }} />
            <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e", margin:0 }}>{sel.libelle}</h2>
            {BDEF_NIVEAU_LABEL[sel.niveau]&&<span style={{ display:"inline-flex", alignItems:"center", padding:"1px 7px", borderRadius:5, background:"#F2F0EF", border:"1px solid #E8E5E3", fontSize:9, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.05em", flexShrink:0 }}>
              {BDEF_NIVEAU_LABEL[sel.niveau]}
            </span>}
            {anneesAffichees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"4px 12px", borderRadius:999, background:couleur, fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
              {anneesAffichees[0]} — {anneesAffichees[anneesAffichees.length-1]}
            </span>}
          </div>
          {indicateurs.length>0&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
            <Table size={14}/> Tableau de données
          </button>}
        </div>

        {/* KPI cards */}
        {kpisEpingles.length>0&&(
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
            {kpisEpingles.map(code=>{
              const ind = indicateurs.find(i=>i.code===code);
              const lastA = anneesAffichees.length ? anneesAffichees[anneesAffichees.length-1] : null;
              const v = ind&&lastA!==null ? (ind.valeurs[lastA]??null) : null;
              return (
                <div key={code} onClick={()=>ind&&setKpiActif(ind)}
                  style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1px solid #ECEAE7", cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", minWidth:0, overflow:"hidden" }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=`${couleur}40`; if(ind) montrerTip(e, defBdef(ind.code, ind.libelle));}}
                  onMouseMove={e=>{ if(ind) montrerTip(e, defBdef(ind.code, ind.libelle)); }}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor="#ECEAE7"; setTip(null);}}>
                  <p style={{ fontSize:9, fontWeight:800, color:couleur, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:7, lineHeight:1.4 }}>{ind?.libelle??code}</p>
                  <p style={{ fontSize:"1.05rem", fontWeight:800, color:"#1a1a2e", lineHeight:1.15 }}>{ind?fmtBdef(v,ind.unite,true):"—"}</p>
                  {lastA&&<p style={{ fontSize:10, color:"#9aa5b4", marginTop:5, lineHeight:1 }}>en {lastA}</p>}
                </div>
              );
            })}
            {Array.from({length:Math.max(0,5-kpisEpingles.length)}).map((_,i)=>(
              <div key={`empty-${i}`} style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1.5px dashed #E8E5E3", display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90 }}>
                <span style={{ fontSize:20, color:"#C5BFBB", lineHeight:1 }}>+</span>
                <span style={{ fontSize:10, color:"#C5BFBB", textAlign:"center" as const, lineHeight:1.5 }}>Choisir dans<br/>le filtre</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <SkeletonChartGrid n={8} cols={2} height={215}/>
        ) : indicateurs.length===0 ? (
          <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"#9aa5b4" }}>
            <p style={{ fontSize:14, lineHeight:1.7 }}>Aucune donnée pour cette sélection.<br/>Importez les fichiers BDEF dans l'administration.</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {BDEF_GRAPHES_DEFAUT
              .map(code=>indicateurs.find(i=>i.code===code))
              .filter((i):i is BdefIndic=>!!i)
              .map((ind)=>{
                const fmt = (v:number|null)=>fmtBdef(v,ind.unite);
                const isGlobal = sel.niveau==="global" && macroIndicateurs.length>0;
                let series;
                if (isGlobal) {
                  // Comparaison des 4 macro-secteurs (Industries en bleu)
                  series = macroIndicateurs.map((m,mi)=>{
                    const mInd = m.inds.find(i=>i.code===ind.code);
                    return { nom:m.libelle, couleur:BDEF_MACRO_COULEURS[mi%BDEF_MACRO_COULEURS.length], data:anneesAffichees.map(a=>({ annee:a, valeur:(mInd?.valeurs[a]??null) as number|null })) };
                  });
                } else {
                  series = [{ nom:ind.libelle, couleur, data:anneesAffichees.map(a=>({ annee:a, valeur:(ind.valeurs[a]??null) as number|null })) }];
                }
                return (
                  <GrapheCard key={ind.code} titre={ind.libelle} series={series} grapheId={ind.code} hideLegend={!isGlobal} hideSousTitre
                    fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={fmt} lineWidth={isGlobal?1.6:undefined}/>}>
                    <GrapheMultiPays series={series} height={130} type="line" fmt={fmt} showDots={false} lineWidth={isGlobal?1.4:undefined}/>
                  </GrapheCard>
                );
              })}
          </div>
        )}
        </>
        )}
      </div>

      <ModalBdefTable open={showTable} onClose={()=>setShowTable(false)}
        annees={sousVue==="comparative" ? anneesCompAff : anneesAffichees}
        blocs={sousVue==="comparative"
          ? compSelec.map((id,ci)=>{
              const nodes = compType==="groupe" ? (refs?.groupe||[]) : compType==="secteur" ? (refs?.secteur||[]) : (refs?.macro_secteur||[]);
              const n = nodes.find(x=>x.id===id);
              return { libelle:n?.libelle||String(id), couleur:BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length], indicateurs:compData[id]||[] };
            })
          : [{ libelle:sel.libelle, couleur, indicateurs }]} />
      <MiniModalBdefKpi ind={kpiActif} annees={anneesAffichees} libelle={sel.libelle} onClose={()=>setKpiActif(null)} />

      {/* Tooltip de définition au survol */}
      {tip && (()=>{
        const vw = typeof window!=="undefined"?window.innerWidth:1200;
        const vh = typeof window!=="undefined"?window.innerHeight:800;
        const tipW = 280, tipH = 120;
        const left = Math.min(tip.x+14, vw-tipW-8);
        const below = tip.y+16+tipH < vh;
        return (
          <div style={{ position:"fixed", left, top:below?tip.y+16:tip.y-tipH-8, zIndex:800, maxWidth:tipW, background:"#1a1a2e", color:"#fff", fontSize:12, lineHeight:1.6, padding:"10px 12px", borderRadius:10, boxShadow:"0 8px 28px rgba(0,0,0,0.25)", pointerEvents:"none" as const }}>
            {tip.text}
          </div>
        );
      })()}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  const [ongletPrincipal, setOngletPrincipal] = useState<"ide"|"national">("ide");
  const [section,    setSection]    = useState<"realises"|"projetes">("realises");
  const [sousOnglet, setSousOnglet] = useState<"pays"|"comparative"|"monde">("pays");
  const [sousType,   setSousType]   = useState<"fluxstock"|"greenfield"|"fusion">("fluxstock");
  const [paysDispo,  setPaysDispo]  = useState<any[]>([]);
  const [showTable,  setShowTable]  = useState(false);

  useEffect(() => {
    fetch(`${API}/ide/cnuced/pays-disponibles`).then(r=>r.json()).then(d=>setPaysDispo(d||[])).catch(()=>{});
  }, []);

  useEffect(() => { setShowTable(false); }, [sousOnglet, section]);

  return (
    <div style={{ minHeight:"100vh", background:"#F6F5F3", fontFamily:"var(--font-google-sans)" }}>
      <div id="d3-tooltip" style={{ position:"fixed", pointerEvents:"none", background:"rgba(26,26,46,0.92)", color:"#fff", borderRadius:8, padding:"8px 12px", fontSize:12, lineHeight:1.5, opacity:0, zIndex:9999, backdropFilter:"blur(4px)" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <BarreTitre titre="Investissements Privés">
        <BarreTitreSegment options={[{v:"ide",l:"Investissements Directs Étrangers"},{v:"national",l:"Investissements nationaux"}]} value={ongletPrincipal} onChange={setOngletPrincipal}/>
      </BarreTitre>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <div style={{ background:"#fff", position:"sticky" as const, top:0, zIndex:10, flexShrink:0, borderBottom:"1px solid #ECEAE7" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"10px 40px" }}>

            {/* Niveau 1 : Réalisés / Projetés — segmented control du site */}
            <div style={{ display:"inline-flex", background:"#F2F0EF", borderRadius:999, padding:3, gap:3 }}>
              {([
                {v:"realises", l:"Investissements réalisés"},
                {v:"projetes", l:"Investissements projetés"},
              ] as const).map(s=>(
                <button key={s.v} onClick={()=>setSection(s.v)}
                  style={{ padding:"6px 16px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, background:section===s.v?"#fff":"transparent", color:section===s.v?"#004f91":"#9aa5b4", boxShadow:section===s.v?"0 1px 4px rgba(0,0,0,0.10)":"none", fontFamily:"var(--font-google-sans)", transition:"all 0.15s", whiteSpace:"nowrap" as const }}>
                  {s.l}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Contenu — IDE ────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <>
          {/* Investissements réalisés (CNUCED) */}
          {section === "realises" && (
            <>
              {sousOnglet === "pays"        && <OngletPays paysDispo={paysDispo} showTable={showTable} setShowTable={setShowTable} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType}/>}
              {sousOnglet === "comparative" && <OngletAnalyseComparative paysDispo={paysDispo} showTable={showTable} setShowTable={setShowTable} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType}/>}
              {sousOnglet === "monde"       && <OngletMonde showTable={showTable} setShowTable={setShowTable} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType}/>}
            </>
          )}
          {/* Investissements projetés (FDI Markets) */}
          {section === "projetes" && (
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
        </>
      )}

      {/* ── Contenu — Investissements nationaux ──────────────────────────────── */}
      {ongletPrincipal === "national" && <OngletNational />}
    </div>
  );
}
