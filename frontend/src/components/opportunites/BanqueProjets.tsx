"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Search, User, Eye, EyeOff, FileText, Upload } from "lucide-react";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import PhoneInput from "@/components/shared/PhoneInput";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

// ── Validation ────────────────────────────────────────────────────────────────
const validMail = (v: string) => !v || /^[^@.][^@]*@[^@]+\.[^@]+[^@.]$/.test(v.trim());
const ERR_MAIL = "Email invalide (doit contenir @ et .)";
function FieldErr({ msg }: { msg: string }) {
  return <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>{msg}</p>;
}

function CoordRow({ c, idx, onChange, onRemove }: { c:any; idx:number; onChange:(v:any)=>void; onRemove:()=>void }) {
  const upd = (k:string, v:string) => onChange({...c, [k]:v});
  return (
    <div style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#ca631f" }}>Coordinateur {idx+1}</span>
        <button onClick={onRemove} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
          <X size={12} style={{ color:"#dc2626" }} />
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"100px 1fr 1fr", gap:8, marginBottom:8 }}>
        <div>
          <label style={LS}>Civilité</label>
          <select value={c.civilite||""} onChange={e=>upd("civilite",e.target.value)} style={IS}>
            <option value="">—</option><option>Monsieur</option><option>Madame</option>
          </select>
        </div>
        <div><label style={LS}>Nom</label><input value={c.nom||""} onChange={e=>upd("nom",e.target.value)} placeholder="Nom" style={IS} /></div>
        <div><label style={LS}>Prénom</label><input value={c.prenom||""} onChange={e=>upd("prenom",e.target.value)} placeholder="Prénom" style={IS} /></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Téléphone(s)</label>
            <button onClick={()=>upd("telephones",[...(c.telephones||[""]),  ""])}
              style={{ fontSize:10, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:5, padding:"2px 7px", cursor:"pointer" }}>
              + Ajouter
            </button>
          </div>
          {(c.telephones||[""]).map((tel:string, ti:number)=>(
            <div key={ti} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <PhoneInput value={tel} onChange={v=>{ const arr=[...(c.telephones||[""])]; arr[ti]=v; upd("telephones",arr); }} />
              </div>
              {(c.telephones||[""]).length>1 && (
                <button onClick={()=>upd("telephones",(c.telephones||[""]).filter((_:any,i:number)=>i!==ti))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px", marginTop:1 }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
            </div>
          ))}
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
            <label style={LS}>Mail(s)</label>
            <button onClick={()=>upd("mails",[...(c.mails||[""]), ""])}
              style={{ fontSize:10, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:5, padding:"2px 7px", cursor:"pointer" }}>
              + Ajouter
            </button>
          </div>
          {(c.mails||[""]).map((mail:string, mi:number)=>(
            <div key={mi} style={{ display:"flex", gap:5, marginBottom:6 }}>
              <input type="text" value={mail} onChange={e=>{ const arr=[...(c.mails||[""])]; arr[mi]=e.target.value; upd("mails",arr); }}
                placeholder="contact@domaine.sn" style={{...IS, borderColor: mail && !validMail(mail) ? "#dc2626" : "#C5BFBB"}} />
              {(c.mails||[""]).length>1 && (
                <button onClick={()=>upd("mails",(c.mails||[""]).filter((_:any,i:number)=>i!==mi))}
                  style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px" }}>
                  <X size={11} style={{ color:"#dc2626" }}/>
                </button>
              )}
              {mail && !validMail(mail) && <FieldErr msg={ERR_MAIL} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddBtn({ label, onClick }: { label:string; onClick:()=>void }) {
  return (
    <button onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"9px 14px", borderRadius:9, border:"2px dashed #C5BFBB", background:"transparent", color:"#9aa5b4", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor="#ca631f"; e.currentTarget.style.color="#ca631f"; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor="#C5BFBB"; e.currentTarget.style.color="#9aa5b4"; }}>
      <Plus size={13} /> {label}
    </button>
  );
}

// ── Symboles devise ───────────────────────────────────────────────────────────
const DEVISE_SYMBOLE: Record<string,string> = { XOF:"FCFA", USD:"$", EUR:"€", GBP:"£", CNY:"¥", CAD:"CA$", CHF:"CHF", JPY:"¥" };
const devSymbole = (code?:string, symbole?:string) => symbole || (code ? DEVISE_SYMBOLE[code]||code : "");

// ── Modal création/édition ────────────────────────────────────────────────────
const EMPTY: any = {
  titre_projet:"", description:"",
  pole_id:"", region_id:"", departement_id:"", arrondissement_id:"",
  secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
  est_intervalle: false,
  investissement:"", investissement_min:"", investissement_max:"", devise_id:"",
  porteur_projet:"",
  date_attribution:"", date_fin_prevue:"",
  moa_nom:"", moa_telephones:[""] as string[], moa_mails:[""] as string[], show_moa:false,
  coordinateurs:[],
};

// ── Composant saisie montant avec séparateur de milliers ─────────────────────
function MoneyInput({ value, onChange, placeholder }: { value:string; onChange:(v:string)=>void; placeholder?:string }) {
  const [display, setDisplay] = useState(() => value ? Number(value).toLocaleString("fr-FR") : "");

  useEffect(()=>{
    // Sync depuis l'extérieur (chargement edit) sans écraser la saisie en cours
    const raw = display.replace(/\s/g,"").replace(/[^\d]/g,"");
    if (raw !== String(value||"")) {
      setDisplay(value ? Number(value).toLocaleString("fr-FR") : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g,"").replace(/[^\d]/g,"");
    setDisplay(raw ? Number(raw).toLocaleString("fr-FR") : "");
    onChange(raw);
  };

  const IS2: any = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };

  return (
    <input type="text" inputMode="numeric" value={display} onChange={handleChange}
      placeholder={placeholder||""} style={IS2} />
  );
}

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

  const upd = (k:string, v:any) => setForm((f:any) => ({...f, [k]:v}));
  const updList = (key:string, idx:number, val:any) =>
    setForm((f:any) => ({...f, [key]: f[key].map((x:any,i:number)=>i===idx?val:x)}));
  const remItem = (key:string, idx:number) =>
    setForm((f:any) => ({...f, [key]: f[key].filter((_:any,i:number)=>i!==idx)}));
  const addItem = (key:string, blank:any) =>
    setForm((f:any) => ({...f, [key]: [...f[key], blank]}));

  useEffect(() => {
    fetch(`${API}/zones-types/poles`).then(r=>r.json()).then(setPoles).catch(()=>{});
    fetch(`${API}/projets/devises`).then(r=>r.json()).then(setDevises).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      const moa = (edit.moa_list||[])[0] || {};
      const isIntervalle = !!edit.investissement_est_intervalle;
      setForm({
        titre_projet: edit.titre_projet||"", description: edit.description||"",
        pole_id: edit.pole_id||"",
        region_id: edit.region_id||"", departement_id: edit.departement_id||"",
        arrondissement_id: edit.arrondissement_id||"",
        secteur_ids: edit.secteur_ids||[],
        branche_ids: edit.branche_ids||[],
        activite_ids: edit.activite_ids||[],
        est_intervalle: isIntervalle,
        investissement:     !isIntervalle ? (edit.investissement!=null ? String(edit.investissement) : "") : "",
        investissement_min: isIntervalle  ? (edit.investissement_min!=null ? String(edit.investissement_min) : "") : "",
        investissement_max: isIntervalle  ? (edit.investissement_max!=null ? String(edit.investissement_max) : "") : "",
        devise_id: edit.devise_id||"",
        porteur_projet: edit.porteur_projet||"",
        date_attribution: edit.date_attribution||"",
        date_fin_prevue:  edit.date_fin_prevue||"",
        moa_nom:        moa.nom||"",
        moa_telephones: moa.telephones?.length ? moa.telephones : (moa.telephone ? [moa.telephone] : [""]),
        moa_mails:      moa.mails?.length ? moa.mails : (moa.mail ? [moa.mail] : [""]),
        show_moa:       !!(moa.nom||moa.telephone||moa.telephones?.length),
        coordinateurs: (edit.coordinateurs||[]).map((c:any)=>({
          ...c,
          telephones: c.telephones?.length ? c.telephones : (c.telephone ? [c.telephone] : [""]),
          mails:      c.mails?.length ? c.mails : (c.mail ? [c.mail] : [""]),
        })),
      });
      setFichiers(edit.fichiers||[]);
      // Restaurer les region_ids filtrés pour le pôle sélectionné
      if (edit.pole_id) {
        const pole = poles.find((p:any)=>p.id===edit.pole_id);
        setPoleRegionIds(pole?.region_ids||[]);
      } else {
        setPoleRegionIds([]);
      }
    } else { setForm({...EMPTY}); setFichiers([]); setPoleRegionIds([]); }
    setPdfQueue([]); setError(""); setOk(false);
  }, [open, edit]);

  const handleSave = async () => {
    if (!form.titre_projet.trim()) { setError("L'intitulé est obligatoire"); return; }
    if (form.est_intervalle && form.investissement_min && form.investissement_max) {
      if (parseFloat(form.investissement_max) <= parseFloat(form.investissement_min)) {
        setError("Le montant maximum doit être strictement supérieur au montant minimum"); return;
      }
    }
    for (const m of (form.moa_mails||[])) { if (m && !validMail(m)) { setError(`MOA — ${ERR_MAIL}`); return; } }
    for (let i = 0; i < form.coordinateurs.length; i++) {
      const c = form.coordinateurs[i];
      for (const m of (c.mails||[])) { if (m && !validMail(m)) { setError(`Coordinateur ${i+1} — ${ERR_MAIL}`); return; } }
    }
    const today = new Date().toISOString().split("T")[0];
    if (form.date_attribution && form.date_attribution > today) {
      setError("La date d'attribution ne peut pas être dans le futur"); return;
    }
    if (form.date_attribution && form.date_fin_prevue) {
      if (form.date_fin_prevue <= form.date_attribution) {
        setError("La date de fin prévue doit être strictement supérieure à la date d'attribution"); return;
      }
    }
    setSaving(true); setError("");
    try {
      const payload = {
        titre_projet: form.titre_projet,
        description:  form.description||null,
        pole_id:      form.pole_id||null,
        region_id:    form.region_id||null,
        departement_id:    form.departement_id||null,
        arrondissement_id: form.arrondissement_id||null,
        secteur_ids:  form.secteur_ids||[],
        branche_ids:  form.branche_ids||[],
        activite_ids: form.activite_ids||[],
        investissement_est_intervalle: form.est_intervalle,
        investissement:     !form.est_intervalle && form.investissement ? form.investissement : null,
        investissement_min: form.est_intervalle  && form.investissement_min ? form.investissement_min : null,
        investissement_max: form.est_intervalle  && form.investissement_max ? form.investissement_max : null,
        devise_id:    form.devise_id||null,
        porteur_projet: form.porteur_projet||null,
        date_attribution: form.date_attribution||null,
        date_fin_prevue:  form.date_fin_prevue||null,
        moa_list: (form.moa_nom||form.moa_telephones?.filter(Boolean).length||form.moa_mails?.filter(Boolean).length)
          ? [{ nom: form.moa_nom||null, telephones: form.moa_telephones?.filter(Boolean)||[], mails: form.moa_mails?.filter(Boolean)||[] }]
          : [],
        coordinateurs: form.coordinateurs.map((c:any,i:number)=>({...c,ordre:i})),
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

  if (!open) return null;
  return (
    <div onClick={e=>{ if (e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:820, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 32px 32px" }}>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1a1a2e" }}>{edit?"Modifier le projet":"Nouveau projet"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568" /></button>
          </div>

          {/* Informations générales */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Informations générales</p>
            <div style={{ marginBottom:10 }}>
              <label style={LS}>Intitulé du projet *</label>
              <input value={form.titre_projet} onChange={e=>upd("titre_projet",e.target.value)} placeholder="Intitulé du projet" style={{...IS,fontSize:14,fontWeight:600}} />
            </div>
            <div>
              <label style={LS}>Description</label>
              <textarea value={form.description} onChange={e=>upd("description",e.target.value)} rows={3} placeholder="Description du projet…" style={{...IS, resize:"vertical"}} />
            </div>
          </div>

          {/* Investissement */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Investissement</p>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <button onClick={()=>upd("est_intervalle",!form.est_intervalle)}
                style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color: form.est_intervalle?"#ca631f":"#9aa5b4", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${form.est_intervalle?"#ca631f":"#C5BFBB"}`, background:form.est_intervalle?"#ca631f":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {form.est_intervalle && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                Montant sous forme d'intervalle
              </button>
            </div>
            {!form.est_intervalle ? (
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
                <div><label style={LS}>Montant</label>
                  <MoneyInput value={form.investissement} onChange={v=>upd("investissement",v)} placeholder="Ex : 5 000 000" />
                </div>
                <div><label style={LS}>Devise</label>
                  <select value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                    <option value="">—</option>
                    {devises.map((d:any)=><option key={d.id} value={d.id}>{devSymbole(d.code, d.symbole)}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                <div><label style={LS}>Montant minimum</label>
                  <MoneyInput value={form.investissement_min} onChange={v=>upd("investissement_min",v)} placeholder="Ex : 1 000 000" />
                </div>
                <div><label style={LS}>Montant maximum</label>
                  <MoneyInput value={form.investissement_max} onChange={v=>upd("investissement_max",v)} placeholder="Ex : 5 000 000" />
                </div>
                <div><label style={LS}>Devise</label>
                  <select value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                    <option value="">—</option>
                    {devises.map((d:any)=><option key={d.id} value={d.id}>{devSymbole(d.code, d.symbole)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Zone d'implantation — Pôle en premier */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Zone d'implantation</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={LS}>Pôle territoire</label>
                <select value={form.pole_id||""} onChange={e=>{
                    const pId = e.target.value ? parseInt(e.target.value) : "";
                    upd("pole_id", pId);
                    upd("region_id",""); upd("departement_id",""); upd("arrondissement_id","");
                    if (pId) {
                      const pole = poles.find((p:any)=>p.id===pId);
                      setPoleRegionIds(pole?.region_ids || []);
                    } else {
                      setPoleRegionIds([]);
                    }
                  }} style={IS}>
                  <option value="">— Sélectionner —</option>
                  {poles.map((p:any)=><option key={p.id} value={p.id}>{p.pole_territoire}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Région</label>
                <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); upd("arrondissement_id",""); }} filterIds={poleRegionIds.length>0 ? poleRegionIds : undefined} />
              </div>
              <div>
                <label style={LS}>Département</label>
                <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>{ upd("departement_id",v); upd("arrondissement_id",""); }} />
              </div>
              <div>
                <label style={LS}>Arrondissement</label>
                <ArrondissementSelect departementId={form.departement_id} value={form.arrondissement_id} onChange={v=>upd("arrondissement_id",v)} />
              </div>
            </div>
          </div>

          {/* Thématiques */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Thématiques</p>
            <NaemaSelect
              secteurIds={form.secteur_ids||[]}
              brancheIds={form.branche_ids||[]}
              activiteIds={form.activite_ids||[]}
              onChangeSecteurs={ids=>upd("secteur_ids",ids)}
              onChangeBranches={ids=>upd("branche_ids",ids)}
              onChangeActivites={ids=>upd("activite_ids",ids)}
            />
          </div>

          {/* Suivi */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Suivi du projet</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={LS}>Date d'attribution</label>
                <input type="date" value={form.date_attribution}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e=>upd("date_attribution",e.target.value)} style={IS} />
                <p style={{ fontSize:11, color:"#9aa5b4", marginTop:4 }}>Ne peut pas être dans le futur</p>
              </div>
              <div>
                <label style={LS}>Date de fin prévue</label>
                <input type="date" value={form.date_fin_prevue} onChange={e=>upd("date_fin_prevue",e.target.value)}
                  min={form.date_attribution || undefined} style={{...IS, borderColor: form.date_fin_prevue && form.date_attribution && form.date_fin_prevue <= form.date_attribution ? "#dc2626" : "#C5BFBB"}} />
                {form.date_fin_prevue && form.date_attribution && form.date_fin_prevue <= form.date_attribution && (
                  <p style={{ fontSize:11, color:"#dc2626", marginTop:4 }}>Doit être strictement après la date d'attribution</p>
                )}
              </div>
            </div>
          </div>

          {/* Porteur du projet */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Porteur du projet</p>
            {form.porteur_projet !== "" ? (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input value={form.porteur_projet} onChange={e=>upd("porteur_projet",e.target.value)} placeholder="Ex : Institut Pasteur de Dakar" style={{...IS, flex:1}} />
                <button onClick={()=>upd("porteur_projet","")} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"9px 10px" }}>
                  <X size={13} style={{ color:"#dc2626" }} />
                </button>
              </div>
            ) : (
              <AddBtn label="Ajouter un porteur de projet" onClick={()=>upd("porteur_projet"," ")} />
            )}
          </div>

          {/* Maître d'ouvrage */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Maître d'ouvrage</p>
            {(form.moa_nom || form.moa_telephones?.some(Boolean) || form.moa_mails?.some(Boolean) || form.show_moa) ? (
              <div style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Maître d'ouvrage</span>
                  <button onClick={()=>{ upd("moa_nom",""); upd("moa_telephones",[""]); upd("moa_mails",[""]); upd("show_moa",false); }}
                    style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
                    <X size={12} style={{ color:"#dc2626" }} />
                  </button>
                </div>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                  <div><label style={LS}>Nom / Organisation</label>
                    <input value={form.moa_nom} onChange={e=>upd("moa_nom",e.target.value)} placeholder="Ex : Ministère des Finances" style={IS} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <label style={LS}>Téléphone(s)</label>
                        <button onClick={()=>upd("moa_telephones",[...(form.moa_telephones||[""]), ""])}
                          style={{ fontSize:10, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:5, padding:"2px 7px", cursor:"pointer" }}>
                          + Ajouter
                        </button>
                      </div>
                      {(form.moa_telephones||[""]).map((tel:string, ti:number)=>(
                        <div key={ti} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:6 }}>
                          <div style={{ flex:1 }}>
                            <PhoneInput value={tel} onChange={v=>{ const arr=[...(form.moa_telephones||[""])]; arr[ti]=v; upd("moa_telephones",arr); }} />
                          </div>
                          {(form.moa_telephones||[""]).length>1 && (
                            <button onClick={()=>upd("moa_telephones",(form.moa_telephones||[""]).filter((_:any,i:number)=>i!==ti))}
                              style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px", marginTop:1 }}>
                              <X size={11} style={{ color:"#dc2626" }}/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <label style={LS}>Mail(s)</label>
                        <button onClick={()=>upd("moa_mails",[...(form.moa_mails||[""]), ""])}
                          style={{ fontSize:10, fontWeight:600, color:"#ca631f", background:"rgba(202,99,31,0.08)", border:"none", borderRadius:5, padding:"2px 7px", cursor:"pointer" }}>
                          + Ajouter
                        </button>
                      </div>
                      {(form.moa_mails||[""]).map((mail:string, mi:number)=>(
                        <div key={mi} style={{ display:"flex", gap:5, marginBottom:6 }}>
                          <input type="text" value={mail} onChange={e=>{ const arr=[...(form.moa_mails||[""])]; arr[mi]=e.target.value; upd("moa_mails",arr); }}
                            placeholder="contact@…" style={{...IS, borderColor: mail && !validMail(mail) ? "#dc2626" : "#C5BFBB"}} />
                          {(form.moa_mails||[""]).length>1 && (
                            <button onClick={()=>upd("moa_mails",(form.moa_mails||[""]).filter((_:any,i:number)=>i!==mi))}
                              style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:6, padding:"9px 7px" }}>
                              <X size={11} style={{ color:"#dc2626" }}/>
                            </button>
                          )}
                          {mail && !validMail(mail) && <FieldErr msg={ERR_MAIL} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <AddBtn label="Ajouter un maître d'ouvrage" onClick={()=>upd("show_moa",true)} />
            )}
          </div>

          {/* Coordinateurs */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Coordinateurs</p>
            {form.coordinateurs.map((c:any, i:number)=>(
              <CoordRow key={i} c={c} idx={i} onChange={v=>updList("coordinateurs",i,v)} onRemove={()=>remItem("coordinateurs",i)} />
            ))}
            <AddBtn label="Ajouter un coordinateur" onClick={()=>addItem("coordinateurs",{civilite:"",nom:"",prenom:"",telephones:[""],mails:[""]})} />
          </div>

          {/* Documents PDF */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Documents PDF</p>
            {fichiers.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                {fichiers.map((f:any)=>(
                  <div key={f.id} style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                    <a href={`${API}/projets/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(202,99,31,0.06)", border:"1px solid rgba(202,99,31,0.18)", borderRadius:7, padding:"4px 10px", fontSize:11, color:"#ca631f", textDecoration:"none", fontWeight:500 }}>
                      <FileText size={11} /> {f.titre||f.fichier_nom}
                    </a>
                    <button onClick={async()=>{
                      if (edit?.id) await fetch(`${API}/projets/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                      setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                    }} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:5, padding:"3px 5px", display:"flex", alignItems:"center" }}>
                      <X size={10} style={{ color:"#dc2626" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pdfQueue.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
                {pdfQueue.map((p, i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(124,58,237,0.05)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:8, padding:"7px 12px" }}>
                    <FileText size={13} style={{ color:"#7c3aed", flexShrink:0 }} />
                    <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                      placeholder="Titre du document" style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(124,58,237,0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }} />
                    <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <X size={13} style={{ color:"#dc2626" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:8, cursor:"pointer", border:"2px dashed #C5BFBB", background:"#F2F0EF" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#ca631f"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#C5BFBB"}>
              <Upload size={14} color="#9aa5b4" />
              <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
                const files = Array.from(e.target.files||[]);
                setPdfQueue(prev=>[...prev, ...files.map(f=>({file:f, titre:f.name.replace(/\.pdf$/i,"")}))]);
                e.target.value="";
              }} />
            </label>
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:ok?"#059669":"#ca631f", color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}} />Enregistrement…</>
               :ok?<><Check size={14} />Enregistré!</>
               :<><Check size={14} />{edit?"Modifier":"Créer le projet"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal vue détail ──────────────────────────────────────────────────────────
function ProjetVueModal({ projet: p, secteurs, branches, activites, onClose, onEdit }: { projet:any; secteurs:any[]; branches:any[]; activites:any[]; onClose:()=>void; onEdit:(p:any)=>void }) {
  const fmtInvest = () => {
    const sym = devSymbole(p.devise_code, p.devise_symbole);
    if (!p.investissement_est_intervalle)
      return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
    if (!p.investissement_min) return null;
    const min = Number(p.investissement_min).toLocaleString("fr-FR");
    const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
    return `${min} — ${max} ${sym}`;
  };
  const invest = fmtInvest();
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{p.titre_projet}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {p.pole_nom   && <span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{p.pole_nom}</span>}
                {p.region_nom && <span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>Région de {p.region_nom}</span>}
                {p.departement_nom && <span style={{fontSize:11,fontWeight:700,color:"#0891b2",background:"rgba(8,145,178,0.08)",border:"1px solid rgba(8,145,178,0.2)",padding:"2px 9px",borderRadius:999}}>Département de {p.departement_nom}</span>}
                {p.arrondissement_nom && <span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",padding:"2px 9px",borderRadius:999}}>Arrondissement de {p.arrondissement_nom}</span>}
                <span style={{fontSize:11,fontWeight:700,color:p.est_publie?"#15803d":"#9aa5b4",background:p.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{p.est_publie?"Public":"Non publié"}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {p.description && (
            <div style={{background:"rgba(227,83,54,0.04)",border:"1px solid rgba(227,83,54,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
              <p style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}>{p.description}</p>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {invest && (
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Investissement</LBL>
                <p style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>{invest}</p>
              </div>
            )}
            {p.porteur_projet && (
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Porteur du projet</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.porteur_projet}</p>
              </div>
            )}
            {p.date_attribution && (
              <div style={{background:"rgba(5,150,105,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date d'attribution</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_attribution+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            )}
            {p.date_fin_prevue && (
              <div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date de fin prévue</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_fin_prevue+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            )}

          </div>

          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <div style={{marginBottom:16}}>
              <LBL>Thématiques NAEMA</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(p.secteur_ids||[]).map((secId:number) => {
                  const sec = secteurs.find((s:any) => s.id === secId);
                  if (!sec) return null;
                  const brasDuSec = branches.filter((b:any) => b.secteur_id === secId && (p.branche_ids||[]).includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra.nom}</span>
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
            </div>
          )}

          {p.moa_list?.length>0 && p.moa_list[0].nom && (
            <div style={{marginBottom:16}}>
              <LBL>Maître d'ouvrage</LBL>
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <p style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:8}}>{p.moa_list[0].nom}</p>
                {(p.moa_list[0].telephones||[]).filter(Boolean).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:5}}>
                    {(p.moa_list[0].telephones||[]).filter(Boolean).map((t:string,i:number)=>(
                      <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.15)",padding:"2px 9px",borderRadius:999}}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012.86 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 8.6a16 16 0 006.29 6.29l1.01-1.01a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {(p.moa_list[0].mails||[]).filter(Boolean).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                    {(p.moa_list[0].mails||[]).filter(Boolean).map((m:string,i:number)=>(
                      <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,color:"#ca631f",background:"rgba(202,99,31,0.07)",border:"1px solid rgba(202,99,31,0.15)",padding:"2px 9px",borderRadius:999}}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {p.coordinateurs?.length>0 && (
            <div style={{marginBottom:16}}>
              <LBL>Coordinateurs</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {p.coordinateurs.map((c:any)=>(
                  <div key={c.id} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(54,111,227,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <User size={13} style={{color:"#366FE3"}}/>
                    </div>
                    <div>
                      <p style={{fontWeight:600,fontSize:13,color:"#1a1a2e"}}>{[c.civilite,c.prenom,c.nom].filter(Boolean).join(" ")}</p>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:4,marginTop:4}}>
                        {(c.telephones||[]).filter(Boolean).length>0&&(
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                            {(c.telephones||[]).filter(Boolean).map((t:string,i:number)=>(
                              <span key={i} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.15)",padding:"2px 8px",borderRadius:999}}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012.86 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 8.6a16 16 0 006.29 6.29l1.01-1.01a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {(c.mails||[]).filter(Boolean).length>0&&(
                          <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                            {(c.mails||[]).filter(Boolean).map((m:string,i:number)=>(
                              <span key={i} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:"#ca631f",background:"rgba(202,99,31,0.07)",border:"1px solid rgba(202,99,31,0.15)",padding:"2px 8px",borderRadius:999}}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.fichiers?.length>0 && (
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {p.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/projets/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(227,83,54,0.06)",border:"1px solid rgba(227,83,54,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#E35336",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(p);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#366FE3",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
              <Pencil size={13}/> Modifier
            </button>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Composant exporté — s'intègre dans l'onglet Banque de projets ─────────────
export default function BanqueProjets() {
  const [projets,  setProjets]  = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState("");
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [edit,     setEdit]     = useState<any>(null);
  const [vue,      setVue]      = useState<any>(null);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [togglingId, setTogglingId] = useState<string|null>(null);
  const [secteurs,   setSecteurs]   = useState<any[]>([]);
  const [branches,   setBranches]   = useState<any[]>([]);
  const [activites,  setActivites]  = useState<any[]>([]);

  useEffect(() => {
    const safe = (p: Promise<any>) => p.catch(() => []);
    Promise.all([
      safe(fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/branches`).then(r=>r.json())),
      safe(fetch(`${API}/entreprises/ref/activites`).then(r=>r.json())),
    ]).then(([s,b,a]) => { setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); });
  }, []);

  const handleTogglePublie = async (p:any) => {
    setTogglingId(p.id);
    try {
      await fetch(`${API}/projets/${p.id}/toggle`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({est_publie:!p.est_publie}) });
      charger();
    } finally { setTogglingId(null); }
  };

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:String(page), per_page:"20", admin:"true" });
      if (q) params.set("q", q);
      const res  = await fetch(`${API}/projets?${params}`);
      const data = await res.json();
      setProjets(data.data||[]); setTotal(data.total||0);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { charger(); }, [charger]);

  const handleDelete = async (id:string) => {
    if (!confirm("Supprimer ce projet ?")) return;
    setDeleting(id);
    await fetch(`${API}/projets/${id}`, { method:"DELETE" });
    setDeleting(null); charger();
  };

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ position:"relative", maxWidth:360, flex:1 }}>
          <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
          <input value={q} onChange={e=>{ setQ(e.target.value); setPage(1); }} placeholder="Rechercher un projet…" style={{...IS, paddingLeft:36}} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, color:"#9aa5b4" }}>{total} projet{total>1?"s":""}</span>
          <button onClick={()=>{ setEdit(null); setModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 18px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#ca631f,#e07a3a)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(202,99,31,0.25)" }}>
            <Plus size={14} /> Nouveau projet
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : projets.length===0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", color:"#9aa5b4" }}>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun projet</p>
          <p style={{ fontSize:13 }}>Créez votre premier projet d'investissement</p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {projets.map(p=>(
            <div key={p.id} onClick={()=>setVue(p)}
              style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", borderLeft:`3px solid ${p.est_publie?"#ca631f":"#C5BFBB"}`, cursor:"pointer", transition:"all 0.15s" }}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)"; ev.currentTarget.style.borderColor="#e0b89a";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.borderColor="#E8E5E3"; ev.currentTarget.style.borderLeftColor=p.est_publie?"#ca631f":"#C5BFBB";}}>

              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                {p.titre_projet}
              </div>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:3, marginBottom:12, marginTop:6 }}>
                {p.pole_nom && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#ca631f", flexShrink:0 }}/>
                    <span style={{ color:"#4a5568" }}>{p.pole_nom}</span>
                  </div>
                )}
                {(p.region_nom||p.departement_nom||p.arrondissement_nom) && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#E35336", flexShrink:0 }}/>
                    <span style={{ color:"#9aa5b4" }}>{[p.arrondissement_nom,p.departement_nom,p.region_nom].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:5, borderTop:"1px solid #F2F0EF", paddingTop:10 }} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>{ setEdit(p); setModal(true); }}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:"rgba(54,111,227,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:"#366FE3", fontWeight:600 }}>
                  <Pencil size={12}/> Modifier
                </button>
                <button onClick={()=>handleTogglePublie(p)} disabled={togglingId===p.id}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, background:p.est_publie?"rgba(21,128,61,0.07)":"rgba(156,163,175,0.08)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 0", fontSize:11, color:p.est_publie?"#15803d":"#6b7280", fontWeight:600 }}>
                  {togglingId===p.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:p.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"6px 9px" }}>
                  {deleting===p.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjetModal open={modal} onClose={()=>{ setModal(false); setEdit(null); }} edit={edit} onSaved={charger} />
      {vue && <ProjetVueModal projet={vue} secteurs={secteurs} branches={branches} activites={activites} onClose={()=>setVue(null)} onEdit={p=>{ setVue(null); setEdit(p); setModal(true); }} />}
    </div>
  );
}
