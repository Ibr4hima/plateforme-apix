"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, FileText, Globe, Link2, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Pencil, Phone, Plus, Send, Trash2, Upload, User, Video, X } from "lucide-react";
import PhoneInput from "@/components/shared/PhoneInput";
import PaysSelect from "@/components/shared/PaysSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FButton, FButtonGhost, FError, FInfo, fuiLabel, fuiInput } from "@/components/shared/FormUI";
import { parsePhoneNumber } from "libphonenumber-js";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

// Canaux de contact possibles lors d'un échange.
const CANAUX = [
  "Mail",
  "Appel téléphonique",
  "SMS",
  "WhatsApp",
  "Signal",
  "Telegram",
  "Visioconférence",
  "Réunion physique",
  "LinkedIn",
  "Courrier postal",
  "Autre",
];

// Canaux dont la coordonnée est un numéro de téléphone (→ PhoneInput).
const PHONE_CANAUX = ["Appel téléphonique", "SMS", "WhatsApp", "Signal", "Telegram"];

// Libellé et placeholder du champ coordonnée selon le canal choisi.
function canalContactMeta(canal: string): { label: string; placeholder: string } | null {
  switch (canal) {
    case "Mail":               return { label: "Adresse e-mail de l'interlocuteur",        placeholder: "ex. contact@entreprise.com" };
    case "Appel téléphonique":
    case "SMS":
    case "WhatsApp":
    case "Signal":
    case "Telegram":           return { label: "Numéro de téléphone de l'interlocuteur",   placeholder: "" };
    case "Visioconférence":    return { label: "Plateforme / lien",       placeholder: "ex. Zoom, Teams, Google Meet…" };
    case "Réunion physique":   return { label: "Lieu de la rencontre",    placeholder: "ex. Siège APIX, Dakar" };
    case "LinkedIn":           return { label: "Profil LinkedIn",         placeholder: "ex. linkedin.com/in/…" };
    case "Courrier postal":    return { label: "Adresse postale",         placeholder: "Adresse d'envoi" };
    case "Autre":              return { label: "Coordonnée / précision",  placeholder: "Préciser le moyen de contact" };
    default: return null;
  }
}

// Icône lucide associée à chaque canal de contact.
function canalIcon(canal: string): any {
  switch (canal) {
    case "Mail":               return Mail;
    case "Appel téléphonique": return Phone;
    case "SMS":                return MessageSquare;
    case "WhatsApp":           return MessageCircle;
    case "Signal":             return MessageCircle;
    case "Telegram":           return Send;
    case "Visioconférence":    return Video;
    case "Réunion physique":   return MapPin;
    case "LinkedIn":           return User;
    case "Courrier postal":    return Send;
    default:                   return MessageSquare;
  }
}

// Affichage propre de la coordonnée (numéro formaté avec espaces, reste tel quel).
function canalContactDisplay(canal: string, contact: string): string {
  if (!contact) return "";
  if (PHONE_CANAUX.includes(canal)) return fmtPhone(contact);
  return contact;
}

function isValidEmail(email: string): boolean {
  if (!email) return true;
  if (/\s/.test(email)) return false;
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return false;
  if ((email.match(/@/g)||[]).length !== 1) return false;
  const domain = email.slice(atIdx + 1);
  if (!domain || !domain.includes(".")) return false;
  if (email.endsWith("@") || email.endsWith(".")) return false;
  const tld = domain.split(".").at(-1)!;
  return tld.length >= 2;
}

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

// Contraintes rattachées à un cycle de prospection donné.
// cy === null → cycle courant (actif) ; sinon → cycle archivé.
// Les contraintes portent un `cycle_num` fixé à la création (= nombre de cycles
// déjà archivés à ce moment). Une contrainte de cycle_num = k correspond donc
// au cycle archivé portant cycle_num = k+1 ; les contraintes du cycle courant
// ont cycle_num = nombre de cycles archivés. On s'appuie sur cette numérotation
// (et non sur les dates) car une contrainte et la conclusion d'un cycle peuvent
// tomber le même jour, ce qui rendait une comparaison de dates ambiguë.
function contraintesDuCycle(p:any, cy:any): any[] {
  const nbCycles = (p?.cycles || []).length;
  return (p?.contraintes || []).filter((c:any)=>{
    return cy ? (c.cycle_num === cy.cycle_num - 1) : (c.cycle_num === nbCycles);
  });
}

// Contraintes exprimées lors du cycle de prospection courant (actif).
function contraintesCycleCourant(p:any): any[] {
  return contraintesDuCycle(p, null);
}

// Échanges rattachés à un cycle donné (null = cycle courant).
// Les échanges n'ont pas de cycle_num : on les rattache via leur timestamp
// d'enregistrement (`enregistre_le`) comparé aux dates de conclusion des cycles.
// Un échange enregistré avant (ou au moment de) la conclusion d'un cycle lui
// appartient ; ceux postérieurs à toutes les conclusions sont du cycle courant.
// On compare des timestamps complets (et non des dates) pour lever l'ambiguïté
// d'un échange et d'une conclusion survenus le même jour.
function echangesDuCycle(p:any, cy:any): any[] {
  const cyclesAsc = [...(p?.cycles||[])].sort((a:any,b:any)=>(a.conclu_le||"").localeCompare(b.conclu_le||""));
  const cycleDe = (iso:string) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return cyclesAsc.find((c:any)=>c.conclu_le && t <= new Date(c.conclu_le).getTime()) || null;
  };
  return (p?.echanges||[]).filter((e:any)=>{
    const found = cycleDe(e.enregistre_le);
    return cy ? (found && found.id===cy.id) : !found;
  });
}

// Badge de statut d'une carte prospect.
// L'issue de la relation (installé / décliné) prime sur l'indicateur d'activité ;
// sinon on retombe sur le délai depuis le dernier échange du cycle courant.
function badgeProspect(p:any) {
  if (p?.issue === "installe") return { label:"Installation à venir", color:"#188038", bg:"rgba(24,128,56,0.08)" };
  if (p?.issue === "decline")  return { label:"Décliné",  color:"#6b7280", bg:"#F2F0EF" };
  // Après un re-contact, on ne mesure l'activité que sur le cycle courant ;
  // les échanges des cycles passés ne doivent pas faire paraître la fiche « Inactif ».
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label:"À recontacter", color:"#004f91", bg:"rgba(0,79,145,0.07)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90)  return { label:"En cours",   color:"#188038", bg:"rgba(24,128,56,0.08)" };
  if (jours <= 120) return { label:"En attente", color:"#ca631f", bg:"rgba(202,99,31,0.08)" };
  return                  { label:"Inactif",    color:"#dc2626", bg:"rgba(220,38,38,0.07)" };
}

// Une prospection conclue est aussitôt archivée dans « Précédents contacts »
// et passe en lecture seule.
function estFige(p:any) {
  return !!p?.issue;
}

type PointFocal = { prenom:string; nom:string; telephones:string[]; mails:string[]; est_principal:boolean };
const EMPTY_FOCAL: PointFocal = { prenom:"", nom:"", telephones:[""], mails:[""], est_principal:false };

