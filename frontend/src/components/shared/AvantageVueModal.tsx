"use client";

// Modal partagé — page Opportunités et recherche globale (⌘K).

import { ChevronDown, ChevronUp, FileText, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function AvantageVueModal({ avg: a, onClose }: { avg:any; onClose:()=>void }) {
  const [data, setData] = useState<any>(a);

  useEffect(()=>{
    fetch(`${API}/opportunites/avantages/${a.id}`)
      .then(r=>r.json()).then(setData).catch(()=>{});
  },[a.id]);

  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0,flex:1}}>
            <h2 title={data.activite_nom}
              onMouseEnter={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;const d=sp.scrollWidth-ev.currentTarget.clientWidth;if(d>0){sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`;sp.style.transform=`translateX(-${d}px)`;}}}
              onMouseLeave={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;sp.style.transition="transform 0.4s ease";sp.style.transform="translateX(0)";}}
              style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap" as const,margin:0}}>
              <span style={{display:"inline-block"}}>{data.activite_nom}</span>
            </h2>
            <div style={{display:"flex",gap:6,marginTop:8,minWidth:0}}>
              {data.secteur_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap" as const,flexShrink:0}}>{data.secteur_nom}</span>}
              {data.branche_nom&&(
                <span title={data.branche_nom}
                  onMouseEnter={ev=>{const box=ev.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;const sp=box?.firstElementChild as HTMLElement|null;if(!box||!sp)return;const d=sp.scrollWidth-box.clientWidth;if(d>0){sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`;sp.style.transform=`translateX(-${d}px)`;}}}
                  onMouseLeave={ev=>{const sp=(ev.currentTarget.querySelector("[data-marquee]") as HTMLElement|null)?.firstElementChild as HTMLElement|null;if(!sp)return;sp.style.transition="transform 0.4s ease";sp.style.transform="translateX(0)";}}
                  style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",padding:"3px 10px",borderRadius:999,minWidth:0}}>
                  <span data-marquee style={{overflow:"hidden",whiteSpace:"nowrap" as const,minWidth:0}}>
                    <span style={{display:"inline-block"}}>{data.branche_nom}</span>
                  </span>
                </span>
              )}
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

          {/* Avantages sélectionnés */}
          {(data.selections||[]).length>0&&(
            <section>
              <SecTitle>Avantages &amp; incitations</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {(data.selections||[]).map((s:any)=>(
                  <div key={s.id} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:s.commentaire?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"#188038"}}>{s.type_libelle}</span>
                    </div>
                    {s.commentaire&&<p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,marginLeft:14,whiteSpace:"pre-wrap" as const}}>{s.commentaire}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {data.avantages&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:data.avantages}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Documents */}
          {(data.fichiers||[]).length>0&&(
            <section>
              <SecTitle>{(data.fichiers||[]).length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {(data.fichiers||[]).map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/avantages/${data.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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

// ── Page principale ───────────────────────────────────────────────────────────
