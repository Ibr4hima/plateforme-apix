"use client";

// Modal partagé — page Opportunités et recherche globale (⌘K).

import { ChevronDown, ChevronUp, FileText, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const devSymbole = (code?:string, sym?:string) => sym || (code ? ({XOF:"FCFA",USD:"$",EUR:"€"}[code]||code) : "");

export default function ProjetVueModal({ projet: p, secteurs, branches, activites, onClose }: {
  projet:any; secteurs:any[]; branches:any[]; activites:any[]; onClose:()=>void;
}) {
  const fmtInvest = () => {
    const sym = devSymbole(p.devise_code, p.devise_symbole);
    if (!p.investissement_est_intervalle)
      return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
    if (!p.investissement_min) return null;
    const min = Number(p.investissement_min).toLocaleString("fr-FR");
    const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
    return `${min} — ${max} ${sym}`;
  };
  const invest = fmtInvest();
  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{p.titre_projet}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {p.pole_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p.pole_nom}</span>}
              {p.region_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",padding:"3px 10px",borderRadius:999}}>Région de {p.region_nom}</span>}
              {p.departement_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.08)",padding:"3px 10px",borderRadius:999}}>Département de {p.departement_nom}</span>}
              {p.arrondissement_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#6A1B9A",background:"rgba(106,27,154,0.07)",padding:"3px 10px",borderRadius:999}}>Arrondissement de {p.arrondissement_nom}</span>}
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

          {/* Investissement / Date */}
          {(invest||p.date_debut)&&(
            <section>
              <SecTitle>Informations</SecTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {invest && <Bloc label="Investissement"><p style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{invest}</p></Bloc>}
                {p.date_debut && <Bloc label="Date de début"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_debut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p></Bloc>}
              </div>
            </section>
          )}

          {/* Description */}
          {p.description && (
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:p.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Thématiques */}
          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <section>
              <SecTitle>Thématiques du projet</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && (p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                                </div>
                                {actsDeBra.length > 0 && (
                                  <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                    {actsDeBra.map((act:any) => (
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

          {/* Porteur */}
          {p.porteurs?.length>0 && (
            <section>
              <SecTitle>{p.porteurs.length>1?"Porteurs du projet":"Porteur du projet"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.porteurs.map((por:any,pi:number)=>{
                  const tels=(por.telephones||[]).filter(Boolean);
                  const mails=(por.mails||[]).filter(Boolean);
                  return (
                    <div key={pi} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px"}}>
                      {por.nom && <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{por.nom}</p>}
                      {(tels.length>0||mails.length>0)&&(
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                          {tels.map((t:string,ti:number)=>(
                            <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t)}</span>
                          ))}
                          {mails.map((m:string,mi:number)=>(
                            <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Points focaux */}
          {p.points_focaux?.length>0 && (
            <section>
              <SecTitle>Points focaux</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.points_focaux.map((pf:any,fi:number)=>{
                  const tels=(pf.telephones||[]).filter(Boolean);
                  const mails=(pf.mails||[]).filter(Boolean);
                  return (
                    <div key={fi} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px"}}>
                      <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</p>
                      {(tels.length>0||mails.length>0)&&(
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                          {tels.map((t:string,ti:number)=>(
                            <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t)}</span>
                          ))}
                          {mails.map((m:string,mi:number)=>(
                            <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Documents */}
          {p.fichiers?.length>0&&(
            <section>
              <SecTitle>{p.fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {p.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/projets/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{f.titre||f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:"10px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail potentialité ─────────────────────────────────────────────────
