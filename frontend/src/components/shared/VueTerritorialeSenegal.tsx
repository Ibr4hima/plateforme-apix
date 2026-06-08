"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Couleurs exactes définies dans l'onglet Pôles territoires — par pole.id
const POLE_PALETTE = [
  "#efd0bc", // 1 — Pôle Dakar (orange clair)
  "#b2cade", // 2 — Pôle Thiès (bleu clair)
  "#b9d9c3", // 3 — Pôle Diourbel-Louga (vert clair)
  "#f5e6c8", // 4 — Pôle Centre (jaune doux)
  "#d4c5e8", // 5 — Pôle Nord (lavande)
  "#fadadd", // 6 — Pôle Nord-Est (rose poudré)
  "#c8e6e8", // 7 — Pôle Sud (turquoise clair)
  "#e8d5c4", // 8 — Pôle Sud-Est (sable chaud)
];

// Parser la localisation : "Kaolack, Fatick et Kaffrine" → ["Kaolack","Fatick","Kaffrine"]
const splitLocalisation = (loc: string): string[] =>
  (loc || "").split(/,\s*|\s+et\s+/).map(s => s.trim()).filter(Boolean);

const NAME_MAP: Record<string, string> = {
  "Dakar":"Dakar","Thies":"Thiès","Diourbel":"Diourbel","Louga":"Louga",
  "Saint-Louis":"Saint-Louis","Matam":"Matam","Tambacounda":"Tambacounda",
  "Kedougou":"Kédougou","Fatick":"Fatick","Kaolack":"Kaolack","Kaffrine":"Kaffrine",
  "Kolda":"Kolda","Sedhiou":"Sédhiou","Ziguinchor":"Ziguinchor",
};

