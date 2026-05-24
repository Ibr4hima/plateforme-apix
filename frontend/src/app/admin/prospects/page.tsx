"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X, MessageSquare, Clock, ChevronDown, ChevronUp } from "lucide-react";
import NaemaSelect from "@/components/shared/NaemaSelect";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const ETATS = [
  { value:"en_cours",   label:"En cours",   color:"#ca631f" },
  { value:"interesse",  label:"Intéressé",  color:"#004f91" },
  { value:"negatif",    label:"Négatif",    color:"#dc2626" },
  { value:"converti",   label:"Converti",   color:"#188038" },
];

// ── PaysSelect hors SN ────────────────────────────────────────────────────────
function PaysHorsSNSelect({ value, onChange }: { value:any; onChange:(v:any)=>void }) {
  const [pays, setPays] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/entreprises/ref/pays`).then(r=>r.json())
      .then((data:any[]) => setPays((data||[]).filter(p => p.code_iso2 !== "SN")))
      .catch(()=>{});
  }, []);
  return (
    <select value={value||""} onChange={e => {
      const p = pays.find(x => x.id === parseInt(e.target.value));
      onChange(p ? { id: p.id, nom: p.nom_fr } : null);
    }} style={IS}>
      <option value="">— Sélectionner un pays —</option>
      {pays.map(p => <option key={p.id} value={p.id}>{p.nom_fr}</option>)}
    </select>
  );
}

// ── Modal Prospect ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  nom:"", siege_id:"", adresse:"", telephone:"", mail:"", siteweb:"",
  secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
  point_entree:"",
};

function ProspectModal({ open, onClose, edit, onSaved }: { open:boolean; onClose:()=>void; edit:any; onSaved:()=>void }) {
  const [form,   setForm]   = useState<any>({...EMPTY_FORM});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const [siegeNom, setSiegeNom] = useState("");

  const upd = (k:string, v:any) => setForm((f:any) => ({...f, [k]:v}));

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        nom:          edit.nom||"",
        siege_id:     edit.siege_id||"",
        adresse:      edit.adresse||"",
        telephone:    edit.telephone||"",
        mail:         edit.mail||"",
        siteweb:      edit.siteweb||"",
        secteur_ids:  edit.secteur_ids||[],
        branche_ids:  edit.branche_ids||[],
        activite_ids: edit.activite_ids||[],
        point_entree: edit.point_entree||"",
      });
      setSiegeNom(edit.siege_nom||"");
    } else {
      setForm({...EMPTY_FORM});
      setSiegeNom("");
    }
    setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("La dénomination sociale est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, siege_id: form.siege_id || null };
      const url    = edit ? `${API}/prospects/${edit.id}` : `${API}/prospects`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true);
      setTimeout(() => { setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:760, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 32px 32px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1a1a2e" }}>{edit ? "Modifier le prospect" : "Nouveau prospect"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568" /></button>
          </div>

          {/* Identification */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Identification</p>
            <div>
              <label style={LS}>Dénomination sociale *</label>
              <input value={form.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom de l'entreprise" style={{...IS, fontSize:14, fontWeight:600}} />
            </div>
          </div>

          {/* Siège social */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Siège social</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={LS}>Pays du siège social *</label>
                <PaysHorsSNSelect value={form.siege_id} onChange={v => { upd("siege_id", v?.id||""); setSiegeNom(v?.nom||""); }} />
              </div>
              <div>
                <label style={LS}>Adresse</label>
                <input value={form.adresse} onChange={e=>upd("adresse",e.target.value)} placeholder="Adresse complète" style={IS} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Contact</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <div><label style={LS}>Téléphone</label><input value={form.telephone} onChange={e=>upd("telephone",e.target.value)} placeholder="+1 234 567 890" style={IS} /></div>
              <div><label style={LS}>Mail</label><input value={form.mail} onChange={e=>upd("mail",e.target.value)} placeholder="contact@entreprise.com" style={IS} /></div>
              <div><label style={LS}>Site web</label><input value={form.siteweb} onChange={e=>upd("siteweb",e.target.value)} placeholder="https://…" style={IS} /></div>
            </div>
          </div>

          {/* Classification NAEMA */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Classification NAEMA</p>
            <NaemaSelect
              secteurIds={form.secteur_ids}
              brancheIds={form.branche_ids}
              activiteIds={form.activite_ids}
              onChangeSecteurs={ids=>upd("secteur_ids",ids)}
              onChangeBranches={ids=>upd("branche_ids",ids)}
              onChangeActivites={ids=>upd("activite_ids",ids)}
            />
          </div>

          {/* Point d'entrée */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Point d'entrée</p>
            <div>
              <label style={LS}>Canal / outil utilisé pour cibler cette entreprise</label>
              <textarea value={form.point_entree} onChange={e=>upd("point_entree",e.target.value)} rows={3}
                placeholder="Ex : LinkedIn, salon professionnel, recommandation partenaire…"
                style={{...IS, resize:"vertical" as const, lineHeight:1.6}} />
            </div>
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:ok?"#059669":"#ca631f", color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
              {saving ? <><Loader2 size={14} style={{animation:"spin 1s linear infinite"}} />Enregistrement…</>
               : ok   ? <><Check size={14} />Enregistré!</>
               :         <><Check size={14} />{edit ? "Modifier" : "Créer le prospect"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Contact (entreprise contactée) ──────────────────────────────────────
function ContactModal({ open, onClose, prospect, onSaved }: { open:boolean; onClose:()=>void; prospect:any; onSaved:()=>void }) {
  const [form, setForm]     = useState({ projet_nom:"", projet_description:"", date_premier_contact:"", etat_avancement:"en_cours", commentaires:"", contraintes:"" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const upd = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!open) return;
    setForm({ projet_nom:"", projet_description:"", date_premier_contact: new Date().toISOString().slice(0,10), etat_avancement:"en_cours", commentaires:"", contraintes:"" });
    setError(""); setOk(false);
  }, [open]);

  const handleSave = async () => {
    if (!form.projet_nom.trim()) { setError("Le nom du projet est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/prospects/${prospect.id}/contacts`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true);
      setTimeout(() => { setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#004f91,#1a6ab0)" }} />
        <div style={{ padding:"24px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>Enregistrer un contact</h2>
              <p style={{ fontSize:12, color:"#9aa5b4", marginTop:3 }}>{prospect?.nom}</p>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568" /></button>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:12 }}>
            <div><label style={LS}>Projet / Objet du contact *</label><input value={form.projet_nom} onChange={e=>upd("projet_nom",e.target.value)} placeholder="Ex : Investissement secteur agro" style={IS} /></div>
            <div><label style={LS}>Description</label><textarea value={form.projet_description} onChange={e=>upd("projet_description",e.target.value)} rows={2} style={{...IS, resize:"vertical" as const}} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={LS}>Date du premier contact</label><input type="date" value={form.date_premier_contact} onChange={e=>upd("date_premier_contact",e.target.value)} style={IS} /></div>
              <div><label style={LS}>État d'avancement</label>
                <select value={form.etat_avancement} onChange={e=>upd("etat_avancement",e.target.value)} style={IS}>
                  {ETATS.map(et=><option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </div>
            </div>
            <div><label style={LS}>Commentaires</label><textarea value={form.commentaires} onChange={e=>upd("commentaires",e.target.value)} rows={2} style={{...IS, resize:"vertical" as const}} /></div>
            <div><label style={LS}>Contraintes</label><textarea value={form.contraintes} onChange={e=>upd("contraintes",e.target.value)} rows={2} style={{...IS, resize:"vertical" as const}} /></div>
          </div>
          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
            <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:ok?"#059669":"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              {saving ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}} /> : ok ? <Check size={13} /> : <Check size={13} />}
              {ok ? "Enregistré !" : saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vue prospect ──────────────────────────────────────────────────────────────
function ProspectVue({ p, secteurs, branches, activites, onClose, onEdit, onAddContact }: any) {
  const LBL = ({t}:{t:string}) => <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{t}</p>;
  const [showContacts, setShowContacts] = useState(true);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:660, maxHeight:"90vh", border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", overflow:"hidden" }}>
        <div style={{ height:5, background:"linear-gradient(90deg,#ca631f,#FFB0A1,#004f91)" }} />
        <div style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ flex:1, paddingRight:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"rgba(202,99,31,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Building2 size={18} style={{color:"#ca631f"}} />
                </div>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{p.nom}</h2>
              </div>
              {p.siege_nom && <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", border:"1px solid rgba(0,79,145,0.2)", padding:"2px 9px", borderRadius:999 }}>{p.siege_nom}</span>}
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568" /></button>
          </div>

          {/* Infos */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {p.telephone && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Téléphone" /><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.telephone}</p></div>}
            {p.mail      && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Email" /><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.mail}</p></div>}
            {p.siteweb   && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Site web" /><a href={p.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#004f91",textDecoration:"none"}}>{p.siteweb}</a></div>}
            {p.adresse   && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Adresse" /><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.adresse}</p></div>}
          </div>

          {/* NAEMA */}
          {p.secteur_ids?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <LBL t="Classification NAEMA" />
              <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any)=>s.id===secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any)=>b.secteur_id===secId&&(p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:brasDuSec.length?5:0 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:"#ca631f", flexShrink:0 }} />
                        <span style={{ fontSize:12, fontWeight:700, color:"#ca631f" }}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{ paddingLeft:20, borderLeft:"2px solid rgba(202,99,31,0.15)", display:"flex", flexDirection:"column" as const, gap:4 }}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any)=>a.branche_id===bra.id&&(p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:actsDeBra.length?3:0 }}>
                                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#004f91", flexShrink:0 }} />
                                  <span style={{ fontSize:11, fontWeight:600, color:"#004f91" }}>{bra.nom}</span>
                                </div>
                                {actsDeBra.length > 0 && (
                                  <div style={{ paddingLeft:18, display:"flex", flexDirection:"column" as const, gap:3 }}>
                                    {actsDeBra.map((act:any) => (
                                      <div key={act.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                        <div style={{ width:5, height:5, borderRadius:"50%", background:"#188038", flexShrink:0 }} />
                                        <span style={{ fontSize:11, color:"#188038", fontWeight:500 }}>{act.nom}</span>
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

          {/* Point d'entrée */}
          {p.point_entree && (
            <div style={{ marginBottom:16 }}>
              <LBL t="Point d'entrée" />
              <div style={{ background:"rgba(202,99,31,0.04)", border:"1px solid rgba(202,99,31,0.12)", borderRadius:10, padding:"12px 14px" }}>
                <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{p.point_entree}</p>
              </div>
            </div>
          )}

          {/* Contacts */}
          {p.contacts?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <button onClick={()=>setShowContacts(o=>!o)}
                style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:showContacts?10:0 }}>
                <LBL t={`Contacts (${p.contacts.length})`} />
                {showContacts ? <ChevronUp size={12} style={{color:"#9aa5b4",marginBottom:5}} /> : <ChevronDown size={12} style={{color:"#9aa5b4",marginBottom:5}} />}
              </button>
              {showContacts && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                  {p.contacts.map((c:any) => {
                    const etat = ETATS.find(e=>e.value===c.etat_avancement);
                    return (
                      <div key={c.id} style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                          <p style={{ fontWeight:700, fontSize:13, color:"#1a1a2e" }}>{c.projet_nom}</p>
                          {etat && <span style={{ fontSize:10, fontWeight:700, color:etat.color, background:etat.color+"14", border:`1px solid ${etat.color}33`, padding:"2px 8px", borderRadius:999 }}>{etat.label}</span>}
                        </div>
                        {c.date_premier_contact && <p style={{ fontSize:11, color:"#9aa5b4", display:"flex", alignItems:"center", gap:4 }}><Clock size={10} /> {new Date(c.date_premier_contact).toLocaleDateString("fr-FR")}</p>}
                        {c.commentaires && <p style={{ fontSize:12, color:"#4a5568", marginTop:6, lineHeight:1.6 }}>{c.commentaires}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between", borderTop:"1px solid #F2F0EF", paddingTop:18 }}>
            <button onClick={onAddContact}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"none", background:"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              <MessageSquare size={13} /> Enregistrer un contact
            </button>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onEdit} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"none", background:"#ca631f", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                <Pencil size={13} /> Modifier
              </button>
              <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #C5BFBB", background:"transparent", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Fermer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ProspectsPage() {
  const [prospects,  setProspects]  = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [onglet,     setOnglet]     = useState<"cibles"|"contactes">("cibles");
  const [modal,      setModal]      = useState(false);
  const [edit,       setEdit]       = useState<any>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [contactModal, setContactModal] = useState(false);
  const [deleting,   setDeleting]   = useState<number|null>(null);
  const [q,          setQ]          = useState("");
  const [secteurs,   setSecteurs]   = useState<any[]>([]);
  const [branches,   setBranches]   = useState<any[]>([]);
  const [activites,  setActivites]  = useState<any[]>([]);

  useEffect(() => {
    const safe = (p:Promise<any>) => p.catch(()=>[]);
    Promise.all([
      safe(fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/branches`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/activites`).then(r=>r.json())),
    ]).then(([s,b,a]) => { setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); });
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:"1", per_page:"50" });
      if (q) params.set("q", q);
      if (onglet === "contactes") params.set("contactes", "true");
      else params.set("contactes", "false");
      const res  = await fetch(`${API}/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data||[]); setTotal(data.total||0);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [q, onglet]);

  useEffect(() => { charger(); }, [charger]);

  const handleDelete = async (id:number) => {
    if (!confirm("Supprimer ce prospect ?")) return;
    setDeleting(id);
    await fetch(`${API}/prospects/${id}`, { method:"DELETE" });
    setDeleting(null); charger();
  };

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase" as const, marginBottom:4 }}>Administration</p>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Prospects</h1>
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>Entreprises pouvant être intéressées par la Destination Sénégal</p>
        </div>
        <button onClick={()=>{ setEdit(null); setModal(true); }}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 20px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#ca631f,#e07a3a)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(202,99,31,0.3)" }}>
          <Plus size={15} /> Nouveau prospect
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", gap:2, background:"rgba(0,0,0,0.04)", borderRadius:10, padding:3, width:"fit-content", marginBottom:24, border:"1px solid #E8E5E3" }}>
        {([["cibles","Entreprises ciblées"],["contactes","Entreprises contactées"]] as const).map(([key,label]) => (
          <button key={key} onClick={()=>setOnglet(key)}
            style={{ padding:"8px 20px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s", background:onglet===key?"#ca631f":"transparent", color:onglet===key?"#fff":"#4a5568" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ position:"relative" as const, marginBottom:20, maxWidth:360 }}>
        <input value={q} onChange={e=>{setQ(e.target.value);}} placeholder="Rechercher un prospect…"
          style={{...IS, paddingLeft:14}} />
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : prospects.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
          <Building2 size={48} style={{ marginBottom:16, opacity:0.3 }} />
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun prospect</p>
          <p style={{ fontSize:13, marginTop:4 }}>{onglet==="cibles" ? "Ajoutez votre premier prospect ciblé" : "Aucun prospect contacté pour l'instant"}</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize:13, color:"#9aa5b4", marginBottom:16 }}>{total} prospect{total>1?"s":""}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
            {prospects.map(p => (
              <div key={p.id} onClick={()=>setVue(p)}
                style={{ background:"#fff", borderTop:"1px solid #E8E5E3", borderRight:"1px solid #E8E5E3", borderBottom:"1px solid #E8E5E3", borderLeft:`3px solid #ca631f`, borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}>
                <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", marginBottom:4, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.nom}</div>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:10 }}>
                  {p.siege_nom && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:"#004f91", flexShrink:0 }} />
                    <span style={{ color:"#4a5568" }}>{p.siege_nom}</span>
                  </div>}
                  {p.contacts?.length > 0 && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                    <MessageSquare size={10} style={{color:"#ca631f",flexShrink:0}} />
                    <span style={{ color:"#ca631f", fontWeight:600 }}>{p.contacts.length} contact{p.contacts.length>1?"s":""}</span>
                  </div>}
                </div>
                <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{ setEdit(p); setModal(true); }}
                    style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#ca631f", fontWeight:600 }}>
                    <Pencil size={12} /> Modifier
                  </button>
                  <button onClick={()=>{ setVue(p); setTimeout(()=>setContactModal(true),50); }}
                    style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#004f91", fontWeight:600 }}>
                    <MessageSquare size={12} /> Contact
                  </button>
                  <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}>
                    {deleting===p.id ? <Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}} /> : <Trash2 size={12} style={{color:"#dc2626"}} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ProspectModal open={modal} onClose={()=>setModal(false)} edit={edit} onSaved={charger} />
      {vue && <ProspectVue p={vue} secteurs={secteurs} branches={branches} activites={activites}
        onClose={()=>setVue(null)}
        onEdit={()=>{ setEdit(vue); setVue(null); setModal(true); }}
        onAddContact={()=>setContactModal(true)} />}
      {vue && <ContactModal open={contactModal} onClose={()=>setContactModal(false)} prospect={vue} onSaved={()=>{ setContactModal(false); charger(); }} />}
    </div>
  );
}
