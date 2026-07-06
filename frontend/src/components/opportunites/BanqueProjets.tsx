"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Loader2, X, Check, Eye, EyeOff, FileText, Upload, Plus } from "lucide-react";
import { parsePhoneNumber } from "libphonenumber-js";

function fmtPhone(raw: string) { try { return parsePhoneNumber(raw.trim()).formatInternational(); } catch { return raw.trim(); } }
import GeoCascadeSelect from "@/components/shared/GeoCascadeSelect";
import { FModal, FSection, FGrid, FLabel, FInput, FSelect, FToggle, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import PhoneInput, { isPhoneComplete, isEmailComplete, isContactComplete, listePreteAjout, contactsPartages, normPhone, normEmail } from "@/components/shared/PhoneInput";

// Bouton « + Ajouter » d'une liste de contacts : actif seulement si toutes les entrées sont valides
function BtnAjoutContact({ ok, onClick, titre }: { ok:boolean; onClick:()=>void; titre:string }) {
  return (
    <button onClick={()=>ok&&onClick()} disabled={!ok} title={ok?undefined:titre}
      style={{ fontSize:10, fontWeight:600, color:"#004f91", background:"rgba(0,79,145,0.08)", border:"none", borderRadius:6, padding:"2px 8px", cursor:ok?"pointer":"not-allowed", opacity:ok?1:0.35, fontFamily:"var(--font-google-sans)" }}>
      + Ajouter
    </button>
  );
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any  = { background:"#fff", border:"1px solid #E4E1DE", borderRadius:10, padding:"10px 13px", fontSize:13.5, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const validMail = (v: string) => !v || /^[^@.][^@]*@[^@]+\.[^@]+[^@.]$/.test(v.trim());
const ERR_MAIL = "Email invalide";
function FieldErr({ msg }: { msg: string }) {
  return <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>{msg}</p>;
}

// ── Point focal row ───────────────────────────────────────────────────────────
function PointFocalRow({ pf, idx, onChange, onRemove }: {
  pf:any; idx:number; onChange:(v:any)=>void; onRemove:()=>void;
}) {
  const upd = (k:string, v:any) => onChange({...pf, [k]:v});
  return (
    <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Point focal {idx+1}</span>
        <button onClick={onRemove} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
          <X size={12} style={{ color:"#dc2626" }}/>
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 1fr", gap:8, marginBottom:10 }}>
        <div>
          <label style={LS}>Civilité</label>
          <select value={pf.civilite||""} onChange={e=>upd("civilite",e.target.value)} style={IS}>
            <option value="">—</option><option>Monsieur</option><option>Madame</option>
          </select>
        </div>
        <div><label style={LS}>Nom</label><input value={pf.nom||""} onChange={e=>upd("nom",e.target.value)} placeholder="Nom" style={IS}/></div>
        <div><label style={LS}>Prénom</label><input value={pf.prenom||""} onChange={e=>upd("prenom",e.target.value)} placeholder="Prénom" style={IS}/></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {/* Téléphones */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Téléphone(s)</label>
            <BtnAjoutContact ok={listePreteAjout(pf.telephones||[""], isPhoneComplete, normPhone)} titre="Saisissez d'abord un numéro valide"
              onClick={()=>upd("telephones",[...(pf.telephones||[""]), ""])}/>
          </div>
          {(pf.telephones||[""]).map((tel:string, ti:number)=>(
            <div key={ti} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <PhoneInput value={tel} onChange={v=>{ const arr=[...(pf.telephones||[""])]; arr[ti]=v; upd("telephones",arr); }}/>
              </div>
              {(pf.telephones||[""]).length>1&&(
                <button onClick={()=>upd("telephones",(pf.telephones||[""]).filter((_:any,i:number)=>i!==ti))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px", marginTop:1 }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Mails */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Mail(s)</label>
            <BtnAjoutContact ok={listePreteAjout(pf.mails||[""], isEmailComplete, normEmail)} titre="Saisissez d'abord un email valide"
              onClick={()=>upd("mails",[...(pf.mails||[""]), ""])}/>
          </div>
          {(pf.mails||[""]).map((mail:string, mi:number)=>(
            <div key={mi} style={{ display:"flex", gap:5, marginBottom:6 }}>
              <input type="text" value={mail} onChange={e=>{ const arr=[...(pf.mails||[""])]; arr[mi]=e.target.value; upd("mails",arr); }}
                placeholder="contact@domaine.sn" style={{...IS, borderColor: mail&&!validMail(mail)?"#dc2626":"#E4E1DE"}}/>
              {(pf.mails||[""]).length>1&&(
                <button onClick={()=>upd("mails",(pf.mails||[""]).filter((_:any,i:number)=>i!==mi))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px" }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
              {mail&&!validMail(mail)&&<FieldErr msg={ERR_MAIL}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Porteur row ───────────────────────────────────────────────────────────────
function PorteurRow({ p: porteur, idx, onChange, onRemove }: {
  p:any; idx:number; onChange:(v:any)=>void; onRemove:()=>void;
}) {
  const upd = (k:string, v:any) => onChange({...porteur, [k]:v});
  return (
    <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Porteur {idx+1}</span>
        <button onClick={onRemove} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
          <X size={12} style={{ color:"#dc2626" }}/>
        </button>
      </div>
      <div style={{ marginBottom:10 }}>
        <label style={LS}>Nom / Organisation</label>
        <input value={porteur.nom||""} onChange={e=>upd("nom",e.target.value)} placeholder="Ex : Ministère des Finances" style={IS}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {/* Téléphones */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Téléphone(s)</label>
            <BtnAjoutContact ok={listePreteAjout(porteur.telephones||[""], isPhoneComplete, normPhone)} titre="Saisissez d'abord un numéro valide"
              onClick={()=>upd("telephones",[...(porteur.telephones||[""]), ""])}/>
          </div>
          {(porteur.telephones||[""]).map((tel:string, ti:number)=>(
            <div key={ti} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <PhoneInput value={tel} onChange={v=>{ const arr=[...(porteur.telephones||[""])]; arr[ti]=v; upd("telephones",arr); }}/>
              </div>
              {(porteur.telephones||[""]).length>1&&(
                <button onClick={()=>upd("telephones",(porteur.telephones||[""]).filter((_:any,i:number)=>i!==ti))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px", marginTop:1 }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Mails */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Mail(s)</label>
            <BtnAjoutContact ok={listePreteAjout(porteur.mails||[""], isEmailComplete, normEmail)} titre="Saisissez d'abord un email valide"
              onClick={()=>upd("mails",[...(porteur.mails||[""]), ""])}/>
          </div>
          {(porteur.mails||[""]).map((mail:string, mi:number)=>(
            <div key={mi} style={{ display:"flex", gap:5, marginBottom:6 }}>
              <input type="text" value={mail} onChange={e=>{ const arr=[...(porteur.mails||[""])]; arr[mi]=e.target.value; upd("mails",arr); }}
                placeholder="contact@domaine.sn" style={{...IS, borderColor: mail&&!validMail(mail)?"#dc2626":"#E4E1DE"}}/>
              {(porteur.mails||[""]).length>1&&(
                <button onClick={()=>upd("mails",(porteur.mails||[""]).filter((_:any,i:number)=>i!==mi))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px" }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
              {mail&&!validMail(mail)&&<FieldErr msg={ERR_MAIL}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddBtn({ label, onClick, ok = true, titre }: { label:string; onClick:()=>void; ok?:boolean; titre?:string }) {
  return (
    <button onClick={()=>ok&&onClick()} disabled={!ok} title={ok?undefined:titre}
      style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"11px 14px", borderRadius:10, border:"2px dashed #E4E1DE", background:"#FAFAF9", color:"#9aa5b4", fontSize:12.5, fontWeight:600, cursor:ok?"pointer":"not-allowed", opacity:ok?1:0.45, fontFamily:"var(--font-google-sans)", transition:"all 0.15s" }}
      onMouseEnter={e=>{ if(ok){ e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.color="#004f91"; } }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E4E1DE"; e.currentTarget.style.color="#9aa5b4"; }}>
      <Plus size={13}/> {label}
    </button>
  );
}

const DEVISE_SYMBOLE: Record<string,string> = { XOF:"FCFA", USD:"$", EUR:"€", GBP:"£", CNY:"¥", CAD:"CA$", CHF:"CHF", JPY:"¥" };
const devSymbole = (code?:string, symbole?:string) => symbole || (code ? DEVISE_SYMBOLE[code]||code : "");

// Chiffres et virgule uniquement : le « . » du clavier devient « , », une seule
// virgule (2 décimales max), milliers groupés à la saisie (1 000 000).
// La valeur remontée au parent utilise le point décimal (format backend).
function MoneyInput({ value, onChange, placeholder }: { value:string; onChange:(v:string)=>void; placeholder?:string }) {
  const fmt = (raw: string) => {           // raw en point décimal : "1234567.5"
    if (!raw) return "";
    const [int, dec] = raw.split(".");
    const g = (int||"").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return dec !== undefined ? `${g},${dec}` : g;
  };
  const [display, setDisplay] = useState(() => fmt(String(value||"")));
  useEffect(()=>{
    const raw = display.replace(/\s/g,"").replace(",",".");
    if (raw !== String(value||"")) setDisplay(fmt(String(value||"")));
  }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value.replace(/[^\d.,]/g,"").replace(/\./g,",");
    const i = s.indexOf(",");
    if (i !== -1) s = s.slice(0, i+1) + s.slice(i+1).replace(/,/g,"").slice(0,2);
    const raw = s.replace(",",".");
    setDisplay(fmt(raw));
    onChange(raw);
  };
  return <input type="text" inputMode="decimal" value={display} onChange={handleChange} placeholder={placeholder||""} style={IS}/>;
}

const EMPTY: any = {
  titre_projet:"", description:"", date_debut:"",
  pole_id:"", region_id:"", departement_id:"", arrondissement_id:"",
  secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
  est_intervalle: false,
  investissement:"", investissement_min:"", investissement_max:"", devise_id:"",
  porteurs: [] as any[],
  points_focaux: [] as any[],
};

function ProjetModal({ open, onClose, edit, onSaved }: { open:boolean; onClose:()=>void; edit:any; onSaved:()=>void }) {
  const [form,     setForm]    = useState<any>({...EMPTY});
  const [fichiers, setFichiers]= useState<any[]>([]);
  const [pdfQueue, setPdfQueue]= useState<{file:File; titre:string}[]>([]);
  const [poles,         setPoles]         = useState<any[]>([]);
  const [devises,       setDevises]       = useState<any[]>([]);
  const [poleRegionIds, setPoleRegionIds] = useState<number[]>([]);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState("");
  const [ok,       setOk]      = useState(false);

  const upd = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));
  const updList = (key:string, idx:number, val:any) =>
    setForm((f:any)=>({...f,[key]:f[key].map((x:any,i:number)=>i===idx?val:x)}));
  const remItem = (key:string, idx:number) =>
    setForm((f:any)=>({...f,[key]:f[key].filter((_:any,i:number)=>i!==idx)}));
  const addItem = (key:string, blank:any) =>
    setForm((f:any)=>({...f,[key]:[...f[key],blank]}));

  useEffect(()=>{
    fetch(`${API}/zones-types/poles`).then(r=>r.json()).then(setPoles).catch(()=>{});
    fetch(`${API}/projets/devises`).then(r=>r.json()).then(setDevises).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!open) return;
    if (edit) {
      const isIntervalle = !!edit.investissement_est_intervalle;
      setForm({
        titre_projet:      edit.titre_projet||"",
        description:       edit.description||"",
        date_debut:        edit.date_debut||"",
        pole_id:           edit.pole_id||"",
        region_id:         edit.region_id||"",
        departement_id:    edit.departement_id||"",
        arrondissement_id: edit.arrondissement_id||"",
        secteur_ids:       edit.secteur_ids||[],
        branche_ids:       edit.branche_ids||[],
        activite_ids:      edit.activite_ids||[],
        est_intervalle:    isIntervalle,
        investissement:    !isIntervalle ? (edit.investissement!=null?String(edit.investissement):"") : "",
        investissement_min: isIntervalle ? (edit.investissement_min!=null?String(edit.investissement_min):"") : "",
        investissement_max: isIntervalle ? (edit.investissement_max!=null?String(edit.investissement_max):"") : "",
        devise_id:         edit.devise_id||"",
        porteurs:          (edit.porteurs||[]).map((p:any)=>({...p, telephones:(p.telephones||[]).length?(p.telephones):[""], mails:(p.mails||[]).length?(p.mails):[""]})),
        points_focaux:     (edit.points_focaux||[]).map((pf:any)=>({
          ...pf,
          telephones: pf.telephones?.length ? pf.telephones : [""],
          mails:      pf.mails?.length ? pf.mails : [""],
        })),
      });
      setFichiers(edit.fichiers||[]);
      if (edit.pole_id) {
        const pole = poles.find((p:any)=>p.id===edit.pole_id);
        setPoleRegionIds(pole?.region_ids||[]);
      } else { setPoleRegionIds([]); }
    } else { setForm({...EMPTY}); setFichiers([]); setPoleRegionIds([]); }
    setPdfQueue([]); setError(""); setOk(false);
  },[open, edit]);

  const handleSave = async () => {
    if (!form.titre_projet.trim()) { setError("L'intitulé est obligatoire"); return; }
    if (form.est_intervalle && form.investissement_min && form.investissement_max) {
      if (parseFloat(form.investissement_max) <= parseFloat(form.investissement_min)) {
        setError("Le montant maximum doit être supérieur au montant minimum"); return;
      }
    }
    for (let i=0; i<form.porteurs.length; i++) {
      const p = form.porteurs[i];
      for (const m of (p.mails||[])) { if (m && !validMail(m)) { setError(`Porteur ${i+1} — ${ERR_MAIL}`); return; } }
    }
    for (let i=0; i<form.points_focaux.length; i++) {
      const pf = form.points_focaux[i];
      for (const m of (pf.mails||[])) { if (m && !validMail(m)) { setError(`Point focal ${i+1} — ${ERR_MAIL}`); return; } }
    }
    setSaving(true); setError("");
    try {
      const payload = {
        titre_projet:        form.titre_projet,
        description:         form.description||null,
        date_debut:          form.date_debut||null,
        pole_id:             form.pole_id||null,
        region_id:           form.region_id||null,
        departement_id:      form.departement_id||null,
        arrondissement_id:   form.arrondissement_id||null,
        secteur_ids:         form.secteur_ids||[],
        branche_ids:         form.branche_ids||[],
        activite_ids:        form.activite_ids||[],
        investissement_est_intervalle: form.est_intervalle,
        investissement:      !form.est_intervalle && form.investissement ? form.investissement.replace(/\.$/,"") : null,
        investissement_min:  form.est_intervalle && form.investissement_min ? form.investissement_min.replace(/\.$/,"") : null,
        investissement_max:  form.est_intervalle && form.investissement_max ? form.investissement_max.replace(/\.$/,"") : null,
        devise_id:           form.devise_id||null,
        porteurs:            form.porteurs.map((p:any,i:number)=>({
          nom:        p.nom||null,
          telephones: (p.telephones||[]).filter((t:string)=>t.trim()),
          mails:      (p.mails||[]).filter((m:string)=>m.trim()),
          ordre:      i,
        })),
        points_focaux:       form.points_focaux.map((pf:any,i:number)=>({
          ...pf, ordre:i,
          telephones: (pf.telephones||[]).filter((t:string)=>t.trim()),
          mails:      (pf.mails||[]).filter((m:string)=>m.trim()),
        })),
      };
      const url    = edit ? `${API}/projets/${edit.id}` : `${API}/projets`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const saved = await res.json();
      const projetId = saved.id || edit?.id;
      for (const p of pdfQueue) {
        const fd = new FormData();
        fd.append("fichier", p.file); fd.append("titre", p.titre||p.file.name);
        await fetch(`${API}/projets/${projetId}/fichiers`, { method:"POST", body:fd });
      }
      setOk(true);
      setTimeout(()=>{ setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <FModal open={open} onClose={onClose} maxWidth={820}
      title={edit ? "Modifier le projet" : "Nouveau projet"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || ok} loading={saving} success={ok}>
          {ok ? "Enregistré !" : saving ? "Enregistrement…" : edit ? "Modifier" : "Créer le projet"}
        </FButton>
      </>}>

      {/* Informations générales */}
      <FSection title="Informations générales">
        <div style={{ marginBottom:12 }}>
          <FLabel>Intitulé du projet *</FLabel>
          <FInput value={form.titre_projet} onChange={e=>upd("titre_projet",e.target.value)} placeholder="Intitulé du projet" style={{ fontSize:14, fontWeight:600 }}/>
        </div>
        <div style={{ marginBottom:12 }}>
          <FLabel>Description</FLabel>
          <RichTextEditor value={form.description} onChange={v=>upd("description",v)}/>
        </div>
        <div style={{ maxWidth:220 }}>
          <FLabel>Date de début</FLabel>
          <FInput type="date" value={form.date_debut} onChange={e=>upd("date_debut",e.target.value)}/>
        </div>
      </FSection>

      {/* Investissement */}
      <FSection title="Investissement"
        extra={<FToggle checked={form.est_intervalle} onChange={()=>upd("est_intervalle",!form.est_intervalle)} label="Montant sous forme d'intervalle" />}>
        {!form.est_intervalle ? (
          <FGrid cols="2fr 1fr" gap={10}>
            <div><FLabel>Montant</FLabel><MoneyInput value={form.investissement} onChange={v=>upd("investissement",v)} placeholder="Ex : 5 000 000"/></div>
            <div><FLabel>Devise</FLabel>
              <FSelect value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")}>
                <option value="">—</option>
                {devises.map((d:any)=><option key={d.id} value={d.id}>{devSymbole(d.code,d.symbole)}</option>)}
              </FSelect>
            </div>
          </FGrid>
        ) : (
          <FGrid cols={3} gap={10}>
            <div><FLabel>Montant minimum</FLabel><MoneyInput value={form.investissement_min} onChange={v=>upd("investissement_min",v)} placeholder="Ex : 1 000 000"/></div>
            <div><FLabel>Montant maximum</FLabel><MoneyInput value={form.investissement_max} onChange={v=>upd("investissement_max",v)} placeholder="Ex : 5 000 000"/></div>
            <div><FLabel>Devise</FLabel>
              <FSelect value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")}>
                <option value="">—</option>
                {devises.map((d:any)=><option key={d.id} value={d.id}>{devSymbole(d.code,d.symbole)}</option>)}
              </FSelect>
            </div>
          </FGrid>
        )}
      </FSection>

      {/* Zone d'implantation */}
      <FSection title="Zone d'implantation">
        <div style={{ marginBottom:12, maxWidth:340 }}>
          <FLabel>Pôle territoire</FLabel>
          <FSelect value={form.pole_id||""} onChange={e=>{
            const pId = e.target.value ? parseInt(e.target.value) : "";
            upd("pole_id",pId); upd("region_id",""); upd("departement_id",""); upd("arrondissement_id","");
            if (pId) { const pole=poles.find((p:any)=>p.id===pId); setPoleRegionIds(pole?.region_ids||[]); }
            else setPoleRegionIds([]);
          }}>
            <option value="">— Sélectionner —</option>
            {poles.map((p:any)=><option key={p.id} value={p.id}>{p.pole_territoire}</option>)}
          </FSelect>
        </div>
        {/* Localisation grisée tant qu'aucun pôle n'est choisi (comme gestion-zones) */}
        <div style={{ opacity: !form.pole_id ? 0.45 : 1, pointerEvents: !form.pole_id ? "none" : "auto", transition: "opacity 0.2s" }}>
          <GeoCascadeSelect
            regionId={form.region_id || null}
            departementId={form.departement_id || null}
            arrondissementId={form.arrondissement_id || null}
            filterRegionIds={poleRegionIds.length>0?poleRegionIds:undefined}
            onChangeRegion={id=>{ upd("region_id",id||""); upd("departement_id",""); upd("arrondissement_id",""); }}
            onChangeDepartement={id=>{ upd("departement_id",id||""); upd("arrondissement_id",""); }}
            onChangeArrondissement={id=>upd("arrondissement_id",id||"")}
          />
        </div>
      </FSection>

      {/* Thématiques */}
      <FSection title="Thématiques">
        <NaemaSelect
          secteurIds={form.secteur_ids||[]} brancheIds={form.branche_ids||[]} activiteIds={form.activite_ids||[]}
          onChangeSecteurs={ids=>upd("secteur_ids",ids)} onChangeBranches={ids=>upd("branche_ids",ids)} onChangeActivites={ids=>upd("activite_ids",ids)}/>
      </FSection>

      {/* Porteur du projet */}
      <FSection title="Porteur du projet">
        {form.porteurs.map((porteur:any,i:number)=>(
          <PorteurRow key={i} p={porteur} idx={i} onChange={v=>updList("porteurs",i,v)} onRemove={()=>remItem("porteurs",i)}/>
        ))}
        <AddBtn label="Ajouter un porteur de projet" onClick={()=>addItem("porteurs",{nom:"",telephones:[""],mails:[""]})}
          ok={form.porteurs.every((p:any)=>isContactComplete(p,["nom"])) && contactsPartages(form.porteurs).length===0}
          titre="Complétez d'abord le porteur précédent (nom / organisation, téléphone et email valides)"/>
      </FSection>

      {/* Points focaux */}
      <FSection title="Points focaux">
        {form.points_focaux.map((pf:any,i:number)=>(
          <PointFocalRow key={i} pf={pf} idx={i} onChange={v=>updList("points_focaux",i,v)} onRemove={()=>remItem("points_focaux",i)}/>
        ))}
        <AddBtn label="Ajouter un point focal" onClick={()=>addItem("points_focaux",{civilite:"",nom:"",prenom:"",telephones:[""],mails:[""]})}
          ok={form.points_focaux.every((pf:any)=>isContactComplete(pf,["civilite","nom","prenom"])) && contactsPartages(form.points_focaux).length===0}
          titre="Complétez d'abord le point focal précédent (civilité, nom, prénom, téléphone et email valides)"/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
            {fichiers.map((f:any)=>(
              <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#004f91", flexShrink:0 }}/>
                <a href={`${API}/projets/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:13, flex:1, color:"#1a1a2e", fontWeight:500, textDecoration:"none" }}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{
                  if (edit?.id) await fetch(`${API}/projets/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                  setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                }} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{ color:"#dc2626" }}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"} onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Upload size={14} color="#9aa5b4"/>
          <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
            const files = Array.from(e.target.files||[]);
            setPdfQueue(prev=>[...prev, ...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"") }))]);
            e.target.value="";
          }}/>
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginTop:8 }}>
            {pdfQueue.map((p,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(106,27,154,0.05)", border:"1px solid rgba(106,27,154,0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#6A1B9A", flexShrink:0 }}/>
                <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                  placeholder="Titre du document" style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(106,27,154,0.3)", outline:"none", fontSize:12.5, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                  <X size={13} style={{ color:"#dc2626" }}/>
                </button>
              </div>
            ))}
            <p style={{ fontSize:11, color:"#9aa5b4" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
          </div>
        )}
      </FSection>

      {error && <FError>{error}</FError>}
    </FModal>
  );
}

// ── Modal vue détail ──────────────────────────────────────────────────────────
function ProjetVueModal({ projet: p, secteurs, branches, activites, onClose, onEdit }: {
  projet:any; secteurs:any[]; branches:any[]; activites:any[]; onClose:()=>void; onEdit:(p:any)=>void;
}) {
  const fmtInvest = () => {
    const sym = devSymbole(p.devise_code, p.devise_symbole);
    if (!p.investissement_est_intervalle) return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
    if (!p.investissement_min) return null;
    const min = Number(p.investissement_min).toLocaleString("fr-FR");
    const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
    return `${min} — ${max} ${sym}`;
  };
  const invest = fmtInvest();
  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{p.titre_projet}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {p.pole_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p.pole_nom}</span>}
              {p.region_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",padding:"3px 10px",borderRadius:999}}>Région de {p.region_nom}</span>}
              {p.departement_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.08)",padding:"3px 10px",borderRadius:999}}>Département de {p.departement_nom}</span>}
              {p.arrondissement_nom && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#6A1B9A",background:"rgba(106,27,154,0.07)",padding:"3px 10px",borderRadius:999}}>Arrondissement de {p.arrondissement_nom}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"#F5F4F3",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
            onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div style={{padding:"22px 28px",overflowY:"auto" as const,flex:1,display:"flex",flexDirection:"column" as const,gap:22}}>

          {/* Investissement / Date */}
          {(invest||p.date_debut)&&(
            <section>
              <SecTitle>Informations</SecTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {invest && <Bloc label="Investissement"><p style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{invest}</p></Bloc>}
                {p.date_debut && <Bloc label="Date de début"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_debut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p></Bloc>}
              </div>
            </section>
          )}

          {/* Description */}
          {p.description && (
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:p.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Thématiques */}
          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <section>
              <SecTitle>Thématiques du projet</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && (p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                                </div>
                                {actsDeBra.length > 0 && (
                                  <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                    {actsDeBra.map((act:any) => (
                                      <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                        <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                        <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
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
            </section>
          )}

          {/* Porteur */}
          {p.porteurs?.length>0 && (
            <section>
              <SecTitle>{p.porteurs.length>1?"Porteurs du projet":"Porteur du projet"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.porteurs.map((por:any,pi:number)=>{
                  const tels=(por.telephones||[]).filter(Boolean);
                  const mails=(por.mails||[]).filter(Boolean);
                  return (
                    <div key={pi} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px"}}>
                      {por.nom && <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{por.nom}</p>}
                      {(tels.length>0||mails.length>0)&&(
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                          {tels.map((t:string,ti:number)=>(
                            <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t)}</span>
                          ))}
                          {mails.map((m:string,mi:number)=>(
                            <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Points focaux */}
          {p.points_focaux?.length>0 && (
            <section>
              <SecTitle>Points focaux</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {p.points_focaux.map((pf:any,fi:number)=>{
                  const tels=(pf.telephones||[]).filter(Boolean);
                  const mails=(pf.mails||[]).filter(Boolean);
                  return (
                    <div key={fi} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px"}}>
                      <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</p>
                      {(tels.length>0||mails.length>0)&&(
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                          {tels.map((t:string,ti:number)=>(
                            <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t)}</span>
                          ))}
                          {mails.map((m:string,mi:number)=>(
                            <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Documents */}
          {p.fichiers?.length>0&&(
            <section>
              <SecTitle>{p.fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {p.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/projets/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{f.titre||f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:"10px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
          <button onClick={()=>{onClose();onEdit(p);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgba(0,79,145,0.25)"}}>
            <Pencil size={13}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant exporté ─────────────────────────────────────────────────────────
export default function BanqueProjets({ registerOpenNew }: { registerOpenNew?: (fn: () => void) => void }) {
  const [projets,    setProjets]    = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [edit,       setEdit]       = useState<any>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [deleting,   setDeleting]   = useState<string|null>(null);
  const [togglingId, setTogglingId] = useState<string|null>(null);
  const [secteurs,   setSecteurs]   = useState<any[]>([]);
  const [branches,   setBranches]   = useState<any[]>([]);
  const [activites,  setActivites]  = useState<any[]>([]);

  useEffect(()=>{
    const safe=(p:Promise<any>)=>p.catch(()=>[]);
    Promise.all([
      safe(fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/branches`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/activites`).then(r=>r.json())),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); });
  },[]);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page:"50", admin:"true" });
      const res  = await fetch(`${API}/projets?${params}`);
      const data = await res.json();
      setProjets(data.data||[]); setTotal(data.total||0);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  useEffect(()=>{
    registerOpenNew?.(() => { setEdit(null); setModal(true); });
  },[registerOpenNew]);

  const handleTogglePublie = async(p:any)=>{
    setTogglingId(p.id);
    try {
      await fetch(`${API}/projets/${p.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({est_publie:!p.est_publie}) });
      charger();
    } finally { setTogglingId(null); }
  };

  const handleDelete = async(id:string)=>{
    if (!confirm("Supprimer ce projet ?")) return;
    setDeleting(id);
    await fetch(`${API}/projets/${id}`,{method:"DELETE"});
    setDeleting(null); charger();
  };

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }}/>
        </div>
      ) : projets.length===0 ? (
        <div style={{ textAlign:"center" as const, padding:"80px 0", color:"#9aa5b4" }}>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun projet</p>
          <p style={{ fontSize:13 }}>Créez votre premier projet d'investissement</p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:14 }}>
          {projets.map(p=>{
            return (
            <div key={p.id} onClick={()=>setVue(p)}
              style={{ background:"#fff", border:"1px solid #ECEAE7", borderRadius:14, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)", display:"flex", flexDirection:"column" as const, overflow:"hidden" }}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

              <div style={{ height:3, background:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", flexShrink:0 }}/>
              <div style={{ padding:"14px 16px 14px", flex:1 }}>
                {/* Pôle territoire */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  {p.pole_nom ? (
                    <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"3px 10px", borderRadius:999 }}>{p.pole_nom}</span>
                  ) : <span/>}
                </div>

                {/* Titre */}
                <div style={{ fontWeight:700, fontSize:13.5, color:"#1a1a2e", lineHeight:1.35, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{p.titre_projet}</div>

                {/* Infos libellées */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                  <div style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, marginBottom:3 }}>Région</p>
                    <p style={{ fontSize:12, fontWeight:600, color:p.region_nom?"#1a1a2e":"#9aa5b4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.region_nom||"—"}</p>
                  </div>
                  <div style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, marginBottom:3 }}>Département</p>
                    <p style={{ fontSize:12, fontWeight:600, color:p.departement_nom?"#1a1a2e":"#9aa5b4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.departement_nom||"—"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", alignItems:"stretch", borderTop:"1px solid #F2F0EF" }} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>{ setEdit(p); setModal(true); }}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:"#004f91", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  <Pencil size={12}/> Modifier
                </button>
                <div style={{ width:1, background:"#F2F0EF" }}/>
                <button onClick={()=>handleTogglePublie(p)} disabled={togglingId===p.id}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:"10px 0", fontSize:11.5, color:p.est_publie?"#188038":"#6b7280", fontWeight:600, fontFamily:"var(--font-google-sans)", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background=p.est_publie?"rgba(24,128,56,0.05)":"rgba(156,163,175,0.07)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  {togglingId===p.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:p.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <div style={{ width:1, background:"#F2F0EF" }}/>
                <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                  style={{ width:46, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", transition:"background 0.15s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  {deleting===p.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
      <ProjetModal open={modal} onClose={()=>{ setModal(false); setEdit(null); }} edit={edit} onSaved={charger}/>
      {vue&&<ProjetVueModal projet={vue} secteurs={secteurs} branches={branches} activites={activites} onClose={()=>setVue(null)} onEdit={p=>{ setVue(null); setEdit(p); setModal(true); }}/>}
    </div>
  );
}
