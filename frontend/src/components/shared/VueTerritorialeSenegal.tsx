"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

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
  const [secteurRef, setSecteurRef] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()).then(setPoles).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()).then(setSecteurRef).catch(() => {});
  }, []);

  // Couleur par pole.id (1-based index dans la palette)
  const getPoleColor = (poleId: number) => POLE_PALETTE[(poleId - 1) % POLE_PALETTE.length];


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const loadTopojson = () =>
      new Promise<any>((res, rej) => {
        const poll = () => { if ((window as any).topojson) res((window as any).topojson); else setTimeout(poll, 50); };
        if ((window as any).topojson) { res((window as any).topojson); return; }
        if (document.querySelector('script[data-lib="topojson"]')) { poll(); return; }
        const s = document.createElement("script");
        s.setAttribute("data-lib", "topojson");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
        s.onerror = rej; s.onload = poll;
        document.head.appendChild(s);
      });

    loadTopojson()
    .then(() => fetch("https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/sen.topo.json"))
    .then(r => r.json())
    .then((topo: any) => {
      if (cancelled || !containerRef.current) return;

      const topojson: any = (window as any).topojson;
      const W = Math.min(container.clientWidth || 780, 780);
      const H = Math.round(W * 0.78);

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
        const baseOpacity = 0.95;

        const g = svg.append("g")
          .style("cursor", "pointer")
          .style("transition", "transform 0.18s ease, filter 0.18s ease");

        g.append("path")
          .attr("d", pathGen(feature))
          .attr("fill", color)
          .attr("fill-opacity", baseOpacity)
          .attr("stroke", "#66615E")
          .attr("stroke-width", 0.5)
          .attr("stroke-linejoin", "round")
          .style("transition", "filter 0.15s");

        // Centroid pour le zoom centré sur la région
        const centroidPt = pathGen.centroid(feature);
        const cx = centroidPt && !isNaN(centroidPt[0]) ? centroidPt[0] : W / 2;
        const cy = centroidPt && !isNaN(centroidPt[1]) ? centroidPt[1] : H / 2;

        g.on("mouseenter", function(event: MouseEvent) {
          d3.select(this).select("path").style("filter", "brightness(0.78)");
          const rect = container.getBoundingClientRect();
          setTooltip({ nom, x: event.clientX - rect.left, y: event.clientY - rect.top });
        })
        .on("mousemove", function(event: MouseEvent) {
          const rect = container.getBoundingClientRect();
          setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
        })
        .on("mouseleave", function() {
          d3.select(this).select("path").style("filter", "none");
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
    <>

    <div style={{ display:"flex", gap:24, alignItems:"flex-start", maxWidth:1020, margin:"0 auto" }}>

      {/* Carte */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ borderRadius:14, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden", position:"relative" }}>
          <div ref={containerRef} style={{ width:"100%" }}/>
          {tooltip && (
            <div style={{ position:"absolute", left:Math.min(tooltip.x+14,300), top:Math.max(tooltip.y-20,6), background:"#FAFAF9", border:"1px solid #E8E5E3", borderRadius:8, padding:"7px 13px", fontSize:13, fontWeight:600, color:"#1a1a2e", pointerEvents:"none", zIndex:20, boxShadow:"0 4px 16px rgba(0,0,0,0.10)", whiteSpace:"nowrap" as const }}>
              {tooltip.nom}
            </div>
          )}
        </div>
      </div>

      {/* Légende */}
      <div style={{ width:196, flexShrink:0, background:"#FAFAF9", border:"0.5px solid var(--color-border-tertiary)", borderRadius:14, padding:"18px 16px" }}>
        <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:14 }}>Pôles territoriaux</p>
        <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
          {poles.map(p => (
            <div key={p.id} onClick={() => setActivePole((prev:any) => prev?.id === p.id ? null : p)}
              style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", padding:"5px 8px", borderRadius:8, background: activePole?.id===p.id ? getPoleColor(p.id)+"33" : "transparent", transition:"background 0.15s" }}>
              <div style={{ width:12, height:12, borderRadius:3, background:getPoleColor(p.id), flexShrink:0, border:"1px solid rgba(0,0,0,0.08)", opacity:0.95 }}/>
              <span style={{ fontSize:12, color:"#1a1a2e", lineHeight:1.3 }}>{p.pole_territoire}</span>
            </div>
          ))}
        </div>
      </div>

    </div>

      {/* Modal pôle */}
      {activePole && (
        <div onClick={e=>{ if(e.target===e.currentTarget) setActivePole(null); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(8px)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"90vh", border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.2)", overflow:"hidden" }}>
            <div style={{ height:5, background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)" }}/>
            <div style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>
              {/* En-tête */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div style={{ flex:1, paddingRight:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <div style={{ width:12, height:12, borderRadius:3, background:activeColor, flexShrink:0 }}/>
                    <span style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em" }}>Pôle territorial</span>
                  </div>
                  <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", lineHeight:1.3, marginBottom:10 }}>{activePole.pole_territoire}</h2>
                  {/* Régions badgées */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                    {splitLocalisation(activePole.localisation).map((r:string) => (
                      <span key={r} style={{ fontSize:11, fontWeight:600, color:"#1a1a2e", background:activeColor+"33", border:`1px solid ${activeColor}88`, padding:"3px 10px", borderRadius:999 }}>{r}</span>
                    ))}
                  </div>
                </div>
                <button onClick={()=>setActivePole(null)} style={{ background:"rgba(0,0,0,0.06)", border:"none", borderRadius:99, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
              </div>

              {/* Entreprises installées */}
              <div style={{ background:"#F2F0EF", borderRadius:10, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:14, border:"1px solid #E8E5E3" }}>
                <div style={{ fontSize:34, fontWeight:800, color:"#059669", lineHeight:1 }}>{nbInst}</div>
                <div style={{ fontSize:13, color:"#1a1a2e", fontWeight:600, lineHeight:1.3 }}>entreprise{nbInst!==1?"s":""} installée{nbInst!==1?"s":""}</div>
              </div>

              {/* Zones d'investissement */}
              {poleZones.length>0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:10 }}>Zones d&apos;investissement</p>
                  {poleZones.map((z:any)=>{
                    const tc=z.type_zone==="ZES"?"#E35336":z.type_zone==="ZAI"?"#366FE3":"#188038";
                    const nbEnts=(z.entreprises||[]).length;
                    return (
                      <div key={z.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid #E8E5E3", fontSize:12 }}>
                        <span style={{ fontSize:9, fontWeight:700, color:tc, background:tc+"18", padding:"2px 6px", borderRadius:4, flexShrink:0 }}>{z.type_zone}</span>
                        <span style={{ color:"#1a1a2e", flex:1 }}>{z.nom_zone}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:"#9aa5b4", background:"#F2F0EF", padding:"1px 8px", borderRadius:99, flexShrink:0 }}>{nbEnts} ent.</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Répartition sectorielle */}
              {(()=>{
                const classif = (code:string) => {
                  const c=(code||"").toUpperCase()[0];
                  if(c==="A") return "primaire";
                  if(["B","C","D","E","F"].includes(c)) return "secondaire";
                  return "tertiaire";
                };
                // Entreprises dans les régions du pôle (toutes zones confondues)
                const poleRegions = splitLocalisation(activePole.localisation);
                const seen = new Set<number>();
                const regionEnts: Array<{ze:any; zone:any}> = [];
                zones.forEach((z:any)=>{
                  (z.entreprises||[]).forEach((ze:any)=>{
                    if(!poleRegions.includes(ze.entreprise?.region_nom)) return;
                    if(ze.statut!=="installee") return;
                    const id=ze.entreprise?.id;
                    if(id && seen.has(id)) return;
                    if(id) seen.add(id);
                    regionEnts.push({ze, zone:z});
                  });
                });
                const counts:{[k:string]:number} = { primaire:0, secondaire:0, tertiaire:0 };
                regionEnts.forEach(({zone})=>{
                  const secIds:number[] = zone.secteur_ids||[];
                  const sec = secIds.length>0 ? secteurRef.find((s:any)=>s.id===secIds[0]) : null;
                  counts[sec?classif(sec.code):"tertiaire"]++;
                });
                const total=counts.primaire+counts.secondaire+counts.tertiaire||1;
                const rows=[
                  {label:"Secteur primaire",   key:"primaire",   color:"#059669"},
                  {label:"Secteur secondaire",  key:"secondaire", color:"#366FE3"},
                  {label:"Secteur tertiaire",   key:"tertiaire",  color:"#E35336"},
                ];
                return (
                  <div>
                    <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:10 }}>Répartition sectorielle</p>
                    <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                      {rows.map(r=>{
                        const pct=Math.round(counts[r.key]/total*100);
                        return (
                          <div key={r.key}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, fontSize:12 }}>
                              <span style={{ color:"#1a1a2e", fontWeight:600 }}>{r.label}</span>
                              <span style={{ fontWeight:700, color:r.color, fontSize:12 }}>{pct}%</span>
                            </div>
                            <div style={{ height:6, background:"#E8E5E3", borderRadius:99, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:r.color, borderRadius:99, transition:"width 0.4s ease" }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
