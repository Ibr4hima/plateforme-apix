"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import { ZONE_TYPE_META as TYPE_META, ZONE_TYPE_ORDER } from "@/components/shared/zoneTypes";
import ZoneDetailModal from "@/components/shared/ZoneDetailModal";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards, SkeletonChart } from "@/components/shared/Skeleton";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { badgePole, poleAccent, voile } from "@/lib/couleurs";
import { carteCliquable } from "@/components/shared/PanneauFiltres";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Vue types de zones (cards + liste) ───────────────────────────────────────
function ZonesParType({ zones }: { zones: any[] }) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [detailZone, setDetailZone] = useState<any>(null);

  // Group zones by type_zone, preserving insertion order
  const byType: Record<string, any[]> = {};
  zones.forEach(z => {
    if (!byType[z.type_zone]) byType[z.type_zone] = [];
    byType[z.type_zone].push(z);
  });

  const ordreType = (t: string) => { const i = ZONE_TYPE_ORDER.indexOf(t); return i === -1 ? ZONE_TYPE_ORDER.length : i; };
  const types = Object.entries(byType).map(([type, zs]) => ({
    type,
    meta: TYPE_META[type] || { label: type, color: "var(--gris-fort)", bg: "rgb(var(--gris-rgb) / 0.06)", border: "rgb(var(--gris-rgb) / 0.2)" },
    zones: zs,
    installed: zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "installee").length, 0),
    eligible:  zs.reduce((s, z) => s + (z.entreprises || []).filter((ze: any) => ze.statut === "eligible").length, 0),
    superficie: zs.reduce((s, z) => s + (Number(z.superficie) || 0), 0),
  })).sort((a, b) => ordreType(a.type) - ordreType(b.type));

  const selectedInfo = selectedType ? types.find(t => t.type === selectedType) : null;

  return (
    <div>
      {/* ── Cards types ── */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(types.length, 3)},1fr)`, gap:14, marginBottom: selectedType ? 32 : 0 }}>
        {types.map(t => {
          const active = selectedType === t.type;
          const c = t.meta.color;
          const entreprises = t.installed + t.eligible;
          const GRADS: Record<string,string> = {
            "var(--bleu)":"linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu) 60%,var(--bleu-clair) 100%)",
            "var(--orange)":"linear-gradient(90deg,var(--orange) 0%,var(--orange) 60%,var(--orange) 100%)",
            "var(--vert)":"linear-gradient(90deg,var(--vert-fonce) 0%,var(--vert) 60%,var(--vert) 100%)",
          };
          const grad = GRADS[c] || `linear-gradient(90deg,${c} 0%,${c} 100%)`;
          return (
            <div key={t.type} {...carteCliquable(() => setSelectedType(active ? null : t.type))}
              style={{ background:"var(--carte)", border:`1.5px solid ${voile(c, active ? 60 : 45)}`, borderRadius:14, cursor:"pointer",
                transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",
                boxShadow: active ? `0 12px 28px ${voile(c, 18)}` : `0 4px 18px ${voile(c, 15)}`,
                transform: active ? "translateY(-2px)" : "none",
                display:"flex", flexDirection:"column" as const, overflow:"hidden", minWidth:0 }}
              onMouseEnter={ev => {
                if (!active) { ev.currentTarget.style.boxShadow = `0 12px 28px ${voile(c, 18)}`; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = `${voile(c, 60)}`; }
                // Titre trop long : glisse pour révéler la fin
                const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                const span = box?.firstElementChild as HTMLElement | null;
                if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
              }}
              onMouseLeave={ev => {
                if (!active) { ev.currentTarget.style.boxShadow = `0 4px 18px ${voile(c, 15)}`; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = `${voile(c, 45)}`; }
                const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
              }}>

              {/* Bandeau du type — même style que « Prochain événement » */}
              <div style={{ display:"flex", alignItems:"center", gap:7, background:grad, padding:"6px 16px" }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:"var(--carte)", animation:"pulseDot 1.6s ease-out infinite", flexShrink:0 }}/>
                <span style={{ fontSize:10, fontWeight:800, color:"var(--sur-bleu)", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>{t.type}</span>
                {active && (
                  <span style={{ marginLeft:"auto", width:16, height:16, borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="var(--carte)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
              </div>

              <div style={{ padding:"14px 16px 14px", flex:1 }}>
                {/* Libellé du type (défile au survol si trop long) */}
                <div data-marquee style={{ fontWeight:700, fontSize:13.5, color:"var(--encre)", lineHeight:1.35, overflow:"hidden", whiteSpace:"nowrap" as const }}>
                  <span style={{ display:"inline-block" }}>{t.meta.label}</span>
                </div>

                {/* Compteurs libellés */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                  <div style={{ background:`${voile(c, 4)}`, border:`1px solid ${voile(c, 12)}`, borderRadius:10, padding:"8px 11px" }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Entreprise{entreprises>1?"s":""}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:entreprises>0?"var(--encre)":"var(--gris)" }}>{entreprises}</p>
                  </div>
                  <div style={{ background:`${voile(c, 4)}`, border:`1px solid ${voile(c, 12)}`, borderRadius:10, padding:"8px 11px" }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:c, textTransform:"uppercase" as const, marginBottom:3 }}>Zone{t.zones.length>1?"s":""}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:t.zones.length>0?"var(--encre)":"var(--gris)" }}>{t.zones.length}</p>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div style={{ display:"flex", borderTop:"1px solid var(--bordure)" }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"10px 0", fontSize:11.5, color:c, fontWeight:700, transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background=`${voile(c, 5)}`}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  {active ? "Affiché" : "Voir les zones"} <ChevronRight size={13}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Liste des zones du type sélectionné ── */}
      {selectedInfo && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:15, padding:"15px 20px", marginBottom:20, borderRadius:16,
            background:`linear-gradient(100deg, ${voile(selectedInfo.meta.color, 8)} 0%, ${voile(selectedInfo.meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
            border:`1px solid ${voile(selectedInfo.meta.color, 13)}` }}>
            <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--carte)", border:`1px solid ${selectedInfo.meta.border}`, boxShadow:`0 2px 6px ${voile(selectedInfo.meta.color, 10)}` }}>
              <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.02em", color:selectedInfo.meta.color }}>{selectedInfo.type}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:selectedInfo.meta.color, textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:3 }}>Type de zone</div>
              <div style={{ fontWeight:800, fontSize:16, color:"var(--encre)", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{selectedInfo.meta.label}</div>
            </div>
            <span style={{ display:"inline-flex", alignItems:"center", fontSize:12.5, fontWeight:700, color:"var(--sur-bleu)", background:selectedInfo.meta.color, padding:"6px 15px", borderRadius:999, flexShrink:0, whiteSpace:"nowrap" as const, boxShadow:`0 2px 8px ${voile(selectedInfo.meta.color, 25)}` }}>
              {selectedInfo.zones.length} zone{selectedInfo.zones.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {selectedInfo.zones.map((z: any) => <ZoneBigCard key={z.id} zone={z} color={selectedInfo.meta.color} onClick={()=>setDetailZone(z)} />)}
          </div>
        </div>
      )}

      {detailZone && <ZoneDetailModal zone={detailZone} onClose={()=>setDetailZone(null)} />}
    </div>
  );
}

