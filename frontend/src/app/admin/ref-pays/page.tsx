"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Globe, Loader2, Pencil,
  Plus, Search, Trash2, Users, X, Check, AlertTriangle
} from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Styles partagés ────────────────────────────────────────────────────────────
const IS: any = { background:"var(--carte-douce)", border:"1px solid var(--bordure-forte)", borderRadius:9, padding:"9px 12px", fontSize:13, color:"var(--encre)", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:10.5, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:6, display:"block" };
const BTN_P: any = { display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)" };
const BTN_S: any = { display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" };

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
function Badge({ label, color="var(--gris)" }: { label:string; color?:string }) {
  return (
    <span style={{ fontSize:10.5, fontWeight:700, color, background:`${color}12`, padding:"3px 10px", borderRadius:999, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

function Confirm({ msg, onOui, onNon }: { msg:string; onOui:()=>void; onNon:()=>void }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onNon(); }} style={{ position:"fixed" as const, inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--carte)", borderRadius:20, maxWidth:420, width:"100%", overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--danger-action)", flexShrink:0 }} />
        <div style={{ padding:"24px 28px 20px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
            <span style={{ width:34, height:34, borderRadius:"50%", background:"rgb(var(--danger-rgb) / 0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <AlertTriangle size={16} style={{ color:"var(--danger)" }} />
            </span>
            <p style={{ fontSize:13.5, color:"var(--encre)", lineHeight:1.65 }}>{msg}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)" }}>
          <button onClick={onNon} style={BTN_S}>Annuler</button>
          <button onClick={onOui} style={{ ...BTN_P, background:"var(--danger-action)", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)" }}>Supprimer</button>
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
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed" as const, inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:640, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--bleu-action)", flexShrink:0 }} />

        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", lineHeight:1.3 }}>{edit?"Modifier le pays":"Nouveau pays"}</h2>
          <button onClick={onClose}
            style={{ background:"var(--champ)", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)" />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={LS}>Nom français *</label>
              <input value={form.nom_fr||""} onChange={e=>upd("nom_fr",e.target.value)} style={IS} placeholder="ex: Sénégal" />
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

          <div style={{ display:"flex", gap:20 }}>
            {[["est_industrialise","Économie industrialisée"],["est_emergent","Économie émergente"],["actif","Pays actif"]].map(([k,l])=>(
              <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"var(--encre)" }}>
                <input type="checkbox" checked={!!form[k]} onChange={e=>upd(k,e.target.checked)} style={{ width:14, height:14, accentColor:"var(--bleu)" }} />
                {l}
              </label>
            ))}
          </div>

          {error && <p style={{ fontSize:12, color:"var(--danger)", marginTop:14 }}>{error}</p>}
        </div>

        {/* Pied */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", flexShrink:0 }}>
          <button onClick={onClose} style={BTN_S}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={BTN_P}>
            {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />}
            {edit?"Enregistrer":"Créer"}
          </button>
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
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed" as const, inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:520, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--orange-action)", flexShrink:0 }} />

        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", lineHeight:1.3 }}>{edit?"Modifier le groupement":"Nouveau groupement"}</h2>
          <button onClick={onClose}
            style={{ background:"var(--champ)", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)" />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{...LS, color:"var(--orange)"}}>Code *</label>
              <input value={form.code} onChange={e=>upd("code",e.target.value.toUpperCase())} style={IS} placeholder="ex: CEDEAO" />
            </div>
            <div>
              <label style={{...LS, color:"var(--orange)"}}>Nom français *</label>
              <input value={form.nom_fr} onChange={e=>upd("nom_fr",e.target.value)} style={IS} placeholder="ex: Communauté économique..." />
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{...LS, color:"var(--orange)"}}>Nom anglais</label>
            <input value={form.nom_en} onChange={e=>upd("nom_en",e.target.value)} style={IS} />
          </div>
          <div>
            <label style={{...LS, color:"var(--orange)"}}>Description</label>
            <textarea value={form.description} onChange={e=>upd("description",e.target.value)} rows={3} style={{...IS, resize:"vertical" as const}} />
          </div>
          {error && <p style={{ fontSize:12, color:"var(--danger)", marginTop:12 }}>{error}</p>}
        </div>

        {/* Pied */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", flexShrink:0 }}>
          <button onClick={onClose} style={BTN_S}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ ...BTN_P, background:"var(--orange-action)", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)" }}>
            {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : <Check size={13} />}
            {edit?"Enregistrer":"Créer"}
          </button>
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
  // Les codes ISO sont facultatifs dans ref_pays : un partenaire créé
  // automatiquement à l'import n'en porte pas tant qu'il n'a pas été arbitré.
  // Sans ce garde-fou, un seul de ces pays fait tomber tout le panneau.
  const contient = (v: string|null|undefined, q: string) => (v ?? "").toLowerCase().includes(q);
  const q = search.toLowerCase();
  const disponibles = allPays.filter((p:any) => !membreIds.has(p.id) &&
    (search === "" || contient(p.nom_fr, q) || contient(p.code_iso3, q) || contient(p.code_iso2, q))
  );

  const handleAjouter = async (pays_id: number) => {
    setAdding(pays_id);
    await fetch(`${API}/ref-pays/groupements/${grp.id}/membres`, { method:"POST", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({ pays_id }) });
    await charger(); setAdding(null); onChanged();
  };

  const handleRetirer = async (pays_id: number) => {
    setRemoving(pays_id);
    await fetch(`${API}/ref-pays/groupements/${grp.id}/membres/${pays_id}`, { method:"DELETE", headers:await authHeaders() });
    await charger(); setRemoving(null); onChanged();
  };

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed" as const, inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:800, maxHeight:"90vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--orange-action)", flexShrink:0 }} />
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", lineHeight:1.3 }}>{grp.nom_fr}</h2>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const, marginTop:8 }}>
              <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"var(--orange)", background:"rgb(var(--orange-rgb) / 0.08)", padding:"3px 10px", borderRadius:999 }}>{grp.code}</span>
              <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{membres.length} membre{membres.length>1?"s":""}</span>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"var(--champ)", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)" />
          </button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", flex:1, minHeight:0, overflow:"hidden", height:500 }}>
          {/* Membres actuels */}
          <div style={{ borderRight:"1px solid var(--bordure)", padding:"16px 20px", display:"flex", flexDirection:"column" as const, gap:10, overflow:"hidden" }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", textTransform:"uppercase" as const, letterSpacing:"0.14em", flexShrink:0 }}>Membres actuels</p>
            <div style={{ overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:4, maxHeight:420 }}>
              {membres.map(m=>(
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", background:"var(--carte-douce)", borderRadius:9, border:"1px solid var(--bordure)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <span style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"2px 8px", borderRadius:999, flexShrink:0 }}>{m.code_iso3}</span>
                    <span style={{ fontSize:13, color:"var(--encre)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{m.nom_fr}</span>
                  </div>
                  <button onClick={()=>handleRetirer(m.id)} disabled={removing===m.id}
                    style={{ background:"rgb(var(--danger-rgb) / 0.08)", border:"1px solid rgb(var(--danger-rgb) / 0.20)", cursor:"pointer", borderRadius:999, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
                    onMouseEnter={ev=>(ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.15)")}
                    onMouseLeave={ev=>(ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.08)")}>
                    {removing===m.id ? <Loader2 size={11} style={{color:"var(--danger)",animation:"spin 1s linear infinite"}}/> : <X size={11} style={{color:"var(--danger)"}} />}
                  </button>
                </div>
              ))}
              {membres.length===0 && <p style={{ fontSize:13, color:"var(--gris)", textAlign:"center" as const, padding:"20px 0" }}>Aucun membre</p>}
            </div>
          </div>

          {/* Ajouter des pays */}
          <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column" as const, gap:10, overflow:"hidden" }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", textTransform:"uppercase" as const, letterSpacing:"0.14em", flexShrink:0 }}>Ajouter des pays</p>
            <div style={{ flexShrink:0 }}>
              <div style={{ position:"relative" as const }}>
                <Search size={12} style={{ position:"absolute" as const, left:10, top:"50%", transform:"translateY(-50%)", color:"var(--gris)" }} />
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" style={{...IS, paddingLeft:28, fontSize:12}} />
              </div>
            </div>
            <div style={{ overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:4, maxHeight:370 }}>
              {disponibles.map((p:any)=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", background:"var(--carte-douce)", borderRadius:9, border:"1px solid var(--bordure)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <span style={{ fontSize:10.5, fontWeight:700, color:"var(--texte)", background:"var(--fond-creux2)", padding:"2px 8px", borderRadius:999, flexShrink:0 }}>{p.code_iso3}</span>
                    <span style={{ fontSize:13, color:"var(--encre)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom_fr}</span>
                  </div>
                  <button onClick={()=>handleAjouter(p.id)} disabled={adding===p.id}
                    style={{ background:"rgb(var(--bleu-rgb) / 0.07)", border:"1px solid rgb(var(--bleu-rgb) / 0.18)", cursor:"pointer", borderRadius:999, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
                    onMouseEnter={ev=>(ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.13)")}
                    onMouseLeave={ev=>(ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.07)")}>
                    {adding===p.id ? <Loader2 size={11} style={{color:"var(--bleu)",animation:"spin 1s linear infinite"}}/> : <Plus size={11} style={{color:"var(--bleu)"}} />}
                  </button>
                </div>
              ))}
              {disponibles.length===0 && <p style={{ fontSize:13, color:"var(--gris)", textAlign:"center" as const, padding:"20px 0" }}>Tous les pays sont membres</p>}
            </div>
          </div>
        </div>

        {/* Pied */}
        <div style={{ display:"flex", justifyContent:"flex-end", padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", flexShrink:0 }}>
          <button onClick={onClose} style={BTN_S}>Fermer</button>
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
        const res = await fetch(`${API}/ref-pays/${p.id}`, { method:"DELETE", headers:await authHeaders() });
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
        await fetch(`${API}/ref-pays/groupements/${g.id}`, { method:"DELETE", headers:await authHeaders() });
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
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}
        @keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:8 }}>
        <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"var(--encre)" }}>Référentiel Pays &amp; Groupements</h1>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--carte)", borderBottom:"1px solid var(--bordure-forte)", marginBottom:24 }}>
        <div style={{ display:"flex" }}>
          {([["pays","Pays"],["groupements","Groupements"]] as const).map(([key,label])=>{
            const actif = onglet===key;
            const count = key==="pays"?pays.length:grps.length;
            return (
            <button key={key} onClick={()=>setOnglet(key)}
              style={{ display:"flex", alignItems:"center", padding:"14px 22px", border:"none", borderBottom:`2px solid ${actif?"var(--bleu)":"transparent"}`, background:"transparent", color:actif?"var(--bleu)":"var(--gris)", fontWeight:600, cursor:"pointer", fontSize:13, transition:"all 0.15s", fontFamily:"var(--font-google-sans)" }}>
              {key==="pays"?<Globe size={13} style={{ marginRight:7 }}/>:<Users size={13} style={{ marginRight:7 }}/>} {label}
              {count>0 && <span style={{ marginLeft:7, fontSize:11, fontWeight:700, color:actif?"var(--bleu)":"var(--gris)", background:actif?"rgb(var(--bleu-rgb) / 0.1)":"var(--fond)", padding:"1px 7px", borderRadius:999 }}>{count}</span>}
            </button>
            );
          })}
        </div>
        <button
          onClick={()=>{ if(onglet==="pays"){ setEditPays(null); setModalPays(true); } else { setEditGrp(null); setModalGrp(true); } }}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgb(var(--ombre-rgb) / 0.3)", marginBottom:4, fontFamily:"var(--font-google-sans)" }}>
          <Plus size={15} /> {onglet==="pays"?"Nouveau pays":"Nouveau groupement"}
        </button>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"var(--gris)", animation:"spin 1s linear infinite" }} />
        </div>
      ) : onglet === "pays" ? (

        // ── ONGLET PAYS ─────────────────────────────────────────────────────
        <div>
          {/* Filtres */}
          <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" as const, alignItems:"center" }}>
            <div style={{ position:"relative" as const, flex:"1 1 240px" }}>
              <Search size={13} style={{ position:"absolute" as const, left:11, top:"50%", transform:"translateY(-50%)", color:"var(--gris)" }} />
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
              <button onClick={()=>{ setSearch(""); setFiltCont(""); setFiltRegion(""); }} title="Tout réinitialiser"
                style={{ background:"rgb(var(--danger-rgb) / 0.08)", border:"1px solid rgb(var(--danger-rgb) / 0.20)", cursor:"pointer", borderRadius:999, padding:"7px", display:"flex", alignItems:"center", transition:"background 0.15s", flexShrink:0 }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.15)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.08)";}}>
                <X size={15} style={{ color:"var(--danger)" }} />
              </button>
            )}
          </div>

          {/* Tableau */}
          <div style={{ background:"var(--carte)", borderRadius:14, border:"1px solid var(--bordure)", overflow:"hidden", boxShadow:"var(--ombre-1)" }}>
            <div style={{ height:3, background:"linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu-action) 60%,var(--bleu-clair) 100%)" }} />
            <table style={{ width:"100%", borderCollapse:"collapse" as const }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--bordure)" }}>
                  {["ISO","Pays","Continent","Région","Revenu","Statut","Actions"].map(h=>(
                    <th key={h} style={{ padding:"12px 14px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"var(--texte)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pays.map(p=>(
                  <tr key={p.id} style={{ borderBottom:"1px solid var(--filet)", transition:"background 0.12s" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--carte-douce)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{p.code_iso3}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--encre)" }}>{p.nom_fr}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:12, color:"var(--texte)" }}>{p.continent||"—"}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:12, color:"var(--texte)" }}>{p.region_geo||"—"}</span>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      {p.niveau_revenu ? <Badge label={p.niveau_revenu} color={REVENU_COLOR[p.niveau_revenu]||"var(--gris)"} /> : <span style={{ color:"var(--gris)", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        {p.est_industrialise && <Badge label="Industrialisé" color="var(--bleu)" />}
                        {p.est_emergent      && <Badge label="Émergent"      color="var(--vert)" />}
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={()=>{ setEditPays(p); setModalPays(true); }} title="Modifier"
                          style={{ background:"rgb(var(--bleu-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:999, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}
                          onMouseEnter={e=>(e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.13)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.07)")}>
                          <Pencil size={12} style={{ color:"var(--bleu)" }} />
                        </button>
                        <button onClick={()=>handleDeletePays(p)} title="Supprimer"
                          style={{ background:"rgb(var(--danger-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:999, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}
                          onMouseEnter={e=>(e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.13)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.07)")}>
                          <Trash2 size={12} style={{ color:"var(--danger)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pays.length===0 && <p style={{ textAlign:"center" as const, padding:"40px 0", color:"var(--gris)", fontSize:14 }}>Aucun pays trouvé</p>}
          </div>
          <p style={{ fontSize:12, color:"var(--gris)", marginTop:10 }}>{pays.length} pays affichés</p>
        </div>

      ) : (

        // ── ONGLET GROUPEMENTS ────────────────────────────────────────────────
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:14 }}>
          {grps.map(g=>(
            <div key={g.id} style={{ background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:14, boxShadow:"var(--ombre-1)", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", display:"flex", flexDirection:"column" as const, overflow:"hidden" }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow="var(--ombre-2)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgb(var(--orange-rgb) / 0.25)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow="var(--ombre-1)"; e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor="var(--bordure)"; }}>
              <div style={{ height:3, background:"linear-gradient(90deg,var(--orange-action) 0%,var(--orange-action) 60%,var(--orange-action) 100%)", flexShrink:0 }} />
              <div style={{ padding:"14px 16px 14px", flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:12 }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:10.5, fontWeight:700, color:"var(--orange)", background:"rgb(var(--orange-rgb) / 0.08)", padding:"3px 10px", borderRadius:999, whiteSpace:"nowrap" as const }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--orange-action)", ["--pc" as any]:"rgb(var(--orange-rgb) / 0.4)", animation:"pulseDotC 1.6s ease-out infinite", flexShrink:0 }}/>
                    {g.code}
                  </span>
                  <span style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999, whiteSpace:"nowrap" as const, flexShrink:0 }}>{g.nb_pays} pays</span>
                </div>
                <p style={{ fontWeight:700, fontSize:13.5, color:"var(--encre)", lineHeight:1.35 }}>{g.nom_fr}</p>
                {g.nom_en && <p style={{ fontSize:11, color:"var(--gris)", marginTop:2 }}>{g.nom_en}</p>}
                {g.description && (
                  <div style={{ background:"rgb(var(--orange-rgb) / 0.04)", border:"1px solid rgb(var(--orange-rgb) / 0.12)", borderRadius:10, padding:"8px 11px", marginTop:10 }}>
                    <p style={{ fontSize:12, color:"var(--texte)", lineHeight:1.5 }}>{g.description}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid var(--bordure)" }}>
                <button onClick={()=>{ setEditGrp(g); setModalGrp(true); }}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--bleu)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  <Pencil size={12}/> Modifier
                </button>
                <div style={{ width:1, background:"var(--fond)" }}/>
                <button onClick={()=>setPanelGrp(g)}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--vert)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--vert-rgb) / 0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  <Users size={12}/> Membres ({g.nb_pays})
                </button>
                <div style={{ width:1, background:"var(--fond)" }}/>
                <button onClick={()=>handleDeleteGrp(g)}
                  style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  <Trash2 size={12} style={{ color:"var(--danger)" }} />
                </button>
              </div>
            </div>
          ))}
          {grps.length===0 && <p style={{ color:"var(--gris)", fontSize:14, gridColumn:"1/-1", textAlign:"center" as const, padding:"40px 0" }}>Aucun groupement</p>}
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
