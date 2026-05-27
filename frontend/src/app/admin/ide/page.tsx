"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#004f91", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const SOURCES = [ { value:"cnuced", label:"CNUCED" }, { value:"fdi_markets", label:"FDI Markets" } ];
const DIRECTIONS = [ { value:"", label:"— Toutes —" }, { value:"entrant", label:"Entrants" }, { value:"sortant", label:"Sortants" }, { value:"les_deux", label:"Entrants & Sortants" } ];
const INDICATEURS = [ { value:"", label:"— Tous —" }, { value:"flux", label:"Flux" }, { value:"stock", label:"Stock" } ];

const ANNEES = Array.from({length:35},(_,i)=>1990+i);

function AnalyseModal({ open, onClose, edit, onSaved }: any) {
  const [form, setForm] = useState<any>({ source:"cnuced", titre:"", commentaire:"", direction:"", indicateur:"", annee_debut:"", annee_fin:"", ordre:0 });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const upd = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));

  useEffect(() => {
    if (!open) return;
    if (edit) setForm({ source:edit.source||"cnuced", titre:edit.titre||"", commentaire:edit.commentaire||"", direction:edit.direction||"", indicateur:edit.indicateur||"", annee_debut:edit.annee_debut||"", annee_fin:edit.annee_fin||"", ordre:edit.ordre||0 });
    else setForm({ source:"cnuced", titre:"", commentaire:"", direction:"", indicateur:"", annee_debut:"", annee_fin:"", ordre:0 });
    setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.titre.trim() || !form.commentaire.trim()) { setError("Titre et commentaire obligatoires"); return; }
    setSaving(true); setError("");
    try {
      const url    = edit ? `${API}/ide/analyses/${edit.id}` : `${API}/ide/analyses`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...form, annee_debut:form.annee_debut||null, annee_fin:form.annee_fin||null, ordre:parseInt(form.ordre)||0 }) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true); setTimeout(()=>{ setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:700, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#004f91,#1a6ab0)", borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 32px 32px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1a1a2e" }}>{edit?"Modifier l'analyse":"Nouvelle analyse"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568" /></button>
          </div>

          {/* Paramètres graphe */}
          <div style={{ marginBottom:20 }}>
            <p style={SEC}>Paramètres du graphe associé</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:10 }}>
              <div>
                <label style={LS}>Source</label>
                <select value={form.source} onChange={e=>upd("source",e.target.value)} style={IS}>
                  {SOURCES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Direction</label>
                <select value={form.direction} onChange={e=>upd("direction",e.target.value)} style={IS}>
                  {DIRECTIONS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Indicateur</label>
                <select value={form.indicateur} onChange={e=>upd("indicateur",e.target.value)} style={IS}>
                  {INDICATEURS.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Année début</label>
                <select value={form.annee_debut} onChange={e=>upd("annee_debut",e.target.value)} style={IS}>
                  <option value="">—</option>
                  {ANNEES.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Année fin</label>
                <select value={form.annee_fin} onChange={e=>upd("annee_fin",e.target.value)} style={IS}>
                  <option value="">—</option>
                  {ANNEES.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Contenu */}
          <div style={{ marginBottom:20 }}>
            <p style={SEC}>Analyse</p>
            <div style={{ marginBottom:12 }}>
              <label style={LS}>Titre de l'analyse *</label>
              <input value={form.titre} onChange={e=>upd("titre",e.target.value)} placeholder="Ex : Accélération des IDE après 2020" style={{...IS, fontSize:14, fontWeight:600}} />
            </div>
            <div>
              <label style={LS}>Commentaire / Analyse *</label>
              <textarea value={form.commentaire} onChange={e=>upd("commentaire",e.target.value)} rows={6}
                placeholder="Rédigez l'analyse experte ici…" style={{...IS, resize:"vertical" as const, lineHeight:1.7}} />
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={LS}>Ordre d'affichage</label>
            <input type="number" value={form.ordre} onChange={e=>upd("ordre",e.target.value)} style={{...IS, width:100}} />
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:ok?"#059669":"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}} />Enregistrement…</>:ok?<><Check size={14} />Enregistré!</>:<><Check size={14} />{edit?"Modifier":"Créer"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminIdePage() {
  const [analyses,  setAnalyses]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [edit,      setEdit]      = useState<any>(null);
  const [onglet,    setOnglet]    = useState("cnuced");
  const [deleting,  setDeleting]  = useState<number|null>(null);
  const [toggling,  setToggling]  = useState<number|null>(null);

  const charger = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/ide/analyses`);
      setAnalyses(await res.json());
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, []);

  const handleDelete = async (id:number) => {
    if (!confirm("Supprimer cette analyse ?")) return;
    setDeleting(id);
    await fetch(`${API}/ide/analyses/${id}`, { method:"DELETE" });
    setDeleting(null); charger();
  };

  const handleToggle = async (a:any) => {
    setToggling(a.id);
    await fetch(`${API}/ide/analyses/${a.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ est_publie:!a.est_publie }) });
    setToggling(null); charger();
  };

  const filtrees = analyses.filter(a => a.source === onglet);

  const labelDir = (d:string) => ({ entrant:"Entrants", sortant:"Sortants", les_deux:"Ent. & Sor." }[d] || "—");
  const labelInd = (i:string) => ({ flux:"Flux", stock:"Stock" }[i] || "—");

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:"#004f91", letterSpacing:"0.15em", textTransform:"uppercase" as const, marginBottom:4 }}>Administration</p>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>IDE — Analyses expertes</h1>
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>{analyses.length} analyse{analyses.length>1?"s":""} · {analyses.filter(a=>a.est_publie).length} publiée{analyses.filter(a=>a.est_publie).length>1?"s":""}</p>
        </div>
        <button onClick={()=>{ setEdit(null); setModal(true); }}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 20px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#004f91,#1a6ab0)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(0,79,145,0.3)" }}>
          <Plus size={15} /> Nouvelle analyse
        </button>
      </div>

      {/* Section KPIs */}
      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E8E5E3", padding:"20px 24px", marginBottom:28, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <AdminIdeKpis />
      </div>

      {/* Onglets source */}
      <div style={{ display:"flex", gap:2, background:"rgba(0,0,0,0.04)", borderRadius:10, padding:3, width:"fit-content", marginBottom:24, border:"1px solid #E8E5E3" }}>
        {SOURCES.map(s => (
          <button key={s.value} onClick={()=>setOnglet(s.value)}
            style={{ padding:"8px 20px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s", background:onglet===s.value?"#004f91":"transparent", color:onglet===s.value?"#fff":"#4a5568" }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} /></div>
      ) : filtrees.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucune analyse</p>
          <p style={{ fontSize:13, marginTop:4 }}>Créez la première analyse pour {onglet === "cnuced" ? "CNUCED" : "FDI Markets"}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
          {filtrees.map(a => (
            <div key={a.id} style={{ background:"#fff", border:"1px solid #E8E5E3", borderLeft:`4px solid ${a.est_publie?"#004f91":"#C5BFBB"}`, borderRadius:12, padding:"16px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1, paddingRight:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"#1a1a2e" }}>{a.titre}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:a.est_publie?"#004f91":"#9aa5b4", background:a.est_publie?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>
                      {a.est_publie?"Publié":"Brouillon"}
                    </span>
                  </div>
                  {/* Tags paramètres */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const, marginBottom:8 }}>
                    {a.direction  && <span style={{ fontSize:11, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"1px 8px", borderRadius:6 }}>{labelDir(a.direction)}</span>}
                    {a.indicateur && <span style={{ fontSize:11, color:"#ca631f", background:"rgba(202,99,31,0.07)", padding:"1px 8px", borderRadius:6 }}>{labelInd(a.indicateur)}</span>}
                    {a.annee_debut && <span style={{ fontSize:11, color:"#4a5568", background:"#F2F0EF", padding:"1px 8px", borderRadius:6 }}>{a.annee_debut}{a.annee_fin?` → ${a.annee_fin}`:""}</span>}
                  </div>
                  <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.6, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const }}>{a.commentaire}</p>
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <button onClick={()=>handleToggle(a)} disabled={toggling===a.id}
                    style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, background:a.est_publie?"rgba(220,38,38,0.07)":"rgba(0,79,145,0.08)", color:a.est_publie?"#dc2626":"#004f91" }}>
                    {toggling===a.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:a.est_publie?<><EyeOff size={12}/>Dépublier</>:<><Eye size={12}/>Publier</>}
                  </button>
                  <button onClick={()=>{ setEdit(a); setModal(true); }} style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 8px" }}><Pencil size={13} style={{color:"#ca631f"}} /></button>
                  <button onClick={()=>handleDelete(a.id)} disabled={deleting===a.id} style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 8px" }}>
                    {deleting===a.id?<Loader2 size={13} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={13} style={{color:"#dc2626"}} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnalyseModal open={modal} onClose={()=>setModal(false)} edit={edit} onSaved={charger} />
    </div>
  );
}

// ── Section KPI Config (à ajouter dans AdminIdePage) ─────────────────────────
export function AdminIdeKpis() {
  const [kpis,    setKpis]    = useState<any[]>([]);
  const [calcules,setCalcules]= useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<number|null>(null);
  const MAX_ACTIFS = 4;

  const charger = async () => {
    setLoading(true);
    try {
      const [kR, cR] = await Promise.all([
        fetch(`${API}/ide/kpis-config`).then(r=>r.json()),
        fetch(`${API}/ide/cnuced/kpis-calcules`).then(r=>r.json()),
      ]);
      setKpis(kR||[]); setCalcules(cR||{});
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, []);

  const nbActifs = kpis.filter(k=>k.est_actif).length;

  const toggle = async (k:any) => {
    if (!k.est_actif && nbActifs >= MAX_ACTIFS) { alert(`Maximum ${MAX_ACTIFS} KPIs actifs`); return; }
    setSaving(k.id);
    await fetch(`${API}/ide/kpis-config/${k.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ est_actif:!k.est_actif }) });
    setSaving(null); charger();
  };

  const fmtVal = (kpi:any, data:any) => {
    if (!data) return "—";
    const v = data.valeur;
    if (v === null || v === undefined) return "N/A";
    if (data.unite === "M$") return Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)} Md$` : `${v.toFixed(0)} M$`;
    if (data.unite === "×") return `×${v}`;
    if (data.unite === "%") return `${v > 0 ? "+" : ""}${v}%`;
    if (data.unite === "ans") return `${v} an${v>1?"s":""}`;
    return String(v);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontWeight:700, fontSize:15, color:"#1a1a2e" }}>Indicateurs clés (KPIs)</h2>
          <p style={{ fontSize:12, color:"#9aa5b4", marginTop:3 }}>{nbActifs}/{MAX_ACTIFS} KPIs activés — max 4 affichés publiquement (1 ligne × 4 colonnes)</p>
        </div>
      </div>
      {loading ? <div style={{padding:40,textAlign:"center" as const}}><Loader2 size={24} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}} /></div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:10 }}>
          {kpis.map(k => {
            const data = calcules[k.code];
            return (
              <div key={k.id} style={{ background:"#fff", border:`1.5px solid ${k.est_actif?"#004f91":"#E8E5E3"}`, borderRadius:12, padding:"14px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:"#1a1a2e" }}>{k.label}</span>
                    {k.est_actif && <span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"1px 7px", borderRadius:999 }}>Actif</span>}
                  </div>
                  <p style={{ fontSize:11, color:"#9aa5b4", marginBottom:8, lineHeight:1.5 }}>{k.description}</p>
                  {/* Aperçu valeur */}
                  {data && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:16, fontWeight:800, color:k.est_actif?"#004f91":"#4a5568" }}>{fmtVal(k, data)}</span>
                      {data.annee && <span style={{ fontSize:11, color:"#9aa5b4" }}>({data.annee})</span>}
                      {data.variation !== null && data.variation !== undefined && (
                        <span style={{ fontSize:11, fontWeight:700, color:data.variation>0?"#188038":"#dc2626", background:data.variation>0?"rgba(24,128,56,0.08)":"rgba(220,38,38,0.08)", padding:"1px 7px", borderRadius:999 }}>
                          {data.variation>0?"+":""}{data.variation}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={()=>toggle(k)} disabled={saving===k.id}
                  style={{ flexShrink:0, padding:"7px 14px", borderRadius:9, border:`1.5px solid ${k.est_actif?"#dc2626":"#004f91"}`, background:k.est_actif?"rgba(220,38,38,0.06)":"rgba(0,79,145,0.06)", color:k.est_actif?"#dc2626":"#004f91", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {saving===k.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:k.est_actif?"Désactiver":"Activer"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