export default function VueTerritorialeSenegal({ zones }: { zones: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [poles, setPoles] = useState<any[]>([]);
  const [activePole, setActivePole] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{ nom: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()).then(setPoles).catch(() => {});
  }, []);

  // Couleur par pole.id (1-based index dans la palette)
  const getPoleColor = (poleId: number) => POLE_PALETTE[(poleId - 1) % POLE_PALETTE.length];

  // Mapping région → pôle (via localisation ou region_ids)
  const getPoleByRegion = (regionNom: string) =>
    poles.find(p => splitLocalisation(p.localisation).includes(regionNom));

  // Entreprises par région
  const entByRegion: Record<string, number> = {};
  poles.forEach(p => {
    const total = zones.filter((z: any) => z.pole_id === p.id)
      .reduce((s: number, z: any) => s + (z.entreprises?.length || 0), 0);
    splitLocalisation(p.localisation).forEach((r: string) => {
      entByRegion[r] = (entByRegion[r] || 0) + total;
    });
  });
  const maxEnts = Math.max(1, ...Object.values(entByRegion));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const loadLib = (src: string, globalKey: string) =>
      new Promise<void>((res, rej) => {
        const poll = () => { if ((window as any)[globalKey]) res(); else setTimeout(poll, 50); };
        if ((window as any)[globalKey]) { res(); return; }
        if (document.querySelector(`script[data-lib="${globalKey}"]`)) { poll(); return; }
        const s = document.createElement("script");
        s.setAttribute("data-lib", globalKey);
        s.src = src; s.onerror = rej; s.onload = poll;
        document.head.appendChild(s);
      });

    Promise.all([
      loadLib("https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js", "d3"),
      loadLib("https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js", "topojson"),
    ])
    .then(() => fetch("https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/sen.topo.json"))
    .then(r => r.json())
    .then((topo: any) => {
      if (cancelled || !containerRef.current) return;

      const d3: any = (window as any).d3;
      const topojson: any = (window as any).topojson;
      const W = 460, H = 500;

      container.innerHTML = "";
      const svg = d3.select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("display", "block");

      const geojson = topojson.feature(topo, topo.objects.sen);
      const features = geojson.features;
      const projection = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], geojson);
      const pathGen = d3.geoPath().projection(projection);

      features.forEach((feature: any) => {
        const rawNom = feature.properties?.name || "";
        const nom = NAME_MAP[rawNom] || rawNom;
        const pole = poles.find(p =>
          splitLocalisation(p.localisation).includes(nom)
        );
        const color = pole ? getPoleColor(pole.id) : "#E8E5E3";
        const ents = entByRegion[nom] || 0;
        const baseOpacity = 0.75;

        const g = svg.append("g")
          .style("cursor", "pointer")
          .style("transition", "transform 0.18s ease, filter 0.18s ease");

        g.append("path")
          .attr("d", pathGen(feature))
          .attr("fill", color)
          .attr("fill-opacity", baseOpacity)
          .attr("stroke", "#F2F0EF")
          .attr("stroke-width", 0.5)
          .attr("stroke-linejoin", "round")
          .style("transition", "fill-opacity 0.15s");

        // Badge entreprises (petit, discret)
        if (ents > 0) {
          const centroid = pathGen.centroid(feature);
          if (centroid && !isNaN(centroid[0])) {
            g.append("circle")
              .attr("cx", centroid[0]).attr("cy", centroid[1])
              .attr("r", 9)
              .attr("fill", pole ? getPoleColor(pole.id) : "#aaa")
              .attr("fill-opacity", 0.9)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1.2)
              .attr("pointer-events", "none");
            g.append("text")
              .attr("x", centroid[0]).attr("y", centroid[1])
              .attr("text-anchor", "middle").attr("dominant-baseline", "central")
              .attr("font-size", 8).attr("font-weight", "700")
              .attr("fill", "#333").attr("pointer-events", "none")
              .style("user-select", "none")
              .text(ents);
          }
        }

        // Centroid pour le zoom centré sur la région
        const centroidPt = pathGen.centroid(feature);
        const cx = centroidPt && !isNaN(centroidPt[0]) ? centroidPt[0] : W / 2;
        const cy = centroidPt && !isNaN(centroidPt[1]) ? centroidPt[1] : H / 2;

        g.on("mouseenter", function(event: MouseEvent) {
          d3.select(this).select("path").attr("fill-opacity", 0.95);
          const rect = container.getBoundingClientRect();
          setTooltip({ nom, x: event.clientX - rect.left, y: event.clientY - rect.top });
        })
        .on("mousemove", function(event: MouseEvent) {
          const rect = container.getBoundingClientRect();
          setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
        })
        .on("mouseleave", function() {
          d3.select(this).select("path").attr("fill-opacity", baseOpacity);
          setTooltip(null);
        })
        .on("click", function() {
          setActivePole((prev: any) => prev?.id === pole?.id ? null : (pole || null));
        });
      });
    })
    .catch(console.error);

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [poles, zones]);

  const poleZones = activePole ? zones.filter((z: any) => z.pole_id === activePole.id) : [];
  const poleEnts = poleZones.reduce((acc: any[], z: any) => {
    (z.entreprises || []).forEach((ze: any) => {
      if (!acc.find((e: any) => e.entreprise?.id === ze.entreprise?.id)) acc.push(ze);
    });
    return acc;
  }, []);
  const nbInst = poleEnts.filter((e: any) => e.statut === "installee").length;
  const nbElig = poleEnts.filter((e: any) => e.statut === "eligible").length;
  const activeColor = activePole ? getPoleColor(activePole.id) : "#E8E5E3";

  return (
    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>

      {/* Carte — propriété exclusive de D3 */}
      <div style={{ flex:1, borderRadius:14, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden", position:"relative", minHeight:520 }}>

        {/* Conteneur D3 — aucun enfant React */}
        <div ref={containerRef} style={{ width:"100%", minHeight:520 }}/>

        {/* Tooltip React en overlay */}
        {tooltip && (
          <div style={{
            position:"absolute",
            left: Math.min(tooltip.x + 14, 300),
            top: Math.max(tooltip.y - 20, 6),
            background:"var(--color-background-primary)",
            border:"0.5px solid var(--color-border-secondary)",
            borderRadius:8, padding:"7px 13px",
            fontSize:13, fontWeight:600,
            color:"var(--color-text-primary)",
            pointerEvents:"none", zIndex:20,
            boxShadow:"0 4px 16px rgba(0,0,0,0.10)",
            whiteSpace:"nowrap",
          }}>
            {tooltip.nom}
          </div>
        )}
      </div>

      {/* Panel latéral pôle actif */}
      {activePole && (
        <div style={{ width:268, flexShrink:0, background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:14, padding:"18px 16px", display:"flex", flexDirection:"column" as const, gap:14, maxHeight:520, overflowY:"auto" as const }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:activeColor, flexShrink:0 }}/>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Pôle territorial</div>
              </div>
              <div style={{ fontSize:15, fontWeight:600, color:"var(--color-text-primary)", lineHeight:1.3 }}>{activePole.pole_territoire}</div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:3 }}>{activePole.localisation}</div>
            </div>
            <button onClick={() => setActivePole(null)} style={{ background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:99, padding:"3px 9px", fontSize:11, cursor:"pointer", color:"var(--color-text-secondary)", flexShrink:0 }}>✕</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { l:"Entreprises", v:poleEnts.length, sub:`${nbInst} installée${nbInst!==1?"s":""}` },
              { l:"Zones", v:poleZones.length, sub:`${poleZones.filter((z:any)=>z.type_zone==="ZES").length} ZES · ${poleZones.filter((z:any)=>z.type_zone==="ZAI").length} ZAI` },
              { l:"Éligibles", v:nbElig, sub:"à démarcher", col:nbElig>0?"#b45309":undefined },
              { l:"Régions", v:(activePole.region_ids||[]).length, sub:"dans ce pôle" },
            ].map((k:any) => (
              <div key={k.l} style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"10px 12px", border:"0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase" as const, letterSpacing:"0.08em", marginBottom:4 }}>{k.l}</div>
                <div style={{ fontSize:20, fontWeight:500, color:k.col||"var(--color-text-primary)", lineHeight:1 }}>{k.v}</div>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {poleZones.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase" as const, letterSpacing:"0.1em", paddingBottom:6, borderBottom:"0.5px solid var(--color-border-tertiary)", marginBottom:8 }}>Zones</div>
              {poleZones.map((z: any) => {
                const tc = z.type_zone==="ZES"?"#c0392b":z.type_zone==="ZAI"?"#2563eb":"#16a34a";
                return (
                  <div key={z.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"0.5px solid var(--color-border-tertiary)", fontSize:11 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:tc, background:tc+"18", padding:"2px 5px", borderRadius:4, minWidth:28, textAlign:"center" as const }}>{z.type_zone}</span>
                    <span style={{ color:"var(--color-text-primary)", flex:1 }}>{z.nom_zone}</span>
                    <span style={{ color:"var(--color-text-secondary)", flexShrink:0 }}>{(z.entreprises||[]).length}</span>
                  </div>
                );
              })}
            </div>
          )}

          {poleEnts.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase" as const, letterSpacing:"0.1em", paddingBottom:6, borderBottom:"0.5px solid var(--color-border-tertiary)", marginBottom:8 }}>Entreprises</div>
              {poleEnts.slice(0,7).map((ze: any, i: number) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:i<Math.min(poleEnts.length,7)-1?"0.5px solid var(--color-border-tertiary)":"none", fontSize:12 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:ze.statut==="installee"?"#059669":"#b45309", flexShrink:0 }}/>
                  <span style={{ flex:1, color:"var(--color-text-primary)" }}>{ze.entreprise?.nom}</span>
                  <span style={{ fontSize:10, fontWeight:500, color:ze.statut==="installee"?"#059669":"#b45309", background:ze.statut==="installee"?"#dcfce7":"#fef9c3", padding:"1px 6px", borderRadius:99, flexShrink:0 }}>
                    {ze.statut==="installee"?"Installée":"Éligible"}
                  </span>
                </div>
              ))}
              {poleEnts.length > 7 && <div style={{ fontSize:11, color:"var(--color-text-secondary)", textAlign:"center" as const, paddingTop:6 }}>+{poleEnts.length-7} autres</div>}
            </div>
          )}

          {poleZones.length===0 && poleEnts.length===0 && (
            <div style={{ textAlign:"center" as const, padding:"20px 0", fontSize:12, color:"var(--color-text-secondary)" }}>
              Aucune zone ni entreprise pour ce pôle
            </div>
          )}
        </div>
      )}
    </div>
  );
}
