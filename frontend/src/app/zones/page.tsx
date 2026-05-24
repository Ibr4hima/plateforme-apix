"use client";

import Navbar from "@/components/layout/Navbar";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TYPE_LABELS: Record<string, string> = {
  ZES: "Zones Économiques Spéciales",
  ZAI: "Zones Aménagées pour l'Investissement",
  ZFI: "Zones Franches Industrielles",
};

const TYPE_COLORS: Record<string, string> = {
  ZES: "#efd0bc",
  ZAI: "#b2cade",
  ZFI: "#b9d9c3",
};


const POLE_COLORS: string[] = [
  "#efd0bc", // 1 - orange clair (ZES)
  "#b2cade", // 2 - bleu clair (ZAI)
  "#b9d9c3", // 3 - vert clair (ZFI)
  "#f5e6c8", // 4 - jaune doux
  "#d4c5e8", // 5 - lavande
  "#fadadd", // 6 - rose poudré
  "#c8e6e8", // 7 - turquoise clair
  "#e8d5c4", // 8 - sable chaud
];

interface ZoneData {
  id: string; nom_zone: string; type_zone: string;
  entreprises: { entreprise?: { id: number; nom: string; forme_juridique?: string } }[];
}

interface HNode {
  name: string; value?: number; type?: string; data?: any; children?: HNode[];
}

function buildTree(zones: ZoneData[]): HNode {
  const byType: Record<string, ZoneData[]> = {};
  zones.forEach(z => {
    if (!byType[z.type_zone]) byType[z.type_zone] = [];
    byType[z.type_zone].push(z);
  });
  const totalZones = zones.length;
  return {
    name: "Zones d'Investissement",
    value: totalZones,
    children: Object.entries(byType).map(([type, zs]) => ({
      name: TYPE_LABELS[type] || type,
      type,
      value: zs.length,
      children: zs.map(z => ({
        name: z.nom_zone,
        type,
        value: 1,
        data: z,
        children: z.entreprises.length > 0
          ? z.entreprises.map(ze => ({
              name: ze.entreprise?.nom || "—",
              type,
              value: 1,
              data: ze.entreprise,
            }))
          : undefined,
      })),
    })),
  };
}


interface PoleTreeData {
  id: number; name: string; zones: ZoneData[];
}

function buildPolesTree(zones: ZoneData[]): any {
  const byPole: Record<string, ZoneData[]> = {};
  const poleNames: Record<string, string> = {};
  zones.forEach((z: any) => {
    const pid = String(z.pole_id || "sans-pole");
    const pnom = z.pole_nom || "Sans pôle";
    if (!byPole[pid]) { byPole[pid] = []; poleNames[pid] = pnom; }
    byPole[pid].push(z);
  });
  const poleEntries = Object.entries(byPole).filter(([k]) => k !== "sans-pole");
  return {
    name: "Pôles Territoire",
    children: poleEntries.map(([pid, zs], pi) => ({
      name: poleNames[pid],
      poleIndex: pi,
      children: zs.map((z: any) => ({
        name: z.nom_zone,
        poleIndex: pi,
        type: z.type_zone,
        value: 1,
        data: z,
        children: z.entreprises?.length > 0
          ? z.entreprises.map((ze: any) => ({
              name: ze.entreprise?.nom || "—",
              poleIndex: pi,
              value: 1,
              data: ze.entreprise,
            }))
          : undefined,
      })),
    })),
  };
}