const EMPTY_FORM = {
  // morale
  nom:              "",
  siege_id:         null as number|null,
  siege_nom:        "",
  secteur_ids:      [] as number[],
  branche_ids:      [] as number[],
  activite_ids:     [] as number[],
  points_focaux:    [] as PointFocal[],
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
        <label style={{ ...fuiLabel, marginBottom:0 }}>Téléphone(s) *</label>
        <button type="button" onClick={()=>onChange([...values,""])}
          style={{ fontSize:11, fontWeight:600, color:"#004f91", background:"rgba(0,79,145,0.07)", border:"none", borderRadius:6, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontFamily:"var(--font-google-sans)" }}>
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
        <label style={{ ...fuiLabel, marginBottom:0 }}>Email(s) *</label>
        <button type="button" onClick={()=>onChange([...values,""])}
          style={{ fontSize:11, fontWeight:600, color:"#004f91", background:"rgba(0,79,145,0.07)", border:"none", borderRadius:6, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontFamily:"var(--font-google-sans)" }}>
          <Plus size={11}/> Ajouter
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {values.map((mail,i) => (
          <div key={i} style={{ display:"flex", gap:6 }}>
            <FInput type="email" value={mail} placeholder="contact@exemple.com"
              onChange={e=>{ const a=[...values]; a[i]=e.target.value; onChange(a); }}
              style={{ flex:1 }}/>
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
function PointFocalCard({ pf, idx, onUpdate, onRemove }: {
  pf:PointFocal; idx:number;
  onUpdate:(v:PointFocal)=>void;
  onRemove:()=>void;
}) {
  const upd = (k:keyof PointFocal, v:any) => onUpdate({ ...pf, [k]:v });
  return (
    <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <User size={13} style={{ color:"#004f91" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Point focal {idx+1}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#4a5568", cursor:"pointer" }}>
            <input type="checkbox" checked={pf.est_principal} onChange={e=>upd("est_principal",e.target.checked)}/> Principal
          </label>
          <button type="button" onClick={onRemove}
            style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
            <Trash2 size={13} style={{ color:"#dc2626" }}/>
          </button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        <div>
          <label style={{ ...fuiLabel, fontSize:11 }}>Prénom *</label>
          <FInput value={pf.prenom} onChange={e=>upd("prenom",e.target.value)} placeholder="Prénom"/>
        </div>
        <div>
          <label style={{ ...fuiLabel, fontSize:11 }}>Nom *</label>
          <FInput value={pf.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom"/>
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
    <div style={{ border:"1px solid #E4E1DE", borderRadius:12, overflow:"hidden" }}>
      <button type="button" onClick={()=>onChange(!value)}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"12px 16px", background:value?"rgba(0,79,145,0.04)":"#fff", border:"none", cursor:"pointer", textAlign:"left" as const, fontFamily:"var(--font-google-sans)" }}>
        <div>
          <span style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{label}</span>
          {desc && <p style={{ fontSize:11, color:"#9aa5b4", marginTop:2 }}>{desc}</p>}
        </div>
        <div style={{ flexShrink:0, marginLeft:12, width:36, height:20, borderRadius:10, background:value?"#004f91":"#D8D4D0", position:"relative" as const, transition:"background 0.2s" }}>
          <div style={{ position:"absolute" as const, top:2, left:value?18:2, width:16, height:16, borderRadius:8, background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
        </div>
      </button>
      {value && children && (
        <div style={{ padding:"12px 16px 16px", borderTop:"1px solid #F2F0EF", background:"rgba(0,79,145,0.02)" }}>
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
    <FSelect value={value??""} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}>
      <option value="">— Sélectionner un projet —</option>
      {projets.map((p:any)=><option key={p.id} value={p.id}>{p.titre_projet}</option>)}
    </FSelect>
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
        points_focaux:    (edit.points_focaux||[]).map((pf:any) => ({ prenom:pf.prenom||"", nom:pf.nom||"", telephones:pf.telephones?.length?pf.telephones:[""], mails:pf.mails?.length?pf.mails:[""], est_principal:pf.est_principal||false })),
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
      setForm({ ...EMPTY_FORM, points_focaux:[] });
    }
    setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire"); return; }
    if (!form.telephones.filter(Boolean).length) { setError("Au moins un numéro de téléphone est obligatoire"); return; }
    if (!form.mails.filter(Boolean).length) { setError("Au moins un email est obligatoire"); return; }
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
          .map(pf=>({ prenom:pf.prenom.trim()||null, nom:pf.nom.trim(), telephones:pf.telephones.filter(Boolean), mails:pf.mails.filter(Boolean), est_principal:pf.est_principal||false })),
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
    <FModal open={open} onClose={onClose} maxWidth={820}
      title={edit ? "Modifier le prospect" : "Nouveau prospect"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving||ok} loading={saving} success={ok}>
          {ok ? "Enregistré !" : saving ? "Enregistrement…" : edit ? "Modifier" : "Créer le prospect"}
        </FButton>
      </>}>

      {/* Identification */}
      <FSection title="Identification">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <FLabel>Dénomination sociale *</FLabel>
            <FInput value={form.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom de l'entreprise / organisation" style={{ fontSize:14, fontWeight:600 }}/>
          </div>
          <div>
            <FLabel>Pays du siège social</FLabel>
            <PaysSelect value={form.siege_nom} onChange={nom=>upd("siege_nom",nom)} onChangeId={id=>upd("siege_id",id)} placeholder="Sélectionner le pays du siège social"/>
          </div>
        </div>
      </FSection>

      {/* Contact */}
      <FSection title="Contact">
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <MultiPhones values={form.telephones} onChange={v=>upd("telephones",v)}/>
          <MultiMails  values={form.mails}      onChange={v=>upd("mails",v)}/>
          <FGrid cols={2}>
            <div>
              <FLabel>Site web</FLabel>
              <FInput value={form.siteweb} onChange={e=>upd("siteweb",e.target.value)} placeholder="ex. exemple.com"/>
            </div>
            <div>
              <FLabel>LinkedIn</FLabel>
              <FInput value={form.linkedin} onChange={e=>upd("linkedin",e.target.value)} placeholder="linkedin.com/company/…"/>
            </div>
          </FGrid>
        </div>
      </FSection>

      {/* Activités NAEMA */}
      <FSection title="Activités spécialisées">
        <NaemaSelect
          secteurIds={form.secteur_ids}   onChangeSecteurs={ids=>upd("secteur_ids",ids)}
          brancheIds={form.branche_ids}   onChangeBranches={ids=>upd("branche_ids",ids)}
          activiteIds={form.activite_ids} onChangeActivites={ids=>upd("activite_ids",ids)}
        />
      </FSection>

      {/* Points focaux */}
      <FSection title="Points focaux">
        {form.points_focaux.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:10 }}>
            {form.points_focaux.map((pf,i)=>(
              <PointFocalCard key={i} pf={pf} idx={i}
                onUpdate={v=>{ const arr=[...form.points_focaux]; arr[i]=v; upd("points_focaux",arr); }}
                onRemove={()=>upd("points_focaux",form.points_focaux.filter((_,j)=>j!==i))}
              />
            ))}
          </div>
        )}
        <button type="button"
          onClick={()=>upd("points_focaux",[...form.points_focaux,{ ...EMPTY_FOCAL, est_principal: form.points_focaux.length===0 }])}
          style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s", fontFamily:"var(--font-google-sans)" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Plus size={14} color="#9aa5b4"/>
          <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un point focal</span>
        </button>
      </FSection>

      {/* Commentaires */}
      <FSection title="Commentaires">
        <div style={{ minHeight:160 }}>
          <RichTextEditor value={form.details} onChange={v=>upd("details",v)}/>
        </div>
      </FSection>

      {/* Objet du ciblage */}
      <FSection title="Objet du ciblage">
        <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>

          <ToggleField
            label="Lié à un projet particulier ?"
            desc="L'investisseur est ciblé dans le cadre d'un projet d'investissement spécifique"
            value={form.objet_projet} onChange={v=>{ upd("objet_projet",v); if(!v) upd("objet_projet_id",null); }}>
            <div style={{ marginTop:8 }}>
              <FLabel>Sélectionner le projet</FLabel>
              <ProjetSelect value={form.objet_projet_id} onChange={id=>upd("objet_projet_id",id)}/>
            </div>
          </ToggleField>

          <ToggleField
            label="Intentions d'investissement à l'étranger ?"
            desc="L'investisseur a exprimé des intentions d'investir hors de son pays d'origine"
            value={form.objet_intentions_etranger} onChange={v=>upd("objet_intentions_etranger",v)}>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:12, marginTop:8 }}>
              <div>
                <FLabel>Activités visées</FLabel>
                <NaemaSelect
                  secteurIds={form.objet_intentions_secteur_ids} onChangeSecteurs={ids=>upd("objet_intentions_secteur_ids",ids)}
                  brancheIds={form.objet_intentions_branche_ids} onChangeBranches={ids=>upd("objet_intentions_branche_ids",ids)}
                  activiteIds={form.objet_intentions_activite_ids} onChangeActivites={ids=>upd("objet_intentions_activite_ids",ids)}
                />
              </div>
              <div>
                <FLabel>Détails</FLabel>
                <div style={{ minHeight:120 }}>
                  <RichTextEditor value={form.objet_intentions_details} onChange={v=>upd("objet_intentions_details",v)}/>
                </div>
              </div>
            </div>
          </ToggleField>

          <ToggleField
            label="Adéquation Profil Investisseur / Secteurs prioritaires"
            desc="Le profil de l'investisseur correspond aux opportunités et secteurs prioritaires du Sénégal"
            value={form.objet_adequation_senegal} onChange={v=>upd("objet_adequation_senegal",v)}>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:12, marginTop:8 }}>
              <div>
                <FLabel>Activités prioritaires pour le Sénégal en phase avec son profil</FLabel>
                <NaemaSelect
                  secteurIds={form.objet_adequation_secteur_ids} onChangeSecteurs={ids=>upd("objet_adequation_secteur_ids",ids)}
                  brancheIds={form.objet_adequation_branche_ids} onChangeBranches={ids=>upd("objet_adequation_branche_ids",ids)}
                  activiteIds={form.objet_adequation_activite_ids} onChangeActivites={ids=>upd("objet_adequation_activite_ids",ids)}
                />
              </div>
              <div>
                <FLabel>Commentaires</FLabel>
                <div style={{ minHeight:120 }}>
                  <RichTextEditor value={form.objet_adequation_details} onChange={v=>upd("objet_adequation_details",v)}/>
                </div>
              </div>
            </div>
          </ToggleField>

          <div>
            <FLabel>Commentaires sur le ciblage</FLabel>
            <div style={{ minHeight:120 }}>
              <RichTextEditor value={form.objet_commentaires} onChange={v=>upd("objet_commentaires",v)}/>
            </div>
          </div>

        </div>
      </FSection>

      {error && <FError>{error}</FError>}
    </FModal>
  );
}

