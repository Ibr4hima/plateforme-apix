"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Clock, Loader2, MessageSquare, Pencil, Plus, Trash2, User, X } from "lucide-react";
import PhoneInput from "@/components/shared/PhoneInput";
import PaysSelect from "@/components/shared/PaysSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const ETATS = [
  { value:"en_cours",  label:"En cours",  color:"#ca631f" },
  { value:"interesse", label:"Intéressé", color:"#004f91" },
  { value:"negatif",   label:"Négatif",   color:"#dc2626" },
  { value:"converti",  label:"Converti",  color:"#188038" },
];

// ── Sélecteur type investisseur ───────────────────────────────────────────────
function TypeSelector({ value, onChange }: { value: "physique"|"morale"; onChange:(v:"physique"|"morale")=>void }) {
  return (
    <div style={{ display:"flex", gap:0, borderRadius:12, overflow:"hidden", border:"1px solid #C5BFBB", marginBottom:24 }}>
      {([["physique","👤 Personne physique"],["morale","🏢 Personne morale"]] as const).map(([key,label]) => (
        <button key={key} onClick={()=>onChange(key)} type="button"
          style={{ flex:1, padding:"14px 0", border:"none", cursor:"pointer", fontSize:13, fontWeight:700, transition:"all .15s",
            background: value===key ? (key==="physique"?"#ca631f":"#004f91") : "#F8F7F6",
            color: value===key ? "#fff" : "#9aa5b4",
            borderRight: key==="physique" ? "1px solid #C5BFBB" : "none" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Champs multi-téléphones ───────────────────────────────────────────────────
function MultiPhones({ values, onChange }: { values:string[]; onChange:(v:string[])=>void }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <label style={LS}>Téléphone(s)</label>
        <button type="button" onClick={()=>onChange([...values,""])}
          style={{ fontSize:11, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:6, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <Plus size={11}/> Ajouter
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {values.map((tel, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6 }}>
            <div style={{ flex:1 }}>
              <PhoneInput value={tel} onChange={v=>{ const a=[...values]; a[i]=v; onChange(a); }} placeholder="Numéro" />
            </div>
            {values.length > 1 && (
              <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))}
                style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 8px", flexShrink:0, marginTop:1 }}>
                <X size={12} style={{ color:"#dc2626" }}/>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Champs multi-mails ────────────────────────────────────────────────────────
function MultiMails({ values, onChange }: { values:string[]; onChange:(v:string[])=>void }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <label style={LS}>Email(s)</label>
        <button type="button" onClick={()=>onChange([...values,""])}
          style={{ fontSize:11, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:6, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <Plus size={11}/> Ajouter
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {values.map((mail, i) => (
          <div key={i} style={{ display:"flex", gap:6 }}>
            <input type="email" value={mail} placeholder="contact@exemple.com"
              onChange={e=>{ const a=[...values]; a[i]=e.target.value; onChange(a); }}
              style={{ ...IS, flex:1 }} />
            {values.length > 1 && (
              <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))}
                style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 8px", flexShrink:0 }}>
                <X size={12} style={{ color:"#dc2626" }}/>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal création/édition Prospect ──────────────────────────────────────────
const EMPTY_PHYSIQUE = {
  type:             "physique" as "physique"|"morale",
  prenom:           "",
  nom:              "",
  pays_origine_id:  null as number|null,
  pays_origine_nom: "",
  telephones:       [""] as string[],
  mails:            [""] as string[],
  details:          "",
};

function ProspectModal({ open, onClose, edit, onSaved }: {
  open:boolean; onClose:()=>void; edit:any; onSaved:()=>void;
}) {
  const [form,   setForm]   = useState<typeof EMPTY_PHYSIQUE>({...EMPTY_PHYSIQUE});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);

  const upd = (k:string, v:any) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if (!open) return;
    if (edit) {
      setForm({
        type:             edit.type||"physique",
        prenom:           edit.prenom||"",
        nom:              edit.nom||"",
        pays_origine_id:  edit.pays_origine_id||null,
        pays_origine_nom: edit.pays_origine_nom||"",
        telephones:       edit.telephones?.length ? edit.telephones : (edit.telephone ? edit.telephone.split(",").map((t:string)=>t.trim()) : [""]),
        mails:            edit.mails?.length ? edit.mails : (edit.mail ? edit.mail.split(",").map((m:string)=>m.trim()) : [""]),
        details:          edit.details||"",
      });
    } else {
      setForm({...EMPTY_PHYSIQUE});
    }
    setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire"); return; }
    if (form.type==="physique" && !form.prenom.trim()) { setError("Le prénom est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const tels = form.telephones.filter(Boolean);
      const mails = form.mails.filter(Boolean);
      const payload = {
        type:            form.type,
        nom:             form.nom.trim(),
        prenom:          form.prenom.trim()||null,
        pays_origine_id: form.pays_origine_id||null,
        telephone:       tels.join(", ")||null,
        mail:            mails.join(", ")||null,
        details:         form.details||null,
      };
      const url    = edit ? `${API}/prospects/${edit.id}` : `${API}/prospects`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true);
      setTimeout(()=>{ setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:780, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"20px 20px 0 0" }}/>
        <div style={{ padding:"28px 32px 32px" }}>

          {/* Titre + fermer */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.15rem", color:"#1a1a2e" }}>
              {edit ? "Modifier le prospect" : "Nouveau prospect"}
            </h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568"/></button>
          </div>

          {/* Sélecteur de type */}
          <TypeSelector value={form.type} onChange={v=>upd("type",v)}/>

          {/* ── Formulaire Personne physique ── */}
          {form.type === "physique" && (
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

              {/* Identification */}
              <div>
                <p style={SEC}>Identification de l'investisseur</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={LS}>Prénom *</label>
                    <input value={form.prenom} onChange={e=>upd("prenom",e.target.value)}
                      placeholder="Prénom" style={IS}/>
                  </div>
                  <div>
                    <label style={LS}>Nom *</label>
                    <input value={form.nom} onChange={e=>upd("nom",e.target.value)}
                      placeholder="Nom de famille" style={IS}/>
                  </div>
                </div>
                <div>
                  <label style={LS}>Pays d'origine</label>
                  <PaysSelect
                    value={form.pays_origine_nom}
                    onChange={nom=>upd("pays_origine_nom",nom)}
                    onChangeId={id=>upd("pays_origine_id",id)}
                    placeholder="Sélectionner le pays d'origine"
                  />
                </div>
              </div>

              {/* Contact */}
              <div>
                <p style={SEC}>Contact</p>
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <MultiPhones values={form.telephones} onChange={v=>upd("telephones",v)}/>
                  <MultiMails  values={form.mails}      onChange={v=>upd("mails",v)}/>
                </div>
              </div>

              {/* Détails */}
              <div>
                <p style={SEC}>Détails sur l'investisseur</p>
                <RichTextEditor value={form.details} onChange={v=>upd("details",v)}/>
              </div>

            </div>
          )}

          {/* ── Placeholder Personne morale ── */}
          {form.type === "morale" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 0", gap:12 }}>
              <Building2 size={36} style={{ color:"#C5BFBB" }}/>
              <p style={{ fontSize:14, fontWeight:600, color:"#9aa5b4" }}>Formulaire personne morale</p>
              <p style={{ fontSize:12, color:"#C5BFBB" }}>En cours de développement</p>
            </div>
          )}

          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:16 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24, paddingTop:20, borderTop:"1px solid #F2F0EF" }}>
            <button onClick={onClose}
              style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving||ok||form.type==="morale"}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none",
                background: ok?"#059669":saving||form.type==="morale"?"#ccc":"#ca631f",
                color:"#fff", fontWeight:700, cursor:saving||form.type==="morale"?"not-allowed":"pointer", fontSize:13 }}>
              {saving ? <><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Enregistrement…</>
               : ok   ? <><Check size={14}/> Enregistré !</>
               :         <><Check size={14}/> {edit?"Modifier":"Créer le prospect"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Contact ─────────────────────────────────────────────────────────────
function ContactModal({ open, onClose, prospect, onSaved }: { open:boolean; onClose:()=>void; prospect:any; onSaved:()=>void }) {
  const [form, setForm]     = useState({ projet_nom:"", projet_description:"", date_premier_contact:"", etat_avancement:"en_cours", commentaires:"", contraintes:"" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const upd = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if (!open) return;
    setForm({ projet_nom:"", projet_description:"", date_premier_contact:new Date().toISOString().slice(0,10), etat_avancement:"en_cours", commentaires:"", contraintes:"" });
    setError(""); setOk(false);
  }, [open]);

  const handleSave = async () => {
    if (!form.projet_nom.trim()) { setError("Le nom du projet est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/prospects/${prospect.id}/contacts`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true);
      setTimeout(()=>{ setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#004f91,#1a6ab0)" }}/>
        <div style={{ padding:"24px 28px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>Enregistrer un contact</h2>
              <p style={{ fontSize:12, color:"#9aa5b4", marginTop:3 }}>
                {prospect?.prenom} {prospect?.nom || prospect?.nom}
              </p>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:12 }}>
            <div><label style={LS}>Projet / Objet du contact *</label><input value={form.projet_nom} onChange={e=>upd("projet_nom",e.target.value)} placeholder="Ex : Investissement secteur agro" style={IS}/></div>
            <div><label style={LS}>Description</label><textarea value={form.projet_description} onChange={e=>upd("projet_description",e.target.value)} rows={2} style={{...IS,resize:"vertical" as const}}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={LS}>Date du premier contact</label><input type="date" value={form.date_premier_contact} onChange={e=>upd("date_premier_contact",e.target.value)} style={IS}/></div>
              <div><label style={LS}>État d'avancement</label>
                <select value={form.etat_avancement} onChange={e=>upd("etat_avancement",e.target.value)} style={IS}>
                  {ETATS.map(et=><option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </div>
            </div>
            <div><label style={LS}>Commentaires</label><textarea value={form.commentaires} onChange={e=>upd("commentaires",e.target.value)} rows={2} style={{...IS,resize:"vertical" as const}}/></div>
            <div><label style={LS}>Contraintes</label><textarea value={form.contraintes} onChange={e=>upd("contraintes",e.target.value)} rows={2} style={{...IS,resize:"vertical" as const}}/></div>
          </div>
          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
            <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:ok?"#059669":"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:ok?<Check size={13}/>:<Check size={13}/>}
              {ok?"Enregistré !":saving?"Enregistrement…":"Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vue prospect (fiche détail) ───────────────────────────────────────────────
function ProspectVue({ p, onClose, onEdit, onAddContact }: any) {
  const LBL = ({t}:{t:string}) => <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{t}</p>;
  const [showContacts, setShowContacts] = useState(true);

  const displayName = p.type==="morale" ? p.nom : `${p.prenom||""} ${p.nom||""}`.trim();

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:660, maxHeight:"90vh", border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", overflow:"hidden" }}>
        <div style={{ height:5, background:"linear-gradient(90deg,#ca631f,#FFB0A1,#004f91)" }}/>
        <div style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>

          {/* En-tête */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:"rgba(202,99,31,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {p.type==="morale" ? <Building2 size={18} style={{color:"#ca631f"}}/> : <User size={18} style={{color:"#ca631f"}}/>}
              </div>
              <div>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{displayName}</h2>
                <span style={{ fontSize:11, fontWeight:600, color:p.type==="morale"?"#004f91":"#ca631f", background:p.type==="morale"?"rgba(0,79,145,0.08)":"rgba(202,99,31,0.08)", border:`1px solid ${p.type==="morale"?"rgba(0,79,145,0.2)":"rgba(202,99,31,0.2)"}`, padding:"2px 9px", borderRadius:999 }}>
                  {p.type==="morale"?"Personne morale":"Personne physique"}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Infos */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {p.pays_origine_nom && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Pays d'origine"/><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.pays_origine_nom}</p></div>}
            {p.telephone && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Téléphone(s)"/>
              {p.telephone.split(",").map((t:string,i:number)=><p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{t.trim()}</p>)}
            </div>}
            {p.mail && <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Email(s)"/>
              {p.mail.split(",").map((m:string,i:number)=><p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{m.trim()}</p>)}
            </div>}
          </div>

          {/* Détails */}
          {p.details && (
            <div style={{ marginBottom:16 }}>
              <LBL t="Détails"/>
              <div style={{ background:"rgba(202,99,31,0.04)", border:"1px solid rgba(202,99,31,0.12)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#4a5568", lineHeight:1.7 }}
                dangerouslySetInnerHTML={{ __html: p.details }}/>
            </div>
          )}

          {/* Contacts */}
          {p.contacts?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <button onClick={()=>setShowContacts(o=>!o)}
                style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:showContacts?10:0 }}>
                <LBL t={`Contacts (${p.contacts.length})`}/>
                {showContacts ? <ChevronUp size={12} style={{color:"#9aa5b4",marginBottom:5}}/> : <ChevronDown size={12} style={{color:"#9aa5b4",marginBottom:5}}/>}
              </button>
              {showContacts && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                  {p.contacts.map((c:any)=>{
                    const etat = ETATS.find(e=>e.value===c.etat_avancement);
                    return (
                      <div key={c.id} style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                          <p style={{ fontWeight:700, fontSize:13, color:"#1a1a2e" }}>{c.projet_nom}</p>
                          {etat && <span style={{ fontSize:10, fontWeight:700, color:etat.color, background:etat.color+"14", border:`1px solid ${etat.color}33`, padding:"2px 8px", borderRadius:999 }}>{etat.label}</span>}
                        </div>
                        {c.date_premier_contact && <p style={{ fontSize:11, color:"#9aa5b4", display:"flex", alignItems:"center", gap:4 }}><Clock size={10}/> {new Date(c.date_premier_contact).toLocaleDateString("fr-FR")}</p>}
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
              <MessageSquare size={13}/> Enregistrer un contact
            </button>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onEdit}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"none", background:"#ca631f", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                <Pencil size={13}/> Modifier
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
  const [prospects,    setProspects]    = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [onglet,       setOnglet]       = useState<"cibles"|"contactes">("cibles");
  const [modal,        setModal]        = useState(false);
  const [edit,         setEdit]         = useState<any>(null);
  const [vue,          setVue]          = useState<any>(null);
  const [contactModal, setContactModal] = useState(false);
  const [deleting,     setDeleting]     = useState<number|null>(null);
  const [q,            setQ]            = useState("");

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:"1", per_page:"50" });
      if (q) params.set("q", q);
      params.set("contactes", onglet==="contactes" ? "true" : "false");
      const res  = await fetch(`${API}/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data||[]); setTotal(data.total||0);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [q, onglet]);

  useEffect(()=>{ charger(); }, [charger]);

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
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>Investisseurs ciblés pour la Destination Sénégal</p>
        </div>
        <button onClick={()=>{ setEdit(null); setModal(true); }}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 20px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#ca631f,#e07a3a)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(202,99,31,0.3)" }}>
          <Plus size={15}/> Nouveau prospect
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", gap:2, background:"rgba(0,0,0,0.04)", borderRadius:10, padding:3, width:"fit-content", marginBottom:24, border:"1px solid #E8E5E3" }}>
        {([["cibles","Investisseurs ciblés"],["contactes","Investisseurs contactés"]] as const).map(([key,label])=>(
          <button key={key} onClick={()=>setOnglet(key)}
            style={{ padding:"8px 20px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s", background:onglet===key?"#ca631f":"transparent", color:onglet===key?"#fff":"#4a5568" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ position:"relative" as const, marginBottom:20, maxWidth:360 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un prospect…" style={{...IS, paddingLeft:14}}/>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }}/>
        </div>
      ) : prospects.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
          <User size={48} style={{ marginBottom:16, opacity:0.3 }}/>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun prospect</p>
          <p style={{ fontSize:13, marginTop:4 }}>{onglet==="cibles"?"Ajoutez votre premier prospect ciblé":"Aucun prospect contacté pour l'instant"}</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize:13, color:"#9aa5b4", marginBottom:16 }}>{total} prospect{total>1?"s":""}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
            {prospects.map(p=>{
              const displayName = p.type==="morale" ? p.nom : `${p.prenom||""} ${p.nom||""}`.trim();
              return (
                <div key={p.id} onClick={()=>setVue(p)}
                  style={{ background:"#fff", borderTop:"1px solid #E8E5E3", borderRight:"1px solid #E8E5E3", borderBottom:"1px solid #E8E5E3", borderLeft:"3px solid #ca631f", borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:"rgba(202,99,31,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {p.type==="morale"?<Building2 size={13} style={{color:"#ca631f"}}/>:<User size={13} style={{color:"#ca631f"}}/>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{displayName}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:10 }}>
                    {p.pays_origine_nom && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:"#004f91", flexShrink:0 }}/>
                      <span style={{ color:"#4a5568" }}>{p.pays_origine_nom}</span>
                    </div>}
                    {p.contacts?.length > 0 && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                      <MessageSquare size={10} style={{color:"#ca631f",flexShrink:0}}/>
                      <span style={{ color:"#ca631f", fontWeight:600 }}>{p.contacts.length} contact{p.contacts.length>1?"s":""}</span>
                    </div>}
                  </div>
                  <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{ setEdit(p); setModal(true); }}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#ca631f", fontWeight:600 }}>
                      <Pencil size={12}/> Modifier
                    </button>
                    <button onClick={()=>{ setVue(p); setTimeout(()=>setContactModal(true),50); }}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#004f91", fontWeight:600 }}>
                      <MessageSquare size={12}/> Contact
                    </button>
                    <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}>
                      {deleting===p.id ? <Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/> : <Trash2 size={12} style={{color:"#dc2626"}}/>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ProspectModal open={modal} onClose={()=>setModal(false)} edit={edit} onSaved={charger}/>
      {vue && <ProspectVue p={vue} onClose={()=>setVue(null)}
        onEdit={()=>{ setEdit(vue); setVue(null); setModal(true); }}
        onAddContact={()=>setContactModal(true)}/>}
      {vue && <ContactModal open={contactModal} onClose={()=>setContactModal(false)} prospect={vue} onSaved={()=>{ setContactModal(false); charger(); }}/>}
    </div>
  );
}
