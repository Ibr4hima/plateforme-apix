"use client";

// Modal vue événement — partagé entre la page Événements et la recherche
// globale (⌘K), qui l'ouvre depuis n'importe quelle page.

import { FileText, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
import { fmtDate } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";

export const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

// Pilules teintées des rôles APIX (partagées avec la page Événements)
export const ROLE_PILL: Record<string,{c:string;bg:string}> = {
  "Organisateur":    { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Co-organisateur": { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Participant":     { c:"#004f91", bg:"rgba(0,79,145,0.07)"   },
  "Partenaire":      { c:"#6A1B9A", bg:"rgba(106,27,154,0.07)" },
  "Sponsor":         { c:"#ca631f", bg:"rgba(202,99,31,0.08)"  },
  "Invité":          { c:"#6b7280", bg:"#F2F0EF"               },
};
export const ROLES_APIX: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };

export function ordinal(n: number) { return n === 1 ? "1ère édition" : `${n}ème édition`; }

// ── Modal vue événement ───────────────────────────────────────────────────────
export default function EvenementVueModal({ ev:e, onClose }: { ev:any; onClose:()=>void }) {
  if (!e) return null;
  const dateStr = e.date_debut
    ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
    : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
  const statutV = computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
  const STV: any = {
    a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
    en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
    termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
  };
  const stV = statutV ? STV[statutV] : null;
  const roleV = e.role_apix ? (ROLE_PILL[e.role_apix]||ROLE_PILL["Invité"]) : null;
  const Pill = ({c,bg,children}:{c:string;bg:string;children:React.ReactNode}) => (
    <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:c,background:bg,padding:"3px 10px",borderRadius:999}}>{children}</span>
  );
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
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"var(--ombre-2)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{e.nom_event}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {stV&&<Pill c={stV.c} bg={stV.bg}>{stV.label}</Pill>}
              {e.edition!=null&&<Pill c="#004f91" bg="rgba(0,79,145,0.07)">{ordinal(e.edition)}</Pill>}
              {roleV&&<Pill c={roleV.c} bg={roleV.bg}>{ROLES_APIX[e.role_apix]||e.role_apix}</Pill>}
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
              {dateStr&&(
                <Bloc label="Date">
                  <p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{dateStr}</p>
                  {e.duree_jours&&<p style={{fontSize:10.5,color:"#9aa5b4",marginTop:2}}>{e.duree_jours} jour{e.duree_jours>1?"s":""}</p>}
                </Bloc>
              )}
              {(e.ville||e.pays_hote_nom)&&(
                <Bloc label="Lieu"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{[e.ville,e.pays_hote_nom].filter(Boolean).join(", ")}</p></Bloc>
              )}
              {e.organisateur&&(
                <Bloc label="Organisateur"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{e.organisateur}</p></Bloc>
              )}
              {e.est_recurrent&&(
                <Bloc label="Récurrence"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>Tous les {e.frequence_valeur} {e.frequence_type==="mois"?"mois":`an${e.frequence_valeur>1?"s":""}`}</p></Bloc>
              )}
            </div>
          </section>

          {/* Description */}
          {e.description&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:e.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Thématiques */}
          {e.thematiques_tree&&Object.keys(e.thematiques_tree).length>0&&(
            <section>
              <SecTitle>Thématiques</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {Object.entries(e.thematiques_tree).map(([sec,branches]:any)=>(
                  <div key={sec}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:Object.keys(branches).length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec}</span>
                    </div>
                    {Object.entries(branches).map(([bra,acts]:any)=>(
                      <div key={bra} style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:acts.length?4:0}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra}</span>
                        </div>
                        {acts.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>{acts.map((act:string)=>(
                          <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                            <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                          </div>
                        ))}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Participants */}
          {(e.pays_invites_noms||e.entreprises_invitees)&&(
            <section>
              <SecTitle>Participants</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {e.pays_invites_noms&&(
                  <div>
                    <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:5}}>Pays invités</p>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                      {e.pays_invites_noms.split(",").map((p:string)=>p.trim()).filter(Boolean).map((p:string)=>(
                        <span key={p} style={{fontSize:11,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999,fontWeight:600}}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {e.entreprises_invitees&&(
                  <div>
                    <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:5}}>Entreprises invitées</p>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                      {e.entreprises_invitees.split(",").map((ent:string)=>ent.trim()).filter(Boolean).map((ent:string)=>(
                        <span key={ent} style={{fontSize:11,color:"#ca631f",background:"rgba(202,99,31,0.07)",padding:"3px 10px",borderRadius:999,fontWeight:600}}>{ent}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Documents */}
          {(e.fichiers||[]).length>0&&(
            <section>
              <SecTitle>{e.fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {e.fichiers.map((fi:any)=>(
                  <a key={fi.id} href={`${API_BASE}/evenements/${e.id}/fichiers/${fi.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{fi.titre||"Document"}</span>
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
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