// ── Modal Échange ─────────────────────────────────────────────────────────────
const addDays = (iso:string, n:number) => { const d=new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

function EchangeModal({ open, onClose, prospect, edit, onSaved }: { open:boolean; onClose:()=>void; prospect:any; edit?:any; onSaved:(updated:any)=>void }) {
  const today = new Date().toISOString().slice(0,10);
  const isEdit = !!edit;
  const EMPTY_ECHANGE = { date_echange: "", commentaire:"", contact_par:"", interlocuteur:"", point_focal_id:"", canal:"", canal_contact:"" };
  const [form, setForm]     = useState({ ...EMPTY_ECHANGE });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [ok,     setOk]     = useState(false);
  const [emailError, setEmailError] = useState("");
  const [pdfQueue, setPdfQueue] = useState<{file:File;titre:string}[]>([]);
  const [compteRendu, setCompteRendu] = useState<{file:File;titre:string}|null>(null);
  const [fichiersExistants, setFichiersExistants] = useState<any[]>([]);
  const [localContraintes, setLocalContraintes] = useState<any[]>([]);
  const [showContrainteForm, setShowContrainteForm] = useState(false);
  const [editContrainteId, setEditContrainteId] = useState<number|null>(null);
  const [bulletContraintes, setBulletContraintes] = useState<string[]>([""]);
  const [savingContrainte, setSavingContrainte] = useState(false);
  const [contrainteError, setContrainteError] = useState("");
  const bulletRefs = useRef<(HTMLInputElement|null)[]>([]);
  const upd = (k:string, v:string) => setForm(f=>({ ...f,[k]:v }));

  // Fichiers existants répartis par catégorie (mode édition)
  const crExistant      = fichiersExistants.find((f:any)=>f.categorie==="compte_rendu") || null;
  const autresExistants = fichiersExistants.filter((f:any)=>f.categorie!=="compte_rendu");
  const hasCompteRendu  = !!compteRendu || !!crExistant;

  const pointsFocaux: any[] = prospect?.points_focaux || [];
  const estMorale = prospect?.type === "morale";
  const nomProspect = prospect?.nom || "";

  // Bornes de date. En création : après le dernier échange. En édition : entre
  // l'échange précédent et le suivant (ordre de création), et ≤ aujourd'hui.
  const dernierEchange = prospect?.echanges?.length
    ? [...prospect.echanges].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).at(-1)
    : null;
  // Dernier échange du cycle courant uniquement (pour l'affichage du rappel).
  const echangesCourant = echangesDuCycle(prospect, null);
  const dernierEchangeCourant = echangesCourant.length
    ? [...echangesCourant].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).at(-1)
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
  } else {
    const lastCycle = (prospect?.cycles||[]).length > 0
      ? [...prospect.cycles].sort((a:any,b:any)=>b.cycle_num-a.cycle_num)[0]
      : null;
    const cycleConcluDate = lastCycle?.conclu_le ? lastCycle.conclu_le.slice(0,10) : null;
    const dernierEchangeDate = dernierEchange ? dernierEchange.date_echange : null;
    if (cycleConcluDate && (!dernierEchangeDate || cycleConcluDate > dernierEchangeDate)) {
      dateMin = cycleConcluDate;
    } else if (dernierEchangeDate) {
      dateMin = addDays(dernierEchangeDate, 1);
    }
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
        canal:          edit.canal || "",
        canal_contact:  edit.canal_contact || "",
      });
    } else {
      setForm({ ...EMPTY_ECHANGE, interlocuteur: !estMorale ? nomProspect : "" });
    }
    setLocalContraintes(contraintesCycleCourant(prospect));
    setShowContrainteForm(false); setEditContrainteId(null);
    setBulletContraintes([""]); setContrainteError("");
    setError(""); setOk(false); setEmailError(""); setPdfQueue([]); setCompteRendu(null);
    if (isEdit && edit?.id) {
      fetch(`${API}/prospects/echanges/${edit.id}/fichiers`).then(r=>r.json()).then(setFichiersExistants).catch(()=>{});
    } else {
      setFichiersExistants([]);
    }
  }, [open, prospect?.id, edit?.id]);

  const ouvrirContrainte = (c:any|null) => {
    setEditContrainteId(c?.id ?? null);
    setBulletContraintes(c ? [c.description.replace(/<[^>]+>/g,"").trim()] : [""]);
    setContrainteError("");
    setShowContrainteForm(true);
    setTimeout(()=>bulletRefs.current[0]?.focus(), 50);
  };

  const annulerContrainte = () => {
    setShowContrainteForm(false); setEditContrainteId(null);
    setBulletContraintes([""]); setContrainteError("");
  };

  const supprimerContrainte = async (id:number) => {
    try {
      const res = await fetch(`${API}/prospects/contraintes/${id}`, { method:"DELETE" });
      if (!res.ok && res.status!==204) { const d=await res.json().catch(()=>({})); throw new Error(d.detail||"Erreur"); }
      setLocalContraintes(prev => prev.filter((x:any)=>x.id!==id));
      if (editContrainteId===id) annulerContrainte();
    } catch(e:any) { setContrainteError(e.message); }
  };

  const enregistrerContrainte = async () => {
    const lines = bulletContraintes.map(b=>b.trim()).filter(Boolean);
    if (!lines.length) { setContrainteError("Au moins une contrainte est requise"); return; }
    setSavingContrainte(true); setContrainteError("");
    try {
      if (editContrainteId) {
        const res = await fetch(`${API}/prospects/contraintes/${editContrainteId}`, {
          method:"PATCH", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ description: lines[0] }),
        });
        if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
        const saved = await res.json();
        setLocalContraintes(prev => prev.map((x:any)=>x.id===saved.id ? saved : x));
      } else {
        const savedAll = await Promise.all(lines.map(line =>
          fetch(`${API}/prospects/${prospect.id}/contraintes`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ description: line }),
          }).then(async r => { if (!r.ok) { const d=await r.json(); throw new Error(d.detail||"Erreur"); } return r.json(); })
        ));
        setLocalContraintes(prev => [...prev, ...savedAll]);
      }
      annulerContrainte();
    } catch(e:any) { setContrainteError(e.message); }
    finally { setSavingContrainte(false); }
  };

  const handleSave = async () => {
    if (!form.date_echange) { setError("La date est obligatoire"); return; }
    if (!hasCompteRendu) { setError("Le compte rendu est obligatoire"); return; }
    if (form.canal === "Mail" && form.canal_contact && !isValidEmail(form.canal_contact)) {
      setEmailError("Adresse e-mail invalide"); return;
    }
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
        canal:          form.canal || null,
        canal_contact:  form.canal_contact.trim() || null,
      });
      const res = isEdit
        ? await fetch(`${API}/prospects/echanges/${edit.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body })
        : await fetch(`${API}/prospects/${prospect.id}/echanges`, { method:"POST", headers:{"Content-Type":"application/json"}, body });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const savedEchange = await res.json();
      const echangeId = savedEchange.id ?? edit?.id;
      if (compteRendu) {
        // Remplacement : supprimer l'ancien compte rendu pour n'en garder qu'un
        if (crExistant) {
          await fetch(`${API}/prospects/echanges/${echangeId}/fichiers/${crExistant.id}`, { method:"DELETE" });
        }
        const fd = new FormData();
        fd.append("titre", compteRendu.titre || compteRendu.file.name);
        fd.append("categorie", "compte_rendu");
        fd.append("fichier", compteRendu.file);
        await fetch(`${API}/prospects/echanges/${echangeId}/fichiers`, { method:"POST", body:fd });
      }
      for (const p of pdfQueue) {
        const fd = new FormData();
        fd.append("titre", p.titre || p.file.name);
        fd.append("categorie", "autre");
        fd.append("fichier", p.file);
        await fetch(`${API}/prospects/echanges/${echangeId}/fichiers`, { method:"POST", body:fd });
      }
      setOk(true);
      const pr = await fetch(`${API}/prospects/${prospect.id}`);
      const updated = pr.ok ? await pr.json() : prospect;
      setTimeout(()=>{ setOk(false); onClose(); onSaved(updated); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <FModal open={open} onClose={onClose} maxWidth={620}
      title={isEdit ? "Modifier l'échange" : "Enregistrer un échange"}
      subtitle={nomProspect}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving||ok} loading={saving} success={ok}>
          {ok ? "Enregistré !" : saving ? "Enregistrement…" : isEdit ? "Modifier l'échange" : "Enregistrer l'échange"}
        </FButton>
      </>}>

      {/* Échange */}
      <FSection title="Échange" extra={!isEdit && dernierEchangeCourant ? (
        <span style={{ fontSize:11, color:"#ca631f", fontWeight:600 }}>
          Dernier échange : {new Date(dernierEchangeCourant.date_echange).toLocaleDateString("fr-FR")}
        </span>
      ) : undefined}>
        <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>

          <div>
            <FLabel>{estPremier ? "Date du premier contact *" : "Date de l'échange *"}</FLabel>
            <FInput type="date" value={form.date_echange}
              max={dateMax} min={dateMin}
              onChange={e=>upd("date_echange",e.target.value)}/>
          </div>

          {/* Participants */}
          <FGrid cols={2} gap={12}>
            {/* Côté investisseur */}
            <div>
              <FLabel>Interlocuteur</FLabel>
              {estMorale && pointsFocaux.length > 0 ? (
                <>
                  <FSelect value={form.point_focal_id} onChange={e=>{ upd("point_focal_id",e.target.value); if(e.target.value!=="__autre") upd("interlocuteur",""); }}>
                    <option value="">— Sélectionner —</option>
                    {pointsFocaux.map((pf:any)=>(
                      <option key={pf.id} value={String(pf.id)}>{`${pf.prenom||""} ${pf.nom||""}`.trim()}</option>
                    ))}
                    <option value="__autre">Autre (préciser)</option>
                  </FSelect>
                  {form.point_focal_id === "__autre" && (
                    <FInput value={form.interlocuteur} onChange={e=>upd("interlocuteur",e.target.value)}
                      placeholder="Nom de l'interlocuteur" style={{ marginTop:6 }}/>
                  )}
                </>
              ) : (
                <FInput value={form.interlocuteur} onChange={e=>upd("interlocuteur",e.target.value)}
                  placeholder={estMorale ? "Nom de l'interlocuteur" : nomProspect}/>
              )}
            </div>
            {/* Côté APIX */}
            <div>
              <FLabel>Agent de l'APIX</FLabel>
              <FInput value={form.contact_par} onChange={e=>upd("contact_par",e.target.value)} placeholder="Votre nom"/>
            </div>
          </FGrid>

          {/* Canal de contact + coordonnée associée */}
          <FGrid cols={2} gap={12}>
            <div>
              <FLabel>Canal utilisé</FLabel>
              <FSelect value={form.canal} onChange={e=>{ upd("canal",e.target.value); upd("canal_contact",""); setEmailError(""); }}>
                <option value="">— Sélectionner —</option>
                {CANAUX.map(c=>(<option key={c} value={c}>{c}</option>))}
              </FSelect>
            </div>
            {form.canal && (()=>{
              const meta = canalContactMeta(form.canal);
              const isPhone = PHONE_CANAUX.includes(form.canal);
              return (
                <div>
                  <FLabel>{meta?.label || "Coordonnée"}</FLabel>
                  {isPhone ? (
                    <PhoneInput value={form.canal_contact} onChange={v=>upd("canal_contact",v)}/>
                  ) : form.canal === "Mail" ? (
                    <>
                      <FInput type="email" value={form.canal_contact}
                        onChange={e=>{ upd("canal_contact",e.target.value); if(emailError) setEmailError(""); }}
                        onBlur={()=>{ if(form.canal_contact && !isValidEmail(form.canal_contact)) setEmailError("Adresse e-mail invalide"); }}
                        placeholder={meta?.placeholder || ""} style={{ borderColor: emailError?"#dc2626":undefined }}/>
                      {emailError && <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>{emailError}</p>}
                    </>
                  ) : (
                    <FInput value={form.canal_contact} onChange={e=>upd("canal_contact",e.target.value)}
                      placeholder={meta?.placeholder || ""}/>
                  )}
                </div>
              );
            })()}
          </FGrid>

        </div>
      </FSection>

      {/* Commentaires */}
      <FSection title="Commentaires">
        <div style={{ minHeight:160 }}>
          <RichTextEditor value={form.commentaire} onChange={v=>upd("commentaire",v)}/>
        </div>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        <div style={{ display:"flex", flexDirection:"column" as const, gap:16 }}>

          {/* Compte rendu (obligatoire — un seul) */}
          <div>
            <FLabel>Compte rendu <span style={{ color:"#dc2626" }}>*</span></FLabel>
            {crExistant && !compteRendu && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"8px 12px", marginBottom:8 }}>
                <FileText size={13} style={{ color:"#004f91", flexShrink:0 }}/>
                <a href={`${API}/prospects/echanges/${edit?.id}/fichiers/${crExistant.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, fontSize:12.5, color:"#004f91", fontWeight:600, textDecoration:"none" }}>
                  {crExistant.titre}
                </a>
              </div>
            )}
            {compteRendu ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(106,27,154,0.05)", border:"1px solid rgba(106,27,154,0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#6A1B9A", flexShrink:0 }}/>
                <input value={compteRendu.titre} onChange={e=>setCompteRendu(cr=>cr?{...cr,titre:e.target.value}:cr)}
                  placeholder="Titre du compte rendu"
                  style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(106,27,154,0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                <button onClick={()=>setCompteRendu(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"#dc2626" }}/></button>
              </div>
            ) : (
              <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
                <Upload size={14} color="#9aa5b4"/>
                <span style={{ fontSize:13, color:"#9aa5b4" }}>{crExistant ? "Remplacer le compte rendu (PDF)" : "Ajouter le compte rendu (PDF)"}</span>
                <input type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>{
                  const file = e.target.files?.[0]; if (!file) return;
                  setCompteRendu({ file, titre:file.name.replace(/\.pdf$/i,"") });
                  e.target.value="";
                }}/>
              </label>
            )}
          </div>

          {/* Autres documents (facultatif — un ou plusieurs) */}
          <div>
            <FLabel>Autres documents <span style={{ fontWeight:400, color:"#9aa5b4" }}>(facultatif)</span></FLabel>
            {autresExistants.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
                {autresExistants.map((f:any) => (
                  <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"8px 12px" }}>
                    <FileText size={13} style={{ color:"#004f91", flexShrink:0 }}/>
                    <a href={`${API}/prospects/echanges/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{ flex:1, fontSize:12.5, color:"#004f91", fontWeight:600, textDecoration:"none" }}>
                      {f.titre}
                    </a>
                  </div>
                ))}
              </div>
            )}
            {pdfQueue.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
                {pdfQueue.map((p,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(106,27,154,0.05)", border:"1px solid rgba(106,27,154,0.2)", borderRadius:10, padding:"8px 12px" }}>
                    <FileText size={13} style={{ color:"#6A1B9A", flexShrink:0 }}/>
                    <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                      placeholder="Titre du document"
                      style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(106,27,154,0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                    <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"#dc2626" }}/></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
              <Upload size={14} color="#9aa5b4"/>
              <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
                const files = Array.from(e.target.files||[]);
                setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
                e.target.value="";
              }}/>
            </label>
            {(compteRendu || pdfQueue.length > 0) && (
              <p style={{ fontSize:11, color:"#9aa5b4", marginTop:6 }}>Les fichiers seront téléversés à l'enregistrement.</p>
            )}
          </div>

        </div>
      </FSection>

      {/* Contraintes exprimées */}
      <FSection title="Contraintes exprimées">
        {localContraintes.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:6, marginBottom:8 }}>
            {localContraintes.map((c:any) => (
              <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:10, background:"rgba(220,38,38,0.04)", border:"1px solid rgba(220,38,38,0.15)", borderRadius:10, padding:"9px 12px" }}>
                <div style={{ flex:1, fontSize:12, color:"#1a1a2e", lineHeight:1.5 }}>
                  {c.description.replace(/<[^>]+>/g,"").trim() || "—"}
                </div>
                <button type="button" onClick={()=>ouvrirContrainte(c)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", flexShrink:0 }}>
                  <Pencil size={12} style={{ color:"#9aa5b4" }}/>
                </button>
                <button type="button" onClick={()=>supprimerContrainte(c.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", flexShrink:0 }}>
                  <Trash2 size={12} style={{ color:"#dc2626" }}/>
                </button>
              </div>
            ))}
          </div>
        )}
        {showContrainteForm ? (
          <FPanel style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
              {bulletContraintes.map((b,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"#004f91", fontWeight:900, fontSize:18, flexShrink:0, lineHeight:1, userSelect:"none" as const }}>•</span>
                  <input
                    className="fui-input"
                    ref={el=>{ bulletRefs.current[i]=el; }}
                    value={b}
                    onChange={e=>{ const arr=[...bulletContraintes]; arr[i]=e.target.value; setBulletContraintes(arr); }}
                    onKeyDown={e=>{
                      if (e.key==="Enter") {
                        e.preventDefault();
                        const arr=[...bulletContraintes]; arr.splice(i+1,0,""); setBulletContraintes(arr);
                        setTimeout(()=>bulletRefs.current[i+1]?.focus(),0);
                      } else if (e.key==="Backspace" && b==="" && bulletContraintes.length>1) {
                        e.preventDefault();
                        const arr=bulletContraintes.filter((_,j)=>j!==i); setBulletContraintes(arr);
                        setTimeout(()=>bulletRefs.current[Math.max(0,i-1)]?.focus(),0);
                      }
                    }}
                    placeholder={i===0 ? "Décrire la contrainte…" : ""}
                    style={{ ...fuiInput, flex:1 }}
                  />
                </div>
              ))}
            </div>
            {contrainteError && <p style={{ fontSize:12, color:"#dc2626" }}>{contrainteError}</p>}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <FButtonGhost type="button" onClick={annulerContrainte} style={{ padding:"7px 14px", fontSize:12 }}>Annuler</FButtonGhost>
              <FButton type="button" onClick={enregistrerContrainte} disabled={savingContrainte} loading={savingContrainte}
                style={{ padding:"7px 16px", fontSize:12 }}>
                {savingContrainte?"Enregistrement…":editContrainteId?"Modifier":"Ajouter"}
              </FButton>
            </div>
          </FPanel>
        ) : (
          <button type="button" onClick={()=>ouvrirContrainte(null)}
            style={{ width:"100%", border:"2px dashed #E4E1DE", background:"#FAFAF9", borderRadius:10, padding:"11px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, color:"#9aa5b4", fontSize:13, fontWeight:500, transition:"border-color 0.15s, color 0.15s", fontFamily:"var(--font-google-sans)" }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor="#004f91"; (e.currentTarget as HTMLButtonElement).style.color="#004f91"; }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor="#E4E1DE"; (e.currentTarget as HTMLButtonElement).style.color="#9aa5b4"; }}>
            <Plus size={14}/> Ajouter
          </button>
        )}
      </FSection>

      {/* Note anti-fraude */}
      <FInfo>
        La date et l'heure de saisie réelles sont tracées automatiquement. L'échange reste <strong>modifiable pendant 24h</strong> après son enregistrement, puis devient définitivement immuable.
      </FInfo>

      {error && <FError>{error}</FError>}
    </FModal>
  );
}

// ── Vue fiche prospect ────────────────────────────────────────────────────────
function ProspectVue({ p, onClose, onEdit, onContacter, onEditEchange, onRefresh, onRecontact, onRouvrir, readOnly, hideHistorique, historiqueOnly }: any) {
  const [showEchanges,    setShowEchanges]    = useState(true);
  const [deletingEchange, setDeletingEchange] = useState<number|null>(null);
  const [openCycles,      setOpenCycles]      = useState<Set<number>>(new Set());
  const toggleCycle = (id:number) => setOpenCycles(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const TXT="#1a1a2e", SUB="#5b6472", MUT="#98a1ad", SURF="#FAFAF9", BRD="#F0EEEC", DIV="#F2F0EF";
  const card: any = { background:SURF, border:`1px solid ${BRD}`, borderRadius:12, padding:"14px 16px" };
  const linkStyle: any = { fontSize:13, fontWeight:600, color:"#004f91", wordBreak:"break-all" as const, textDecoration:"none" };
  const href = (u:string) => /^https?:\/\//.test(u) ? u : `https://${u}`;

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",textTransform:"uppercase" as const,letterSpacing:"0.14em",marginBottom:10}}>{children}</p>
  );

  const Section = ({ title, count, action, first, children }:any) => (
    <section style={{ marginTop:first?0:22, paddingTop:first?0:22, borderTop:first?"none":`1px solid ${DIV}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12, minHeight:24 }}>
        <h3 style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const }}>
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

  // Carte d'information à en-tête icône (téléphone, mail, site, …).
  const InfoCard = ({ icon:Icon, label, children }:any) => (
    <div style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"10px 13px", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <Icon size={12} style={{ color:accent, flexShrink:0 }}/>
        <span style={{ fontSize:9, fontWeight:800, color:"#004f91", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>{label}</span>
      </div>
      {children}
    </div>
  );

  // Affichage en cascade Secteur → Branche → Activité (style entreprises)
  const NaemaCascade = ({ secIds, braIds, actIds }:{ secIds:number[]; braIds:number[]; actIds:number[] }) => (
    <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
      {secIds.map((secId:number)=>{
        const sec = secteurs.find(s=>s.id===secId); if (!sec) return null;
        const brasDuSec = branches.filter(b=>b.secteur_id===secId && braIds.includes(b.id));
        return (
          <div key={secId}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:brasDuSec.length?5:0 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#004f91", flexShrink:0 }}/><span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>{sec.nom}</span>
            </div>
            {brasDuSec.length>0 && <div style={{ paddingLeft:20, borderLeft:"2px solid rgba(0,79,145,0.15)", display:"flex", flexDirection:"column" as const, gap:5 }}>
              {brasDuSec.map((bra:any)=>{
                const actsDeBra = activites.filter(a=>a.branche_id===bra.id && actIds.includes(a.id));
                return (
                  <div key={bra.id}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:actsDeBra.length?4:0 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#ca631f", flexShrink:0 }}/><span style={{ fontSize:11, fontWeight:600, color:"#ca631f" }}>{bra.nom}</span>
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
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:720, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height:4, background:"#004f91", flexShrink:0 }}/>

        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:TXT, lineHeight:1.3 }}>{displayName}</h2>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const, marginTop:8 }}>
              {(()=>{ const b=badgeProspect(p); return b ? (
                <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:b.color, background:b.bg, padding:"3px 10px", borderRadius:999 }}>{b.label}</span>
              ) : null; })()}
              {p.siege_nom && <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"3px 10px", borderRadius:999 }}>{p.siege_nom}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"#F5F4F3", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div ref={scrollContainerRef} style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1 }}>

          {/* Identité, contacts, activités, commentaires — masqués en readOnly et historiqueOnly */}
          {!historiqueOnly && !readOnly && <><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {p.telephones?.length > 0 && (
              <InfoCard icon={Phone} label="Téléphone">
                <div style={{ display:"flex", flexDirection:"column" as const, gap:3 }}>
                  {p.telephones.map((t:string,i:number)=>(
                    <p key={i} style={{ fontSize:13, fontWeight:600, color:TXT }}>{fmtPhone(t)}</p>
                  ))}
                </div>
              </InfoCard>
            )}
            {p.mails?.length > 0 && (
              <InfoCard icon={Mail} label="Email">
                <div style={{ display:"flex", flexDirection:"column" as const, gap:3 }}>
                  {p.mails.map((m:string,i:number)=>(
                    <a key={i} href={`mailto:${m}`} style={{ fontSize:13, fontWeight:600, color:TXT, wordBreak:"break-all" as const, textDecoration:"none" }}>{m}</a>
                  ))}
                </div>
              </InfoCard>
            )}
            {p.siteweb && (
              <InfoCard icon={Globe} label="Site web">
                <a href={href(p.siteweb)} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:accent, wordBreak:"break-all" as const, textDecoration:"none" }}>{p.siteweb}</a>
              </InfoCard>
            )}
            {p.linkedin && (
              <InfoCard icon={Link2} label="LinkedIn">
                <a href={href(p.linkedin)} target="_blank" rel="noreferrer" style={{ fontSize:13, fontWeight:600, color:accent, wordBreak:"break-all" as const, textDecoration:"none" }}>{p.linkedin}</a>
              </InfoCard>
            )}
          </div>

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

          {/* Points focaux */}
          {p.points_focaux?.length > 0 && (
            <Section title="Points focaux">
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                {p.points_focaux.map((pf:any, i:number) => {
                  const pfTels  = (pf.telephones||[]).filter(Boolean);
                  const pfMails = (pf.mails||[]).filter(Boolean);
                  return (
                    <div key={i} style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"11px 14px", fontSize:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
                        <span style={{ fontWeight:700, color:"#1a1a2e" }}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                        {pf.poste && <span style={{ fontSize:11, color:"#9aa5b4" }}>{pf.poste}</span>}
                        {pf.est_principal && <span style={{ fontSize:10, fontWeight:700, color:"#ca631f", background:"rgba(202,99,31,0.08)", borderRadius:999, padding:"2px 8px" }}>Principal</span>}
                      </div>
                      {(pfTels.length > 0 || pfMails.length > 0) && (
                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:7 }}>
                          {pfTels.map((t:string, ti:number) => (
                            <span key={`t${ti}`} style={{ fontSize:11, fontWeight:600, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"3px 10px", borderRadius:999 }}>{fmtPhone(t)}</span>
                          ))}
                          {pfMails.map((m:string, mi:number) => (
                            <span key={`m${mi}`} style={{ fontSize:11, fontWeight:600, color:"#188038", background:"rgba(24,128,56,0.07)", padding:"3px 10px", borderRadius:999 }}>{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          </>}

          {/* Compte rendu des échanges du cycle courant : Historique + Contraintes exprimées (masqué en readOnly) */}
          {!hideHistorique && !readOnly && (echangesDuCycle(p,null).length > 0 || contraintesCycleCourant(p).length > 0) && (
            <Section title="Compte rendu des échanges" count={echangesDuCycle(p,null).length}
              action={
                <button onClick={()=>setShowEchanges(o=>!o)}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:`1px solid ${BRD}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:600, color:SUB }}>
                  {showEchanges?<>Masquer <ChevronUp size={12}/></>:<>Afficher <ChevronDown size={12}/></>}
                </button>
              }>
              {showEchanges && echangesDuCycle(p,null).length > 0 && (
                <>
                <SubLabel>Historique</SubLabel>
                <div style={{ position:"relative" as const }}>
                  {/* Ligne verticale du fil */}
                  <div style={{ position:"absolute" as const, left:5, top:10, bottom:10, width:2, background:BRD, borderRadius:2 }}/>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                    {(()=>{
                      const echsCourant = echangesDuCycle(p, null);
                      const maxEnregistreLe = Math.max(...echsCourant.map((ex:any)=>new Date(ex.enregistre_le).getTime()));
                      return [...echsCourant].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).map((e:any)=>{
                      const retard = e.retard_jours || 0;
                      const retardLabel = retard === 0 ? "saisi le jour même" : `saisi ${retard} j après`;
                      const isLast    = new Date(e.enregistre_le).getTime() === maxEnregistreLe;
                      const within24h = Date.now() - new Date(e.enregistre_le).getTime() < 24*3600*1000;
                      const canAct    = !estFige(p) && isLast && within24h;
                      return (
                        <Fragment key={e.id}>
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
                              <p style={{ fontSize:11, color:MUT, marginBottom:(e.canal||e.canal_contact)?6:8 }}>
                                {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                              </p>
                            )}

                            {/* Ligne 3 : canal de contact */}
                            {e.canal && (()=>{ const CIcon = canalIcon(e.canal); const coord = canalContactDisplay(e.canal, e.canal_contact); return (
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                                <CIcon size={13} style={{ color:accent, flexShrink:0 }}/>
                                <span style={{ fontSize:12, fontWeight:600, color:TXT }}>{e.canal}</span>
                                {coord && <>
                                  <span style={{ width:3, height:3, borderRadius:"50%", background:MUT, flexShrink:0 }}/>
                                  <span style={{ fontSize:12, color:SUB }}>{coord}</span>
                                </>}
                              </div>
                            ); })()}

                            {/* Compte-rendu */}
                            {e.commentaire && (
                              <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7 }}
                                dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                            )}

                            {/* Documents attachés */}
                            {e.fichiers?.length > 0 && (
                              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:e.commentaire?6:0 }}>
                                {e.fichiers.map((f:any) => (
                                  <a key={f.id}
                                    href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                    target="_blank" rel="noopener noreferrer"
                                    style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", textDecoration:"none", fontSize:11, color:"#4a5568", fontWeight:500 }}>
                                    <FileText size={11} style={{ color:"#ca631f", flexShrink:0 }}/>{f.titre}
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Pied : horodatage serveur */}
                            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:8, borderTop:`1px solid ${DIV}` }}>
                              <Clock size={11} style={{ flexShrink:0 }}/>
                              <span>Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})} · {retardLabel}</span>
                            </div>
                          </div>
                        </div>
                        </Fragment>
                      );
                    }); })()}
                  </div>
                </div>
                </>
              )}

              {/* Contraintes exprimées — cycle de prospection courant uniquement */}
              {showEchanges && contraintesCycleCourant(p).length > 0 && (()=>{ const hasEch = echangesDuCycle(p,null).length>0; return (
                <div style={{ marginTop: hasEch ? 18 : 0, paddingTop: hasEch ? 16 : 0, borderTop: hasEch ? `1px solid ${DIV}` : "none" }}>
                  <SubLabel color="#ca631f">
                    {contraintesCycleCourant(p).length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                  </SubLabel>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                    {contraintesCycleCourant(p).map((c:any) => (
                      <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                        <span style={{ color:"#ca631f", fontWeight:900, fontSize:16, flexShrink:0, lineHeight:1.4 }}>•</span>
                        <span style={{ lineHeight:1.5 }}>{c.description.replace(/<[^>]+>/g,"").trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ); })()}
            </Section>
          )}

          {/* Cycles de prospection — un bloc repliable par cycle.
              En readOnly (onglet précédents), le cycle courant figé est aussi affiché en tête. */}
          {(p.cycles?.length > 0 || (readOnly && estFige(p))) && (
            <div style={{ marginTop:22, display:"flex", flexDirection:"column" as const, gap:8 }}>
              {/* Cycle courant figé : synthétique, affiché uniquement en readOnly */}
              {readOnly && estFige(p) && (()=>{
                const currentNum = (p.cycles?.length || 0) + 1;
                const inst = p.issue === "installe";
                const col  = inst ? "#0D652D" : "#6b7280";
                const synId = -1;
                const isOpen = openCycles.has(synId);
                const echsCourant = echangesDuCycle(p, null);
                const contrCourant = contraintesCycleCourant(p);
                return (
                  <div style={{ border:`1px solid ${BRD}`, borderRadius:12, overflow:"hidden" as const }}>
                    <button onClick={()=>toggleCycle(synId)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", background: isOpen ? SURF : "#fff", border:"none", cursor:"pointer", textAlign:"left" as const }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, flexWrap:"wrap" as const }}>
                        <span style={{ fontSize:10, fontWeight:700, color:MUT, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Cycle {currentNum}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:col }}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</span>
                        {p.issue_conclu_le && <span style={{ fontSize:11, color:MUT }}>· Conclu le {new Date(p.issue_conclu_le).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>}
                      </div>
                      {isOpen ? <ChevronUp size={14} style={{ color:MUT, flexShrink:0 }}/> : <ChevronDown size={14} style={{ color:MUT, flexShrink:0 }}/>}
                    </button>
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${BRD}`, padding:"16px 16px", background:SURF, display:"flex", flexDirection:"column" as const, gap:14 }}>
                        {p.issue_commentaire && (
                          <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7, fontStyle:"italic" }}
                            dangerouslySetInnerHTML={{ __html:p.issue_commentaire }}/>
                        )}
                        {echsCourant.length > 0 && (
                          <div>
                            <SubLabel>Historique</SubLabel>
                            <div style={{ position:"relative" as const }}>
                              <div style={{ position:"absolute" as const, left:5, top:10, bottom:10, width:2, background:BRD, borderRadius:2 }}/>
                              <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                                {[...echsCourant].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).map((e:any)=>(
                                  <div key={e.id} style={{ paddingLeft:22, position:"relative" as const }}>
                                    <div style={{ position:"absolute" as const, left:1, top:15, width:8, height:8, borderRadius:"50%", background:"#fff", border:`2px solid ${accent}` }}/>
                                    <div style={{ background:"#fff", border:`1px solid ${BRD}`, borderRadius:10, padding:"12px 14px" }}>
                                      <div style={{ fontSize:13, fontWeight:800, color:TXT, marginBottom:(e.interlocuteur||e.contact_par)?4:0 }}>
                                        {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                                      </div>
                                      {(e.interlocuteur||e.contact_par) && (
                                        <p style={{ fontSize:11, color:MUT, marginBottom:e.canal?4:0 }}>
                                          {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                      {e.canal && (()=>{ const CIcon=canalIcon(e.canal); const coord=canalContactDisplay(e.canal,e.canal_contact); return (
                                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:e.commentaire?6:0 }}>
                                          <CIcon size={13} style={{ color:accent, flexShrink:0 }}/>
                                          <span style={{ fontSize:12, fontWeight:600, color:TXT }}>{e.canal}</span>
                                          {coord && <><span style={{ width:3,height:3,borderRadius:"50%",background:MUT,flexShrink:0 }}/><span style={{ fontSize:12,color:SUB }}>{coord}</span></>}
                                        </div>
                                      );})()}
                                      {e.commentaire && (
                                        <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7 }}
                                          dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                                      )}
                                      {e.fichiers?.length > 0 && (
                                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:e.commentaire?6:0 }}>
                                          {e.fichiers.map((f:any) => (
                                            <a key={f.id}
                                              href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                              target="_blank" rel="noopener noreferrer"
                                              style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", textDecoration:"none", fontSize:11, color:"#4a5568", fontWeight:500 }}>
                                              <FileText size={11} style={{ color:"#ca631f", flexShrink:0 }}/>{f.titre}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {/* Pied : horodatage serveur */}
                                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:8, borderTop:`1px solid ${DIV}` }}>
                                        <Clock size={11} style={{ flexShrink:0 }}/>
                                        <span>Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})} · {e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {contrCourant.length > 0 && (
                          <div>
                            <SubLabel color="#ca631f">
                              {contrCourant.length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                            </SubLabel>
                            <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                              {contrCourant.map((c:any) => (
                                <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                                  <span style={{ color:"#ca631f", fontWeight:900, fontSize:16, flexShrink:0, lineHeight:1.4 }}>•</span>
                                  <span style={{ lineHeight:1.5 }}>{c.description.replace(/<[^>]+>/g,"").trim()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {[...p.cycles].sort((a:any,b:any)=>b.cycle_num-a.cycle_num).map((cy:any)=>{
                const inst = cy.issue==="installe";
                const col  = inst ? "#0D652D" : "#6b7280";
                const isOpen = openCycles.has(cy.id);
                const echangesCy    = echangesDuCycle(p, cy);
                const contraintesCy = contraintesDuCycle(p, cy);
                return (
                  <div key={cy.id} style={{ border:`1px solid ${BRD}`, borderRadius:12, overflow:"hidden" as const }}>
                    {/* En-tête cliquable */}
                    <button onClick={()=>toggleCycle(cy.id)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", background: isOpen ? SURF : "#fff", border:"none", cursor:"pointer", textAlign:"left" as const }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, flexWrap:"wrap" as const }}>
                        <span style={{ fontSize:10, fontWeight:700, color:MUT, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Cycle {cy.cycle_num}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:col }}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</span>
                        {cy.conclu_le && <span style={{ fontSize:11, color:MUT }}>· Conclu le {new Date(cy.conclu_le).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</span>}
                      </div>
                      {isOpen ? <ChevronUp size={14} style={{ color:MUT, flexShrink:0 }}/> : <ChevronDown size={14} style={{ color:MUT, flexShrink:0 }}/>}
                    </button>

                    {/* Contenu déplié */}
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${BRD}`, padding:"16px 16px", background:SURF, display:"flex", flexDirection:"column" as const, gap:14 }}>

                        {/* Commentaire de conclusion */}
                        {cy.issue_commentaire && (
                          <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7, fontStyle:"italic" }}
                            dangerouslySetInnerHTML={{ __html:cy.issue_commentaire }}/>
                        )}

                        {/* Échanges du cycle */}
                        {echangesCy.length > 0 && (
                          <div>
                            <SubLabel>Historique</SubLabel>
                            <div style={{ position:"relative" as const }}>
                              <div style={{ position:"absolute" as const, left:5, top:10, bottom:10, width:2, background:BRD, borderRadius:2 }}/>
                              <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                                {[...echangesCy].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).map((e:any)=>(
                                  <div key={e.id} style={{ paddingLeft:22, position:"relative" as const }}>
                                    <div style={{ position:"absolute" as const, left:1, top:15, width:8, height:8, borderRadius:"50%", background:"#fff", border:`2px solid ${accent}` }}/>
                                    <div style={{ background:"#fff", border:`1px solid ${BRD}`, borderRadius:10, padding:"12px 14px" }}>
                                      <div style={{ fontSize:13, fontWeight:800, color:TXT, marginBottom:(e.interlocuteur||e.contact_par)?4:0 }}>
                                        {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                                      </div>
                                      {(e.interlocuteur||e.contact_par) && (
                                        <p style={{ fontSize:11, color:MUT, marginBottom:e.canal?4:0 }}>
                                          {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                      {e.canal && (()=>{ const CIcon=canalIcon(e.canal); const coord=canalContactDisplay(e.canal,e.canal_contact); return (
                                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:e.commentaire?6:0 }}>
                                          <CIcon size={13} style={{ color:accent, flexShrink:0 }}/>
                                          <span style={{ fontSize:12, fontWeight:600, color:TXT }}>{e.canal}</span>
                                          {coord && <><span style={{ width:3,height:3,borderRadius:"50%",background:MUT,flexShrink:0 }}/><span style={{ fontSize:12,color:SUB }}>{coord}</span></>}
                                        </div>
                                      );})()}
                                      {e.commentaire && (
                                        <div data-rte style={{ fontSize:13, color:SUB, lineHeight:1.7 }}
                                          dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                                      )}
                                      {e.fichiers?.length > 0 && (
                                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:e.commentaire?6:0 }}>
                                          {e.fichiers.map((f:any) => (
                                            <a key={f.id}
                                              href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                              target="_blank" rel="noopener noreferrer"
                                              style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", textDecoration:"none", fontSize:11, color:"#4a5568", fontWeight:500 }}>
                                              <FileText size={11} style={{ color:"#ca631f", flexShrink:0 }}/>{f.titre}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {/* Pied : horodatage serveur */}
                                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:8, borderTop:`1px solid ${DIV}` }}>
                                        <Clock size={11} style={{ flexShrink:0 }}/>
                                        <span>Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})} · {e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Contraintes du cycle */}
                        {contraintesCy.length > 0 && (
                          <div>
                            <SubLabel color="#ca631f">
                              {contraintesCy.length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                            </SubLabel>
                            <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                              {contraintesCy.map((c:any) => (
                                <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                                  <span style={{ color:"#ca631f", fontWeight:900, fontSize:16, flexShrink:0, lineHeight:1.4 }}>•</span>
                                  <span style={{ lineHeight:1.5 }}>{c.description.replace(/<[^>]+>/g,"").trim()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Pied */}
        <div style={{ display:"flex", gap:10, justifyContent:"space-between", alignItems:"center", padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", flexShrink:0 }}>
          {(!readOnly && !estFige(p)) ? (
            <button onClick={onContacter}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:"none", background:"rgba(24,128,56,0.08)", color:"#188038", fontWeight:700, cursor:"pointer", fontSize:12.5, fontFamily:"var(--font-google-sans)" }}>
              <MessageSquare size={13}/> Contacter
            </button>
          ) : <span/>}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose}
              style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            {!readOnly && !historiqueOnly && (
              <button onClick={onEdit}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)", boxShadow:"0 3px 12px rgba(0,79,145,0.25)" }}>
                <Pencil size={13}/> Modifier
              </button>
            )}
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
  const [counts,       setCounts]       = useState<{cibles:number;historique:number;precedents:number}>({cibles:0,historique:0,precedents:0});
  const [loading,      setLoading]      = useState(true);
  const [onglet,       setOnglet]       = useState<"cibles"|"historique"|"precedents">("cibles");
  const [modal,        setModal]        = useState(false);
  const [edit,         setEdit]         = useState<any>(null);
  const [vue,          setVue]          = useState<any>(null);
  const [echangeModal,    setEchangeModal]    = useState(false);
  const [echangeEdit,     setEchangeEdit]     = useState<any>(null);
  const [echangeProspect, setEchangeProspect] = useState<any>(null);
  const [deleting,     setDeleting]     = useState<number|null>(null);
  const [q,            setQ]            = useState("");
  const [terminerOpenId,  setTerminerOpenId]  = useState<number|null>(null);
  const [terminerForm,    setTerminerForm]    = useState<{ issue:string; commentaire:string }>({ issue:"", commentaire:"" });
  const [savingTerminer,  setSavingTerminer]  = useState(false);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:"1", per_page:"50" });
      if (q) params.set("q", q);
      if (onglet==="precedents") {
        params.set("conclu", "true");
      } else {
        params.set("conclu", "false");
        // "historique" (En contact) : déjà contactés ; "cibles" : pas encore contactés
        params.set("contactes", onglet==="historique" ? "true" : "false");
      }
      const res  = await fetch(`${API}/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data||[]); setTotal(data.total||0);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [q, onglet]);

  useEffect(()=>{ charger(); }, [charger]);

  const chargerCounts = useCallback(async()=>{
    try {
      const mk = (extra:Record<string,string>) => { const p=new URLSearchParams({ page:"1", per_page:"1" }); if(q)p.set("q",q); Object.entries(extra).forEach(([k,v])=>p.set(k,v)); return p; };
      const [rC,rH,rP] = await Promise.all([
        fetch(`${API}/prospects?${mk({ conclu:"false", contactes:"false" })}`).then(r=>r.json()),
        fetch(`${API}/prospects?${mk({ conclu:"false", contactes:"true" })}`).then(r=>r.json()),
        fetch(`${API}/prospects?${mk({ conclu:"true" })}`).then(r=>r.json()),
      ]);
      setCounts({ cibles:rC.total||0, historique:rH.total||0, precedents:rP.total||0 });
    } catch(e){ console.error(e); }
  }, [q]);

  useEffect(()=>{ chargerCounts(); }, [chargerCounts, prospects]);

  const handleDelete = async (id:number) => {
    if (!confirm("Supprimer ce prospect ?")) return;
    setDeleting(id);
    await fetch(`${API}/prospects/${id}`, { method:"DELETE" });
    setDeleting(null); charger();
  };

  const handleTerminer = async (id:number) => {
    if (!terminerForm.issue || !terminerForm.commentaire) return;
    setSavingTerminer(true);
    try {
      const res = await fetch(`${API}/prospects/${id}/conclusion`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ issue:terminerForm.issue, issue_commentaire:terminerForm.commentaire }),
      });
      if (!res.ok) { const d=await res.json().catch(()=>({})); alert(d.detail||"Erreur"); return; }
      setTerminerOpenId(null);
      setTerminerForm({ issue:"", commentaire:"" });
      charger();
    } finally { setSavingTerminer(false); }
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
          {([["cibles","Investisseurs ciblés"],["historique","Investisseurs en contact"],["precedents","Investisseurs transformés"]] as const).map(([key,label])=>{
            const actif = onglet===key;
            return (
            <button key={key} onClick={()=>setOnglet(key)}
              style={{ padding:"14px 22px", border:"none", borderBottom:`2px solid ${actif?"#004f91":"transparent"}`, background:"transparent", color:actif?"#004f91":"#9aa5b4", fontWeight:600, cursor:"pointer", fontSize:13, transition:"all 0.15s" }}>
              {label}
              {counts[key]>0 && <span style={{ marginLeft:7, fontSize:11, fontWeight:700, color:actif?"#004f91":"#9aa5b4", background:actif?"rgba(0,79,145,0.1)":"#F2F0EF", padding:"1px 7px", borderRadius:999 }}>{counts[key]}</span>}
            </button>
            );
          })}
        </div>
        {onglet!=="precedents" && (
          <button onClick={()=>{ setEdit(null); setModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(0,79,145,0.3)", marginBottom:4 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))", gap:14 }}>
            {prospects.map(p=>{
              const activite = badgeProspect(p);
              const fmtJour = (d:string) => new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
              const lastCycle = [...(p.cycles||[])].sort((a:any,b:any)=>b.cycle_num-a.cycle_num)[0];
              const echsCourant = echangesDuCycle(p, null);
              const dernierEch = echsCourant.length ? [...echsCourant].sort((a:any,b:any)=>a.date_echange.localeCompare(b.date_echange)).at(-1) : null;
              // Second bloc libellé, contextuel selon l'onglet
              const info2 = onglet==="historique"
                ? (activite?.label==="À recontacter"
                    ? { label:`Cycle ${lastCycle?.cycle_num??""} conclu`, value: lastCycle?.conclu_le ? fmtJour(lastCycle.conclu_le) : null }
                    : { label:"Dernier échange", value: dernierEch ? fmtJour(dernierEch.date_echange) : null })
                : onglet==="precedents"
                ? (p.issue==="installe"
                    ? { label:"Accord conclu", value: p.issue_conclu_le ? fmtJour(p.issue_conclu_le) : null }
                    : p.issue==="decline"
                    ? { label:"Décliné le", value: p.issue_conclu_le ? fmtJour(p.issue_conclu_le) : null }
                    : { label:"Conclusion", value: null })
                : { label:"Téléphone", value: p.telephones?.[0] ? fmtPhone(p.telephones[0]) : null };
              // Bloc « Activités spécialisées » (onglet ciblés) : juste le nombre
              const nbActs = (p.activite_ids||[]).length;
              return (
                <div key={p.id} onClick={()=>setVue(p)}
                  style={{ background:"#fff", border:"1px solid #ECEAE7", borderRadius:14, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", display:"flex", flexDirection:"column" as const, overflow:"hidden" }}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                  <div style={{ padding:"14px 16px 14px", flex:1 }}>
                    {/* Statut / email + siège */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:12 }}>
                      {onglet==="cibles" ? (
                        <span style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                          {p.nb_echanges > 0 && (
                            <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"3px 10px", borderRadius:999, flexShrink:0 }}>Contacté</span>
                          )}
                          {p.mails?.[0] && (
                            <span style={{ display:"inline-block", fontSize:10.5, fontWeight:700, color:"#6b7280", background:"#F2F0EF", padding:"3px 10px", borderRadius:999, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, minWidth:0 }}>{p.mails[0]}</span>
                          )}
                        </span>
                      ) : activite ? (
                        <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:activite.color, background:activite.bg, padding:"3px 10px", borderRadius:999 }}>{activite.label}</span>
                      ) : <span/>}
                      {p.siege_nom && <span style={{ fontSize:10.5, fontWeight:600, color:"#9aa5b4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, maxWidth:"45%", flexShrink:0 }}>{p.siege_nom}</span>}
                    </div>

                    {/* Dénomination */}
                    <div style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", lineHeight:1.35, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.nom}</div>

                    {/* Infos libellées */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                      <div style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                        {onglet==="cibles" ? <>
                          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, marginBottom:3 }}>Activités spécialisées</p>
                          <p style={{ fontSize:12, fontWeight:600, color:nbActs>0?"#1a1a2e":"#9aa5b4" }}>{nbActs||"—"}</p>
                        </> : <>
                          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, marginBottom:3 }}>Email</p>
                          <p style={{ fontSize:12, fontWeight:600, color:p.mails?.length?"#1a1a2e":"#9aa5b4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.mails?.[0]||"—"}</p>
                        </>}
                      </div>
                      <div style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                        <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, marginBottom:3 }}>{info2.label}</p>
                        <p style={{ fontSize:12, fontWeight:600, color:info2.value?"#1a1a2e":"#9aa5b4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{info2.value||"—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {onglet==="precedents" ? (
                    <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #F2F0EF" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setVue(p)}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#4a5568", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(156,163,175,0.07)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        Consulter
                      </button>
                      {p.issue==="decline" && (
                        <>
                          <div style={{ width:1, background:"#F2F0EF" }}/>
                          <button onClick={()=>handleRecontact(p.id)}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#188038", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgba(24,128,56,0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Re-contacter
                          </button>
                        </>
                      )}
                      <div style={{ width:1, background:"#F2F0EF" }}/>
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                        title="Supprimer définitivement (test)"
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        {deleting===p.id?<Loader2 size={12} style={{ color:"#dc2626",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"#dc2626" }}/>}
                      </button>
                    </div>
                  ) : onglet==="historique" ? (
                    <div onClick={e=>e.stopPropagation()}>
                      {(()=>{
                        const nbEchangesCourants = echangesDuCycle(p, null).length;
                        const terminerDisabled = nbEchangesCourants === 0;
                        return (
                        <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #F2F0EF" }}>
                          <button onClick={()=>{ setEchangeEdit(null); setEchangeProspect(p); setEchangeModal(true); }}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#188038", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgba(24,128,56,0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Contacter
                          </button>
                          <div style={{ width:1, background:"#F2F0EF" }}/>
                          <button disabled={terminerDisabled} onClick={()=>{ if(!terminerDisabled){ setTerminerOpenId(terminerOpenId===p.id?null:p.id); setTerminerForm({ issue:"", commentaire:"" }); } }}
                            title={terminerDisabled?"Au moins un échange est requis pour terminer ce cycle":undefined}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:terminerDisabled?"not-allowed":"pointer", padding:"10px 0", fontSize:11.5, color:terminerDisabled?"#9aa5b4":"#ca631f", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>{if(!terminerDisabled)ev.currentTarget.style.background="rgba(202,99,31,0.05)";}}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <Check size={12}/> Terminer
                          </button>
                        </div>
                        );
                      })()}
                      {terminerOpenId===p.id && (
                        <div style={{ margin:"0 14px 14px", padding:"12px 14px", background:"#FAFAF9", borderRadius:10, border:"1px solid #F0EEEC" }}>
                          <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:10 }}>Conclusion de la prospection</p>
                          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                            {[{val:"installe",lbl:"Installation au Sénégal",col:"#188038"},{val:"decline",lbl:"Possibilité écartée",col:"#6b7280"}].map(({val,lbl,col})=>(
                              <button key={val} type="button" onClick={()=>setTerminerForm(f=>({ ...f, issue:val }))}
                                style={{ flex:1, padding:"8px 6px", borderRadius:8, border:`1.5px solid ${terminerForm.issue===val?col:"#E8E5E3"}`, background:terminerForm.issue===val?`${col}18`:"transparent", color:terminerForm.issue===val?col:"#9aa5b4", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                                {lbl}
                              </button>
                            ))}
                          </div>
                          <div style={{ marginBottom:10 }}>
                            <p style={{ fontSize:11, fontWeight:600, color:"#4a5568", marginBottom:5 }}>Commentaire *</p>
                            <RichTextEditor value={terminerForm.commentaire} onChange={(v:string)=>setTerminerForm(f=>({ ...f, commentaire:v }))}/>
                          </div>
                          <button disabled={!terminerForm.issue||!terminerForm.commentaire||savingTerminer}
                            onClick={()=>handleTerminer(p.id)}
                            style={{ width:"100%", padding:"9px 0", borderRadius:8, border:"none", cursor:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"not-allowed":"pointer", background:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"#E8E5E3":"#ca631f", color:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"#9aa5b4":"#fff", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                            {savingTerminer?<Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/>:<Check size={12}/>}
                            Conclure la prospection
                          </button>
                        </div>
                      )}
                    </div>
                  ) : onglet==="cibles" && p.nb_echanges > 0 ? (
                    // Prospect déjà contacté dans "Investisseurs ciblés" : Modifier uniquement, pas Contacter ni Delete
                    <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #F2F0EF" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{ setEdit(p); setModal(true); }}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#004f91", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        <Pencil size={12}/> Modifier
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #F2F0EF" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{ setEdit(p); setModal(true); }}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#004f91", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        <Pencil size={12}/> Modifier
                      </button>
                      {!estFige(p) && (
                        <>
                          <div style={{ width:1, background:"#F2F0EF" }}/>
                          <button onClick={()=>{ setEchangeEdit(null); setEchangeProspect(p); setEchangeModal(true); }}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#188038", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgba(24,128,56,0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Contacter
                          </button>
                        </>
                      )}
                      <div style={{ width:1, background:"#F2F0EF" }}/>
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
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
      {vue && <ProspectVue p={vue} onClose={()=>setVue(null)}
        readOnly={onglet==="precedents"}
        hideHistorique={onglet==="cibles" && vue.nb_echanges > 0}
        historiqueOnly={onglet==="historique"}
        onEdit={()=>{ setEdit(vue); setVue(null); setModal(true); }}
        onContacter={()=>{ setEchangeEdit(null); setEchangeModal(true); }}
        onEditEchange={(e:any)=>{ setEchangeEdit(e); setEchangeModal(true); }}
        onRecontact={()=>handleRecontact(vue.id)}
        onRouvrir={()=>{ setVue(null); charger(); setOnglet(vue.nb_echanges > 0 ? "historique" : "cibles"); }}
        onRefresh={async()=>{ await charger(); const r=await fetch(`${API}/prospects/${vue.id}`); if(r.ok) setVue(await r.json()); }}/>}
      {(echangeProspect || vue) && <EchangeModal open={echangeModal} onClose={()=>{ setEchangeModal(false); setEchangeEdit(null); setEchangeProspect(null); }} prospect={echangeProspect || vue} edit={echangeEdit}
        onSaved={(updated)=>{ setEchangeModal(false); setEchangeEdit(null); setEchangeProspect(null); if (vue) setVue(updated); charger(); }}/>}
    </div>
  );
}
