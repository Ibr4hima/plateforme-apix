"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { CalendarDays, ChevronDown, ChevronUp, FileText, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
// Pilules teintées des rôles APIX sur les cards (palette du site)
const ROLE_PILL: Record<string,{c:string;bg:string}> = {
  "Organisateur":    { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Co-organisateur": { c:"#188038", bg:"rgba(24,128,56,0.08)"  },
  "Participant":     { c:"#004f91", bg:"rgba(0,79,145,0.07)"   },
  "Partenaire":      { c:"#6A1B9A", bg:"rgba(106,27,154,0.07)" },
  "Sponsor":         { c:"#ca631f", bg:"rgba(202,99,31,0.08)"  },
  "Invité":          { c:"#6b7280", bg:"#F2F0EF"               },
};
const ROLES_APIX: Record<string,string> = { "Organisateur":"Organisateur","Co-organisateur":"Co-organisateur","Participant":"Participant","Partenaire":"Partenaire","Sponsor":"Sponsor","Invité":"Invité" };
const ROLE_VARIANT: Record<string, BadgeVariant> = {
  "Organisateur":    "green",
  "Co-organisateur": "yellow",
  "Participant":     "orange",
  "Partenaire":      "teal",
  "Sponsor":         "lavender",
  "Invité":          "gray",
};

function computeStatutEvenement(e: any): "a_venir" | "en_cours" | "termine" | null {
  if (!e.date_debut) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const debut = new Date(e.date_debut + "T00:00:00");
  const fin   = e.date_fin ? new Date(e.date_fin + "T00:00:00") : debut;
  if (debut > today) return "a_venir";
  if (fin   < today) return "termine";
  return "en_cours";
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}
function ordinal(n: number) { return n === 1 ? "1ère édition" : `${n}ème édition`; }

const STATUT_OPTS = [
  { value:"",         label:"Tous",     bg:"#F2F0EF", text:"#4a5568" },
  { value:"a_venir",  label:"À venir",  bg:"rgba(0,79,145,0.08)", text:"#004f91" },
  { value:"en_cours", label:"En cours", bg:"rgba(24,128,56,0.08)", text:"#188038" },
  { value:"termine",  label:"Terminés", bg:"#f3f4f6", text:"#6b7280" },
];

function SideFilter({ label, items, selected, onToggle, color }: {
  label:string; items:{value:string;label:string}[];
  selected:string[]; onToggle:(v:string)=>void; color:string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{marginBottom:20}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{label}</span>
          {selected.length>0&&<span style={{fontSize:10,fontWeight:700,color,background:color+"18",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
          {items.map(item=>{
            const sel=selected.includes(item.value);
            return (
              <button key={item.value} onClick={()=>onToggle(item.value)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"6px 8px",borderRadius:8,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Filtre thématiques — secteur multi-select ─────────────────────────────────
function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs: any[];
  secteursSel: string[]; branchesSel: string[]; activitesSel: string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);

  return (
    <div>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
          {secteursSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{secteursSel.length}</span>}
          {branchesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.1)",padding:"1px 6px",borderRadius:999}}>{branchesSel.length}</span>}
          {activitesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",padding:"1px 6px",borderRadius:999}}>{activitesSel.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Secteur</p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
              {secteurs.map((s:any)=>{
                const sel=secteursSel.includes(s.nom);
                return (
                  <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                    <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          </div>
                    <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {secteursSel.length>0&&branches.length>0&&(
            <div style={{paddingLeft:12,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Branche</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                {branches.map((b:any)=>{
                  const sel=branchesSel.includes(b.nom);
                  return (
                    <button key={b.nom} onClick={()=>onBranche(b.nom)}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                      onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                      <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                              </div>
                      <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{b.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {branchesSel.length>0&&activites.length>0&&(
            <div style={{paddingLeft:24,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Activité</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                {activites.map((a:any)=>{
                  const sel=activitesSel.includes(a.nom);
                  return (
                    <button key={a.nom} onClick={()=>onActivite(a.nom)}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                      onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                      <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                              </div>
                      <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{a.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal vue événement ───────────────────────────────────────────────────────
function EvenementVue({ ev:e, onClose }: { ev:any; onClose:()=>void }) {
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
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
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
// ── Frise chronologique des événements ────────────────────────────────────────
function FriseChronologique({ evenements, onOpen, prochainId }: { evenements:any[]; onOpen:(e:any)=>void; prochainId:number|null }) {
  const ST: any = {
    a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
    en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
    termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
  };
  const dateDe = (e:any): Date|null => {
    if (e.date_debut) return new Date(e.date_debut+"T00:00:00");
    if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois||1)-1, e.prochain_jour||1);
    return null;
  };
  const avecDate = evenements.map(e=>({ e, d:dateDe(e) })).filter(x=>x.d) as {e:any;d:Date}[];
  const sansDate = evenements.filter(e=>!dateDe(e));
  avecDate.sort((a,b)=>b.d.getTime()-a.d.getTime());
  const parAnnee: {annee:number; items:{e:any;d:Date}[]}[] = [];
  avecDate.forEach(x=>{ const y=x.d.getFullYear(); let g=parAnnee.find(p=>p.annee===y); if(!g){g={annee:y,items:[]};parAnnee.push(g);} g.items.push(x); });

  const hoverIn = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; ev.currentTarget.style.transform="translateY(-2px)"; ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d/40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
    });
  };
  const hoverOut = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; ev.currentTarget.style.transform="none"; ev.currentTarget.style.borderColor="#ECEAE7";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
    });
  };

  const Carte = ({ e }: { e:any }) => {
    const statut = computeStatutEvenement(e) ?? ((e.prochain_annee||e.prochain_mois) ? "a_venir" : null);
    const st = statut ? ST[statut] : null;
    const estProchain = prochainId!=null && e.id===prochainId;
    const estEnCours = statut==="en_cours";
    const estPasse = statut==="termine";
    const accent = estProchain
      ? { grad:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", label:"Prochain événement", b:"rgba(0,79,145,0.45)", b2:"rgba(0,79,145,0.6)", sh:"0 4px 18px rgba(0,79,145,0.15)" }
      : estEnCours
      ? { grad:"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)", label:"Événement en cours", b:"rgba(24,128,56,0.45)", b2:"rgba(24,128,56,0.6)", sh:"0 4px 18px rgba(24,128,56,0.15)" }
      : null;
    const dateStr = e.date_debut
      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
      : e.prochain_mois||e.prochain_annee ? `${e.prochain_jour?e.prochain_jour+" ":""}${e.prochain_mois?MOIS[(e.prochain_mois||1)-1]+" ":""}${e.prochain_annee||""}`.trim() : null;
    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
    // Rôle APIX : bleu par défaut, vert quand l'événement est en cours, gris pour les passés
    const roleC = estPasse ? { c:"#6b7280", bg:"#F2F0EF" } : estEnCours ? { c:"#188038", bg:"rgba(24,128,56,0.08)" } : { c:"#004f91", bg:"rgba(0,79,145,0.07)" };
    const txtC  = estPasse ? "#4a5568" : "#1a1a2e";
    return (
      <div onClick={()=>onOpen(e)}
        onMouseEnter={ev=>{ hoverIn(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b2; } else if(estPasse){ ev.currentTarget.style.borderColor="#D8D4D0"; } }}
        onMouseLeave={ev=>{ hoverOut(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b; ev.currentTarget.style.boxShadow=accent.sh; } else if(estPasse){ ev.currentTarget.style.borderColor="#ECEAE7"; } }}
        style={{background:estPasse?"#FAFAF9":"#fff",border:accent?`1.5px solid ${accent.b}`:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:accent?accent.sh:"0 1px 3px rgba(0,0,0,0.03)",overflow:"hidden",minWidth:0}}>
        {accent ? (
          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.grad,padding:"6px 16px"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#fff",animation:"pulseDot 1.6s ease-out infinite",flexShrink:0}}/>
            <span style={{fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
          </div>
        ) : (
          <div style={{height:3,background:estPasse?"linear-gradient(90deg,#DDD9D5 0%,#C5BFBB 50%,#DDD9D5 100%)":"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
        )}
        <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:9,minWidth:0}}>
          {dateStr
            ? <span style={{fontSize:10.5,fontWeight:800,color:estPasse?"#6b7280":st?st.c:"#004f91",letterSpacing:"0.07em",textTransform:"uppercase" as const,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{dateStr}</span>
            : <span/>}
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            {st&&!estEnCours&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:st.c,background:st.bg,padding:"3px 10px",borderRadius:999}}>{st.label}</span>}
            {e.role_apix&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:roleC.c,background:roleC.bg,padding:"3px 10px",borderRadius:999}}>{ROLES_APIX[e.role_apix]||e.role_apix}</span>}
          </div>
        </div>
        <div data-marquee style={{fontWeight:700,fontSize:13.5,color:txtC,lineHeight:1.35,overflow:"hidden",whiteSpace:"nowrap" as const}}>
          <span style={{display:"inline-block"}}>{e.nom_event}</span>
        </div>
        {e.edition!=null&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:2}}>{ordinal(e.edition)}</div>}
        {lieu&&(
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:7,minWidth:0}}>
            <MapPin size={11} style={{color:"#9aa5b4",flexShrink:0}}/>
            <span data-marquee style={{fontSize:11.5,color:"#9aa5b4",overflow:"hidden",whiteSpace:"nowrap" as const,minWidth:0}}>
              <span style={{display:"inline-block"}}>{lieu}</span>
            </span>
          </div>
        )}
        </div>
      </div>
    );
  };

  let idx = 0;
  return (
    <div style={{maxWidth:1020,margin:"0 auto"}}>
      <div style={{position:"relative" as const}}>
        {/* Ligne centrale */}
        <div style={{position:"absolute" as const,top:8,bottom:8,left:"50%",width:2,transform:"translateX(-1px)",background:"linear-gradient(180deg,rgba(0,79,145,0.30) 0%,rgba(0,79,145,0.12) 60%,rgba(0,79,145,0.04) 100%)",borderRadius:2}}/>

        {parAnnee.map(({annee,items})=>(
          <div key={annee}>
            {/* Jalon année */}
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0 20px",position:"relative" as const,zIndex:1}}>
              <span style={{background:"#004f91",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:"0.06em",padding:"7px 22px",borderRadius:999,boxShadow:"0 4px 14px rgba(0,79,145,0.30)"}}>{annee}</span>
            </div>
            {items.map(({e})=>{
              const statut = computeStatutEvenement(e) ?? ((e.prochain_annee||e.prochain_mois) ? "a_venir" : null);
              const st = statut ? ST[statut] : null;
              const gauche = idx++ % 2 === 0;
              return (
                <div key={e.id} style={{display:"grid",gridTemplateColumns:"1fr 64px 1fr",alignItems:"center",marginBottom:16}}>
                  <div style={{minWidth:0}}>{gauche&&<Carte e={e}/>}</div>
                  {/* Puce sur la ligne + connecteur */}
                  <div style={{position:"relative" as const,alignSelf:"stretch",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{position:"absolute" as const,top:"50%",height:2,background:"rgba(0,79,145,0.15)",width:24,...(gauche?{right:"50%",marginRight:6}:{left:"50%",marginLeft:6})}}/>
                    {prochainId!=null&&e.id===prochainId
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"#004f91",border:"3px solid #F2F0EF",animation:"pulseHalo 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : statut==="en_cours"
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"#188038",border:"3px solid #F2F0EF",animation:"pulseHaloVert 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : <div style={{width:13,height:13,borderRadius:"50%",background:st?st.c:"#004f91",border:"3px solid #F2F0EF",boxShadow:`0 0 0 1px ${st?st.c:"#004f91"}44`,position:"relative" as const,zIndex:1}}/>}
                  </div>
                  <div style={{minWidth:0}}>{!gauche&&<Carte e={e}/>}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Événements récurrents sans date fixée */}
      {sansDate.length>0&&(
        <div style={{marginTop:36}}>
          <p style={{fontSize:10.5,fontWeight:700,color:"#9aa5b4",letterSpacing:"0.14em",textTransform:"uppercase" as const,textAlign:"center" as const,marginBottom:14}}>Date à confirmer</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {sansDate.map(e=><Carte key={e.id} e={e}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvenementsPage() {
  const gate = useAuthGate();
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  const [paysHotes,   setPaysHotes]   = useState<{nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
  const [stats,       setStats]       = useState<any>({a_venir:0,en_cours:0,total:0});

  const [recherche,    setRecherche]    = useState("");
  const [vueMode,      setVueMode]      = useState<"liste"|"frise">("liste");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  useEffect(()=>{
    const safe = (p:Promise<any>, fb:any) => p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/evenements/pays-hotes`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()),  []),
      safe(fetch(`${API_BASE}/evenements/stats`).then(r=>r.json()),      {}),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()), []),
    ]).then(([hotes,refPays,statsData,secsData,brasData,actsData])=>{
      const enrichis=(hotes||[]).map((nom:string)=>{
        const ref=(refPays||[]).find((p:any)=>p.nom_fr===nom);
        return {nom,code_iso2:ref?.code_iso2||""};
      });
      setPaysHotes(enrichis);
      setStats(statsData||{});
      const tree = (secsData||[]).map((s:any)=>({
        ...s,
        branches: (brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({
          ...b,
          activites: (actsData||[]).filter((a:any)=>a.branche_id===b.id)
        }))
      }));
      setSecteurs(tree);
    });
  },[]);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/evenements?per_page=100`);
      const data = await res.json();
      setTous(data.data||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const evenements = tous.filter(e=>{
    if (recherche) {
      const q = recherche.toLowerCase();
      if (!e.nom_event?.toLowerCase().includes(q) && !e.organisateur?.toLowerCase().includes(q) && !e.ville?.toLowerCase().includes(q) && !e.pays_hote_nom?.toLowerCase().includes(q)) return false;
    }
    if (statutFiltre) {
      const today = new Date(); today.setHours(0,0,0,0);
      if (e.date_debut) {
        const debut = new Date(e.date_debut+"T00:00:00");
        const fin   = e.date_fin ? new Date(e.date_fin+"T00:00:00") : debut;
        if (statutFiltre==="a_venir"  && debut <= today) return false;
        if (statutFiltre==="en_cours" && (debut > today || fin < today)) return false;
        if (statutFiltre==="termine"  && fin >= today) return false;
      }
    }
    if (paysFiltres.length>0 && !paysFiltres.includes(e.pays_hote_nom||"")) return false;
    if (secteursSel.length>0 && !secteursSel.some((s:string)=>(e.secteur_noms||[]).includes(s))) return false;
    if (branchesSel.length>0 && !branchesSel.some((b:string)=>(e.branche_noms||[]).includes(b))) return false;
    if (activitesSel.length>0 && !activitesSel.some((a:string)=>(e.activite_noms||[]).includes(a))) return false;
    return true;
  });

  // Prochain événement à venir (date la plus proche dans le futur)
  const prochainId: number|null = (()=>{
    const today = new Date(); today.setHours(0,0,0,0);
    let best: any = null, bestD: Date|null = null;
    evenements.forEach(e=>{
      const d = e.date_debut ? new Date(e.date_debut+"T00:00:00")
        : e.prochain_annee ? new Date(e.prochain_annee,(e.prochain_mois||1)-1,e.prochain_jour||1) : null;
      if (d && d>today && (!bestD || d<bestD)) { bestD=d; best=e; }
    });
    return best?.id ?? null;
  })();

  const hasFilter = !!recherche||!!statutFiltre||paysFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit = ()=>{ setRecherche(""); setStatutFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const nbFiltres = (recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  const togglePays     = (v:string) => setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur  = (v:string) => { setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v:string) => { setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setActivitesSel([]); };
  const toggleActivite = (v:string) => setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes pulseHalo{0%{box-shadow:0 0 0 0 rgba(0,79,145,0.45)}70%{box-shadow:0 0 0 9px rgba(0,79,145,0)}100%{box-shadow:0 0 0 0 rgba(0,79,145,0)}}
@keyframes pulseHaloVert{0%{box-shadow:0 0 0 0 rgba(24,128,56,0.45)}70%{box-shadow:0 0 0 9px rgba(24,128,56,0)}100%{box-shadow:0 0 0 0 rgba(24,128,56,0)}}`}</style>
      <Navbar/>

      {/* Barre de titre */}
      <BarreTitre titre="Événements"
        droite={(()=>{
          const prochain = prochainId!=null ? tous.find(e=>e.id===prochainId) : null;
          if (!prochain) return null;
          return <BarreTitreBadge label="Prochain événement" detail={`${prochain.nom_event}${prochain.date_debut?` · ${fmtDate(prochain.date_debut)}`:""}`} onClick={()=>gate(()=>setSelec(prochain))}/>;
        })()}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste"},{v:"frise",l:"Frise chronologique"}]} value={vueMode} onChange={setVueMode}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar bande */}
          <aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 64px)",overflowY:"auto" as const,position:"sticky" as const,top:64,display:"flex",flexDirection:"column" as const}}>
            <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
            {sidebarOpen&&<div onMouseDown={startResize} style={{position:"absolute" as const,right:0,top:0,bottom:0,width:4,cursor:"col-resize",zIndex:10,background:"transparent",transition:"background 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
            <div style={{padding:sidebarOpen?"14px 16px 10px":"12px 8px",borderBottom:"1px solid #F2F0EF",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",flexShrink:0}}>
              {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#004f91"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
                {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser"
                  style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.20)",cursor:"pointer",borderRadius:999,padding:"5px",display:"flex",alignItems:"center",transition:"background 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                  <span className="material-symbols-outlined" style={{fontSize:15,color:"#dc2626",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>close</span>
                </button>}
              </div>
            </div>
            {sidebarOpen&&<div style={{padding:"16px",overflowY:"auto" as const,flex:1}}>
              <>
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Rechercher…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"#004f91":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {STATUT_OPTS.map(b=>(
                      <button key={b.value} onClick={()=>setStatutFiltre(b.value)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"#4a5568"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Pays hôte" color="#004f91" selected={paysFiltres} onToggle={togglePays}
                  items={paysHotes.map(p=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
              </>
            </div>}
          </aside>

          {/* Grille */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} cols={2} height={220}/>
            ):evenements.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <CalendarDays size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun événement trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#ca631f",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ):vueMode==="frise"?(
              <FriseChronologique evenements={evenements} onOpen={(e:any)=>gate(()=>setSelec(e))} prochainId={prochainId}/>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
                  {evenements.map(e=>{
                    const dateStr = e.date_debut
                      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
                      : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
                    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
                    const statut = computeStatutEvenement(e);
                    // Récurrents sans date fixe : la prochaine occurrence est à venir
                    const statutAff = statut ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
                    const ST: any = {
                      a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
                      en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
                      termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
                    };
                    const st = statutAff ? ST[statutAff] : null;
                    const estProchain = prochainId!=null && e.id===prochainId;
                    const estEnCours = statutAff==="en_cours";
                    const estPasse = statutAff==="termine";
                    const accent = estProchain
                      ? { c:"#004f91", grad:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", label:"Prochain événement", bg:"rgba(0,79,145,0.07)" }
                      : estEnCours
                      ? { c:"#188038", grad:"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)", label:"Événement en cours", bg:"rgba(24,128,56,0.08)" }
                      : null;
                    const blocC  = estPasse ? "#6b7280" : estEnCours ? "#188038" : "#004f91";
                    const blocBg = estPasse ? "#F5F4F3" : estEnCours ? "rgba(24,128,56,0.05)" : "rgba(0,79,145,0.04)";
                    const blocBd = estPasse ? "#E8E5E3" : estEnCours ? "rgba(24,128,56,0.12)" : "rgba(0,79,145,0.10)";
                    // Rôle APIX : bleu par défaut, vert quand l'événement est en cours, gris pour les passés
                    const roleC  = estPasse ? { c:"#6b7280", bg:"#F2F0EF" } : estEnCours ? { c:"#188038", bg:"rgba(24,128,56,0.08)" } : { c:"#004f91", bg:"rgba(0,79,145,0.07)" };
                    const txtC   = estPasse ? "#4a5568" : "#1a1a2e";
                    return (
                      <div key={e.id} onClick={()=>gate(()=>setSelec(e))}
                        style={{background:estPasse?"#FAFAF9":"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                        onMouseEnter={ev=>{
                          ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent?`${accent.c}40`:estPasse?"#D8D4D0":"rgba(0,79,145,0.25)";
                          // Contenus trop longs : glissent pour révéler la fin
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                          });
                        }}
                        onMouseLeave={ev=>{
                          ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                          });
                        }}>

                        <div style={{height:3,background:accent?accent.grad:estPasse?"linear-gradient(90deg,#DDD9D5 0%,#C5BFBB 50%,#DDD9D5 100%)":"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
                        <div style={{padding:"14px 16px 14px",flex:1}}>
                          {/* Statut + rôle de l'APIX */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                            {accent ? (
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:accent.c,background:accent.bg,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap" as const}}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:accent.c,["--pc" as any]:accent.c+"66",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                {accent.label}
                              </span>
                            ) : st ? (
                              <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:st.c,background:st.bg,padding:"3px 10px",borderRadius:999}}>{st.label}</span>
                            ) : <span/>}
                            {e.role_apix ? (
                              <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:roleC.c,background:roleC.bg,padding:"3px 10px",borderRadius:999}}>
                                {ROLES_APIX[e.role_apix]||e.role_apix}
                              </span>
                            ) : <span/>}
                          </div>

                          {/* Titre + édition */}
                          <div style={{fontWeight:700,fontSize:13.5,color:txtC,lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.nom_event}</div>
                          {e.edition!=null&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:2}}>{ordinal(e.edition)}</div>}

                          {/* Infos libellées */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                            <div style={{background:blocBg,border:`1px solid ${blocBd}`,borderRadius:10,padding:"8px 11px",minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:blocC,textTransform:"uppercase" as const,marginBottom:3}}>Date</p>
                              <p data-marquee style={{fontSize:12,fontWeight:600,color:dateStr?txtC:"#9aa5b4",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                <span style={{display:"inline-block"}}>{dateStr||"—"}</span>
                              </p>
                            </div>
                            <div style={{background:blocBg,border:`1px solid ${blocBd}`,borderRadius:10,padding:"8px 11px",minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:blocC,textTransform:"uppercase" as const,marginBottom:3}}>Lieu</p>
                              <p data-marquee style={{fontSize:12,fontWeight:600,color:lieu?txtC:"#9aa5b4",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                <span style={{display:"inline-block"}}>{lieu||"—"}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action */}
                        <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:blocC,fontWeight:600,transition:"background 0.15s"}}
                            onMouseEnter={ev=>ev.currentTarget.style.background=estEnCours?"rgba(24,128,56,0.05)":estPasse?"#F2F0EF":"rgba(0,79,145,0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            Voir les détails →
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
      </div>

      <EvenementVue ev={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
