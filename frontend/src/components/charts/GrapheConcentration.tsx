"use client";

import { useCallback, useEffect, useRef } from "react";
import { d3 } from "@/lib/d3lazy";
import { showD3Tooltip, hideD3Tooltip } from "@/components/charts/outilsTooltip";

// ── Courbe de concentration (Pareto) : lollipops (part) + courbe cumulée ───────
export function GrapheConcentration({ points, height = 200 }: { points: { rang: number; nom: string; part: number; part_cumulee: number }[]; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!points.length) return;
    const W = el.parentElement?.clientWidth || 600;
    const H = height;
    const M = { top: 12, right: 18, bottom: 28, left: 44 };
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const pts = [{ rang: 0, nom: "", part: 0, part_cumulee: 0 }, ...points];
    const maxRang = points[points.length - 1].rang;
    const x = d3.scaleLinear().domain([0, maxRang]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([H - M.bottom, M.top]);
    const tooltip = d3.select("#d3-tooltip") as any;
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", "#EBEBEB").attr("stroke-width", 1);
    const gid = "concGrad";
    const grad = svg.append("defs").append("linearGradient").attr("id", gid).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#004f91").attr("stop-opacity", 0.12);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#004f91").attr("stop-opacity", 0);
    svg.append("path").datum(pts).attr("fill", `url(#${gid})`)
      .attr("d", d3.area<any>().x(d => x(d.rang)).y0(y(0)).y1(d => y(d.part_cumulee)).curve(d3.curveMonotoneX));

    // Lollipops : part individuelle de chaque débouché (tige fine + pastille)
    const dotR = points.length > 30 ? 2.2 : points.length > 18 ? 2.8 : 3.4;
    const lol = svg.append("g");
    lol.selectAll("line").data(points).enter().append("line")
      .attr("x1", d => x(d.rang)).attr("x2", d => x(d.rang)).attr("y1", y(0)).attr("y2", d => y(d.part))
      .attr("stroke", "#5596D4").attr("stroke-width", 1.6).attr("stroke-linecap", "round");
    lol.selectAll("circle").data(points).enter().append("circle")
      .attr("cx", d => x(d.rang)).attr("cy", d => y(d.part)).attr("r", dotR)
      .attr("fill", "#2872B8").style("pointer-events", "none");

    // Courbe cumulée par-dessus
    svg.append("path").datum(pts).attr("fill", "none").attr("stroke", "#004f91").attr("stroke-width", 2.2)
      .attr("d", d3.line<any>().x(d => x(d.rang)).y(d => y(d.part_cumulee)).curve(d3.curveMonotoneX));

    // Cibles de survol (colonne complète)
    const bw = Math.max(6, (x(1) - x(0)) * 0.9);
    svg.selectAll("rect.hit").data(points).enter().append("rect")
      .attr("x", d => x(d.rang) - bw / 2).attr("y", M.top).attr("width", bw).attr("height", H - M.bottom - M.top)
      .attr("fill", "transparent").style("cursor", "pointer")
      .on("mouseover", (e, d) => showD3Tooltip(tooltip, e, `<strong>Top ${d.rang} — ${d.nom}</strong><br/>Part : ${d.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % · Cumulé : ${d.part_cumulee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`))
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", () => hideD3Tooltip(tooltip));
    svg.append("g").attr("transform", `translate(${M.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d => `${d}%`))
      .call(g => g.select(".domain").remove()).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    const xticks = x.ticks(Math.min(maxRang, 6)).filter(t => Number.isInteger(t) && t >= 1);
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`).call(d3.axisBottom(x).tickValues(xticks).tickFormat(d3.format("d")).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#E8E5E3")).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
  }, [points, height]);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver(() => draw()); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", height, display: "block" }} /></div>;
}
