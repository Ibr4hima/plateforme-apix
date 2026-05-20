"use client";

import { ArrondissementSelect, DepartementSelect, RegionSelect } from "@/components/shared/GeoSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import { Check, Eye, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

// ── Select Zone d'investissement ──────────────────────────────────────────────
function ZoneInvSelect({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const [type,    setType]    = useState(value ? value.slice(0,3) : "");
  const [zones,   setZones]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const LABELS: Record<string,string> = { ZES:"Zones Économiques Spéciales", ZAI:"Zones Aménagées à l'Investissement", ZFI:"Zones Franches Industrielles" };

  useEffect(() => { if (value && !type) setType(value.slice(0,3)); }, [value]);
  useEffect(() => {
    if (!type) { setZones([]); return; }
    setLoading(true);
    fetch(`${API}/zones-types?type_zone=${type}`).then(r=>r.json()).then(setZones).catch(()=>{}).finally(()=>setLoading(false));
  }, [type]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div>
        <label style={{...LS, fontSize:11, color:"#9aa5b4"}}>Type de zone</label>
        <select value={type} onChange={e=>{ setType(e.target.value); onChange(""); }} style={IS}>
          <option value="">— Choisir un type —</option>
          {Object.entries(LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {type && (
        <div>
          <label style={{...LS, fontSize:11, color:"#9aa5b4"}}>Zone spécifique</label>
          {loading ? <p style={{fontSize:12,color:"#9aa5b4"}}>Chargement…</p>
            : <select value={value||""} onChange={e=>onChange(e.target.value)} style={IS}>
                <option value="">— Sélectionner —</option>
                {zones.map((z:any)=><option key={z.id} value={z.id}>{z.nom_zone}</option>)}
              </select>}
        </div>
      )}
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
const validTel  = (v: string) => !v || /^\+\d{12}$/.test(v.trim());
const validMail = (v: string) => !v || /^[^@.][^@]*@[^@]+\.[^@]+[^@.]$/.test(v.trim());

const ERR_TEL  = "Format : +221701234567 (+ suivi de 12 chiffres)";
const ERR_MAIL = "Email invalide";

function FieldErr({ msg }: { msg: string }) {
  return <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>{msg}</p>;
}


function MoaRow({ m, idx, onChange, onRemove }: { m:any; idx:number; onChange:(v:any)=>void; onRemove:()=>void }) {
  const upd = (k:string, v:string) => onChange({...m, [k]:v});
  return (
    <div style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Maître d'ouvrage {idx+1}</span>
        <button onClick={onRemove} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
          <X size={12} style={{ color:"#dc2626" }} />
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div><label style={LS}>Nom / Organisation</label><input value={m.nom||""} onChange={e=>upd("nom",e.target.value)} placeholder="Ex : Ministère des Finances" style={IS} /></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div>
            <label style={LS}>Téléphone</label>
            <input value={m.telephone||""} onChange={e=>upd("telephone",e.target.value)} placeholder="+221701234567" style={{...IS, borderColor: m.telephone && !validTel(m.telephone) ? "#dc2626" : "#C5BFBB"}} />
            {m.telephone && !validTel(m.telephone) && <FieldErr msg={ERR_TEL} />}
          </div>
          <div>
            <label style={LS}>Mail</label>
            <input type="text" value={m.mail||""} onChange={e=>upd("mail",e.target.value)} placeholder="contact@domaine.sn" style={{...IS, borderColor: m.mail && !validMail(m.mail) ? "#dc2626" : "#C5BFBB"}} />
            {m.mail && !validMail(m.mail) && <FieldErr msg={ERR_MAIL} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ligne Coordinateur ────────────────────────────────────────────────────────
function CoordRow({ c, idx, onChange, onRemove }: { c:any; idx:number; onChange:(v:any)=>void; onRemove:()=>void }) {
  const upd = (k:string, v:string) => onChange({...c, [k]:v});
  return (
    <div style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#ca631f" }}>Coordinateur — {idx+1}</span>
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
          <label style={LS}>Téléphone</label>
          <input value={c.telephone||""} onChange={e=>upd("telephone",e.target.value)} placeholder="+221701234567" style={{...IS, borderColor: c.telephone && !validTel(c.telephone) ? "#dc2626" : "#C5BFBB"}} />
          {c.telephone && !validTel(c.telephone) && <FieldErr msg={ERR_TEL} />}
        </div>
        <div>
          <label style={LS}>Mail</label>
          <input type="text" value={c.mail||""} onChange={e=>upd("mail",e.target.value)} placeholder="contact@domaine.sn" style={{...IS, borderColor: c.mail && !validMail(c.mail) ? "#dc2626" : "#C5BFBB"}} />
          {c.mail && !validMail(c.mail) && <FieldErr msg={ERR_MAIL} />}
        </div>
      </div>
    </div>
  );
}

// ── Bouton ajout inline ───────────────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
const EMPTY: any = {
  titre_projet:"", description:"",
  region_id:"", departement_id:"", arrondissement_id:"", zone_investissement:"", pole_id:"",
  thematiques:"",
  est_intervalle: false,
  investissement:"", investissement_min:"", investissement_max:"", devise_id:"",
  porteur_projet:"",
  moa_nom:"", moa_telephone:"", moa_mail:"", show_moa:false,
  coordinateurs:[],
};

function ProjetModal({ open, onClose, edit, onSaved }: { open:boolean; onClose:()=>void; edit:any; onSaved:()=>void }) {
  const [form,     setForm]    = useState<any>({...EMPTY});
  const [fichiers, setFichiers]= useState<any[]>([]);
  const [pdfQueue, setPdfQueue]= useState<{file:File; titre:string}[]>([]);
  const [poles,    setPoles]   = useState<any[]>([]);
  const [devises,  setDevises] = useState<any[]>([]);
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

  // Dépendre de edit?.id et non de l'objet edit pour éviter les re-renders infinis
  useEffect(() => {
    if (!open) return;
    if (edit) {
      const parts: string[] = [];
      (edit.secteur_noms||[]).forEach((n:string)=>parts.push(`sec:${n}`));
      (edit.branche_noms||[]).forEach((n:string)=>parts.push(`bra:${n}`));
      (edit.activite_noms||[]).forEach((n:string)=>parts.push(`act:${n}`));
      const moa = (edit.moa_list||[])[0] || {};
      const isIntervalle = !!edit.investissement_est_intervalle;
      setForm({
        titre_projet: edit.titre_projet||"", description: edit.description||"",
        region_id: edit.region_id||"", departement_id: edit.departement_id||"",
        arrondissement_id: edit.arrondissement_id||"",
        zone_investissement: edit.zone_investissement||"",
        pole_id: edit.pole_id||"",
        thematiques: parts.join(", "),
        est_intervalle: isIntervalle,
        investissement:     !isIntervalle ? (edit.investissement!=null ? String(edit.investissement) : "") : "",
        investissement_min: isIntervalle  ? (edit.investissement_min!=null ? String(edit.investissement_min) : "") : "",
        investissement_max: isIntervalle  ? (edit.investissement_max!=null ? String(edit.investissement_max) : "") : "",
        devise_id: edit.devise_id||"",
        porteur_projet: edit.porteur_projet||"",
        moa_nom:       moa.nom||"",
        moa_telephone: moa.telephone||"",
        moa_mail:      moa.mail||"",
        show_moa:      !!(moa.nom||moa.telephone||moa.mail),
        coordinateurs: (edit.coordinateurs||[]).map((c:any)=>({...c})),
      });
      setFichiers(edit.fichiers||[]);
    } else { setForm({...EMPTY}); setFichiers([]); }
    setPdfQueue([]); setError(""); setOk(false);
  }, [open, edit?.id]);

  const handleSave = async () => {
    if (!form.titre_projet.trim()) { setError("L'intitulé est obligatoire"); return; }
    if (form.est_intervalle && form.investissement_min && form.investissement_max) {
      if (parseFloat(form.investissement_max) <= parseFloat(form.investissement_min)) {
        setError("Le montant maximum doit être strictement supérieur au montant minimum"); return;
      }
    }
    // Validation téléphone/mail — MOA
    if (form.moa_telephone && !validTel(form.moa_telephone))  { setError(`MOA — ${ERR_TEL}`);  return; }
    if (form.moa_mail      && !validMail(form.moa_mail))      { setError(`MOA — ${ERR_MAIL}`); return; }
    // Coordinateurs
    for (let i = 0; i < form.coordinateurs.length; i++) {
      const c = form.coordinateurs[i];
      if (c.telephone && !validTel(c.telephone))  { setError(`Coordinateur ${i+1} — ${ERR_TEL}`);  return; }
      if (c.mail      && !validMail(c.mail))       { setError(`Coordinateur ${i+1} — ${ERR_MAIL}`); return; }
    }
    setSaving(true); setError("");
    try {
      const items = (form.thematiques||"").split(",").map((t:string)=>t.trim());
      const secNoms = items.filter((t:string)=>t.startsWith("sec:")).map((t:string)=>t.slice(4));
      const braNoms = items.filter((t:string)=>t.startsWith("bra:")).map((t:string)=>t.slice(4));
      const actNoms = items.filter((t:string)=>t.startsWith("act:")).map((t:string)=>t.slice(4));
      const [allSec,allBra,allAct] = await Promise.all([
        fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json()),
        fetch(`${API}/entreprises/ref/branches`).then(r=>r.json()),
        fetch(`${API}/entreprises/ref/activites`).then(r=>r.json()),
      ]);
      const payload = {
        titre_projet: form.titre_projet,
        description:  form.description||null,
        region_id:    form.region_id||null,
        departement_id:    form.departement_id||null,
        arrondissement_id: form.arrondissement_id||null,
        zone_investissement: form.zone_investissement||null,
        pole_id:      form.pole_id||null,
        secteur_ids:  allSec.filter((s:any)=>secNoms.includes(s.nom)).map((s:any)=>s.id),
        branche_ids:  allBra.filter((b:any)=>braNoms.includes(b.nom)).map((b:any)=>b.id),
        activite_ids: allAct.filter((a:any)=>actNoms.includes(a.nom)).map((a:any)=>a.id),
        investissement_est_intervalle: form.est_intervalle,
        investissement:     !form.est_intervalle && form.investissement ? form.investissement : null,
        investissement_min: form.est_intervalle  && form.investissement_min ? form.investissement_min : null,
        investissement_max: form.est_intervalle  && form.investissement_max ? form.investissement_max : null,
        devise_id:    form.devise_id||null,
        porteur_projet: form.porteur_projet||null,
        // MOA singulier — stocké comme liste à 1 élément max
        moa_list: (form.moa_nom||form.moa_telephone||form.moa_mail)
          ? [{ nom: form.moa_nom||null, telephone: form.moa_telephone||null, mail: form.moa_mail||null }]
          : [],
        coordinateurs:form.coordinateurs.map((c:any,i:number)=>({...c,ordre:i})),
      };
      const url    = edit ? `${API}/projets/${edit.id}` : `${API}/projets`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const saved = await res.json();
      const projetId = saved.id || edit?.id;
      // Uploader les PDFs en attente
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

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1a1a2e" }}>{edit?"Modifier le projet":"Nouveau projet"}</h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568" /></button>
          </div>

          {/* Intitulé + Description */}
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
            {/* Toggle intervalle */}
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
                  <input type="number" min="0" step="0.01" value={form.investissement} onChange={e=>upd("investissement",e.target.value)} placeholder="Ex : 5 000 000" style={IS} />
                </div>
                <div><label style={LS}>Devise</label>
                  <select value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                    <option value="">—</option>
                    {devises.map((d:any)=><option key={d.id} value={d.id}>{d.code === 'XOF' ? 'FCFA' : d.code}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                <div><label style={LS}>Montant minimum</label>
                  <input type="number" min="0" step="0.01" value={form.investissement_min} onChange={e=>upd("investissement_min",e.target.value)} placeholder="Ex : 1 000 000" style={IS} />
                </div>
                <div><label style={LS}>Montant maximum</label>
                  <input type="number" min="0" step="0.01" value={form.investissement_max} onChange={e=>upd("investissement_max",e.target.value)} placeholder="Ex : 5 000 000" style={IS} />
                </div>
                <div><label style={LS}>Devise</label>
                  <select value={form.devise_id||""} onChange={e=>upd("devise_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                    <option value="">—</option>
                    {devises.map((d:any)=><option key={d.id} value={d.id}>{d.code === 'XOF' ? 'FCFA' : d.code}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Zone d'implantation */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Zone d'implantation</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={LS}>Région</label>
                <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); upd("arrondissement_id",""); }} />
              </div>
              <div><label style={LS}>Département</label>
                <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>{ upd("departement_id",v); upd("arrondissement_id",""); }} />
              </div>
              <div><label style={LS}>Arrondissement</label>
                <ArrondissementSelect departementId={form.departement_id} value={form.arrondissement_id} onChange={v=>upd("arrondissement_id",v)} />
              </div>
              <div><label style={LS}>Pôle territoire</label>
                <select value={form.pole_id||""} onChange={e=>upd("pole_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                  <option value="">— Sélectionner —</option>
                  {poles.map((p:any)=><option key={p.id} value={p.id}>{p.pole_territoire}</option>)}
                </select>
              </div>
            </div>
            <div><label style={LS}>Zone d'investissement</label>
              <ZoneInvSelect value={form.zone_investissement} onChange={v=>upd("zone_investissement",v)} />
            </div>
          </div>

          {/* Thématiques */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Thématiques</p>
            <ThematiquesNaema value={form.thematiques} onChange={v=>upd("thematiques",v)} />
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
            {(form.moa_nom || form.moa_telephone || form.moa_mail || form.show_moa) ? (
              <div style={{ background:"#fff", border:"1px solid #E8E5E3", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Maître d'ouvrage</span>
                  <button onClick={()=>{ upd("moa_nom",""); upd("moa_telephone",""); upd("moa_mail",""); upd("show_moa",false); }}
                    style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:6, padding:"4px 7px" }}>
                    <X size={12} style={{ color:"#dc2626" }} />
                  </button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div><label style={LS}>Nom / Organisation</label>
                    <input value={form.moa_nom} onChange={e=>upd("moa_nom",e.target.value)} placeholder="Ex : Ministère des Finances" style={IS} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div><label style={LS}>Téléphone</label>
                      <input value={form.moa_telephone} onChange={e=>upd("moa_telephone",e.target.value)} placeholder="+221…" style={IS} />
                    </div>
                    <div><label style={LS}>Mail</label>
                      <input type="email" value={form.moa_mail} onChange={e=>upd("moa_mail",e.target.value)} placeholder="contact@…" style={IS} />
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
            <AddBtn label="Ajouter un coordinateur" onClick={()=>addItem("coordinateurs",{civilite:"",nom:"",prenom:"",telephone:"",mail:""})} />
          </div>

          {/* Documents PDF — seulement en mode édition */}
          {/* Documents PDF */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Documents PDF</p>
            {/* Fichiers existants */}
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
            {/* PDFs en attente d'upload */}
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
            {/* Bouton ajout */}
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
            {!edit && <p style={{ fontSize:11, color:"#9aa5b4", marginTop:6 }}>💡 Créez d'abord le projet, puis ajoutez les documents.</p>}
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

// ── Modal vue projet ──────────────────────────────────────────────────────────
function ProjetVueModal({ projet: p, onClose, onEdit }: { projet:any; onClose:()=>void; onEdit:(p:any)=>void }) {
  const fmtInvest = () => {
    if (!p.investissement_est_intervalle) {
      return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${p.devise_code==="XOF"?"FCFA":p.devise_code||""}` : null;
    }
    if (!p.investissement_min) return null;
    const min = Number(p.investissement_min).toLocaleString("fr-FR");
    const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
    const dev = p.devise_code==="XOF"?"FCFA":p.devise_code||"";
    return `${min} — ${max} ${dev}`;
  };
  const invest = fmtInvest();

  return (
    <div onClick={e=>{ if (e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:680, maxHeight:"90vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#d97706,#f59e0b)", borderRadius:"20px 20px 0 0" }} />
        <div style={{ padding:"24px 28px 28px" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"rgba(217,119,6,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:18, fontWeight:800, color:"#d97706" }}>P</span>
              </div>
              <div>
                <h2 style={{ fontWeight:800, fontSize:"1.15rem", color:"#1a1a2e", lineHeight:1.3 }}>{p.titre_projet}</h2>
                {p.created_at && <p style={{ fontSize:11, color:"#9aa5b4" }}>Créé le {new Date(p.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>}
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>onEdit(p)} style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(202,99,31,0.1)", border:"none", cursor:"pointer", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, color:"#ca631f" }}>
                <Pencil size={12} /> Modifier
              </button>
              <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:8 }}><X size={14} color="#4a5568" /></button>
            </div>
          </div>

          {/* Description */}
          {p.description && (
            <div style={{ background:"#F8F7F6", borderRadius:12, padding:"12px 16px", marginBottom:18 }}>
              <p style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}>{p.description}</p>
            </div>
          )}

          {/* Zone */}
          {(p.pole_nom || p.zone_nom || p.region_nom) && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Zone d'implantation</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {p.region_nom && <span style={{ fontSize:12, color:"#4a5568", background:"#F2F0EF", padding:"3px 10px", borderRadius:999 }}>📍 {p.region_nom}{p.departement_nom?` › ${p.departement_nom}`:""}</span>}
                {p.pole_nom   && <span style={{ fontSize:12, color:"#7c3aed", background:"rgba(124,58,237,0.08)", padding:"3px 10px", borderRadius:999 }}>{p.pole_nom}</span>}
                {(p.zone_nom||p.zone_investissement) && <span style={{ fontSize:12, color:"#0e7490", background:"rgba(14,116,144,0.08)", padding:"3px 10px", borderRadius:999 }}>{p.zone_nom||p.zone_investissement}</span>}
              </div>
            </div>
          )}

          {/* Thématiques */}
          {(p.secteur_noms?.length>0) && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Thématiques</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(p.secteur_noms||[]).map((s:string)=><span key={s} style={{ fontSize:12, color:"#ca631f", background:"rgba(202,99,31,0.08)", padding:"3px 10px", borderRadius:999 }}>{s}</span>)}
                {(p.branche_noms||[]).map((b:string)=><span key={b} style={{ fontSize:12, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"3px 10px", borderRadius:999 }}>{b}</span>)}
                {(p.activite_noms||[]).map((a:string)=><span key={a} style={{ fontSize:12, color:"#059669", background:"rgba(5,150,105,0.08)", padding:"3px 10px", borderRadius:999 }}>{a}</span>)}
              </div>
            </div>
          )}

          {/* Investissement */}
          {invest && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:6 }}>Investissement</p>
              <p style={{ fontSize:15, fontWeight:700, color:"#1a1a2e" }}>💰 {invest}</p>
            </div>
          )}

          {/* Porteur */}
          {p.porteur_projet && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:6 }}>Porteur du projet</p>
              <p style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>🏢 {p.porteur_projet}</p>
            </div>
          )}

          {/* MOA */}
          {p.moa_list?.length>0 && p.moa_list[0].nom && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Maître d'ouvrage</p>
              <div style={{ background:"#F8F7F6", borderRadius:10, padding:"10px 14px" }}>
                <p style={{ fontWeight:600, fontSize:13, color:"#1a1a2e" }}>{p.moa_list[0].nom}</p>
                {p.moa_list[0].telephone && <p style={{ fontSize:12, color:"#9aa5b4" }}>📞 {p.moa_list[0].telephone}</p>}
                {p.moa_list[0].mail      && <p style={{ fontSize:12, color:"#9aa5b4" }}>✉️ {p.moa_list[0].mail}</p>}
              </div>
            </div>
          )}

          {/* Coordinateurs */}
          {p.coordinateurs?.length>0 && (
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Coordinateurs</p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {p.coordinateurs.map((c:any)=>(
                  <div key={c.id} style={{ background:"#F8F7F6", borderRadius:10, padding:"10px 14px", display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(202,99,31,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <User size={13} style={{ color:"#ca631f" }} />
                    </div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:13, color:"#1a1a2e" }}>{[c.civilite,c.prenom,c.nom].filter(Boolean).join(" ")}</p>
                      <p style={{ fontSize:11, color:"#9aa5b4" }}>{[c.telephone,c.mail].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fichiers */}
          {p.fichiers?.length>0 && (
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:8 }}>Documents</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {p.fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/projets/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(202,99,31,0.06)", border:"1px solid rgba(202,99,31,0.18)", borderRadius:7, padding:"4px 10px", fontSize:11, color:"#ca631f", textDecoration:"none", fontWeight:500 }}>
                    <FileText size={11} /> {f.titre||f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ProjetsPage() {
  const [projets,  setProjets]  = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState("");
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [edit,     setEdit]     = useState<any>(null);
  const [vue,      setVue]      = useState<any>(null);
  const [deleting, setDeleting] = useState<string|null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:String(page), per_page:"20" });
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
    <div style={{ padding:"36px 40px 80px", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:4 }}>Administration</p>
          <h1 style={{ fontWeight:800, fontSize:"1.75rem", color:"#1a1a2e" }}>Projets</h1>
          <p style={{ color:"#9aa5b4", fontSize:13, marginTop:4 }}>{total} projet{total>1?"s":""}</p>
        </div>
        <button onClick={()=>{ setEdit(null); setModal(true); }}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 20px", borderRadius:12, border:"none", background:"#B7410E", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
          <Plus size={15} /> Nouveau projet
        </button>
      </div>

      <div style={{ position:"relative", marginBottom:24, maxWidth:400 }}>
        <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
        <input value={q} onChange={e=>{ setQ(e.target.value); setPage(1); }} placeholder="Rechercher un projet…" style={{...IS, paddingLeft:36}} />
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
          <Loader2 size={28} style={{ color:"#9aa5b4", animation:"spin 1s linear infinite" }} />
        </div>
      ) : projets.length===0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", color:"#9aa5b4" }}>
          <p style={{ fontSize:16, fontWeight:600 }}>Aucun projet</p>
          <p style={{ fontSize:13 }}>Créez votre premier projet</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {projets.map(p=>(
            <div key={p.id} style={{ background:"#fff", border:"1px solid #C5BFBB", borderLeft:"4px solid #d97706", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"rgba(217,119,6,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:800, color:"#d97706" }}>P</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14, color:"#1a1a2e", marginBottom:3 }}>{p.titre_projet}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {p.pole_nom && <span style={{ fontSize:11, color:"#7c3aed", background:"rgba(124,58,237,0.08)", padding:"2px 8px", borderRadius:999 }}>{p.pole_nom}</span>}
                  {p.zone_nom
                    ? <span style={{ fontSize:11, color:"#0e7490", background:"rgba(14,116,144,0.08)", padding:"2px 8px", borderRadius:999 }}>{p.zone_nom}</span>
                    : p.zone_investissement && <span style={{ fontSize:11, color:"#0e7490", background:"rgba(14,116,144,0.08)", padding:"2px 8px", borderRadius:999 }}>{p.zone_investissement}</span>
                  }
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button onClick={()=>setVue(p)} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"7px 9px" }} title="Voir le projet">
                  <Eye size={13} style={{ color:"#004f91" }} />
                </button>
                <button onClick={()=>{ setEdit(p); setModal(true); }} style={{ background:"rgba(202,99,31,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"7px 9px" }}>
                  <Pencil size={13} style={{ color:"#ca631f" }} />
                </button>
                <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"7px 9px" }}>
                  {deleting===p.id ? <Loader2 size={13} style={{ color:"#dc2626", animation:"spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color:"#dc2626" }} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjetModal open={modal} onClose={()=>setModal(false)} edit={edit} onSaved={charger} />
      {vue && <ProjetVueModal projet={vue} onClose={()=>setVue(null)} onEdit={p=>{ setVue(null); setEdit(p); setModal(true); }} />}
    </div>
  );
}
