"use client";

// Tableau de bord — briefing exécutif une page, au format du rapport
// d'analyse du commerce extérieur : bandeau dégradé profond, KPIs en cartes
// chevauchantes, « À retenir » généré des données, graphe signature,
// carte du Sénégal, jauges et tableaux classés.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import GrapheMultiPays from "@/components/shared/GrapheMultiPays";
import { SkeletonKPIs, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { drapeauEmoji } from "@/lib/drapeaux";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";
const nf = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

type Ligne = { label: string; valeur: number };
type Donnees = {
  stats: Record<string, any>;
  annees: Ligne[]; regions: Ligne[]; secteurs: Ligne[]; branches: Ligne[];
  paysOrigine: Ligne[]; departements: Ligne[]; typesZones: Ligne[];
  iso2ParNom: Record<string, string>;
};

const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

function Drapeau({ iso, nom }: { iso: string | null; nom: string }) {
  if (!iso) return <span style={{ width: 21, display: "inline-block" }} />;
  const emoji = drapeauEmoji(iso);
  if (emoji) return <span title={nom} style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`} alt="" title={nom}
    style={{ width: 21, height: 15, objectFit: "cover", borderRadius: 2.5, boxShadow: "0 0 0 1px rgba(15,40,80,0.14)", flexShrink: 0 }} />;
}

// ── Carte du Sénégal (heatmap de densité par région) ─────────────────────────
const SEN_NAME_MAP: Record<string, string> = {
  "Dakar": "Dakar", "Thies": "Thiès", "Diourbel": "Diourbel", "Louga": "Louga",
  "Saint-Louis": "Saint-Louis", "Matam": "Matam", "Tambacounda": "Tambacounda",
  "Kedougou": "Kédougou", "Fatick": "Fatick", "Kaolack": "Kaolack", "Kaffrine": "Kaffrine",
  "Kolda": "Kolda", "Sedhiou": "Sédhiou", "Ziguinchor": "Ziguinchor",
};
// Densités fictives (le temps de remplir la bdd) — mêmes valeurs que l'ancien
// tableau de bord pour un rendu identique de la heatmap.
const REGION_DENSITE_FICTIF = [
  { label: "Dakar", valeur: 300, densite: 0.050 }, { label: "Thiès", valeur: 228, densite: 0.038 },
  { label: "Diourbel", valeur: 192, densite: 0.032 }, { label: "Kaolack", valeur: 162, densite: 0.027 },
  { label: "Ziguinchor", valeur: 138, densite: 0.023 }, { label: "Fatick", valeur: 114, densite: 0.019 },
  { label: "Saint-Louis", valeur: 96, densite: 0.016 }, { label: "Kolda", valeur: 78, densite: 0.013 },
  { label: "Sédhiou", valeur: 66, densite: 0.011 }, { label: "Kaffrine", valeur: 54, densite: 0.009 },
  { label: "Louga", valeur: 42, densite: 0.007 }, { label: "Matam", valeur: 30, densite: 0.005 },
  { label: "Tambacounda", valeur: 24, densite: 0.004 }, { label: "Kédougou", valeur: 18, densite: 0.003 },
];
const HEAT_STOPS = ["#EDF4FB", "#C5DCF2", "#90BDE5", "#5596D4", "#2872B8", "#004f91", "#003468"];
const heatRamp = (t: number) => d3.interpolateRgbBasis(HEAT_STOPS)(Math.max(0, Math.min(1, t)));

function CarteSenegal({ height = 320 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[:]/g, "");
  const [tip, setTip] = useState<{ nom: string; valeur: number; densite: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const container = ref.current; if (!container) return;
    let cancelled = false;
    const loadTopojson = () => new Promise<any>((res, rej) => {
      const w: any = window;
      const poll = () => { if (w.topojson) res(w.topojson); else setTimeout(poll, 50); };
      if (w.topojson) { res(w.topojson); return; }
      if (document.querySelector('script[data-lib="topojson"]')) { poll(); return; }
      const s = document.createElement("script"); s.setAttribute("data-lib", "topojson");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onerror = rej; s.onload = poll; document.head.appendChild(s);
    });
    Promise.all([
      loadTopojson().then(() => fetch("https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/sen.topo.json")).then(r => r.json()),
      Promise.resolve(REGION_DENSITE_FICTIF),
    ]).then(([topo, regionData]: any) => {
      if (cancelled || !ref.current) return;
      const topojson: any = (window as any).topojson;
      const W = container.clientWidth || 480, H = height;
      const info: Record<string, { valeur: number; densite: number }> = {};
      (regionData as any[]).forEach(d => { info[d.label] = { valeur: Number(d.valeur) || 0, densite: Number(d.densite) || 0 }; });
      const maxDens = Math.max(1e-9, ...Object.values(info).map(d => d.densite));

      container.innerHTML = "";
      const svg = d3.select(container).append("svg")
        .attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`).style("display", "block");
      const geojson = topojson.feature(topo, topo.objects.sen);
      const projection = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], geojson);
      const pathGen = d3.geoPath().projection(projection);

      svg.selectAll("path.reg").data(geojson.features).join("path")
        .attr("d", (d: any) => pathGen(d)).attr("fill", "#C4C4C4")
        .attr("stroke", "#666666").attr("stroke-width", 0.6).attr("stroke-linejoin", "round");

      const defs = svg.append("defs");
      defs.append("filter").attr("id", `heat-blur-${uid}`)
        .attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%")
        .append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", Math.max(4, Math.min(W, H) * 0.035));

      geojson.features.forEach((f: any, i: number) => {
        const nom = SEN_NAME_MAP[f.properties?.name || ""] || f.properties?.name || "";
        const v = info[nom]?.densite || 0;
        if (v <= 0) return;
        defs.append("clipPath").attr("id", `heat-clip-${uid}-${i}`).append("path").attr("d", pathGen(f) as string);
        const c = pathGen.centroid(f);
        const [[x0, y0], [x1, y1]] = pathGen.bounds(f);
        const r = Math.max(x1 - x0, y1 - y0) / 2 * 0.98;
        svg.append("g")
          .attr("clip-path", `url(#heat-clip-${uid}-${i})`).attr("filter", `url(#heat-blur-${uid})`).attr("opacity", 0.88)
          .append("circle").attr("cx", c[0]).attr("cy", c[1]).attr("r", r).attr("fill", heatRamp(v / maxDens));
      });

      svg.append("path").datum(topojson.mesh(topo, topo.objects.sen, (a: any, b: any) => a === b))
        .attr("d", pathGen as any).attr("fill", "none").attr("stroke", "#666666").attr("stroke-width", 1.2).attr("stroke-linejoin", "round");

      svg.selectAll("path.hit").data(geojson.features).join("path").attr("class", "hit")
        .attr("d", (d: any) => pathGen(d)).attr("fill", "transparent").style("cursor", "pointer")
        .on("mousemove", function (event: any, d: any) {
          const nom = SEN_NAME_MAP[d.properties?.name || ""] || d.properties?.name || "";
          const rect = container.getBoundingClientRect();
          const r = info[nom] || { valeur: 0, densite: 0 };
          setTip({ nom, valeur: r.valeur, densite: r.densite, x: event.clientX - rect.left, y: event.clientY - rect.top });
        })
        .on("mouseleave", () => setTip(null));
    }).catch(console.error);
    return () => { cancelled = true; if (ref.current) ref.current.innerHTML = ""; };
  }, [height, uid]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={ref} style={{ width: "100%", height }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9aa5b4" }}>Faible</span>
        <div style={{ width: 200, height: 8, borderRadius: 999, background: `linear-gradient(90deg, ${HEAT_STOPS.join(",")})` }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9aa5b4" }}>Forte</span>
      </div>
      {tip && (
        <div style={{ position: "absolute", left: Math.min(tip.x + 12, (ref.current?.clientWidth || 300) - 150), top: Math.max(tip.y - 10, 4), background: "#1a1a2e", color: "#fff", borderRadius: 9, padding: "8px 11px", fontSize: 12, lineHeight: 1.5, pointerEvents: "none", zIndex: 20, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tip.nom}</div>
          <div style={{ opacity: 0.85 }}>{tip.valeur.toLocaleString("fr-FR")} entreprise{tip.valeur > 1 ? "s" : ""}</div>
          <div style={{ opacity: 0.85 }}>Densité : {(tip.densite * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 100 km²</div>
        </div>
      )}
    </div>
  );
}

// ── Briques du rapport (mêmes patterns que le rapport commerce) ──────────────
const Th = ({ children, droite = false }: { children: React.ReactNode; droite?: boolean }) => (
  <th style={{ padding: "7px 10px", textAlign: droite ? "right" : "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", borderBottom: "2px solid #E6E9EF" }}>{children}</th>
);

function TableauClasse({ titre, lignes, couleur, total, drapeaux }: {
  titre: React.ReactNode; lignes: Ligne[]; couleur: string; total: number;
  drapeaux?: Record<string, string>;
}) {
  return (
    <div className="ds-carte" style={{ padding: "20px 22px" }}>
      <p style={TITRE_SEC}>{titre}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr><Th>#</Th><Th>{drapeaux ? "Pays" : "Libellé"}</Th><Th droite>Entreprises</Th><Th droite>Part</Th></tr></thead>
        <tbody>
          {lignes.map((x, i) => (
            <tr key={x.label} style={{ borderBottom: "1px solid #F3F5F8", background: i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
              <td style={{ padding: "6.5px 10px", width: 34 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 21, height: 21, borderRadius: 999, background: i < 3 ? couleur : "#EEF1F6", color: i < 3 ? "#fff" : "#5c6675", fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
              </td>
              <td style={{ padding: "6.5px 10px", fontWeight: 650, color: ENCRE }}>
                {drapeaux
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Drapeau iso={drapeaux[x.label] || null} nom={x.label} />{x.label}</span>
                  : x.label}
              </td>
              <td className="ds-donnee" style={{ padding: "6.5px 10px", textAlign: "right", fontWeight: 750, color: ENCRE }}>{nf(x.valeur, 0)}</td>
              <td className="ds-donnee" style={{ padding: "6.5px 10px", textAlign: "right", color: "#6b7684" }}>{total > 0 ? `${nf(x.valeur / total * 100)} %` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColonneJauges({ titre, lignes, couleur, max = 8 }: { titre: string; lignes: Ligne[]; couleur: string; max?: number }) {
  const total = lignes.reduce((s, x) => s + x.valeur, 0);
  const tetes = lignes.slice(0, max);
  const autres = lignes.slice(max).reduce((s, x) => s + x.valeur, 0);
  const maxV = Math.max(1, ...tetes.map(x => x.valeur), autres);
  const Jauge = ({ nom, v, estompe = false }: { nom: string; v: number; estompe?: boolean }) => (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: estompe ? "#8a93a3" : "#3a4553", lineHeight: 1.3 }}>{nom}</span>
        <span className="ds-donnee" style={{ fontSize: 12, fontWeight: 800, color: estompe ? "#8a93a3" : ENCRE, whiteSpace: "nowrap" }}>
          {nf(v, 0)} <span style={{ fontWeight: 600, color: "#9aa5b4", fontSize: 10.5 }}>{total > 0 ? `· ${nf(v / total * 100)} %` : ""}</span>
        </span>
      </div>
      <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(1, v / maxV * 100)}%`, height: "100%", borderRadius: 4, background: estompe ? "#c5ccd8" : couleur }} />
      </div>
    </div>
  );
  return (
    <div className="ds-carte" style={{ padding: "20px 22px" }}>
      <p style={TITRE_SEC}>{titre} <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· entreprises installées</span></p>
      {tetes.map(x => <Jauge key={x.label} nom={x.label} v={x.valeur} />)}
      {autres > 0 && <Jauge nom="Autres" v={autres} estompe />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TableauDeBordPage() {
  const [d, setD] = useState<Donnees | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  const d3Pret = useD3Pret(true);

  useEffect(() => {
    setLoading(true); setErreur(false);
    const j = (u: string) => fetch(`${API}${u}`).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    Promise.all([
      j("/dashboard/stats"),
      j("/dashboard/viz/entreprises-par-annee").catch(() => []),
      j("/dashboard/viz/entreprises-par-region").catch(() => []),
      j("/dashboard/viz/entreprises-par-secteur").catch(() => []),
      j("/dashboard/viz/entreprises-par-branche").catch(() => []),
      j("/dashboard/viz/entreprises-par-pays").catch(() => []),
      j("/dashboard/viz/entreprises-par-departement").catch(() => []),
      j("/dashboard/viz/zones-par-type").catch(() => []),
      j("/ref-pays").catch(() => []),
    ]).then(([stats, annees, regions, secteurs, branches, paysOrigine, departements, typesZones, refPays]) => {
      const iso2ParNom: Record<string, string> = {};
      (Array.isArray(refPays) ? refPays : []).forEach((p: any) => { if (p.nom_fr && p.code_iso2) iso2ParNom[p.nom_fr] = p.code_iso2; });
      const num = (l: any) => (Array.isArray(l) ? l : []).map((x: any) => ({ label: String(x.label), valeur: Number(x.valeur) || 0 }));
      setD({ stats: stats || {}, annees: num(annees), regions: num(regions), secteurs: num(secteurs),
             branches: num(branches), paysOrigine: num(paysOrigine), departements: num(departements),
             typesZones: num(typesZones), iso2ParNom });
    }).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [tick]);

  const aRetenir = useMemo(() => {
    if (!d) return [];
    const msgs: string[] = [];
    const totalR = d.regions.reduce((s, x) => s + x.valeur, 0);
    const totalS = d.secteurs.reduce((s, x) => s + x.valeur, 0);
    if (d.regions[0] && totalR > 0) msgs.push(`${d.regions[0].label} concentre ${nf(d.regions[0].valeur / totalR * 100)} % des entreprises installées.`);
    if (d.secteurs[0] && totalS > 0) msgs.push(`Le secteur « ${d.secteurs[0].label} » domine (${nf(d.secteurs[0].valeur / totalS * 100)} % des entreprises).`);
    if (d.paysOrigine[0]) msgs.push(`${d.paysOrigine[0].label} est le 1ᵉʳ pays d'origine des investisseurs (${nf(d.paysOrigine[0].valeur, 0)} entreprises).`);
    const zt = Number(d.stats.zone_ent_total) || 0, zn = Number(d.stats.zones_total) || 0;
    if (zt > 0 && zn > 0) msgs.push(`${nf(zt, 0)} implantations d'entreprises dans les ${nf(zn, 0)} zones économiques aménagées.`);
    return msgs.slice(0, 4);
  }, [d]);

  if (loading || !d3Pret) return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gap: 18, fontFamily: "var(--font-google-sans)" }}>
      <SkeletonKPIs n={5} /><SkeletonRows n={10} h={34} />
    </div>
  );
  if (erreur || !d) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;

  const s = d.stats;
  const val = (k: string) => { const n = Number(s[k]); return s[k] != null && !Number.isNaN(n) ? n : null; };
  const kpis: { l: string; txt: string; note?: string }[] = [
    { l: "Entreprises installées", txt: val("global_installees") != null ? nf(val("global_installees")!, 0) : "—" },
    { l: "Entreprises ciblées", txt: val("global_ciblees") != null ? nf(val("global_ciblees")!, 0) : "—" },
    { l: "Entreprises en contact", txt: val("global_contactees") != null ? nf(val("global_contactees")!, 0) : "—" },
    { l: "Durée de transformation", txt: val("global_duree") != null ? `${nf(val("global_duree")!, 0)} j` : "—", note: "moyenne premier contact → installation" },
    { l: "Taux de transformation", txt: val("global_taux") != null ? `${nf(val("global_taux")!)} %` : "—" },
  ];
  const totalEnt = val("global_installees") ?? d.regions.reduce((sm, x) => sm + x.valeur, 0);
  const serieAnnees = d.annees.map(a => ({ annee: Number(a.label), valeur: a.valeur }));
  const totalZones = d.typesZones.reduce((sm, x) => sm + x.valeur, 0);

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      {/* ── Bandeau exécutif ── */}
      <div style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "34px 40px 88px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "0 0 10px" }}>
                Rapport d&apos;analyse
              </p>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                Panorama de l&apos;investissement au Sénégal
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "10px 0 0", fontWeight: 500 }}>
                Entreprises installées · Prospection · Zones économiques
              </p>
            </div>
            <Link href="/" className="no-print"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 18px 9px 12px", borderRadius: 999, background: "#fff", color: BLEU, fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              <ChevronLeft size={16} /> Accueil
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px 70px" }}>
        {/* ── KPIs chevauchant le bandeau ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginTop: -52 }}>
          {kpis.map(k => (
            <div key={k.l} className="ds-carte" style={{ padding: "18px 20px", boxShadow: "0 10px 30px rgba(0,30,70,0.13)" }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: "0 0 10px" }}>{k.l}</p>
              <p className="ds-donnee" style={{ fontSize: "1.65rem", fontWeight: 800, color: ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" }}>{k.txt}</p>
              <div style={{ marginTop: 8, minHeight: 15 }}>
                {k.note && <span style={{ fontSize: 10, color: "#9aa5b4" }}>{k.note}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── À retenir ── */}
        {aRetenir.length > 0 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px", background: "linear-gradient(180deg, rgba(0,79,145,0.05), rgba(0,79,145,0.02))", border: "1px solid rgba(0,79,145,0.14)" }}>
            <p style={TITRE_SEC}>À retenir</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "10px 28px" }}>
              {aRetenir.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: BLEU, marginTop: 6, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "#2c3646", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Créations d'entreprises : graphe signature ── */}
        {serieAnnees.length > 1 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "22px 24px 14px" }}>
            <p style={TITRE_SEC}>Créations d&apos;entreprises <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· par année d&apos;installation</span></p>
            <GrapheMultiPays height={250}
              series={[{ nom: "Entreprises créées", couleur: BLEU, data: serieAnnees }]}
              fmt={v => v === null ? "—" : `${nf(v, 0)} entreprise${(v || 0) > 1 ? "s" : ""}`} />
          </div>
        )}

        {/* ── Implantation territoriale : carte + top régions ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 18 }}>
          <div className="ds-carte" style={{ padding: "20px 22px" }}>
            <p style={TITRE_SEC}>Densité des entreprises <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· par région</span></p>
            <CarteSenegal height={330} />
          </div>
          <TableauClasse
            titre={<>Régions d&apos;implantation</>}
            lignes={d.regions.slice(0, 10)} couleur={BLEU}
            total={d.regions.reduce((sm, x) => sm + x.valeur, 0)} />
        </div>

        {/* ── Secteurs / branches en jauges ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginTop: 18 }}>
          <ColonneJauges titre="Répartition par secteur" lignes={d.secteurs} couleur={BLEU} />
          <ColonneJauges titre="Répartition par branche" lignes={d.branches} couleur={ORANGE} />
        </div>

        {/* ── Origine des investisseurs / départements ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 18 }}>
          <TableauClasse titre={<>Origine des investisseurs <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· siège social</span></>}
            lignes={d.paysOrigine.slice(0, 10)} couleur={BLEU} total={totalEnt || 0} drapeaux={d.iso2ParNom} />
          <TableauClasse titre={<>Départements d&apos;implantation</>}
            lignes={d.departements.slice(0, 10)} couleur={ORANGE} total={totalEnt || 0} />
        </div>

        {/* ── Zones économiques ── */}
        {d.typesZones.length > 0 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px" }}>
            <p style={TITRE_SEC}>Zones économiques <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· aménagement du territoire</span></p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, alignItems: "start" }}>
              <div>
                {[
                  { l: "Zones aménagées", v: val("zones_total") },
                  { l: "Pôles territoriaux", v: val("poles_total") },
                  { l: "Implantations en zone", v: val("zone_ent_total") },
                ].map(x => (
                  <div key={x.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid #F3F5F8" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#3a4553" }}>{x.l}</span>
                    <span className="ds-donnee" style={{ fontSize: 16, fontWeight: 800, color: ENCRE }}>{x.v != null ? nf(x.v, 0) : "—"}</span>
                  </div>
                ))}
              </div>
              <div style={{ gridColumn: "span 2", minWidth: 0 }}>
                {d.typesZones.map(z => (
                  <div key={z.label} style={{ padding: "5px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#3a4553" }}>{z.label}</span>
                      <span className="ds-donnee" style={{ fontSize: 12, fontWeight: 800, color: ENCRE }}>{nf(z.valeur, 0)} zone{z.valeur > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ height: 8, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(2, z.valeur / Math.max(1, totalZones) * 100)}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${BLEU}, #1a6ab0)` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Pied ── */}
        <div style={{ marginTop: 22, padding: "14px 4px 0", borderTop: "1px solid #E2E6EC", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            <b style={{ color: "#5c6675" }}>Source :</b> APIX — plateforme de suivi des investissements.
          </p>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, whiteSpace: "nowrap" }}>
            Mise à jour le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
