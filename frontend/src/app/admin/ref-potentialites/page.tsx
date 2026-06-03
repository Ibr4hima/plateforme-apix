"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };

// ── Modal générique (catégorie ou avantage) ───────────────────────────────────
function EditModal({ open, onClose, title, libelle, onSave, saving, error }:
  { open:boolean; onClose:()=>void; title:string; libelle:string; onSave:(v:string)=>void; saving:boolean; error:string }) {
  const [val, setVal] = useState(libelle);
  useEffect(()=>{ if (open) setVal(libelle); }, [open, libelle]);
  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", backdropFilter:"blur(5px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:16, width:"100%", maxWidth:440, border:"1px solid #C5BFBB", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"16px 16px 0 0" }}/>
        <div style={{ padding:"22px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <span style={{ fontWeight:700, fontSize:"1rem", color:"#1a1a2e" }}>{title}</span>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:6 }}><X size={14} color="#4a5568"/></button>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={LS}>Libellé *</label>
            <input value={val} onChange={e=>setVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") onSave(val); }}
              style={IS} autoFocus placeholder="Ex : Ressources naturelles"/>
          </div>
          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:10 }}>{error}</p>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={()=>onSave(val)} disabled={saving}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:9, border:"none", background:"#ca631f", color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
              {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> : <Check size={13}/>}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
// ── Composant Avantages & Incitations référentiel ────────────────────────────
function AvantagesReferentiel() {
  const [types,     setTypes]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editItem,  setEditItem]  = useState<any>(null);
  const [val,       setVal]       = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [deleting,  setDeleting]  = useState<number|null>(null);
  const [toggling,  setToggling]  = useState<number|null>(null);

  const IS:any={background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",width:"100%",boxSizing:"border-box" as const,fontFamily:"var(--font-google-sans)"};

  const charger = async () => {
    setLoading(true);
    try { const r=await fetch(`${API}/ref-avantages`); setTypes(await r.json()); }
    finally { setLoading(false); }
  };
  useEffect(()=>{charger();},[]);

  const openCreate = () => { setEditItem(null); setVal(""); setError(""); setModal(true); };
  const openEdit   = (t:any) => { setEditItem(t); setVal(t.libelle); setError(""); setModal(true); };

  const save = async () => {
    if (!val.trim()) { setError("Libellé obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const url = editItem ? `${API}/ref-avantages/${editItem.id}` : `${API}/ref-avantages`;
      const res = await fetch(url, {method:editItem?"PATCH":"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({libelle:val.trim(),ordre:editItem?.ordre||0,actif:true})});
      if (!res.ok) throw new Error("Erreur");
      setModal(false); charger();
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id:number) => {
    if (!confirm("Supprimer ce type d'avantage ?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/ref-avantages/${id}`, {method:"DELETE"});
      if (!res.ok) { const d=await res.json(); alert(d.detail||"Erreur"); return; }
      charger();
    } finally { setDeleting(null); }
  };

  const toggle = async (t:any) => {
    setToggling(t.id);
    await fetch(`${API}/ref-avantages/${t.id}/toggle`, {method:"PATCH"});
    setToggling(null); charger();
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={{fontSize:13,color:"#9aa5b4"}}>{types.length} type{types.length>1?"s":""} d'avantage</p>
        <button onClick={openCreate}
          style={{display:"flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,boxShadow:"0 4px 14px rgba(124,58,237,0.25)"}}>
          <Plus size={14}/> Nouveau type
        </button>
      </div>

      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:60}}><Loader2 size={28} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/></div>
      ) : types.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:"#9aa5b4"}}>
          <p style={{fontSize:15,fontWeight:600}}>Aucun type d'avantage</p>
          <p style={{fontSize:13}}>Ajoutez des types comme Foncier, Fiscal, Douanier...</p>
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E8E5E3",overflow:"hidden"}}>
          {types.map((t:any, i:number) => (
            <div key={t.id}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderBottom:i<types.length-1?"1px solid #F2F0EF":"none",opacity:t.actif?1:0.45}}
              onMouseEnter={e=>e.currentTarget.style.background="#F8F7F6"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:8,height:8,borderRadius:"50%",background:t.actif?"#7c3aed":"#C5BFBB",flexShrink:0}}/>
              <span style={{flex:1,fontSize:14,fontWeight:600,color:"#1a1a2e"}}>{t.libelle}</span>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>openEdit(t)}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",background:"rgba(54,111,227,0.08)",fontSize:12,color:"#366FE3",fontWeight:600}}>
                  <Pencil size={11}/> Modifier
                </button>
                <button onClick={()=>toggle(t)} disabled={toggling===t.id}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",background:t.actif?"rgba(5,150,105,0.07)":"rgba(156,163,175,0.08)",fontSize:12,color:t.actif?"#059669":"#6b7280",fontWeight:600}}>
                  {toggling===t.id?<Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/>:t.actif?"Actif":"Inactif"}
                </button>
                <button onClick={()=>del(t.id)} disabled={deleting===t.id}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:7,border:"none",cursor:"pointer",background:"rgba(220,38,38,0.07)"}}>
                  {deleting===t.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal&&(
        <div onClick={e=>{if(e.target===e.currentTarget){setModal(false);}}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(5px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"#FAFAF9",borderRadius:16,width:"100%",maxWidth:420,border:"1px solid #C5BFBB",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div style={{height:4,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:"16px 16px 0 0"}}/>
            <div style={{padding:"22px 28px 28px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <span style={{fontWeight:700,fontSize:"1rem",color:"#1a1a2e"}}>{editItem?"Modifier le type":"Nouveau type d'avantage"}</span>
                <button onClick={()=>setModal(false)} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:6}}><X size={14} color="#4a5568"/></button>
              </div>
              <label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:5,display:"block"}}>Libellé *</label>
              <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();}}
                placeholder="Ex : Fiscal, Foncier, Douanier..." style={{...IS,marginBottom:error?8:16}} autoFocus/>
              {error&&<p style={{fontSize:12,color:"#dc2626",marginBottom:12}}>{error}</p>}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Annuler</button>
                <button onClick={save} disabled={saving}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"9px 20px",borderRadius:9,border:"none",background:"#7c3aed",color:"#fff",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontSize:13}}>
                  {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
                  {saving?"Enregistrement…":"Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RefPotentialitesPage() {
  const [categories,    setCategories]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [sectionOnglet, setSectionOnglet] = useState<"potentialites"|"avantages">("potentialites");

  // Modal catégorie
  const [catModal,  setCatModal]  = useState(false);
  const [catEdit,   setCatEdit]   = useState<any>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catError,  setCatError]  = useState("");

  // Modal avantage
  const [avgModal,  setAvgModal]  = useState(false);
  const [avgEdit,   setAvgEdit]   = useState<any>(null);
  const [avgCatId,  setAvgCatId]  = useState<number|null>(null);
  const [avgSaving, setAvgSaving] = useState(false);
  const [avgError,  setAvgError]  = useState("");

  // États de suppression/toggle
  const [deletingCat, setDeletingCat] = useState<number|null>(null);
  const [deletingAvg, setDeletingAvg] = useState<number|null>(null);
  const [togglingAvg, setTogglingAvg] = useState<number|null>(null);
  const [togglingCat, setTogglingCat] = useState<number|null>(null);

  const charger = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/ref-potentialites`);
      const data = await res.json();
      setCategories(data);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ charger(); }, []);

  // ── Catégories ──────────────────────────────────────────────────────────────
  const saveCat = async (libelle: string) => {
    if (!libelle.trim()) { setCatError("Le libellé est obligatoire"); return; }
    setCatSaving(true); setCatError("");
    try {
      const url    = catEdit ? `${API}/ref-potentialites/categories/${catEdit.id}` : `${API}/ref-potentialites/categories`;
      const method = catEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ libelle: libelle.trim(), ordre: catEdit?.ordre||0, actif: true }) });
      if (!res.ok) throw new Error("Erreur");
      setCatModal(false); charger();
    } catch(e:any) { setCatError(e.message); }
    finally { setCatSaving(false); }
  };

  const deleteCat = async (id: number) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    setDeletingCat(id);
    try {
      const res = await fetch(`${API}/ref-potentialites/categories/${id}`, { method:"DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.detail||"Erreur"); return; }
      charger();
    } finally { setDeletingCat(null); }
  };

  const toggleCat = async (cat: any) => {
    setTogglingCat(cat.id);
    await fetch(`${API}/ref-potentialites/categories/${cat.id}/toggle`, { method:"PATCH" });
    setTogglingCat(null); charger();
  };

  // ── Avantages ───────────────────────────────────────────────────────────────
  const saveAvg = async (libelle: string) => {
    if (!libelle.trim()) { setAvgError("Le libellé est obligatoire"); return; }
    setAvgSaving(true); setAvgError("");
    try {
      const url    = avgEdit ? `${API}/ref-potentialites/${avgEdit.id}` : `${API}/ref-potentialites`;
      const method = avgEdit ? "PATCH" : "POST";
      const payload = { categorie_id: avgEdit?.categorie_id || avgCatId, libelle: libelle.trim(), ordre: avgEdit?.ordre||0, actif: true };
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error("Erreur");
      setAvgModal(false); charger();
    } catch(e:any) { setAvgError(e.message); }
    finally { setAvgSaving(false); }
  };

  const deleteAvg = async (id: number) => {
    if (!confirm("Supprimer cet avantage ?")) return;
    setDeletingAvg(id);
    await fetch(`${API}/ref-potentialites/${id}`, { method:"DELETE" });
    setDeletingAvg(null); charger();
  };

  const toggleAvg = async (item: any) => {
    setTogglingAvg(item.id);
    await fetch(`${API}/ref-potentialites/${item.id}/toggle`, { method:"PATCH" });
    setTogglingAvg(null); charger();
  };

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:8 }}>
        <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Administration · Référentiels</p>
        <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Référentiels</h1>
        <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>
          Gérez les catégories et items utilisés dans les fiches de potentialités et d'avantages.
        </p>
      </div>

      {/* Onglets + bouton action */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #E8E5E3", marginBottom:28 }}>
        <div style={{ display:"flex" }}>
          {([
            {key:"potentialites", label:"Atouts & potentialités", color:"#ca631f"},
            {key:"avantages",     label:"Avantages & incitations", color:"#7c3aed"},
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setSectionOnglet(t.key)}
              style={{padding:"14px 22px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-google-sans)",fontSize:13,fontWeight:600,color:sectionOnglet===t.key?t.color:"#9aa5b4",borderBottom:`2px solid ${sectionOnglet===t.key?t.color:"transparent"}`,transition:"all 0.15s",marginBottom:-1}}>
              {t.label}
            </button>
          ))}
        </div>
        {sectionOnglet==="potentialites" && (
          <button onClick={()=>{ setCatEdit(null); setCatError(""); setCatModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 18px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#ca631f,#e07a3a)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(202,99,31,0.25)" }}>
            <Plus size={14}/> Nouvelle catégorie
          </button>
        )}
      </div>

      {/* Section Atouts & Potentialités */}
      {sectionOnglet==="potentialites" && (
        loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
            <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }}/>
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 0", color:"#9aa5b4" }}>
            <p style={{ fontSize:16, fontWeight:600 }}>Aucune catégorie</p>
            <p style={{ fontSize:13 }}>Créez votre première catégorie</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {categories.map((cat:any) => {
              const avantages: any[] = cat.avantages || [];
              const actifs = avantages.filter((a:any)=>a.actif).length;
              return (
                <div key={cat.id} style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", opacity: cat.actif ? 1 : 0.55 }}>
                  <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid #F2F0EF", background:"#FAFAF9" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:"#1a1a2e" }}>{cat.libelle}</div>
                        <div style={{ fontSize:11, color:"#9aa5b4", marginTop:2 }}>
                          {actifs} actif{actifs>1?"s":""} · {avantages.length} avantage{avantages.length>1?"s":""}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                        <button onClick={()=>{ setCatEdit(cat); setCatError(""); setCatModal(true); }}
                          style={{ width:30, height:30, borderRadius:7, border:"none", cursor:"pointer", background:"rgba(54,111,227,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Pencil size={12} style={{color:"#366FE3"}}/>
                        </button>
                        <button onClick={()=>toggleCat(cat)} disabled={togglingCat===cat.id}
                          style={{ width:30, height:30, borderRadius:7, border:"none", cursor:"pointer", background:cat.actif?"rgba(5,150,105,0.08)":"rgba(156,163,175,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {togglingCat===cat.id ? <Loader2 size={12} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/> : <div style={{ width:8, height:8, borderRadius:"50%", background:cat.actif?"#059669":"#C5BFBB" }}/>}
                        </button>
                        <button onClick={()=>deleteCat(cat.id)} disabled={deletingCat===cat.id}
                          style={{ width:30, height:30, borderRadius:7, border:"none", cursor:"pointer", background:"rgba(220,38,38,0.07)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {deletingCat===cat.id ? <Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/> : <Trash2 size={12} style={{color:"#dc2626"}}/>}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ maxHeight:260, overflowY:"auto" }}>
                    {avantages.length === 0 ? (
                      <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center", padding:"16px 0" }}>Aucun avantage</p>
                    ) : avantages.map((item:any) => (
                      <div key={item.id}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", opacity:item.actif?1:0.4, borderBottom:"1px solid #F8F7F6" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#F8F7F6"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{ flex:1, fontSize:13, color:"#1a1a2e" }}>{item.libelle}</span>
                        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                          <button onClick={()=>toggleAvg(item)} disabled={togglingAvg===item.id}
                            style={{ width:26, height:26, borderRadius:6, border:"none", cursor:"pointer", background:item.actif?"rgba(5,150,105,0.08)":"rgba(156,163,175,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {togglingAvg===item.id ? <Loader2 size={10} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/> : <div style={{ width:7, height:7, borderRadius:"50%", background:item.actif?"#059669":"#C5BFBB" }}/>}
                          </button>
                          <button onClick={()=>{ setAvgEdit(item); setAvgError(""); setAvgModal(true); }}
                            style={{ width:26, height:26, borderRadius:6, border:"none", cursor:"pointer", background:"rgba(54,111,227,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <Pencil size={10} style={{color:"#366FE3"}}/>
                          </button>
                          <button onClick={()=>deleteAvg(item.id)} disabled={deletingAvg===item.id}
                            style={{ width:26, height:26, borderRadius:6, border:"none", cursor:"pointer", background:"rgba(220,38,38,0.07)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {deletingAvg===item.id ? <Loader2 size={10} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/> : <Trash2 size={10} style={{color:"#dc2626"}}/>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:"10px 14px", borderTop:"1px solid #F2F0EF" }}>
                    <button onClick={()=>{ setAvgEdit(null); setAvgCatId(cat.id); setAvgError(""); setAvgModal(true); }}
                      style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"7px 12px", borderRadius:8, border:"2px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.color="#ca631f"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
                      <Plus size={12}/> Ajouter un avantage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Section Avantages & incitations */}
      {sectionOnglet==="avantages" && <AvantagesReferentiel/>}

      {/* Modals */}
      <EditModal open={catModal} onClose={()=>setCatModal(false)} title={catEdit?"Modifier la catégorie":"Nouvelle catégorie"} libelle={catEdit?.libelle||""} onSave={saveCat} saving={catSaving} error={catError}/>
      <EditModal open={avgModal} onClose={()=>setAvgModal(false)} title={avgEdit?"Modifier l'avantage":"Nouvel avantage"} libelle={avgEdit?.libelle||""} onSave={saveAvg} saving={avgSaving} error={avgError}/>
    </div>
  );
}
