"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Loader2, MessageSquare, Pencil, Plus, Trash2, User, X } from "lucide-react";
import PhoneInput from "@/components/shared/PhoneInput";
import PaysSelect from "@/components/shared/PaysSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { parsePhoneNumber } from "libphonenumber-js";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const ETATS = [
  { value:"en_cours",  label:"En cours",  color:"#ca631f" },
  { value:"interesse", label:"Intéressé", color:"#004f91" },
  { value:"negatif",   label:"Négatif",   color:"#dc2626" },
  { value:"converti",  label:"Converti",  color:"#188038" },
];

// Début du cycle de prospection courant : date (YYYY-MM-DD) du dernier
// re-contact. Les échanges antérieurs appartiennent à des cycles passés.
function cycleCourantDebut(p:any): string|null {
  const dates = (p?.cycles||[]).map((c:any)=>c.recontacte_le).filter(Boolean).map((d:string)=>d.slice(0,10));
  return dates.length ? dates.sort().at(-1) : null;
}

// Badge de statut d'une carte prospect.
// L'issue de la relation (installé / décliné) prime sur l'indicateur d'activité ;
// sinon on retombe sur le délai depuis le dernier échange du cycle courant.
function badgeProspect(p:any) {
  if (p?.issue === "installe") return { label:"Installé", color:"#0D652D", bg:"rgba(13,101,45,0.10)" };
  if (p?.issue === "decline")  return { label:"Décliné",  color:"#6b7280", bg:"rgba(107,114,128,0.12)" };
  // Après un re-contact, on ne mesure l'activité que sur le cycle courant ;
  // les échanges des cycles passés ne doivent pas faire paraître la fiche « Inactif ».
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label:"Re-contacté", color:"#004f91", bg:"rgba(0,79,145,0.10)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 30) return { label:"En cours",   color:"#059669", bg:"rgba(5,150,105,0.10)" };
  if (jours <= 60) return { label:"En attente", color:"#ca631f", bg:"rgba(202,99,31,0.10)" };
  return                  { label:"Inactif",    color:"#dc2626", bg:"rgba(220,38,38,0.10)" };
}

// Une prospection conclue est aussitôt archivée dans « Précédents contacts »
// et passe en lecture seule.
function estFige(p:any) {
  return !!p?.issue;
}

type PointFocal = { prenom:string; nom:string; telephones:string[]; mails:string[] };
const EMPTY_FOCAL: PointFocal = { prenom:"", nom:"", telephones:[""], mails:[""] };

