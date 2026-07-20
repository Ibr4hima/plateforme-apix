"use client";

import { useCallback, useEffect, useRef } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtCompact as fmtValGen } from "@/lib/format";
import { showD3Tooltip, hideD3Tooltip } from "@/components/charts/outilsTooltip";

// ── Barres horizontales (top N) ───────────────────────────────────────────────
export function GrapheBarresH({ data, fmt, couleur = "#004f91", rowH = 34, exposant = 0.5 }: {
  data: { label: string; valeur: number }[]; fmt?: (v: number | null) => string; couleur?: string; rowH?: number; exposant?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current || !wrapRef.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!data.length) return;
    const W = wrapRef.current.clientWidth || el.parentElement?.clientWidth || 600;
    const longest = Math.max(...data.map(d => d.label.length));
    const M = { top: 6, right: 78, bottom: 6, left: Math.min(230, Math.max(90, Math.round(longest * 6.2) + 14)) };
    const H = data.length * rowH + M.top + M.bottom;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const maxVal = d3.max(data, d => d.valeur) || 1;
    // Échelle en puissance (racine carrée par défaut) : rééquilibre les barres
    // quand les valeurs sont très dispersées, sans changer les valeurs affichées.
    const x = d3.scalePow().exponent(exposant).domain([0, maxVal]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(data.map(d => d.label)).range([M.top, H - M.bottom]).padding(0.28);
    const tooltip = d3.select("#d3-tooltip") as any;

    svg.selectAll("rect.bar").data(data).enter().append("rect")
      .attr("x", M.left).attr("y", d => y(d.label)!).attr("height", y.bandwidth())
      .attr("width", d => Math.max(2, x(d.valeur) - M.left)).attr("fill", couleur)
      .style("cursor", "pointer")
      .on("mouseover", (e, d) => { d3.select(e.currentTarget as any).attr("opacity", 0.8); showD3Tooltip(tooltip, e, `<strong>${d.label}</strong><br/>${fmtV(d.valeur)}`); })
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", (e) => { d3.select(e.currentTarget as any).attr("opacity", 1); hideD3Tooltip(tooltip); });

    svg.selectAll("text.lbl").data(data).enter().append("text")
      .attr("x", M.left - 8).attr("y", d => y(d.label)! + y.bandwidth() / 2).attr("dy", "0.35em")
      .attr("text-anchor", "end").style("font-size", "11px").style("fill", "#4a5568").text(d => d.label);

    svg.selectAll("text.val").data(data).enter().append("text")
      .attr("x", d => x(d.valeur) + 6).attr("y", d => y(d.label)! + y.bandwidth() / 2).attr("dy", "0.35em")
      .style("font-size", "10.5px").style("fill", "#9aa5b4").style("font-weight", "700").text(d => fmtV(d.valeur));
  }, [data, fmtV, couleur, rowH]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", display: "block" }} /></div>;
}
