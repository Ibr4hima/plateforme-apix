"use client";

import { Building2, X } from "lucide-react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
}

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}

const LBL = ({children}:{children:string}) => (
  <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
);

interface Props { entreprise: any | null; onClose: () => void; }

export default function EntreprisePublicModal({ entreprise: e, onClose }: Props) {
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  // Recharger les référentiels NAEMA à chaque ouverture (pas de cache inter-modales)
  useEffect(() => {
    setSecteurs([]); setBranches([]); setActivites([]);
    if (!e) return;
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); })
      .catch(()=>{});
  }, [e?.id]);

  if (!e) return null;

  const secIds: number[] = e.secteur_ids  || [];
  const braIds: number[] = e.branche_ids  || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length>0 || braIds.length>0 || actIds.length>0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  // L'API retourne `pays` comme libellé lisible, `siege_pays_nom` est souvent null
  const paysStr = e.siege_pays_nom || e.pays || null;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden",display:"flex",flexDirection:"column" as const}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)",borderRadius:"20px 20px 0 0",flexShrink:0}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,flex:1}}>

          {/* En-tête */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:11,background:"rgba(227,83,54,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Building2 size={18} style={{color:"#E35336"}}/>
                </div>
                <div>
                  <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:5}}>{e.nom}</h2>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                    {e.forme_juridique && <span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{e.forme_juridique}</span>}
                    {e.pole_territoire_nom && <span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",padding:"2px 9px",borderRadius:999}}>{e.pole_territoire_nom}</span>}
                    {e.region_nom && <span style={{fontSize:11,fontWeight:700,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>Région de {e.region_nom}</span>}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Infos principales */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            {e.date_creation && (
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date de création</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(e.date_creation)}</p>
              </div>
            )}
            {paysStr && (
              <div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Pays du siège</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{paysStr}</p>
              </div>
            )}
            {locStr && (
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Localisation</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p>
              </div>
            )}
            {e.adresse && (
              <div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Adresse</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p>
              </div>
            )}
            {e.telephone && (
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Téléphone(s)</LBL>
                {e.telephone.split(",").map((t:string,i:number) => (
                  <p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtPhone(t.trim())}</p>
                ))}
              </div>
            )}
            {e.mail && (
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Email(s)</LBL>
                {e.mail.split(",").map((m:string,i:number) => (
                  <p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{m.trim()}</p>
                ))}
              </div>
            )}
            {e.siteweb && (
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px",gridColumn:"1/-1"}}>
                <LBL>Site web</LBL>
                <a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#366FE3",textDecoration:"none"}}>{e.siteweb}</a>
              </div>
            )}
          </div>

          {/* NAEMA */}
          {hasNaema && secteurs.length > 0 && (
            <div style={{marginBottom:20}}>
              <LBL>Activité(s) de l&apos;entreprise</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && actIds.includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra.nom}</span>
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
            </div>
          )}

          {/* Points focaux */}
          {e.points_focaux?.length > 0 && (
            <div style={{marginBottom:16}}>
              <LBL>Points focaux</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {e.points_focaux.map((pf:any, i:number) => (
                  <div key={i} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap" as const}}>
                      <span style={{fontWeight:700,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</span>
                      {pf.poste && <span style={{color:"#9aa5b4"}}>— {pf.poste}</span>}
                      {pf.est_principal && <span style={{fontSize:10,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",borderRadius:999,padding:"1px 7px"}}>Principal</span>}
                    </div>
                    {pf.telephone && (
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:6}}>
                        {pf.telephone.split(",").map((t:string,ti:number) => (
                          <span key={ti} style={{fontSize:11,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>{fmtPhone(t.trim())}</span>
                        ))}
                      </div>
                    )}
                    {pf.mail && (
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:5}}>
                        {pf.mail.split(",").map((m:string,mi:number) => (
                          <span key={mi} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.08)",border:"1px solid rgba(24,128,56,0.2)",padding:"2px 9px",borderRadius:999}}>{m.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:20,borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={onClose} style={{padding:"9px 20px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
