"use client";

// Filtres latéraux partagés des pages publiques (entreprises, accords,
// événements, prospects, opportunités) — remplace les copies locales.
//  - SideFilter : liste à cocher repliable (items string[] ou {value,label}[])
//  - ThematiquesCascadeFilter : cascade Secteur → Branche → Activité
//  - LocalisationFilter : cascade Région → Département → Arrondissement

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState } from "react";

type Item = string | { value: string; label: string };

function normaliser(items: Item[], format?: (v: string) => string): { value: string; label: string }[] {
  return items.map(i => typeof i === "string" ? { value: i, label: format ? format(i) : i } : i);
}

function EnteteRepliable({ label, badges, open, onToggle }: {
  label: string; badges: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{label}</span>
        {badges}
      </div>
      <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
      </span>
    </button>
  );
}

function LigneOption({ sel, couleur, texte, onClick }: {
  sel: boolean; couleur: string; texte: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
      onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
      onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
      <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?couleur:"#C5BFBB"}`,background:sel?couleur:"transparent",flexShrink:0}}/>
      <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{texte}</span>
    </button>
  );
}

const badgeCompte = (n: number, couleur: string, fond?: string) =>
  n > 0 ? <span style={{fontSize:10,fontWeight:700,color:couleur,background:fond||couleur+"18",padding:"1px 6px",borderRadius:999}}>{n}</span> : null;

export function SideFilter({ label, items, selected, onToggle, color, searchable = false, format, listMaxHeight, marginBottom = 18 }: {
  label: string; items: Item[]; selected: string[]; onToggle: (v: string) => void; color: string;
  searchable?: boolean; format?: (v: string) => string; listMaxHeight?: number; marginBottom?: number;
}) {
  const [open, setOpen]     = useState(true);
  const [search, setSearch] = useState("");
  const normalises = normaliser(items, format);
  const filtered = searchable ? normalises.filter(i => i.label.toLowerCase().includes(search.toLowerCase())) : normalises;
  return (
    <div style={{marginBottom}}>
      <EnteteRepliable label={label} open={open} onToggle={()=>setOpen(o=>!o)}
        badges={badgeCompte(selected.length, color)}/>
      {open&&(
        <>
          {searchable&&<div style={{position:"relative" as const,marginBottom:6}}>
            <Search size={11} style={{position:"absolute" as const,left:8,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{width:"100%",paddingLeft:24,paddingRight:8,paddingTop:6,paddingBottom:6,borderRadius:7,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:11,outline:"none",boxSizing:"border-box" as const}}/>
          </div>}
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:listMaxHeight,overflowY:listMaxHeight?"auto" as const:undefined}}>
            {filtered.map(item=>(
              <LigneOption key={item.value} sel={selected.includes(item.value)} couleur={color}
                texte={item.label} onClick={()=>onToggle(item.value)}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Bouton « Effacer les filtres » des états vides — même bleu partout.
export function BoutonEffacerFiltres({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>
      Effacer les filtres
    </button>
  );
}

// Cascade générique à 3 niveaux (bleu → orange → vert) utilisée par les deux
// filtres ci-dessous : chaque niveau n'apparaît que si le parent est coché.
const NIVEAUX = [
  { couleur: "#004f91", fond: "rgba(0,79,145,0.1)" },
  { couleur: "#ca631f", fond: "rgba(202,99,31,0.1)" },
  { couleur: "#188038", fond: "rgba(24,128,56,0.1)" },
];

function CascadeFilter({ titre, niveaux, marginBottom }: {
  titre: string;
  niveaux: { label: string; items: any[]; sel: string[]; onToggle: (v: string) => void; maxHeight?: number }[];
  marginBottom: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{marginBottom}}>
      <EnteteRepliable label={titre} open={open} onToggle={()=>setOpen(o=>!o)}
        badges={<>{niveaux.map((n,i)=><span key={i} style={{display:"contents"}}>{badgeCompte(n.sel.length, NIVEAUX[i].couleur, NIVEAUX[i].fond)}</span>)}</>}/>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        {niveaux.map((n, i) => {
          if (i > 0 && (niveaux[i-1].sel.length === 0 || n.items.length === 0)) return null;
          const { couleur } = NIVEAUX[i];
          return (
            <div key={n.label} style={i===0?undefined:{paddingLeft:12*i,borderLeft:`2px solid ${NIVEAUX[i-1].couleur}26`}}>
              <p style={{fontSize:10,fontWeight:700,color:couleur,marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{n.label}</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:n.maxHeight,overflowY:n.maxHeight?"auto" as const:undefined}}>
                {n.items.map((it:any)=>(
                  <LigneOption key={it.nom} sel={n.sel.includes(it.nom)} couleur={couleur}
                    texte={it.nom} onClick={()=>n.onToggle(it.nom)}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

export function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite, marginBottom = 18 }: {
  secteurs: any[]; secteursSel: string[]; branchesSel: string[]; activitesSel: string[];
  onSecteur: (v: string) => void; onBranche: (v: string) => void; onActivite: (v: string) => void;
  marginBottom?: number;
}) {
  const branches  = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  return <CascadeFilter titre="Thématiques" marginBottom={marginBottom} niveaux={[
    { label: "Secteur",  items: secteurs,  sel: secteursSel,  onToggle: onSecteur },
    { label: "Branche",  items: branches,  sel: branchesSel,  onToggle: onBranche },
    { label: "Activité", items: activites, sel: activitesSel, onToggle: onActivite },
  ]}/>;
}

export function LocalisationFilter({ regions, regionsSel, departementsSel, arrondissementsSel, onRegion, onDepartement, onArrondissement, marginBottom = 18 }: {
  regions: any[]; regionsSel: string[]; departementsSel: string[]; arrondissementsSel: string[];
  onRegion: (v: string) => void; onDepartement: (v: string) => void; onArrondissement: (v: string) => void;
  marginBottom?: number;
}) {
  const departements    = regions.filter(r=>regionsSel.includes(r.nom)).flatMap((r:any)=>r.departements||[]);
  const arrondissements = departements.filter((d:any)=>departementsSel.includes(d.nom)).flatMap((d:any)=>d.arrondissements||[]);
  return <CascadeFilter titre="Localisation" marginBottom={marginBottom} niveaux={[
    { label: "Région",         items: regions,         sel: regionsSel,         onToggle: onRegion,         maxHeight: 160 },
    { label: "Département",    items: departements,    sel: departementsSel,    onToggle: onDepartement,    maxHeight: 140 },
    { label: "Arrondissement", items: arrondissements, sel: arrondissementsSel, onToggle: onArrondissement, maxHeight: 120 },
  ]}/>;
}
