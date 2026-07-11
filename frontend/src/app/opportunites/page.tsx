"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import Badge from "@/components/shared/Badge";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Search, SlidersHorizontal, User, X } from "lucide-react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "@/lib/fuse";
import { useModalA11y } from "@/lib/useModalA11y";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";


const devSymbole = (code?:string, sym?:string) => sym || (code ? ({XOF:"FCFA",USD:"$",EUR:"€"}[code]||code) : "");
function fmtPhone(raw:string) { try { return parsePhoneNumber(raw.trim()).formatInternational(); } catch { return raw.trim(); } }

function ScrollTitle({ text, speed=25, delay=2.5 }: { text:string; speed?:number; delay?:number }) {
  const cRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  const [ov, setOv] = useState(0);

  useEffect(()=>{
    const measure = ()=>{
      const c=cRef.current; const t=tRef.current;
      if (!c||!t) return;
      setOv(Math.max(0, t.scrollWidth - c.clientWidth));
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (cRef.current) obs.observe(cRef.current);
    return ()=>obs.disconnect();
  }, [text]);

  const scrollTime = ov > 0 ? ov / speed : 0;
  const total = delay + scrollTime;
  const pausePct = ov > 0 ? (delay / total * 100).toFixed(1) : "0";
  const animName = `scroll-title-${ov}`;

  return (
    <div ref={cRef} style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:8,overflow:"hidden",whiteSpace:"nowrap" as const}}>
      {ov>0 && <style>{`@keyframes ${animName}{0%,${pausePct}%{transform:translateX(0)}100%{transform:translateX(-${ov}px)}}`}</style>}
      <span ref={tRef} style={{display:"inline-block",...(ov>0?{animation:`${animName} ${total}s linear infinite`}:{})}}>{text}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEVISE_SYM: Record<string,string> = { XOF:"FCFA", USD:"$", EUR:"€", GBP:"£", CNY:"¥" };
const devSym = (code?:string, sym?:string) => sym || (code ? DEVISE_SYM[code]||code : "");

function fmtInvest(p:any) {
  const sym = devSym(p.devise_code, p.devise_symbole);
  if (!p.investissement_est_intervalle)
    return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
  if (!p.investissement_min) return null;
  const min = Number(p.investissement_min).toLocaleString("fr-FR");
  const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
  return `${min} – ${max} ${sym}`;
}

// ── Composant filtre latéral générique ────────────────────────────────────────
function SideFilter({ label, items, selected, onToggle, color }: {
  label:string; items:{value:string;label:string}[];
  selected:string[]; onToggle:(v:string)=>void; color:string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{marginBottom:18}}>
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
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
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

// ── Filtre thématiques cascade ────────────────────────────────────────────────
function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs:any[]; secteursSel:string[]; branchesSel:string[]; activitesSel:string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches  = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  return (
    <div style={{marginBottom:18}}>
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
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Secteur</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {secteurs.map((s:any)=>{const sel=secteursSel.includes(s.nom); return (
              <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>);})}
          </div>
        </div>
        {secteursSel.length>0&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{b.nom}</span>
              </button>);})}
          </div>
        </div>}
        {branchesSel.length>0&&activites.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Activité</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {activites.map((a:any)=>{const sel=activitesSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onActivite(a.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
      </div>}
    </div>
  );
}

// ── Filtre localisation cascade ───────────────────────────────────────────────
function LocalisationFilter({ regions, regionsSel, departementsSel, arrondissementsSel, onRegion, onDepartement, onArrondissement }: {
  regions:any[]; regionsSel:string[]; departementsSel:string[]; arrondissementsSel:string[];
  onRegion:(v:string)=>void; onDepartement:(v:string)=>void; onArrondissement:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const departements    = regions.filter(r=>regionsSel.includes(r.nom)).flatMap((r:any)=>r.departements||[]);
  const arrondissements = departements.filter((d:any)=>departementsSel.includes(d.nom)).flatMap((d:any)=>d.arrondissements||[]);
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Localisation</span>
          {regionsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{regionsSel.length}</span>}
          {departementsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.1)",padding:"1px 6px",borderRadius:999}}>{departementsSel.length}</span>}
          {arrondissementsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",padding:"1px 6px",borderRadius:999}}>{arrondissementsSel.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Région</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:160,overflowY:"auto" as const}}>
            {regions.map((r:any)=>{const sel=regionsSel.includes(r.nom); return (
              <button key={r.nom} onClick={()=>onRegion(r.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{r.nom}</span>
              </button>);})}
          </div>
        </div>
        {regionsSel.length>0&&departements.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Département</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:140,overflowY:"auto" as const}}>
            {departements.map((d:any)=>{const sel=departementsSel.includes(d.nom); return (
              <button key={d.nom} onClick={()=>onDepartement(d.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{d.nom}</span>
              </button>);})}
          </div>
        </div>}
        {departementsSel.length>0&&arrondissements.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Arrondissement</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:120,overflowY:"auto" as const}}>
            {arrondissements.map((a:any)=>{const sel=arrondissementsSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onArrondissement(a.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
      </div>}
    </div>
  );
}

// ── Filtre Atouts & Potentialités ────────────────────────────────────────────
function AtotusFiltreFilter({ pots, refAvantages, selected, onToggle }: {
  pots:any[]; refAvantages:any[]; selected:string[]; onToggle:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const usedAvantageIds = new Set<number>();
  pots.forEach(p => (p.avantage_ids||[]).forEach((id:number) => usedAvantageIds.add(id)));
  const CAT_COLORS: Record<string,string> = {
    "Ressources naturelles":"#059669","Infrastructure":"#0891b2",
    "Démographie":"#7c3aed","Démographie & main d'œuvre":"#7c3aed","Atouts économiques":"#ca631f",
    "Environnement des affaires":"#d97706","Localisation stratégique":"#E35336",
  };
  const catMap = new Map<string, {libelle:string; couleur:string; atouts:string[]}>();
  refAvantages.filter(a => usedAvantageIds.has(a.id)).forEach(a => {
    const cat = a.categorie_libelle || "Autres";
    if (!catMap.has(cat)) catMap.set(cat, {libelle:cat, couleur:CAT_COLORS[cat]||"#9aa5b4", atouts:[]});
    if (!catMap.get(cat)!.atouts.includes(a.libelle)) catMap.get(cat)!.atouts.push(a.libelle);
  });
  const categories = Array.from(catMap.values());
  if (categories.length === 0) return null;
  const hasFilter = selected.length > 0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Atouts & potentialités</span>
          {hasFilter&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"rgba(5,150,105,0.12)",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {categories.map(cat=>{
            const color = cat.couleur;
            return (
              <div key={cat.libelle}>
                <p style={{fontSize:10,fontWeight:700,color,marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{cat.libelle}</p>
                <div style={{paddingLeft:8,borderLeft:`2px solid ${color}25`,display:"flex",flexDirection:"column" as const,gap:2}}>
                  {cat.atouts.map(atout=>{
                    const sel = selected.includes(atout);
                    return (
                      <button key={atout} onClick={()=>onToggle(atout)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{atout}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal vue projet (identique admin) ───────────────────────────────────────
function ProjetModal({ projet: p, secteurs, branches, activites, onClose }: {
  projet:any; secteurs:any[]; branches:any[]; activites:any[]; onClose:()=>void;
}) {
  const dlgRef = useModalA11y(onClose); // monté uniquement quand un projet est sélectionné (rendu conditionnel côté parent)
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
      <div ref={dlgRef} role="dialog" aria-modal="true" aria-label={`Détail du projet ${p.titre_projet}`} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
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
          <button onClick={onClose} aria-label="Fermer"
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
function PotentialiteModal({ pot: p, refAvantages, onClose }: { pot:any; refAvantages:any[]; onClose:()=>void }) {
  const dlgRef = useModalA11y(onClose); // monté uniquement quand une potentialité est sélectionnée (rendu conditionnel côté parent)
  // Couleur du niveau (palette du site)
  const NIVEAU_COLORS: Record<string,string> = {
    pole:"#004f91", region:"#ca631f", departement:"#188038", arrondissement:"#6A1B9A",
  };
  const nivColor = NIVEAU_COLORS[p.niveau] || "#004f91";
  const zoneNom = p.pole_nom||p.region_nom||p.departement_nom||p.arrondissement_nom||"";
  // Couleurs des catégories d'atouts : cycle sur la palette
  const PALETTE = ["#004f91","#ca631f","#188038","#6A1B9A"];
  const [fichiers,  setFichiers]  = useState<any[]>(p.fichiers||[]);
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API}/opportunites/potentialites/${p.id}`)
      .then(r=>r.json())
      .then(d=>setFichiers(d.fichiers||[]))
      .catch(()=>{});
    const safe = (url:string) => fetch(url).then(r=>r.json()).catch(()=>[]);
    Promise.all([
      safe(`${API}/entreprises/ref/secteurs`),
      safe(`${API}/entreprises/ref/branches`),
      safe(`${API}/entreprises/ref/activites`),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); });
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
      <div ref={dlgRef} role="dialog" aria-modal="true" aria-label={`Détail de la potentialité ${p.titre}`} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
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
          <button onClick={onClose} aria-label="Fermer"
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
function AvantageModal({ avg: a, onClose }: { avg:any; onClose:()=>void }) {
  const dlgRef = useModalA11y(onClose); // monté uniquement quand un avantage est sélectionné (rendu conditionnel côté parent)
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
      <div ref={dlgRef} role="dialog" aria-modal="true" aria-label={`Détail de l'avantage ${data.activite_nom||""}`} onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
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
          <button onClick={onClose} aria-label="Fermer"
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
export default function OpportunitesPage() {
  const [onglet, setOnglet] = useState<"projets"|"potentialites"|"avantages">("projets");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Données référentielles
  const [poles,       setPoles]       = useState<any[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [branches,    setBranches]    = useState<any[]>([]);
  const [activites,   setActivites]   = useState<any[]>([]);
  const [refAvantages,setRefAvantages]= useState<any[]>([]);

  // Stats hero
  const [stats, setStats] = useState({ projets:0, potentialites:0, activites:0 });

  // ── Projets ──
  const [projets,    setProjets]    = useState<any[]>([]);
  const [projLoad,   setProjLoad]   = useState(true);
  const [projSel,    setProjSel]    = useState<any>(null);
  const [projQ,      setProjQ]      = useState("");
  const [projPoles,  setProjPoles]  = useState<string[]>([]);
  const [projSects,  setProjSects]  = useState<string[]>([]);
  const [projBranches,    setProjBranches]    = useState<string[]>([]);
  const [projActivites,   setProjActivites]   = useState<string[]>([]);
  const [projRegions,     setProjRegions]     = useState<string[]>([]);
  const [projDepts,       setProjDepts]       = useState<string[]>([]);
  const [projArrs,        setProjArrs]        = useState<string[]>([]);
  // Arbre géo pour filtres
  const [regions, setRegions] = useState<any[]>([]);

  // ── Potentialités ──
  const [pots,     setPots]     = useState<any[]>([]);
  const [potsLoad, setPotsLoad] = useState(true);
  const [potSel,   setPotSel]   = useState<any>(null);
  const [potsNiveau,setPotsNiveau]=useState<string[]>([]);
  const [potsPoles, setPotsPoles]=useState<string[]>([]);
  const [potsSects,  setPotsSects]  = useState<string[]>([]);
  const [potsBranches,setPotsBranches]=useState<string[]>([]);
  const [potsActivites,setPotsActivites]=useState<string[]>([]);
  const [potsAtouts, setPotsAtouts] = useState<string[]>([]);
  const [potsQ,      setPotsQ]      = useState("");
  const [selectedNiveau, setSelectedNiveau] = useState<string|null>(null);

  // ── Avantages ──
  const [avgs,          setAvgs]          = useState<any[]>([]);
  const [avgsLoad,      setAvgsLoad]      = useState(true);
  const [avgSel,        setAvgSel]        = useState<any>(null);
  const [avgSects,      setAvgSects]      = useState<string[]>([]);
  const [avgBranches,   setAvgBranches]   = useState<string[]>([]);
  const [avgActivites,  setAvgActivites]  = useState<string[]>([]);
  const [avgTypes,      setAvgTypes]      = useState<string[]>([]);
  const [avgsQ,         setAvgsQ]         = useState("");
  const [avgsOpen,      setAvgsOpen]      = useState<Record<number,boolean>>({});
  const [refAvgTypes,   setRefAvgTypes]   = useState<any[]>([]);
  const [expandedSec, setExpandedSec] = useState<number|null>(null);
  const [expandedBranch,setExpandedBranch] = useState<number|null>(null);
  const [selectedSecAvg, setSelectedSecAvg] = useState<string|null>(null);

  useEffect(()=>{ setSelectedSecAvg(null); setSelectedNiveau(null); },[onglet]);

  useEffect(()=>{
    const safe = (p:Promise<any>) => p.catch(()=>[]);
    Promise.all([
      safe(fetch(`${API}/zones-types/poles`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/branches`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/activites`).then(r=>r.json())),
      safe(fetch(`${API}/ref-potentialites/flat`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/regions`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/departements`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/arrondissements`).then(r=>r.json())),
    ]).then(([p,s,b,a,ra,regsData,deptsData,arrsData])=>{
      setPoles(p||[]);
      setBranches(b||[]);
      setActivites(a||[]);
      const tree=(s||[]).map((sec:any)=>({...sec,
        branches:(b||[]).filter((br:any)=>br.secteur_id===sec.id).map((br:any)=>({...br,
          activites:(a||[]).filter((ac:any)=>ac.branche_id===br.id)
        }))
      }));
      setSecteurs(tree);
      setRefAvantages(ra||[]);
      fetch(`${API}/ref-avantages`).then(r=>r.json()).then(setRefAvgTypes).catch(()=>[]);
      const regTree = (regsData||[]).map((r:any)=>({
        ...r,
        departements: (deptsData||[]).filter((d:any)=>d.region_id===r.id).map((d:any)=>({
          ...d,
          arrondissements: (arrsData||[]).filter((a:any)=>a.departement_id===d.id)
        }))
      }));
      setRegions(regTree);
    });
  },[]);

  const chargerProjets = useCallback(async()=>{
    setProjLoad(true);
    try {
      const res = await fetch(`${API}/projets?per_page=100`);
      const d = await res.json();
      setProjets(d.data||[]);
      setStats(prev=>({...prev, projets:d.total||0}));
    } finally { setProjLoad(false); }
  },[]);

  const chargerPots = useCallback(async()=>{
    setPotsLoad(true);
    try {
      const res = await fetch(`${API}/opportunites/potentialites?per_page=100`);
      const d = await res.json();
      setPots(d.data||[]);
      setStats(prev=>({...prev, potentialites:d.total||0}));
    } finally { setPotsLoad(false); }
  },[]);

  const chargerAvgs = useCallback(async()=>{
    setAvgsLoad(true);
    try {
      const res = await fetch(`${API}/opportunites/avantages?per_page=100`);
      const d = await res.json();
      setAvgs(d.data||[]);
      setStats(prev=>({...prev, activites:d.total||0}));
    } finally { setAvgsLoad(false); }
  },[]);

  useEffect(()=>{ chargerProjets(); chargerPots(); chargerAvgs(); },[chargerProjets,chargerPots,chargerAvgs]);

  // ── Filtrage projets ──
  // Arbre secteurs à plat pour filtrage
  const branchesPlats = secteurs.flatMap((s:any)=>s.branches||[]);
  const activitesPlats = branchesPlats.flatMap((b:any)=>b.activites||[]);

  const projetsFiltres = projets.filter(p=>{
    if (projQ) { const q=projQ.toLowerCase(); if (!p.titre_projet?.toLowerCase().includes(q)&&!p.porteur_projet?.toLowerCase().includes(q)) return false; }
    if (projPoles.length>0&&!projPoles.includes(p.pole_nom||"")) return false;
    if (projSects.length>0) {
      const secIds = projSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.some((id:any)=>(p.secteur_ids||[]).includes(id))) return false;
    }
    if (projBranches.length>0) {
      const braIds = projBranches.map(n=>branchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.some((id:any)=>(p.branche_ids||[]).includes(id))) return false;
    }
    if (projActivites.length>0) {
      const actIds = projActivites.map(n=>activitesPlats.find((a:any)=>a.nom===n)?.id).filter(Boolean);
      if (!actIds.some((id:any)=>(p.activite_ids||[]).includes(id))) return false;
    }
    if (projRegions.length>0&&!projRegions.includes(p.region_nom||"")) return false;
    if (projDepts.length>0&&!projDepts.includes(p.departement_nom||"")) return false;
    if (projArrs.length>0&&!projArrs.includes(p.arrondissement_nom||"")) return false;
    return true;
  });

  // ── Filtrage potentialités ──
  const potBranchesPlats = secteurs.flatMap((s:any)=>s.branches||[]);
  const potActivitesPlats = potBranchesPlats.flatMap((b:any)=>b.activites||[]);

  // Enrichissement texte pour recherche
  const potsWithText = useMemo(()=>pots.map(p=>({
    ...p,
    _secteurs:  (p.secteur_ids||[]).map((id:number)=>secteurs.find((s:any)=>s.id===id)?.nom||"").filter(Boolean).join(" "),
    _branches:  (p.branche_ids||[]).map((id:number)=>potBranchesPlats.find((b:any)=>b.id===id)?.nom||"").filter(Boolean).join(" "),
    _activites: (p.activite_ids||[]).map((id:number)=>potActivitesPlats.find((a:any)=>a.id===id)?.nom||"").filter(Boolean).join(" "),
    _atouts:    (p.avantage_ids||[]).map((id:number)=>refAvantages.find((a:any)=>a.id===id)?.libelle||"").filter(Boolean).join(" "),
  })),[pots,secteurs,potBranchesPlats,potActivitesPlats,refAvantages]);

  const fuse = useMemo(()=>new Fuse(potsWithText,{
    keys:["titre","description","niveau_nom","pole_nom","_secteurs","_branches","_activites","_atouts"],
    threshold:0.35,
    ignoreLocation:true,
    minMatchCharLength:2,
  }),[potsWithText]);

  const potsBase = useMemo(()=>
    potsQ.trim() ? fuse.search(potsQ.trim()).map((r:any)=>r.item) : potsWithText
  ,[potsQ,fuse,potsWithText]);

  const potsFiltres = potsBase.filter((p:any)=>{
    if (potsNiveau.length>0&&!potsNiveau.includes(p.niveau)) return false;
    if (potsPoles.length>0&&!potsPoles.includes(p.pole_nom||"")) return false;
    if (potsSects.length>0) {
      const secIds = potsSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.some((id:any)=>(p.secteur_ids||[]).includes(id))) return false;
    }
    if (potsBranches.length>0) {
      const braIds = potsBranches.map(n=>potBranchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.some((id:any)=>(p.branche_ids||[]).includes(id))) return false;
    }
    if (potsActivites.length>0) {
      const actIds = potsActivites.map(n=>potActivitesPlats.find((a:any)=>a.nom===n)?.id).filter(Boolean);
      if (!actIds.some((id:any)=>(p.activite_ids||[]).includes(id))) return false;
    }
    if (potsAtouts.length>0) {
      // Filtrer sur les libellés d'atouts (refAvantages)
      const atoutIds = refAvantages.filter(a=>potsAtouts.includes(a.libelle)).map(a=>a.id);
      if (!atoutIds.some((id:number)=>(p.avantage_ids||[]).includes(id))) return false;
    }
    return true;
  });

  // ── Filtrage avantages ──
  const avgBranchesPlats = secteurs.flatMap((s:any)=>s.branches||[]);
  const avgActivitesPlats = avgBranchesPlats.flatMap((b:any)=>b.activites||[]);

  const avgsBase = useMemo(()=>{
    const q=avgsQ.trim().toLowerCase();
    if (!q) return avgs;
    const words=q.split(/\s+/).filter(w=>w.length>1);
    return avgs.filter(a=>{
      const hay=[a.activite_nom,a.secteur_nom,a.branche_nom,...(a.selections||[]).map((s:any)=>s.type_libelle)].filter(Boolean).join(" ").toLowerCase();
      return words.every(w=>hay.includes(w));
    });
  },[avgsQ,avgs]);

  const avgsFiltres = avgsBase.filter(a=>{
    if (avgSects.length>0) {
      const secIds = avgSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.includes(a.secteur_id)) return false;
    }
    if (avgBranches.length>0) {
      const braIds = avgBranches.map(n=>avgBranchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.includes(a.branche_id)) return false;
    }
    if (avgActivites.length>0) {
      const actIds = avgActivites.map(n=>avgActivitesPlats.find((ac:any)=>ac.nom===n)?.id).filter(Boolean);
      if (!actIds.includes(a.activite_id)) return false;
    }
    if (avgTypes.length>0) {
      const hasType = (a.selections||[]).some((s:any)=>avgTypes.includes(s.type_libelle));
      if (!hasType) return false;
    }
    return true;
  });

  // ── Helpers filtres ──
  const hasFilterProj = projQ||projPoles.length>0||projSects.length>0||projBranches.length>0||projActivites.length>0||projRegions.length>0||projDepts.length>0||projArrs.length>0;
  const hasFilterPots = !!potsQ||potsNiveau.length>0||potsPoles.length>0||potsSects.length>0||potsBranches.length>0||potsActivites.length>0||potsAtouts.length>0;
  const hasFilterAvgs = !!avgsQ||avgSects.length>0||avgBranches.length>0||avgActivites.length>0||avgTypes.length>0;
  const nbFiltres = onglet==="projets"?(projQ?1:0)+projPoles.length+projSects.length+projBranches.length+projActivites.length+projRegions.length+projDepts.length+projArrs.length : onglet==="potentialites"?(potsQ?1:0)+potsNiveau.length+potsPoles.length+potsSects.length+potsBranches.length+potsActivites.length+potsAtouts.length : (avgsQ?1:0)+avgSects.length+avgBranches.length+avgActivites.length+avgTypes.length;
  const reinit = () => { setProjQ(""); setProjPoles([]); setProjSects([]); setProjBranches([]); setProjActivites([]); setProjRegions([]); setProjDepts([]); setProjArrs([]); setPotsQ(""); setPotsNiveau([]); setPotsPoles([]); setPotsSects([]); setPotsBranches([]); setPotsActivites([]); setPotsAtouts([]); setAvgsQ(""); setAvgSects([]); setAvgBranches([]); setAvgActivites([]); setAvgTypes([]); };

  const toggle = (arr:string[], setArr:(v:string[])=>void) => (v:string) => setArr(arr.includes(v)?arr.filter((x:string)=>x!==v):[...arr,v]);

  // ── Accordéon avantages ──
  const secMap = new Map<number,{id:number;nom:string;branches:Map<number,{id:number;nom:string;items:any[]}>}>();
  avgsFiltres.forEach(a=>{
    const sid=a.secteur_id||0; const bid=a.branche_id||0;
    if (!secMap.has(sid)) secMap.set(sid,{id:sid,nom:a.secteur_nom||"Sans secteur",branches:new Map()});
    const sec=secMap.get(sid)!;
    if (!sec.branches.has(bid)) sec.branches.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
    sec.branches.get(bid)!.items.push(a);
  });
  const secList=Array.from(secMap.values());
  const SECT_COLORS=["#ca631f","#004f91","#059669","#7c3aed","#0891b2","#d97706","#E35336"];

  const NIVEAUX_LABELS: Record<string,string> = {pole:"Pôles",region:"Régions",departement:"Départements",arrondissement:"Arrondissements"};
  const potTitle = (p:any) => (p.titre||"")
    .replace(/^[Pp]otentialités?\s+(de\s+l[''’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
    .replace(/^(.)/, (_:string,c:string) => c.toUpperCase());

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
      <Navbar/>

      {/* Hero */}
      <BarreTitre titre={"Opportunités d'investissement"}>
        <BarreTitreSegment options={[{v:"projets",l:"Banque de projets"},{v:"potentialites",l:"Potentialités par zone"},{v:"avantages",l:"Avantages & incitations"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar (filtres uniquement sur la Banque de projets) */}
          {onglet==="projets"&&<aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 64px)",overflowY:"auto" as const,position:"sticky" as const,top:64,display:"flex",flexDirection:"column" as const}}>
            <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
            <div style={{padding:sidebarOpen?"20px 16px":"10px 8px",flex:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",marginBottom:sidebarOpen?18:0}}>
                {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>setSidebarOpen(o=>!o)} aria-label="Basculer les filtres"
                    style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                    <SlidersHorizontal size={14} style={{color:"#004f91"}}/>
                    {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                  </button>
                  {sidebarOpen&&nbFiltres>0&&<button onClick={reinit} title="Tout réinitialiser"
                    style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.20)",cursor:"pointer",borderRadius:999,padding:"5px",display:"flex",alignItems:"center",transition:"background 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                    <span className="material-symbols-outlined" style={{fontSize:15,color:"#dc2626",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>close</span>
                  </button>}
                </div>
              </div>
              {sidebarOpen&&<div>

                  {/* Filtres Projets */}
                  {onglet==="projets"&&<>
                    <div style={{position:"relative" as const,marginBottom:18}}>
                      <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                      <input value={projQ} onChange={e=>setProjQ(e.target.value)} placeholder="Rechercher…"
                        style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                      {projQ&&<button onClick={()=>setProjQ("")} aria-label="Effacer la recherche" style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                    </div>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <SideFilter label="Pôle territoire" color="#004f91"
                      items={poles.map((p:any)=>({value:p.pole_territoire,label:p.pole_territoire}))}
                      selected={projPoles} onToggle={toggle(projPoles,setProjPoles)}/>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <ThematiquesCascadeFilter
                      secteurs={secteurs}
                      secteursSel={projSects} branchesSel={projBranches} activitesSel={projActivites}
                      onSecteur={v=>{setProjSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjBranches([]); setProjActivites([]);}}
                      onBranche={v=>{setProjBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjActivites([]);}}
                      onActivite={v=>setProjActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <LocalisationFilter
                      regions={regions}
                      regionsSel={projRegions} departementsSel={projDepts} arrondissementsSel={projArrs}
                      onRegion={v=>{setProjRegions(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjDepts([]); setProjArrs([]);}}
                      onDepartement={v=>{setProjDepts(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjArrs([]);}}
                      onArrondissement={v=>setProjArrs(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                  </>}

              </div>}
            </div>
            {sidebarOpen&&<div onMouseDown={startResize} style={{position:"absolute" as const,top:0,right:0,width:4,height:"100%",cursor:"col-resize",zIndex:10}} onMouseEnter={e=>(e.currentTarget.style.background="rgba(0,79,145,0.5)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}/>}
          </aside>}

          {/* Contenu principal */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>

            {/* ── Onglet Projets ── */}
            {onglet==="projets"&&(
              <>
                {projLoad ? (
                  <SkeletonCards n={6} cols={2} height={200}/>
                ) : projetsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun projet trouvé</p>
                    <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                    {projetsFiltres.map(p=>(
                      <div key={p.id} onClick={()=>setProjSel(p)}
                        style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                        onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                        <div style={{height:3,background:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
                        <div style={{padding:"14px 16px 14px",flex:1}}>
                          {/* Pôle territoire */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                            {p.pole_nom ? (
                              <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p.pole_nom}</span>
                            ) : <span/>}
                          </div>

                          {/* Titre */}
                          <div style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.titre_projet}</div>

                          {/* Infos libellées */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                            <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px",minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Région</p>
                              <p style={{fontSize:12,fontWeight:600,color:p.region_nom?"#1a1a2e":"#9aa5b4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.region_nom||"—"}</p>
                            </div>
                            <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px",minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Département</p>
                              <p style={{fontSize:12,fontWeight:600,color:p.departement_nom?"#1a1a2e":"#9aa5b4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.departement_nom||"—"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action */}
                        <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,transition:"background 0.15s"}}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            Voir les détails →
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Onglet Potentialités ── */}
            {onglet==="potentialites"&&(
              <>
                {potsLoad ? (
                  <SkeletonCards n={4} cols={4} height={190}/>
                ) : selectedNiveau===null ? (
                  /* ── Picker 4 cards ── */
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                    {([
                      {key:"pole",           label:"Pôles territoires", unit:"Pôles",           color:"#004f91"},
                      {key:"region",         label:"Régions",           unit:"Régions",         color:"#ca631f"},
                      {key:"departement",    label:"Départements",      unit:"Départements",    color:"#188038"},
                      {key:"arrondissement", label:"Arrondissements",   unit:"Arrondissements", color:"#6A1B9A"},
                    ] as const).map(n=>{
                      const count=pots.filter((p:any)=>p.niveau===n.key).length;
                      const total = n.key==="pole" ? poles.length
                        : n.key==="region" ? regions.length
                        : n.key==="departement" ? regions.reduce((s:number,r:any)=>s+(r.departements?.length||0),0)
                        : regions.reduce((s:number,r:any)=>s+(r.departements||[]).reduce((s2:number,d:any)=>s2+(d.arrondissements?.length||0),0),0);
                      return (
                        <div key={n.key} onClick={()=>count>0&&setSelectedNiveau(n.key)}
                          style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",opacity:count>0?1:0.6}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${n.color}40`;}
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                            });
                          }}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                          <div style={{height:3,background:`linear-gradient(90deg,${n.color}CC 0%,${n.color} 50%,${n.color}99 100%)`,flexShrink:0}}/>
                          <div style={{padding:"14px 16px 14px",flex:1}}>
                            {/* Niveau */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:n.color,background:`${n.color}12`,padding:"3px 10px",borderRadius:999,overflow:"hidden",whiteSpace:"nowrap" as const,maxWidth:"100%"}}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:n.color,["--pc" as any]:`${n.color}66`,animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                {n.label}
                              </span>
                            </div>

                            {/* Compteurs libellés */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                                <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{n.unit}</p>
                                <p style={{fontSize:14,fontWeight:800,color:total>0?"#1a1a2e":"#9aa5b4"}}>{total||"—"}</p>
                              </div>
                              <div style={{background:"rgba(24,128,56,0.04)",border:"1px solid rgba(24,128,56,0.12)",borderRadius:10,padding:"8px 11px"}}>
                                <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#188038",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Fiches définies</span></p>
                                <p style={{fontSize:14,fontWeight:800,color:count>0?"#1a1a2e":"#9aa5b4"}}>{total>0?`${count}/${total}`:count}</p>
                              </div>
                            </div>
                          </div>

                          {/* Action */}
                          <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:n.color,fontWeight:600,opacity:count>0?1:0.45,transition:"background 0.15s"}}
                              onMouseEnter={ev=>{if(count>0)ev.currentTarget.style.background=`${n.color}0D`;}}
                              onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                              Voir les détails →
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Fiches du niveau sélectionné ── */
                  <>
                    <button onClick={()=>setSelectedNiveau(null)}
                      style={{display:"flex",alignItems:"center",gap:6,marginBottom:24,background:"none",border:"none",cursor:"pointer",color:"#4a5568",fontSize:13,fontWeight:600,padding:0}}>
                      <ArrowLeft size={14}/> Retour aux zones
                    </button>
                    {(()=>{
                      const items = pots.filter((p:any)=>p.niveau===selectedNiveau);
                      if (items.length===0) return <div style={{textAlign:"center",padding:"80px 0",color:"#9aa5b4"}}><p style={{fontSize:13}}>Aucune fiche</p></div>;
                      // Rattachements géographiques via le référentiel déjà chargé
                      const regionDuDept = (nom:string) => regions.find((r:any)=>(r.departements||[]).some((d:any)=>d.nom===nom))?.nom || null;
                      const deptDeArr = (nom:string) => {
                        for (const r of regions) for (const d of (r.departements||[])) if ((d.arrondissements||[]).some((a:any)=>a.nom===nom)) return d.nom;
                        return null;
                      };
                      const poleDeRegion = (nom:string) => poles.find((x:any)=>(x.localisation||"").includes(nom))?.pole_territoire || null;
                      return (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                          {items.map((p:any)=>{
                            const nbActs = (p.activite_ids||[]).length;
                            // Premier bloc contextuel selon le niveau
                            const info1 = selectedNiveau==="pole"
                              ? { label:(poles.find((x:any)=>x.id===p.pole_id)?.localisation||"").includes(",")?"Régions":"Région", value: poles.find((x:any)=>x.id===p.pole_id)?.localisation||null }
                              : selectedNiveau==="region"
                              ? { label:"Pôle", value: poleDeRegion(p.region_nom||"") }
                              : selectedNiveau==="departement"
                              ? { label:"Région", value: p.region_nom||regionDuDept(p.departement_nom||"") }
                              : { label:"Département", value: p.departement_nom||deptDeArr(p.arrondissement_nom||"") };
                            return (
                              <div key={p.id} onClick={()=>setPotSel(p)}
                                style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",minWidth:0}}
                                onMouseEnter={ev=>{
                                  ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";
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

                                <div style={{height:3,background:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
                                <div style={{padding:"14px 16px 14px",flex:1}}>
                                  {/* Titre (défile au survol si trop long) */}
                                  <div data-marquee style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35,overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                    <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                                  </div>

                                  {/* Infos libellées */}
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                                    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px",minWidth:0}}>
                                      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{info1.label}</p>
                                      <p data-marquee style={{fontSize:12,fontWeight:600,color:info1.value?"#1a1a2e":"#9aa5b4",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                        <span style={{display:"inline-block"}}>{info1.value||"—"}</span>
                                      </p>
                                    </div>
                                    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                                      <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Activités porteuses</span></p>
                                      <p style={{fontSize:14,fontWeight:800,color:nbActs>0?"#1a1a2e":"#9aa5b4"}}>{nbActs||"—"}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Action */}
                                <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                                  <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,transition:"background 0.15s"}}
                                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                                    Voir les détails →
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}

            {/* ── Onglet Avantages ── */}
            {onglet==="avantages"&&(
              <>
                {avgsLoad ? (
                  <SkeletonCards n={3} cols={3} height={190}/>
                ) : selectedSecAvg===null ? (
                  /* ── Vue secteurs : 3 cards ── */
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                    {([
                      {key:"primaire",   label:"Secteur Primaire",   color:"#004f91"},
                      {key:"secondaire", label:"Secteur Secondaire", color:"#004f91"},
                      {key:"tertiaire",  label:"Secteur Tertiaire",  color:"#004f91"},
                    ] as const).map(s=>{
                      const items = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(s.key));
                      const count = items.length;
                      const sec = secteurs.find((r:any)=>r.nom.toLowerCase().includes(s.key));
                      const secBranches = sec ? branches.filter((b:any)=>b.secteur_id===sec.id) : [];
                      const branchIds = new Set(secBranches.map((b:any)=>b.id));
                      const actCount = activites.filter((a:any)=>branchIds.has(a.branche_id)).length;
                      return (
                        <div key={s.key} onClick={()=>count>0&&setSelectedSecAvg(s.key)}
                          style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",opacity:count>0?1:0.6}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${s.color}40`;}
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                            });
                          }}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                          <div style={{height:3,background:`linear-gradient(90deg,${s.color}CC 0%,${s.color} 50%,${s.color}99 100%)`,flexShrink:0}}/>
                          <div style={{padding:"14px 16px 14px",flex:1}}>
                            {/* Secteur */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:s.color,background:`${s.color}12`,padding:"3px 10px",borderRadius:999,overflow:"hidden",whiteSpace:"nowrap" as const,maxWidth:"100%"}}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:s.color,["--pc" as any]:`${s.color}66`,animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                {s.label}
                              </span>
                            </div>

                            {/* Compteurs libellés */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                                <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Activités</p>
                                <p style={{fontSize:14,fontWeight:800,color:actCount>0?"#1a1a2e":"#9aa5b4"}}>{actCount||"—"}</p>
                              </div>
                              <div style={{background:"rgba(24,128,56,0.04)",border:"1px solid rgba(24,128,56,0.12)",borderRadius:10,padding:"8px 11px"}}>
                                <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#188038",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Avantages définis</span></p>
                                <p style={{fontSize:14,fontWeight:800,color:count>0?"#1a1a2e":"#9aa5b4"}}>{actCount>0?`${count}/${actCount}`:count}</p>
                              </div>
                            </div>
                          </div>

                          {/* Action */}
                          <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:s.color,fontWeight:600,opacity:count>0?1:0.45,transition:"background 0.15s"}}
                              onMouseEnter={ev=>{if(count>0)ev.currentTarget.style.background=`${s.color}0D`;}}
                              onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                              Voir les détails →
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Vue du secteur sélectionné : une card par branche ── */
                  <>
                    <button onClick={()=>setSelectedSecAvg(null)}
                      style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:24,background:"#fff",border:"1px solid #E4E1DE",borderRadius:999,cursor:"pointer",color:"#4a5568",fontSize:12.5,fontWeight:600,padding:"8px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",transition:"border-color 0.15s, color 0.15s, box-shadow 0.15s",fontFamily:"var(--font-google-sans)"}}
                      onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgba(0,79,145,0.35)";ev.currentTarget.style.color="#004f91";ev.currentTarget.style.boxShadow="0 4px 12px rgba(0,30,60,0.08)";const ic=ev.currentTarget.querySelector("svg") as SVGElement|null;if(ic)ic.style.transform="translateX(-3px)";}}
                      onMouseLeave={ev=>{ev.currentTarget.style.borderColor="#E4E1DE";ev.currentTarget.style.color="#4a5568";ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";const ic=ev.currentTarget.querySelector("svg") as SVGElement|null;if(ic)ic.style.transform="none";}}>
                      <ArrowLeft size={14} style={{transition:"transform 0.18s"}}/> Retour aux secteurs
                    </button>
                    {(()=>{
                      const filtered=avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(selectedSecAvg!));
                      const secNom = filtered[0]?.secteur_nom || "";
                      const braMap = new Map<number,{id:number;nom:string;items:any[]}>();
                      filtered.forEach((a:any)=>{
                        const bid=a.branche_id||0;
                        if(!braMap.has(bid)) braMap.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
                        braMap.get(bid)!.items.push(a);
                      });
                      const bras=Array.from(braMap.values());
                      return (
                        <div>
                          {/* En-tête du secteur */}
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:11,fontWeight:800,color:"#1a1a2e",background:"#fff",border:"1px solid #ECEAE7",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",padding:"5px 14px",borderRadius:999,whiteSpace:"nowrap" as const}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:"#004f91",["--pc" as any]:"rgba(0,79,145,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                              {secNom}
                            </span>
                            <span style={{flex:1,height:1,background:"#ECEAE7"}}/>
                          </div>

                          {/* Une card par branche */}
                          <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>
                            {bras.map(bra=>(
                              <div key={bra.id} style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.03)"}}>
                                {/* En-tête de branche */}
                                <div style={{display:"flex",alignItems:"center",gap:9,padding:"12px 18px",borderBottom:"1px solid #F2F0EF",background:"#FCFBFA",minWidth:0}}>
                                  <span style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",["--pc" as any]:"rgba(202,99,31,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                  <span style={{fontSize:13.5,fontWeight:700,color:"#1a1a2e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</span>
                                </div>
                                {/* Activités */}
                                <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSecAvg==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                                  {bra.items.map((a:any)=>(
                                    <div key={a.id} onClick={()=>setAvgSel(a)}
                                      style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                      onMouseEnter={ev=>{
                                        ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";ev.currentTarget.style.background="#fff";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="0 8px 20px rgba(0,30,60,0.08)";
                                        // Nom trop long : glisse pour révéler la fin
                                        const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                        const span = box?.firstElementChild as HTMLElement | null;
                                        if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                      }}
                                      onMouseLeave={ev=>{
                                        ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                        const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                        if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                      }}>
                                      <span style={{width:6,height:6,borderRadius:"50%",background:"#188038",["--pc" as any]:"rgba(24,128,56,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                      <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#1a1a2e",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                        <span style={{display:"inline-block"}}>{a.activite_nom}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </div>
        </div>

      {projSel&&<ProjetModal projet={projSel} secteurs={secteurs} branches={branches} activites={activites} onClose={()=>setProjSel(null)}/>}
      {potSel&&<PotentialiteModal pot={potSel} refAvantages={refAvantages} onClose={()=>setPotSel(null)}/>}
      {avgSel&&<AvantageModal avg={avgSel} onClose={()=>setAvgSel(null)}/>}
    </main>
  );
}
