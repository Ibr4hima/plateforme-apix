"use client";

/**
 * NaemaSelect — sélecteur de thématiques NAEMA en cascade
 * Travaille avec des IDs (integers), pas des noms texte.
 *
 * Props :
 *   secteurIds   / onChangeSecteurs   — ids sélectionnés + setter
 *   brancheIds   / onChangeBranches
 *   activiteIds  / onChangeActivites
 */

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RefItem { id: number; nom: string; secteur_id?: number; branche_id?: number; }

interface Props {
  secteurIds:        number[];
  brancheIds:        number[];
  activiteIds:       number[];
  onChangeSecteurs:  (ids: number[]) => void;
  onChangeBranches:  (ids: number[]) => void;
  onChangeActivites: (ids: number[]) => void;
}

function CheckItem({ label, selected, onToggle, color }: { label:string; selected:boolean; onToggle:()=>void; color:string }) {
  return (
    <button onClick={onToggle}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, border:"none", cursor:"pointer", background:selected?color+"12":"transparent", width:"100%", textAlign:"left" as const, transition:"background 0.12s" }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.background="#F8F7F6"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background=selected?color+"12":"transparent"; }}>
      <div style={{ width:13, height:13, borderRadius:"50%", border:`2px solid ${selected?color:"#C5BFBB"}`, background:selected?color:"transparent", flexShrink:0, transition:"all 0.12s" }} />
      <span style={{ fontSize:12, color:selected?"#1a1a2e":"#4a5568", fontWeight:selected?600:400 }}>{label}</span>
    </button>
  );
}