// ── Grande card zone (ouvre le modal détail) ──────────────────────────────────
function ZoneBigCard({ zone, color="var(--bleu)", onClick }: { zone:any; color?:string; onClick:()=>void }) {
  const entreprises = (zone.entreprises||[]).length;
  const hoverC = zone.pole_nom ? poleAccent(zone.pole_nom) : `${voile(color, 33)}`;
  return (
    <div {...carteCliquable(onClick)}
      style={{ background:"var(--carte)", border:"1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius:16, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", padding:"18px 20px 16px", display:"flex", flexDirection:"column" as const, gap:13 }}
      onMouseEnter={e=>{
        e.currentTarget.style.boxShadow="var(--ombre-1)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor=hoverC;
        // Contenus trop longs : glissent pour révéler la fin
        e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
          const span = box.firstElementChild as HTMLElement | null;
          if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
        });
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";
        e.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
          const span = box.firstElementChild as HTMLElement | null;
          if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
        });
      }}>

      {/* Nom + superficie | badge pôle à droite */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, minWidth:0 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div data-marquee style={{ fontWeight:800, fontSize:15.5, color:"var(--encre)", lineHeight:1.35, letterSpacing:"-0.01em", overflow:"hidden", whiteSpace:"nowrap" as const }}>
            <span style={{ display:"inline-block" }}>{zone.nom_zone}</span>
          </div>
          {zone.superficie&&<div style={{ fontSize:11, fontWeight:500, color:"var(--gris)", marginTop:3 }}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</div>}
        </div>
        {zone.pole_nom&&(
          <span title={zone.pole_nom} style={{ ...badgePole(zone.pole_nom), whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis", flexShrink:1, minWidth:0 }}>
            {zone.pole_nom}
          </span>
        )}
      </div>

      {/* Localisation · Entreprises en rangée épurée */}
      <div style={{ display:"flex", alignItems:"center", borderTop:"1px solid var(--bordure)", paddingTop:13, marginTop:"auto" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"var(--gris)", textTransform:"uppercase" as const, marginBottom:4 }}>Localisation</p>
          <p data-marquee style={{ fontSize:12.5, fontWeight:700, color:(zone.departement_nom||zone.region_nom)?"var(--encre)":"var(--gris)", overflow:"hidden", whiteSpace:"nowrap" as const }}>
            <span style={{ display:"inline-block" }}>{[zone.departement_nom, zone.region_nom].filter(Boolean).join(", ") || "—"}</span>
          </p>
        </div>
        <div style={{ width:1, alignSelf:"stretch", background:"var(--fond)", margin:"0 18px" }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"var(--gris)", textTransform:"uppercase" as const, marginBottom:4 }}>Entreprise{entreprises>1?"s":""}</p>
          <p style={{ fontSize:12.5, fontWeight:700, color:entreprises>0?"var(--encre)":"var(--gris)", fontVariantNumeric:"tabular-nums" }}>{entreprises}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ZonesPage() {
  const [zones,      setZones]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [erreur,     setErreur]     = useState(false);
  const [tick,       setTick]       = useState(0);
  const [onglet,     setOnglet]     = useEtatUrl<"zones"|"territoire">("onglet", "zones", ["zones","territoire"]);

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  useEffect(()=>{
    setLoading(true); setErreur(false);
    fetch(`${API_BASE}/zones-types`)
      .then(r=>{ if(!r.ok) throw new Error(); return r.json(); }).then(d=>{ setZones(d||[]); })
      .catch(()=>setErreur(true)).finally(()=>setLoading(false));
  },[tick]);

  return (
    <main style={{ minHeight:"100vh", background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>
      {/* ── Hero ── */}
      <BarreTitre titre={"Zones d'Investissement"} compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[{v:"zones",l:"Zones d'investissement"},{v:"territoire",l:"Pôles territoires"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Contenu ── */}
      <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
        {onglet==="zones" && (
          loading ? <SkeletonCards n={3} cols={3} height={190}/> : erreur ? <ErreurChargement onRetry={()=>setTick(t=>t+1)}/> : <div className="charge-in"><ZonesParType zones={zones}/></div>
        )}
        {onglet==="territoire" && (
          loading ? <SkeletonChart height={520}/> : erreur ? <ErreurChargement onRetry={()=>setTick(t=>t+1)}/> : <div className="charge-in"><VueTerritorialeSenegal zones={zones}/></div>
        )}
      </section>
    </main>
  );
}

