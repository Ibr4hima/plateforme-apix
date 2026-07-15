"use client";

import { FileText, X } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export function fmtDate(d: string) {
  if (!d) return "—";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

export function computeStatut(a: any): "en_vigueur"|"expire"|"signe"|null {
  const today = new Date().toISOString().split("T")[0];
  if (a.date_expiration && a.date_expiration < today) return "expire";
  if (a.date_entree_vigueur && a.date_entree_vigueur <= today) return "en_vigueur";
  if (a.date_signature && a.date_signature <= today) return "signe";
  return null;
}

// ── Modal vue accord (partagé : page Accords, Fiche Pays…) ────────────────────
export default function AccordVueModal({ accord:a, onClose, zIndex = 400 }: { accord:any; onClose:()=>void; zIndex?:number }) {
  const [fichiers,  setFichiers]  = useState<any[]>([]);
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);
  const [allPays,   setAllPays]   = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r=>r.json()).then(setFichiers).catch(()=>{});
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).then(setAllPays).catch(()=>{});
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,ac])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(ac||[]); }).catch(()=>{});
  },[a.id]);

  const statut = computeStatut(a);
  const ST_VUE: any = {
    en_vigueur: { label:"En vigueur", c:"#188038", bg:"rgba(24,128,56,0.08)" },
    signe:      { label:"Signé non en vigueur", c:"#004f91", bg:"rgba(0,79,145,0.07)" },
    expire:     { label:"Expiré", c:"#ca631f", bg:"rgba(202,99,31,0.08)" },
  };
  const stV = statut ? ST_VUE[statut] : null;
  const secIds:number[] = a.secteur_ids  || [];
  const braIds:number[] = a.branche_ids  || [];
  const actIds:number[] = a.activite_ids || [];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;
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
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{a.titre}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {stV&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:stV.c,background:stV.bg,padding:"3px 10px",borderRadius:999}}>{stV.label}</span>}
              {a.reference&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{a.reference}</span>}
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

          {/* Dates */}
          <section>
            <SecTitle>Dates</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Bloc label="Signature"><p style={{fontSize:12.5,fontWeight:600,color:a.date_signature?"#1a1a2e":"#9aa5b4"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p></Bloc>
              {a.date_entree_vigueur&&<Bloc label="Entrée en vigueur"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></Bloc>}
              <Bloc label="Expiration"><p style={{fontSize:12.5,fontWeight:600,color:a.date_expiration?"#1a1a2e":"#9aa5b4"}}>{a.date_expiration?fmtDate(a.date_expiration):"Non définie"}</p></Bloc>
            </div>
          </section>

          {/* Résumé */}
          {a.commentaires&&(
            <section>
              <SecTitle>Résumé</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:a.commentaires}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Parties signataires — inutile pour un TBI : déjà dans le titre */}
          {a.type_accord!=="tbi"&&(a.parties_pays_ids?.length>0||a.parties_signataires)&&(
            <section>
              <SecTitle>Parties signataires</SecTitle>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                {(a.parties_pays_ids||[]).map((id:number)=>{
                  const p=allPays.find((r:any)=>r.id===id);
                  return <span key={id} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p?.nom_fr||`#${id}`}</span>;
                })}
                {a.parties_signataires&&a.parties_signataires.split(", ").filter(Boolean).map((p:string)=>(
                  <span key={p} style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.07)",padding:"3px 10px",borderRadius:999}}>{p}</span>
                ))}
              </div>
            </section>
          )}

          {/* Thématiques */}
          {hasNaema&&(
            <section>
              <SecTitle>Thématiques</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number)=>{
                  const secNom=secteurs.find(s=>s.id===secId)?.nom;
                  if (!secNom) return null;
                  const brasDuSec=branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{secNom}</span>
                      </div>
                      {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                        {brasDuSec.map((bra:any)=>{
                          const actsDeBra=activites.filter(ac=>ac.branche_id===bra.id&&actIds.includes(ac.id));
                          return (
                            <div key={bra.id}>
                              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                              </div>
                              {actsDeBra.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                {actsDeBra.map((act:any)=>(
                                  <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                    <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
                                  </div>
                                ))}
                              </div>}
                            </div>
                          );
                        })}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Documents */}
          {fichiers.length>0&&(
            <section>
              <SecTitle>{fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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
