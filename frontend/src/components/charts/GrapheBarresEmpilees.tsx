"use client";

import { useCallback, useEffect, useRef } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtCompact as fmtValGen } from "@/lib/format";
import { showD3Tooltip, hideD3Tooltip } from "@/components/charts/outilsTooltip";

// ── Barres horizontales empilées (par partenaire × ressource) ─────────────────
export function GrapheBarresEmpilees({ partenaires, ressources, fmt, rowH = 36, exposant = 0.5, showLegend = true }: {
  partenaires: { nom: string; total: number; valeurs: number[] }[]; ressources: string[];
  fmt?: (v: number | null) => string; rowH?: number; exposant?: number; showLegend?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current || !wrapRef.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!partenaires.length || !ressources.length) return;
    const W = wrapRef.current.clientWidth || el.parentElement?.clientWidth || 600;
    const mctx = document.createElement("canvas").getContext("2d")!;
    // Rampe bleue comme l'anneau : ressource la plus lourde (index 0) = plus foncé.
    const nRes = ressources.length;
    const col = (i: number) => d3.interpolateRgb("#003468", "#EDF4FB")(nRes > 1 ? i / (nRes - 1) : 0) as string;

    // Légende des ressources (chips, avec retour à la ligne) — masquée sur la carte
    const legRowH = 20;
    let legendH = 0;
    let lines: { label: string; i: number; w: number }[][] = [];
    if (showLegend) {
      mctx.font = "600 11px 'Google Sans',sans-serif";
      const chips = ressources.map((r, i) => ({ label: r, i, w: Math.ceil(mctx.measureText(r).width) + 24 }));
      let line: typeof chips = []; let lw = 0;
      chips.forEach(c => { if (lw + c.w > W && line.length) { lines.push(line); line = []; lw = 0; } line.push(c); lw += c.w + 10; });
      if (line.length) lines.push(line);
      legendH = lines.length * legRowH + 8;
    }

    const longest = Math.max(...partenaires.map(p => p.nom.length));
    const M = { top: legendH + 4, right: 78, bottom: 8, left: Math.min(230, Math.max(90, Math.round(longest * 6.2) + 14)) };
    const N = partenaires.length;
    const H = M.top + N * rowH + M.bottom;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const tooltip = d3.select("#d3-tooltip") as any;

    // Légende
    let ly = 12;
    lines.forEach(ln => {
      let lx = 0;
      ln.forEach(c => {
        svg.append("rect").attr("x", lx).attr("y", ly - 9).attr("width", 11).attr("height", 11).attr("rx", 2).attr("fill", col(c.i));
        svg.append("text").attr("x", lx + 17).attr("y", ly).attr("dy", "0.32em").style("font-size", "11px").style("fill", "#4a5568").text(c.label);
        lx += c.w + 10;
      });
      ly += legRowH;
    });

    const maxTotal = d3.max(partenaires, p => p.total) || 1;
    const x = d3.scalePow().exponent(exposant).domain([0, maxTotal]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(partenaires.map(p => p.nom)).range([M.top, H - M.bottom]).padding(0.3);

    partenaires.forEach(p => {
      const barW = Math.max(0, x(p.total) - M.left);
      // Chaque ressource présente reçoit une largeur plancher (visible même minime),
      // le reste étant réparti en racine ; valeurs/% du tooltip restent réels.
      const present = ressources.map((res, ri) => ({ res, ri, v: p.valeurs[ri] || 0 })).filter(o => o.v > 0);
      const k = present.length;
      const floorPx = 4;
      const hasFloor = barW >= k * floorPx;
      const reste = hasFloor ? barW - k * floorPx : barW;
      const racSum = present.reduce((s, o) => s + Math.pow(o.v, exposant), 0) || 1;
      let xc = M.left;
      present.forEach(({ res, ri, v }) => {
        const segW = (hasFloor ? floorPx : 0) + (Math.pow(v, exposant) / racSum) * reste;
        svg.append("rect").attr("x", xc).attr("y", y(p.nom)!).attr("width", Math.max(0.5, segW)).attr("height", y.bandwidth())
          .attr("fill", col(ri)).attr("stroke", "#fff").attr("stroke-width", 0.6).style("cursor", "pointer")
          .on("mouseover", function (e) { d3.select(this).attr("opacity", 0.82); showD3Tooltip(tooltip, e, `<strong>${p.nom} — ${res}</strong><br/>${fmtV(v)} · ${(v / p.total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`); })
          .on("mousemove", (e) => showD3Tooltip(tooltip, e))
          .on("mouseout", function () { d3.select(this).attr("opacity", 1); hideD3Tooltip(tooltip); });
        xc += segW;
      });
      svg.append("text").attr("x", M.left - 8).attr("y", y(p.nom)! + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").style("font-size", "11px").style("fill", "#4a5568").text(p.nom);
      svg.append("text").attr("x", x(p.total) + 6).attr("y", y(p.nom)! + y.bandwidth() / 2).attr("dy", "0.35em").style("font-size", "10.5px").style("font-weight", "700").style("fill", "#9aa5b4").text(fmtV(p.total));
    });
  }, [partenaires, ressources, fmtV, rowH, exposant]);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver(() => draw()); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", display: "block" }} /></div>;
}
