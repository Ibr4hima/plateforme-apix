"use client";

import NavActions from "@/components/layout/NavActions";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { COMP_PALETTE, badge_bleu, badge_orange, badge_vert, badge_violet, badge_gris, badgeDe } from "@/lib/couleurs";
import { X, Plus, Table, ChevronDown, ChevronUp, ChevronRight, SlidersHorizontal, Search, FileSpreadsheet, Pin } from "lucide-react";
import { calculerKpis, fmtKpi, KPI_DEFAUT, type KpiResult } from "@/lib/ideKpis";
import { SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtMillionsUSD, fmtAxe } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import PickerKpi, { BtnSwapKpi, IconeCached, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { HBarChart } from "@/components/charts/HBarChart";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { ACCENT_BLEU, AccentNace, accentDe, CurseurAnneeNace, CurseurPlageNace,
  StylesCurseurNace, pastilleCurseur, varsAccent } from "@/components/shared/CurseurNace";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { API, PAYS_COLORS, PALETTE, getPaysColor, fmtVal, BADGES_4, BadgePeriode, BadgeSerie, SERIES_TYPES, fmtNombre, SOUS_TYPE_NAV, SelecteurVueAnalyse, BtnAjoutPaysComp, BtnAjoutGroupement, SousTypeNav, ANNEE_MIN, ANNEE_MAX, useBornesCnuced, GrapheMultiPays, TopAnneesFlux, CarteTableauAnnees, CarteTableauComparatif, ModalDonnees, KPI_25_IDS, interpreterKpi, splitKpiTitre, MiniModalKpi, CONT_ORDER, sortContinents, groupByContinent, splitKpiLabel, BoutonDonnees, BdefRow, BDEF_NIVEAU_STYLE, BDEF_NIVEAU_LABEL } from "./partage";
import OngletPays from "./onglet-pays";
import OngletSecteurs from "./onglet-secteurs";
import OngletMonde from "./onglet-monde";
import OngletNational from "./onglet-national";

// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  // Navigation de la page dans l'URL : vues partageables par lien, F5 conserve l'état
  const [ongletPrincipal, setOngletPrincipal] = useEtatUrl<"ide"|"national">("onglet", "ide", ["ide","national"]);
  const [section,    setSection]    = useEtatUrl<"realises"|"projetes">("section", "realises", ["realises","projetes"]);
  const [sousOnglet, setSousOnglet] = useEtatUrl<"pays"|"comparative"|"monde">("analyse", "pays", ["pays","comparative","monde"]);
  const [vueP, setVueP] = useEtatUrl<"pays"|"secteurs">("vue", "pays", ["pays","secteurs"]);
  const [typeSecteurs, setTypeSecteurs] = useEtatUrl<"secteur"|"comparative">("typesec", "secteur", ["secteur","comparative"]);
  const [sousType,   setSousType]   = useEtatUrl<"fluxstock"|"greenfield"|"fusion">("categorie", "fluxstock", ["fluxstock","greenfield","fusion"]);
  const [paysDispo,  setPaysDispo]  = useState<any[]>([]);
  const [showTable,  setShowTable]  = useState(false);

  useEffect(() => {
    fetch(`${API}/ide/cnuced/pays-disponibles`).then(r=>r.json()).then(d=>setPaysDispo(d||[])).catch(()=>{});
  }, []);

  useEffect(() => { setShowTable(false); }, [sousOnglet, section, vueP, typeSecteurs]);

  // d3 est chargé dans un chunk séparé : on attend qu'il soit prêt avant de
  // rendre quoi que ce soit qui dessine (les données, elles, se chargent en parallèle)
  const d3Pret = useD3Pret();
  if (!d3Pret) return <div style={{ minHeight:"100vh", background:"#F6F5F3" }}/>;

  return (
    <div style={{ minHeight:"100vh", background:"#F6F5F3", fontFamily:"var(--font-google-sans)" }}>
      {/* Les curseurs de la page viennent du module commun, qui apporte sa
          propre feuille de style ; il ne reste ici que l'animation d'attente. */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <BarreTitre titre="Investissements Privés" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[{v:"ide",l:"Investissements Directs Étrangers"},{v:"national",l:"Investissements nationaux"}]} value={ongletPrincipal} onChange={setOngletPrincipal}/>
      </BarreTitre>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <div style={{ background:"#fff", position:"sticky" as const, top:0, zIndex:10, flexShrink:0, borderBottom:"1px solid #ECEAE7" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"10px 40px" }}>

            {/* Niveau 1 : Réalisés / Projetés — segmented control du site */}
            <div style={{ display:"inline-flex", background:"#F2F0EF", borderRadius:999, padding:3, gap:3 }}>
              {([
                {v:"realises", l:"Investissements réalisés"},
                {v:"projetes", l:"Investissements projetés"},
              ] as const).map(s=>(
                <button key={s.v} onClick={()=>setSection(s.v)}
                  style={{ padding:"6px 16px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, background:section===s.v?"#fff":"transparent", color:section===s.v?"#004f91":"#9aa5b4", boxShadow:section===s.v?"0 1px 4px rgba(0,0,0,0.10)":"none", fontFamily:"var(--font-google-sans)", transition:"all 0.15s", whiteSpace:"nowrap" as const }}>
                  {s.l}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Contenu — IDE ────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <>
          {/* Investissements réalisés (CNUCED) */}
          {section === "realises" && vueP === "pays" && (
            <>
              {/* « comparative » (anciennes URLs) est absorbé par la vue Pays :
                  la comparaison se déclenche via le « + » de l'en-tête */}
              {sousOnglet !== "monde"       && <OngletPays paysDispo={paysDispo} showTable={showTable} setShowTable={setShowTable} sousOnglet="pays" setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
              {sousOnglet === "monde"       && <OngletMonde showTable={showTable} setShowTable={setShowTable} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
            </>
          )}
          {section === "realises" && vueP === "secteurs" && (
            <OngletSecteurs showTable={showTable} setShowTable={setShowTable} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP} typeAnalyse={typeSecteurs} setTypeAnalyse={setTypeSecteurs} setSousOnglet={setSousOnglet}/>
          )}
          {/* Investissements projetés (FDI Markets) */}
          {section === "projetes" && (
            <div style={{ maxWidth:1400, margin:"0 auto", padding:"80px 40px", textAlign:"center" as const }}>
              <div style={{ display:"inline-flex", flexDirection:"column" as const, alignItems:"center", gap:16 }}>
                <div style={{ width:64, height:64, borderRadius:16, background:"rgba(0,79,145,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:32 }}>📈</span>
                </div>
                <h2 style={{ fontWeight:800, fontSize:"1.4rem", color:"#1a1a2e" }}>FDI Markets</h2>
                <p style={{ fontSize:14, color:"#9aa5b4", maxWidth:380, lineHeight:1.7 }}>Les données FDI Markets seront disponibles prochainement.</p>
                <div style={{ background:"rgba(0,79,145,0.07)", border:"1px solid rgba(0,79,145,0.2)", borderRadius:10, padding:"10px 20px" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Disponible prochainement</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Contenu — Investissements nationaux ──────────────────────────────── */}
      {ongletPrincipal === "national" && <OngletNational />}
    </div>
  );
}

