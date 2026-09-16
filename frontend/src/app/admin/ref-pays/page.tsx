"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Pencil,
  Plus, Search, Trash2, Users, X, Check, AlertTriangle
} from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { voile } from "@/lib/couleurs";
import EnteteAdmin, { BoutonPrincipal, IconeModule } from "@/components/admin/EnteteAdmin";
import { ActionCarte, CarteAdmin, Donnee, EtatVide, STYLE_GRILLE, TexteContexte } from "@/components/admin/CarteAdmin";
import { ChampRecherche, Ligne, Segments, Tableau, TD, TH } from "@/components/admin/UIAdmin";
import { SkeletonRows } from "@/components/shared/Skeleton";

import { API_BASE as API } from "@/lib/api";

// ── Styles partagés ────────────────────────────────────────────────────────────
const IS: any = { background:"var(--carte-douce)", border:"1px solid var(--bordure-forte)", borderRadius:9, padding:"9px 12px", fontSize:13, color:"var(--encre)", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:10.5, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:6, display:"block" };
const BTN_P: any = { display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)" };
const BTN_S: any = { display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" };

const CONTINENTS  = ["Afrique","Amérique","Asie","Europe","Océanie"];
const NIVEAUX     = ["Revenu élevé","Revenu intermédiaire supérieur","Revenu intermédiaire inférieur","Revenu faible","Non classifié"];
const REVENU_COLOR: Record<string,string> = {
  "Revenu élevé":"var(--bleu)",
  "Revenu intermédiaire supérieur":"var(--vert)",
  "Revenu intermédiaire inférieur":"var(--orange)",
  "Revenu faible":"var(--danger)",
  "Non classifié":"var(--gris)",
};

// ── Composants utilitaires ─────────────────────────────────────────────────────
function Badge({ label, color="var(--gris)" }: { label:string; color?:string }) {
  return (
    <span style={{ fontSize:10.5, fontWeight:700, color, background:`${voile(color, 7)}`, padding:"3px 10px", borderRadius:999, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

/** Une action de LIGNE de tableau : un pictogramme seul, muet au repos, teinté
 *  au survol — la règle des barres d'actions des cartes, transposée là où la
 *  place manque pour un libellé.
 *
 *  ELLES ÉTAIENT DES PASTILLES COLORÉES EN PERMANENCE. Deux par ligne sur
 *  274 lignes, cela faisait cinq cent quarante-huit ronds bleus et rouges dans
 *  un tableau dont le sujet est le RÉFÉRENTIEL, pas sa maintenance. Le survol
 *  rend la couleur au moment où elle sert. */
function IconeAction({ onClick, titre, teinte, children }: {
  onClick:()=>void; titre:string; teinte:string; children:React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={titre} aria-label={titre}
      style={{ background:"transparent", border:"none", cursor:"pointer", borderRadius:999, width:28, height:28,
        display:"inline-flex", alignItems:"center", justifyContent:"center", color:"var(--gris)",
        transition:"background 0.14s, color 0.14s" }}
      onMouseEnter={e=>{ e.currentTarget.style.color = teinte;
        e.currentTarget.style.background = `color-mix(in srgb, ${teinte} 10%, transparent)`; }}
      onMouseLeave={e=>{ e.currentTarget.style.color = "var(--gris)";
        e.currentTarget.style.background = "transparent"; }}>
      {children}
    </button>
  );
}

function Confirm({ msg, onOui, onNon }: { msg:string; onOui:()=>void; onNon:()=>void }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onNon(); }} style={{ position:"fixed" as const, inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--carte)", borderRadius:20, maxWidth:420, width:"100%", overflow:"hidden", border:"1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
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
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:640, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", border: "1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>

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
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:520, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", border: "1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
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
      <div style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:800, maxHeight:"90vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", border: "1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
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

  // Filtres pays. `saisie` est ce qu'on tape, `search` ce qu'on interroge : la
  // recherche part au SERVEUR, et sans ce délai chaque caractère déclenchait
  // trois requêtes — pays, groupements et méta sont rechargés ensemble.
  const [saisie,     setSaisie]     = useState("");
  const [search,     setSearch]     = useState("");
  const [filtCont,   setFiltCont]   = useState("");
  const [filtRegion, setFiltRegion] = useState("");
  useEffect(() => { const t = setTimeout(() => setSearch(saisie.trim()), 280); return () => clearTimeout(t); }, [saisie]);

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
    <div style={{ fontFamily:"var(--font-google-sans)" }}>
      <style>{STYLE_GRILLE}</style>
      <style>{`
        @keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          L'EN-TÊTE COMMUN. Le titre flottait seul au-dessus d'une rangée
          d'onglets soulignés — deux étages qui ne tenaient ensemble que par
          leur voisinage, et qui défilaient tous les deux hors de l'écran dès
          la troisième ligne du tableau. L'en-tête de l'administration les
          réunit et les retient en haut : sur un référentiel de 274 pays,
          savoir où l'on est et pouvoir chercher sans remonter compte plus
          qu'ailleurs.
          ══════════════════════════════════════════════════════════════════ */}
      <EnteteAdmin titre="Pays & Groupements"
        compteur={loading ? null : (onglet==="pays" ? pays.length : grps.length)}
        recherche={onglet==="pays" ? (
          <ChampRecherche value={saisie} onChange={setSaisie} arrondi
            placeholder="Rechercher…" style={{ width:238 }} />
        ) : null}
        action={
          <BoutonPrincipal icone={<Plus size={15}/>}
            onClick={()=>{ if(onglet==="pays"){ setEditPays(null); setModalPays(true); } else { setEditGrp(null); setModalGrp(true); } }}>
            {onglet==="pays" ? "Nouveau pays" : "Nouveau groupement"}
          </BoutonPrincipal>
        }>
        {/* DEUX RÉFÉRENTIELS DISTINCTS — des pays, et des ensembles de pays —
            chacun avec sa forme, sa modale et son action de création. La page
            en réunit deux, elle ne les filtre pas. */}
        <Segments value={onglet} onChange={v=>setOnglet(v)} options={[
          { v:"pays" as const,        l:"Pays",        n: loading ? undefined : pays.length },
          { v:"groupements" as const, l:"Groupements", n: loading ? undefined : grps.length },
        ]} />
      </EnteteAdmin>

      <div style={{ padding:"20px 32px 80px" }}>
      {onglet === "pays" ? (

        // ── ONGLET PAYS ─────────────────────────────────────────────────────
        <div>
          {/* LES DEUX FILTRES GÉOGRAPHIQUES RESTENT DANS LA PAGE, la recherche
              est montée dans l'en-tête. Ils ne jouent pas le même rôle : on
              cherche un pays qu'on a en tête, on filtre pour PARCOURIR une
              zone. Le premier geste doit rester sous la main quand on défile,
              le second se pose une fois et ne bouge plus. */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" as const, alignItems:"center" }}>
            <select value={filtCont} onChange={e=>{ setFiltCont(e.target.value); setFiltRegion(""); }} style={{...IS, width:"auto", minWidth:170, height:38, borderRadius:999, paddingLeft:15, cursor:"pointer", fontWeight:600}}>
              <option value="">Tous les continents</option>
              {CONTINENTS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtRegion} onChange={e=>setFiltRegion(e.target.value)} disabled={!filtCont}
              title={!filtCont ? "Choisissez d'abord un continent" : undefined}
              style={{...IS, width:"auto", minWidth:200, height:38, borderRadius:999, paddingLeft:15, fontWeight:600,
                cursor:filtCont?"pointer":"not-allowed", opacity:filtCont?1:0.55}}>
              <option value="">Toutes les régions</option>
              {regionsFiltrees.map((r:string)=><option key={r} value={r}>{r}</option>)}
            </select>
            {/* MUET AU REPOS : la remise à zéro était la seule pastille rouge
                de la page, pour un geste qui ne détruit rien. */}
            {(saisie||filtCont||filtRegion) && (
              <button onClick={()=>{ setSaisie(""); setFiltCont(""); setFiltRegion(""); }} title="Réinitialiser la recherche et les filtres"
                style={{ display:"inline-flex", alignItems:"center", gap:7, background:"transparent", border:"1px solid var(--bordure-forte)",
                  color:"var(--gris-fort)", borderRadius:999, height:38, padding:"0 15px", fontSize:12.5, fontWeight:650,
                  cursor:"pointer", fontFamily:"var(--font-google-sans)", whiteSpace:"nowrap" as const,
                  transition:"color 0.14s, border-color 0.14s, background 0.14s" }}
                onMouseEnter={e=>{ e.currentTarget.style.color="var(--encre)"; e.currentTarget.style.background="rgb(var(--encre-rgb) / 0.04)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.color="var(--gris-fort)"; e.currentTarget.style.background="transparent"; }}>
                <X size={13} /> Réinitialiser
              </button>
            )}
          </div>

          {/* LE TABLEAU PARTAGÉ DE L'ADMINISTRATION, à la place du tableau
              maison : même en-tête discret sur fond ivoire, mêmes filets,
              mêmes coins. Le liseré dégradé de 3 px qui le coiffait est
              retiré — il annonçait le tableau comme une pièce de vitrine
              alors qu'il est l'outil de travail de la page. */}
          {loading ? <SkeletonRows n={10} /> : pays.length===0 ? (
            <EtatVide icone={<Search size={26}/>} titre="Aucun pays trouvé"
              texte="Aucun pays ne correspond à cette recherche ou à ces filtres."
              action={
                <button onClick={()=>{ setSaisie(""); setFiltCont(""); setFiltRegion(""); }}
                  style={{ display:"inline-flex", alignItems:"center", gap:7, background:"transparent",
                    border:"1px solid var(--bordure-forte)", color:"var(--texte)", borderRadius:999,
                    padding:"9px 18px", fontSize:12.5, fontWeight:700, cursor:"pointer",
                    fontFamily:"var(--font-google-sans)" }}>
                  <X size={13}/> Réinitialiser
                </button>
              } />
          ) : (
            <Tableau hauteurMax={640}>
              <thead>
                <tr>
                  <th style={{ ...TH, width:76 }}>ISO</th>
                  <th style={TH}>Pays</th>
                  <th style={TH}>Continent</th>
                  <th style={TH}>Région</th>
                  <th style={TH}>Revenu</th>
                  <th style={TH}>Statut</th>
                  <th style={{ ...TH, width:76, textAlign:"right" as const }} className="ro-w">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pays.map(p=>(
                  <Ligne key={p.id}>
                    <td style={TD}>
                      {p.code_iso3
                        ? <span style={{ fontSize:10.5, fontWeight:800, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{p.code_iso3}</span>
                        : <span style={{ color:"var(--gris)" }}>–</span>}
                    </td>
                    <td style={{ ...TD, fontWeight:700 }}>{p.nom_fr}</td>
                    <td style={{ ...TD, color:"var(--texte)" }}>{p.continent||"—"}</td>
                    <td style={{ ...TD, color:"var(--texte)", whiteSpace:"nowrap" as const }}>{p.region_geo||"—"}</td>
                    <td style={TD}>
                      {p.niveau_revenu ? <Badge label={p.niveau_revenu} color={REVENU_COLOR[p.niveau_revenu]||"var(--gris)"} /> : <span style={{ color:"var(--gris)" }}>—</span>}
                    </td>
                    <td style={TD}>
                      <div style={{ display:"flex", gap:4 }}>
                        {p.est_industrialise && <Badge label="Industrialisé" color="var(--bleu)" />}
                        {p.est_emergent      && <Badge label="Émergent"      color="var(--vert)" />}
                        {!p.est_industrialise && !p.est_emergent && <span style={{ color:"var(--gris)" }}>—</span>}
                      </div>
                    </td>
                    {/* Muettes au repos, teintées au survol — la règle des
                        actions de l'administration, appliquée aux lignes. */}
                    <td style={{ ...TD, textAlign:"right" as const, whiteSpace:"nowrap" as const }} className="ro-w">
                      <IconeAction titre={`Modifier ${p.nom_fr}`} teinte="var(--bleu)"
                        onClick={()=>{ setEditPays(p); setModalPays(true); }}><Pencil size={13} /></IconeAction>
                      <IconeAction titre={`Supprimer ${p.nom_fr}`} teinte="var(--danger)"
                        onClick={()=>handleDeletePays(p)}><Trash2 size={13} /></IconeAction>
                    </td>
                  </Ligne>
                ))}
              </tbody>
            </Tableau>
          )}
        </div>

      ) : (

        // ── ONGLET GROUPEMENTS ────────────────────────────────────────────────
        // LA CARTE PARTAGÉE DE L'ADMINISTRATION. Ces fiches avaient leur propre
        // dessin : un bandeau orange plein de 3 px, un point qui CLIGNOTAIT en
        // permanence à côté du code, et la description enfermée dans un encadré
        // orange — trois signaux d'alerte pour une ligne de référentiel qui
        // n'alerte de rien. Un groupement porte un code, un nom, un libellé
        // anglais et un nombre de membres : c'est exactement ce que la carte
        // commune sait montrer.
        loading ? <SkeletonRows n={6} /> : grps.length===0 ? (
          <EtatVide icone={<IconeModule taille={26}/>} titre="Aucun groupement"
            texte="Les groupements réunissent des pays sous un même ensemble — continent, région, union économique."
            action={<BoutonPrincipal onClick={()=>{ setEditGrp(null); setModalGrp(true); }} icone={<Plus size={15}/>}>
              Nouveau groupement
            </BoutonPrincipal>} />
        ) : (
          <div className="charge-in adm-grille">
            {grps.map(g=>(
              <CarteAdmin key={g.id} onVoir={()=>setPanelGrp(g)} aria={`Membres du groupement : ${g.nom_fr}`}
                titre={g.nom_fr}
                // LE NOMBRE DE MEMBRES TIENT LE COIN DROIT : c'est ce que TOUS
                // les groupements portent, et la seule mesure qui dise si un
                // groupement est renseigné ou resté vide.
                badge={
                  <span style={{ fontSize:10.5, fontWeight:800, whiteSpace:"nowrap" as const, padding:"3px 10px", borderRadius:999,
                    color: g.nb_pays>0 ? "var(--bleu)" : "var(--gris)",
                    background: g.nb_pays>0 ? "rgb(var(--bleu-rgb) / 0.08)" : "rgb(var(--gris-rgb) / 0.12)" }}>
                    {g.nb_pays} pays
                  </span>
                }
                // Un groupement sans aucun membre est une coquille : la bordure
                // en tirets le signale de loin sur la grille, sans ajouter de
                // badge d'alerte.
                pointille={g.nb_pays===0}
                contexte={g.description ? <TexteContexte>{g.description}</TexteContexte> : null}
                donnees={[
                  <Donnee key="c" label="Code"        valeur={g.code || null} />,
                  <Donnee key="e" label="Nom anglais" valeur={g.nom_en || null} />,
                ]}
                actions={<>
                  <ActionCarte onClick={()=>{ setEditGrp(g); setModalGrp(true); }} titre="Modifier"
                    teinte="var(--bleu)" icone={<Pencil size={13}/>}>Modifier</ActionCarte>
                  <ActionCarte onClick={()=>setPanelGrp(g)} titre="Gérer les pays membres"
                    teinte="var(--vert)" icone={<Users size={13}/>}>Membres</ActionCarte>
                  <span style={{ marginLeft:"auto" }}/>
                  <ActionCarte onClick={()=>handleDeleteGrp(g)} titre={`Supprimer ${g.nom_fr}`}
                    teinte="var(--danger)" icone={<Trash2 size={13}/>} />
                </>} />
            ))}
          </div>
        )
      )}
      </div>

      {/* Modals & overlays */}
      <ModalPays   open={modalPays} onClose={()=>setModalPays(false)} edit={editPays} meta={meta} onSaved={charger} />
      <ModalGroupement open={modalGrp} onClose={()=>setModalGrp(false)} edit={editGrp} onSaved={charger} />
      {panelGrp && <PanelMembres grp={panelGrp} onClose={()=>setPanelGrp(null)} allPays={pays.length?pays:[]} onChanged={charger} />}
      {confirm   && <Confirm msg={confirm.msg} onOui={confirm.onOui} onNon={confirm.onNon} />}
    </div>
  );
}