const EMPTY_FORM = {
  // morale
  nom:              "",
  siege_id:         null as number|null,
  siege_nom:        "",
  secteur_ids:      [] as number[],
  branche_ids:      [] as number[],
  activite_ids:     [] as number[],
  points_focaux:    [{ ...EMPTY_FOCAL }] as PointFocal[],
  // commun
  telephones:       [""] as string[],
  mails:            [""] as string[],
  siteweb:          "",
  linkedin:         "",
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

// ── Multi-téléphones ──────────────────────────────────────────────────────────
function MultiPhones({ values, onChange }: { values:string[]; onChange:(v:string[])=>void }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <label style={LS}>Téléphone(s) *</label>
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
        <label style={LS}>Email(s) *</label>
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
        nom:              edit.nom||"",
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
        siteweb:          edit.siteweb||"",
        linkedin:         edit.linkedin||"",
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
    if (!form.telephones.filter(Boolean).length) { setError("Au moins un numéro de téléphone est obligatoire"); return; }
    if (!form.mails.filter(Boolean).length) { setError("Au moins un email est obligatoire"); return; }
    if (!form.siteweb.trim()) { setError("Le site web est obligatoire pour une personne morale"); return; }
    for (const pf of form.points_focaux.filter(p=>p.nom.trim())) {
      if (!pf.telephones.filter(Boolean).length) { setError(`Point focal « ${pf.nom} » : au moins un téléphone est obligatoire`); return; }
      if (!pf.mails.filter(Boolean).length) { setError(`Point focal « ${pf.nom} » : au moins un email est obligatoire`); return; }
    }
    setSaving(true); setError("");
    try {
      const payload: any = {
        nom:       form.nom.trim(),
        telephones:form.telephones.filter(Boolean),
        mails:     form.mails.filter(Boolean),
        siteweb:   form.siteweb.trim()||null,
        linkedin:  form.linkedin.trim()||null,
        details:   form.details||null,
        siege_id:     form.siege_id||null,
        secteur_ids:  form.secteur_ids,
        branche_ids:  form.branche_ids,
        activite_ids: form.activite_ids,
        points_focaux: form.points_focaux
          .filter(pf=>pf.nom.trim())
          .map(pf=>({ prenom:pf.prenom.trim()||null, nom:pf.nom.trim(), telephones:pf.telephones.filter(Boolean), mails:pf.mails.filter(Boolean) })),
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
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={LS}>Site web *</label>
                      <input value={form.siteweb} onChange={e=>upd("siteweb",e.target.value)} placeholder="ex. exemple.com" style={IS}/>
                    </div>
                    <div>
                      <label style={LS}>LinkedIn</label>
                      <input value={form.linkedin} onChange={e=>upd("linkedin",e.target.value)} placeholder="linkedin.com/company/…" style={IS}/>
                    </div>
                  </div>
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
                <div style={{ minHeight:160 }}>
                  <RichTextEditor value={form.details} onChange={v=>upd("details",v)}/>
                </div>
              </div>

            </div>

          {/* ── Objet du ciblage ── */}
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

// ── Modal Échange ─────────────────────────────────────────────────────────────
const addDays = (iso:string, n:number) => { const d=new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

function EchangeModal({ open, onClose, prospect, edit, onSaved }: { open:boolean; onClose:()=>void; prospect:any; edit?:any; onSaved:(updated:any)=>void }) {
  const today = new Date().toISOString().slice(0,10);
  const isEdit = !!edit;
  const EMPTY_ECHANGE = { date_echange: today, commentaire:"", contact_par:"", interlocuteur:"", point_focal_id:"" };
  const [form, setForm]     = useState({ ...EMPTY_ECHANGE });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const upd = (k:string, v:string) => setForm(f=>({ ...f,[k]:v }));

  const pointsFocaux: any[] = prospect?.points_focaux || [];
  const estMorale = prospect?.type === "morale";
  const nomProspect = prospect?.nom || "";

  // Bornes de date. En création : après le dernier échange. En édition : entre
  // l'échange précédent et le suivant (ordre de création), et ≤ aujourd'hui.
  const dernierEchange = prospect?.echanges?.length
    ? [...prospect.echanges].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).at(-1)
    : null;
  const estPremier = !isEdit && !dernierEchange;

  let dateMin: string|undefined;
  let dateMax = today;
  if (isEdit) {
    const parCreation = [...(prospect?.echanges||[])].sort((a:any,b:any)=>(a.enregistre_le||"").localeCompare(b.enregistre_le||""));
    const idx  = parCreation.findIndex((x:any)=>x.id===edit.id);
    const prevN = idx>0 ? parCreation[idx-1] : null;
    const nextN = idx>=0 && idx<parCreation.length-1 ? parCreation[idx+1] : null;
    if (prevN) dateMin = addDays(prevN.date_echange, 1);
    if (nextN) dateMax = addDays(nextN.date_echange, -1);
  } else if (dernierEchange) {
    dateMin = addDays(dernierEchange.date_echange, 1);
  }

  useEffect(()=>{
    if (!open) return;
    if (isEdit) {
      setForm({
        date_echange:   edit.date_echange,
        commentaire:    edit.commentaire || "",
        contact_par:    edit.contact_par || "",
        interlocuteur:  edit.interlocuteur || "",
        point_focal_id: edit.point_focal_id ? String(edit.point_focal_id) : (estMorale && edit.interlocuteur ? "__autre" : ""),
      });
    } else {
      const defaut = dateMin && dateMin <= today ? dateMin : today;
      setForm({ ...EMPTY_ECHANGE, date_echange: defaut, interlocuteur: !estMorale ? nomProspect : "" });
    }
    setError(""); setOk(false);
  }, [open, prospect?.id, edit?.id]);

  const handleSave = async () => {
    if (!form.date_echange) { setError("La date est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      // Résoudre l'interlocuteur : si point focal sélectionné, on prend son nom
      let interlocuteur = form.interlocuteur.trim() || null;
      let point_focal_id: number | null = null;
      if (form.point_focal_id && form.point_focal_id !== "__autre") {
        point_focal_id = parseInt(form.point_focal_id);
        const pf = pointsFocaux.find((p:any) => p.id === point_focal_id);
        if (pf) interlocuteur = `${pf.prenom||""} ${pf.nom||""}`.trim();
      }
      const body = JSON.stringify({
        date_echange:   form.date_echange,
        commentaire:    form.commentaire || null,
        contact_par:    form.contact_par.trim() || null,
        interlocuteur,
        point_focal_id,
      });
      const res = isEdit
        ? await fetch(`${API}/prospects/echanges/${edit.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body })
        : await fetch(`${API}/prospects/${prospect.id}/echanges`, { method:"POST", headers:{"Content-Type":"application/json"}, body });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      setOk(true);
      const pr = await fetch(`${API}/prospects/${prospect.id}`);
      const updated = pr.ok ? await pr.json() : prospect;
      setTimeout(()=>{ setOk(false); onClose(); onSaved(updated); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:620, maxHeight:"90vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#004f91,#1a6ab0)", borderRadius:"20px 20px 0 0" }}/>
        <div style={{ padding:"24px 28px 28px" }}>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e" }}>{isEdit ? "Modifier l'échange" : "Enregistrer un échange"}</h2>
              <p style={{ fontSize:12, color:"#9aa5b4", marginTop:3 }}>{nomProspect}</p>
              {!isEdit && dernierEchange && (
                <p style={{ fontSize:11, color:"#ca631f", marginTop:4, fontWeight:600 }}>
                  Dernier échange enregistré : {new Date(dernierEchange.date_echange).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>

          <div style={{ display:"flex", flexDirection:"column" as const, gap:16 }}>

            {/* Date */}
            <div>
              <label style={LS}>{estPremier ? "Date du premier contact *" : "Date de l'échange *"}</label>
              <p style={{ fontSize:11, color:"#9aa5b4", marginBottom:6 }}>
                {estPremier
                  ? "Date à laquelle le premier contact a eu lieu — doit être ≤ aujourd'hui"
                  : dateMin
                    ? `Doit être ${new Date(dateMin).toLocaleDateString("fr-FR")} au plus tôt${dateMax!==today?` et ${new Date(dateMax).toLocaleDateString("fr-FR")} au plus tard`:" et ≤ aujourd'hui"}`
                    : "Doit être ≤ aujourd'hui"}
              </p>
              <input type="date" value={form.date_echange}
                max={dateMax} min={dateMin}
                onChange={e=>upd("date_echange",e.target.value)} style={IS}/>
            </div>

            {/* Participants */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {/* Côté investisseur */}
              <div>
                <label style={LS}>Interlocuteur (côté investisseur)</label>
                {estMorale && pointsFocaux.length > 0 ? (
                  <>
                    <select value={form.point_focal_id} onChange={e=>{ upd("point_focal_id",e.target.value); if(e.target.value!=="__autre") upd("interlocuteur",""); }}
                      style={{ ...IS, cursor:"pointer" }}>
                      <option value="">— Sélectionner —</option>
                      {pointsFocaux.map((pf:any)=>(
                        <option key={pf.id} value={String(pf.id)}>{`${pf.prenom||""} ${pf.nom||""}`.trim()}</option>
                      ))}
                      <option value="__autre">Autre (préciser)</option>
                    </select>
                    {form.point_focal_id === "__autre" && (
                      <input value={form.interlocuteur} onChange={e=>upd("interlocuteur",e.target.value)}
                        placeholder="Nom de l'interlocuteur" style={{ ...IS, marginTop:6 }}/>
                    )}
                  </>
                ) : (
                  <input value={form.interlocuteur} onChange={e=>upd("interlocuteur",e.target.value)}
                    placeholder={estMorale ? "Nom de l'interlocuteur" : nomProspect}
                    style={IS}/>
                )}
              </div>
              {/* Côté APIX */}
              <div>
                <label style={LS}>Agent APIX (vous)</label>
                <input value={form.contact_par} onChange={e=>upd("contact_par",e.target.value)}
                  placeholder="Votre nom" style={IS}/>
              </div>
            </div>

            {/* Compte-rendu */}
            <div>
              <label style={LS}>Compte-rendu de l'échange</label>
              <p style={{ fontSize:11, color:"#9aa5b4", marginBottom:8 }}>Résumé de la discussion, décisions, prochaines étapes…</p>
              <div style={{ minHeight:160 }}>
                <RichTextEditor value={form.commentaire} onChange={v=>upd("commentaire",v)}/>
              </div>
            </div>

            {/* Note anti-fraude */}
            <div style={{ background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.12)", borderRadius:10, padding:"10px 14px", display:"flex", gap:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:15, flexShrink:0 }}>🔒</span>
              <p style={{ fontSize:11, color:"#4a5568", lineHeight:1.6 }}>
                La date et l'heure de saisie réelles sont tracées automatiquement. L'échange reste <strong>modifiable pendant 24h</strong> après son enregistrement, puis devient définitivement immuable.
              </p>
            </div>

          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:14 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
            <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:9, border:"none",
                background:ok?"#059669":saving?"#ccc":"#004f91",
                color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
              {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
              {ok?"Enregistré !":saving?"Enregistrement…":isEdit?"Modifier l'échange":"Enregistrer l'échange"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal / formulaire contrainte ─────────────────────────────────────────────
function ContrainteModal({ open, onClose, prospectId, contrainte, onSaved }: {
  open:boolean; onClose:()=>void; prospectId:number; contrainte:any|null; onSaved:(c:any)=>void;
}) {
  const [form, setForm]     = useState({ description:"", solution_preconisee:"" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const upd = (k:string, v:string) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if (!open) return;
    setForm({
      description:         contrainte?.description         || "",
      solution_preconisee: contrainte?.solution_preconisee || "",
    });
    setError("");
  }, [open, contrainte?.id]);

  const handleSave = async () => {
    if (!form.description.trim()) { setError("La description est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const url    = contrainte ? `${API}/prospects/contraintes/${contrainte.id}` : `${API}/prospects/${prospectId}/contraintes`;
      const method = contrainte ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        description:         form.description.trim(),
        solution_preconisee: form.solution_preconisee.trim()||null,
      })});
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(6px)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:560, border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"20px 20px 0 0" }}/>
        <div style={{ padding:"22px 26px 26px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1a1a2e" }}>{contrainte?"Modifier la contrainte":"Nouvelle contrainte"}</h3>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={14} color="#4a5568"/></button>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
            <div>
              <label style={LS}>Description de la contrainte *</label>
              <div style={{ minHeight:120 }}>
                <RichTextEditor value={form.description} onChange={v=>upd("description",v)}/>
              </div>
            </div>
            <div>
              <label style={LS}>Solution préconisée</label>
              <div style={{ minHeight:100 }}>
                <RichTextEditor value={form.solution_preconisee} onChange={v=>upd("solution_preconisee",v)}/>
              </div>
            </div>
          </div>
          {error && <p style={{ fontSize:12, color:"#dc2626", marginTop:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:18 }}>
            <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:9, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none",
                background:saving?"#ccc":"#ca631f", color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
              {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
              {saving?"Enregistrement…":contrainte?"Modifier":"Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vue fiche prospect ────────────────────────────────────────────────────────
function ProspectVue({ p, onClose, onEdit, onContacter, onEditEchange, onRefresh, onRecontact, onRouvrir, readOnly }: any) {
  const [showEchanges,    setShowEchanges]    = useState(true);
  const [deletingEchange, setDeletingEchange] = useState<number|null>(null);
  const [secteurs, setSecteurs]   = useState<any[]>([]);
  const [branches, setBranches]   = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(()=>{
    Promise.all([
      fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); }).catch(()=>{});
  },[p.id]);

  // ─ Conclusion de la prospection
  const [showConclusion,   setShowConclusion]   = useState(false);
  const [issueForm,        setIssueForm]        = useState({ issue:"", commentaire:"" });
  const [savingIssue,      setSavingIssue]      = useState(false);
  const [issueOk,          setIssueOk]          = useState(false);

  // ─ Préservation du scroll pendant la saisie dans le formulaire de conclusion
  const scrollContainerRef  = useRef<HTMLDivElement>(null);
  const savedScrollRef      = useRef(0);
  const restoreScrollRef    = useRef(false);
  useLayoutEffect(() => {
    if (restoreScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
    }
    restoreScrollRef.current = false;
  });

  useEffect(()=>{
    setShowConclusion(false);
    setIssueForm({ issue:"", commentaire:"" });
  }, [p.id]);

  const handleSaveIssue = async () => {
    setSavingIssue(true); setIssueOk(false);
    const res = await fetch(`${API}/prospects/${p.id}/conclusion`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ issue: issueForm.issue||null, issue_commentaire: issueForm.commentaire||null }),
    });
    setSavingIssue(false);
    if (res.ok) { setIssueOk(true); onRefresh?.(); setTimeout(()=>{ setIssueOk(false); setShowConclusion(false); },1200); }
  };

  // Correction d'une conclusion saisie par erreur : remet à zéro sans archiver de cycle.
  const handleReopen = async () => {
    if (!confirm("Corriger / Rouvrir cette prospection ?\n\nLa conclusion sera effacée. Le prospect reviendra dans les onglets actifs.")) return;
    const res = await fetch(`${API}/prospects/${p.id}/rouvrir`, { method:"POST" });
    if (res.ok) onRouvrir?.();
    else { const d=await res.json().catch(()=>({})); alert(d.detail||"Erreur lors de la réouverture"); }
  };

  const handleDeleteEchange = async (id:number) => {
    if (!confirm("Supprimer cet échange ?")) return;
    setDeletingEchange(id);
    await fetch(`${API}/prospects/echanges/${id}`, { method:"DELETE" });
    setDeletingEchange(null);
    onRefresh();
  };

  const displayName = p.nom;

  // ── Système de design de la fiche
  const accent = "#004f91";
  const TXT="#1a1a2e", SUB="#5b6472", MUT="#98a1ad", SURF="#F6F4F2", BRD="#EAE7E4", DIV="#EFECE9";
  const card: any = { background:SURF, border:`1px solid ${BRD}`, borderRadius:12, padding:"14px 16px" };
  const linkStyle: any = { fontSize:13, fontWeight:600, color:"#004f91", wordBreak:"break-all" as const, textDecoration:"none" };
  const href = (u:string) => /^https?:\/\//.test(u) ? u : `https://${u}`;

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  const Section = ({ title, count, action, first, children }:any) => (
    <section style={{ marginTop:first?0:22, paddingTop:first?0:22, borderTop:first?"none":`1px solid ${DIV}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12, minHeight:24 }}>
        <h3 style={{ fontSize:11, fontWeight:700, color:MUT, letterSpacing:"0.12em", textTransform:"uppercase" as const }}>
          {title}{typeof count==="number" ? <span style={{ color:"#C5BFBB", fontWeight:700, marginLeft:7 }}>{count}</span> : null}
        </h3>
        {action || null}
      </div>
      {children}
    </section>
  );

  const SubLabel = ({ children, color }:any) => (
    <p style={{ fontSize:10, fontWeight:700, color:color||MUT, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:6 }}>{children}</p>
  );

  const issueMeta = p.issue==="installe"
    ? { label:"Installation au Sénégal", color:"#0D652D", bg:"rgba(13,101,45,0.10)" }
    : p.issue==="decline"
    ? { label:"Possibilité écartée", color:"#6b7280", bg:"rgba(107,114,128,0.10)" }
    : null;

  // Affichage en cascade Secteur → Branche → Activité (style entreprises)
  const NaemaCascade = ({ secIds, braIds, actIds }:{ secIds:number[]; braIds:number[]; actIds:number[] }) => (
    <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
      {secIds.map((secId:number)=>{
        const sec = secteurs.find(s=>s.id===secId); if (!sec) return null;
        const brasDuSec = branches.filter(b=>b.secteur_id===secId && braIds.includes(b.id));
        return (
          <div key={secId}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:brasDuSec.length?5:0 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#ca631f", flexShrink:0 }}/><span style={{ fontSize:12, fontWeight:700, color:"#ca631f" }}>{sec.nom}</span>
            </div>
            {brasDuSec.length>0 && <div style={{ paddingLeft:20, borderLeft:"2px solid rgba(202,99,31,0.15)", display:"flex", flexDirection:"column" as const, gap:5 }}>
              {brasDuSec.map((bra:any)=>{
                const actsDeBra = activites.filter(a=>a.branche_id===bra.id && actIds.includes(a.id));
                return (
                  <div key={bra.id}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:actsDeBra.length?4:0 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#004f91", flexShrink:0 }}/><span style={{ fontSize:11, fontWeight:600, color:"#004f91" }}>{bra.nom}</span>
                    </div>
                    {actsDeBra.length>0 && <div style={{ paddingLeft:18, display:"flex", flexDirection:"column" as const, gap:3 }}>
                      {actsDeBra.map((act:any)=>(
                        <div key={act.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ width:5, height:5, borderRadius:"50%", background:"#188038", flexShrink:0 }}/><span style={{ fontSize:11, color:"#188038", fontWeight:500 }}>{act.nom}</span>
                        </div>
                      ))}
                    </div>}
                  </div>
                );
              })}
            </div>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:720, maxHeight:"90vh", border:"1px solid #E8E5E3", boxShadow:"0 32px 80px rgba(0,0,0,0.2)", overflow:"hidden" }}>
        <div style={{ height:5, background:"linear-gradient(90deg,#004f91,#1a6ab0,#366FE3)" }}/>
        <div ref={scrollContainerRef} style={{ padding:"24px 28px 28px", overflowY:"auto" as const, maxHeight:"calc(90vh - 5px)" }}>

          {/* En-tête */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ flex:1, paddingRight:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`${accent}14`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Building2 size={18} style={{ color:accent }}/>
                </div>
                <div>
                  <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:TXT, lineHeight:1.3, marginBottom:2 }}>{displayName}</h2>
                  {p.siege_nom && <span style={{ fontSize:11, color:"#9aa5b4", fontWeight:500 }}>{p.siege_nom}</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" as const }}>
                {(()=>{ const b=badgeProspect(p); return b ? (
                  <span style={{ fontSize:11, fontWeight:700, color:b.color, background:b.bg, padding:"2px 9px", borderRadius:999 }}>{b.label}</span>
                ) : null; })()}
              </div>
            </div>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7, flexShrink:0 }}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Identité & coordonnées */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {p.telephones?.length > 0 && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}>
                <LBL>Téléphone(s)</LBL>
                {p.telephones.map((t:string,i:number)=>(
                  <p key={i} style={{ fontSize:13, fontWeight:600, color:TXT }}>{fmtPhone(t)}</p>
                ))}
              </div>
            )}
            {p.mails?.length > 0 && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}>
                <LBL>Email(s)</LBL>
                {p.mails.map((m:string,i:number)=>(
                  <p key={i} style={{ fontSize:13, fontWeight:600, color:TXT, wordBreak:"break-all" as const }}>{m}</p>
                ))}
              </div>
            )}
            {p.siteweb && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}>
                <LBL>Site web</LBL>
                <a href={href(p.siteweb)} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:accent, wordBreak:"break-all" as const, textDecoration:"none" }}>{p.siteweb}</a>
              </div>
            )}
            {p.linkedin && (
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"12px 14px" }}>
                <LBL>LinkedIn</LBL>
                <a href={href(p.linkedin)} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:accent, wordBreak:"break-all" as const, textDecoration:"none" }}>{p.linkedin}</a>
              </div>
            )}
          </div>

          {/* Points focaux */}
          {p.points_focaux?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <LBL>Points focaux</LBL>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                {p.points_focaux.map((pf:any,i:number)=>(
                  <div key={i} style={{ background:"#F8F7F6", borderRadius:10, padding:"10px 14px", fontSize:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" as const }}>
                      <span style={{ fontWeight:700, color:TXT }}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                      {pf.poste && <span style={{ color:"#9aa5b4" }}>— {pf.poste}</span>}
                    </div>
                    {pf.telephones?.filter(Boolean).length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:6 }}>
                        {pf.telephones.filter(Boolean).map((t:string,j:number)=>(
                          <span key={j} style={{ fontSize:11, fontWeight:600, color:"#366FE3", background:"rgba(54,111,227,0.08)", border:"1px solid rgba(54,111,227,0.2)", padding:"2px 9px", borderRadius:999 }}>{fmtPhone(t)}</span>
                        ))}
                      </div>
                    )}
                    {pf.mails?.filter(Boolean).length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:5 }}>
                        {pf.mails.filter(Boolean).map((m:string,j:number)=>(
                          <span key={j} style={{ fontSize:11, fontWeight:600, color:"#188038", background:"rgba(24,128,56,0.08)", border:"1px solid rgba(24,128,56,0.2)", padding:"2px 9px", borderRadius:999 }}>{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activités spécialisées (Secteur → Branche → Activité) */}
          {(p.secteur_ids?.length>0 || p.branche_ids?.length>0 || p.activite_ids?.length>0) && (
            <div style={{ marginBottom:16 }}>
              <LBL>Activités spécialisées</LBL>
              <NaemaCascade secIds={p.secteur_ids||[]} braIds={p.branche_ids||[]} actIds={p.activite_ids||[]}/>
            </div>
          )}

          {/* Détails / Commentaires */}
          {p.details && (
            <Section title="Commentaires">
              <div data-rte style={{ ...card, fontSize:13, color:SUB, lineHeight:1.7 }}
                dangerouslySetInnerHTML={{ __html:p.details }}/>
            </Section>
          )}

          {/* Objet du ciblage */}
          {(p.objet_projet || p.objet_intentions_etranger || p.objet_adequation_senegal || p.objet_commentaires) && (
            <Section title="Objet du ciblage">
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {p.objet_projet && (
                  <div style={card}>
                    <SubLabel>Lié à un projet</SubLabel>
                    <p style={{ fontSize:13, fontWeight:600, color:TXT }}>{p.objet_projet_titre || `Projet #${p.objet_projet_id}`}</p>
                  </div>
                )}
                {p.objet_intentions_etranger && (
                  <div style={card}>
                    <SubLabel>Intentions d'investissement à l'étranger</SubLabel>
                    {p.objet_intentions_details && <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_intentions_details }}/>}
                    {(p.objet_intentions_secteur_ids?.length>0 || p.objet_intentions_branche_ids?.length>0 || p.objet_intentions_activite_ids?.length>0) && (
                      <div style={{ marginTop:p.objet_intentions_details?10:0 }}>
                        <NaemaCascade secIds={p.objet_intentions_secteur_ids||[]} braIds={p.objet_intentions_branche_ids||[]} actIds={p.objet_intentions_activite_ids||[]}/>
                      </div>
                    )}
                  </div>
                )}
                {p.objet_adequation_senegal && (
                  <div style={card}>
                    <SubLabel>Activités prioritaires pour le Sénégal en phase avec le profil de l'entreprise</SubLabel>
                    {p.objet_adequation_details && <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_adequation_details }}/>}
                    {(p.objet_adequation_secteur_ids?.length>0 || p.objet_adequation_branche_ids?.length>0 || p.objet_adequation_activite_ids?.length>0) && (
                      <div style={{ marginTop:p.objet_adequation_details?10:0 }}>
                        <NaemaCascade secIds={p.objet_adequation_secteur_ids||[]} braIds={p.objet_adequation_branche_ids||[]} actIds={p.objet_adequation_activite_ids||[]}/>
                      </div>
                    )}
                  </div>
                )}
                {p.objet_commentaires && (
                  <div style={card}>
                    <SubLabel>Commentaires</SubLabel>
                    <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:p.objet_commentaires }}/>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Fil des échanges */}
          {p.echanges?.length > 0 && (
            <Section title="Historique des échanges" count={p.echanges.length}
              action={
                <button onClick={()=>setShowEchanges(o=>!o)}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:`1px solid ${BRD}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:600, color:SUB }}>
                  {showEchanges?<>Masquer <ChevronUp size={12}/></>:<>Afficher <ChevronDown size={12}/></>}
                </button>
              }>
              {showEchanges && (
                <div style={{ position:"relative" as const }}>
                  {/* Ligne verticale du fil */}
                  <div style={{ position:"absolute" as const, left:5, top:10, bottom:10, width:2, background:BRD, borderRadius:2 }}/>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                    {(()=>{
                      const maxEnregistreLe = Math.max(...p.echanges.map((ex:any)=>new Date(ex.enregistre_le).getTime()));
                      // Cycles triés par date de conclusion pour rattacher chaque échange à son cycle.
                      const cyclesAsc = [...(p.cycles||[])].sort((a:any,b:any)=>(a.conclu_le||"").localeCompare(b.conclu_le||""));
                      const cycleDe = (d:string) => cyclesAsc.find((cy:any)=>cy.conclu_le && d <= cy.conclu_le.slice(0,10)) || null;
                      let prevCycle: number|undefined;
                      return [...p.echanges].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).map((e:any,i:number)=>{
                      const cy    = cycleDe(e.date_echange);
                      const cnum  = cy ? cy.cycle_num : 0;   // 0 = cycle courant (actif)
                      const showSep = (p.cycles?.length>0) && cnum !== prevCycle;
                      prevCycle = cnum;
                      const retard = e.retard_jours || 0;
                      const retardLabel = retard === 0 ? "saisi le jour même" : `saisi ${retard} j après`;
                      const isLast    = new Date(e.enregistre_le).getTime() === maxEnregistreLe;
                      const within24h = Date.now() - new Date(e.enregistre_le).getTime() < 24*3600*1000;
                      const canAct    = !estFige(p) && isLast && within24h;
                      const sepLabel = cy
                        ? `Cycle ${cy.cycle_num} — ${cy.issue==="installe"?"Installé":"Décliné"}`
                        : "Cycle actuel";
                      const sepColor = cy ? (cy.issue==="installe"?"#0D652D":"#6b7280") : accent;
                      return (
                        <Fragment key={e.id}>
                          {showSep && (
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:i>0?8:0, marginBottom:2 }}>
                              <span style={{ width:10, height:10, borderRadius:"50%", background:sepColor, marginLeft:1, flexShrink:0, border:"2px solid #fff", boxShadow:`0 0 0 1.5px ${sepColor}` }}/>
                              <span style={{ fontSize:10, fontWeight:700, color:sepColor, letterSpacing:"0.1em", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>{sepLabel}</span>
                              <span style={{ flex:1, height:1, background:DIV }}/>
                            </div>
                          )}
                        <div style={{ paddingLeft:22, position:"relative" as const }}>
                          <div style={{ position:"absolute" as const, left:1, top:15, width:8, height:8, borderRadius:"50%", background:"#fff", border:`2px solid ${accent}` }}/>
                          <div style={card}>

                            {/* Ligne 1 : date déclarée + actions */}
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:(e.interlocuteur||e.contact_par)?6:8 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:TXT }}>
                                {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                              </span>
                              {canAct && (
                                <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                                  <button onClick={()=>onEditEchange?.(e)}
                                    style={{ display:"flex", alignItems:"center", gap:3, background:"transparent", border:`1px solid ${BRD}`, cursor:"pointer", borderRadius:7, padding:"3px 9px", fontSize:10, color:SUB, fontWeight:600 }}
                                    title="Modifiable pendant 24h">
                                    <Pencil size={10}/> Modifier
                                  </button>
                                  <button onClick={()=>handleDeleteEchange(e.id)} disabled={deletingEchange===e.id}
                                    style={{ background:"transparent", border:`1px solid ${BRD}`, cursor:"pointer", borderRadius:7, padding:"4px 6px" }}
                                    title="Supprimer">
                                    {deletingEchange===e.id
                                      ? <Loader2 size={11} style={{ color:"#dc2626", animation:"spin 1s linear infinite" }}/>
                                      : <Trash2 size={11} style={{ color:"#9aa5b4" }}/>}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Ligne 2 : interlocuteurs */}
                            {(e.interlocuteur || e.contact_par) && (
                              <div style={{ display:"flex", gap:14, flexWrap:"wrap" as const, marginBottom:8 }}>
                                {e.interlocuteur && (
                                  <span style={{ fontSize:11, color:SUB, display:"flex", alignItems:"center", gap:5 }}>
                                    <User size={11} style={{ color:MUT }}/> {e.interlocuteur}
                                  </span>
                                )}
                                {e.contact_par && (
                                  <span style={{ fontSize:11, color:MUT, display:"flex", alignItems:"center", gap:5 }}>
                                    <Building2 size={11}/> {e.contact_par}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Compte-rendu */}
                            {e.commentaire && (
                              <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7 }}
                                dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                            )}

                            {/* Pied : horodatage serveur */}
                            <p style={{ fontSize:10, color:MUT, fontFamily:"monospace", marginTop:10, paddingTop:8, borderTop:`1px solid ${DIV}` }}>
                              Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})} · {retardLabel}
                            </p>
                          </div>
                        </div>
                        </Fragment>
                      );
                    }); })()}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Historique des cycles de prospection passés (re-contacts) */}
          {p.cycles?.length > 0 && (
            <Section title="Cycles de prospection passés" count={p.cycles.length}>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {[...p.cycles].sort((a:any,b:any)=>b.cycle_num-a.cycle_num).map((cy:any)=>{
                  const inst = cy.issue==="installe";
                  const col  = inst ? "#0D652D" : "#6b7280";
                  const bg   = inst ? "rgba(13,101,45,0.10)" : "rgba(107,114,128,0.10)";
                  return (
                    <div key={cy.id} style={card}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:8, marginBottom: cy.issue_commentaire ? 8 : 0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:MUT }}>Cycle {cy.cycle_num}</span>
                          <span style={{ fontSize:11, fontWeight:700, color:col, background:bg, padding:"2px 10px", borderRadius:999 }}>
                            {inst ? "Installation au Sénégal" : "Possibilité écartée"}
                          </span>
                        </div>
                        <span style={{ fontSize:10, color:MUT, fontFamily:"monospace" }}>
                          {cy.conclu_le && `Conclu le ${new Date(cy.conclu_le).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})}`}
                          {cy.recontacte_le && ` · Re-contacté le ${new Date(cy.recontacte_le).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})}`}
                        </span>
                      </div>
                      {cy.issue_commentaire && (
                        <div data-rte style={{ fontSize:12, color:SUB, lineHeight:1.6 }}
                          dangerouslySetInnerHTML={{ __html:cy.issue_commentaire }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Conclusion de la prospection — tout en bas, visible dès qu'il y a un échange */}
          {p.echanges?.length > 0 && (
            p.issue ? (
              // ── État conclu : lecture seule + action contextuelle
              <Section title="Conclusion de la prospection"
                action={
                  p.issue==="decline" && onRecontact ? (
                    <button type="button" onClick={onRecontact}
                      style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, padding:"5px 14px", borderRadius:8, border:"none", background:accent, color:"#fff", cursor:"pointer" }}>
                      <MessageSquare size={11}/> Re-contacter
                    </button>
                  ) : p.issue==="installe" ? (
                    <button type="button" onClick={handleReopen}
                      style={{ fontSize:11, fontWeight:600, padding:"5px 12px", borderRadius:8, border:`1px solid ${BRD}`, background:"transparent", color:SUB, cursor:"pointer" }}>
                      Corriger la conclusion
                    </button>
                  ) : null
                }>
                <div style={{ ...card, borderLeft:`3px solid ${issueMeta?.color||BRD}` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:8, marginBottom: p.issue_commentaire ? 10 : 0 }}>
                    {issueMeta && (
                      <span style={{ fontSize:12, fontWeight:700, color:issueMeta.color, background:issueMeta.bg, padding:"3px 12px", borderRadius:999 }}>
                        {issueMeta.label}
                      </span>
                    )}
                    {p.issue_conclu_le && (
                      <span style={{ fontSize:10, color:MUT, fontFamily:"monospace" }}>
                        Conclu le {new Date(p.issue_conclu_le).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </span>
                    )}
                  </div>
                  {p.issue_commentaire && (
                    <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7 }}
                      dangerouslySetInnerHTML={{ __html:p.issue_commentaire }}/>
                  )}
                </div>
              </Section>
            ) : (
              // ── Non conclu : qualification de l'issue
              <Section title="Conclusion de la prospection"
                action={!readOnly ?
                  <button type="button" onClick={()=>{ setShowConclusion(o=>!o); setIssueForm({ issue:"", commentaire:"" }); }}
                    style={{ fontSize:11, fontWeight:700, padding:"5px 14px", borderRadius:8, border:"none", cursor:"pointer",
                      background: showConclusion ? "#1a1a2e" : "rgba(26,26,46,0.07)",
                      color: showConclusion ? "#fff" : SUB }}>
                    {showConclusion ? "Annuler" : "Clore la discussion"}
                  </button> : null
                }>
                {!showConclusion ? (
                  <p style={{ fontSize:12, color:MUT, fontStyle:"italic" }}>Prospection en cours — aucune conclusion enregistrée.</p>
                ) : (
                  <div style={{ ...card, display:"flex", flexDirection:"column" as const, gap:12 }}>
                    {/* Choix */}
                    <div style={{ display:"flex", gap:8 }}>
                      {([
                        { value:"installe", label:"Installation au Sénégal", color:"#0D652D", bg:"rgba(13,101,45,0.10)" },
                        { value:"decline",  label:"Possibilité écartée",      color:"#6b7280", bg:"rgba(107,114,128,0.10)" },
                      ] as const).map(o=>(
                        <button key={o.value} type="button"
                          onClick={()=>setIssueForm(f=>({...f, issue: f.issue===o.value?"":o.value}))}
                          style={{ flex:1, padding:"11px 6px", borderRadius:10, cursor:"pointer", fontSize:12, fontWeight:700, transition:"all .15s",
                            border:`1px solid ${issueForm.issue===o.value?o.color:BRD}`,
                            background:issueForm.issue===o.value?o.bg:"#fff",
                            color:issueForm.issue===o.value?o.color:MUT }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {/* Commentaire (obligatoire) */}
                    {issueForm.issue && (
                      <div>
                        <label style={LS}>Commentaire <span style={{ color:"#dc2626" }}>*</span></label>
                        <div style={{ minHeight:100 }}>
                          <RichTextEditor value={issueForm.commentaire} onChange={v=>{ savedScrollRef.current = scrollContainerRef.current?.scrollTop??0; restoreScrollRef.current=true; setIssueForm(f=>({...f,commentaire:v})); }}/>
                        </div>
                      </div>
                    )}
                    {/* Bouton enregistrer */}
                    {issueForm.issue && (()=>{
                      const commentaireVide = !issueForm.commentaire.replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").trim();
                      return (
                      <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10 }}>
                        {commentaireVide && <span style={{ fontSize:11, color:MUT }}>Le commentaire est obligatoire</span>}
                        <button onClick={handleSaveIssue} disabled={savingIssue||commentaireVide}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none",
                            background: issueOk ? "#059669" : (savingIssue||commentaireVide) ? "#ccc" : "#1a1a2e",
                            color:"#fff", fontWeight:700, cursor:(savingIssue||commentaireVide)?"not-allowed":"pointer", fontSize:13 }}>
                          {savingIssue?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
                          {issueOk ? "Conclu !" : savingIssue ? "Enregistrement…" : "Conclure la prospection"}
                        </button>
                      </div>
                      );
                    })()}
                  </div>
                )}
              </Section>
            )
          )}

          <div style={{ display:"flex", gap:8, marginTop:24, justifyContent:"space-between", borderTop:`1px solid ${DIV}`, paddingTop:18 }}>
            {(!readOnly && !estFige(p)) ? (
              <button onClick={onContacter}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                <MessageSquare size={14}/> Contacter
              </button>
            ) : <span/>}
            <div style={{ display:"flex", gap:8 }}>
              {!readOnly && (
                <button onClick={onEdit}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:10, border:`1px solid ${BRD}`, background:"transparent", color:SUB, fontWeight:700, cursor:"pointer", fontSize:13 }}>
                  <Pencil size={14}/> Modifier
                </button>
              )}
              <button onClick={onClose} style={{ padding:"10px 18px", borderRadius:10, border:"none", background:"#1a1a2e", color:"#fff", fontWeight:600, cursor:"pointer", fontSize:13 }}>Fermer</button>
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
  const [onglet,       setOnglet]       = useState<"cibles"|"historique"|"precedents">("cibles");
  const [modal,        setModal]        = useState(false);
  const [edit,         setEdit]         = useState<any>(null);
  const [vue,          setVue]          = useState<any>(null);
  const [echangeModal, setEchangeModal] = useState(false);
  const [echangeEdit,  setEchangeEdit]  = useState<any>(null);
  const [deleting,     setDeleting]     = useState<number|null>(null);
  const [q,            setQ]            = useState("");

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:"1", per_page:"50" });
      if (q) params.set("q", q);
      if (onglet==="precedents") {
        params.set("conclu", "true");
      } else {
        params.set("conclu", "false");
        if (onglet==="historique") params.set("contactes", "true");
        // "cibles" : pas de filtre contactes — on affiche tous les non-conclus
      }
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

  // Re-contacter une entreprise « Déclinée » : nouvelle prospection, historique conservé.
  const handleRecontact = async (id:number) => {
    if (!confirm("Re-contacter cette entreprise ?\n\nUne nouvelle prospection démarre. Tout l'historique précédent (échanges, contraintes, conclusion) est conservé et consultable.")) return;
    const res = await fetch(`${API}/prospects/${id}/recontact`, { method:"POST" });
    if (res.ok) { setVue(null); setOnglet("historique"); }
    else { const d=await res.json().catch(()=>({})); alert(d.detail||"Erreur lors du re-contact"); }
  };

  return (
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        [data-rte] ul{padding-left:20px;list-style-type:disc}
        [data-rte] ol{padding-left:20px;list-style-type:decimal}
        [data-rte] li{margin-bottom:2px}
        [data-rte] b,[data-rte] strong{font-weight:700}
        [data-rte] i,[data-rte] em{font-style:italic}
        [data-rte] *{font-family:var(--font-google-sans);font-size:13px}
      `}</style>

      <div style={{ marginBottom:8 }}>
        <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Prospects</h1>
      </div>

      {/* Onglets */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderBottom:"1px solid #E8E5E3", marginBottom:24 }}>
        <div style={{ display:"flex" }}>
          {([["cibles","Investisseurs ciblés"],["historique","Historique des contacts"],["precedents","Précédents contacts"]] as const).map(([key,label])=>(
            <button key={key} onClick={()=>setOnglet(key)}
              style={{ padding:"14px 22px", border:"none", borderBottom:`2px solid ${onglet===key?"#ca631f":"transparent"}`, background:"transparent", color:onglet===key?"#ca631f":"#9aa5b4", fontWeight:600, cursor:"pointer", fontSize:13, transition:"all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
        {onglet!=="precedents" && (
          <button onClick={()=>{ setEdit(null); setModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#ca631f,#e07a3a)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(202,99,31,0.3)", marginBottom:4 }}>
            <Plus size={15}/> Nouveau prospect
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }}/>
        </div>
      ) : prospects.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun prospect</p>
          <p style={{ fontSize:13, marginTop:4 }}>{onglet==="cibles"?"Ajoutez votre premier prospect ciblé":onglet==="historique"?"Aucun échange enregistré pour l'instant":"Aucune prospection conclue pour l'instant"}</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize:13, color:"#9aa5b4", marginBottom:16 }}>{total} prospect{total>1?"s":""}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
            {prospects.map(p=>{
              const displayName = p.nom;
              const accent = "#004f91";
              const activite = badgeProspect(p);
              return (
                <div key={p.id} onClick={()=>setVue(p)}
                  style={{ background:"#fff", borderTop:"1px solid #E8E5E3", borderRight:"1px solid #E8E5E3", borderBottom:"1px solid #E8E5E3", borderLeft:`3px solid ${accent}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={ev=>{ ev.currentTarget.style.boxShadow=`0 4px 16px ${accent}22`; }}
                  onMouseLeave={ev=>{ ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:p.siege_nom?2:10 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", flex:1 }}>{displayName}</div>
                    {onglet==="cibles" && p.nb_echanges > 0 ? (
                      <span style={{ flexShrink:0, fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.10)", border:"1px solid rgba(0,79,145,0.2)", padding:"2px 8px", borderRadius:999 }}>Contacté</span>
                    ) : activite ? (
                      <span style={{ flexShrink:0, fontSize:10, fontWeight:700, color:activite.color, background:activite.bg, border:`1px solid ${activite.color}33`, padding:"2px 8px", borderRadius:999 }}>
                        {activite.label}
                      </span>
                    ) : null}
                  </div>
                  {p.siege_nom && <div style={{ fontSize:11, color:"#9aa5b4", fontWeight:500, marginBottom:10 }}>{p.siege_nom}</div>}
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:12 }}>
                    {p.mails?.length > 0 && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><div style={{ width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0 }}/><span style={{ color:"#4a5568", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Mail : {p.mails[0]}</span></div>}
                    {p.siteweb && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><div style={{ width:6,height:6,borderRadius:"50%",background:"#B7410E",flexShrink:0 }}/><span style={{ color:"#4a5568", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Site web : {p.siteweb}</span></div>}
                    {p.nb_echanges > 0 && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}><MessageSquare size={10} style={{ color:accent,flexShrink:0 }}/><span style={{ color:accent, fontWeight:600 }}>{p.nb_echanges} échange{p.nb_echanges>1?"s":""} · {p.dernier_contact_par}</span></div>}
                  </div>
                  {onglet==="precedents" ? (
                    <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setVue(p)}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#4a5568", fontWeight:600 }}>
                        Consulter
                      </button>
                      {p.issue==="decline" && (
                        <button onClick={()=>handleRecontact(p.id)}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#004f91", fontWeight:600 }}>
                          <MessageSquare size={12}/> Re-contacter
                        </button>
                      )}
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}
                        title="Supprimer définitivement (test)">
                        {deleting===p.id?<Loader2 size={12} style={{ color:"#dc2626",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"#dc2626" }}/>}
                      </button>
                    </div>
                  ) : onglet==="cibles" && p.nb_echanges > 0 ? (
                    // Prospect déjà contacté dans "Investisseurs ciblés" : lecture seule
                    <div style={{ borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setVue(p)}
                        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#4a5568", fontWeight:600 }}>
                        Consulter
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{ setEdit(p); setModal(true); }}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:accent, fontWeight:600 }}>
                        <Pencil size={12}/> Modifier
                      </button>
                      {!estFige(p) && (
                        <button onClick={()=>{ setEchangeEdit(null); setVue(p); setTimeout(()=>setEchangeModal(true),50); }}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#004f91", fontWeight:600 }}>
                          <MessageSquare size={12}/> Contacter
                        </button>
                      )}
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}>
                        {deleting===p.id?<Loader2 size={12} style={{ color:"#dc2626",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"#dc2626" }}/>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <ProspectModal open={modal} onClose={()=>setModal(false)} edit={edit} onSaved={charger}/>
      {vue && <ProspectVue p={vue} onClose={()=>setVue(null)} readOnly={onglet==="precedents"}
        onEdit={()=>{ setEdit(vue); setVue(null); setModal(true); }}
        onContacter={()=>{ setEchangeEdit(null); setEchangeModal(true); }}
        onEditEchange={(e:any)=>{ setEchangeEdit(e); setEchangeModal(true); }}
        onRecontact={()=>handleRecontact(vue.id)}
        onRouvrir={()=>{ setVue(null); charger(); setOnglet(vue.nb_echanges > 0 ? "historique" : "cibles"); }}
        onRefresh={async()=>{ await charger(); const r=await fetch(`${API}/prospects/${vue.id}`); if(r.ok) setVue(await r.json()); }}/>}
      {vue && <EchangeModal open={echangeModal} onClose={()=>{ setEchangeModal(false); setEchangeEdit(null); }} prospect={vue} edit={echangeEdit}
        onSaved={(updated)=>{ setEchangeModal(false); setEchangeEdit(null); setVue(updated); charger(); }}/>}
    </div>
  );
}
