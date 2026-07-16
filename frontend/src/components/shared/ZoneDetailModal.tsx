"use client";

// Modal détail d'une zone / sous-zone — partagé entre la page Zones et la
// recherche globale (⌘K).

import { Building2, FileText, X } from "lucide-react";
import { useState } from "react";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { ZONE_TYPE_META } from "@/components/shared/zoneTypes";
import { useAuthGate } from "@/lib/authGate";
import { useNaema } from "@/lib/referentiels";
import { fmtDate } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TYPE_META = ZONE_TYPE_META;

export default function ZoneDetailModal({ zone, onClose }: { zone:any; onClose:()=>void }) {
  const gate = useAuthGate();
  const [ficheEnt,  setFicheEnt]  = useState<any>(null);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  const ouvrirFiche = (id:number) => gate(async () => {
    try { const res=await fetch(`${API_BASE}/entreprises/${id}`); setFicheEnt(await res.json()); }
    catch(e){ console.error(e); }
  });

  const meta      = TYPE_META[zone.type_zone]||TYPE_META.ZES;
  const col       = meta.color;
  const installes = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="installee");
  const eligibles = (zone.entreprises||[]).filter((ze:any)=>ze.statut==="eligible");
  const secIds: number[] = zone.secteur_ids||[];
  const braIds: number[] = zone.branche_ids||[];
  const actIds: number[] = zone.activite_ids||[];
  const hasActivites = secIds.length>0||braIds.length>0||actIds.length>0;
  const locStr = [zone.departement_nom, zone.region_nom].filter(Boolean).join(", ");

  const SecTitle = ({children}:{children:React.ReactNode}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );
  const LigneEnt = ({ze}:{ze:any}) => (
    <div onClick={()=>ouvrirFiche(ze.entreprise?.id)}
      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#FAFAF9",borderRadius:12,border:"1px solid #F0EEEC",cursor:"pointer",transition:"border-color 0.15s, background 0.15s"}}
      onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";ev.currentTarget.style.background="#fff";}}
      onMouseLeave={ev=>{ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ze.entreprise?.nom}</div>
        {ze.entreprise?.forme_juridique&&<div style={{fontSize:11,color:"#9aa5b4"}}>{ze.entreprise.forme_juridique}</div>}
      </div>
      <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,79,145,0.07)",borderRadius:7,padding:"5px 10px",fontSize:11,color:"#004f91",fontWeight:600,flexShrink:0}}>
        Fiche →
      </span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
          {/* Liseré d'accent */}
          <div style={{height:4,background:"#004f91",flexShrink:0}}/>

          {/* En-tête */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
            <div style={{minWidth:0}}>
              <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{zone.nom_zone}</h2>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:800,letterSpacing:"0.04em",color:col,background:`${col}12`,padding:"3px 10px",borderRadius:999}}>{zone.type_zone}</span>
                {zone.pole_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{zone.pole_nom}</span>}
              </div>
            </div>
            <button onClick={onClose}
              style={{background:"#F5F4F3",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
              onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
              onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
              <X size={15} color="#4a5568"/>
            </button>
          </div>

          {/* Corps */}
          <div style={{padding:"22px 28px",overflowY:"auto" as const,flex:1,display:"flex",flexDirection:"column" as const,gap:22}}>

            {/* Informations */}
            {(zone.date_creation||zone.superficie||locStr||zone.decret_creation)&&(
              <section>
                <SecTitle>Informations</SecTitle>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {locStr&&<Bloc label="Localisation"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p></Bloc>}
                  {zone.superficie&&<Bloc label="Superficie"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{Number(zone.superficie).toLocaleString("fr-FR")} ha</p></Bloc>}
                  {zone.date_creation&&<Bloc label="Création"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(zone.date_creation)}</p></Bloc>}
                  {zone.decret_creation&&<Bloc label="Décret"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{zone.decret_creation}</p></Bloc>}
                </div>
              </section>
            )}

            {/* Description */}
            {zone.description&&(
              <section>
                <SecTitle>Description</SecTitle>
                <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                  <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                  <div data-rte dangerouslySetInnerHTML={{__html:zone.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
                </div>
              </section>
            )}

            {/* Activités autorisées */}
            {hasActivites&&secteurs.length>0&&(
              <section>
                <SecTitle>Activités autorisées</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {secIds.map((secId:number)=>{
                    const sec=secteurs.find((s:any)=>s.id===secId); if(!sec) return null;
                    const brasDuSec=branches.filter((b:any)=>b.secteur_id===secId&&braIds.includes(b.id));
                    return (
                      <div key={secId}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                        </div>
                        {brasDuSec.length>0&&(
                          <div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                            {brasDuSec.map((bra:any)=>{
                              const actsDeBra=activites.filter((a:any)=>a.branche_id===bra.id&&actIds.includes(a.id));
                              return (
                                <div key={bra.id}>
                                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                    <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                                  </div>
                                  {actsDeBra.length>0&&(
                                    <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                      {actsDeBra.map((act:any)=>(
                                        <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                          <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                          <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Entreprises installées */}
            {installes.length>0&&(
              <section>
                <SecTitle>Entreprises installées ({installes.length})</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:installes.length>3?200:undefined,overflowY:installes.length>3?"auto" as const:undefined,paddingRight:installes.length>3?4:undefined}}>
                  {installes.map((ze:any)=><LigneEnt key={ze.id||ze.entreprise?.id} ze={ze}/>)}
                </div>
              </section>
            )}

            {/* Entreprises éligibles */}
            {eligibles.length>0&&(
              <section>
                <SecTitle>Entreprises éligibles ({eligibles.length})</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:eligibles.length>3?200:undefined,overflowY:eligibles.length>3?"auto" as const:undefined,paddingRight:eligibles.length>3?4:undefined}}>
                  {eligibles.map((ze:any)=><LigneEnt key={ze.id||ze.entreprise?.id} ze={ze}/>)}
                </div>
              </section>
            )}

            {/* Documents PDF */}
            {zone.fichiers?.length>0&&(
              <section>
                <SecTitle>{zone.fichiers.length>1?"Documents":"Document"}</SecTitle>
                <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                  {zone.fichiers.map((f:any)=>(
                    <a key={f.id} href={`${API_BASE}/zones-types/${zone.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                      <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                      <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{f.titre||f.nom}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Pied */}
          <div style={{display:"flex",justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",flexShrink:0}}>
            <button onClick={onClose}
              style={{padding:"10px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
              Fermer
            </button>
          </div>
        </div>
      </div>
      <EntreprisePublicModal entreprise={ficheEnt} onClose={()=>setFicheEnt(null)}/>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
