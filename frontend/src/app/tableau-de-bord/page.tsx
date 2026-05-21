"use client";

import Navbar from "@/components/layout/Navbar";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, Building2, Calendar, Handshake, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ONGLETS = [
  { key:"kpi",       label:"Vue d'ensemble" },
  { key:"analyse",   label:"Analyses" },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, icon:Icon, trend }:{
  label:string; value:string|number; sub?:string; color:string; icon:any; trend?:"up"|"down"|null;
}) {
  return (
    <div style={{background:"#fff",borderRadius:14,padding:"20px 22px",border:"1px solid #E8E5E3",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{width:38,height:38,borderRadius:10,background:`${color}10`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon size={17} style={{color}}/>
        </div>
        {trend&&<div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,color:trend==="up"?"#15803d":"#dc2626"}}>
          {trend==="up"?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}
        </div>}
      </div>
      <div style={{fontWeight:800,fontSize:"1.9rem",color:"#1a1a2e",lineHeight:1,marginBottom:6}}>{typeof value==="number"?value.toLocaleString("fr-FR"):value}</div>
      <div style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:sub?4:0}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"#9aa5b4"}}>{sub}</div>}
    </div>
  );
}

// ── Placeholder graphique ─────────────────────────────────────────────────────
function ChartPlaceholder({ title, height=220, note }:{title:string;height?:number;note?:string}) {
  return (
    <div style={{background:"#fff",borderRadius:14,padding:"20px 22px",border:"1px solid #E8E5E3",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <p style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>{title}</p>
      {note&&<p style={{fontSize:11,color:"#9aa5b4",marginBottom:16}}>{note}</p>}
      <div style={{height,background:"linear-gradient(135deg,#F8F7F6,#F2F0EF)",borderRadius:10,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:8,border:"1px dashed #E8E5E3"}}>
        <BarChart2 size={28} style={{color:"#E8E5E3"}}/>
        <span style={{fontSize:12,color:"#C5BFBB",fontWeight:600}}>Visualisation à venir</span>
        <span style={{fontSize:11,color:"#C5BFBB"}}>Données en cours d'intégration</span>
      </div>
    </div>
  );
}

export default function TableauDeBordPage() {
  const [onglet, setOnglet] = useState("kpi");
  const [kpis, setKpis] = useState({
    entreprises:0, accords:0, evenements_total:0, evenements_a_venir:0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const safe=(p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/entreprises?per_page=1`).then(r=>r.json()),      {}),
      safe(fetch(`${API_BASE}/accords?per_page=1`).then(r=>r.json()),           {}),
      safe(fetch(`${API_BASE}/evenements/stats`).then(r=>r.json()),             {}),
    ]).then(([entData,accData,evStats])=>{
      setKpis({
        entreprises:         entData?.total||0,
        accords:             accData?.total||0,
        evenements_total:    evStats?.total||0,
        evenements_a_venir:  evStats?.a_venir||0,
      });
    }).finally(()=>setLoading(false));
  },[]);

  return (
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Header */}
      <section
  style={{
    padding: "100px 40px 40px",
    background:
      "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
    position: "relative" as const,
    overflow: "hidden",
  }}
>
  {/* Effet lumineux décoratif */}
  <div
    style={{
      position: "absolute" as const,
      inset: 0,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        position: "absolute" as const,
        bottom: "-20%",
        left: "-5%",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background:
          "radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)",
      }}
    />
  </div>

  <div
    style={{
      maxWidth: 1280,
      margin: "0 auto",
      position: "relative" as const,
      zIndex: 1,
    }}
  >
    <div className="hero-tag" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Gestion des Investissements et des Investisseurs</span>
          </div>

    <h1
      style={{
        fontWeight: 800,
        fontSize: "clamp(1.8rem,3vw,2.6rem)",
        color: "#fff",
        marginBottom: 8,
      }}
    >
      Tableau de bord
    </h1>

    <p
      style={{
        color: "rgba(255,255,255,0.45)",
        fontSize: 14,
        marginBottom: 28,
      }}
    >
      Vue consolidée de l'activité d'investissement au Sénégal
    </p>

    {/* Onglets */}
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "rgba(255,255,255,0.05)",
        borderRadius: 10,
        padding: 3,
        width: "fit-content",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(10px)",
      }}
    >
      {ONGLETS.map((o) => (
        <button
          key={o.key}
          onClick={() => setOnglet(o.key)}
          style={{
            padding: "8px 20px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.15s",
            background:
              onglet === o.key
                ? "linear-gradient(135deg,#ca631f,#D96D3B)"
                : "transparent",
            color:
              onglet === o.key
                ? "#fff"
                : "rgba(255,255,255,0.45)",
            boxShadow:
              onglet === o.key
                ? "0 4px 16px rgba(202,99,31,0.35)"
                : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
</section>

      {/* Contenu */}
      <section style={{padding:"32px 60px 80px",maxWidth:1280,margin:"0 auto"}}>

        {onglet==="kpi"&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:24}}>
            {/* KPIs principaux */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
              <KPICard label="Entreprises installées" value={kpis.entreprises} color="#E35336" icon={Building2} sub="Registre APIX"/>
              <KPICard label="Accords & Traités" value={kpis.accords} color="#366FE3" icon={Handshake} sub="Bilatéraux et multilatéraux"/>
              <KPICard label="Événements répertoriés" value={kpis.evenements_total} color="#188038" icon={Calendar} sub="Forums, salons, B2B"/>
              <KPICard label="À venir" value={kpis.evenements_a_venir} color="#FFB0A1" icon={Activity} sub="Prochains événements" trend="up"/>
            </div>
            {/* Graphiques ligne 1 */}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
              <ChartPlaceholder title="Évolution des flux d'IDE — 2019 à 2024" height={260} note="Source : CNUCED / APIX · Milliards USD"/>
              <ChartPlaceholder title="Répartition sectorielle" height={260} note="Entreprises par secteur NAEMA"/>
            </div>
            {/* Graphiques ligne 2 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
              <ChartPlaceholder title="Entreprises par région" height={200} note="Localisation géographique"/>
              <ChartPlaceholder title="Accords par statut" height={200} note="En vigueur vs expirés"/>
              <ChartPlaceholder title="Événements par pays hôte" height={200} note="Top 10 destinations"/>
            </div>
          </div>
        )}

        {onglet==="analyse"&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:24}}>
            {/* Titre section */}
            <div style={{background:"#fff",borderRadius:14,padding:"24px 26px",border:"1px solid #E8E5E3"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:9,background:"rgba(227,83,54,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <TrendingUp size={17} style={{color:"#E35336"}}/>
                </div>
                <div>
                  <p style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>Analyses statistiques</p>
                  <p style={{fontSize:12,color:"#9aa5b4"}}>Vue chiffrée de l'investissement au Sénégal</p>
                </div>
              </div>
              <p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,borderTop:"1px solid #F2F0EF",paddingTop:14,marginTop:4}}>
                Cette section accueillera les analyses approfondies : tendances d'investissement, comparaisons sectorielles, performance des zones économiques, évolution des accords, et indicateurs de l'environnement des affaires. Les données seront alimentées depuis les modules en temps réel.
              </p>
            </div>
            {/* Placeholders analyses */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <ChartPlaceholder title="Analyse des tendances IDE 2015–2024" height={280} note="Évolution pluriannuelle et projections"/>
              <ChartPlaceholder title="Attractivité par secteur" height={280} note="Indice de compétitivité sectorielle"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
              <ChartPlaceholder title="Performance ZES / ZAI / ZFI" height={220} note="Taux d'occupation et investissements"/>
              <ChartPlaceholder title="Top pays investisseurs" height={220} note="Volume et fréquence des accords"/>
              <ChartPlaceholder title="Événements & conversions" height={220} note="Taux de transformation prospects → entreprises"/>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
