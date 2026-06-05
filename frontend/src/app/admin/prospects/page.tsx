"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Clock, Loader2, MessageSquare, Pencil, Plus, Trash2, User, X } from "lucide-react";
import PhoneInput from "@/components/shared/PhoneInput";
import PaysSelect from "@/components/shared/PaysSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import NaemaSelect from "@/components/shared/NaemaSelect";

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

type PointFocal = { prenom:string; nom:string; telephones:string[]; mails:string[] };
const EMPTY_FOCAL: PointFocal = { prenom:"", nom:"", telephones:[""], mails:[""] };

const EMPTY_FORM = {
  type:             "physique" as "physique"|"morale",
  // physique
  prenom:           "",
  nom:              "",
  pays_origine_id:  null as number|null,
  pays_origine_nom: "",
  // morale
  siege_id:         null as number|null,
  siege_nom:        "",
  secteur_ids:      [] as number[],
  branche_ids:      [] as number[],
  activite_ids:     [] as number[],
  points_focaux:    [{ ...EMPTY_FOCAL }] as PointFocal[],
  // commun
  telephones:       [""] as string[],
  mails:            [""] as string[],
  details:          "",
  // objet du ciblage
  objet_projet:              false,
  objet_projet_id:           null as number|null,
  objet_intentions_etranger:      false,
  objet_intentions_secteur_ids:   [] as number[],
  objet_intentions_branche_ids:   [] as number[],
  objet_intentions_activite_ids:  [] as number[],
  objet_intentions_details:       "",
  objet_adequation_senegal:       false,
  objet_adequation_secteur_ids:   [] as number[],
  objet_adequation_branche_ids:   [] as number[],
  objet_adequation_activite_ids:  [] as number[],
  objet_adequation_details:       "",
  objet_commentaires:             "",
};

