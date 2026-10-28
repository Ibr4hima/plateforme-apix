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
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";


// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  const router = useRouter();
  // Navigation de la page dans l'URL : vues partageables par lien, F5 conserve l'état
  const [ongletPrincipal, setOngletPrincipal] = useEtatUrl<"ide"|"national">("onglet", "ide", ["ide","national"]);
  const [section,    setSection]    = useEtatUrl<"realises"|"projetes">("section", "realises", ["realises","projetes"]);
  // La vue ouverte dans l'onglet fDi. Elle vit là-bas — c'est lui qui la pilote
  // et l'écrit dans l'URL — mais la page en a besoin pour le bouton « Rapport ».
  const [vueFdi, setVueFdi] = useState<"projets"|"signaux"|"entreprises">("projets");
  const [sousOnglet, setSousOnglet] = useEtatUrl<"pays"|"comparative"|"monde">("analyse", "pays", ["pays","comparative","monde"]);
  const [vueP, setVueP] = useEtatUrl<"pays"|"secteurs">("vue", "pays", ["pays","secteurs"]);
  const [typeSecteurs, setTypeSecteurs] = useEtatUrl<"secteur"|"comparative">("typesec", "secteur", ["secteur","comparative"]);
  const [sousType,   setSousType]   = useEtatUrl<"fluxstock"|"greenfield"|"fusion">("categorie", "fluxstock", ["fluxstock","greenfield","fusion"]);
  const [showTable,  setShowTable]  = useState(false);
  // La place du bouton « Tableau de données » dans la bande des sections :
  // l'onglet ouvert l'y écrit (voir BoutonDonnees).
  const [ancreDonnees, setAncreDonnees] = useState<HTMLDivElement | null>(null);
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
      <BarreTitre titre="Investissements Privés" compact actions={<NavActions home flouFond/>}>
        <BarreTitreSegment options={[{v:"ide",l:"Investissements Directs Étrangers"},{v:"national",l:"Investissements nationaux"}]} value={ongletPrincipal} onChange={setOngletPrincipal}/>
      </BarreTitre>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <div style={{ background:"var(--carte)", zIndex:10, flexShrink:0, borderBottom:"1px solid var(--bordure)" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"10px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" as const }}>

            {/* Niveau 1 : Réalisés / Projetés — segmented control du site */}
            <div className="ds-segments" style={{ padding:3, gap:3 }}>
              {([
                {v:"realises", l:"Investissements réalisés"},
                {v:"projetes", l:"Investissements projetés"},
              ] as const).map(s=>(
                <button key={s.v} onClick={()=>setSection(s.v)} aria-pressed={section===s.v} className="ds-segment"
                  style={{ padding:"6px 16px" }}>
                  {s.l}
                </button>
              ))}
            </div>

            {/* Le rapport reste attaché aux investissements PROJETÉS, d'où on
                l'ouvre. Il lit ensuite les deux sources ensemble — la CNUCED
                mesure ce qui est entré, fDi relève ce qui est annoncé — mais
                proposer ce lien depuis « réalisés » laisserait croire à un
                rapport de cette section-là.

                CHAQUE VUE A LE SIEN, et le bouton mène à celui de la vue
                ouverte : les projets annoncés et les signaux d'investisseur ne
                se lisent pas de la même façon — un fait contre une intention —
                et un rapport unique aurait menti sur l'un des deux.

                LES TROIS VUES ONT LE LEUR, Entreprises comprise. Ce n'était pas
                le cas : on avait jugé que cette vue regroupait ce que la vue
                Projets montrait déjà. C'était vrai de la LISTE, pas du rapport.
                Le rapport des projets compte des projets ; celui-ci compte des
                INVESTISSEURS, et les questions qu'il répond n'existent pas
                ailleurs — quelle part du relevé les dix premiers portent-ils,
                combien n'ont touché qu'un seul pays, et surtout lesquels
                investissent en Afrique sans jamais être venus ici. */}
            {/* Le rapport est une destination, pas une option : le bouton plein,
                seul de la barre, lui donne le poids qu'a l'onglet en cours. */}
            {section === "projetes" && (vueFdi === "projets" || vueFdi === "signaux" || vueFdi === "entreprises") && (
              <div style={{ display:"inline-flex" }}>
                {/* L'adresse est lue AU CLIC, pas au rendu : les filtres de
                    l'onglet s'écrivent dans l'URL au fil des choix, et un href
                    figé au rendu ramènerait le lecteur à un état périmé. */}
                <button onClick={()=>router.push(
                  `/ide/${vueFdi === "signaux" ? "rapport-signaux"
                          : vueFdi === "entreprises" ? "rapport-entreprises" : "rapport"}`
                  + `?retour=${encodeURIComponent(window.location.search)}`)}
                  className="ds-bouton ds-bouton--primaire" style={{ gap:7 }}>
                  <FileText size={14}/> Rapport
                </button>
              </div>
            )}

            {/* Côté réalisés, le tableau des données de l'onglet ouvert. Sans
                boîte à elle (display: contents), la place ne compte dans la
                bande que lorsque l'onglet y a mis son bouton. */}
            <div ref={setAncreDonnees} style={{ display:"contents" }}/>

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
              {sousOnglet !== "monde"       && <OngletPays paysDispo={paysDispo} showTable={showTable} setShowTable={setShowTable} ancreDonnees={ancreDonnees} sousOnglet="pays" setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
              {sousOnglet === "monde"       && <OngletMonde showTable={showTable} setShowTable={setShowTable} ancreDonnees={ancreDonnees} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
            </>
          )}
          {section === "realises" && vueP === "secteurs" && (
            <OngletSecteurs showTable={showTable} setShowTable={setShowTable} ancreDonnees={ancreDonnees} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP} typeAnalyse={typeSecteurs} setTypeAnalyse={setTypeSecteurs} setSousOnglet={setSousOnglet}/>
          )}
          {/* Investissements projetés (fDi Markets) */}
          {section === "projetes" && <OngletFdi onVue={setVueFdi} />}
        </>
      )}

      {ongletPrincipal === "national" && <OngletNational />}
      </div>
    </div>
  );
}

