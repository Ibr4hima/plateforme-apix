"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Search, Eye, EyeOff, Upload, FileText, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { FModal, FSection, FGrid, FLabel, FInput, FSelect, FSegmented, FInfo, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import RichTextEditor from "@/components/shared/RichTextEditor";
import BanqueProjets from "@/components/opportunites/BanqueProjets";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const IS: any  = { background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

const NIVEAUX = [
  { value:"pole",           label:"Pôle territoire" },
  { value:"region",         label:"Région" },
  { value:"departement",    label:"Département" },
  { value:"arrondissement", label:"Arrondissement" },
];




// ══════════════════════════════════════════════════════════════════════════════
// Modal Potentialité
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_POT: any = {
  niveau:"pole",
  pole_id:"", region_id:"", departement_id:"", arrondissement_id:"",
  secteur_ids:[], branche_ids:[], activite_ids:[],
  description: "",
  est_publie: true,
};

function PotentialiteModal({ open, onClose, edit, poles, onSaved }:
  { open:boolean; onClose:()=>void; edit:any; poles:any[]; onSaved:()=>void }) {
  const [form,     setForm]     = useState<any>({...EMPTY_POT});
  const [fichiers, setFichiers] = useState<any[]>([]);
  const [pdfQueue, setPdfQueue] = useState<{file:File; titre:string}[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [ok,       setOk]       = useState(false);
  const [usedGeo,  setUsedGeo]  = useState<any>({pole_ids:[],region_ids:[],departement_ids:[],arrondissement_ids:[]});

  const upd = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));

  useEffect(()=>{
    if (!open) return;
    if (!edit) {
      fetch(`${API}/opportunites/potentialites/used-geo`).then(r=>r.json()).then(setUsedGeo).catch(()=>{});
    }
    if (edit) {
      const niveau = edit.pole_id?"pole": edit.region_id?"region": edit.departement_id?"departement": edit.arrondissement_id?"arrondissement":"pole";
      setForm({
        niveau,
        pole_id: edit.pole_id||"", region_id: edit.region_id||"",
        departement_id: edit.departement_id||"", arrondissement_id: edit.arrondissement_id||"",
        secteur_ids: edit.secteur_ids||[], branche_ids: edit.branche_ids||[], activite_ids: edit.activite_ids||[],
        description: edit.description||"",
        est_publie: edit.est_publie ?? true,
      });
      // Fetcher la fiche complète pour avoir les fichiers à jour
      fetch(`${API}/opportunites/potentialites/${edit.id}`)
        .then(r=>r.json())
        .then(d=>setFichiers(d.fichiers||[]))
        .catch(()=>setFichiers(edit.fichiers||[]));
    } else {
      setForm({...EMPTY_POT});
      setFichiers([]);
    }
    setPdfQueue([]); setError(""); setOk(false);
  }, [open, edit]);

  // Noms géo pour titre auto
  const [geoNoms, setGeoNoms] = useState<Record<string,string>>({});

  useEffect(()=>{
    if (!form.region_id) return;
    fetch(`${API}/entreprises/ref/regions`).then(r=>r.json()).then((regions:any[])=>{
      const r = regions.find((x:any)=>x.id===parseInt(form.region_id));
      if (r) setGeoNoms(prev=>({...prev, [`r_${form.region_id}`]: r.nom}));
    }).catch(()=>{});
  }, [form.region_id]);

  useEffect(()=>{
    if (!form.departement_id) return;
    fetch(`${API}/entreprises/ref/departements?region_id=${form.region_id}`).then(r=>r.json()).then((depts:any[])=>{
      const d = depts.find((x:any)=>x.id===parseInt(form.departement_id));
      if (d) setGeoNoms(prev=>({...prev, [`d_${form.departement_id}`]: d.nom}));
    }).catch(()=>{});
  }, [form.departement_id]);

  useEffect(()=>{
    if (!form.arrondissement_id) return;
    fetch(`${API}/entreprises/ref/arrondissements?departement_id=${form.departement_id}`).then(r=>r.json()).then((arrs:any[])=>{
      const a = arrs.find((x:any)=>x.id===parseInt(form.arrondissement_id));
      if (a) setGeoNoms(prev=>({...prev, [`a_${form.arrondissement_id}`]: a.nom}));
    }).catch(()=>{});
  }, [form.arrondissement_id]);

  const titreAuto = () => {
    if (form.niveau==="pole") {
      const p = poles.find((p:any)=>String(p.id)===String(form.pole_id));
      return p ? `Potentialités du ${p.pole_territoire}` : "";
    }
    if (form.niveau==="region") {
      const nom = geoNoms[`r_${form.region_id}`];
      return nom ? `Potentialités de la région de ${nom}` : "";
    }
    if (form.niveau==="departement") {
      const nom = geoNoms[`d_${form.departement_id}`];
      return nom ? `Potentialités du département de ${nom}` : "";
    }
    if (form.niveau==="arrondissement") {
      const nom = geoNoms[`a_${form.arrondissement_id}`];
      return nom ? `Potentialités de l'arrondissement de ${nom}` : "";
    }
    return "";
  };

  const handleSave = async () => {
    const geoOk = (form.niveau==="pole" && form.pole_id) ||
                  (form.niveau==="region" && form.region_id) ||
                  (form.niveau==="departement" && form.departement_id) ||
                  (form.niveau==="arrondissement" && form.arrondissement_id);
    if (!geoOk) { setError("Veuillez sélectionner une zone géographique"); return; }
    // Vérifier doublon (seulement en création)
    if (!edit) {
      if (form.niveau==="pole" && usedGeo.pole_ids.includes(parseInt(form.pole_id))) { setError("Des potentialités existent déjà pour ce pôle. Modifiez la fiche existante."); return; }
      if (form.niveau==="region" && usedGeo.region_ids.includes(parseInt(form.region_id))) { setError("Des potentialités existent déjà pour cette région. Modifiez la fiche existante."); return; }
      if (form.niveau==="departement" && usedGeo.departement_ids.includes(parseInt(form.departement_id))) { setError("Des potentialités existent déjà pour ce département. Modifiez la fiche existante."); return; }
      if (form.niveau==="arrondissement" && usedGeo.arrondissement_ids.includes(parseInt(form.arrondissement_id))) { setError("Des potentialités existent déjà pour cet arrondissement. Modifiez la fiche existante."); return; }
    }

    setSaving(true); setError("");
    try {
      const payload: any = {
        titre: titreAuto(),
        est_publie: form.est_publie,
        secteur_ids: form.secteur_ids, branche_ids: form.branche_ids, activite_ids: form.activite_ids,
        description: form.description||null,
        pole_id: null, region_id: null, departement_id: null, arrondissement_id: null,
      };
      if (form.niveau==="pole")           payload.pole_id           = form.pole_id||null;
      if (form.niveau==="region")         payload.region_id         = form.region_id||null;
      if (form.niveau==="departement") {
        payload.region_id      = form.region_id||null;
        payload.departement_id = form.departement_id||null;
      }
      if (form.niveau==="arrondissement") {
        payload.region_id         = form.region_id||null;
        payload.departement_id    = form.departement_id||null;
        payload.arrondissement_id = form.arrondissement_id||null;
      }

      const url    = edit ? `${API}/opportunites/potentialites/${edit.id}` : `${API}/opportunites/potentialites`;
      const method = edit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const d=await res.json(); throw new Error(d.detail||"Erreur"); }
      const saved = await res.json();
      const potId = saved.id || edit?.id;

      // Upload PDFs
      for (const p of pdfQueue) {
        const fd = new FormData();
        fd.append("fichier", p.file); fd.append("titre", p.titre||p.file.name);
        await fetch(`${API}/opportunites/potentialites/${potId}/fichiers`, { method:"POST", body:fd });
      }

      setOk(true);
      setTimeout(()=>{ setOk(false); onClose(); onSaved(); }, 700);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <FModal open={open} onClose={onClose} maxWidth={800}
      title={edit ? "Modifier la fiche" : "Nouvelle fiche de potentialités"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || ok} loading={saving} success={ok}>
          {ok ? "Enregistré !" : saving ? "Enregistrement…" : edit ? "Modifier" : "Créer la fiche"}
        </FButton>
      </>}>

      {/* Zone géographique — titre fixe en mode édition, sélection en mode création */}
      {edit ? (
        <div style={{ padding:"14px 18px", background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#004f91", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:6 }}>Fiche de potentialités</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#1a1a2e" }}>{titreAuto() || edit.titre}</div>
        </div>
      ) : (
        <FSection title="Zone géographique">
          <div style={{ marginBottom:14 }}>
            <FSegmented options={NIVEAUX.map(n=>({ value:n.value, label:n.label }))}
              value={form.niveau}
              onChange={v=>{ upd("niveau",v); upd("pole_id",""); upd("region_id",""); upd("departement_id",""); upd("arrondissement_id",""); }} />
          </div>
          {form.niveau==="pole" && (
            <div>
              <FSelect value={form.pole_id||""} onChange={e=>upd("pole_id",e.target.value?parseInt(e.target.value):"")}>
                <option value="">— Sélectionner un pôle —</option>
                {poles.filter((p:any)=>!usedGeo.pole_ids.includes(p.id)).map((p:any)=><option key={p.id} value={p.id}>{p.pole_territoire}</option>)}
              </FSelect>
              {usedGeo.pole_ids.length>0 && (
                <p style={{fontSize:11,color:"#9aa5b4",marginTop:4}}>
                  {usedGeo.pole_ids.length} pôle{usedGeo.pole_ids.length>1?"s":""} déjà défini{usedGeo.pole_ids.length>1?"s":""} — modifiables depuis la liste
                </p>
              )}
            </div>
          )}
          {form.niveau==="region" && (
            <RegionSelect value={form.region_id} onChange={v=>upd("region_id",v)} />
          )}
          {form.niveau==="departement" && (
            <FGrid cols={2} gap={10}>
              <div><FLabel>Région</FLabel>
                <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); }} />
              </div>
              <div><FLabel>Département</FLabel>
                <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>upd("departement_id",v)} />
              </div>
            </FGrid>
          )}
          {form.niveau==="arrondissement" && (
            <FGrid cols={3} gap={10}>
              <div><FLabel>Région</FLabel>
                <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); upd("arrondissement_id",""); }} />
              </div>
              <div><FLabel>Département</FLabel>
                <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>{ upd("departement_id",v); upd("arrondissement_id",""); }} />
              </div>
              <div><FLabel>Arrondissement</FLabel>
                <ArrondissementSelect departementId={form.departement_id} value={form.arrondissement_id} onChange={v=>upd("arrondissement_id",v)} />
              </div>
            </FGrid>
          )}
          {(form.pole_id || form.region_id || form.departement_id || form.arrondissement_id) && (
            <div style={{ marginTop:12 }}>
              <FInfo>Titre généré : <strong>{titreAuto()}</strong></FInfo>
            </div>
          )}
        </FSection>
      )}

      {/* Activités porteuses */}
      <FSection title="Activités porteuses">
        <NaemaSelect
          secteurIds={form.secteur_ids} brancheIds={form.branche_ids} activiteIds={form.activite_ids}
          onChangeSecteurs={ids=>upd("secteur_ids",ids)}
          onChangeBranches={ids=>upd("branche_ids",ids)}
          onChangeActivites={ids=>upd("activite_ids",ids)}
        />
      </FSection>

      {/* Description */}
      <FSection title="Description">
        <RichTextEditor value={form.description} onChange={v=>upd("description",v)}/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
            {fichiers.map((f:any)=>(
              <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"#004f91", flexShrink:0 }}/>
                <a href={`${API}/opportunites/potentialites/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:13, flex:1, color:"#1a1a2e", fontWeight:500, textDecoration:"none" }}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{
                  if (edit?.id) await fetch(`${API}/opportunites/potentialites/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                  setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                }} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{color:"#dc2626"}}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed #E4E1DE", background:"#FAFAF9", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Upload size={14} color="#9aa5b4"/>
          <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
            const files = Array.from(e.target.files||[]);
            setPdfQueue(prev=>[...prev, ...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
            e.target.value="";
          }}/>
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginTop:8 }}>
            {pdfQueue.map((p,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(106,27,154,0.05)", border:"1px solid rgba(106,27,154,0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{color:"#6A1B9A",flexShrink:0}}/>
                <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                  placeholder="Titre du document" style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(106,27,154,0.3)", outline:"none", fontSize:12.5, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                  <X size={13} style={{color:"#dc2626"}}/>
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

// ══════════════════════════════════════════════════════════════════════════════
// Modal Avantage & Incitation
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_AVG: any = {
  secteur_id: null, branche_id: null, activite_id: null,
  description: "", est_publie: true,
};

function AvantageModal({ open, onClose, edit, onSaved }:
  { open:boolean; onClose:()=>void; edit:any; onSaved:()=>void }) {
  const [form,           setForm]          = useState<any>({...EMPTY_AVG});
  const [secteurs,       setSecteurs]      = useState<any[]>([]);
  const [branches,       setBranches]      = useState<any[]>([]);
  const [activites,      setActivites]     = useState<any[]>([]);
  const [usedActivites,  setUsedActivites] = useState<number[]>([]);
  const [fichiers,       setFichiers]      = useState<any[]>([]);
  const [pdfQueue,       setPdfQueue]      = useState<{file:File;titre:string}[]>([]);
  const [saving,         setSaving]        = useState(false);
  const [error,          setError]         = useState("");
  const [ok,             setOk]            = useState(false);
  const [openSec,        setOpenSec]       = useState(true);
  const [openBra,        setOpenBra]       = useState(false);
  const [openAct,        setOpenAct]       = useState(false);

  const upd = (k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));

  useEffect(()=>{
    Promise.all([
      fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!open) return;
    if (!edit){
      fetch(`${API}/opportunites/avantages/used-activites`).then(r=>r.json()).then(d=>setUsedActivites(d.activite_ids||[])).catch(()=>{});
    }
    if (edit){
      setForm({
        secteur_id: edit.secteur_id||null, branche_id: edit.branche_id||null,
        activite_id: edit.activite_id||null,
        description: edit.avantages||"",
        est_publie: edit.est_publie??true,
      });
      fetch(`${API}/opportunites/avantages/${edit.id}`)
        .then(r=>r.json()).then(d=>setFichiers(d.fichiers||[])).catch(()=>{});
    } else { setForm({...EMPTY_AVG}); setFichiers([]); setOpenSec(true); setOpenBra(false); setOpenAct(false); }
    setPdfQueue([]); setError(""); setOk(false);
  },[open, edit]);

  const handleSave = async () => {
    if (!form.activite_id && !edit){setError("Veuillez sélectionner une activité");return;}
    if (!edit && usedActivites.includes(form.activite_id)){setError("Des avantages existent déjà pour cette activité.");return;}
    setSaving(true);setError("");
    try {
      const url=edit?`${API}/opportunites/avantages/${edit.id}`:`${API}/opportunites/avantages`;
      const method=edit?"PATCH":"POST";
      const payload = {
        activite_id: form.activite_id || edit?.activite_id,
        secteur_id: form.secteur_id || edit?.secteur_id,
        branche_id: form.branche_id || edit?.branche_id,
        description: form.description,
        est_publie: form.est_publie,
      };
      const res=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok){const d=await res.json();throw new Error(Array.isArray(d.detail)?d.detail.map((e:any)=>e.msg).join(", "):(d.detail||"Erreur"));}
      const saved = await res.json();
      const avgId = saved.id || edit?.id;
      for (const p of pdfQueue) {
        const fd=new FormData(); fd.append("fichier",p.file); fd.append("titre",p.titre||p.file.name);
        await fetch(`${API}/opportunites/avantages/${avgId}/fichiers`,{method:"POST",body:fd});
      }
      setOk(true);setTimeout(()=>{setOk(false);onClose();onSaved();},700);
    } catch(e:any){setError(e.message);}
    finally{setSaving(false);}
  };

  // Cascade filtering
  const brasDispo = form.secteur_id ? branches.filter((b:any)=>b.secteur_id===form.secteur_id) : branches;
  const actsDispo = form.branche_id ? activites.filter((a:any)=>a.branche_id===form.branche_id) : activites;

  // Colonne de sélection simple (cascade Secteur → Branche → Activité)
  const AvgCol = ({ title, color, open: colOpen, onToggle, count, children }: any) => (
    <div style={{flex:1,minWidth:0}}>
      <button onClick={onToggle} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 10px",background:count>0?color+"08":"#F8F7F6",border:`1px solid ${count>0?color+"30":"#E8E5E3"}`,borderRadius:9,cursor:"pointer",marginBottom:colOpen?4:0,transition:"all 0.15s"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:count>0?color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{title}</span>
          {count>0&&<span style={{fontSize:10,fontWeight:700,color,background:color+"15",padding:"1px 6px",borderRadius:999}}>1</span>}
        </div>
        {colOpen?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {colOpen&&<div style={{border:`1px solid ${color}20`,borderRadius:9,overflow:"hidden",maxHeight:200,overflowY:"auto" as const}}>{children}</div>}
    </div>
  );
  const AvgItem = ({ label, sel, color, disabled, onClick }: any) => (
    <button onClick={onClick} disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",border:"none",cursor:disabled?"not-allowed":"pointer",background:sel?color+"12":"transparent",width:"100%",textAlign:"left" as const,transition:"background 0.12s",opacity:disabled?0.45:1}}
      onMouseEnter={e=>{if(!sel&&!disabled)e.currentTarget.style.background="#F8F7F6";}}
      onMouseLeave={e=>{e.currentTarget.style.background=sel?color+"12":"transparent";}}>
      <div style={{width:13,height:13,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,transition:"all 0.12s"}}/>
      <span style={{fontSize:12,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400}}>{label}</span>
    </button>
  );

  return (
    <FModal open={open} onClose={onClose} maxWidth={740}
      title={edit ? "Modifier l'avantage" : "Nouvel avantage / incitation"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || ok} loading={saving} success={ok}>
          {ok ? "Enregistré !" : saving ? "Enregistrement…" : edit ? "Modifier" : "Créer l'avantage"}
        </FButton>
      </>}>

      {/* Activité concernée */}
      {edit ? (
        <div style={{padding:"14px 18px",background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"#004f91",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:8}}>Activité choisie</div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
            {edit.secteur_nom&&<span style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.08)",padding:"3px 10px",borderRadius:99}}>{edit.secteur_nom}</span>}
            {edit.branche_nom&&<><span style={{fontSize:11,color:"#C5BFBB"}}>›</span><span style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",padding:"3px 10px",borderRadius:99}}>{edit.branche_nom}</span></>}
            {edit.activite_nom&&<><span style={{fontSize:11,color:"#C5BFBB"}}>›</span><span style={{fontSize:12,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",border:"1px solid rgba(24,128,56,0.25)",padding:"4px 12px",borderRadius:99}}>{edit.activite_nom}</span></>}
          </div>
        </div>
      ) : (
        <FSection title="Choisissez une activité">
          {/* Chips de résumé */}
          {(form.secteur_id||form.branche_id||form.activite_id) && (
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:10}}>
              {form.secteur_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#004f9110",color:"#004f91",border:"1px solid #004f9125",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {secteurs.find((s:any)=>s.id===form.secteur_id)?.nom||""}
                <button onClick={()=>{upd("secteur_id",null);upd("branche_id",null);upd("activite_id",null);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"#004f91"}}/></button>
              </span>}
              {form.branche_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#ca631f10",color:"#ca631f",border:"1px solid #ca631f25",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {branches.find((b:any)=>b.id===form.branche_id)?.nom||""}
                <button onClick={()=>{upd("branche_id",null);upd("activite_id",null);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"#ca631f"}}/></button>
              </span>}
              {form.activite_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#18803810",color:"#188038",border:"1px solid #18803825",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {activites.find((a:any)=>a.id===form.activite_id)?.nom||""}
                <button onClick={()=>upd("activite_id",null)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"#188038"}}/></button>
              </span>}
            </div>
          )}
          {/* Cascade 3 colonnes */}
          <div style={{display:"flex",gap:8}}>
            <AvgCol title="Secteur" color="#004f91" open={openSec} onToggle={()=>setOpenSec((o:boolean)=>!o)} count={form.secteur_id?1:0}>
              {secteurs.map((s:any)=>{
                const sel = form.secteur_id===s.id;
                return <AvgItem key={s.id} label={s.nom} sel={sel} color="#004f91"
                  onClick={()=>{ upd("secteur_id",sel?null:s.id); if(!sel){upd("branche_id",null);upd("activite_id",null);setOpenBra(true);} }}/>;
              })}
            </AvgCol>
            <AvgCol title="Branche" color="#ca631f" open={openBra} onToggle={()=>setOpenBra((o:boolean)=>!o)} count={form.branche_id?1:0}>
              {brasDispo.length===0
                ? <p style={{fontSize:11,color:"#9aa5b4",padding:"10px 12px"}}>Choisir un secteur d'abord</p>
                : brasDispo.map((b:any)=>{
                    const sel = form.branche_id===b.id;
                    return <AvgItem key={b.id} label={b.nom} sel={sel} color="#ca631f"
                      onClick={()=>{ upd("branche_id",sel?null:b.id); if(!sel){upd("activite_id",null);setOpenAct(true);} }}/>;
                  })}
            </AvgCol>
            <AvgCol title="Activité" color="#188038" open={openAct} onToggle={()=>setOpenAct((o:boolean)=>!o)} count={form.activite_id?1:0}>
              {actsDispo.length===0
                ? <p style={{fontSize:11,color:"#9aa5b4",padding:"10px 12px"}}>Choisir une branche d'abord</p>
                : actsDispo.map((a:any)=>{
                    const sel = form.activite_id===a.id;
                    const used = usedActivites.includes(a.id);
                    return <AvgItem key={a.id} label={`${a.nom}${used&&!sel?" (déjà défini)":""}`} sel={sel} color="#188038" disabled={used&&!sel}
                      onClick={()=>{ if(!used) upd("activite_id",sel?null:a.id); }}/>;
                  })}
            </AvgCol>
          </div>
        </FSection>
      )}

      {/* Description */}
      <FSection title="Description">
        <RichTextEditor value={form.description} onChange={v=>upd("description",v)}/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length>0&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:8}}>
            {fichiers.map((f:any)=>(
              <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"8px 12px"}}>
                <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                <a href={`${API}/opportunites/avantages/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:13,flex:1,color:"#1a1a2e",fontWeight:500,textDecoration:"none"}}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{
                  if(edit?.id) await fetch(`${API}/opportunites/avantages/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                  setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                }} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"#dc2626"}}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,cursor:"pointer",border:"2px dashed #E4E1DE",background:"#FAFAF9",transition:"border-color 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#004f91";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="#E4E1DE";}}>
          <Upload size={14} color="#9aa5b4"/>
          <span style={{fontSize:13,color:"#9aa5b4"}}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>{
            const files=Array.from(e.target.files||[]);
            setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
            e.target.value="";
          }}/>
        </label>
        {pdfQueue.length>0&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:8}}>
            {pdfQueue.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(106,27,154,0.05)",border:"1px solid rgba(106,27,154,0.2)",borderRadius:10,padding:"8px 12px"}}>
                <FileText size={13} style={{color:"#6A1B9A",flexShrink:0}}/>
                <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                  placeholder="Titre du document" style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(106,27,154,0.3)",outline:"none",fontSize:12.5,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
                  <X size={13} style={{color:"#dc2626"}}/>
                </button>
              </div>
            ))}
            <p style={{fontSize:11,color:"#9aa5b4"}}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
          </div>
        )}
      </FSection>

      {error && <FError>{error}</FError>}
    </FModal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TextTicker — défilement uniquement si le texte dépasse, sans rebond
