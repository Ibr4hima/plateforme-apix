"use client";

import Navbar from "@/components/layout/Navbar";
import { ChevronDown, ChevronUp, FileText, Loader2, Search, SlidersHorizontal, User, X } from "lucide-react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "@/lib/fuse";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const devSymbole = (code?:string, sym?:string) => sym || (code ? ({XOF:"FCFA",USD:"$",EUR:"€"}[code]||code) : "");
function fmtPhone(raw:string) { try { return parsePhoneNumber(raw.trim()).formatInternational(); } catch { return raw.trim(); } }

function ScrollTitle({ text }: { text: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [tx, setTx] = useState(0);
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const overflow = inner.offsetWidth - outer.clientWidth;
    setTx(overflow > 4 ? overflow : 0);
  }, [text]);
  return (
    <div ref={outerRef} style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:8,overflow:"hidden",whiteSpace:"nowrap" as const}}>
      <span ref={innerRef} style={{display:"inline-block",...(tx>0?{animation:"aptitle-scroll 6s ease-in-out infinite","--aptitle-tx":`-${tx}px`} as React.CSSProperties:{})}}>
        {text}
      </span>
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
          {selected.length>0&&<span style={{width:6,height:6,borderRadius:"50%",background:color,display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:selected.length>0?color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{label}</span>
          {selected.length>0&&<span style={{fontSize:10,fontWeight:700,color,background:color+"18",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
          {items.map(item=>{
            const sel=selected.includes(item.value);
            return (
              <button key={item.value} onClick={()=>onToggle(item.value)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?color+"12":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                onMouseLeave={e=>{e.currentTarget.style.background=sel?color+"12":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400}}>{item.label}</span>
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
  const hasFilter = secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#E35336",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#E35336":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#E35336",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Secteur</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {secteurs.map((s:any)=>{const sel=secteursSel.includes(s.nom); return (
              <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(227,83,54,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(227,83,54,0.1)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#E35336":"#C5BFBB"}`,background:sel?"#E35336":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#E35336":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>);})}
          </div>
        </div>
        {secteursSel.length>0&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#366FE3":"#C5BFBB"}`,background:sel?"#366FE3":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
              </button>);})}
          </div>
        </div>}
        {branchesSel.length>0&&activites.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(24,128,56,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Activité</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {activites.map((a:any)=>{const sel=activitesSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onActivite(a.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{secteursSel.slice().forEach(onSecteur);branchesSel.slice().forEach(onBranche);activitesSel.slice().forEach(onActivite);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer thématiques
        </button>}
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
  const hasFilter = regionsSel.length>0||departementsSel.length>0||arrondissementsSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#366FE3":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Localisation</span>
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Région</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:160,overflowY:"auto" as const}}>
            {regions.map((r:any)=>{const sel=regionsSel.includes(r.nom); return (
              <button key={r.nom} onClick={()=>onRegion(r.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#366FE3":"#C5BFBB"}`,background:sel?"#366FE3":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{r.nom}</span>
              </button>);})}
          </div>
        </div>
        {regionsSel.length>0&&departements.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(54,111,227,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Département</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:140,overflowY:"auto" as const}}>
            {departements.map((d:any)=>{const sel=departementsSel.includes(d.nom); return (
              <button key={d.nom} onClick={()=>onDepartement(d.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{d.nom}</span>
              </button>);})}
          </div>
        </div>}
        {departementsSel.length>0&&arrondissements.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(124,58,237,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#7c3aed",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Arrondissement</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:120,overflowY:"auto" as const}}>
            {arrondissements.map((a:any)=>{const sel=arrondissementsSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onArrondissement(a.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(124,58,237,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(124,58,237,0.08)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#7c3aed":"#C5BFBB"}`,background:sel?"#7c3aed":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#7c3aed":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{regionsSel.slice().forEach(onRegion);departementsSel.slice().forEach(onDepartement);arrondissementsSel.slice().forEach(onArrondissement);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer localisation
        </button>}
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
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#059669",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#059669":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Atouts & potentialités</span>
          {hasFilter&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"rgba(5,150,105,0.12)",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
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
                        style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?`${color}12`:"transparent",textAlign:"left" as const}}
                        onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=sel?`${color}12`:"transparent";}}>
                        <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{fontSize:12,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400}}>{atout}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {hasFilter&&<button onClick={()=>selected.slice().forEach(onToggle)}
            style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
            <X size={10}/> Effacer atouts
          </button>}
        </div>
      )}
    </div>
  );
}

// ── Modal vue projet (identique admin) ───────────────────────────────────────
function ProjetModal({ projet: p, secteurs, branches, activites, onClose }: {
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
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{p.titre_projet}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {p.pole_nom   && <span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{p.pole_nom}</span>}
                {p.region_nom && <span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>Région de {p.region_nom}</span>}
                {p.departement_nom && <span style={{fontSize:11,fontWeight:700,color:"#0891b2",background:"rgba(8,145,178,0.08)",border:"1px solid rgba(8,145,178,0.2)",padding:"2px 9px",borderRadius:999}}>Département de {p.departement_nom}</span>}
                {p.arrondissement_nom && <span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",padding:"2px 9px",borderRadius:999}}>Arrondissement de {p.arrondissement_nom}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {p.description && (
            <div style={{background:"rgba(227,83,54,0.04)",border:"1px solid rgba(227,83,54,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
              <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
              <div data-rte dangerouslySetInnerHTML={{__html:p.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {invest && (
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Investissement</LBL>
                <p style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>{invest}</p>
              </div>
            )}
            {p.date_debut && (
              <div style={{background:"rgba(5,150,105,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date de début</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_debut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            )}
          </div>

          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <div style={{marginBottom:16}}>
              <LBL>Thématique(s) du projet</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && (p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
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

          {p.porteurs?.length>0 && (
            <div style={{marginBottom:16}}>
              <LBL>Porteur du projet</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.porteurs.map((por:any,pi:number)=>{
                  const tels=(por.telephones||[]).filter(Boolean);
                  const mails=(por.mails||[]).filter(Boolean);
                  return (
                    <div key={pi} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px"}}>
                      {por.nom && <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:tels.length||mails.length?6:0}}>{por.nom}</p>}
                      {tels.length>0 && (
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:mails.length?5:0}}>
                          {tels.map((t:string,ti:number)=>(
                            <span key={ti} style={{fontSize:11,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>{fmtPhone(t)}</span>
                          ))}
                        </div>
                      )}
                      {mails.length>0 && (
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                          {mails.map((m:string,mi:number)=>(
                            <span key={mi} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.08)",border:"1px solid rgba(24,128,56,0.2)",padding:"2px 9px",borderRadius:999}}>{m.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {p.points_focaux?.length>0 && (
            <div style={{marginBottom:16}}>
              <LBL>Points focaux</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.points_focaux.map((pf:any,fi:number)=>{
                  const tels=(pf.telephones||[]).filter(Boolean);
                  const mails=(pf.mails||[]).filter(Boolean);
                  return (
                    <div key={fi} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px"}}>
                      <div>
                        <p style={{fontWeight:600,fontSize:13,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</p>
                        {tels.length>0 && (
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:6}}>
                            {tels.map((t:string,ti:number)=>(
                              <span key={ti} style={{fontSize:11,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>{fmtPhone(t)}</span>
                            ))}
                          </div>
                        )}
                        {mails.length>0 && (
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:5}}>
                            {mails.map((m:string,mi:number)=>(
                              <span key={mi} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.08)",border:"1px solid rgba(24,128,56,0.2)",padding:"2px 9px",borderRadius:999}}>{m.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {p.fichiers?.length>0 && (
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {p.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/projets/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(227,83,54,0.06)",border:"1px solid rgba(227,83,54,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#E35336",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
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

// ── Modal détail potentialité ─────────────────────────────────────────────────
function PotentialiteModal({ pot: p, refAvantages, onClose }: { pot:any; refAvantages:any[]; onClose:()=>void }) {
  const CAT_COLORS: Record<string,string> = {
    "Ressources naturelles":"#059669","Infrastructure":"#0891b2",
    "Démographie":"#7c3aed","Atouts économiques":"#ca631f",
    "Environnement des affaires":"#d97706","Localisation stratégique":"#E35336",
  };
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

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{p.titre}</h2>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Activités porteuses — cascade NAEMA */}
          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <div style={{marginBottom:16}}>
              <LBL>Activités porteuses</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && (p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
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

          {/* Atouts et potentialités par catégorie */}
          {Object.keys(catMap).length>0&&(
            <div style={{marginBottom:18}}>
              <LBL>Atouts et potentialités</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {Object.entries(catMap).map(([cat, items])=>{
                  const color = CAT_COLORS[cat]||"#9aa5b4";
                  return (
                    <div key={cat} style={{background:`${color}06`,border:`1px solid ${color}20`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:11,fontWeight:700,color,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{cat}</div>
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                        {items.map((item,i)=>(
                          <span key={i} style={{fontSize:12,color:"#1a1a2e",background:"#fff",border:"1px solid #E8E5E3",padding:"4px 10px",borderRadius:999}}>{item}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {p.description&&(
            <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
              <LBL>Description</LBL>
              <div data-rte dangerouslySetInnerHTML={{__html:p.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
            </div>
          )}

          {/* Documents */}
          {fichiers.length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(5,150,105,0.06)",border:"1px solid rgba(5,150,105,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#059669",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
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

// ── Modal détail avantage ─────────────────────────────────────────────────────
function AvantageModal({ avg: a, onClose }: { avg:any; onClose:()=>void }) {
  const [data, setData] = useState<any>(a);

  useEffect(()=>{
    fetch(`${API}/opportunites/avantages/${a.id}`)
      .then(r=>r.json()).then(setData).catch(()=>{});
  },[a.id]);

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{data.activite_nom}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {data.secteur_nom&&<span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",background:"#F2F0EF",border:"1px solid #E8E5E3",padding:"2px 9px",borderRadius:999}}>{data.secteur_nom}</span>}
                {data.branche_nom&&<span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",background:"#F2F0EF",border:"1px solid #E8E5E3",padding:"2px 9px",borderRadius:999}}>{data.branche_nom}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Avantages sélectionnés avec commentaires */}
          {(data.selections||[]).length>0&&(
            <div style={{marginBottom:18}}>
              <LBL>Avantages & incitations</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {(data.selections||[]).map((s:any)=>(
                  <div key={s.id} style={{background:"rgba(124,58,237,0.04)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:s.commentaire?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#7c3aed",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"#7c3aed"}}>{s.type_libelle}</span>
                    </div>
                    {s.commentaire&&<p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,marginLeft:14,whiteSpace:"pre-wrap" as const}}>{s.commentaire}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {data.avantages&&(
            <div style={{background:"#F8F7F6",border:"1px solid #E8E5E3",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
              <LBL>Description</LBL>
              <div data-rte dangerouslySetInnerHTML={{__html:data.avantages}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
            </div>
          )}

          {/* Documents */}
          {(data.fichiers||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {(data.fichiers||[]).map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/avantages/${data.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#7c3aed",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
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

// ── Page principale ───────────────────────────────────────────────────────────
export default function OpportunitesPage() {
  const [onglet, setOnglet] = useState<"projets"|"potentialites"|"avantages">("projets");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      isResizing.current = false;
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
  const [groupsOpen, setGroupsOpen] = useState<Record<string,boolean>>({pole:true,region:true,departement:true,arrondissement:true});

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

  const potsFiltres = potsBase.filter(p=>{
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
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Hero */}
      <section style={{padding:"100px 40px 40px",background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute" as const,bottom:"-20%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)"}}/>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>Opportunités d&apos;investissement</h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,maxWidth:560,lineHeight:1.7,marginBottom:24}}>Projets structurants, potentialités territoriales et avantages fiscaux pour investir au Sénégal.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
            {stats.projets>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.projets} projet{stats.projets>1?"s":""}</span>}
          </div>
        </div>
      </section>

      {/* Onglets sticky */}
      <div style={{background:"#fff",borderBottom:"1px solid #E8E5E3",position:"sticky" as const,top:0,zIndex:10}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 40px",display:"flex",gap:0}}>
          {([
            {key:"projets",       label:"Banque de projets",      color:"#ca631f"},
            {key:"potentialites", label:"Potentialités par zone",  color:"#ca631f"},
            {key:"avantages",     label:"Avantages & incitations", color:"#ca631f"},
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setOnglet(t.key)}
              style={{padding:"16px 22px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-google-sans)",fontSize:13,fontWeight:600,color:onglet===t.key?t.color:"#9aa5b4",borderBottom:`2px solid ${onglet===t.key?t.color:"transparent"}`,transition:"all 0.15s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar */}
          <aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 72px)",overflowY:"auto" as const,position:"sticky" as const,top:72,display:"flex",flexDirection:"column" as const}}>
            <div style={{padding:sidebarOpen?"20px 16px":"10px 8px",flex:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",marginBottom:sidebarOpen?18:0}}>
                {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
                <button onClick={()=>setSidebarOpen(o=>!o)}
                  style={{background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#ca631f"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
              </div>
              {sidebarOpen&&<div>
                  {nbFiltres>0&&<button onClick={reinit} style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>
                    <X size={12}/> Effacer les filtres
                  </button>}

                  {/* Filtres Projets */}
                  {onglet==="projets"&&<>
                    <div style={{position:"relative" as const,marginBottom:18}}>
                      <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                      <input value={projQ} onChange={e=>setProjQ(e.target.value)} placeholder="Rechercher…"
                        style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                      {projQ&&<button onClick={()=>setProjQ("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                    </div>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <SideFilter label="Pôle territoire" color="#ca631f"
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

                  {/* Filtres Potentialités */}
                  {onglet==="potentialites"&&<>
                    <div style={{position:"relative" as const,marginBottom:18}}>
                      <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                      <input value={potsQ} onChange={e=>setPotsQ(e.target.value)} placeholder="Rechercher…"
                        style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                      {potsQ&&<button onClick={()=>setPotsQ("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                    </div>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <SideFilter label="Zone" color="#059669"
                      items={[{value:"pole",label:"Pôles"},{value:"region",label:"Régions"},{value:"departement",label:"Départements"},{value:"arrondissement",label:"Arrondissements"}]}
                      selected={potsNiveau} onToggle={toggle(potsNiveau,setPotsNiveau)}/>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <SideFilter label="Pôle territoire" color="#ca631f"
                      items={poles.map((p:any)=>({value:p.pole_territoire,label:p.pole_territoire}))}
                      selected={potsPoles} onToggle={toggle(potsPoles,setPotsPoles)}/>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <ThematiquesCascadeFilter
                      secteurs={secteurs}
                      secteursSel={potsSects} branchesSel={potsBranches} activitesSel={potsActivites}
                      onSecteur={v=>{setPotsSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setPotsBranches([]); setPotsActivites([]);}}
                      onBranche={v=>{setPotsBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setPotsActivites([]);}}
                      onActivite={v=>setPotsActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <AtotusFiltreFilter
                      pots={pots}
                      refAvantages={refAvantages}
                      selected={potsAtouts}
                      onToggle={v=>setPotsAtouts(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                  </>}

                  {/* Filtres Avantages */}
                  {onglet==="avantages"&&<>
                    <div style={{position:"relative" as const,marginBottom:18}}>
                      <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                      <input value={avgsQ} onChange={e=>setAvgsQ(e.target.value)} placeholder="Rechercher…"
                        style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                      {avgsQ&&<button onClick={()=>setAvgsQ("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                    </div>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <ThematiquesCascadeFilter
                      secteurs={secteurs}
                      secteursSel={avgSects} branchesSel={avgBranches} activitesSel={avgActivites}
                      onSecteur={v=>{setAvgSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setAvgBranches([]); setAvgActivites([]);}}
                      onBranche={v=>{setAvgBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setAvgActivites([]);}}
                      onActivite={v=>setAvgActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                  </>}
              </div>}
            </div>
            {sidebarOpen&&<div onMouseDown={startResize} style={{position:"absolute" as const,top:0,right:0,width:4,height:"100%",cursor:"col-resize",zIndex:10}} onMouseEnter={e=>(e.currentTarget.style.background="rgba(202,99,31,0.3)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}/>}
          </aside>

          {/* Contenu principal */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>

            {/* ── Onglet Projets ── */}
            {onglet==="projets"&&(
              <>
                {projLoad ? (
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}><Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span>Chargement…</span></div>
                ) : projetsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun projet trouvé</p>
                    <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {projetsFiltres.map(p=>(
                      <div key={p.id} onClick={()=>setProjSel(p)}
                        style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:"3px solid #ca631f",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",cursor:"pointer",transition:"all 0.15s",position:"relative" as const}}
                        onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";ev.currentTarget.style.borderColor="#ca631f";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor="#ca631f";}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.titre_projet}</div>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                          {p.pole_nom&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                            <span style={{color:"#4a5568"}}>{p.pole_nom}</span>
                          </div>}
                          {p.region_nom&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:"#B7410E",flexShrink:0}}/>
                            <span style={{color:"#4a5568"}}>Région de {p.region_nom}</span>
                          </div>}
                        </div>
                        <div style={{display:"flex",borderTop:"1px solid #F2F0EF",paddingTop:10}}>
                          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(202,99,31,0.08)",borderRadius:7,padding:"6px 0",fontSize:11,color:"#ca631f",fontWeight:600}}>
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
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}><Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span>Chargement…</span></div>
                ) : potsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucune fiche trouvée</p>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column" as const,gap:24}}>
                    {([
                      {key:"pole",label:"Pôles territoires",color:"#ca631f"},
                      {key:"region",label:"Régions",color:"#225BCC"},
                      {key:"departement",label:"Départements",color:"#575799"},
                      {key:"arrondissement",label:"Arrondissements",color:"#0D9488"},
                    ] as const).map(groupe=>{
                      const items=potsFiltres.filter((p:any)=>p.niveau===groupe.key);
                      if (items.length===0) return null;
                      const isOpen=groupsOpen[groupe.key]!==false;
                      const showGrid=isOpen||hasFilterPots;
                      return (
                        <div key={groupe.key}>
                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:showGrid?12:0}}>
                            <div style={{width:3,height:18,borderRadius:2,background:groupe.color,flexShrink:0}}/>
                            <span style={{fontSize:12,fontWeight:700,color:groupe.color,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{groupe.label}</span>
                            <button onClick={()=>setGroupsOpen(prev=>({...prev,[groupe.key]:!prev[groupe.key]}))}
                              style={{display:"flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:6,border:`1px solid ${groupe.color}35`,background:`${groupe.color}0f`,cursor:"pointer",flexShrink:0}}>
                              {isOpen?<ChevronDown size={12} style={{color:groupe.color}}/>:<ChevronUp size={12} style={{color:groupe.color}}/>}
                            </button>
                          </div>
                          {showGrid&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                            {items.map((p:any)=>{
                              const selCount=(p.avantage_ids||[]).length;
                              return (
                                <div key={p.id} onClick={()=>setPotSel(p)}
                                  style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:`3px solid ${groupe.color}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${groupe.color}18`;ev.currentTarget.style.borderColor=groupe.color;ev.currentTarget.style.borderLeftColor=groupe.color;}}
                                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor=groupe.color;}}>
                                  <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:6}}>{potTitle(p)}</div>
                                  {(()=>{
                                    const rNom = groupe.key==="departement"
                                      ? regions.find((r:any)=>(r.departements||[]).some((d:any)=>d.id===p.departement_id))?.nom
                                      : groupe.key==="arrondissement"
                                      ? regions.find((r:any)=>(r.departements||[]).some((d:any)=>(d.arrondissements||[]).some((a:any)=>a.id===p.arrondissement_id)))?.nom
                                      : null;
                                    const dNom = groupe.key==="arrondissement"
                                      ? regions.flatMap((r:any)=>r.departements||[]).find((d:any)=>(d.arrondissements||[]).some((a:any)=>a.id===p.arrondissement_id))?.nom
                                      : null;
                                    if (!rNom&&!dNom) return null;
                                    return (
                                      <div style={{display:"flex",flexDirection:"column" as const,gap:4,marginBottom:8}}>
                                        {rNom&&<span style={{fontSize:10,fontWeight:600,
                                          color: groupe.key==="departement" ? "#575799" : "#0D9488",
                                          background: groupe.key==="departement" ? "rgba(87,87,153,0.07)" : "rgba(13,148,136,0.07)",
                                          border: groupe.key==="departement" ? "1px solid rgba(87,87,153,0.22)" : "1px solid rgba(13,148,136,0.2)",
                                          padding:"1px 8px",borderRadius:999,alignSelf:"flex-start" as const}}>Région de {rNom}</span>}
                                        {dNom&&<span style={{fontSize:10,fontWeight:600,
                                          color:"#0a6b64",background:"rgba(13,148,136,0.13)",
                                          border:"1px solid rgba(13,148,136,0.32)",
                                          padding:"1px 8px",borderRadius:999,alignSelf:"flex-start" as const,marginLeft:10}}>Dép. de {dNom}</span>}
                                      </div>
                                    );
                                  })()}
                                  {selCount>0&&<div style={{fontSize:11,color:"#9aa5b4",marginBottom:8}}>{selCount} atout{selCount>1?"s":""} référencé{selCount>1?"s":""}</div>}
                                  <div style={{display:"flex",borderTop:"1px solid #F2F0EF",paddingTop:10}}>
                                    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:`${groupe.color}12`,borderRadius:7,padding:"6px 0",fontSize:11,color:groupe.color,fontWeight:600}}>Voir les détails →</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Onglet Avantages ── */}
            {onglet==="avantages"&&(
              <>
                {avgsLoad ? (
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}><Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span>Chargement…</span></div>
                ) : avgsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucune fiche trouvée</p>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column" as const,gap:24}}>
                    {(()=>{
                      const SEC_ORDER=["primaire","secondaire","tertiaire"];
                      const secMap=new Map<number,{id:number;nom:string;items:any[]}>();
                      avgsFiltres.forEach((a:any)=>{
                        const sid=a.secteur_id||0;
                        if(!secMap.has(sid))secMap.set(sid,{id:sid,nom:a.secteur_nom||"Sans secteur",items:[]});
                        secMap.get(sid)!.items.push(a);
                      });
                      const SECT_COLORS=["#ca631f","#225BCC","#575799","#7c3aed","#0891b2","#d97706","#E35336","#188038"];
                      const secList=Array.from(secMap.values()).sort((a,b)=>{
                        const ai=SEC_ORDER.findIndex(o=>a.nom.toLowerCase().includes(o));
                        const bi=SEC_ORDER.findIndex(o=>b.nom.toLowerCase().includes(o));
                        return (ai===-1?99:ai)-(bi===-1?99:bi);
                      });
                      return secList.map((sec,si)=>{
                        const color=SECT_COLORS[si%SECT_COLORS.length];
                        const isOpen=avgsOpen[sec.id]!==false;
                        const showGrid=isOpen||hasFilterAvgs;
                        return (
                          <div key={sec.id}>
                            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:showGrid?12:0}}>
                              <div style={{width:3,height:18,borderRadius:2,background:color,flexShrink:0}}/>
                              <span style={{fontSize:12,fontWeight:700,color,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{sec.nom}</span>
                              <button onClick={()=>setAvgsOpen(prev=>({...prev,[sec.id]:!prev[sec.id]}))}
                                style={{display:"flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:6,border:`1px solid ${color}35`,background:`${color}0f`,cursor:"pointer",flexShrink:0}}>
                                {isOpen?<ChevronDown size={12} style={{color}}/>:<ChevronUp size={12} style={{color}}/>}
                              </button>
                            </div>
                            <style>{`@keyframes aptitle-scroll{0%,15%{transform:translateX(0)}70%,85%{transform:translateX(var(--aptitle-tx,0))}100%{transform:translateX(0)}}`}</style>
                            {showGrid&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                              {sec.items.map((a:any)=>(
                                <div key={a.id} onClick={()=>setAvgSel(a)}
                                  style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:`3px solid ${color}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",minWidth:0}}
                                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${color}18`;ev.currentTarget.style.borderColor=color;ev.currentTarget.style.borderLeftColor=color;}}
                                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor=color;}}>
                                  <ScrollTitle text={a.activite_nom||""} />
                                  {(a.secteur_nom||a.branche_nom)&&(
                                    <div style={{display:"flex",flexDirection:"column" as const,gap:4,marginBottom:8}}>
                                      {a.secteur_nom&&<span style={{fontSize:10,fontWeight:600,color,background:`${color}0e`,border:`1px solid ${color}28`,padding:"1px 8px",borderRadius:999,alignSelf:"flex-start" as const}}>{a.secteur_nom}</span>}
                                      {a.branche_nom&&<span style={{fontSize:10,fontWeight:600,color:"#4a5568",background:"rgba(74,85,104,0.07)",border:"1px solid rgba(74,85,104,0.18)",padding:"1px 8px",borderRadius:999,alignSelf:"flex-start" as const,marginLeft:10}}>{a.branche_nom}</span>}
                                    </div>
                                  )}
                                  <div style={{display:"flex",borderTop:"1px solid #F2F0EF",paddingTop:10}}>
                                    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:`${color}12`,borderRadius:7,padding:"6px 0",fontSize:11,color,fontWeight:600}}>Voir les détails →</div>
                                  </div>
                                </div>
                              ))}
                            </div>}
                          </div>
                        );
                      });
                    })()}
                  </div>
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
