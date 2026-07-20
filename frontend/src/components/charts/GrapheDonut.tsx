"use client";

import { useCallback, useEffect, useRef } from "react";
import { d3 } from "@/lib/d3lazy";
import { fmtCompact as fmtValGen } from "@/lib/format";
import { showD3Tooltip, hideD3Tooltip } from "@/components/charts/outilsTooltip";

// ── Anneau de composition (style tableau de bord, légende latérale) ────────────
// Rampe bleue #003468 (part la plus élevée) → #EDF4FB (la plus faible).
export function GrapheDonut({ data, fmt, height }: { data: { label: string; valeur: number }[]; fmt?: (v: number | null) => string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current || !wrapRef.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    const positifs = data.filter(d => d.valeur > 0);
    const total = d3.sum(positifs, d => d.valeur);
    // On masque les parts qui arrondissent à 0,0 % (invisibles sur l'anneau).
    const items = total > 0 ? positifs.filter(d => d.valeur / total * 100 >= 0.05) : [];
    if (!items.length) return;
    const n = items.length;
    const couleur = (i: number) => d3.interpolateRgb("#003468", "#EDF4FB")(n > 1 ? i / (n - 1) : 0) as string;

    const W = wrapRef.current.clientWidth || el.parentElement?.clientWidth || 600;
    const H = height ?? Math.max(230, n * 22 + 44);
    // Largeur de contenu plafonnée puis centrée : évite que la légende s'étire
    // sur toute la largeur (notamment en plein écran).
    const CW = Math.min(W, 760);
    const ox = (W - CW) / 2;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const R = Math.min(H - 24, CW * 0.42) / 2;
    const cx = ox + R + 14, cy = H / 2;
    const bigFont = R >= 120 ? 22 : R >= 95 ? 18 : 15;
    // Angles pondérés en racine carrée pour rendre visibles les petites parts ;
    // le total au centre et les % de la légende restent les vraies proportions.
    const pie = d3.pie<any>().value(d => Math.sqrt(d.valeur)).sort(null);
    const arc = d3.arc<any>().innerRadius(R * 0.58).outerRadius(R);
    const arcH = d3.arc<any>().innerRadius(R * 0.58).outerRadius(R + 5);
    const tooltip = d3.select("#d3-tooltip") as any;
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    g.selectAll("path").data(pie(items)).enter().append("path")
      .attr("d", arc as any).attr("fill", (_d, i) => couleur(i)).attr("opacity", 0.9)
      .style("cursor", "pointer")
      .on("mouseover", function (e, d: any) { d3.select(this).attr("d", arcH(d) as string).attr("opacity", 1); showD3Tooltip(tooltip, e, `<strong>${d.data.label}</strong><br/>${fmtV(d.data.valeur)} · ${(d.data.valeur / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`); })
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", function (_e, d: any) { d3.select(this).attr("d", arc(d) as string).attr("opacity", 0.9); hideD3Tooltip(tooltip); });

    // Total au centre
    g.append("text").attr("text-anchor", "middle").attr("dy", "-.05em").style("font-size", `${bigFont}px`).style("font-weight", "800").style("fill", "#1a1a2e").text(fmtV(total));
    g.append("text").attr("text-anchor", "middle").attr("dy", "1.5em").style("font-size", `${Math.max(9.5, bigFont * 0.55)}px`).style("fill", "#9aa5b4").text("total");

    // Légende (part la plus forte en haut, couleur assortie)
    const lgFont = R >= 120 ? 13 : 11;
    const rowH = R >= 120 ? 24 : 20;
    const lx = cx + R + 24;
    const rightX = ox + CW - 6;
    let ly = cy - (n * rowH) / 2 + rowH / 2;
    const legend = svg.append("g");
    const maxc = Math.max(8, Math.floor((rightX - lx - 60) / (lgFont * 0.58)));
    items.forEach((d, i) => {
      const pct = (d.valeur / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
      let lbl = d.label; if (lbl.length > maxc) lbl = lbl.slice(0, maxc - 1) + "…";
      const row = legend.append("g").attr("transform", `translate(${lx},${ly})`);
      row.append("rect").attr("x", 0).attr("y", -8).attr("width", 11).attr("height", 11).attr("rx", 2).attr("fill", couleur(i)).attr("stroke", "#E8E5E3").attr("stroke-width", 0.5);
      row.append("text").attr("x", 18).attr("y", 0).attr("dy", "0.04em").style("font-size", `${lgFont}px`).style("fill", "#4a5568").text(lbl);
      row.append("text").attr("x", rightX - lx).attr("y", 0).attr("dy", "0.04em").attr("text-anchor", "end").style("font-size", `${lgFont}px`).style("font-weight", "700").style("fill", "#1a1a2e").text(`${pct}%`);
      ly += rowH;
    });
  }, [data, fmtV, height]);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver(() => draw()); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", height, display: "block" }} /></div>;
}