// ══════════════════════════════════════════════════════════════════════════════
function TextTicker({ text, speed=25, delay=2.5 }: {text:string; speed?:number; delay?:number}) {
  const cRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  const [ov, setOv] = useState(0);

  useEffect(()=>{
    const measure = ()=>{
      const c=cRef.current; const t=tRef.current;
      if (!c||!t) return;
      setOv(Math.max(0, t.scrollWidth - c.clientWidth));
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (cRef.current) obs.observe(cRef.current);
    return ()=>obs.disconnect();
  }, [text]);

  const scrollTime = ov > 0 ? ov / speed : 0;
  const total = delay + scrollTime;
  const pausePct = ov > 0 ? (delay / total * 100).toFixed(1) : "0";
  const animName = `apix-ticker-${ov}`;

  return (
    <div ref={cRef} style={{overflow:"hidden",whiteSpace:"nowrap" as const}}>
      {ov>0 && <style>{`@keyframes ${animName}{0%,${pausePct}%{transform:translateX(0)}100%{transform:translateX(-${ov}px)}}`}</style>}
      <span ref={tRef} style={{display:"inline-block",...(ov>0?{animation:`${animName} ${total}s linear infinite`}:{})}}>{text}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant accordéon avantages groupés par secteur → branche → activité
// ══════════════════════════════════════════════════════════════════════════════

const SECTEUR_COLORS = ["#ca631f","#004f91","#059669","#0D652D","#0891b2","#d97706","#E35336","#188038"];
const secColor = (nom:string) => {
  const n = nom.toLowerCase();
  if (n.includes("primaire"))   return "#E35336";
  if (n.includes("secondaire")) return "#0F52BA";
  if (n.includes("tertiaire"))  return "#0D652D";
  return SECTEUR_COLORS[0];
};

function AvantagesGroupes({ avgs, onVue, onEdit, onToggle, onDelete, avgToggle, avgDel }:
  { avgs:any[]; onVue:(a:any)=>void; onEdit:(a:any)=>void; onToggle:(a:any)=>void; onDelete:(id:number)=>void; avgToggle:number|null; avgDel:number|null }) {

  // Grouper par secteur uniquement
  const secMap = new Map<number, {id:number; nom:string; items:any[]}>();
  avgs.forEach(a => {
    const sid = a.secteur_id || 0;
    if (!secMap.has(sid)) secMap.set(sid, {id:sid, nom:a.secteur_nom||"Sans secteur", items:[]});
    secMap.get(sid)!.items.push(a);
  });
  const SEC_ORDER = ["primaire","secondaire","tertiaire"];
  const secteurs = Array.from(secMap.values()).sort((a,b)=>{
    const ai = SEC_ORDER.findIndex(o=>a.nom.toLowerCase().includes(o));
    const bi = SEC_ORDER.findIndex(o=>b.nom.toLowerCase().includes(o));
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });

  return (
    <div style={{display:"flex",flexDirection:"column" as const,gap:28}}>
      {secteurs.map((sec) => {
        const color = secColor(sec.nom);
        return (
          <div key={sec.id}>
            {/* Header secteur */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:20,borderRadius:2,background:color,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:700,color,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{sec.nom}</span>
            </div>
            {/* Grille de cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {sec.items.map((a:any) => (
                <div key={a.id} onClick={()=>onVue(a)}
                  style={{background:"#fff",borderTop:"1px solid #E8E5E3",borderRight:"1px solid #E8E5E3",borderBottom:"1px solid #E8E5E3",borderLeft:`3px solid ${a.est_publie?color:"#C5BFBB"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",minWidth:0}}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${color}18`;ev.currentTarget.style.borderTopColor=`${color}50`;ev.currentTarget.style.borderRightColor=`${color}50`;ev.currentTarget.style.borderBottomColor=`${color}50`;}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderTopColor="#E8E5E3";ev.currentTarget.style.borderRightColor="#E8E5E3";ev.currentTarget.style.borderBottomColor="#E8E5E3";}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:3,lineHeight:1.35}}><TextTicker text={a.activite_nom||"Activité non définie"}/></div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
                    {a.secteur_nom&&<span style={{fontSize:11,color:"#9aa5b4"}}>{a.secteur_nom}</span>}
                    {a.branche_nom&&<><span style={{fontSize:10,color:"#C5BFBB"}}>›</span><span style={{fontSize:11,color:"#9aa5b4"}}>{a.branche_nom}</span></>}
                  </div>
                  {(a.selections||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:8}}>
                      {(a.selections||[]).slice(0,3).map((s:any)=>(
                        <span key={s.id} style={{fontSize:10,fontWeight:600,color,background:`${color}10`,border:`1px solid ${color}25`,padding:"2px 8px",borderRadius:999}}>{s.type_libelle}</span>
                      ))}
                      {(a.selections||[]).length>3&&<span style={{fontSize:10,color:"#9aa5b4"}}>+{(a.selections||[]).length-3}</span>}
                    </div>
                  )}
                  {(a.fichiers||[]).length>0&&<div style={{fontSize:11,color:"#9aa5b4",marginBottom:8}}>{a.fichiers.length} document{a.fichiers.length>1?"s":""}</div>}
                  <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:8}} onClick={ev=>ev.stopPropagation()}>
                    <button onClick={()=>onEdit(a)}
                      style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#366FE3",fontWeight:600}}>
                      <Pencil size={11}/> Modifier
                    </button>
                    <button onClick={()=>onToggle(a)} disabled={avgToggle===a.id}
                      style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:a.est_publie?"rgba(5,150,105,0.07)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:a.est_publie?"#059669":"#6b7280",fontWeight:600}}>
                      {avgToggle===a.id?<Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/>:a.est_publie?<><EyeOff size={11}/> Public</>:<><Eye size={11}/> Publier</>}
                    </button>
                    <button onClick={()=>onDelete(a.id)} disabled={avgDel===a.id}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                      {avgDel===a.id?<Loader2 size={11} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={11} style={{color:"#dc2626"}}/>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Modal vue Potentialité (admin)
// ══════════════════════════════════════════════════════════════════════════════
function PotentialiteVueModal({ pot: p, onClose, onEdit }: {
  pot:any; onClose:()=>void; onEdit:(p:any)=>void;
}) {
  // Couleur du niveau (palette du site)
  const NIVEAU_COLORS: Record<string,string> = {
    pole:"#004f91", region:"#ca631f", departement:"#188038", arrondissement:"#6A1B9A",
  };
  const nivColor = NIVEAU_COLORS[p.niveau] || "#004f91";
  const zoneNom = p.pole_nom||p.region_nom||p.departement_nom||p.arrondissement_nom||"";
  const [fichiers,  setFichiers]  = useState<any[]>(p.fichiers||[]);
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API}/opportunites/potentialites/${p.id}`)
      .then(r=>r.json())
      .then(d=>setFichiers(d.fichiers||[]))
      .catch(()=>{});
    const safe = (url:string) => fetch(url).then(r=>r.json()).catch(()=>[]);
    Promise.all([
      safe(`${API}/entreprises/ref/secteurs`),
      safe(`${API}/entreprises/ref/branches`),
      safe(`${API}/entreprises/ref/activites`),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); });
  }, [p.id]);

  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{p.titre}</h2>
            {zoneNom&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:nivColor,background:`${nivColor}12`,padding:"3px 10px",borderRadius:999}}>{zoneNom}</span>
              </div>
            )}
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

          {/* Activités porteuses */}
          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <section>
              <SecTitle>Activités porteuses</SecTitle>
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

          {/* Description */}
          {p.description&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc} [data-rte] ol{padding-left:20px;list-style-type:decimal} [data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte style={{fontSize:13,color:"#4a5568",lineHeight:1.7}} dangerouslySetInnerHTML={{__html:p.description}}/>
              </div>
            </section>
          )}

          {/* Documents */}
          {fichiers.length>0&&(
            <section>
              <SecTitle>{fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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

// ══════════════════════════════════════════════════════════════════════════════
// Modal vue Avantage (admin)
// ══════════════════════════════════════════════════════════════════════════════
function AvantageVueModal({ avg: a, onClose, onEdit, onSaved }: {
  avg:any; onClose:()=>void; onEdit:(a:any)=>void; onSaved:()=>void;
}) {
  const [data, setData] = useState<any>(a);

  useEffect(()=>{
    fetch(`${API}/opportunites/avantages/${a.id}`)
      .then(r=>r.json()).then(setData).catch(()=>{});
  },[a.id]);

  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{data.activite_nom}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {data.secteur_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{data.secteur_nom}</span>}
              {data.branche_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",padding:"3px 10px",borderRadius:999}}>{data.branche_nom}</span>}
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

          {/* Avantages sélectionnés */}
          {(data.selections||[]).length>0&&(
            <section>
              <SecTitle>Avantages &amp; incitations</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {(data.selections||[]).map((s:any)=>(
                  <div key={s.id} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:s.commentaire?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"#188038"}}>{s.type_libelle}</span>
                    </div>
                    {s.commentaire&&<p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,marginLeft:14,whiteSpace:"pre-wrap" as const}}>{s.commentaire}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {data.avantages&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:data.avantages}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Documents */}
          {(data.fichiers||[]).length>0&&(
            <section>
              <SecTitle>{(data.fichiers||[]).length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {(data.fichiers||[]).map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/avantages/${data.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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
          <button onClick={()=>{onClose();onEdit(data);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgba(0,79,145,0.25)"}}>
            <Pencil size={13}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════
export default function OpportunitesAdminPage() {
  const [onglet, setOnglet] = useState<"projets"|"potentialites"|"avantages">("projets");
  const [projetsCount, setProjetsCount] = useState(0);
  const [poles,       setPoles]       = useState<any[]>([]);
  // Noms géo pour le titre auto
  const [regionNom,   setRegionNom]   = useState("");
  const [deptNom,     setDeptNom]     = useState("");
  const [arrNom,      setArrNom]      = useState("");

  const [pots,      setPots]      = useState<any[]>([]);
  const [potsLoad,  setPotsLoad]  = useState(true);
  const [potModal,  setPotModal]  = useState(false);
  const [potEdit,   setPotEdit]   = useState<any>(null);
  const [potVue,    setPotVue]    = useState<any>(null);
  const [potDel,    setPotDel]    = useState<number|null>(null);
  const [potToggle, setPotToggle] = useState<number|null>(null);
  const [groupsOpen, setGroupsOpen] = useState<Record<string,boolean>>({pole:true,region:true,departement:true,arrondissement:true});

  const [avgs,      setAvgs]      = useState<any[]>([]);
  const [avgsTotal, setAvgsTotal] = useState(0);
  const [avgsQ,     setAvgsQ]     = useState("");
  const [avgsLoad,  setAvgsLoad]  = useState(true);
  const [avgModal,  setAvgModal]  = useState(false);
  const [avgEdit,   setAvgEdit]   = useState<any>(null);
  const [avgVue,    setAvgVue]    = useState<any>(null);
  const [avgDel,    setAvgDel]    = useState<number|null>(null);
  const [avgToggle, setAvgToggle] = useState<number|null>(null);
  const [selectedSec, setSelectedSec] = useState<string|null>(null);
  const [selectedNiveau, setSelectedNiveau] = useState<string|null>(null);
  const [refSecteurs,  setRefSecteurs]  = useState<any[]>([]);
  const [refBranches,  setRefBranches]  = useState<any[]>([]);
  const [refActivites, setRefActivites] = useState<any[]>([]);

  useEffect(()=>{
    const safe = (url:string) => fetch(url).then(r=>r.json()).catch(()=>[]);
    Promise.all([
      safe(`${API}/entreprises/ref/secteurs`),
      safe(`${API}/entreprises/ref/branches`),
      safe(`${API}/entreprises/ref/activites`),
    ]).then(([s,b,a])=>{ setRefSecteurs(s||[]); setRefBranches(b||[]); setRefActivites(a||[]); });
  },[]);

  useEffect(()=>{
    fetch(`${API}/zones-types/poles`).then(r=>r.json()).then(setPoles).catch(()=>{});
  },[]);

  const chargerPots = useCallback(async()=>{
    setPotsLoad(true);
    try {
      const res=await fetch(`${API}/opportunites/potentialites?admin=true&per_page=50`);
      const d=await res.json();
      setPots(d.data||[]);
    } finally{setPotsLoad(false);}
  },[]);

  const chargerAvgs = useCallback(async()=>{
    setAvgsLoad(true);
    try {
      const p=new URLSearchParams({admin:"true",per_page:"50"});
      if(avgsQ)p.set("q",avgsQ);
      const res=await fetch(`${API}/opportunites/avantages?${p}`);
      const d=await res.json();
      setAvgs(d.data||[]); setAvgsTotal(d.total||0);
    } finally{setAvgsLoad(false);}
  },[avgsQ]);

  // Référentiel géographique (compteurs « défini / total » + rattachements des fiches)
  const [geoRef, setGeoRef] = useState<{regions:any[];departements:any[];arrondissements:any[]}>({ regions:[], departements:[], arrondissements:[] });
  useEffect(()=>{
    Promise.all([
      fetch(`${API}/entreprises/ref/regions`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/departements`).then(r=>r.json()),
      fetch(`${API}/entreprises/ref/arrondissements`).then(r=>r.json()),
    ]).then(([r,d,a])=>setGeoRef({ regions:r||[], departements:d||[], arrondissements:a||[] })).catch(()=>{});
  },[]);
  const geoTotaux = { regions:geoRef.regions.length, departements:geoRef.departements.length, arrondissements:geoRef.arrondissements.length };

  useEffect(()=>{chargerPots();},[chargerPots]);
  useEffect(()=>{chargerAvgs();},[chargerAvgs]);
  useEffect(()=>{ setSelectedSec(null); setSelectedNiveau(null); },[onglet]);
  useEffect(()=>{ fetch(`${API}/projets?per_page=1&admin=true`).then(r=>r.json()).then(d=>setProjetsCount(d.total||0)).catch(()=>{}); },[onglet]);

  const deletePot=async(id:number)=>{
    if(!confirm("Supprimer cette fiche ?"))return;
    setPotDel(id);
    await fetch(`${API}/opportunites/potentialites/${id}`,{method:"DELETE"});
    setPotDel(null);chargerPots();
  };
  const togglePot=async(p:any)=>{
    setPotToggle(p.id);
    await fetch(`${API}/opportunites/potentialites/${p.id}/toggle`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({est_publie:!p.est_publie})});
    setPotToggle(null);chargerPots();
  };
  const deleteAvg=async(id:number)=>{
    if(!confirm("Supprimer cet avantage ?"))return;
    setAvgDel(id);
    await fetch(`${API}/opportunites/avantages/${id}`,{method:"DELETE"});
    setAvgDel(null);chargerAvgs();
  };
  const toggleAvg=async(a:any)=>{
    setAvgToggle(a.id);
    await fetch(`${API}/opportunites/avantages/${a.id}/toggle`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({est_publie:!a.est_publie})});
    setAvgToggle(null);chargerAvgs();
  };

  const openNewProjet = useRef<(() => void) | null>(null);

  const TABS=[
    {key:"projets",       label:"Banque de projets",      color:"#ca631f"},
    {key:"potentialites", label:"Potentialités par zone",  color:"#059669"},
    {key:"avantages",     label:"Avantages & incitations", color:"#0D652D"},
  ] as const;

  const niveauBadge=(p:any)=>{
    if(p.pole_id)          return {label:p.pole_nom||"Pôle",            color:"#ca631f"};
    if(p.region_id)        return {label:p.region_nom||"Région",        color:"#E35336"};
    if(p.departement_id)   return {label:p.departement_nom||"Dép.",     color:"#0891b2"};
    if(p.arrondissement_id)return {label:p.arrondissement_nom||"Arr.",  color:"#0D652D"};
    return {label:"Global",color:"#6b7280"};
  };
  const potTitle = (p:any) => (p.titre||"")
    .replace(/^[Pp]otentialités?\s+(de\s+l[''']|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
    .replace(/^(.)/, (_:string,c:string) => c.toUpperCase());

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>

      <div style={{marginBottom:12}}>
        <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Opportunités d'investissement</h1>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderBottom:"1px solid #E8E5E3",marginBottom:28}}>
        <div style={{display:"flex"}}>
          {TABS.map(t=>{
            const actif = onglet===t.key;
            return (
            <button key={t.key} onClick={()=>setOnglet(t.key)}
              style={{padding:"14px 22px",border:"none",borderBottom:`2px solid ${actif?"#004f91":"transparent"}`,background:"transparent",color:actif?"#004f91":"#9aa5b4",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",transition:"all 0.15s"}}>
              {t.label}
              {t.key==="projets" && projetsCount>0 && <span style={{marginLeft:7,fontSize:11,fontWeight:700,color:actif?"#004f91":"#9aa5b4",background:actif?"rgba(0,79,145,0.1)":"#F2F0EF",padding:"1px 7px",borderRadius:999}}>{projetsCount}</span>}
            </button>
            );
          })}
        </div>
        {onglet==="projets"&&(
          <button onClick={()=>openNewProjet.current?.()}
            style={{display:"flex",alignItems:"center",gap:8,background:"#004f91",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,79,145,0.3)"}}>
            <Plus size={15}/> Nouveau projet
          </button>
        )}
        {onglet==="potentialites"&&(
          <button onClick={()=>{setPotEdit(null);setPotModal(true);}}
            style={{display:"flex",alignItems:"center",gap:8,background:"#004f91",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,79,145,0.3)"}}>
            <Plus size={15}/> Nouvelle fiche
          </button>
        )}
        {onglet==="avantages"&&(
          <button onClick={()=>{setAvgEdit(null);setAvgModal(true);}}
            style={{display:"flex",alignItems:"center",gap:8,background:"#004f91",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,79,145,0.3)"}}>
            <Plus size={15}/> Nouvel avantage
          </button>
        )}
      </div>

      {onglet==="projets" && <BanqueProjets registerOpenNew={fn=>{ openNewProjet.current=fn; }}/>}

      {onglet==="potentialites" && (
        <div>
          {potsLoad ? (
            <div style={{display:"flex",justifyContent:"center",padding:60}}><Loader2 size={28} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/></div>
          ) : selectedNiveau===null ? (
            /* ── Vue 4 cards de sélection ── */
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
              {([
                {key:"pole",           label:"Pôles territoires", unit:"Pôles",           color:"#004f91"},
                {key:"region",         label:"Régions",           unit:"Régions",         color:"#ca631f"},
                {key:"departement",    label:"Départements",      unit:"Départements",    color:"#188038"},
                {key:"arrondissement", label:"Arrondissements",   unit:"Arrondissements", color:"#6A1B9A"},
              ] as const).map(n=>{
                const items = pots.filter((p:any)=>p.niveau===n.key);
                const count = items.length;
                const total = n.key==="pole" ? poles.length
                  : n.key==="region" ? geoTotaux.regions
                  : n.key==="departement" ? geoTotaux.departements
                  : geoTotaux.arrondissements;
                return (
                  <div key={n.key} onClick={()=>count>0&&setSelectedNiveau(n.key)}
                    style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",opacity:count>0?1:0.6}}
                    onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${n.color}40`;}
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                            });
                          }}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                    <div style={{height:3,background:`linear-gradient(90deg,${n.color}CC 0%,${n.color} 50%,${n.color}99 100%)`,flexShrink:0}}/>
                    <div style={{padding:"14px 16px 14px",flex:1}}>
                      {/* Niveau */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:n.color,background:`${n.color}12`,padding:"3px 10px",borderRadius:999,overflow:"hidden",whiteSpace:"nowrap" as const,maxWidth:"100%"}}>
                          <span style={{width:6,height:6,borderRadius:"50%",background:n.color,["--pc" as any]:`${n.color}66`,animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                          {n.label}
                        </span>
                      </div>

                      {/* Compteurs libellés */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                          <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{n.unit}</p>
                          <p style={{fontSize:14,fontWeight:800,color:total>0?"#1a1a2e":"#9aa5b4"}}>{total||"—"}</p>
                        </div>
                        <div style={{background:"rgba(24,128,56,0.04)",border:"1px solid rgba(24,128,56,0.12)",borderRadius:10,padding:"8px 11px"}}>
                          <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#188038",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Fiches définies</span></p>
                          <p style={{fontSize:14,fontWeight:800,color:count>0?"#1a1a2e":"#9aa5b4"}}>{total>0?`${count}/${total}`:count}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:n.color,fontWeight:600,opacity:count>0?1:0.45,transition:"background 0.15s"}}
                        onMouseEnter={ev=>{if(count>0)ev.currentTarget.style.background=`${n.color}0D`;}}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        Voir les détails →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Fiches du niveau sélectionné ── */
            <>
              <button onClick={()=>setSelectedNiveau(null)}
                style={{display:"flex",alignItems:"center",gap:6,marginBottom:24,background:"none",border:"none",cursor:"pointer",color:"#4a5568",fontSize:13,fontWeight:600,padding:0}}>
                <ArrowLeft size={14}/> Retour aux zones
              </button>
              {(()=>{
                const items = pots.filter((p:any)=>p.niveau===selectedNiveau);
                if (items.length===0) return <div style={{textAlign:"center",padding:"80px 0",color:"#9aa5b4"}}><p style={{fontSize:13}}>Aucune fiche</p></div>;
                // Rattachements géographiques via le référentiel déjà chargé
                const regionDuDept = (nom:string) => {
                  const dep = geoRef.departements.find((d:any)=>d.nom===nom);
                  return geoRef.regions.find((r:any)=>r.id===dep?.region_id)?.nom || null;
                };
                const deptDeArr = (nom:string) => {
                  const arr = geoRef.arrondissements.find((a:any)=>a.nom===nom);
                  return geoRef.departements.find((d:any)=>d.id===arr?.departement_id)?.nom || null;
                };
                const poleDeRegion = (nom:string) => poles.find((x:any)=>(x.localisation||"").includes(nom))?.pole_territoire || null;
                return (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                    {items.map((p:any)=>{
                      const nbActs = (p.activite_ids||[]).length;
                      // Premier bloc contextuel selon le niveau
                      const info1 = selectedNiveau==="pole"
                        ? { label:(poles.find((x:any)=>x.id===p.pole_id)?.localisation||"").includes(",")?"Régions":"Région", value: poles.find((x:any)=>x.id===p.pole_id)?.localisation||null }
                        : selectedNiveau==="region"
                        ? { label:"Pôle", value: poleDeRegion(p.region_nom||"") }
                        : selectedNiveau==="departement"
                        ? { label:"Région", value: p.region_nom||regionDuDept(p.departement_nom||"") }
                        : { label:"Département", value: p.departement_nom||deptDeArr(p.arrondissement_nom||"") };
                      return (
                        <div key={p.id} onClick={()=>setPotVue(p)}
                          style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",minWidth:0}}
                          onMouseEnter={ev=>{
                            ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";
                            // Contenus trop longs : glissent pour révéler la fin
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                            });
                          }}
                          onMouseLeave={ev=>{
                            ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                          <div style={{height:3,background:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
                          <div style={{padding:"14px 16px 14px",flex:1}}>
                            {/* Titre (défile au survol si trop long) */}
                            <div data-marquee style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35,overflow:"hidden",whiteSpace:"nowrap" as const}}>
                              <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                            </div>

                            {/* Infos libellées */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                              <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px",minWidth:0}}>
                                <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{info1.label}</p>
                                <p data-marquee style={{fontSize:12,fontWeight:600,color:info1.value?"#1a1a2e":"#9aa5b4",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{info1.value||"—"}</span>
                                </p>
                              </div>
                              <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                                <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Activités porteuses</span></p>
                                <p style={{fontSize:14,fontWeight:800,color:nbActs>0?"#1a1a2e":"#9aa5b4"}}>{nbActs||"—"}</p>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{display:"flex",alignItems:"stretch",borderTop:"1px solid #F2F0EF"}} onClick={ev=>ev.stopPropagation()}>
                            <button onClick={()=>{setPotEdit(p);setPotModal(true);}}
                              style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                              onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                              <Pencil size={12}/> Modifier
                            </button>
                            <div style={{width:1,background:"#F2F0EF"}}/>
                            <button onClick={()=>togglePot(p)} disabled={potToggle===p.id}
                              style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:p.est_publie?"#188038":"#6b7280",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                              onMouseEnter={ev=>ev.currentTarget.style.background=p.est_publie?"rgba(24,128,56,0.05)":"rgba(156,163,175,0.07)"}
                              onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                              {potToggle===p.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:p.est_publie?<><EyeOff size={12}/> Publié</>:<><Eye size={12}/> Publier</>}
                            </button>
                            <div style={{width:1,background:"#F2F0EF"}}/>
                            <button onClick={()=>deletePot(p.id)} disabled={potDel===p.id}
                              style={{width:46,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",transition:"background 0.15s"}}
                              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                              onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                              {potDel===p.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
          <PotentialiteModal open={potModal} onClose={()=>setPotModal(false)} edit={potEdit} poles={poles} onSaved={chargerPots}/>
          {potVue && <PotentialiteVueModal pot={potVue} onClose={()=>setPotVue(null)} onEdit={p=>{ setPotVue(null); setPotEdit(p); setPotModal(true); }}/>}
        </div>
      )}

      {onglet==="avantages" && (
        <div>
          {avgsLoad ? (
            <div style={{display:"flex",justifyContent:"center",padding:60}}>
              <Loader2 size={28} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/>
            </div>
          ) : avgs.length===0 ? (
            <div style={{textAlign:"center",padding:"80px 0",color:"#9aa5b4"}}>
              <p style={{fontSize:16,fontWeight:600}}>Aucune fiche</p>
              <p style={{fontSize:13}}>Créez votre premier avantage ou incitation</p>
            </div>
          ) : selectedSec===null ? (
            /* ── Vue secteurs : 3 cards ── */
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {([
                {key:"primaire",   label:"Secteur Primaire",   color:"#004f91"},
                {key:"secondaire", label:"Secteur Secondaire", color:"#004f91"},
                {key:"tertiaire",  label:"Secteur Tertiaire",  color:"#004f91"},
              ] as const).map(s=>{
                const items = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(s.key));
                const count = items.length;
                const sec = refSecteurs.find((r:any)=>r.nom.toLowerCase().includes(s.key));
                const branches = sec ? refBranches.filter((b:any)=>b.secteur_id===sec.id) : [];
                const branchIds = new Set(branches.map((b:any)=>b.id));
                const actCount = refActivites.filter((a:any)=>branchIds.has(a.branche_id)).length;
                return (
                  <div key={s.key} onClick={()=>count>0&&setSelectedSec(s.key)}
                    style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden",opacity:count>0?1:0.6}}
                    onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${s.color}40`;}
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                            });
                          }}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                    <div style={{height:3,background:`linear-gradient(90deg,${s.color}CC 0%,${s.color} 50%,${s.color}99 100%)`,flexShrink:0}}/>
                    <div style={{padding:"14px 16px 14px",flex:1}}>
                      {/* Secteur */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10.5,fontWeight:700,color:s.color,background:`${s.color}12`,padding:"3px 10px",borderRadius:999,overflow:"hidden",whiteSpace:"nowrap" as const,maxWidth:"100%"}}>
                          <span style={{width:6,height:6,borderRadius:"50%",background:s.color,["--pc" as any]:`${s.color}66`,animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                          {s.label}
                        </span>
                      </div>

                      {/* Compteurs libellés */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                          <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Activités</p>
                          <p style={{fontSize:14,fontWeight:800,color:actCount>0?"#1a1a2e":"#9aa5b4"}}>{actCount||"—"}</p>
                        </div>
                        <div style={{background:"rgba(24,128,56,0.04)",border:"1px solid rgba(24,128,56,0.12)",borderRadius:10,padding:"8px 11px"}}>
                          <p data-marquee style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#188038",textTransform:"uppercase" as const,marginBottom:3,overflow:"hidden",whiteSpace:"nowrap" as const}}><span style={{display:"inline-block"}}>Avantages définis</span></p>
                          <p style={{fontSize:14,fontWeight:800,color:count>0?"#1a1a2e":"#9aa5b4"}}>{actCount>0?`${count}/${actCount}`:count}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:s.color,fontWeight:600,opacity:count>0?1:0.45,transition:"background 0.15s"}}
                        onMouseEnter={ev=>{if(count>0)ev.currentTarget.style.background=`${s.color}0D`;}}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        Voir les détails →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Vue du secteur sélectionné : une card par branche ── */
            <>
              <button onClick={()=>setSelectedSec(null)}
                style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:24,background:"#fff",border:"1px solid #E4E1DE",borderRadius:999,cursor:"pointer",color:"#4a5568",fontSize:12.5,fontWeight:600,padding:"8px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",transition:"border-color 0.15s, color 0.15s, box-shadow 0.15s",fontFamily:"var(--font-google-sans)"}}
                onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgba(0,79,145,0.35)";ev.currentTarget.style.color="#004f91";ev.currentTarget.style.boxShadow="0 4px 12px rgba(0,30,60,0.08)";const ic=ev.currentTarget.querySelector("svg") as SVGElement|null;if(ic)ic.style.transform="translateX(-3px)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.borderColor="#E4E1DE";ev.currentTarget.style.color="#4a5568";ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";const ic=ev.currentTarget.querySelector("svg") as SVGElement|null;if(ic)ic.style.transform="none";}}>
                <ArrowLeft size={14} style={{transition:"transform 0.18s"}}/> Retour aux secteurs
              </button>
              {(()=>{
                const filtered = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(selectedSec!));
                const secNom = filtered[0]?.secteur_nom || "";
                const braMap = new Map<number,{id:number;nom:string;items:any[]}>();
                filtered.forEach((a:any)=>{
                  const bid=a.branche_id||0;
                  if(!braMap.has(bid)) braMap.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
                  braMap.get(bid)!.items.push(a);
                });
                const bras=Array.from(braMap.values());
                return (
                  <div>
                    {/* En-tête du secteur */}
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:11,fontWeight:800,color:"#1a1a2e",background:"#fff",border:"1px solid #ECEAE7",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",padding:"5px 14px",borderRadius:999,whiteSpace:"nowrap" as const}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:"#004f91",["--pc" as any]:"rgba(0,79,145,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                        {secNom}
                      </span>
                      <span style={{flex:1,height:1,background:"#ECEAE7"}}/>
                    </div>

                    {/* Une card par branche */}
                    <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>
                      {bras.map(bra=>(
                        <div key={bra.id} style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.03)"}}>
                          {/* En-tête de branche */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 18px",borderBottom:"1px solid #F2F0EF",background:"#FCFBFA"}}>
                            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",["--pc" as any]:"rgba(202,99,31,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                              <span style={{fontSize:13.5,fontWeight:700,color:"#1a1a2e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</span>
                            </div>
                          </div>
                          {/* Activités */}
                          <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSec==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                            {bra.items.map((a:any)=>(
                              <div key={a.id} onClick={()=>setAvgVue(a)}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                onMouseEnter={ev=>{
                                  ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";ev.currentTarget.style.background="#fff";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="0 8px 20px rgba(0,30,60,0.08)";
                                  // Nom trop long : glisse pour révéler la fin
                                  const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                  const span = box?.firstElementChild as HTMLElement | null;
                                  if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                }}
                                onMouseLeave={ev=>{
                                  ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                  const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                  if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                }}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:"#188038",["--pc" as any]:"rgba(24,128,56,0.4)",animation:"pulseDotC 1.6s ease-out infinite",flexShrink:0}}/>
                                <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#1a1a2e",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{a.activite_nom}</span>
                                </div>
                                <button onClick={ev=>{ev.stopPropagation();deleteAvg(a.id);}} disabled={avgDel===a.id}
                                  style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 8px",flexShrink:0,transition:"background 0.15s"}}
                                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.14)"}
                                  onMouseLeave={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.07)"}>
                                  {avgDel===a.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          <AvantageModal open={avgModal} onClose={()=>setAvgModal(false)} edit={avgEdit} onSaved={chargerAvgs}/>
          {avgVue&&<AvantageVueModal avg={avgVue} onClose={()=>setAvgVue(null)} onEdit={a=>{setAvgVue(null);setAvgEdit(a);setAvgModal(true);}} onSaved={chargerAvgs}/>}
        </div>
      )}
    </div>
  );
}
