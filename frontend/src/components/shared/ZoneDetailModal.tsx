"use client";

// Fiche zone / sous-zone d'investissement — partagée entre la page Zones et la
// recherche globale (⌘K). Bâtie sur la fiche modale commune (FicheModal).

import { useState } from "react";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { ZONE_TYPE_META } from "@/components/shared/zoneTypes";
import { useAuthGate } from "@/lib/authGate";
import { useNaema } from "@/lib/referentiels";
import { fmtDate } from "@/lib/format";
import { badgeDe, badgePole } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheDocs, FicheGrille, FicheSection, FicheTexteRiche, FicheValeur } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

export default function ZoneDetailModal({ zone, onClose }: { zone:any; onClose:()=>void }) {
  const gate = useAuthGate();
  const [ficheEnt, setFicheEnt] = useState<any>(null);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  const ouvrirFiche = (id:number) => gate(async () => {
    try { const res = await fetch(`${API_BASE}/entreprises/${id}`); setFicheEnt(await res.json()); }
    catch(e){ console.error(e); }
  });

  const meta      = ZONE_TYPE_META[zone.type_zone] || ZONE_TYPE_META.ZES;
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee");
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible");
  const secIds: number[] = zone.secteur_ids||[];
  const braIds: number[] = zone.branche_ids||[];
  const actIds: number[] = zone.activite_ids||[];
  const hasActivites = secIds.length>0||braIds.length>0||actIds.length>0;
  const locStr = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");

  const LigneEnt = ({ze}:{ze:any}) => (
    <div onClick={()=>ouvrirFiche(ze.entreprise?.id)}
      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"var(--carte-douce)",borderRadius:12,border:"1px solid var(--bordure)",cursor:"pointer",transition:"border-color 0.15s, background 0.15s"}}
      onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.25)";ev.currentTarget.style.background="var(--carte)";}}
      onMouseLeave={ev=>{ev.currentTarget.style.borderColor="var(--bordure)";ev.currentTarget.style.background="var(--carte-douce)";}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:"var(--encre)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ze.entreprise?.nom}</div>
        {ze.entreprise?.forme_juridique&&<div style={{fontSize:11,color:"var(--gris)"}}>{ze.entreprise.forme_juridique}</div>}
      </div>
      <span style={{display:"flex",alignItems:"center",gap:4,background:"rgb(var(--bleu-rgb) / 0.07)",borderRadius:7,padding:"5px 10px",fontSize:11,color:"var(--bleu)",fontWeight:600,flexShrink:0}}>
        Fiche →
      </span>
    </div>
  );

  // Liste d'entreprises avec défilement interne au-delà de 3
  const ListeEnts = ({ items }: { items: any[] }) => (
    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:items.length>3?200:undefined,overflowY:items.length>3?"auto":undefined,paddingRight:items.length>3?4:undefined}}>
      {items.map((ze:any)=><LigneEnt key={ze.id||ze.entreprise?.id} ze={ze}/>)}
    </div>
  );

  return (
    <>
      <FicheModal titre={zone.nom_zone} onClose={onClose} zIndex={500}
        badges={<>
          <span style={{ ...badgeDe(meta.color), fontWeight: 800, letterSpacing: "0.04em" }}>{zone.type_zone}</span>
          {zone.pole_nom && <span style={badgePole(zone.pole_nom)}>{zone.pole_nom}</span>}
        </>}>

        {/* Informations */}
        {(zone.date_creation||zone.superficie||locStr||zone.decret_creation)&&(
          <FicheSection titre="Informations">
            <FicheGrille>
              {locStr && <FicheBloc label="Localisation"><FicheValeur>{locStr}</FicheValeur></FicheBloc>}
              {zone.superficie && <FicheBloc label="Superficie"><FicheValeur>{Number(zone.superficie).toLocaleString("fr-FR")} ha</FicheValeur></FicheBloc>}
              {zone.date_creation && <FicheBloc label="Création"><FicheValeur>{fmtDate(zone.date_creation)}</FicheValeur></FicheBloc>}
              {zone.decret_creation && <FicheBloc label="Décret"><FicheValeur>{zone.decret_creation}</FicheValeur></FicheBloc>}
            </FicheGrille>
          </FicheSection>
        )}

        {/* Description */}
        {zone.description && (
          <FicheSection titre="Description">
            <FicheTexteRiche html={zone.description} />
          </FicheSection>
        )}

        {/* Activités autorisées */}
        {hasActivites && secteurs.length > 0 && (
          <FicheSection titre="Activités autorisées">
            <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites} secIds={secIds} braIds={braIds} actIds={actIds} />
          </FicheSection>
        )}

        {/* Entreprises installées / éligibles */}
        {installes.length > 0 && (
          <FicheSection titre="Entreprises installées" count={installes.length}>
            <ListeEnts items={installes} />
          </FicheSection>
        )}
        {eligibles.length > 0 && (
          <FicheSection titre="Entreprises éligibles" count={eligibles.length}>
            <ListeEnts items={eligibles} />
          </FicheSection>
        )}

        {/* Documents */}
        <FicheDocs fichiers={zone.fichiers || []} hrefDe={f => `${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} />
      </FicheModal>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={()=>setFicheEnt(null)} zIndex={520}/>
    </>
  );
}
