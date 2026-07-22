"use client";

// Modal partagé — page Opportunités et recherche globale (⌘K).

import { ChevronDown, ChevronUp, FileText, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function PotentialiteVueModal({ pot: p, refAvantages, onClose }: { pot:any; refAvantages:any[]; onClose:()=>void }) {
  // Couleur du niveau (palette du site)
  const NIVEAU_COLORS: Record<string,string> = {
    pole:"#004f91", region:"#ca631f", departement:"#188038", arrondissement:"#6A1B9A",
  };
  const nivColor = NIVEAU_COLORS[p.niveau] || "#004f91";
  const zoneNom = p.pole_nom||p.region_nom||p.departement_nom||p.arrondissement_nom||"";
  // Couleurs des catégories d'atouts : cycle sur la palette
  const PALETTE = COMP_PALETTE;
  const [fichiers,  setFichiers]  = useState<any[]>(p.fichiers||[]);
  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  useEffect(()=>{
    fetch(`${API}/opportunites/potentialites/${p.id}`)
      .then(r=>r.json())
      .then(d=>setFichiers(d.fichiers||[]))
      .catch(()=>{});
  }, [p.id]);

  const avantagesSelected = refAvantages.filter(a=>(p.avantage_ids||[]).includes(a.id));
  const catMap: Record<string,string[]> = {};
  avantagesSelected.forEach((a:any) => {
    const cat = a.categorie_libelle || "Autres";
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(a.libelle);
  });

  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"var(--ombre-2)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{p.titre}</h2>
            {zoneNom&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:nivColor,background:`${nivColor}12`,padding:"3px 10px",borderRadius:999}}>{zoneNom}</span>
              </div>
            )}
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

          {/* Activités porteuses — cascade NAEMA */}
          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <section>
              <SecTitle>Activités porteuses</SecTitle>
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

          {/* Atouts et potentialités par catégorie */}
          {Object.keys(catMap).length>0&&(
            <section>
              <SecTitle>Atouts et potentialités</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {Object.entries(catMap).map(([cat, items], ci)=>{
                  const color = PALETTE[ci % PALETTE.length];
                  return (
                    <div key={cat} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{fontSize:10.5,fontWeight:700,color,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{cat}</div>
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                        {items.map((item,i)=>(
                          <span key={i} style={{fontSize:11.5,fontWeight:600,color,background:`${color}0D`,padding:"4px 11px",borderRadius:999}}>{item}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Description */}
          {p.description&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:p.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Documents */}
          {fichiers.length>0&&(
            <section>
              <SecTitle>{fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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

// ── Modal détail avantage ─────────────────────────────────────────────────────
