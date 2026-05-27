"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown, ChevronRight, Edit2, Globe, Loader2,
  Plus, Search, Shield, Trash2, Users, X, Check, AlertTriangle
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Styles partagés ────────────────────────────────────────────────────────────
const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:11, fontWeight:700, color:"#4a5568", marginBottom:5, display:"block", textTransform:"uppercase" as const, letterSpacing:"0.08em" };
const BTN_P: any = { display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"none", background:"#1a1a2e", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 };
const BTN_S: any = { display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 };

const CONTINENTS  = ["Afrique","Amérique","Asie","Europe","Océanie"];
const NIVEAUX     = ["Revenu élevé","Revenu intermédiaire supérieur","Revenu intermédiaire inférieur","Revenu faible","Non classifié"];
const REVENU_COLOR: Record<string,string> = {
  "Revenu élevé":"#004f91",
  "Revenu intermédiaire supérieur":"#188038",
  "Revenu intermédiaire inférieur":"#ca631f",
  "Revenu faible":"#dc2626",
  "Non classifié":"#9aa5b4",
};

// ── Composants utilitaires ─────────────────────────────────────────────────────
function Badge({ label, color="#9aa5b4" }: { label:string; color?:string }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, color, background:`${color}15`, border:`1px solid ${color}30`, padding:"2px 7px", borderRadius:999, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

function Confirm({ msg, onOui, onNon }: { msg:string; onOui:()=>void; onNon:()=>void }) {
  return (
    <div style={{ position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.5)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 32px", maxWidth:420, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:20 }}>
          <AlertTriangle size={22} style={{ color:"#ca631f", flexShrink:0, marginTop:2 }} />
          <p style={{ fontSize:14, color:"#1a1a2e", lineHeight:1.6 }}>{msg}</p>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onNon} style={BTN_S}>Annuler</button>
          <button onClick={onOui} style={{ ...BTN_P, background:"#dc2626" }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Pays ─────────────────────────────────────────────────────────────────
function ModalPays({ open, onClose, edit, meta, onSaved }: any) {
  const vide = { code_iso2:"", code_iso3:"", nom_fr:"", continent:"", region_geo:"", niveau_revenu:"", est_industrialise:false, est_emergent:false, nom_cnuced:"", actif:true };
  const [form, setForm]   = useState<any>(vide);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const upd = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));

  const regionsDisponibles = meta?.regions_geo?.filter((r:string) => {
    if (!form.continent) return true;
    const map: Record<string,string[]> = {
      Afrique:  ["Afrique australe","Afrique centrale","Afrique occidentale","Afrique orientale","Afrique septentrionale"],
      Amérique: ["Amérique du Nord","Amérique centrale","Amérique du Sud","Caraïbes"],
      Asie:     ["Asie centrale","Asie du Sud-Est","Asie méridionale","Asie occidentale","Asie orientale"],
      Europe:   ["Europe méridionale","Europe occidentale","Europe orientale","Europe septentrionale"],
      Océanie:  ["Océanie"],
    };
    return (map[form.continent]||[]).includes(r);
  }) || [];

  useEffect(() => {
    if (!open) return;
    setForm(edit ? { ...vide, ...edit } : vide);
    setError("");
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.nom_fr?.trim()) { setError("Le nom est obligatoire"); return; }
    if (!form.code_iso3?.trim()) { setError("Le code ISO3 est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const url    = edit ? `${API}/ref-pays/${edit.id}` : `${API}/ref-pays`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      onSaved(); onClose();
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:18, width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto" as const, border:"1px solid #E8E5E3", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#1a1a2e,#004f91)", borderRadius:"18px 18px 0 0" }} />
        <div style={{ padding:"24px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{edit?"Modifier le pays":"Nouveau pays"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568" /></button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={LS}>Nom français *</label>
              <input value={form.nom_fr||""} onChange={e=>upd("nom_fr",e.target.value)} style={{...IS, gridColumn:"1/-1"}} placeholder="ex: Sénégal" />
            </div>
            <div>
              <label style={LS}>Code ISO2</label>
              <input value={form.code_iso2||""} onChange={e=>upd("code_iso2",e.target.value.toUpperCase().slice(0,2))} style={IS} placeholder="SN" />
            </div>
            <div>
              <label style={LS}>Code ISO3 *</label>
              <input value={form.code_iso3||""} onChange={e=>upd("code_iso3",e.target.value.toUpperCase().slice(0,3))} style={IS} placeholder="SEN" />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={LS}>Continent</label>
              <select value={form.continent||""} onChange={e=>{ upd("continent",e.target.value); upd("region_geo",""); }} style={IS}>
                <option value="">— Sélectionner —</option>
                {CONTINENTS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={LS}>Région géographique</label>
              <select value={form.region_geo||""} onChange={e=>upd("region_geo",e.target.value)} style={IS}>
                <option value="">— Sélectionner —</option>
                {regionsDisponibles.map((r:string)=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={LS}>Niveau de revenu</label>
            <select value={form.niveau_revenu||""} onChange={e=>upd("niveau_revenu",e.target.value)} style={IS}>
              <option value="">— Sélectionner —</option>
              {NIVEAUX.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={LS}>Nom CNUCED (pour import données)</label>
            <input value={form.nom_cnuced||""} onChange={e=>upd("nom_cnuced",e.target.value)} style={IS} placeholder="ex: Senegal (tel qu'il apparaît dans les CSV CNUCED)" />
          </div>

          <div style={{ display:"flex", gap:20, marginBottom:18 }}>
            {[["est_industrialise","Économie industrialisée"],["est_emergent","Économie émergente"],["actif","Pays actif"]].map(([k,l])=>(
              <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"#1a1a2e" }}>
                <input type="checkbox" checked={!!form[k]} onChange={e=>upd(k,e.target.checked)} style={{ width:14, height:14 }} />
                {l}
              </label>
            ))}
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={BTN_S}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={BTN_P}>
              {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />}
              {edit?"Enregistrer":"Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Groupement ──────────────────────────────────────────────────────────
function ModalGroupement({ open, onClose, edit, onSaved }: any) {
  const [form, setForm]   = useState({ code:"", nom_fr:"", nom_en:"", description:"" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const upd = (k:string, v:string) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!open) return;
    setForm(edit ? { code:edit.code||"", nom_fr:edit.nom_fr||"", nom_en:edit.nom_en||"", description:edit.description||"" } : { code:"", nom_fr:"", nom_en:"", description:"" });
    setError("");
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.code?.trim() || !form.nom_fr?.trim()) { setError("Code et nom obligatoires"); return; }
    setSaving(true); setError("");
    try {
      const url    = edit ? `${API}/ref-pays/groupements/${edit.id}` : `${API}/ref-pays/groupements`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      onSaved(); onClose();
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:18, width:"100%", maxWidth:520, border:"1px solid #E8E5E3", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"18px 18px 0 0" }} />
        <div style={{ padding:"24px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{edit?"Modifier le groupement":"Nouveau groupement"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568" /></button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={LS}>Code *</label>
              <input value={form.code} onChange={e=>upd("code",e.target.value.toUpperCase())} style={IS} placeholder="ex: CEDEAO" />
            </div>
            <div>
              <label style={LS}>Nom français *</label>
              <input value={form.nom_fr} onChange={e=>upd("nom_fr",e.target.value)} style={IS} placeholder="ex: Communauté économique..." />
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={LS}>Nom anglais</label>
            <input value={form.nom_en} onChange={e=>upd("nom_en",e.target.value)} style={IS} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={LS}>Description</label>
            <textarea value={form.description} onChange={e=>upd("description",e.target.value)} rows={3} style={{...IS, resize:"vertical" as const}} />
          </div>
          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={BTN_S}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{ ...BTN_P, background:"#ca631f" }}>
              {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />}
              {edit?"Enregistrer":"Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel membres groupement ───────────────────────────────────────────────────
function PanelMembres({ grp, onClose, allPays, onChanged }: any) {
  const [membres, setMembres] = useState<any[]>([]);
  const [search,  setSearch]  = useState("");
  const [adding,  setAdding]  = useState<number|null>(null);
  const [removing,setRemoving]= useState<number|null>(null);

  const charger = useCallback(async () => {
    const res = await fetch(`${API}/ref-pays/groupements/${grp.id}/membres`);
    setMembres(await res.json());
  }, [grp.id]);

  useEffect(() => { charger(); }, [charger]);

  const membreIds = new Set(membres.map(m=>m.id));
  const disponibles = allPays.filter((p:any) => !membreIds.has(p.id) &&
    (search === "" || p.nom_fr.toLowerCase().includes(search.toLowerCase()) || p.code_iso3.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAjouter = async (pays_id: number) => {
    setAdding(pays_id);
    await fetch(`${API}/ref-pays/groupements/${grp.id}/membres`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ pays_id }) });
    await charger(); setAdding(null); onChanged();
  };

  const handleRetirer = async (pays_id: number) => {
    setRemoving(pays_id);
    await fetch(`${API}/ref-pays/groupements/${grp.id}/membres/${pays_id}`, { method:"DELETE" });
    await charger(); setRemoving(null); onChanged();
  };

  return (
    <div style={{ position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:18, width:"100%", maxWidth:800, maxHeight:"90vh", display:"flex", flexDirection:"column" as const, border:"1px solid #E8E5E3", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#004f91,#1a6ab0)", borderRadius:"18px 18px 0 0" }} />
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #E8E5E3", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ fontWeight:800, fontSize:"1rem", color:"#1a1a2e" }}>{grp.code} — {grp.nom_fr}</h2>
            <p style={{ fontSize:12, color:"#9aa5b4", marginTop:3 }}>{membres.length} membre{membres.length>1?"s":""}</p>
          </div>
          <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568" /></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", flex:1, minHeight:0, overflow:"hidden", height:500 }}>
          {/* Membres actuels */}
          <div style={{ borderRight:"1px solid #E8E5E3", padding:"16px 18px", display:"flex", flexDirection:"column" as const, gap:10, overflow:"hidden" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", flexShrink:0 }}>Membres actuels</p>
            <div style={{ overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:4, maxHeight:420 }}>
              {membres.map(m=>(
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", background:"#fff", borderRadius:8, border:"1px solid #E8E5E3" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"1px 6px", borderRadius:4 }}>{m.code_iso3}</span>
                    <span style={{ fontSize:13, color:"#1a1a2e" }}>{m.nom_fr}</span>
                  </div>
                  <button onClick={()=>handleRetirer(m.id)} disabled={removing===m.id}
                    style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"3px 7px" }}>
                    {removing===m.id ? <Loader2 size={11} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/> : <X size={11} style={{color:"#dc2626"}} />}
                  </button>
                </div>
              ))}
              {membres.length===0 && <p style={{ fontSize:13, color:"#9aa5b4", textAlign:"center" as const, padding:"20px 0" }}>Aucun membre</p>}
            </div>
          </div>

          {/* Ajouter des pays */}
          <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column" as const, gap:10, overflow:"hidden" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", flexShrink:0 }}>Ajouter des pays</p>
            <div style={{ flexShrink:0 }}>
              <div style={{ position:"relative" as const }}>
                <Search size={12} style={{ position:"absolute" as const, left:10, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" style={{...IS, paddingLeft:28, fontSize:12}} />
              </div>
            </div>
            <div style={{ overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:4, maxHeight:370 }}>
              {disponibles.map((p:any)=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", background:"#fff", borderRadius:8, border:"1px solid #E8E5E3" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#4a5568", background:"#F2F0EF", padding:"1px 6px", borderRadius:4 }}>{p.code_iso3}</span>
                    <span style={{ fontSize:13, color:"#1a1a2e" }}>{p.nom_fr}</span>
                  </div>
                  <button onClick={()=>handleAjouter(p.id)} disabled={adding===p.id}
                    style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"3px 7px" }}>
                    {adding===p.id ? <Loader2 size={11} style={{color:"#004f91",animation:"spin 1s linear infinite"}}/> : <Plus size={11} style={{color:"#004f91"}} />}
                  </button>
                </div>
              ))}
              {disponibles.length===0 && <p style={{ fontSize:13, color:"#9aa5b4", textAlign:"center" as const, padding:"20px 0" }}>Tous les pays sont membres</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function RefPaysPage() {
  const [onglet,  setOnglet]  = useState<"pays"|"groupements">("pays");
  const [pays,    setPays]    = useState<any[]>([]);
  const [grps,    setGrps]    = useState<any[]>([]);
  const [meta,    setMeta]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filtres pays
  const [search,     setSearch]     = useState("");
  const [filtCont,   setFiltCont]   = useState("");
  const [filtRegion, setFiltRegion] = useState("");

  // Modals
  const [modalPays,  setModalPays]  = useState(false);
  const [editPays,   setEditPays]   = useState<any>(null);
  const [modalGrp,   setModalGrp]   = useState(false);
  const [editGrp,    setEditGrp]    = useState<any>(null);
  const [panelGrp,   setPanelGrp]   = useState<any>(null);
  const [confirm,    setConfirm]    = useState<any>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)     params.set("q", search);
      if (filtCont)   params.set("continent", filtCont);
      if (filtRegion) params.set("region_geo", filtRegion);
      const [pR, gR, mR] = await Promise.all([
        fetch(`${API}/ref-pays?${params}`).then(r=>r.json()),
        fetch(`${API}/ref-pays/groupements/liste`).then(r=>r.json()),
        fetch(`${API}/ref-pays/meta`).then(r=>r.json()),
      ]);
      setPays(pR||[]); setGrps(gR||[]); setMeta(mR);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [search, filtCont, filtRegion]);

  useEffect(() => { charger(); }, [charger]);

  const handleDeletePays = async (p: any) => {
    setConfirm({
      msg: `Supprimer le pays "${p.nom_fr}" (${p.code_iso3}) ? Cette action est irréversible.`,
      onOui: async () => {
        setConfirm(null);
        const res = await fetch(`${API}/ref-pays/${p.id}`, { method:"DELETE" });
        if (!res.ok) {
          const d = await res.json();
          alert(d.detail || "Impossible de supprimer ce pays.");
        } else { charger(); }
      },
      onNon: ()=>setConfirm(null)
    });
  };

  const handleDeleteGrp = async (g: any) => {
    setConfirm({
      msg: `Supprimer le groupement "${g.nom_fr}" et ses ${g.nb_pays} liaison(s) ? Action irréversible.`,
      onOui: async () => {
        setConfirm(null);
        await fetch(`${API}/ref-pays/groupements/${g.id}`, { method:"DELETE" });
        charger();
      },
      onNon: ()=>setConfirm(null)
    });
  };

  // Régions filtrées selon continent sélectionné
  const regionsFiltrees = meta?.regions_geo?.filter((r:string) => {
    if (!filtCont) return true;
    const map: Record<string,string[]> = {
      Afrique:  ["Afrique australe","Afrique centrale","Afrique occidentale","Afrique orientale","Afrique septentrionale"],
      Amérique: ["Amérique du Nord","Amérique centrale","Amérique du Sud","Caraïbes"],
      Asie:     ["Asie centrale","Asie du Sud-Est","Asie méridionale","Asie occidentale","Asie orientale"],
      Europe:   ["Europe méridionale","Europe occidentale","Europe orientale","Europe septentrionale"],
      Océanie:  ["Océanie"],
    };
    return (map[filtCont]||[]).includes(r);
  }) || [];

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase" as const, marginBottom:4 }}>Administration</p>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Référentiel Pays & Groupements</h1>
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>
            {pays.length} pays · {grps.length} groupements
          </p>
        </div>
        <button
          onClick={()=>{ if(onglet==="pays"){ setEditPays(null); setModalPays(true); } else { setEditGrp(null); setModalGrp(true); } }}
          style={{ ...BTN_P, background: onglet==="pays"?"#1a1a2e":"#ca631f", boxShadow:`0 4px 14px rgba(0,0,0,0.15)` }}>
          <Plus size={14} /> {onglet==="pays"?"Nouveau pays":"Nouveau groupement"}
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", gap:2, background:"rgba(0,0,0,0.04)", borderRadius:10, padding:3, width:"fit-content", marginBottom:24, border:"1px solid #E8E5E3" }}>
        {([["pays","Pays","globe"],["groupements","Groupements","users"]] as const).map(([v,l,icon])=>(
          <button key={v} onClick={()=>setOnglet(v)}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 20px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s", background:onglet===v?"#1a1a2e":"transparent", color:onglet===v?"#fff":"#4a5568" }}>
            {v==="pays"?<Globe size={13}/>:<Users size={13}/>} {l}
            <span style={{ fontSize:11, background:onglet===v?"rgba(255,255,255,0.2)":"#E8E5E3", color:onglet===v?"#fff":"#4a5568", padding:"1px 7px", borderRadius:999 }}>
              {v==="pays"?pays.length:grps.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : onglet === "pays" ? (

        // ── ONGLET PAYS ─────────────────────────────────────────────────────
        <div>
          {/* Filtres */}
          <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" as const }}>
            <div style={{ position:"relative" as const, flex:"1 1 240px" }}>
              <Search size={13} style={{ position:"absolute" as const, left:11, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom ou code ISO…" style={{...IS, paddingLeft:32}} />
            </div>
            <select value={filtCont} onChange={e=>{ setFiltCont(e.target.value); setFiltRegion(""); }} style={{...IS, width:"auto", minWidth:150}}>
              <option value="">Tous les continents</option>
              {CONTINENTS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtRegion} onChange={e=>setFiltRegion(e.target.value)} style={{...IS, width:"auto", minWidth:200}} disabled={!filtCont}>
              <option value="">Toutes les régions</option>
              {regionsFiltrees.map((r:string)=><option key={r} value={r}>{r}</option>)}
            </select>
            {(search||filtCont||filtRegion) && (
              <button onClick={()=>{ setSearch(""); setFiltCont(""); setFiltRegion(""); }} style={BTN_S}>
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>

          {/* Tableau */}
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E8E5E3", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
              <thead>
                <tr style={{ borderBottom:"2px solid #F2F0EF" }}>
                  {["ISO","Pays","Continent","Région","Revenu","Statut","Actions"].map(h=>(
                    <th key={h} style={{ padding:"11px 14px", textAlign:"left" as const, fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pays.map((p,i)=>(
                  <tr key={p.id} style={{ borderBottom:"1px solid #F8F7F6", background:i%2===0?"#fff":"#FAFAF9" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="#F2F0EF")}
                    onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?"#fff":"#FAFAF9")}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:5 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 6px", borderRadius:4 }}>{p.code_iso2}</span>
                        <span style={{ fontSize:10, fontWeight:700, color:"#1a1a2e", background:"#F2F0EF", padding:"2px 6px", borderRadius:4 }}>{p.code_iso3}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{p.nom_fr}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:12, color:"#4a5568" }}>{p.continent||"—"}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:12, color:"#4a5568" }}>{p.region_geo||"—"}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      {p.niveau_revenu ? <Badge label={p.niveau_revenu} color={REVENU_COLOR[p.niveau_revenu]||"#9aa5b4"} /> : <span style={{ color:"#C5BFBB", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        {p.est_industrialise && <Badge label="Industrialisé" color="#004f91" />}
                        {p.est_emergent      && <Badge label="Émergent"      color="#188038" />}
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={()=>{ setEditPays(p); setModalPays(true); }}
                          style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"5px 7px" }}>
                          <Edit2 size={12} style={{ color:"#ca631f" }} />
                        </button>
                        <button onClick={()=>handleDeletePays(p)}
                          style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"5px 7px" }}>
                          <Trash2 size={12} style={{ color:"#dc2626" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pays.length===0 && <p style={{ textAlign:"center" as const, padding:"40px 0", color:"#9aa5b4", fontSize:14 }}>Aucun pays trouvé</p>}
          </div>
          <p style={{ fontSize:12, color:"#9aa5b4", marginTop:10 }}>{pays.length} pays affichés</p>
        </div>

      ) : (

        // ── ONGLET GROUPEMENTS ────────────────────────────────────────────────
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:14 }}>
          {grps.map(g=>(
            <div key={g.id} style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:14, padding:"18px 20px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.1)"; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:"#ca631f", background:"rgba(202,99,31,0.1)", padding:"2px 9px", borderRadius:6 }}>{g.code}</span>
                    <span style={{ fontSize:11, color:"#9aa5b4" }}>{g.nb_pays} pays</span>
                  </div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#1a1a2e", lineHeight:1.4 }}>{g.nom_fr}</p>
                  {g.nom_en && <p style={{ fontSize:11, color:"#9aa5b4", marginTop:2 }}>{g.nom_en}</p>}
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button onClick={()=>{ setEditGrp(g); setModalGrp(true); }}
                    style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"5px 7px" }}>
                    <Edit2 size={12} style={{ color:"#ca631f" }} />
                  </button>
                  <button onClick={()=>handleDeleteGrp(g)}
                    style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"5px 7px" }}>
                    <Trash2 size={12} style={{ color:"#dc2626" }} />
                  </button>
                </div>
              </div>
              {g.description && <p style={{ fontSize:12, color:"#9aa5b4", marginBottom:12, lineHeight:1.5 }}>{g.description}</p>}
              <button onClick={()=>setPanelGrp(g)}
                style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"8px 12px", borderRadius:9, border:"1.5px dashed #C5BFBB", background:"transparent", cursor:"pointer", fontSize:12, fontWeight:600, color:"#004f91", justifyContent:"center" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.background="rgba(0,79,145,0.04)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.background="transparent"; }}>
                <Users size={12} /> Gérer les membres ({g.nb_pays})
              </button>
            </div>
          ))}
          {grps.length===0 && <p style={{ color:"#9aa5b4", fontSize:14, gridColumn:"1/-1", textAlign:"center" as const, padding:"40px 0" }}>Aucun groupement</p>}
        </div>
      )}

      {/* Modals & overlays */}
      <ModalPays   open={modalPays} onClose={()=>setModalPays(false)} edit={editPays} meta={meta} onSaved={charger} />
      <ModalGroupement open={modalGrp} onClose={()=>setModalGrp(false)} edit={editGrp} onSaved={charger} />
      {panelGrp && <PanelMembres grp={panelGrp} onClose={()=>setPanelGrp(null)} allPays={pays.length?pays:[]} onChanged={charger} />}
      {confirm   && <Confirm msg={confirm.msg} onOui={confirm.onOui} onNon={confirm.onNon} />}
    </div>
  );
}
