"use client";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { useEffect, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { API } from "./partage";
import { useDonnees, VIDE } from "@/lib/donnees";
import OngletPays from "./onglet-pays";
import OngletSecteurs from "./onglet-secteurs";
import OngletMonde from "./onglet-monde";
import OngletNational from "./onglet-national";
import OngletFdi from "./onglet-fdi";
import Link from "next/link";
import { FileText } from "lucide-react";


// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  // Navigation de la page dans l'URL : vues partageables par lien, F5 conserve l'état
  const [ongletPrincipal, setOngletPrincipal] = useEtatUrl<"ide"|"national">("onglet", "ide", ["ide","national"]);
  const [section,    setSection]    = useEtatUrl<"realises"|"projetes">("section", "realises", ["realises","projetes"]);
  const [sousOnglet, setSousOnglet] = useEtatUrl<"pays"|"comparative"|"monde">("analyse", "pays", ["pays","comparative","monde"]);
  const [vueP, setVueP] = useEtatUrl<"pays"|"secteurs">("vue", "pays", ["pays","secteurs"]);
  const [typeSecteurs, setTypeSecteurs] = useEtatUrl<"secteur"|"comparative">("typesec", "secteur", ["secteur","comparative"]);
  const [sousType,   setSousType]   = useEtatUrl<"fluxstock"|"greenfield"|"fusion">("categorie", "fluxstock", ["fluxstock","greenfield","fusion"]);
  const [showTable,  setShowTable]  = useState(false);
  // Liste stable, en cache pour la session.
  const { data: paysDispoData } = useDonnees<any[]>(`${API}/ide/cnuced/pays-disponibles`);
  const paysDispo = (paysDispoData ?? VIDE) as any[];

  useEffect(() => { setShowTable(false); }, [sousOnglet, section, vueP, typeSecteurs]);

  // d3 est chargé dans un chunk séparé : on attend qu'il soit prêt avant de
  // rendre quoi que ce soit qui dessine (les données, elles, se chargent en parallèle)
  const d3Pret = useD3Pret();
  if (!d3Pret) return <div style={{ minHeight:"100vh", background:"var(--champ)" }}/>;

  return (
    // La page occupe exactement la fenêtre et ne défile pas elle-même : le
    // bandeau et les onglets restent en place, et le défilement appartient aux
    // deux colonnes du dessous, chacune la sienne. 100dvh et non 100vh — sur
    // mobile, la barre d'adresse rétractable fausse la seconde.
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column" as const, overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      {/* Les curseurs de la page viennent du module commun, qui apporte sa
          propre feuille de style ; il ne reste ici que l'animation d'attente. */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <BarreTitre titre="Investissements Privés" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[{v:"ide",l:"Investissements Directs Étrangers"},{v:"national",l:"Investissements nationaux"}]} value={ongletPrincipal} onChange={setOngletPrincipal}/>
      </BarreTitre>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <div style={{ background:"var(--carte)", zIndex:10, flexShrink:0, borderBottom:"1px solid var(--bordure)" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"10px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" as const }}>

            {/* Niveau 1 : Réalisés / Projetés — segmented control du site */}
            <div style={{ display:"inline-flex", background:"var(--fond)", borderRadius:999, padding:3, gap:3 }}>
              {([
                {v:"realises", l:"Investissements réalisés"},
                {v:"projetes", l:"Investissements projetés"},
              ] as const).map(s=>(
                <button key={s.v} onClick={()=>setSection(s.v)}
                  style={{ padding:"6px 16px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, background:section===s.v?"var(--carte)":"transparent", color:section===s.v?"var(--bleu)":"var(--gris)", boxShadow:section===s.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.10)":"none", fontFamily:"var(--font-google-sans)", transition:"all 0.15s", whiteSpace:"nowrap" as const }}>
                  {s.l}
                </button>
              ))}
            </div>

            {/* Le rapport reste attaché aux investissements PROJETÉS, d'où on
                l'ouvre. Il lit ensuite les deux sources ensemble — la CNUCED
                mesure ce qui est entré, fDi relève ce qui est annoncé — mais
                proposer ce lien depuis « réalisés » laisserait croire à un
                rapport de cette section-là. */}
            {/* La forme du segment actif des vues : pastille pleine dans son
                anneau clair. Le rapport est une destination, pas une option —
                il mérite le poids qu'a l'onglet en cours. */}
            {section === "projetes" && (
              <div style={{ display:"inline-flex", background:"var(--carte)", border:"1px solid var(--bordure)",
                borderRadius:999, padding:3, boxShadow:"var(--ombre-1)" }}>
                <Link href="/ide/rapport"
                  style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"6px 18px", borderRadius:999,
                    background:"var(--bleu-action)", color:"var(--sur-bleu)", fontSize:12.5, fontWeight:700,
                    textDecoration:"none", whiteSpace:"nowrap" as const, fontFamily:"var(--font-google-sans)",
                    boxShadow:"0 2px 8px rgb(var(--ombre-rgb) / 0.30), inset 0 1px 0 rgba(255,255,255,0.12)" }}>
                  <FileText size={14}/> Rapport
                </Link>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      {/* minHeight:0 est indispensable : sans lui, un enfant flex refuse de
          devenir plus petit que son contenu et la zone déborde au lieu de
          défiler. */}
      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column" as const }}>
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
          {/* Investissements projetés (fDi Markets) */}
          {section === "projetes" && <OngletFdi />}
        </>
      )}

      {ongletPrincipal === "national" && <OngletNational />}
      </div>
    </div>
  );
}