// ── Sélecteur type ────────────────────────────────────────────────────────────
function TypeSelector({ value, onChange }: { value:"physique"|"morale"; onChange:(v:"physique"|"morale")=>void }) {
  return (
    <div style={{ display:"flex", gap:0, borderRadius:12, overflow:"hidden", border:"1px solid #C5BFBB", marginBottom:24 }}>
      {([["physique","Personne physique"],["morale","Personne morale"]] as const).map(([key,label]) => (
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

// ── Multi-téléphones ──────────────────────────────────────────────────────────
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
        {values.map((tel,i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6 }}>
            <div style={{ flex:1 }}>
              <PhoneInput value={tel} onChange={v=>{ const a=[...values]; a[i]=v; onChange(a); }} placeholder="Numéro"/>
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

// ── Multi-mails ───────────────────────────────────────────────────────────────
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
        {values.map((mail,i) => (
          <div key={i} style={{ display:"flex", gap:6 }}>
            <input type="email" value={mail} placeholder="contact@exemple.com"
              onChange={e=>{ const a=[...values]; a[i]=e.target.value; onChange(a); }}
              style={{ ...IS, flex:1 }}/>
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

// ── Carte point focal ─────────────────────────────────────────────────────────
function PointFocalCard({ pf, idx, onUpdate, onRemove, canRemove }: {
  pf:PointFocal; idx:number;
  onUpdate:(v:PointFocal)=>void;
  onRemove:()=>void;
  canRemove:boolean;
}) {
  const upd = (k:keyof PointFocal, v:any) => onUpdate({ ...pf, [k]:v });
  return (
    <div style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:12, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <User size={13} style={{ color:"#ca631f" }}/>
          <span style={{ fontSize:12, fontWeight:600, color:"#4a5568" }}>Contact {idx+1}</span>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove}
            style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
            <Trash2 size={13} style={{ color:"#dc2626" }}/>
          </button>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        <div>
          <label style={{ ...LS, fontSize:11 }}>Prénom *</label>
          <input value={pf.prenom} onChange={e=>upd("prenom",e.target.value)} placeholder="Prénom" style={IS}/>
        </div>
        <div>
          <label style={{ ...LS, fontSize:11 }}>Nom *</label>
          <input value={pf.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom" style={IS}/>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <MultiPhones values={pf.telephones} onChange={v=>upd("telephones",v)}/>
        <MultiMails  values={pf.mails}      onChange={v=>upd("mails",v)}/>
      </div>
    </div>
  );
}

// ── Toggle Oui/Non avec zone de détails optionnelle ──────────────────────────
function ToggleField({ label, desc, value, onChange, children }: {
  label:string; desc?:string; value:boolean; onChange:(v:boolean)=>void; children?:React.ReactNode;
}) {
  return (
    <div style={{ border:"1px solid #E8E5E3", borderRadius:12, overflow:"hidden" }}>
      <button type="button" onClick={()=>onChange(!value)}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"12px 16px", background:value?"rgba(202,99,31,0.05)":"#fff", border:"none", cursor:"pointer", textAlign:"left" as const }}>
        <div>
          <span style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{label}</span>
          {desc && <p style={{ fontSize:11, color:"#9aa5b4", marginTop:2 }}>{desc}</p>}
        </div>
        <div style={{ flexShrink:0, marginLeft:12, width:36, height:20, borderRadius:10, background:value?"#ca631f":"#C5BFBB", position:"relative" as const, transition:"background 0.2s" }}>
          <div style={{ position:"absolute" as const, top:2, left:value?18:2, width:16, height:16, borderRadius:8, background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
        </div>
      </button>
      {value && children && (
        <div style={{ padding:"12px 16px 16px", borderTop:"1px solid #F2F0EF", background:"rgba(202,99,31,0.02)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Sélecteur de projet ───────────────────────────────────────────────────────
function ProjetSelect({ value, onChange }: { value:number|null; onChange:(id:number|null)=>void }) {
  const [projets, setProjets] = useState<any[]>([]);
  useEffect(()=>{
    fetch(`${API}/projets?per_page=100&admin=true`)
      .then(r=>r.json()).then(d=>setProjets(d.data||[])).catch(()=>{});
  }, []);
  return (
    <select value={value??""} onChange={e=>onChange(e.target.value?Number(e.target.value):null)} style={IS}>
      <option value="">— Sélectionner un projet —</option>
      {projets.map((p:any)=><option key={p.id} value={p.id}>{p.titre_projet}</option>)}
    </select>
  );
}

// ── Modal création/édition Prospect ──────────────────────────────────────────
function ProspectModal({ open, onClose, edit, onSaved }: {
  open:boolean; onClose:()=>void; edit:any; onSaved:()=>void;
}) {
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);

  const upd = (k:string, v:any) => setForm(f=>({ ...f, [k]:v }));

  useEffect(()=>{
    if (!open) return;
    if (edit) {
      setForm({
        type:             edit.type||"physique",
        prenom:           edit.prenom||"",
        nom:              edit.nom||"",
        pays_origine_id:  edit.pays_origine_id||null,
        pays_origine_nom: edit.pays_origine_nom||"",
        siege_id:         edit.siege_id||null,
        siege_nom:        edit.siege_nom||"",
        secteur_ids:      edit.secteur_ids||[],
        branche_ids:      edit.branche_ids||[],
        activite_ids:     edit.activite_ids||[],
        points_focaux:    edit.points_focaux?.length
          ? edit.points_focaux.map((pf:any) => ({ prenom:pf.prenom||"", nom:pf.nom||"", telephones:pf.telephones?.length?pf.telephones:[""], mails:pf.mails?.length?pf.mails:[""] }))
          : [{ ...EMPTY_FOCAL }],
        telephones:       edit.telephones?.length ? edit.telephones : [""],
        mails:            edit.mails?.length ? edit.mails : [""],
        details:          edit.details||"",
        objet_projet:              edit.objet_projet||false,
        objet_projet_id:           edit.objet_projet_id||null,
        objet_intentions_etranger:      edit.objet_intentions_etranger||false,
        objet_intentions_secteur_ids:   edit.objet_intentions_secteur_ids||[],
        objet_intentions_branche_ids:   edit.objet_intentions_branche_ids||[],
        objet_intentions_activite_ids:  edit.objet_intentions_activite_ids||[],
        objet_intentions_details:       edit.objet_intentions_details||"",
        objet_adequation_senegal:       edit.objet_adequation_senegal||false,
        objet_adequation_secteur_ids:   edit.objet_adequation_secteur_ids||[],
        objet_adequation_branche_ids:   edit.objet_adequation_branche_ids||[],
        objet_adequation_activite_ids:  edit.objet_adequation_activite_ids||[],
        objet_adequation_details:       edit.objet_adequation_details||"",
        objet_commentaires:             edit.objet_commentaires||"",
      });
    } else {
      setForm({ ...EMPTY_FORM, points_focaux:[{ ...EMPTY_FOCAL }] });
    }
    setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire"); return; }
    if (form.type==="physique" && !form.prenom.trim()) { setError("Le prénom est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = {
        type:      form.type,
        nom:       form.nom.trim(),
        telephones:form.telephones.filter(Boolean),
        mails:     form.mails.filter(Boolean),
        details:   form.details||null,
        // objet du ciblage
        objet_projet:              form.objet_projet,
        objet_projet_id:           form.objet_projet && form.objet_projet_id ? form.objet_projet_id : null,
        objet_intentions_etranger:      form.objet_intentions_etranger,
        objet_intentions_secteur_ids:   form.objet_intentions_etranger ? form.objet_intentions_secteur_ids : [],
        objet_intentions_branche_ids:   form.objet_intentions_etranger ? form.objet_intentions_branche_ids : [],
        objet_intentions_activite_ids:  form.objet_intentions_etranger ? form.objet_intentions_activite_ids : [],
        objet_intentions_details:       form.objet_intentions_etranger ? (form.objet_intentions_details||null) : null,
        objet_adequation_senegal:       form.objet_adequation_senegal,
        objet_adequation_secteur_ids:   form.objet_adequation_senegal ? form.objet_adequation_secteur_ids : [],
        objet_adequation_branche_ids:   form.objet_adequation_senegal ? form.objet_adequation_branche_ids : [],
        objet_adequation_activite_ids:  form.objet_adequation_senegal ? form.objet_adequation_activite_ids : [],
        objet_adequation_details:       form.objet_adequation_senegal ? (form.objet_adequation_details||null) : null,
        objet_commentaires:             form.objet_commentaires||null,
      };
      if (form.type==="physique") {
        payload.prenom          = form.prenom.trim()||null;
        payload.pays_origine_id = form.pays_origine_id||null;
      } else {
        payload.siege_id     = form.siege_id||null;
        payload.secteur_ids  = form.secteur_ids;
        payload.branche_ids  = form.branche_ids;
        payload.activite_ids = form.activite_ids;
        payload.points_focaux= form.points_focaux
          .filter(pf=>pf.nom.trim())
          .map(pf=>({ prenom:pf.prenom.trim()||null, nom:pf.nom.trim(), telephones:pf.telephones.filter(Boolean), mails:pf.mails.filter(Boolean) }));
      }
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
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:820, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"20px 20px 0 0" }}/>
        <div style={{ padding:"28px 32px 32px" }}>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.15rem", color:"#1a1a2e" }}>
              {edit ? "Modifier le prospect" : "Nouveau prospect"}
            </h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568"/></button>
          </div>

          <TypeSelector value={form.type} onChange={v=>upd("type",v)}/>

          {/* ── Personne physique ── */}
          {form.type === "physique" && (
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
              <div>
                <p style={SEC}>Identification de l'investisseur</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div>
                    <label style={LS}>Prénom *</label>
                    <input value={form.prenom} onChange={e=>upd("prenom",e.target.value)} placeholder="Prénom" style={IS}/>
                  </div>
                  <div>
                    <label style={LS}>Nom *</label>
                    <input value={form.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom de famille" style={IS}/>
                  </div>
                </div>
                <div>
                  <label style={LS}>Pays d'origine</label>
                  <PaysSelect value={form.pays_origine_nom} onChange={nom=>upd("pays_origine_nom",nom)} onChangeId={id=>upd("pays_origine_id",id)} placeholder="Sélectionner le pays d'origine"/>
                </div>
              </div>
              <div>
                <p style={SEC}>Contact</p>
                <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                  <MultiPhones values={form.telephones} onChange={v=>upd("telephones",v)}/>
                  <MultiMails  values={form.mails}      onChange={v=>upd("mails",v)}/>
                </div>
              </div>
              <div>
                <p style={SEC}>Détails sur l'investisseur</p>
                <p style={{ fontSize:12, color:"#888", marginBottom:10, marginTop:-6 }}>Profil, contexte, secteurs d'intérêt, historique de relation…</p>
                <div style={{ minHeight:160 }}>
                  <RichTextEditor value={form.details} onChange={v=>upd("details",v)}/>
                </div>
              </div>
            </div>
          )}

          {/* ── Personne morale ── */}
          {form.type === "morale" && (
            <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

              {/* Identification */}
              <div>
                <p style={SEC}>Identification</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <label style={LS}>Dénomination sociale *</label>
                    <input value={form.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom de l'entreprise / organisation" style={{ ...IS, fontSize:14, fontWeight:600 }}/>
                  </div>
                  <div>
                    <label style={LS}>Pays du siège social</label>
                    <PaysSelect value={form.siege_nom} onChange={nom=>upd("siege_nom",nom)} onChangeId={id=>upd("siege_id",id)} placeholder="Sélectionner le pays du siège social"/>
                  </div>
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

              {/* Activités NAEMA */}
              <div>
                <p style={SEC}>Activités spécialisées</p>
                <NaemaSelect
                  secteurIds={form.secteur_ids}   onChangeSecteurs={ids=>upd("secteur_ids",ids)}
                  brancheIds={form.branche_ids}   onChangeBranches={ids=>upd("branche_ids",ids)}
                  activiteIds={form.activite_ids} onChangeActivites={ids=>upd("activite_ids",ids)}
                />
              </div>

              {/* Points focaux */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <p style={{ ...SEC, marginBottom:0, paddingBottom:0, borderBottom:"none" }}>Points focaux</p>
                  <button type="button"
                    onClick={()=>upd("points_focaux",[...form.points_focaux,{ ...EMPTY_FOCAL }])}
                    style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>
                    <Plus size={12}/> Ajouter un contact
                  </button>
                </div>
                <div style={{ borderTop:"1px solid #E8E5E3", paddingTop:12, display:"flex", flexDirection:"column", gap:10 }}>
                  {form.points_focaux.map((pf,i)=>(
                    <PointFocalCard key={i} pf={pf} idx={i}
                      onUpdate={v=>{ const arr=[...form.points_focaux]; arr[i]=v; upd("points_focaux",arr); }}
                      onRemove={()=>upd("points_focaux",form.points_focaux.filter((_,j)=>j!==i))}
                      canRemove={form.points_focaux.length>1}
                    />
                  ))}
                </div>
              </div>

              {/* Commentaires */}
              <div>
                <p style={SEC}>Commentaires</p>
                <p style={{ fontSize:12, color:"#888", marginBottom:10, marginTop:-6 }}>Contexte de la relation, notes, observations…</p>
                <div style={{ minHeight:160 }}>
                  <RichTextEditor value={form.details} onChange={v=>upd("details",v)}/>
                </div>
              </div>

            </div>
          )}

          {/* ── Objet du ciblage (commun physique + morale) ── */}
          <div style={{ marginTop:24, paddingTop:24, borderTop:"1px solid #E8E5E3" }}>
            <p style={SEC}>Objet du ciblage</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>

              <ToggleField
                label="Lié à un projet particulier ?"
                desc="L'investisseur est ciblé dans le cadre d'un projet d'investissement spécifique"
                value={form.objet_projet} onChange={v=>{ upd("objet_projet",v); if(!v) upd("objet_projet_id",null); }}>
                <div style={{ marginTop:8 }}>
                  <label style={LS}>Sélectionner le projet</label>
                  <ProjetSelect value={form.objet_projet_id} onChange={id=>upd("objet_projet_id",id)}/>
                </div>
              </ToggleField>

              <ToggleField
                label="Intentions d'investissement à l'étranger ?"
                desc="L'investisseur a exprimé des intentions d'investir hors de son pays d'origine"
                value={form.objet_intentions_etranger} onChange={v=>upd("objet_intentions_etranger",v)}>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:12, marginTop:8 }}>
                  <div>
                    <label style={LS}>Activités visées</label>
                    <NaemaSelect
                      secteurIds={form.objet_intentions_secteur_ids} onChangeSecteurs={ids=>upd("objet_intentions_secteur_ids",ids)}
                      brancheIds={form.objet_intentions_branche_ids} onChangeBranches={ids=>upd("objet_intentions_branche_ids",ids)}
                      activiteIds={form.objet_intentions_activite_ids} onChangeActivites={ids=>upd("objet_intentions_activite_ids",ids)}
                    />
                  </div>
                  <div>
                    <label style={LS}>Détails</label>
                    <div style={{ minHeight:120 }}>
                      <RichTextEditor value={form.objet_intentions_details} onChange={v=>upd("objet_intentions_details",v)}/>
                    </div>
                  </div>
                </div>
              </ToggleField>

              <ToggleField
                label="Adéquation profil / destination Sénégal"
                desc="Le profil de l'investisseur correspond aux opportunités et secteurs prioritaires du Sénégal"
                value={form.objet_adequation_senegal} onChange={v=>upd("objet_adequation_senegal",v)}>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:12, marginTop:8 }}>
                  <div>
                    <label style={LS}>Activités prioritaires pour le Sénégal en phase avec son profil</label>
                    <NaemaSelect
                      secteurIds={form.objet_adequation_secteur_ids} onChangeSecteurs={ids=>upd("objet_adequation_secteur_ids",ids)}
                      brancheIds={form.objet_adequation_branche_ids} onChangeBranches={ids=>upd("objet_adequation_branche_ids",ids)}
                      activiteIds={form.objet_adequation_activite_ids} onChangeActivites={ids=>upd("objet_adequation_activite_ids",ids)}
                    />
                  </div>
                  <div>
                    <label style={LS}>Détails de l'adéquation</label>
                    <div style={{ minHeight:120 }}>
                      <RichTextEditor value={form.objet_adequation_details} onChange={v=>upd("objet_adequation_details",v)}/>
                    </div>
                  </div>
                </div>
              </ToggleField>

              <div>
                <label style={LS}>Commentaires sur le ciblage</label>
                <p style={{ fontSize:12, color:"#888", marginBottom:8 }}>Contexte général, stratégie d'approche, notes internes…</p>
                <div style={{ minHeight:120 }}>
                  <RichTextEditor value={form.objet_commentaires} onChange={v=>upd("objet_commentaires",v)}/>
                </div>
              </div>

            </div>
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:16 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24, paddingTop:20, borderTop:"1px solid #F2F0EF" }}>
            <button onClick={onClose}
              style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none",
                background: ok?"#059669":saving?"#ccc":"#ca631f",
                color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
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
  const upd = (k:string,v:string) => setForm(f=>({ ...f,[k]:v }));

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
                {prospect?.type==="morale" ? prospect?.nom : `${prospect?.prenom||""} ${prospect?.nom||""}`.trim()}
              </p>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:12 }}>
            <div><label style={LS}>Projet / Objet du contact *</label><input value={form.projet_nom} onChange={e=>upd("projet_nom",e.target.value)} placeholder="Ex : Investissement secteur agro" style={IS}/></div>
            <div><label style={LS}>Description</label><textarea value={form.projet_description} onChange={e=>upd("projet_description",e.target.value)} rows={2} style={{ ...IS,resize:"vertical" as const }}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={LS}>Date du premier contact</label><input type="date" value={form.date_premier_contact} onChange={e=>upd("date_premier_contact",e.target.value)} style={IS}/></div>
              <div><label style={LS}>État d'avancement</label>
                <select value={form.etat_avancement} onChange={e=>upd("etat_avancement",e.target.value)} style={IS}>
                  {ETATS.map(et=><option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </div>
            </div>
            <div><label style={LS}>Commentaires</label><textarea value={form.commentaires} onChange={e=>upd("commentaires",e.target.value)} rows={2} style={{ ...IS,resize:"vertical" as const }}/></div>
            <div><label style={LS}>Contraintes</label><textarea value={form.contraintes} onChange={e=>upd("contraintes",e.target.value)} rows={2} style={{ ...IS,resize:"vertical" as const }}/></div>
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

// ── Vue fiche prospect ────────────────────────────────────────────────────────
function ProspectVue({ p, onClose, onEdit, onAddContact }: any) {
  const LBL = ({t}:{t:string}) => <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:5 }}>{t}</p>;
  const [showContacts, setShowContacts] = useState(true);
  const displayName = p.type==="morale" ? p.nom : `${p.prenom||""} ${p.nom||""}`.trim();

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:700, maxHeight:"90vh", border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.25)", overflow:"hidden" }}>
        <div style={{ height:5, background:`linear-gradient(90deg,${p.type==="morale"?"#004f91,#1a6ab0":"#ca631f,#e07a3a"})` }}/>
        <div style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>

          {/* En-tête */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`rgba(${p.type==="morale"?"0,79,145":"202,99,31"},0.1)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {p.type==="morale"?<Building2 size={18} style={{ color:"#004f91" }}/>:<User size={18} style={{ color:"#ca631f" }}/>}
              </div>
              <div>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{displayName}</h2>
                <span style={{ fontSize:11, fontWeight:600,
                  color:p.type==="morale"?"#004f91":"#ca631f",
                  background:p.type==="morale"?"rgba(0,79,145,0.08)":"rgba(202,99,31,0.08)",
                  border:`1px solid ${p.type==="morale"?"rgba(0,79,145,0.2)":"rgba(202,99,31,0.2)"}`,
                  padding:"2px 9px", borderRadius:999 }}>
                  {p.type==="morale"?"Personne morale":"Personne physique"}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Infos de base */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {p.type==="physique" && p.pays_origine_nom && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Pays d'origine"/><p style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{p.pays_origine_nom}</p></div>
            )}
            {p.type==="morale" && p.siege_nom && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Pays du siège social"/><p style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{p.siege_nom}</p></div>
            )}
            {p.telephones?.length > 0 && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Téléphone(s)"/>
                {p.telephones.map((t:string,i:number)=><p key={i} style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{t}</p>)}
              </div>
            )}
            {p.mails?.length > 0 && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}><LBL t="Email(s)"/>
                {p.mails.map((m:string,i:number)=><p key={i} style={{ fontSize:13,fontWeight:600,color:"#1a1a2e" }}>{m}</p>)}
              </div>
            )}
          </div>

          {/* Points focaux (morale) */}
          {p.type==="morale" && p.points_focaux?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <LBL t={`Points focaux (${p.points_focaux.length})`}/>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {p.points_focaux.map((pf:any,i:number)=>(
                  <div key={i} style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", marginBottom:4 }}>{pf.prenom} {pf.nom}</p>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" as const }}>
                      {pf.telephones?.filter(Boolean).map((t:string,j:number)=><span key={j} style={{ fontSize:12, color:"#4a5568" }}>{t}</span>)}
                      {pf.mails?.filter(Boolean).map((m:string,j:number)=><span key={j} style={{ fontSize:12, color:"#004f91" }}>{m}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Détails / Commentaires */}
          {p.details && (
            <div style={{ marginBottom:16 }}>
              <LBL t={p.type==="morale"?"Commentaires":"Détails"}/>
              <div data-rte style={{ background:"rgba(202,99,31,0.04)", border:"1px solid rgba(202,99,31,0.12)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#4a5568", lineHeight:1.7 }}
                dangerouslySetInnerHTML={{ __html:p.details }}/>
            </div>
          )}

          {/* Objet du ciblage */}
          {(p.objet_projet || p.objet_intentions_etranger || p.objet_adequation_senegal || p.objet_commentaires) && (
            <div style={{ marginBottom:16 }}>
              <LBL t="Objet du ciblage"/>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {p.objet_projet && (
                  <div style={{ background:"rgba(202,99,31,0.05)", border:"1px solid rgba(202,99,31,0.15)", borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", marginBottom:4 }}>Lié à un projet</p>
                    <p style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{p.objet_projet_titre || `Projet #${p.objet_projet_id}`}</p>
                  </div>
                )}
                {p.objet_intentions_etranger && (
                  <div style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", marginBottom:6 }}>Intentions d'investissement à l'étranger</p>
                    {p.objet_intentions_details && <div data-rte style={{ fontSize:13, color:"#4a5568", lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_intentions_details }}/>}
                  </div>
                )}
                {p.objet_adequation_senegal && (
                  <div style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", marginBottom:6 }}>Adéquation profil / destination Sénégal</p>
                    {p.objet_adequation_details && <div data-rte style={{ fontSize:13, color:"#4a5568", lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_adequation_details }}/>}
                  </div>
                )}
                {p.objet_commentaires && (
                  <div style={{ background:"#F8F7F6", border:"1px solid #E8E5E3", borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", marginBottom:6 }}>Commentaires</p>
                    <div data-rte style={{ fontSize:13, color:"#4a5568", lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_commentaires }}/>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contacts (historique) */}
          {p.contacts?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <button onClick={()=>setShowContacts(o=>!o)}
                style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:showContacts?10:0 }}>
                <LBL t={`Contacts (${p.contacts.length})`}/>
                {showContacts?<ChevronUp size={12} style={{ color:"#9aa5b4",marginBottom:5 }}/>:<ChevronDown size={12} style={{ color:"#9aa5b4",marginBottom:5 }}/>}
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
                        {c.date_premier_contact && <p style={{ fontSize:11, color:"#9aa5b4", display:"flex", alignItems:"center", gap:4 }}><Clock size={10}/>{new Date(c.date_premier_contact).toLocaleDateString("fr-FR")}</p>}
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
      params.set("contactes", onglet==="contactes"?"true":"false");
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
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un prospect…" style={{ ...IS,paddingLeft:14 }}/>
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
              const accent = p.type==="morale" ? "#004f91" : "#ca631f";
              return (
                <div key={p.id} onClick={()=>setVue(p)}
                  style={{ background:"#fff", borderTop:"1px solid #E8E5E3", borderRight:"1px solid #E8E5E3", borderBottom:"1px solid #E8E5E3", borderLeft:`3px solid ${accent}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={ev=>{ ev.currentTarget.style.boxShadow=`0 4px 16px ${accent}22`; }}
                  onMouseLeave={ev=>{ ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`rgba(${p.type==="morale"?"0,79,145":"202,99,31"},0.1)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {p.type==="morale"?<Building2 size={13} style={{ color:accent }}/>:<User size={13} style={{ color:accent }}/>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{displayName}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:10 }}>
                    {p.type==="physique" && p.pays_origine_nom && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><div style={{ width:5,height:5,borderRadius:"50%",background:accent,flexShrink:0 }}/><span style={{ color:"#4a5568" }}>{p.pays_origine_nom}</span></div>}
                    {p.type==="morale" && p.siege_nom && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><div style={{ width:5,height:5,borderRadius:"50%",background:accent,flexShrink:0 }}/><span style={{ color:"#4a5568" }}>{p.siege_nom}</span></div>}
                    {p.contacts?.length > 0 && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><MessageSquare size={10} style={{ color:accent,flexShrink:0 }}/><span style={{ color:accent, fontWeight:600 }}>{p.contacts.length} contact{p.contacts.length>1?"s":""}</span></div>}
                  </div>
                  <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{ setEdit(p); setModal(true); }}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:`rgba(${p.type==="morale"?"0,79,145":"202,99,31"},0.08)`, border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:accent, fontWeight:600 }}>
                      <Pencil size={12}/> Modifier
                    </button>
                    <button onClick={()=>{ setVue(p); setTimeout(()=>setContactModal(true),50); }}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#004f91", fontWeight:600 }}>
                      <MessageSquare size={12}/> Contact
                    </button>
                    <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}>
                      {deleting===p.id?<Loader2 size={12} style={{ color:"#dc2626",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"#dc2626" }}/>}
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
