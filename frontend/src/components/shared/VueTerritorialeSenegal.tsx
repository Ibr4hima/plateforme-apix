"use client";

import { feature, mesh, merge } from "topojson-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { useRefPolesTerritoires } from "@/lib/referentiels";
import { useDonnees, VIDE } from "@/lib/donnees";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";
import { zoneTypeMeta } from "@/components/shared/zoneTypes";

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
import { POLE_COULEURS, normPole, voile } from "@/lib/couleurs";
import FicheModal, { FicheAttente, FicheBarres, FicheDocuments, FicheFait, FicheFaits, FicheRubrique } from "@/components/shared/FicheModal";
export { POLE_COULEURS, normPole };

type Compteurs = { primaire: number; secondaire: number; tertiaire: number };

// Les trois secteurs, dans leurs couleurs (primaire bleu, secondaire orange,
// tertiaire vert) — en barres dans les fiches et les infobulles
const lignesSecteurs = (c: Compteurs, court?: boolean) => [
  { libelle: court ? "Primaire"   : "Secteur primaire",   valeur: c.primaire,   couleur: "var(--bleu)" },
  { libelle: court ? "Secondaire" : "Secteur secondaire", valeur: c.secondaire, couleur: "var(--orange)" },
  { libelle: court ? "Tertiaire"  : "Secteur tertiaire",  valeur: c.tertiaire,  couleur: "var(--vert)" },
];
// Une répartition à montrer : au moins une entreprise rattachée à un secteur
// (une région peut compter des entreprises sans secteur renseigné)
const aDesSecteurs = (c?: Compteurs) => !!c && c.primaire + c.secondaire + c.tertiaire > 0;
// Les compteurs d'un pôle : la somme de ceux de ses régions
const sommeRegions = (regions: string[], stats: Record<string, Compteurs>): Compteurs => {
  const c = { primaire: 0, secondaire: 0, tertiaire: 0 };
  regions.forEach(r => { const s = stats[r]; if (s) { c.primaire += s.primaire; c.secondaire += s.secondaire; c.tertiaire += s.tertiaire; } });
  return c;
};
const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? "s" : ""}`;
// Un rang à la française : 1re, 2e, 3e…
const Rang = ({ n }: { n: number }) => <>{n}<sup style={{ fontSize: "0.62em", lineHeight: 0, marginLeft: 1 }}>{n === 1 ? "re" : "e"}</sup></>;

// Position du tooltip : au-dessus du curseur dans la moitié basse de la carte,
// sinon en dessous — évite qu'il soit coupé sur les pôles/régions du sud.
const posTooltip = (x: number, y: number, ch: number): React.CSSProperties =>
  y > ch * 0.55
    ? { left: Math.min(x + 14, 320), bottom: Math.max(6, ch - y + 14) }
    : { left: Math.min(x + 14, 320), top: Math.max(6, y + 14) };

// `zones` : les cartes des zones (GET /zones-types/cartes), chacune avec ses
// entreprises installées comptées (nb_installees) ; `installeesParPole` : les
// entreprises installées de chaque pôle, comptées une fois chacune par le
// serveur — la page ne reçoit plus la liste des entreprises de chaque zone.
export default function VueTerritorialeSenegal({ zones, installeesParPole = {}, mode = "pole", onPoleClick, onRegionClick }: { zones: any[]; installeesParPole?: Record<string, number>; mode?: "pole" | "region"; onPoleClick?: (pole: any) => void; onRegionClick?: (regionNom: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPoleClickRef = useRef(onPoleClick);
  useEffect(() => { onPoleClickRef.current = onPoleClick; }, [onPoleClick]);
  const onRegionClickRef = useRef(onRegionClick);
  useEffect(() => { onRegionClickRef.current = onRegionClick; }, [onRegionClick]);
  // Les pôles, d'une référence stable tant qu'ils n'ont pas changé : la carte
  // se redessine quand ils changent — un [] neuf à chaque rendu la redessinait
  // à chaque mouvement de souris tant qu'ils n'étaient pas arrivés
  const { data: polesData } = useRefPolesTerritoires();
  const poles: any[] = (polesData as any[]) ?? (VIDE as any[]);
  const [activePole, setActivePole] = useState<any>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ nom: string; x: number; y: number; pole?: any; region?: string } | null>(null);

  // Les entreprises de chaque région, par secteur — en cache partagé : revenir
  // sur l'onglet ne les redemande pas
  const qStats = useDonnees<(Compteurs & { region: string; total: number })[]>(`${API_BASE}/dashboard/viz/region-stats`);
  const regionStats = useMemo(() => {
    const map: Record<string, Compteurs & { total: number }> = {};
    (qStats.data || []).forEach(row => { map[row.region] = { total: row.total, primaire: row.primaire, secondaire: row.secondaire, tertiaire: row.tertiaire }; });
    return map;
  }, [qStats.data]);
  // Les fiches s'ouvrent complètes : statistiques arrivées, attendues 0,4 s
  // au plus (lib/ouvertureFiche)
  const statsPretes = !!qStats.data;
  const regionPrete = useOuvertureFiche(activeRegion, statsPretes);
  const polePret = useOuvertureFiche(activePole?.id ?? null, statsPretes);

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
        .style("display", "block")
        // ENTIÈRE DANS LA FENÊTRE, en haut de page : les deux pages qui la
        // montrent la posent à 101 px du haut (barre de titre 65, marge 36).
        // Quand la fenêtre est trop basse pour sa largeur, la carte rapetisse
        // — le dessin se centre dans sa colonne — et garde 29 px sous elle,
        // au lieu de perdre le sud du pays sous le bord de l'écran.
        .style("max-height", "max(320px, calc(100dvh - 130px))");

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
  const nbInst = activePole ? (installeesParPole[activePole.id] ?? 0) : 0;

  return (
    <>

    <div style={{ display:"flex", gap:24, alignItems:"flex-start", maxWidth:1020, margin:"0 auto" }}>

      {/* Carte — posée à même le fond de la page, sans bloc blanc autour :
          le territoire se lit comme une figure, pas comme un encadré. */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ position:"relative" }}>
          <div ref={containerRef} style={{ width:"100%" }}/>
          {tooltip && !tooltip.pole && !tooltip.region && (
            <div style={{ position:"absolute", left:Math.min(tooltip.x+14,300), top:Math.max(tooltip.y-20,6), background:"var(--carte)", border:"1px solid var(--filet-carte)", borderRadius:8, padding:"7px 13px", fontSize:13, fontWeight:600, color:"var(--encre)", pointerEvents:"none", zIndex:20, boxShadow:"var(--ombre-2)", whiteSpace:"nowrap" as const }}>
              {tooltip.nom}
            </div>
          )}
          {tooltip && tooltip.region && (() => {
            const nom = tooltip.region;
            const stats = regionStats[nom];
            const total = stats?.total ?? 0;
            const ch = containerRef.current?.clientHeight ?? 420;
            return (
              <div className="carte-infobulle" style={posTooltip(tooltip.x, tooltip.y, ch)}>
                <div className="carte-infobulle-titre">{nom}</div>
                <div className="carte-infobulle-chiffre">
                  <strong>{total}</strong>
                  <span>{pluriel(total, "entreprise")} {pluriel(total, "formalisée")}</span>
                </div>
                {aDesSecteurs(stats) && (
                  <div className="carte-infobulle-rubrique">
                    <p>Répartition sectorielle</p>
                    <FicheBarres compact lignes={lignesSecteurs(stats!, true)} />
                  </div>
                )}
              </div>
            );
          })()}
          {tooltip && tooltip.pole && (() => {
            const pole = tooltip.pole;
            const regions = splitLocalisation(pole.localisation);
            // Entreprises installées (uniques) sur les zones du pôle — même nombre que la fiche
            const nb = installeesParPole[pole.id] ?? 0;
            const counts = sommeRegions(regions, regionStats);
            const ch = containerRef.current?.clientHeight ?? 420;
            return (
              <div className="carte-infobulle" style={posTooltip(tooltip.x, tooltip.y, ch)}>
                <div className="carte-infobulle-titre">{pole.pole_territoire}</div>
                {regions.length > 0 && <div className="carte-infobulle-detail">{regions.join(", ")}</div>}
                <div className="carte-infobulle-chiffre">
                  <strong>{nb}</strong>
                  <span>{pluriel(nb, "entreprise")} {pluriel(nb, "installée")}</span>
                </div>
                {aDesSecteurs(counts) && (
                  <div className="carte-infobulle-rubrique">
                    <p>Répartition sectorielle</p>
                    <FicheBarres compact lignes={lignesSecteurs(counts, true)} />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Légende */}
      <div style={{ width:196, flexShrink:0, background:"var(--carte)", border:"1px solid var(--filet-carte)", borderRadius:8, padding:"18px 16px" }}>
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
                  style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", padding:"5px 8px", borderRadius:8, background: activePole?.id===p.id ? voile(getPoleColor(p.id), 20) : "transparent", transition:"background 0.15s" }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:getPoleColor(p.id), flexShrink:0, border:"1px solid rgb(var(--ombre-rgb) / 0.08)", opacity:0.95 }}/>
                  <span style={{ fontSize:12, color:"var(--encre)", lineHeight:1.3 }}>{p.pole_territoire}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>

      {/* Fiche pôle — le dessin des fiches : ses régions sous le titre, ses
          chiffres dans l'aplat, puis ses zones, ses secteurs, ses documents */}
      {!onPoleClick && activePole && polePret && (() => {
        const regions = splitLocalisation(activePole.localisation);
        const counts = sommeRegions(regions, regionStats);
        return (
          <FicheModal titre={activePole.pole_territoire} onClose={()=>setActivePole(null)} maxWidth={640}
            surtitre={<span className="fiche-surtitre-texte">Pôle territorial</span>}
            meta={regions.length > 0 && <>{regions.map(r => <span key={r}>{r}</span>)}</>}>

            <FicheFaits>
              <FicheFait libelle={`${pluriel(nbInst, "Entreprise")} ${pluriel(nbInst, "installée")}`} vide={nbInst === 0}>{nbInst}</FicheFait>
              <FicheFait libelle="Zones d'investissement" vide={poleZones.length === 0}>{poleZones.length}</FicheFait>
            </FicheFaits>

            {poleZones.length > 0 && (
              <FicheRubrique titre="Zones d'investissement" compte={poleZones.length} arrivee>
                <div className="fiche-lignes">
                  {poleZones.map((z: any) => {
                    const m = zoneTypeMeta(z.type_zone);
                    const nb = z.nb_installees || 0;
                    return (
                      <div key={z.id} className="fiche-ligne">
                        <span className="fiche-code" title={m.label} style={{ color: m.color, background: m.bg }}>{z.type_zone}</span>
                        <span className="fiche-ligne-nom">{z.nom_zone}</span>
                        <span className="fiche-ligne-note">{nb} {pluriel(nb, "entreprise")} {pluriel(nb, "installée")}</span>
                      </div>
                    );
                  })}
                </div>
              </FicheRubrique>
            )}

            {!statsPretes ? (
              <FicheRubrique titre="Répartition sectorielle"><FicheAttente lignes={3} /></FicheRubrique>
            ) : aDesSecteurs(counts) ? (
              <FicheRubrique titre="Répartition sectorielle" arrivee>
                <p className="fiche-note-rubrique">Entreprises formalisées de ses régions</p>
                <FicheBarres lignes={lignesSecteurs(counts)} />
              </FicheRubrique>
            ) : null}

            <FicheDocuments fichiers={activePole.fichiers || []} arrivee contexte={activePole.pole_territoire}
              hrefDe={f => `${API_BASE}/zones-types/poles/${activePole.id}/fichiers/${f.id}/download`} />
          </FicheModal>
        );
      })()}

      {/* Fiche région — le dessin des fiches : son pôle sous le titre, ses
          entreprises et son rang dans l'aplat, puis ses secteurs */}
      {!onRegionClick && mode === "region" && activeRegion && regionPrete && (() => {
        const stats = regionStats[activeRegion];
        const total = stats?.total ?? 0;
        const pole = poles.find(p => splitLocalisation(p.localisation).includes(activeRegion));
        // Le rang parmi les quatorze régions (celles sans entreprise comptent zéro)
        const regionsConnues = Object.keys(REGION_PALETTE);
        const rang = total > 0 ? 1 + regionsConnues.filter(r => (regionStats[r]?.total ?? 0) > total).length : null;
        return (
          <FicheModal titre={activeRegion} onClose={()=>setActiveRegion(null)} maxWidth={560}
            surtitre={<span className="fiche-surtitre-texte">Région</span>}
            meta={pole && <span>{pole.pole_territoire}</span>}>

            <FicheFaits>
              <FicheFait libelle={`${pluriel(total, "Entreprise")} ${pluriel(total, "formalisée")}`} attente={!statsPretes} vide={total === 0}>
                {total}
              </FicheFait>
              <FicheFait libelle="Rang national" attente={!statsPretes} vide={rang == null}
                note={rang != null ? `sur ${regionsConnues.length} régions` : undefined}>
                {rang != null ? <Rang n={rang} /> : "—"}
              </FicheFait>
            </FicheFaits>

            {!statsPretes ? (
              <FicheRubrique titre="Répartition sectorielle"><FicheAttente lignes={3} /></FicheRubrique>
            ) : aDesSecteurs(stats) ? (
              <FicheRubrique titre="Répartition sectorielle" arrivee>
                <FicheBarres lignes={lignesSecteurs(stats!)} />
              </FicheRubrique>
            ) : null}
          </FicheModal>
        );
      })()}
    </>
  );
}
