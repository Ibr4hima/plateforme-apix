"use client";

import { X } from "lucide-react";
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

  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children,full}:{label:string;children:React.ReactNode;full?:boolean}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0,gridColumn:full?"1/-1":undefined}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{e.nom}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {e.forme_juridique && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#6b7280",background:"#F2F0EF",padding:"3px 10px",borderRadius:999}}>{e.forme_juridique}</span>}
              {e.pole_territoire_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#6A1B9A",background:"rgba(106,27,154,0.07)",padding:"3px 10px",borderRadius:999}}>{e.pole_territoire_nom}</span>}
              {e.region_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>Région de {e.region_nom}</span>}
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
          <section>
            <SecTitle>Informations</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {e.date_creation && <Bloc label="Création"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(e.date_creation)}</p></Bloc>}
              {paysStr && <Bloc label="Pays du siège"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{paysStr}</p></Bloc>}
              {locStr && <Bloc label="Localisation"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p></Bloc>}
              {e.adresse && <Bloc label="Adresse"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p></Bloc>}
              {e.siteweb && (
                <Bloc label="Site web" full>
                  <a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:12.5,fontWeight:600,color:"#004f91",textDecoration:"none",wordBreak:"break-all" as const}}>{e.siteweb}</a>
                </Bloc>
              )}
            </div>
          </section>

          {/* Contact */}
          {(e.telephone||e.mail)&&(
            <section>
              <SecTitle>Contact</SecTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {e.telephone && (
                  <Bloc label={e.telephone.includes(",")?"Téléphones":"Téléphone"}>
                    {e.telephone.split(",").map((t:string,i:number) => (
                      <p key={i} style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtPhone(t.trim())}</p>
                    ))}
                  </Bloc>
                )}
                {e.mail && (
                  <Bloc label={e.mail.includes(",")?"Emails":"Email"}>
                    {e.mail.split(",").map((m:string,i:number) => (
                      <p key={i} style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e",wordBreak:"break-all" as const}}>{m.trim()}</p>
                    ))}
                  </Bloc>
                )}
              </div>
            </section>
          )}

          {/* NAEMA */}
          {hasNaema && secteurs.length > 0 && (
            <section>
              <SecTitle>Activités de l&apos;entreprise</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && actIds.includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
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

          {/* Points focaux */}
          {e.points_focaux?.length > 0 && (
            <section>
              <SecTitle>Points focaux</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {e.points_focaux.map((pf:any, i:number) => (
                  <div key={i} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                      <span style={{fontWeight:700,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</span>
                      {pf.poste && <span style={{color:"#9aa5b4"}}>{pf.poste}</span>}
                      {pf.est_principal && <span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",borderRadius:999,padding:"2px 8px"}}>Principal</span>}
                    </div>
                    {(pf.telephone||pf.mail)&&(
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                        {pf.telephone && pf.telephone.split(",").map((t:string,ti:number) => (
                          <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t.trim())}</span>
                        ))}
                        {pf.mail && pf.mail.split(",").map((m:string,mi:number) => (
                          <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
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
  );
}
