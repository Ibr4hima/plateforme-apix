"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Clock, FileText, Globe, Link2, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Pencil, Phone, Plus, Send, Trash2, Upload, User, Video, X } from "lucide-react";
import PhoneInput, { isPhoneComplete, isEmailComplete, isContactComplete, listePreteAjout, doublonsDans, contactsPartages, normPhone, normEmail } from "@/components/shared/PhoneInput";
import PaysSelect from "@/components/shared/PaysSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FButton, FButtonGhost, FError, FInfo, fuiLabel, fuiInput } from "@/components/shared/FormUI";
import { parsePhoneNumber } from "libphonenumber-js";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { badge_bleu, badge_vert, badge_rouge, badge_gris, voile } from "@/lib/couleurs";

import { API_BASE as API } from "@/lib/api";

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}
const IS: any  = { background:"var(--fond)", border:"1px solid var(--bordure-forte)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"var(--encre)", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"var(--texte)", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"var(--orange)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--bordure-forte)" };

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
  { value:"en_cours",  label:"En cours",  color:"var(--orange)" },
  { value:"interesse", label:"Intéressé", color:"var(--bleu)" },
  { value:"negatif",   label:"Négatif",   color:"var(--danger)" },
  { value:"converti",  label:"Converti",  color:"var(--vert)" },
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
  if (p?.issue === "installe") return { label:"Installation à venir", color:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)" };
  if (p?.issue === "decline")  return { label:"Décliné",  color:"var(--gris-fort)", bg:"var(--fond)" };
  // Après un re-contact, on ne mesure l'activité que sur le cycle courant ;
  // les échanges des cycles passés ne doivent pas faire paraître la fiche « Inactif ».
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label:"À recontacter", color:"var(--bleu)", bg:"rgb(var(--bleu-rgb) / 0.07)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90)  return { label:"En cours",   color:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)" };
  if (jours <= 120) return { label:"En attente", color:"var(--gris-fort)", bg:"var(--fond)" };
  return                  { label:"Inactif",    color:"var(--danger)", bg:"rgb(var(--danger-rgb) / 0.07)" };
}

// Une prospection conclue est aussitôt archivée dans « Précédents contacts »
// et passe en lecture seule.
function estFige(p:any) {
  return !!p?.issue;
}

// Statuts des cartes — mêmes jetons que la page publique : progression vert,
// re-contact bleu, inactif rouge, décliné / en attente gris.
const STATUT_BADGE: Record<string, React.CSSProperties> = {
  "En cours":             badge_vert,
  "À recontacter":        badge_bleu,
  "Installation à venir": badge_vert,
  "Inactif":              badge_rouge,
  "Décliné":              badge_gris,
  "En attente":           badge_gris,
};
const STATUT_HEX: Record<string, string> = {
  "En cours": "var(--vert)", "À recontacter": "var(--bleu)", "Installation à venir": "var(--vert)",
  "Inactif": "var(--danger)", "Décliné": "var(--gris)", "En attente": "var(--gris)",
};

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