export default function ZonesPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, zes: 0, zai: 0, zfi: 0, entreprises: 0 });
  const [onglet, setOnglet] = useState("zones");
  const svgPolesRef = useRef<SVGSVGElement>(null);
  const containerPolesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const safe = (p: Promise<any>) => p.catch(() => []);
    Promise.all([
      safe(fetch(`${API_BASE}/zones-types?type_zone=ZES`).then(r => r.json())),
      safe(fetch(`${API_BASE}/zones-types?type_zone=ZAI`).then(r => r.json())),
      safe(fetch(`${API_BASE}/zones-types?type_zone=ZFI`).then(r => r.json())),
    ]).then(([zes, zai, zfi]) => {
      const all = [...(zes||[]), ...(zai||[]), ...(zfi||[])];
      setZones(all);
      const totalEnt = all.reduce((s: number, z: any) => s + z.entreprises.length, 0);
      setStats({ total: all.length, zes: (zes||[]).length, zai: (zai||[]).length, zfi: (zfi||[]).length, entreprises: totalEnt });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!zones.length || onglet !== "zones") return;
    const timer = setTimeout(() => {
    if (!svgRef.current || !containerRef.current) return;
    const el = svgRef.current;
    const W = containerRef.current.clientWidth || 960;
    const H = 560;
    d3.select(el).selectAll("*").remove();

    const hierarchy = d3.hierarchy(buildTree(zones))
      .sum((d: any) => d.children ? 0 : 1)
      .sort((a, b) => (b.height - a.height) || ((b.value||0) - (a.value||0)));
    const root = d3.partition<HNode>()
      .size([H, (hierarchy.height + 1) * W / 3])(hierarchy as any);

    const svg = d3.select(el)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", W).attr("height", H)
      .attr("style", "max-width:100%;height:auto;");

    const getTypeKey = (d: any): string => { let n = d; while (n.depth > 1) n = n.parent; return n.data.type || ""; };
    const getColor = (d: any): string => {
      if (d.depth === 0) return "#F2F2F2";
      const c = TYPE_COLORS[getTypeKey(d)] || "#9aa5b4";
      const alpha = 0.15 + d.depth * 0.18;
      return c + Math.round(Math.min(alpha, 0.9) * 255).toString(16).padStart(2, "0");
    };
    const rectH = (d: any) => Math.max(0, d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2));
    const labelVisible = (d: any) => d.y1 <= W && d.y0 >= 0 && d.x1 - d.x0 > 16;

    const cell = svg.selectAll<SVGGElement, any>("g")
      .data(root.descendants()).join("g")
      .attr("transform", (d: any) => `translate(${d.y0},${d.x0})`);

    const rect = cell.append("rect")
      .attr("width", (d: any) => Math.max(0, d.y1 - d.y0 - 1))
      .attr("height", (d: any) => rectH(d))
      .attr("fill", getColor)
      .attr("stroke", "#F2F0EF")
      .attr("stroke-width", 0.05)
      .style("cursor", "pointer");

    const text = cell.append("text")
      .style("user-select", "none")
      .attr("pointer-events", "none")
      .attr("x", 6).attr("y", 14)
      .attr("font-size", (d: any) => d.depth === 0 ? 15 : d.depth === 1 ? 14 : 12)
      .attr("font-weight", (d: any) => d.depth <= 1 ? 700 : 500)
      .attr("font-family", "var(--font-google-sans),sans-serif")
      .attr("fill", "#4a5568")
      .attr("fill-opacity", (d: any) => +labelVisible(d));

    text.append("tspan").text((d: any) => {
      const w = (d.y1 - d.y0) - 12;
      const name = d.data.name || "";
      const chars = Math.floor(w / 7);
      return name.length > chars ? name.slice(0, Math.max(3, chars - 1)) + "…" : name;
    });

    let focus = root;
    rect.on("click", function(_event: any, p: any) {
      focus = focus === p ? (p = p.parent) : p;
      if (!p) return;
      root.each((d: any) => {
        d.target = {
          x0: (d.x0 - p.x0) / (p.x1 - p.x0) * H,
          x1: (d.x1 - p.x0) / (p.x1 - p.x0) * H,
          y0: d.y0 - p.y0, y1: d.y1 - p.y0,
        };
      });
      const t = cell.transition().duration(750).ease(d3.easeCubicInOut)
        .attr("transform", (d: any) => `translate(${d.target.y0},${d.target.x0})`);
      rect.transition(t).attr("height", (d: any) => rectH(d.target));
      text.transition(t).attr("fill-opacity", (d: any) => +labelVisible(d.target));
    });

    cell.append("title").text((d: any) =>
      d.ancestors().map((n: any) => n.data.name).reverse().join(" › ")
    );
    }, 0);
    return () => clearTimeout(timer);
  }, [zones, onglet]);


  useEffect(() => {
    if (onglet !== "poles" || !zones.length) return;
    const timerPoles = setTimeout(() => {
    if (!svgPolesRef.current || !containerPolesRef.current) return;
    const el = svgPolesRef.current;
    const W = containerPolesRef.current.clientWidth || 960;
    const H = 560;
    d3.select(el).selectAll("*").remove();

    const hierarchy = d3.hierarchy(buildPolesTree(zones))
      .sum((d: any) => d.children ? 0 : 1)
      .sort((a, b) => (b.height - a.height) || ((b.value||0) - (a.value||0)));
    const root = d3.partition<any>()
      .size([H, (hierarchy.height + 1) * W / 3])(hierarchy as any);

    const svg = d3.select(el)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", W).attr("height", H)
      .attr("style", "max-width:100%;height:auto;");

    const getColor = (d: any): string => {
      if (d.depth === 0) return "#F2F2F2";
      const pi = d.data.poleIndex ?? 0;
      const c = POLE_COLORS[pi % POLE_COLORS.length];
      const alpha = 0.15 + d.depth * 0.18;
      return c + Math.round(Math.min(alpha, 0.9) * 255).toString(16).padStart(2, "0");
    };
    const rectH = (d: any) => Math.max(0, d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2));
    const labelVisible = (d: any) => d.y1 <= W && d.y0 >= 0 && d.x1 - d.x0 > 16;

    const cell = svg.selectAll<SVGGElement, any>("g")
      .data(root.descendants()).join("g")
      .attr("transform", (d: any) => `translate(${d.y0},${d.x0})`);

    const rect = cell.append("rect")
      .attr("width", (d: any) => Math.max(0, d.y1 - d.y0 - 1))
      .attr("height", (d: any) => rectH(d))
      .attr("fill", getColor)
      .attr("stroke", "#F2F0EF")
      .attr("stroke-width", 0.05)
      .style("cursor", "pointer");

    const text = cell.append("text")
      .style("user-select", "none")
      .attr("pointer-events", "none")
      .attr("x", 6).attr("y", 14)
      .attr("font-size", (d: any) => d.depth === 0 ? 15 : d.depth === 1 ? 14 : 12)
      .attr("font-weight", (d: any) => d.depth <= 1 ? 700 : 500)
      .attr("font-family", "var(--font-google-sans),sans-serif")
      .attr("fill", "#4a5568")
      .attr("fill-opacity", (d: any) => +labelVisible(d));

    text.append("tspan").text((d: any) => {
      const w = (d.y1 - d.y0) - 12;
      const name = d.data.name || "";
      const chars = Math.floor(w / 7);
      return name.length > chars ? name.slice(0, Math.max(3, chars - 1)) + "…" : name;
    });

    let focus = root;
    rect.on("click", function(_event: any, p: any) {
      focus = focus === p ? (p = p.parent) : p;
      if (!p) return;
      root.each((d: any) => {
        d.target = {
          x0: (d.x0 - p.x0) / (p.x1 - p.x0) * H,
          x1: (d.x1 - p.x0) / (p.x1 - p.x0) * H,
          y0: d.y0 - p.y0, y1: d.y1 - p.y0,
        };
      });
      const t = cell.transition().duration(750).ease(d3.easeCubicInOut)
        .attr("transform", (d: any) => `translate(${d.target.y0},${d.target.x0})`);
      rect.transition(t).attr("height", (d: any) => rectH(d.target));
      text.transition(t).attr("fill-opacity", (d: any) => +labelVisible(d.target));
    });

    cell.append("title").text((d: any) =>
      d.ancestors().map((n: any) => n.data.name).reverse().join(" › ")
    );
    }, 0);
    return () => clearTimeout(timerPoles);
  }, [zones, onglet]);

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "100px 40px 32px", background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", position: "relative" as const, overflow: "hidden" }}>
        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute" as const, bottom: "-20%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)" }} />
        </div>
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" as const, zIndex: 1 }}>
<div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
                    <h1 style={{ fontWeight: 800, fontSize: "clamp(2.2rem,4vw,3.2rem)", color: "#fff", lineHeight: 1.1, marginBottom: 8 }}>Zones d'Investissement</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 28 }}>Cartographie interactive des zones économiques spéciales, zones aménagées et zones franches industrielles du Sénégal.</p>
          {/* Onglets */}
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 3, width: "fit-content", border: "1px solid rgba(255,255,255,0.08)" }}>
            {[{ key: "zones", label: "Zones d'investissement" }, { key: "poles", label: "Pôles territoire" }].map(o => (
              <button key={o.key} onClick={() => setOnglet(o.key)}
                style={{ padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s", background: onglet === o.key ? "#ca631f" : "transparent", color: onglet === o.key ? "#fff" : "rgba(255,255,255,0.45)" }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding: "36px 40px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {onglet === "zones" && (
          <div ref={containerRef} style={{ background: "transparent", overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 560, gap: 12, color: "#9aa5b4" }}>
                <div style={{ width: 20, height: 20, border: "2px solid rgba(202,99,31,0.2)", borderTopColor: "#ca631f", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 14 }}>Chargement…</span>
              </div>
            ) : (
              <svg ref={svgRef} style={{ width: "100%", height: 560, display: "block" }} />
            )}
          </div>
        )}
        {onglet === "poles" && (
          <div ref={containerPolesRef} style={{ background: "transparent", overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 560, gap: 12, color: "#9aa5b4" }}>
                <div style={{ width: 20, height: 20, border: "2px solid rgba(202,99,31,0.2)", borderTopColor: "#ca631f", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 14 }}>Chargement…</span>
              </div>
            ) : (
              <svg ref={svgPolesRef} style={{ width: "100%", height: 560, display: "block" }} />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
