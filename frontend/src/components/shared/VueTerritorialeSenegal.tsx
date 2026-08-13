"use client";

import { feature, mesh, merge } from "topojson-client";
import { useEffect, useRef, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { useRefPolesTerritoires, useRefSecteurs } from "@/lib/referentiels";

import { API_BASE } from "@/lib/api";

const REGION_PALETTE: Record<string, string> = {
  "Dakar":       "var(--reg-dakar)", // bleu ciel
  "Thiès":       "var(--reg-thies)", // vert tendre
  "Diourbel":    "var(--reg-diourbel)", // pêche
  "Louga":       "var(--reg-louga)", // menthe
  "Saint-Louis": "var(--reg-saint-louis)", // lilas doux
  "Matam":       "var(--reg-matam)", // jaune doux
  "Tambacounda": "var(--reg-tambacounda)", // teal
  "Kédougou":    "var(--reg-kedougou)", // corail
  "Fatick":      "var(--reg-fatick)", // vert-jaune
  "Kaolack":     "var(--reg-kaolack)", // bleu pervenche
  "Kaffrine":    "var(--reg-kaffrine)", // rose doux
  "Kolda":       "var(--reg-kolda)", // vert pâle
  "Sédhiou":     "var(--reg-sedhiou)", // sable
  "Ziguinchor":  "var(--reg-ziguinchor)", // aqua
};

// Parser la localisation : "Kaolack, Fatick et Kaffrine" → ["Kaolack","Fatick","Kaffrine"]
const splitLocalisation = (loc: string): string[] =>
  (loc || "").split(/,\s*|\s+et\s+/).map(s => s.trim()).filter(Boolean);

const NAME_MAP: Record<string, string> = {
  "Dakar":"Dakar","Thies":"Thiès","Diourbel":"Diourbel","Louga":"Louga",
  "Saint-Louis":"Saint-Louis","Matam":"Matam","Tambacounda":"Tambacounda",
  "Kedougou":"Kédougou","Fatick":"Fatick","Kaolack":"Kaolack","Kaffrine":"Kaffrine",
  "Kolda":"Kolda","Sedhiou":"Sédhiou","Ziguinchor":"Ziguinchor",
};

// Couleurs des pôles : centralisées dans lib/couleurs (ré-exportées ici pour
// ne pas casser les imports existants des pages)
import { POLE_COULEURS, normPole, badge_bleu, badge_orange, badgePole, voile } from "@/lib/couleurs";
import FicheModal, { FicheBloc, FicheDocs, FicheSection } from "@/components/shared/FicheModal";
export { POLE_COULEURS, normPole };

type Compteurs = { primaire: number; secondaire: number; tertiaire: number };

// Barres primaire/secondaire/tertiaire — partagées entre tooltips (compact) et fiches
function BarresSecteurs({ counts, compact }: { counts: Compteurs; compact?: boolean }) {
  const total = counts.primaire + counts.secondaire + counts.tertiaire || 1;
  const rows = [
    { label: compact ? "Primaire"   : "Secteur primaire",   val: counts.primaire,   color: "var(--bleu)" },
    { label: compact ? "Secondaire" : "Secteur secondaire", val: counts.secondaire, color: "var(--orange)" },
    { label: compact ? "Tertiaire"  : "Secteur tertiaire",  val: counts.tertiaire,  color: "var(--vert)" },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column" as const, gap: compact ? 6 : 10 }}>
      {rows.map(r => {
        const pct = Math.round(r.val / total * 100);
        return (
          <div key={r.label}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: compact ? 2 : 4, fontSize: compact ? 10.5 : 12 }}>
              <span style={{ color:"var(--encre)", fontWeight:600 }}>{r.label}</span>
              <span style={{ fontWeight:700, color:r.color }}>{pct}%</span>
            </div>
            <div style={{ height: compact ? 4 : 6, background:"var(--fond)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:r.color, borderRadius:99, transition: compact ? undefined : "width 0.4s ease" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Position du tooltip : au-dessus du curseur dans la moitié basse de la carte,
// sinon en dessous — évite qu'il soit coupé sur les pôles/régions du sud.
const posTooltip = (x: number, y: number, ch: number): React.CSSProperties =>
  y > ch * 0.55
    ? { left: Math.min(x + 14, 320), bottom: Math.max(6, ch - y + 14) }
    : { left: Math.min(x + 14, 320), top: Math.max(6, y + 14) };

export default function VueTerritorialeSenegal({ zones, mode = "pole", onPoleClick, onRegionClick }: { zones: any[]; mode?: "pole" | "region"; onPoleClick?: (pole: any) => void; onRegionClick?: (regionNom: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPoleClickRef = useRef(onPoleClick);
  useEffect(() => { onPoleClickRef.current = onPoleClick; }, [onPoleClick]);
  const onRegionClickRef = useRef(onRegionClick);
  useEffect(() => { onRegionClickRef.current = onRegionClick; }, [onRegionClick]);
  const { data: polesData } = useRefPolesTerritoires();
  const poles: any[] = (polesData as any[]) || [];
  const [activePole, setActivePole] = useState<any>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [regionStats, setRegionStats] = useState<Record<string, { total: number; primaire: number; secondaire: number; tertiaire: number }>>({});
  const [tooltip, setTooltip] = useState<{ nom: string; x: number; y: number; pole?: any; region?: string } | null>(null);
  const { data: secteurRefData } = useRefSecteurs();
  const secteurRef: any[] = (secteurRefData as any[]) || [];

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/viz/region-stats`)
      .then(r => r.json())
      .then((rows: any[]) => {
        const map: Record<string, any> = {};
        rows.forEach(row => { map[row.region] = { total: row.total, primaire: row.primaire, secondaire: row.secondaire, tertiaire: row.tertiaire }; });
        setRegionStats(map);
      })
      .catch(() => {});
  }, [mode]);

  // Couleur par pôle : table fixe par nom (fallback gris).
  const getPoleColor = (poleId: number) => {
    const p = poles.find(x => x.id === poleId);
    return (p && POLE_COULEURS[normPole(p.pole_territoire)]) || "var(--fond-creux2)";
  };


  const d3Pret = useD3Pret();
  useEffect(() => {
    if (!d3Pret) return;
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    // Fond de carte AUTO-HÉBERGÉ (public/cartes, extrait du paquet npm
    // datamaps) et topojson-client importé comme toute dépendance : la carte
    // du territoire national ne doit dépendre d'aucun CDN étranger — ni pour
    // sa disponibilité, ni surtout pour l'exécution d'un script tiers dans
    // une application authentifiée.
    fetch("/cartes/sen.topo.json")
    .then(r => r.json())
    .then((topo: any) => {
      if (cancelled || !containerRef.current) return;

      const W = Math.min(container.clientWidth || 780, 780);
      const H = Math.round(W * 0.78);

      container.innerHTML = "";
      const svg = d3.select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("display", "block");

      const geojson: any = feature(topo, topo.objects.sen);
      const features = geojson.features;
      const projection = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], geojson);
      const pathGen = d3.geoPath().projection(projection);

      // Lookup géométrie topojson par nom normalisé (pour merge/mesh)
      const geometryByName: Record<string, any> = {};
      (topo.objects.sen.geometries || []).forEach((geom: any) => {
        const nom = NAME_MAP[geom.properties?.name || ""] || geom.properties?.name || "";
        geometryByName[nom] = geom;
      });

      // ID du pôle d'une géométrie (pour le mesh inter-pôles)
      const poleIdOfGeom = (geom: any): number => {
        const nom = NAME_MAP[geom.properties?.name || ""] || geom.properties?.name || "";
        return poles.find(p => splitLocalisation(p.localisation).includes(nom))?.id ?? -1;
      };

      // ── Couche 1 : fills des régions (sans stroke en mode pôle) ──────────────
      const polePathsMap = new Map<number, SVGPathElement[]>();

      features.forEach((feature: any) => {
        const rawNom = feature.properties?.name || "";
        const nom = NAME_MAP[rawNom] || rawNom;
        const pole = poles.find(p => splitLocalisation(p.localisation).includes(nom));
        const color = mode === "region"
          ? (REGION_PALETTE[nom] || "var(--sur-bleu)")
          : (pole ? getPoleColor(pole.id) : "var(--sur-bleu)");

        const g = svg.append("g").style("transition", "filter 0.15s");

        const pathEl = g.append("path")
          .attr("d", pathGen(feature))
          .style("fill", color)
          .attr("fill-opacity", 0.95)
          .style("stroke", mode === "region" ? "var(--texte)" : "none")
          .attr("stroke-width", 0.5)
          .attr("stroke-linejoin", "round")
          .style("transition", "filter 0.15s");

        if (mode === "pole" && pole) {
          if (!polePathsMap.has(pole.id)) polePathsMap.set(pole.id, []);
          polePathsMap.get(pole.id)!.push(pathEl.node() as SVGPathElement);
        }

        if (mode === "region") {
          g.style("cursor", "pointer")
           .on("mouseenter", function(event: MouseEvent) {
             d3.select(this).select("path").style("filter", "brightness(0.78)");
             const rect = container.getBoundingClientRect();
             setTooltip({ nom, x: event.clientX - rect.left, y: event.clientY - rect.top, region: nom });
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
             if (onRegionClickRef.current) { onRegionClickRef.current(nom); }
             else { setActiveRegion(prev => prev === nom ? null : nom); }
           });
        }
      });

      if (mode === "pole") {
        // ── Couche 2 : bordures inter-pôles uniquement ──────────────────────────
        svg.append("path")
          .datum(mesh(topo, topo.objects.sen,
            (a: any, b: any) => poleIdOfGeom(a) !== poleIdOfGeom(b)
          ))
          .attr("d", pathGen)
          .style("fill", "none")
          .style("stroke", "var(--texte)")
          .attr("stroke-width", 0.6)
          .attr("stroke-linejoin", "round");

        // Contour extérieur du Sénégal
        svg.append("path")
          .datum(mesh(topo, topo.objects.sen, (a: any, b: any) => a === b))
          .attr("d", pathGen)
          .style("fill", "none")
          .style("stroke", "var(--texte)")
          .attr("stroke-width", 0.9)
          .attr("stroke-linejoin", "round");

        // ── Couche 3 : overlays invisibles par pôle (hover + click groupé) ──────
        poles.forEach(pole => {
          const geoms = splitLocalisation(pole.localisation)
            .map(r => geometryByName[r]).filter(Boolean);
          if (!geoms.length) return;
          let merged: any;
          try { merged = merge(topo, geoms); } catch { return; }

          svg.append("path")
            .datum(merged)
            .attr("d", pathGen)
            .style("fill", "transparent")
            .style("stroke", "none")
            .style("cursor", "pointer")
            .on("mouseenter", function(event: MouseEvent) {
              polePathsMap.get(pole.id)?.forEach(p => d3.select(p).style("filter", "brightness(0.82)"));
              const rect = container.getBoundingClientRect();
              setTooltip({ nom: pole.pole_territoire, x: event.clientX - rect.left, y: event.clientY - rect.top, pole });
            })
            .on("mousemove", function(event: MouseEvent) {
              const rect = container.getBoundingClientRect();
              setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
            })
            .on("mouseleave", function() {
              polePathsMap.get(pole.id)?.forEach(p => d3.select(p).style("filter", "none"));
              setTooltip(null);
            })
            .on("click", function() {
              if (onPoleClickRef.current) { onPoleClickRef.current(pole); }
              else { setActivePole((prev: any) => prev?.id === pole.id ? null : pole); }
            });
        });
      }
    })
    .catch(console.error);

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [poles, zones, mode, d3Pret]);

  const poleZones = activePole ? zones.filter((z: any) => z.pole_id === activePole.id) : [];
  const poleEnts = poleZones.reduce((acc: any[], z: any) => {
    (z.entreprises || []).forEach((ze: any) => {
      if (!acc.find((e: any) => e.entreprise?.id === ze.entreprise?.id)) acc.push(ze);
    });
    return acc;
  }, []);
  const nbInst = poleEnts.filter((ze: any) => ze.statut === "installee").length;

  return (
    <>

    <div style={{ display:"flex", gap:24, alignItems:"flex-start", maxWidth:1020, margin:"0 auto" }}>

      {/* Carte */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ borderRadius:14, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden", position:"relative" }}>
          <div ref={containerRef} style={{ width:"100%" }}/>
          {tooltip && !tooltip.pole && !tooltip.region && (
            <div style={{ position:"absolute", left:Math.min(tooltip.x+14,300), top:Math.max(tooltip.y-20,6), background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:10, padding:"7px 13px", fontSize:13, fontWeight:600, color:"var(--encre)", pointerEvents:"none", zIndex:20, boxShadow:"var(--ombre-2)", whiteSpace:"nowrap" as const }}>
              {tooltip.nom}
            </div>
          )}
          {tooltip && tooltip.region && (() => {
            const nom = tooltip.region;
            const color = REGION_PALETTE[nom] || "var(--sur-bleu)";
            const stats = regionStats[nom];
            const total = stats ? stats.total : 0;
            const ch = containerRef.current?.clientHeight ?? 420;
            return (
              <div style={{ position:"absolute", ...posTooltip(tooltip.x, tooltip.y, ch), width:224, background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:12, padding:"13px 15px", pointerEvents:"none", zIndex:20, boxShadow:"var(--ombre-2)" }}>
                {/* Nom */}
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0, border:"1px solid rgb(var(--ombre-rgb) / 0.08)" }}/>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--encre)", lineHeight:1.25 }}>{nom}</span>
                </div>
                {/* Entreprises formalisées */}
                <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:10 }}>
                  <span style={{ fontSize:20, fontWeight:800, color:"var(--bleu)", lineHeight:1 }}>{total}</span>
                  <span style={{ fontSize:11.5, fontWeight:600, color:"var(--encre)" }}>entreprise{total!==1?"s":""} formalisée{total!==1?"s":""}</span>
                </div>
                {/* Répartition sectorielle */}
                <p style={{ fontSize:9, fontWeight:700, color:"var(--bleu)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:6 }}>Répartition sectorielle</p>
                <BarresSecteurs compact counts={{ primaire: stats?.primaire ?? 0, secondaire: stats?.secondaire ?? 0, tertiaire: stats?.tertiaire ?? 0 }}/>
              </div>
            );
          })()}
          {tooltip && tooltip.pole && (() => {
            const pole = tooltip.pole;
            const color = getPoleColor(pole.id);
            const regions = splitLocalisation(pole.localisation);
            // Entreprises installées (uniques) sur les zones du pôle — même calcul que le modal
            const pz = zones.filter((z: any) => z.pole_id === pole.id);
            const ents = pz.reduce((acc: any[], z: any) => {
              (z.entreprises || []).forEach((ze: any) => {
                if (!acc.find((e: any) => e.entreprise?.id === ze.entreprise?.id)) acc.push(ze);
              });
              return acc;
            }, []);
            const nb = ents.filter((ze: any) => ze.statut === "installee").length;
            // Répartition sectorielle agrégée sur les régions du pôle
            const counts = { primaire: 0, secondaire: 0, tertiaire: 0 };
            regions.forEach(r => {
              const s = regionStats[r];
              if (!s) return;
              counts.primaire += s.primaire; counts.secondaire += s.secondaire; counts.tertiaire += s.tertiaire;
            });
            const ch = containerRef.current?.clientHeight ?? 420;
            return (
              <div style={{ position:"absolute", ...posTooltip(tooltip.x, tooltip.y, ch), width:238, background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:12, padding:"13px 15px", pointerEvents:"none", zIndex:20, boxShadow:"var(--ombre-2)" }}>
                {/* Nom + régions */}
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0, border:"1px solid rgb(var(--ombre-rgb) / 0.08)" }}/>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--encre)", lineHeight:1.25 }}>{pole.pole_territoire}</span>
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" as const, marginBottom:10 }}>
                  {regions.map(r => (
                    <span key={r} style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"2px 8px", borderRadius:999 }}>{r}</span>
                  ))}
                </div>
                {/* Entreprises installées */}
                <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:10 }}>
                  <span style={{ fontSize:20, fontWeight:800, color:"var(--bleu)", lineHeight:1 }}>{nb}</span>
                  <span style={{ fontSize:11.5, fontWeight:600, color:"var(--encre)" }}>entreprise{nb!==1?"s":""} installée{nb!==1?"s":""}</span>
                </div>
                {/* Répartition sectorielle */}
                <p style={{ fontSize:9, fontWeight:700, color:"var(--bleu)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:6 }}>Répartition sectorielle</p>
                <BarresSecteurs compact counts={counts}/>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Légende */}
      <div style={{ width:196, flexShrink:0, background:"var(--carte-douce)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:14, padding:"18px 16px" }}>
        {mode === "region" ? (
          <>
            <p style={{ fontSize:10, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:14 }}>Régions</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
              {Object.entries(REGION_PALETTE).map(([nom, color]) => (
                <div key={nom} onClick={() => onRegionClickRef.current ? onRegionClickRef.current(nom) : setActiveRegion(prev => prev === nom ? null : nom)}
                  style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", padding:"4px 8px", borderRadius:8, background: activeRegion===nom ? voile(color, 33) : "transparent", transition:"background 0.15s" }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:color, flexShrink:0, border:"1px solid rgb(var(--ombre-rgb) / 0.08)" }}/>
                  <span style={{ fontSize:12, color:"var(--encre)", lineHeight:1.3 }}>{nom}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize:10, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:14 }}>Pôles territoriaux</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
              {poles.map(p => (
                <div key={p.id} onClick={() => onPoleClickRef.current ? onPoleClickRef.current(p) : setActivePole((prev:any) => prev?.id === p.id ? null : p)}
                  style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", padding:"5px 8px", borderRadius:8, background: activePole?.id===p.id ? getPoleColor(p.id)+"33" : "transparent", transition:"background 0.15s" }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:getPoleColor(p.id), flexShrink:0, border:"1px solid rgb(var(--ombre-rgb) / 0.08)", opacity:0.95 }}/>
                  <span style={{ fontSize:12, color:"var(--encre)", lineHeight:1.3 }}>{p.pole_territoire}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>

      {/* Fiche pôle — bâtie sur la fiche modale commune */}
      {!onPoleClick && activePole && (() => {
        const regions = splitLocalisation(activePole.localisation);
        const counts = { primaire:0, secondaire:0, tertiaire:0 };
        regions.forEach(r => {
          const s = regionStats[r];
          if (!s) return;
          counts.primaire += s.primaire; counts.secondaire += s.secondaire; counts.tertiaire += s.tertiaire;
        });
        return (
          <FicheModal titre={activePole.pole_territoire} onClose={()=>setActivePole(null)} maxWidth={560}
            badges={<>
              <span style={badgePole(activePole.pole_territoire)}>Pôle territorial</span>
              {regions.map((r:string) => <span key={r} style={badge_bleu}>{r}</span>)}
            </>}>

            {/* Entreprises installées */}
            <FicheBloc label={`Entreprise${nbInst!==1?"s":""} installée${nbInst!==1?"s":""}`}>
              <p style={{ fontSize:26, fontWeight:800, color:nbInst>0?"var(--bleu)":"var(--gris)", lineHeight:1.1 }}>{nbInst}</p>
            </FicheBloc>

            {/* Zones d'investissement */}
            {poleZones.length>0 && (
              <FicheSection titre="Zones d'investissement" count={poleZones.length}>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                  {poleZones.map((z:any)=>{
                    const tc=z.type_zone==="ZES"?"var(--bleu)":z.type_zone==="ZAI"?"var(--orange)":"var(--vert)";
                    const nbEnts=(z.entreprises||[]).filter((ze:any)=>ze.statut==="installee").length;
                    return (
                      <div key={z.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", background:"var(--carte-douce)", borderRadius:12, border:"1px solid var(--bordure)", fontSize:12 }}>
                        <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:"0.04em", color:tc, background:voile(tc, 7), padding:"2px 8px", borderRadius:999, flexShrink:0 }}>{z.type_zone}</span>
                        <span style={{ color:"var(--encre)", fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{z.nom_zone}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:tc, background:voile(tc, 7), padding:"2px 9px", borderRadius:99, flexShrink:0 }}>{nbEnts} ent.</span>
                      </div>
                    );
                  })}
                </div>
              </FicheSection>
            )}

            {/* Répartition sectorielle */}
            <FicheSection titre="Répartition sectorielle">
              <BarresSecteurs counts={counts}/>
            </FicheSection>

            {/* Fichiers PDF du pôle */}
            <FicheDocs fichiers={activePole.fichiers || []} hrefDe={f => `${API_BASE}/zones-types/poles/${activePole.id}/fichiers/${f.id}/download`}/>
          </FicheModal>
        );
      })()}

      {/* Fiche région — bâtie sur la fiche modale commune */}
      {!onRegionClick && mode === "region" && activeRegion && (() => {
        const stats = regionStats[activeRegion];
        const total = stats?.total || 0;
        return (
          <FicheModal titre={activeRegion} onClose={()=>setActiveRegion(null)} maxWidth={480}
            badges={<span style={badge_orange}>Région</span>}>

            {/* Total entreprises */}
            <FicheBloc label={`Entreprise${total!==1?"s":""} formalisée${total!==1?"s":""}`}>
              <p style={{ fontSize:26, fontWeight:800, color:total>0?"var(--bleu)":"var(--gris)", lineHeight:1.1 }}>{total}</p>
            </FicheBloc>

            {/* Répartition sectorielle */}
            {stats && (
              <FicheSection titre="Répartition sectorielle">
                <BarresSecteurs counts={stats}/>
              </FicheSection>
            )}
          </FicheModal>
        );
      })()}
    </>
  );
}
