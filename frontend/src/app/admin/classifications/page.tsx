"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Search, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };

const NIVEAU_COLOR: Record<number,string> = { 1:"#ca631f", 2:"#004f91", 3:"#188038" };
const NIVEAU_LABEL: Record<number,string> = { 1:"Section", 2:"Division", 3:"Groupe" };

// ── Badge CITI ────────────────────────────────────────────────────────────────
function CitiBadge({ item, onRemove }: { item:any; onRemove?:()=>void }) {
  const color = NIVEAU_COLOR[item.niveau] || "#004f91";
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${color}0D`, border:`1px solid ${color}30`, borderRadius:8, padding:"4px 10px", flexShrink:0 }}>
      <span style={{ fontSize:11, fontWeight:800, color }}>{item.code}</span>
      <span style={{ fontSize:10, color:"#9aa5b4" }}>{NIVEAU_LABEL[item.niveau]}</span>
      <span style={{ fontSize:12, color:"#1a1a2e", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{item.libelle_fr}</span>
      {onRemove && (
        <button onClick={onRemove} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", marginLeft:2 }}>
          <X size={11} style={{ color:"#dc2626" }} />
        </button>
      )}
    </div>
  );
}

// ── Sélecteur CITI (groupes niveau 3 uniquement) ──────────────────────────────
function CitiSelector({ citiItems, onSelect, onCancel }: { citiItems:any[]; onSelect:(item:any)=>void; onCancel:()=>void }) {
  const [search, setSearch] = useState("");

  const groupes = citiItems.filter(c => {
    if (c.niveau !== 3) return false;
    if (search && !(c.libelle_fr.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div style={{ background:"#fff", border:"1px solid #C5BFBB", borderRadius:12, padding:"12px 14px", marginTop:6, boxShadow:"0 4px 20px rgba(0,0,0,0.1)", zIndex:10, position:"relative" as const }}>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <div style={{ position:"relative" as const, flex:1 }}>
          <Search size={12} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un groupe CITI (ex: 011, agriculture…)"
            style={{...IS, paddingLeft:28, fontSize:12}} autoFocus />
        </div>
        <button onClick={onCancel} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:"0 10px" }}><X size={13} color="#4a5568" /></button>
      </div>
      <div style={{ maxHeight:180, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:2 }}>
        {groupes.slice(0, 30).map(c => (
          <button key={c.id} onClick={()=>onSelect(c)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, border:"none", background:"transparent", cursor:"pointer", textAlign:"left" as const, width:"100%" }}
            onMouseEnter={e=>e.currentTarget.style.background="#F8F7F6"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{ fontSize:11, fontWeight:700, color:"#188038", minWidth:36 }}>{c.code}</span>
            <span style={{ fontSize:12, color:"#1a1a2e" }}>{c.libelle_fr}</span>
          </button>
        ))}
        {groupes.length === 0 && <p style={{ fontSize:12, color:"#9aa5b4", padding:"8px 0", textAlign:"center" as const }}>Aucun groupe trouvé</p>}
        {groupes.length > 30 && <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const, padding:"4px 0" }}>Affinez la recherche…</p>}
      </div>
    </div>
  );
}

// ── Ligne activité ─────────────────────────────────────────────────────────────
function ActiviteRow({ activite, citiItems, correspondances, onAdd, onRemove }: any) {
  const [showSelector, setShowSelector] = useState(false);
  const myCorresp = correspondances.filter((c:any) => c.naema_type==="activite" && c.naema_id===activite.id);
  const myCiti = myCorresp.map((c:any) => {
    const item = citiItems.find((i:any) => i.id===c.classification_item_id);
    return item ? { ...item, corresp_id:c.id } : null;
  }).filter(Boolean);

  return (
    <div style={{ marginBottom:4 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", borderRadius:10, background:myCiti.length>0?"#FAFAF9":"rgba(220,38,38,0.02)", border:`1px solid ${myCiti.length>0?"#E8E5E3":"rgba(220,38,38,0.1)"}` }}>
        {/* Indicateur */}
        <div style={{ width:7, height:7, borderRadius:"50%", background:myCiti.length>0?"#188038":"#E8E5E3", flexShrink:0, marginTop:5 }} />

        {/* Nom activité */}
        <div style={{ flex:"0 0 220px", minWidth:0 }}>
          <p style={{ fontSize:12, fontWeight:600, color:"#1a1a2e", lineHeight:1.4, margin:0 }}>{activite.nom}</p>
          {myCiti.length===0 && <p style={{ fontSize:10, color:"#dc2626", marginTop:2 }}>Sans correspondance</p>}
        </div>

        <ChevronRight size={12} style={{ color:"#C5BFBB", flexShrink:0, marginTop:4 }} />

        {/* Correspondances CITI */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginBottom:showSelector?6:0 }}>
            {myCiti.map((c:any) => (
              <CitiBadge key={c.corresp_id} item={c} onRemove={()=>onRemove(c.corresp_id)} />
            ))}
            {!showSelector && (
              <button onClick={()=>setShowSelector(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:4, background:"transparent", border:"1.5px dashed #C5BFBB", borderRadius:7, padding:"3px 9px", cursor:"pointer", fontSize:11, color:"#9aa5b4", fontFamily:"var(--font-google-sans)" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="#188038"; e.currentTarget.style.color="#188038"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
                <Plus size={10} /> {myCiti.length>0?"Ajouter":"Lier"}
              </button>
            )}
          </div>
          {showSelector && (
            <CitiSelector citiItems={citiItems}
              onSelect={async(item)=>{ await onAdd(activite.id, item.id); setShowSelector(false); }}
              onCancel={()=>setShowSelector(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bloc branche ──────────────────────────────────────────────────────────────
function BrancheBloc({ branche, activites, citiItems, correspondances, onAdd, onRemove }: any) {
  const [open, setOpen] = useState(true);
  const mesActivites = activites.filter((a:any) => a.branche_id===branche.id);
  const nbSans = mesActivites.filter((a:any) =>
    !correspondances.some((c:any) => c.naema_type==="activite" && c.naema_id===a.id)
  ).length;

  return (
    <div style={{ marginBottom:8, borderRadius:12, border:"1px solid #E8E5E3", overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", background:"#fff", cursor:"pointer", borderBottom:open?"1px solid #F2F0EF":"none" }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#004f91", flexShrink:0 }} />
        <span style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", flex:1 }}>{branche.nom}</span>
        {nbSans>0 && <span style={{ fontSize:10, fontWeight:700, color:"#dc2626", background:"rgba(220,38,38,0.07)", padding:"1px 7px", borderRadius:999 }}>{nbSans} sans correspondance</span>}
        <span style={{ fontSize:11, color:"#9aa5b4" }}>{mesActivites.length} activité{mesActivites.length>1?"s":""}</span>
        {open ? <ChevronDown size={13} style={{color:"#9aa5b4"}} /> : <ChevronRight size={13} style={{color:"#9aa5b4"}} />}
      </div>
      {open && (
        <div style={{ padding:"10px 14px", background:"#FAFAF9" }}>
          {mesActivites.map((a:any) => (
            <ActiviteRow key={a.id} activite={a} citiItems={citiItems} correspondances={correspondances} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bloc secteur ──────────────────────────────────────────────────────────────
function SecteurBloc({ secteur, branches, activites, citiItems, correspondances, onAdd, onRemove }: any) {
  const [open, setOpen] = useState(true);
  const mesBranches   = branches.filter((b:any) => b.secteur_id===secteur.id);
  const mesActiviteIds = activites.filter((a:any) => mesBranches.some((b:any)=>b.id===a.branche_id)).map((a:any)=>a.id);
  const nbSans = mesActiviteIds.filter((id:number) =>
    !correspondances.some((c:any) => c.naema_type==="activite" && c.naema_id===id)
  ).length;

  return (
    <div style={{ marginBottom:16, border:"1.5px solid #E8E5E3", borderRadius:14, overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"#fff", cursor:"pointer", borderBottom:open?"1px solid #F2F0EF":"none" }}>
        <div style={{ width:10, height:10, borderRadius:"50%", background:"#ca631f", flexShrink:0 }} />
        <span style={{ fontWeight:800, fontSize:14, color:"#1a1a2e", flex:1 }}>{secteur.nom}</span>
        {nbSans>0 && <span style={{ fontSize:10, fontWeight:700, color:"#dc2626", background:"rgba(220,38,38,0.07)", padding:"2px 9px", borderRadius:999 }}>{nbSans} activité{nbSans>1?"s":""} sans correspondance</span>}
        <span style={{ fontSize:11, color:"#9aa5b4" }}>{mesBranches.length} branche{mesBranches.length>1?"s":""}</span>
        {open ? <ChevronDown size={14} style={{color:"#9aa5b4"}} /> : <ChevronRight size={14} style={{color:"#9aa5b4"}} />}
      </div>
      {open && (
        <div style={{ padding:"12px 16px", background:"rgba(202,99,31,0.02)" }}>
          {mesBranches.map((b:any) => (
            <BrancheBloc key={b.id} branche={b} activites={activites} citiItems={citiItems} correspondances={correspondances} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ClassificationsPage() {
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);
  const [citiItems, setCitiItems] = useState<any[]>([]);
  const [corresp,   setCorresp]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");

  const charger = async () => {
    setLoading(true);
    try {
      const [s, b, a, ci, co] = await Promise.all([
        fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json()),
        fetch(`${API}/entreprises/ref/branches`).then(r=>r.json()),
        fetch(`${API}/entreprises/ref/activites`).then(r=>r.json()),
        fetch(`${API}/classifications/CITI/items`).then(r=>r.json()),
        fetch(`${API}/classifications/correspondances`).then(r=>r.json()),
      ]);
      setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]);
      setCitiItems(ci||[]); setCorresp(co||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, []);

  const handleAdd = async (activite_id:number, citi_item_id:number) => {
    await fetch(`${API}/classifications/correspondances`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ naema_type:"activite", naema_id:activite_id, classification_item_id:citi_item_id })
    });
    charger();
  };

  const handleRemove = async (correspId:number) => {
    if (!confirm("Supprimer cette correspondance ?")) return;
    await fetch(`${API}/classifications/correspondances/${correspId}`, { method:"DELETE" });
    charger();
  };

  // Stats
  const nbTotal  = activites.length;
  const nbRelies = [...new Set(corresp.filter(c=>c.naema_type==="activite").map(c=>c.naema_id))].length;
  const nbSans   = nbTotal - nbRelies;

  const secteursFiltres = secteurs.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    const mesBranches = branches.filter(b=>b.secteur_id===s.id);
    const mesActivites = activites.filter(a=>mesBranches.some(b=>b.id===a.branche_id));
    return s.nom.toLowerCase().includes(q) ||
      mesBranches.some((b:any)=>b.nom.toLowerCase().includes(q)) ||
      mesActivites.some((a:any)=>a.nom.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom:28 }}>
        <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase" as const, marginBottom:4 }}>Administration</p>
        <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Correspondances NAEMA ↔ CITI</h1>
        <div style={{ display:"flex", gap:16, marginTop:6, flexWrap:"wrap" as const }}>
          <span style={{ fontSize:13, color:"#9aa5b4" }}>{nbTotal} activités NAEMA</span>
          <span style={{ fontSize:13, color:"#188038", fontWeight:600 }}>✓ {nbRelies} reliées à CITI</span>
          {nbSans>0 && <span style={{ fontSize:13, color:"#dc2626", fontWeight:600 }}>⚠ {nbSans} sans correspondance</span>}
          <span style={{ fontSize:13, color:"#9aa5b4" }}>{corresp.filter(c=>c.naema_type==="activite").length} liaisons au total</span>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display:"flex", gap:20, marginBottom:16, padding:"10px 16px", background:"#fff", borderRadius:10, border:"1px solid #E8E5E3", width:"fit-content" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#4a5568" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#ca631f" }} /> Secteur NAEMA
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#4a5568" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#004f91" }} /> Branche NAEMA
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#4a5568" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#188038" }} /> Activité reliée
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#4a5568" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#E8E5E3" }} /> Activité sans correspondance
        </div>
        <div style={{ width:1, background:"#E8E5E3" }} />
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#188038" }}>
          <span style={{ fontWeight:700 }}>011</span> Groupe CITI (niveau 3)
        </div>
      </div>

      {/* Recherche */}
      <div style={{ position:"relative" as const, maxWidth:420, marginBottom:24 }}>
        <Search size={14} style={{ position:"absolute" as const, left:12, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrer par secteur, branche ou activité…"
          style={{...IS, paddingLeft:36}} />
        {search && <button onClick={()=>setSearch("")} style={{ position:"absolute" as const, right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer" }}><X size={13} color="#9aa5b4" /></button>}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ maxWidth:1000 }}>
          {secteursFiltres.map(s => (
            <SecteurBloc key={s.id} secteur={s} branches={branches} activites={activites}
              citiItems={citiItems} correspondances={corresp} onAdd={handleAdd} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