function ColSection({ title, color, children, open, onToggle, count }: { title:string; color:string; children:React.ReactNode; open:boolean; onToggle:()=>void; count:number }) {
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <button onClick={onToggle}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"8px 10px", background:count>0?color+"08":"#F8F7F6", border:`1px solid ${count>0?color+"30":"#E8E5E3"}`, borderRadius:9, cursor:"pointer", marginBottom:open?4:0, transition:"all 0.15s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color:count>0?color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>{title}</span>
          {count>0 && <span style={{ fontSize:10, fontWeight:700, color, background:color+"15", padding:"1px 6px", borderRadius:999 }}>{count}</span>}
        </div>
        {open ? <ChevronUp size={12} style={{color:"#9aa5b4"}}/> : <ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open && (
        <div style={{ border:`1px solid ${color}20`, borderRadius:9, overflow:"hidden", maxHeight:220, overflowY:"auto" as const }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function NaemaSelect({ secteurIds, brancheIds, activiteIds, onChangeSecteurs, onChangeBranches, onChangeActivites }: Props) {
  const [secteurs,  setSecteurs]  = useState<RefItem[]>([]);
  const [branches,  setBranches]  = useState<RefItem[]>([]);
  const [activites, setActivites] = useState<RefItem[]>([]);
  const [openSec,   setOpenSec]   = useState(true);
  const [openBra,   setOpenBra]   = useState(false);
  const [openAct,   setOpenAct]   = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a]) => {
      setSecteurs(s||[]);
      setBranches(b||[]);
      setActivites(a||[]);
      setLoaded(true);
    }).catch(()=>{});
  }, []);

  // Ouvrir automatiquement les colonnes si des sélections existent
  useEffect(() => {
    if (!loaded) return;
    if (brancheIds.length > 0)  setOpenBra(true);
    if (activiteIds.length > 0) setOpenAct(true);
  }, [loaded]);

  const toggleSec = (id: number) => {
    const next = secteurIds.includes(id) ? secteurIds.filter(x=>x!==id) : [...secteurIds, id];
    onChangeSecteurs(next);
    // Sélection d'un secteur → ouvrir automatiquement la colonne Branche
    if (!secteurIds.includes(id)) setOpenBra(true);
    // Si on désélectionne un secteur, retirer ses branches et activités
    if (secteurIds.includes(id)) {
      const brasDuSec = branches.filter(b=>b.secteur_id===id).map(b=>b.id);
      onChangeBranches(brancheIds.filter(b=>!brasDuSec.includes(b)));
      const actsDuSec = activites.filter(a=>brasDuSec.includes(a.branche_id!)).map(a=>a.id);
      onChangeActivites(activiteIds.filter(a=>!actsDuSec.includes(a)));
    }
  };

  const toggleBra = (id: number) => {
    const next = brancheIds.includes(id) ? brancheIds.filter(x=>x!==id) : [...brancheIds, id];
    onChangeBranches(next);
    // Sélection d'une branche → ouvrir automatiquement la colonne Activité
    if (!brancheIds.includes(id)) setOpenAct(true);
    if (brancheIds.includes(id)) {
      const actsDeBra = activites.filter(a=>a.branche_id===id).map(a=>a.id);
      onChangeActivites(activiteIds.filter(a=>!actsDeBra.includes(a)));
    }
  };

  const toggleAct = (id: number) => {
    onChangeActivites(activiteIds.includes(id) ? activiteIds.filter(x=>x!==id) : [...activiteIds, id]);
  };

  // Branches disponibles = branches dont le secteur parent est sélectionné (ou toutes si aucun secteur)
  const brasDispo = secteurIds.length > 0
    ? branches.filter(b => secteurIds.includes(b.secteur_id!))
    : branches;

  // Activités disponibles = activités dont la branche parent est sélectionnée (ou toutes si aucune branche)
  const actsDispo = brancheIds.length > 0
    ? activites.filter(a => brancheIds.includes(a.branche_id!))
    : activites;

  // Tags de résumé
  const allSelected = [
    ...secteurIds.map(id => ({ id, nom: secteurs.find(s=>s.id===id)?.nom||"", color:"#004f91" })),
    ...brancheIds.map(id => ({ id, nom: branches.find(b=>b.id===id)?.nom||"", color:"#ca631f" })),
    ...activiteIds.map(id => ({ id, nom: activites.find(a=>a.id===id)?.nom||"", color:"#188038" })),
  ].filter(t=>t.nom);

  return (
    <div>
      {/* Résumé des sélections */}
      {allSelected.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginBottom:10 }}>
          {allSelected.map(t => (
            <span key={`${t.color}-${t.id}`} style={{ display:"inline-flex", alignItems:"center", gap:4, background:t.color+"10", color:t.color, border:`1px solid ${t.color}25`, borderRadius:999, padding:"2px 8px", fontSize:11, fontWeight:600 }}>
              {t.nom}
              <button onClick={()=>{
                if (t.color==="#004f91") toggleSec(t.id);
                else if (t.color==="#ca631f") toggleBra(t.id);
                else toggleAct(t.id);
              }} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex" }}>
                <X size={10} style={{color:t.color}}/>
              </button>
            </span>
          ))}
          <button onClick={()=>{ onChangeSecteurs([]); onChangeBranches([]); onChangeActivites([]); }}
            style={{ fontSize:10, color:"#dc2626", background:"none", border:"none", cursor:"pointer", padding:"2px 4px" }}>
            Tout effacer
          </button>
        </div>
      )}

      {/* Colonnes cascade */}
      <div style={{ display:"flex", gap:8 }}>
        <ColSection title="Secteur" color="#004f91" open={openSec} onToggle={()=>setOpenSec(o=>!o)} count={secteurIds.length}>
          {secteurs.map(s => <CheckItem key={s.id} label={s.nom} selected={secteurIds.includes(s.id)} onToggle={()=>toggleSec(s.id)} color="#004f91"/>)}
        </ColSection>
        <ColSection title="Branche" color="#ca631f" open={openBra} onToggle={()=>setOpenBra(o=>!o)} count={brancheIds.length}>
          {brasDispo.length === 0
            ? <p style={{fontSize:11,color:"#9aa5b4",padding:"10px 12px"}}>Choisir un secteur d'abord</p>
            : secteurIds.map(secId => {
                const secNom = secteurs.find(s=>s.id===secId)?.nom;
                const brasDuSec = brasDispo.filter(b=>b.secteur_id===secId);
                if (!brasDuSec.length) return null;
                return (
                  <div key={secId}>
                    <div style={{fontSize:10,fontWeight:700,color:"#004f91",padding:"6px 10px 3px",background:"rgba(0,79,145,0.05)",borderBottom:"1px solid rgba(0,79,145,0.1)"}}>{secNom}</div>
                    {brasDuSec.map(b => <CheckItem key={b.id} label={b.nom} selected={brancheIds.includes(b.id)} onToggle={()=>toggleBra(b.id)} color="#ca631f"/>)}
                  </div>
                );
              })
          }
        </ColSection>
        <ColSection title="Activité" color="#188038" open={openAct} onToggle={()=>setOpenAct(o=>!o)} count={activiteIds.length}>
          {actsDispo.length === 0
            ? <p style={{fontSize:11,color:"#9aa5b4",padding:"10px 12px"}}>Choisir une branche d'abord</p>
            : brancheIds.map(braId => {
                const braNom = branches.find(b=>b.id===braId)?.nom;
                const actsDeBra = actsDispo.filter(a=>a.branche_id===braId);
                if (!actsDeBra.length) return null;
                return (
                  <div key={braId}>
                    <div style={{fontSize:10,fontWeight:700,color:"#ca631f",padding:"6px 10px 3px",background:"rgba(202,99,31,0.05)",borderBottom:"1px solid rgba(202,99,31,0.1)"}}>{braNom}</div>
                    {actsDeBra.map(a => <CheckItem key={a.id} label={a.nom} selected={activiteIds.includes(a.id)} onToggle={()=>toggleAct(a.id)} color="#188038"/>)}
                  </div>
                );
              })
          }
        </ColSection>
      </div>
    </div>
  );
}