// ── Bouton « + » rond en pointillés (ajout d'un téléphone / email) ────────────
// Grisé tant que l'entrée précédente n'est pas complète et valide.
function BtnPlus({ ok, onClick, title }: { ok: boolean; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={()=>ok&&onClick()} disabled={!ok} title={ok?(title||"Ajouter"):(title||"Complétez d'abord l'entrée précédente")}
      style={{ width:24, height:24, borderRadius:999, border:`1.5px dashed ${ok?"rgb(var(--bleu-rgb) / 0.35)":"var(--bordure-forte)"}`,
        background:"rgb(var(--carte-rgb) / 0.7)", color:ok?"var(--bleu)":"var(--gris)", cursor:ok?"pointer":"not-allowed",
        display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}
      onMouseEnter={e=>{ if(ok){ e.currentTarget.style.borderColor="var(--bleu)"; e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.08)"; } }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=ok?"rgb(var(--bleu-rgb) / 0.35)":"var(--bordure-forte)"; e.currentTarget.style.background="rgb(var(--carte-rgb) / 0.7)"; }}>
      <Plus size={13}/>
    </button>
  );
}

// ── Multi-téléphones ──────────────────────────────────────────────────────────
function MultiPhones({ values, onChange }: { values:string[]; onChange:(v:string[])=>void }) {
  const ok = listePreteAjout(values, isPhoneComplete, normPhone);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <label style={{ ...fuiLabel, marginBottom:0 }}>Téléphone(s) *</label>
        <BtnPlus ok={ok} onClick={()=>onChange([...values,""])} title="Ajouter un numéro"/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {values.map((tel,i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6 }}>
            <div style={{ flex:1 }}>
              <PhoneInput value={tel} onChange={v=>{ const a=[...values]; a[i]=v; onChange(a); }} placeholder="Numéro"/>
            </div>
            {values.length > 1 && (
              <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))}
                style={{ background:"rgb(var(--danger-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 8px", flexShrink:0, marginTop:1 }}>
                <X size={12} style={{ color:"var(--danger)" }}/>
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
  const ok = listePreteAjout(values, isEmailComplete, normEmail);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <label style={{ ...fuiLabel, marginBottom:0 }}>Email(s) *</label>
        <BtnPlus ok={ok} onClick={()=>onChange([...values,""])} title="Ajouter un email"/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {values.map((mail,i) => (
          <div key={i} style={{ display:"flex", gap:6 }}>
            <FInput type="email" value={mail} placeholder="email@domaine.sn"
              onChange={e=>{ const a=[...values]; a[i]=e.target.value; onChange(a); }}
              style={{ flex:1 }}/>
            {values.length > 1 && (
              <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))}
                style={{ background:"rgb(var(--danger-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 8px", flexShrink:0 }}>
                <X size={12} style={{ color:"var(--danger)" }}/>
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
    <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:12, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <User size={13} style={{ color:"var(--bleu)" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--bleu)" }}>Point focal {idx+1}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--texte)", cursor:"pointer" }}>
            <input type="checkbox" checked={pf.est_principal} onChange={e=>upd("est_principal",e.target.checked)}/> Principal
          </label>
          <button type="button" onClick={onRemove}
            style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
            <Trash2 size={13} style={{ color:"var(--danger)" }}/>
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
      <FGrid cols={2} style={{ alignItems:"start" }}>
        <MultiPhones values={pf.telephones} onChange={v=>upd("telephones",v)}/>
        <MultiMails  values={pf.mails}      onChange={v=>upd("mails",v)}/>
      </FGrid>
    </div>
  );
}

// ── Toggle Oui/Non avec zone de détails optionnelle ──────────────────────────
function ToggleField({ label, desc, value, onChange, children }: {
  label:string; desc?:string; value:boolean; onChange:(v:boolean)=>void; children?:React.ReactNode;
}) {
  return (
    <div style={{ border:"1px solid var(--bordure-forte)", borderRadius:12, overflow:"hidden" }}>
      <button type="button" onClick={()=>onChange(!value)}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"12px 16px", background:value?"rgb(var(--bleu-rgb) / 0.04)":"var(--carte)", border:"none", cursor:"pointer", textAlign:"left" as const, fontFamily:"var(--font-google-sans)" }}>
        <div>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--encre)" }}>{label}</span>
          {desc && <p style={{ fontSize:11, color:"var(--gris)", marginTop:2 }}>{desc}</p>}
        </div>
        <div style={{ flexShrink:0, marginLeft:12, width:36, height:20, borderRadius:10, background:value?"var(--bleu-action)":"var(--bordure-forte)", position:"relative" as const, transition:"background 0.2s" }}>
          <div style={{ position:"absolute" as const, top:2, left:value?18:2, width:16, height:16, borderRadius:8, background:"var(--carte)", transition:"left 0.2s", boxShadow:"0 1px 3px rgb(var(--ombre-rgb) / 0.2)" }}/>
        </div>
      </button>
      {value && children && (
        <div style={{ padding:"12px 16px 16px", borderTop:"1px solid var(--bordure)", background:"rgb(var(--bleu-rgb) / 0.02)" }}>
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
    const telsDoubles = doublonsDans(form.telephones.filter(Boolean), normPhone);
    if (telsDoubles.length) { setError(`Numéro(s) en double : ${telsDoubles.join(", ")}`); return; }
    const mailsDoubles = doublonsDans(form.mails.filter(Boolean), normEmail);
    if (mailsDoubles.length) { setError(`Email(s) en double : ${mailsDoubles.join(", ")}`); return; }
    for (const pf of form.points_focaux.filter(p=>p.nom.trim())) {
      if (!pf.telephones.filter(Boolean).length) { setError(`Point focal « ${pf.nom} » : au moins un téléphone est obligatoire`); return; }
      if (!pf.mails.filter(Boolean).length) { setError(`Point focal « ${pf.nom} » : au moins un email est obligatoire`); return; }
    }
    const partagesPf = contactsPartages(form.points_focaux);
    if (partagesPf.length) { setError(`Téléphone(s) ou email(s) en double entre points focaux : ${partagesPf.join(", ")}`); return; }
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
            <FInput value={form.nom} onChange={e=>upd("nom",e.target.value)} placeholder="Nom de l'investisseur"/>
          </div>
          <div>
            <FLabel>Pays du siège social</FLabel>
            <PaysSelect value={form.siege_nom} onChange={nom=>upd("siege_nom",nom)} onChangeId={id=>upd("siege_id",id)} placeholder="Sélectionner le pays du siège social"/>
          </div>
        </div>
      </FSection>

      {/* Contact : téléphones, emails et site web sur la même ligne */}
      <FSection title="Contact">
        <FGrid cols={3} style={{ alignItems:"start", marginBottom:14 }}>
          <MultiPhones values={form.telephones} onChange={v=>upd("telephones",v)}/>
          <MultiMails  values={form.mails}      onChange={v=>upd("mails",v)}/>
          <div>
            {/* même hauteur d'en-tête que les colonnes voisines (bouton +) */}
            <div style={{ display:"flex", alignItems:"center", minHeight:24, marginBottom:8 }}>
              <label style={{ ...fuiLabel, marginBottom:0 }}>Site web</label>
            </div>
            <FInput value={form.siteweb} onChange={e=>upd("siteweb",e.target.value)} placeholder="www.exemple.com"/>
          </div>
        </FGrid>
        <div>
          <FLabel>LinkedIn</FLabel>
          <FInput value={form.linkedin} onChange={e=>upd("linkedin",e.target.value)}/>
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
        {(()=>{ const ok=form.points_focaux.every((pf:any)=>isContactComplete(pf,["nom","prenom"])) && contactsPartages(form.points_focaux).length===0; return (
        <button type="button" disabled={!ok}
          title={ok?undefined:"Complétez d'abord le point focal précédent (nom, prénom, téléphone et email valides)"}
          onClick={()=>ok&&upd("points_focaux",[...form.points_focaux,{ ...EMPTY_FOCAL, est_principal: form.points_focaux.length===0 }])}
          style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 14px", borderRadius:10, cursor:ok?"pointer":"not-allowed", opacity:ok?1:0.45, border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", transition:"border-color 0.15s", fontFamily:"var(--font-google-sans)" }}
          onMouseEnter={e=>{if(ok)e.currentTarget.style.borderColor="var(--bleu)";}}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bordure-forte)"}>
          <Plus size={14} color="var(--gris)"/>
          <span style={{ fontSize:13, color:"var(--gris)" }}>Ajouter un point focal</span>
        </button>
        ); })()}
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
      const res = await fetch(`${API}/prospects/contraintes/${id}`, { method:"DELETE", headers:await authHeaders() });
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
          method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())},
          body: JSON.stringify({ description: lines[0] }),
        });
        if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
        const saved = await res.json();
        setLocalContraintes(prev => prev.map((x:any)=>x.id===saved.id ? saved : x));
      } else {
        const hdrs = { "Content-Type": "application/json", ...(await authHeaders()) };
        const savedAll = await Promise.all(lines.map(line =>
          fetch(`${API}/prospects/${prospect.id}/contraintes`, {
            method:"POST", headers: hdrs,
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
        ? await fetch(`${API}/prospects/echanges/${edit.id}`, { method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body })
        : await fetch(`${API}/prospects/${prospect.id}/echanges`, { method:"POST", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const savedEchange = await res.json();
      const echangeId = savedEchange.id ?? edit?.id;
      if (compteRendu) {
        // Remplacement : supprimer l'ancien compte rendu pour n'en garder qu'un
        if (crExistant) {
          await fetch(`${API}/prospects/echanges/${echangeId}/fichiers/${crExistant.id}`, { method:"DELETE", headers:await authHeaders() });
        }
        const fd = new FormData();
        fd.append("titre", compteRendu.titre || compteRendu.file.name);
        fd.append("categorie", "compte_rendu");
        fd.append("fichier", compteRendu.file);
        await fetch(`${API}/prospects/echanges/${echangeId}/fichiers`, { method:"POST", headers:await authHeaders(), body:fd });
      }
      for (const p of pdfQueue) {
        const fd = new FormData();
        fd.append("titre", p.titre || p.file.name);
        fd.append("categorie", "autre");
        fd.append("fichier", p.file);
        await fetch(`${API}/prospects/echanges/${echangeId}/fichiers`, { method:"POST", headers:await authHeaders(), body:fd });
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
        <span style={{ fontSize:11, color:"var(--orange)", fontWeight:600 }}>
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
                        placeholder={meta?.placeholder || ""} style={{ borderColor: emailError?"var(--danger)":undefined }}/>
                      {emailError && <p style={{ fontSize:11, color:"var(--danger)", marginTop:3 }}>{emailError}</p>}
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
            <FLabel>Compte rendu <span style={{ color:"var(--danger)" }}>*</span></FLabel>
            {crExistant && !compteRendu && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--bleu-rgb) / 0.05)", border:"1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius:10, padding:"8px 12px", marginBottom:8 }}>
                <FileText size={13} style={{ color:"var(--bleu)", flexShrink:0 }}/>
                <a href={`${API}/prospects/echanges/${edit?.id}/fichiers/${crExistant.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, fontSize:12.5, color:"var(--bleu)", fontWeight:600, textDecoration:"none" }}>
                  {crExistant.titre}
                </a>
              </div>
            )}
            {compteRendu ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--violet-rgb) / 0.05)", border:"1px solid rgb(var(--violet-rgb) / 0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"var(--violet)", flexShrink:0 }}/>
                <input value={compteRendu.titre} onChange={e=>setCompteRendu(cr=>cr?{...cr,titre:e.target.value}:cr)}
                  placeholder="Titre du compte rendu"
                  style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgb(var(--violet-rgb) / 0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                <button onClick={()=>setCompteRendu(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"var(--danger)" }}/></button>
              </div>
            ) : (
              <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", transition:"border-color 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bleu)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bordure-forte)"}>
                <Upload size={14} color="var(--gris)"/>
                <span style={{ fontSize:13, color:"var(--gris)" }}>{crExistant ? "Remplacer le compte rendu (PDF)" : "Ajouter le compte rendu (PDF)"}</span>
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
            <FLabel>Autres documents <span style={{ fontWeight:400, color:"var(--gris)" }}>(facultatif)</span></FLabel>
            {autresExistants.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
                {autresExistants.map((f:any) => (
                  <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--bleu-rgb) / 0.05)", border:"1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius:10, padding:"8px 12px" }}>
                    <FileText size={13} style={{ color:"var(--bleu)", flexShrink:0 }}/>
                    <a href={`${API}/prospects/echanges/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{ flex:1, fontSize:12.5, color:"var(--bleu)", fontWeight:600, textDecoration:"none" }}>
                      {f.titre}
                    </a>
                  </div>
                ))}
              </div>
            )}
            {pdfQueue.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
                {pdfQueue.map((p,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--violet-rgb) / 0.05)", border:"1px solid rgb(var(--violet-rgb) / 0.2)", borderRadius:10, padding:"8px 12px" }}>
                    <FileText size={13} style={{ color:"var(--violet)", flexShrink:0 }}/>
                    <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                      placeholder="Titre du document"
                      style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgb(var(--violet-rgb) / 0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                    <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"var(--danger)" }}/></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", transition:"border-color 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bleu)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bordure-forte)"}>
              <Upload size={14} color="var(--gris)"/>
              <span style={{ fontSize:13, color:"var(--gris)" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
                const files = Array.from(e.target.files||[]);
                setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
                e.target.value="";
              }}/>
            </label>
            {(compteRendu || pdfQueue.length > 0) && (
              <p style={{ fontSize:11, color:"var(--gris)", marginTop:6 }}>Les fichiers seront téléversés à l'enregistrement.</p>
            )}
          </div>

        </div>
      </FSection>

      {/* Contraintes exprimées */}
      <FSection title="Contraintes exprimées">
        {localContraintes.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:6, marginBottom:8 }}>
            {localContraintes.map((c:any) => (
              <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:10, background:"rgb(var(--danger-rgb) / 0.04)", border:"1px solid rgb(var(--danger-rgb) / 0.15)", borderRadius:10, padding:"9px 12px" }}>
                <div style={{ flex:1, fontSize:12, color:"var(--encre)", lineHeight:1.5 }}>
                  {c.description.replace(/<[^>]+>/g,"").trim() || "—"}
                </div>
                <button type="button" onClick={()=>ouvrirContrainte(c)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", flexShrink:0 }}>
                  <Pencil size={12} style={{ color:"var(--gris)" }}/>
                </button>
                <button type="button" onClick={()=>supprimerContrainte(c.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", flexShrink:0 }}>
                  <Trash2 size={12} style={{ color:"var(--danger)" }}/>
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
                  <span style={{ color:"var(--bleu)", fontWeight:900, fontSize:18, flexShrink:0, lineHeight:1, userSelect:"none" as const }}>•</span>
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
            {contrainteError && <p style={{ fontSize:12, color:"var(--danger)" }}>{contrainteError}</p>}
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
            style={{ width:"100%", border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", borderRadius:10, padding:"11px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, color:"var(--gris)", fontSize:13, fontWeight:500, transition:"border-color 0.15s, color 0.15s", fontFamily:"var(--font-google-sans)" }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor="var(--bleu)"; (e.currentTarget as HTMLButtonElement).style.color="var(--bleu)"; }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.borderColor="var(--bordure-forte)"; (e.currentTarget as HTMLButtonElement).style.color="var(--gris)"; }}>
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
    if (!(await confirmer("Supprimer cet échange ?"))) return;
    setDeletingEchange(id);
    await fetch(`${API}/prospects/echanges/${id}`, { method:"DELETE", headers:await authHeaders() });
    setDeletingEchange(null);
    onRefresh();
  };

  const displayName = p.nom;

  // ── Système de design de la fiche
  const accent = "var(--bleu)";
  const TXT="var(--encre)", SUB="var(--texte)", MUT="var(--gris)", SURF="var(--sur-bleu)", BRD="var(--sur-bleu)", DIV="var(--sur-bleu)";
  const card: any = { background:SURF, border:`1px solid ${BRD}`, borderRadius:12, padding:"14px 16px" };
  const linkStyle: any = { fontSize:13, fontWeight:600, color:"var(--bleu)", wordBreak:"break-all" as const, textDecoration:"none" };
  const href = (u:string) => /^https?:\/\//.test(u) ? u : `https://${u}`;

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"var(--bleu)",textTransform:"uppercase" as const,letterSpacing:"0.14em",marginBottom:10}}>{children}</p>
  );

  const Section = ({ title, count, action, first, children }:any) => (
    <section style={{ marginTop:first?0:22, paddingTop:first?0:22, borderTop:first?"none":`1px solid ${DIV}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12, minHeight:24 }}>
        <h3 style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.14em", textTransform:"uppercase" as const }}>
          {title}{typeof count==="number" ? <span style={{ color:"var(--gris)", fontWeight:700, marginLeft:7 }}>{count}</span> : null}
        </h3>
        {action || null}
      </div>
      {children}
    </section>
  );

  const SubLabel = ({ children, color }:any) => (
    <p style={{ fontSize:10, fontWeight:700, color:color||MUT, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:6 }}>{children}</p>
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
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--bleu-action)", flexShrink:0 }}/><span style={{ fontSize:12, fontWeight:700, color:"var(--bleu)" }}>{sec.nom}</span>
            </div>
            {brasDuSec.length>0 && <div style={{ paddingLeft:20, borderLeft:"2px solid rgb(var(--bleu-rgb) / 0.15)", display:"flex", flexDirection:"column" as const, gap:5 }}>
              {brasDuSec.map((bra:any)=>{
                const actsDeBra = activites.filter(a=>a.branche_id===bra.id && actIds.includes(a.id));
                return (
                  <div key={bra.id}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:actsDeBra.length?4:0 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--orange-action)", flexShrink:0 }}/><span style={{ fontSize:11, fontWeight:600, color:"var(--orange)" }}>{bra.nom}</span>
                    </div>
                    {actsDeBra.length>0 && <div style={{ paddingLeft:18, display:"flex", flexDirection:"column" as const, gap:3 }}>
                      {actsDeBra.map((act:any)=>(
                        <div key={act.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--vert-action)", flexShrink:0 }}/><span style={{ fontSize:11, color:"var(--vert)", fontWeight:500 }}>{act.nom}</span>
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
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} style={{ position:"fixed", inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}\n.cr-rte, .cr-rte *{font-size:12px !important; line-height:1.6 !important;}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:720, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height:4, background:"var(--bleu-action)", flexShrink:0 }}/>

        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:TXT, lineHeight:1.3 }}>{displayName}</h2>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const, marginTop:8 }}>
              {(()=>{ const b=badgeProspect(p); return b ? (
                <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:b.color, background:b.bg, padding:"3px 10px", borderRadius:999 }}>{b.label}</span>
              ) : null; })()}
              {p.siege_nom && <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{p.siege_nom}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"var(--champ)", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)"/>
          </button>
        </div>

        {/* Corps */}
        <div ref={scrollContainerRef} style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1 }}>

          {/* Identité, contacts, activités, commentaires — masqués en readOnly et historiqueOnly */}
          {!historiqueOnly && !readOnly && <>
          {/* Contact */}
          {(p.telephones?.length > 0 || p.mails?.length > 0 || p.siteweb || p.linkedin) && (
            <Section title="Contact" first>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {p.telephones?.length > 0 && (
                  <div style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"9px 12px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:3 }}>{p.telephones.length > 1 ? "Téléphones" : "Téléphone"}</p>
                    {p.telephones.map((t:string,i:number)=>(
                      <p key={i} style={{ fontSize:12.5, fontWeight:600, color:"var(--encre)" }}>{fmtPhone(t)}</p>
                    ))}
                  </div>
                )}
                {p.mails?.length > 0 && (
                  <div style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"9px 12px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:3 }}>{p.mails.length > 1 ? "Emails" : "Email"}</p>
                    {p.mails.map((m:string,i:number)=>(
                      <p key={i} style={{ fontSize:12.5, fontWeight:600, color:"var(--encre)", wordBreak:"break-all" as const }}>{m}</p>
                    ))}
                  </div>
                )}
                {p.siteweb && (
                  <div style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"9px 12px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:3 }}>Site web</p>
                    <a href={href(p.siteweb)} target="_blank" rel="noreferrer" style={{ fontSize:12.5, fontWeight:600, color:"var(--bleu)", textDecoration:"none", wordBreak:"break-all" as const }}>{p.siteweb}</a>
                  </div>
                )}
                {p.linkedin && (
                  <div style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"9px 12px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, marginBottom:3 }}>LinkedIn</p>
                    <a href={href(p.linkedin)} target="_blank" rel="noreferrer" style={{ fontSize:12.5, fontWeight:600, color:"var(--bleu)", textDecoration:"none", wordBreak:"break-all" as const }}>{p.linkedin}</a>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Activités spécialisées (Secteur → Branche → Activité) */}
          {(p.secteur_ids?.length>0 || p.branche_ids?.length>0 || p.activite_ids?.length>0) && (
            <Section title="Activités spécialisées">
              <NaemaCascade secIds={p.secteur_ids||[]} braIds={p.branche_ids||[]} actIds={p.activite_ids||[]}/>
            </Section>
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
                    <div key={i} style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:12, padding:"11px 14px", fontSize:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
                        <span style={{ fontWeight:700, color:"var(--encre)" }}>{[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                        {pf.poste && <span style={{ fontSize:11, color:"var(--gris)" }}>{pf.poste}</span>}
                        {pf.est_principal && <span style={{ fontSize:10, fontWeight:700, color:"var(--orange)", background:"rgb(var(--orange-rgb) / 0.08)", borderRadius:999, padding:"2px 8px" }}>Principal</span>}
                      </div>
                      {(pfTels.length > 0 || pfMails.length > 0) && (
                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:7 }}>
                          {pfTels.map((t:string, ti:number) => (
                            <span key={`t${ti}`} style={{ fontSize:11, fontWeight:600, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{fmtPhone(t)}</span>
                          ))}
                          {pfMails.map((m:string, mi:number) => (
                            <span key={`m${mi}`} style={{ fontSize:11, fontWeight:600, color:"var(--vert)", background:"rgb(var(--vert-rgb) / 0.07)", padding:"3px 10px", borderRadius:999 }}>{m}</span>
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
            <Section title="Compte rendu des échanges" count={echangesDuCycle(p,null).length} first={historiqueOnly}
              action={
                <button onClick={()=>setShowEchanges(o=>!o)}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:`1px solid ${BRD}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:11, fontWeight:600, color:SUB }}>
                  {showEchanges?<>Masquer <ChevronUp size={12}/></>:<>Afficher <ChevronDown size={12}/></>}
                </button>
              }>
              {showEchanges && echangesDuCycle(p,null).length > 0 && (
                <>
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
                          <div style={{ position:"absolute" as const, left:1, top:16, width:9, height:9, borderRadius:"50%", background:accent, border:"2px solid var(--carte)", boxShadow:`0 0 0 1px ${voile(accent, 27)}` }}/>
                          <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:12, padding:"13px 15px" }}>

                            {/* En-tête : date déclarée + actions */}
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:TXT }}>
                                {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                              </span>
                              {canAct && (
                                <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                                  <button onClick={()=>onEditEchange?.(e)}
                                    style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgb(var(--bleu-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 7px" }}
                                    title="Modifiable pendant 24h">
                                    <Pencil size={11} style={{ color:"var(--bleu)" }}/>
                                  </button>
                                  <button onClick={()=>handleDeleteEchange(e.id)} disabled={deletingEchange===e.id}
                                    style={{ background:"rgb(var(--danger-rgb) / 0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 7px" }}
                                    title="Supprimer">
                                    {deletingEchange===e.id
                                      ? <Loader2 size={11} style={{ color:"var(--danger)", animation:"spin 1s linear infinite" }}/>
                                      : <Trash2 size={11} style={{ color:"var(--danger)" }}/>}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Méta : canal + participants */}
                            {(e.canal || e.interlocuteur || e.contact_par) && (
                              <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap" as const, gap:6, marginTop:8 }}>
                                {e.canal && (()=>{ const CIcon = canalIcon(e.canal); const coord = canalContactDisplay(e.canal, e.canal_contact); return (
                                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, fontWeight:700, color:"var(--texte)", background:"var(--champ)", padding:"3px 10px", borderRadius:999 }}>
                                    <CIcon size={11} style={{ flexShrink:0 }}/>{e.canal}{coord ? ` · ${coord}` : ""}
                                  </span>
                                ); })()}
                                {(e.interlocuteur || e.contact_par) && (
                                  <span style={{ fontSize:11, color:MUT, fontWeight:500 }}>
                                    {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Compte-rendu */}
                            {e.commentaire && (
                              <div style={{ background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:10, padding:"10px 13px", marginTop:10 }}>
                                <div data-rte className="cr-rte" style={{ fontSize:12, color:SUB, lineHeight:1.7 }}
                                  dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                              </div>
                            )}

                            {/* Documents attachés */}
                            {e.fichiers?.length > 0 && (
                              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:8 }}>
                                {e.fichiers.map((f:any) => (
                                  <a key={f.id}
                                    href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                    target="_blank" rel="noopener noreferrer"
                                    style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:999, background:"rgb(var(--bleu-rgb) / 0.06)", textDecoration:"none", fontSize:11, color:"var(--bleu)", fontWeight:600 }}>
                                    <FileText size={11} style={{ flexShrink:0 }}/>{f.titre}
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Pied : horodatage serveur */}
                            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:9, borderTop:`1px solid ${DIV}` }}>
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
                  <SubLabel color="var(--bleu)">
                    {contraintesCycleCourant(p).length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                  </SubLabel>
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                    {contraintesCycleCourant(p).map((c:any) => (
                      <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--bleu-action)", flexShrink:0, marginTop:6 }}/>
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
            <div style={{ marginTop:readOnly?0:22, display:"flex", flexDirection:"column" as const, gap:8 }}>
              {/* Cycle courant figé : synthétique, affiché uniquement en readOnly */}
              {readOnly && estFige(p) && (()=>{
                const currentNum = (p.cycles?.length || 0) + 1;
                const inst = p.issue === "installe";
                const col  = inst ? "var(--vert-fonce)" : "var(--gris-fort)";
                const synId = -1;
                const isOpen = openCycles.has(synId);
                const echsCourant = echangesDuCycle(p, null);
                const contrCourant = contraintesCycleCourant(p);
                return (
                  <div style={{ border:`1px solid ${BRD}`, borderRadius:12, overflow:"hidden" as const }}>
                    <button onClick={()=>toggleCycle(synId)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", background: isOpen ? SURF : "var(--carte)", border:"none", cursor:"pointer", textAlign:"left" as const }}>
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
                                    <div style={{ position:"absolute" as const, left:1, top:16, width:9, height:9, borderRadius:"50%", background:accent, border:"2px solid var(--carte)", boxShadow:`0 0 0 1px ${voile(accent, 27)}` }}/>
                                    <div style={{ background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:12, padding:"13px 15px" }}>
                                      <div style={{ fontSize:13, fontWeight:800, color:TXT }}>
                                        {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                                      </div>
                                      {(e.canal || e.interlocuteur || e.contact_par) && (
                                        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap" as const, gap:6, marginTop:8 }}>
                                          {e.canal && (()=>{ const CIcon=canalIcon(e.canal); const coord=canalContactDisplay(e.canal,e.canal_contact); return (
                                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, fontWeight:700, color:"var(--texte)", background:"var(--champ)", padding:"3px 10px", borderRadius:999 }}>
                                              <CIcon size={11} style={{ flexShrink:0 }}/>{e.canal}{coord ? ` · ${coord}` : ""}
                                            </span>
                                          );})()}
                                          {(e.interlocuteur||e.contact_par) && (
                                            <span style={{ fontSize:11, color:MUT, fontWeight:500 }}>
                                              {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {e.commentaire && (
                                        <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:10, padding:"10px 13px", marginTop:10 }}>
                                          <div data-rte className="cr-rte" style={{ fontSize:12, color:SUB, lineHeight:1.7 }}
                                            dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                                        </div>
                                      )}
                                      {e.fichiers?.length > 0 && (
                                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:8 }}>
                                          {e.fichiers.map((f:any) => (
                                            <a key={f.id}
                                              href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                              target="_blank" rel="noopener noreferrer"
                                              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:999, background:"rgb(var(--bleu-rgb) / 0.06)", textDecoration:"none", fontSize:11, color:"var(--bleu)", fontWeight:600 }}>
                                              <FileText size={11} style={{ flexShrink:0 }}/>{f.titre}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {/* Pied : horodatage serveur */}
                                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:9, borderTop:`1px solid ${DIV}` }}>
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
                            <SubLabel color="var(--bleu)">
                              {contrCourant.length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                            </SubLabel>
                            <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                              {contrCourant.map((c:any) => (
                                <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--bleu-action)", flexShrink:0, marginTop:6 }}/>
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
                const col  = inst ? "var(--vert-fonce)" : "var(--gris-fort)";
                const isOpen = openCycles.has(cy.id);
                const echangesCy    = echangesDuCycle(p, cy);
                const contraintesCy = contraintesDuCycle(p, cy);
                return (
                  <div key={cy.id} style={{ border:`1px solid ${BRD}`, borderRadius:12, overflow:"hidden" as const }}>
                    {/* En-tête cliquable */}
                    <button onClick={()=>toggleCycle(cy.id)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", background: isOpen ? SURF : "var(--carte)", border:"none", cursor:"pointer", textAlign:"left" as const }}>
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
                                    <div style={{ position:"absolute" as const, left:1, top:16, width:9, height:9, borderRadius:"50%", background:accent, border:"2px solid var(--carte)", boxShadow:`0 0 0 1px ${voile(accent, 27)}` }}/>
                                    <div style={{ background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:12, padding:"13px 15px" }}>
                                      <div style={{ fontSize:13, fontWeight:800, color:TXT }}>
                                        {new Date(e.date_echange).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}
                                      </div>
                                      {(e.canal || e.interlocuteur || e.contact_par) && (
                                        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap" as const, gap:6, marginTop:8 }}>
                                          {e.canal && (()=>{ const CIcon=canalIcon(e.canal); const coord=canalContactDisplay(e.canal,e.canal_contact); return (
                                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, fontWeight:700, color:"var(--texte)", background:"var(--champ)", padding:"3px 10px", borderRadius:999 }}>
                                              <CIcon size={11} style={{ flexShrink:0 }}/>{e.canal}{coord ? ` · ${coord}` : ""}
                                            </span>
                                          );})()}
                                          {(e.interlocuteur||e.contact_par) && (
                                            <span style={{ fontSize:11, color:MUT, fontWeight:500 }}>
                                              {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {e.commentaire && (
                                        <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:10, padding:"10px 13px", marginTop:10 }}>
                                          <div data-rte className="cr-rte" style={{ fontSize:12, color:SUB, lineHeight:1.7 }}
                                            dangerouslySetInnerHTML={{ __html:e.commentaire }}/>
                                        </div>
                                      )}
                                      {e.fichiers?.length > 0 && (
                                        <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5, marginTop:8 }}>
                                          {e.fichiers.map((f:any) => (
                                            <a key={f.id}
                                              href={`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                                              target="_blank" rel="noopener noreferrer"
                                              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:999, background:"rgb(var(--bleu-rgb) / 0.06)", textDecoration:"none", fontSize:11, color:"var(--bleu)", fontWeight:600 }}>
                                              <FileText size={11} style={{ flexShrink:0 }}/>{f.titre}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      {/* Pied : horodatage serveur */}
                                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:MUT, marginTop:10, paddingTop:9, borderTop:`1px solid ${DIV}` }}>
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
                            <SubLabel color="var(--bleu)">
                              {contraintesCy.length===1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                            </SubLabel>
                            <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                              {contraintesCy.map((c:any) => (
                                <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:SUB }}>
                                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--bleu-action)", flexShrink:0, marginTop:6 }}/>
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
        <div style={{ display:"flex", gap:10, justifyContent:"space-between", alignItems:"center", padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", flexShrink:0 }}>
          {(!readOnly && !estFige(p)) ? (
            <button className="ro-w" onClick={onContacter}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:"none", background:"rgb(var(--vert-rgb) / 0.08)", color:"var(--vert)", fontWeight:700, cursor:"pointer", fontSize:12.5, fontFamily:"var(--font-google-sans)" }}>
              <MessageSquare size={13}/> Contacter
            </button>
          ) : <span/>}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose}
              style={{ padding:"10px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            {!readOnly && !historiqueOnly && (
              <button className="ro-w" onClick={onEdit}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)" }}>
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
    if (!(await confirmer("Supprimer ce prospect ?"))) return;
    setDeleting(id);
    await fetch(`${API}/prospects/${id}`, { method:"DELETE", headers:await authHeaders() });
    setDeleting(null); charger();
  };

  const handleTerminer = async (id:number) => {
    if (!terminerForm.issue || !terminerForm.commentaire) return;
    setSavingTerminer(true);
    try {
      const res = await fetch(`${API}/prospects/${id}/conclusion`, {
        method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())},
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
    if (!(await confirmer("Re-contacter cette entreprise ?\n\nUne nouvelle prospection démarre. Tout l'historique précédent (échanges, contraintes, conclusion) est conservé et consultable."))) return;
    const res = await fetch(`${API}/prospects/${id}/recontact`, { method:"POST", headers:await authHeaders() });
    if (res.ok) { setVue(null); setOnglet("historique"); }
    else { const d=await res.json().catch(()=>({})); alert(d.detail||"Erreur lors du re-contact"); }
  };

  return (
    <div style={{ fontFamily:"var(--font-google-sans)" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
        @keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
        [data-rte] ul{padding-left:20px;list-style-type:disc}
        [data-rte] ol{padding-left:20px;list-style-type:decimal}
        [data-rte] li{margin-bottom:2px}
        [data-rte] b,[data-rte] strong{font-weight:700}
        [data-rte] i,[data-rte] em{font-style:italic}
        [data-rte] *{font-family:var(--font-google-sans);font-size:13px}
      `}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Prospects" compact ton="orange" pleineLargeur
        droite={onglet!=="precedents" ? (
          <button className="ro-w" onClick={()=>{ setEdit(null); setModal(true); }}
            style={{ display:"inline-flex", alignItems:"center", gap:8, background:"var(--carte)", color:"var(--orange)", fontWeight:700, fontSize:13, padding:"9px 18px", borderRadius:999, border:"none", cursor:"pointer", boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.16)", fontFamily:"var(--font-google-sans)", transition:"background 0.15s, transform 0.15s", flexShrink:0, whiteSpace:"nowrap" as const }}
            onMouseEnter={ev=>{ev.currentTarget.style.background="var(--orange-voile)";ev.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={ev=>{ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="none";}}>
            <Plus size={15}/> Nouveau prospect
          </button>
        ) : undefined}>
        <BarreTitreSegment
          options={([["cibles","Investisseurs ciblés"],["historique","Investisseurs en contact"],["precedents","Investisseurs transformés"]] as const)
            .map(([v,l])=>({ v, l, count: counts[v] }))}
          value={onglet} onChange={v=>setOnglet(v)} />
      </BarreTitre>

      <div style={{ padding:"28px 40px 80px" }}>
      {loading ? (
        <SkeletonCards n={6} cols={3} height={190}/>
      ) : prospects.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 24px", color:"var(--gris)" }}>
          <Building2 size={48} style={{ marginBottom:16, opacity:0.3 }}/>
          <p style={{ fontSize:16, fontWeight:600, color:"var(--texte)" }}>Aucun prospect</p>
          <p style={{ fontSize:14, marginTop:6 }}>{onglet==="cibles"?"Cliquez sur « Nouveau prospect » pour commencer.":onglet==="historique"?"Aucun échange enregistré pour l'instant.":"Aucune prospection conclue pour l'instant."}</p>
        </div>
      ) : (
        <>
          <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:14 }}>
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
              // Accent de survol = couleur du statut (comme la page publique)
              const hoverC = activite ? (STATUT_HEX[activite.label] || "var(--gris)") : "rgb(var(--bleu-rgb) / 0.33)";
              const badgeStatut = activite ? (STATUT_BADGE[activite.label] || badge_gris) : null;
              return (
                <div key={p.id} onClick={()=>setVue(p)}
                  style={{ background:"var(--carte)", border:"1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius:16, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", display:"flex", flexDirection:"column" as const, overflow:"hidden" }}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=hoverC;}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";}}>

                  <div style={{ padding:"18px 20px 16px", flex:1, display:"flex", flexDirection:"column" as const, gap:13 }}>
                    {/* Dénomination + repère temporel | badge de statut */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, minWidth:0 }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:15.5, color:"var(--encre)", lineHeight:1.35, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</div>
                        {(()=>{
                          const sousTitre = onglet==="cibles"
                            ? (p.nb_echanges>0 ? "Déjà contacté" : null)
                            : onglet==="precedents" && p.issue_conclu_le
                            ? `${p.issue==="decline"?"Décliné":"Conclu"} le ${fmtJour(p.issue_conclu_le)}`
                            : null;
                          return sousTitre && <div style={{ fontSize:11, fontWeight:500, color:"var(--gris)", marginTop:3 }}>{sousTitre}</div>;
                        })()}
                      </div>
                      {onglet!=="cibles" && activite && badgeStatut && (
                        <span style={{ ...badgeStatut, whiteSpace:"nowrap" as const, flexShrink:0 }}>{activite.label}</span>
                      )}
                    </div>

                    {/* Pays · info contextuelle en rangée épurée */}
                    <div style={{ display:"flex", alignItems:"center", borderTop:"1px solid var(--bordure)", paddingTop:13, marginTop:"auto" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"var(--gris)", textTransform:"uppercase" as const, marginBottom:4 }}>{onglet==="cibles"?"Pays":"Email"}</p>
                        <p style={{ fontSize:12.5, fontWeight:700, color:(onglet==="cibles"?p.siege_nom:p.mails?.[0])?"var(--encre)":"var(--gris)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>
                          {(onglet==="cibles" ? p.siege_nom : p.mails?.[0]) || "—"}
                        </p>
                      </div>
                      <div style={{ width:1, alignSelf:"stretch", background:"var(--fond)", margin:"0 18px" }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"var(--gris)", textTransform:"uppercase" as const, marginBottom:4 }}>{info2.label}</p>
                        <p style={{ fontSize:12.5, fontWeight:700, color:info2.value?"var(--encre)":"var(--gris)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, fontVariantNumeric:"tabular-nums" }}>{info2.value||"—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {onglet==="precedents" ? (
                    <div className="ro-w" style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid var(--bordure)" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setVue(p)}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--texte)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--gris-rgb) / 0.07)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        Consulter
                      </button>
                      {p.issue==="decline" && (
                        <>
                          <div style={{ width:1, background:"var(--fond)" }}/>
                          <button onClick={()=>handleRecontact(p.id)}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--vert)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--vert-rgb) / 0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Re-contacter
                          </button>
                        </>
                      )}
                      <div style={{ width:1, background:"var(--fond)" }}/>
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                        title="Supprimer définitivement (test)"
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        {deleting===p.id?<Loader2 size={12} style={{ color:"var(--danger)",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"var(--danger)" }}/>}
                      </button>
                    </div>
                  ) : onglet==="historique" ? (
                    <div onClick={e=>e.stopPropagation()}>
                      {(()=>{
                        const nbEchangesCourants = echangesDuCycle(p, null).length;
                        const terminerDisabled = nbEchangesCourants === 0;
                        return (
                        <div className="ro-w" style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid var(--bordure)" }}>
                          <button onClick={()=>{ setEchangeEdit(null); setEchangeProspect(p); setEchangeModal(true); }}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--vert)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--vert-rgb) / 0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Contacter
                          </button>
                          <div style={{ width:1, background:"var(--fond)" }}/>
                          <button disabled={terminerDisabled} onClick={()=>{ if(!terminerDisabled){ setTerminerOpenId(terminerOpenId===p.id?null:p.id); setTerminerForm({ issue:"", commentaire:"" }); } }}
                            title={terminerDisabled?"Au moins un échange est requis pour terminer ce cycle":undefined}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:terminerDisabled?"not-allowed":"pointer", padding:"10px 0", fontSize:11.5, color:terminerDisabled?"var(--gris)":"var(--orange)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>{if(!terminerDisabled)ev.currentTarget.style.background="rgb(var(--orange-rgb) / 0.05)";}}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <Check size={12}/> Terminer
                          </button>
                        </div>
                        );
                      })()}
                      {terminerOpenId===p.id && (
                        <div style={{ margin:"0 14px 14px", padding:"12px 14px", background:"var(--carte-douce)", borderRadius:10, border:"1px solid var(--bordure)" }}>
                          <p style={{ fontSize:11, fontWeight:700, color:"var(--orange)", letterSpacing:"0.1em", textTransform:"uppercase" as const, marginBottom:10 }}>Conclusion de la prospection</p>
                          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                            {[{val:"installe",lbl:"Installation au Sénégal",col:"var(--vert)"},{val:"decline",lbl:"Possibilité écartée",col:"var(--gris-fort)"}].map(({val,lbl,col})=>(
                              <button key={val} type="button" onClick={()=>setTerminerForm(f=>({ ...f, issue:val }))}
                                style={{ flex:1, padding:"8px 6px", borderRadius:8, border:`1.5px solid ${terminerForm.issue===val?col:"var(--bordure-forte)"}`, background:terminerForm.issue===val?`${voile(col, 9)}`:"transparent", color:terminerForm.issue===val?col:"var(--gris)", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                                {lbl}
                              </button>
                            ))}
                          </div>
                          <div style={{ marginBottom:10 }}>
                            <p style={{ fontSize:11, fontWeight:600, color:"var(--texte)", marginBottom:5 }}>Commentaire *</p>
                            <RichTextEditor value={terminerForm.commentaire} onChange={(v:string)=>setTerminerForm(f=>({ ...f, commentaire:v }))}/>
                          </div>
                          <button disabled={!terminerForm.issue||!terminerForm.commentaire||savingTerminer}
                            onClick={()=>handleTerminer(p.id)}
                            style={{ width:"100%", padding:"9px 0", borderRadius:8, border:"none", cursor:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"not-allowed":"pointer", background:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"var(--fond-creux2)":"var(--orange-action)", color:(!terminerForm.issue||!terminerForm.commentaire||savingTerminer)?"var(--gris)":"var(--sur-bleu)", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                            {savingTerminer?<Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/>:<Check size={12}/>}
                            Conclure la prospection
                          </button>
                        </div>
                      )}
                    </div>
                  ) : onglet==="cibles" && p.nb_echanges > 0 ? (
                    // Prospect déjà contacté dans "Investisseurs ciblés" : Modifier uniquement, pas Contacter ni Delete
                    <div className="ro-w" style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid var(--bordure)" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{ setEdit(p); setModal(true); }}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--bleu)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        <Pencil size={12}/> Modifier
                      </button>
                    </div>
                  ) : (
                    <div className="ro-w" style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid var(--bordure)" }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{ setEdit(p); setModal(true); }}
                        style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--bleu)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        <Pencil size={12}/> Modifier
                      </button>
                      {!estFige(p) && (
                        <>
                          <div style={{ width:1, background:"var(--fond)" }}/>
                          <button onClick={()=>{ setEchangeEdit(null); setEchangeProspect(p); setEchangeModal(true); }}
                            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"var(--vert)", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--vert-rgb) / 0.05)"}
                            onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                            <MessageSquare size={12}/> Contacter
                          </button>
                        </>
                      )}
                      <div style={{ width:1, background:"var(--fond)" }}/>
                      <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                        style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        {deleting===p.id?<Loader2 size={12} style={{ color:"var(--danger)",animation:"spin 1s linear infinite" }}/>:<Trash2 size={12} style={{ color:"var(--danger)" }}/>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

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
