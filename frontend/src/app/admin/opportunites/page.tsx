"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Search, Eye, EyeOff, Upload, FileText, ChevronDown, ChevronUp, Award } from "lucide-react";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { FModal, FSection, FGrid, FLabel, FInput, FSelect, FSegmented, FInfo, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import RichTextEditor from "@/components/shared/RichTextEditor";
import BanqueProjets from "@/components/opportunites/BanqueProjets";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { badge_gris, voile } from "@/lib/couleurs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Niveaux et secteurs — mêmes libellés et couleurs que la page publique
const NIVEAUX_POTS = [
  {key:"pole",           label:"Pôles territoires", unit:"pôle",           color:"var(--bleu)"},
  {key:"region",         label:"Régions",           unit:"région",         color:"var(--orange)"},
  {key:"departement",    label:"Départements",      unit:"département",    color:"var(--vert)"},
  {key:"arrondissement", label:"Arrondissements",   unit:"arrondissement", color:"var(--violet)"},
] as const;
const SECTEURS_AVGS = [
  {key:"primaire",   label:"Secteur Primaire",   color:"var(--vert)"},
  {key:"secondaire", label:"Secteur Secondaire", color:"var(--orange)"},
  {key:"tertiaire",  label:"Secteur Tertiaire",  color:"var(--bleu)"},
] as const;

const IS: any  = { background:"var(--fond)", border:"1px solid var(--bordure-forte)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"var(--encre)", outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"var(--font-google-sans)" };
const LS: any  = { fontSize:12, fontWeight:600, color:"var(--texte)", marginBottom:5, display:"block" };
const SEC: any = { fontSize:11, fontWeight:700, color:"var(--orange)", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--bordure-forte)" };

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
        await fetch(`${API}/opportunites/potentialites/${potId}/fichiers`, { method:"POST", headers:await authHeaders(), body:fd });
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
        <div style={{ padding:"14px 18px", background:"rgb(var(--bleu-rgb) / 0.05)", border:"1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:6 }}>Fiche de potentialités</div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--encre)" }}>{titreAuto() || edit.titre}</div>
        </div>
      ) : (
        <FSection title="Zone géographique">
          <div style={{ marginBottom:14 }}>
            <FSegmented options={NIVEAUX.map(n=>({ value:n.value, label:n.label }))}
              value={form.niveau}
              onChange={v=>{ upd("niveau",v); upd("pole_id",""); upd("region_id",""); upd("departement_id",""); upd("arrondissement_id",""); }} />
          </div>
          {(()=>{
            // Note « n déjà défini(s) » commune aux 4 niveaux (les entrées
            // restent visibles dans les listes, grisées et non sélectionnables)
            const NoteDefinis = ({ n, libelle, fem }: { n:number; libelle:string; fem?:boolean }) => n>0 ? (
              <p style={{fontSize:11,color:"var(--gris)",marginTop:4}}>
                {n} {libelle}{n>1?"s":""} déjà défini{fem?"e":""}{n>1?"s":""} — modifiable{n>1?"s":""} depuis la liste
              </p>
            ) : null;
            return (<>
          {form.niveau==="pole" && (
            <div>
              <FSelect value={form.pole_id||""} onChange={e=>upd("pole_id",e.target.value?parseInt(e.target.value):"")}>
                <option value="">— Sélectionner un pôle —</option>
                {poles.map((p:any)=>{
                  const off = usedGeo.pole_ids.includes(p.id);
                  return <option key={p.id} value={p.id} disabled={off}>{p.pole_territoire}{off?" (déjà défini)":""}</option>;
                })}
              </FSelect>
              <NoteDefinis n={usedGeo.pole_ids.length} libelle="pôle"/>
            </div>
          )}
          {form.niveau==="region" && (
            <div>
              <RegionSelect value={form.region_id} onChange={v=>upd("region_id",v)} disabledIds={usedGeo.region_ids} />
              <NoteDefinis n={usedGeo.region_ids.length} libelle="région" fem/>
            </div>
          )}
          {form.niveau==="departement" && (
            <div>
              <FGrid cols={2} gap={10}>
                <div><FLabel>Région</FLabel>
                  <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); }} />
                </div>
                <div><FLabel>Département</FLabel>
                  <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>upd("departement_id",v)} disabledIds={usedGeo.departement_ids} />
                </div>
              </FGrid>
              <NoteDefinis n={usedGeo.departement_ids.length} libelle="département"/>
            </div>
          )}
          {form.niveau==="arrondissement" && (
            <div>
              <FGrid cols={3} gap={10}>
                <div><FLabel>Région</FLabel>
                  <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); upd("arrondissement_id",""); }} />
                </div>
                <div><FLabel>Département</FLabel>
                  <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>{ upd("departement_id",v); upd("arrondissement_id",""); }} />
                </div>
                <div><FLabel>Arrondissement</FLabel>
                  <ArrondissementSelect departementId={form.departement_id} value={form.arrondissement_id} onChange={v=>upd("arrondissement_id",v)} disabledIds={usedGeo.arrondissement_ids} />
                </div>
              </FGrid>
              <NoteDefinis n={usedGeo.arrondissement_ids.length} libelle="arrondissement"/>
            </div>
          )}
            </>);
          })()}
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
              <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--bleu-rgb) / 0.05)", border:"1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{ color:"var(--bleu)", flexShrink:0 }}/>
                <a href={`${API}/opportunites/potentialites/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:13, flex:1, color:"var(--encre)", fontWeight:500, textDecoration:"none" }}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{
                  if (edit?.id) await fetch(`${API}/opportunites/potentialites/${edit.id}/fichiers/${f.id}`,{method:"DELETE",headers:await authHeaders()});
                  setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                }} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={13} style={{color:"var(--danger)"}}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, cursor:"pointer", border:"2px dashed var(--bordure-forte)", background:"var(--carte-douce)", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bleu)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bordure-forte)"}>
          <Upload size={14} color="var(--gris)"/>
          <span style={{ fontSize:13, color:"var(--gris)" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
            const files = Array.from(e.target.files||[]);
            setPdfQueue(prev=>[...prev, ...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
            e.target.value="";
          }}/>
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginTop:8 }}>
            {pdfQueue.map((p,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgb(var(--violet-rgb) / 0.05)", border:"1px solid rgb(var(--violet-rgb) / 0.2)", borderRadius:10, padding:"8px 12px" }}>
                <FileText size={13} style={{color:"var(--violet)",flexShrink:0}}/>
                <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                  placeholder="Titre du document" style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgb(var(--violet-rgb) / 0.3)", outline:"none", fontSize:12.5, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                  <X size={13} style={{color:"var(--danger)"}}/>
                </button>
              </div>
            ))}
            <p style={{ fontSize:11, color:"var(--gris)" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
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
        await fetch(`${API}/opportunites/avantages/${avgId}/fichiers`,{method:"POST",headers:await authHeaders(),body:fd});
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
      <button onClick={onToggle} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 10px",background:count>0?voile(color, 3):"var(--carte-douce)",border:`1px solid ${count>0?voile(color, 19):"var(--bordure-forte)"}`,borderRadius:9,cursor:"pointer",marginBottom:colOpen?4:0,transition:"all 0.15s"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:count>0?color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{title}</span>
          {count>0&&<span style={{fontSize:10,fontWeight:700,color,background:voile(color, 8),padding:"1px 6px",borderRadius:999}}>1</span>}
        </div>
        {colOpen?<ChevronUp size={12} style={{color:"var(--gris)"}}/>:<ChevronDown size={12} style={{color:"var(--gris)"}}/>}
      </button>
      {colOpen&&<div style={{border:`1px solid ${voile(color, 13)}`,borderRadius:9,overflow:"hidden",maxHeight:200,overflowY:"auto" as const}}>{children}</div>}
    </div>
  );
  const AvgItem = ({ label, sel, color, disabled, onClick }: any) => (
    <button onClick={onClick} disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",border:"none",cursor:disabled?"not-allowed":"pointer",background:sel?voile(color, 7):"transparent",width:"100%",textAlign:"left" as const,transition:"background 0.12s",opacity:disabled?0.45:1}}
      onMouseEnter={e=>{if(!sel&&!disabled)e.currentTarget.style.background="var(--carte-douce)";}}
      onMouseLeave={e=>{e.currentTarget.style.background=sel?voile(color, 7):"transparent";}}>
      <div style={{width:13,height:13,borderRadius:"50%",border:`2px solid ${sel?color:"var(--gris)"}`,background:sel?color:"transparent",flexShrink:0,transition:"all 0.12s"}}/>
      <span style={{fontSize:12,color:sel?"var(--encre)":"var(--texte)",fontWeight:sel?600:400}}>{label}</span>
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
        <div style={{padding:"14px 18px",background:"rgb(var(--bleu-rgb) / 0.05)",border:"1px solid rgb(var(--bleu-rgb) / 0.15)",borderRadius:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--bleu)",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:8}}>Activité choisie</div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
            {edit.secteur_nom&&<span style={{fontSize:11,fontWeight:600,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.08)",padding:"3px 10px",borderRadius:99}}>{edit.secteur_nom}</span>}
            {edit.branche_nom&&<><span style={{fontSize:11,color:"var(--gris)"}}>›</span><span style={{fontSize:11,fontWeight:600,color:"var(--orange)",background:"rgb(var(--orange-rgb) / 0.08)",padding:"3px 10px",borderRadius:99}}>{edit.branche_nom}</span></>}
            {edit.activite_nom&&<><span style={{fontSize:11,color:"var(--gris)"}}>›</span><span style={{fontSize:12,fontWeight:700,color:"var(--vert)",background:"rgb(var(--vert-rgb) / 0.1)",border:"1px solid rgb(var(--vert-rgb) / 0.25)",padding:"4px 12px",borderRadius:99}}>{edit.activite_nom}</span></>}
          </div>
        </div>
      ) : (
        <FSection title="Choisissez une activité">
          {/* Chips de résumé */}
          {(form.secteur_id||form.branche_id||form.activite_id) && (
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:10}}>
              {form.secteur_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgb(var(--bleu-rgb) / 0.06)",color:"var(--bleu)",border:"1px solid rgb(var(--bleu-rgb) / 0.15)",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {secteurs.find((s:any)=>s.id===form.secteur_id)?.nom||""}
                <button onClick={()=>{upd("secteur_id",null);upd("branche_id",null);upd("activite_id",null);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"var(--bleu)"}}/></button>
              </span>}
              {form.branche_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgb(var(--orange-rgb) / 0.06)",color:"var(--orange)",border:"1px solid rgb(var(--orange-rgb) / 0.15)",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {branches.find((b:any)=>b.id===form.branche_id)?.nom||""}
                <button onClick={()=>{upd("branche_id",null);upd("activite_id",null);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"var(--orange)"}}/></button>
              </span>}
              {form.activite_id&&<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgb(var(--vert-rgb) / 0.06)",color:"var(--vert)",border:"1px solid rgb(var(--vert-rgb) / 0.15)",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                {activites.find((a:any)=>a.id===form.activite_id)?.nom||""}
                <button onClick={()=>upd("activite_id",null)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10} style={{color:"var(--vert)"}}/></button>
              </span>}
            </div>
          )}
          {/* Cascade 3 colonnes */}
          <div style={{display:"flex",gap:8}}>
            <AvgCol title="Secteur" color="var(--bleu)" open={openSec} onToggle={()=>setOpenSec((o:boolean)=>!o)} count={form.secteur_id?1:0}>
              {secteurs.map((s:any)=>{
                const sel = form.secteur_id===s.id;
                return <AvgItem key={s.id} label={s.nom} sel={sel} color="var(--bleu)"
                  onClick={()=>{ upd("secteur_id",sel?null:s.id); if(!sel){upd("branche_id",null);upd("activite_id",null);setOpenBra(true);} }}/>;
              })}
            </AvgCol>
            <AvgCol title="Branche" color="var(--orange)" open={openBra} onToggle={()=>setOpenBra((o:boolean)=>!o)} count={form.branche_id?1:0}>
              {brasDispo.length===0
                ? <p style={{fontSize:11,color:"var(--gris)",padding:"10px 12px"}}>Choisir un secteur d'abord</p>
                : brasDispo.map((b:any)=>{
                    const sel = form.branche_id===b.id;
                    return <AvgItem key={b.id} label={b.nom} sel={sel} color="var(--orange)"
                      onClick={()=>{ upd("branche_id",sel?null:b.id); if(!sel){upd("activite_id",null);setOpenAct(true);} }}/>;
                  })}
            </AvgCol>
            <AvgCol title="Activité" color="var(--vert)" open={openAct} onToggle={()=>setOpenAct((o:boolean)=>!o)} count={form.activite_id?1:0}>
              {actsDispo.length===0
                ? <p style={{fontSize:11,color:"var(--gris)",padding:"10px 12px"}}>Choisir une branche d'abord</p>
                : actsDispo.map((a:any)=>{
                    const sel = form.activite_id===a.id;
                    const used = usedActivites.includes(a.id);
                    return <AvgItem key={a.id} label={`${a.nom}${used&&!sel?" (déjà défini)":""}`} sel={sel} color="var(--vert)" disabled={used&&!sel}
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
              <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgb(var(--bleu-rgb) / 0.05)",border:"1px solid rgb(var(--bleu-rgb) / 0.15)",borderRadius:10,padding:"8px 12px"}}>
                <FileText size={13} style={{color:"var(--bleu)",flexShrink:0}}/>
                <a href={`${API}/opportunites/avantages/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:13,flex:1,color:"var(--encre)",fontWeight:500,textDecoration:"none"}}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{
                  if(edit?.id) await fetch(`${API}/opportunites/avantages/${edit.id}/fichiers/${f.id}`,{method:"DELETE",headers:await authHeaders()});
                  setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                }} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"var(--danger)"}}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,cursor:"pointer",border:"2px dashed var(--bordure-forte)",background:"var(--carte-douce)",transition:"border-color 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--bleu)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bordure-forte)";}}>
          <Upload size={14} color="var(--gris)"/>
          <span style={{fontSize:13,color:"var(--gris)"}}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>{
            const files=Array.from(e.target.files||[]);
            setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
            e.target.value="";
          }}/>
        </label>
        {pdfQueue.length>0&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginTop:8}}>
            {pdfQueue.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgb(var(--violet-rgb) / 0.05)",border:"1px solid rgb(var(--violet-rgb) / 0.2)",borderRadius:10,padding:"8px 12px"}}>
                <FileText size={13} style={{color:"var(--violet)",flexShrink:0}}/>
                <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                  placeholder="Titre du document" style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgb(var(--violet-rgb) / 0.3)",outline:"none",fontSize:12.5,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
                  <X size={13} style={{color:"var(--danger)"}}/>
                </button>
              </div>
            ))}
            <p style={{fontSize:11,color:"var(--gris)"}}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
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

const SECTEUR_COLORS = ["var(--orange)","var(--bleu)","var(--emeraude)","var(--vert-fonce)","var(--cyan)","var(--alerte)","var(--terracotta)","var(--vert)"];
const secColor = (nom:string) => {
  const n = nom.toLowerCase();
  if (n.includes("primaire"))   return "var(--terracotta)";
  if (n.includes("secondaire")) return "var(--bleuroi)";
  if (n.includes("tertiaire"))  return "var(--vert-fonce)";
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
                  style={{background:"var(--carte)",borderTop:"1px solid var(--bordure-forte)",borderRight:"1px solid var(--bordure-forte)",borderBottom:"1px solid var(--bordure-forte)",borderLeft:`3px solid ${a.est_publie?color:"var(--gris)"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"var(--ombre-1)",minWidth:0}}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${voile(color, 9)}`;ev.currentTarget.style.borderTopColor=`${voile(color, 31)}`;ev.currentTarget.style.borderRightColor=`${voile(color, 31)}`;ev.currentTarget.style.borderBottomColor=`${voile(color, 31)}`;}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.borderTopColor="var(--bordure-forte)";ev.currentTarget.style.borderRightColor="var(--bordure-forte)";ev.currentTarget.style.borderBottomColor="var(--bordure-forte)";}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--encre)",marginBottom:3,lineHeight:1.35}}><TextTicker text={a.activite_nom||"Activité non définie"}/></div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
                    {a.secteur_nom&&<span style={{fontSize:11,color:"var(--gris)"}}>{a.secteur_nom}</span>}
                    {a.branche_nom&&<><span style={{fontSize:10,color:"var(--gris)"}}>›</span><span style={{fontSize:11,color:"var(--gris)"}}>{a.branche_nom}</span></>}
                  </div>
                  {(a.selections||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:8}}>
                      {(a.selections||[]).slice(0,3).map((s:any)=>(
                        <span key={s.id} style={{fontSize:10,fontWeight:600,color,background:`${voile(color, 6)}`,border:`1px solid ${voile(color, 15)}`,padding:"2px 8px",borderRadius:999}}>{s.type_libelle}</span>
                      ))}
                      {(a.selections||[]).length>3&&<span style={{fontSize:10,color:"var(--gris)"}}>+{(a.selections||[]).length-3}</span>}
                    </div>
                  )}
                  {(a.fichiers||[]).length>0&&<div style={{fontSize:11,color:"var(--gris)",marginBottom:8}}>{a.fichiers.length} document{a.fichiers.length>1?"s":""}</div>}
                  <div style={{display:"flex",gap:5,borderTop:"1px solid var(--bordure)",paddingTop:8}} onClick={ev=>ev.stopPropagation()}>
                    <button className="ro-w" onClick={()=>onEdit(a)}
                      style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgb(var(--bleu-rgb) / 0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"var(--bleu)",fontWeight:600}}>
                      <Pencil size={11}/> Modifier
                    </button>
                    <button onClick={()=>onToggle(a)} disabled={avgToggle===a.id}
                      style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:a.est_publie?"rgb(var(--vert-rgb) / 0.07)":"rgb(var(--gris-rgb) / 0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:a.est_publie?"var(--vert)":"var(--gris-fort)",fontWeight:600}}>
                      {avgToggle===a.id?<Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/>:a.est_publie?<><EyeOff size={11}/> Public</>:<><Eye size={11}/> Publier</>}
                    </button>
                    <button className="ro-w" onClick={()=>onDelete(a.id)} disabled={avgDel===a.id}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgb(var(--danger-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                      {avgDel===a.id?<Loader2 size={11} style={{color:"var(--danger)",animation:"spin 1s linear infinite"}}/>:<Trash2 size={11} style={{color:"var(--danger)"}}/>}
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
    pole:"var(--bleu)", region:"var(--orange)", departement:"var(--vert)", arrondissement:"var(--violet)",
  };
  const nivColor = NIVEAU_COLORS[p.niveau] || "var(--bleu)";
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
    <p style={{fontSize:10.5,fontWeight:700,color:"var(--bleu)",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgb(var(--encre-rgb) / 0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"var(--carte)",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"var(--ombre-2)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"var(--bleu-action)",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid var(--bordure)",flexShrink:0}}>
          <div style={{minWidth:0,flex:1}}>
            <h2 title={p.titre}
              onMouseEnter={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;const d=sp.scrollWidth-ev.currentTarget.clientWidth;if(d>0){sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`;sp.style.transform=`translateX(-${d}px)`;}}}
              onMouseLeave={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;sp.style.transition="transform 0.4s ease";sp.style.transform="translateX(0)";}}
              style={{fontWeight:800,fontSize:"1.1rem",color:"var(--encre)",lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap" as const,margin:0}}>
              <span style={{display:"inline-block"}}>{p.titre}</span>
            </h2>
            {zoneNom&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:nivColor,background:`${nivColor}12`,padding:"3px 10px",borderRadius:999}}>{zoneNom}</span>
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{background:"var(--champ)",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)"/>
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
                        <div style={{width:8,height:8,borderRadius:"50%",background:"var(--bleu-action)",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"var(--bleu)"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{paddingLeft:20,borderLeft:"2px solid rgb(var(--bleu-rgb) / 0.15)",display:"flex",flexDirection:"column" as const,gap:4}}>
                          {brasDuSec.map((bra:any) => {
                            const actsDeBra = activites.filter((a:any) => a.branche_id === bra.id && (p.activite_ids||[]).includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?3:0}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:"var(--orange-action)",flexShrink:0}}/>
                                  <span style={{fontSize:11,fontWeight:600,color:"var(--orange)"}}>{bra.nom}</span>
                                </div>
                                {actsDeBra.length > 0 && (
                                  <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                    {actsDeBra.map((act:any) => (
                                      <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                        <div style={{width:5,height:5,borderRadius:"50%",background:"var(--vert-action)",flexShrink:0}}/>
                                        <span style={{fontSize:11,color:"var(--vert)",fontWeight:500}}>{act.nom}</span>
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
              <div style={{background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc} [data-rte] ol{padding-left:20px;list-style-type:decimal} [data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte style={{fontSize:13,color:"var(--texte)",lineHeight:1.7}} dangerouslySetInnerHTML={{__html:p.description}}/>
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
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgb(var(--bleu-rgb) / 0.05)",border:"1px solid rgb(var(--bleu-rgb) / 0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"var(--bleu)",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"var(--bleu)",fontWeight:600}}>{f.titre||f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid var(--bordure)",background:"var(--carte-douce)",flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:"10px 20px",borderRadius:10,border:"1px solid var(--bordure-forte)",background:"var(--carte)",color:"var(--texte)",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
          <button className="ro-w" onClick={()=>{onClose();onEdit(p);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"var(--bleu-action)",color:"var(--sur-bleu)",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)"}}>
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
    <p style={{fontSize:10.5,fontWeight:700,color:"var(--bleu)",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgb(var(--encre-rgb) / 0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div style={{background:"var(--carte)",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"var(--ombre-2)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"var(--bleu-action)",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid var(--bordure)",flexShrink:0}}>
          <div style={{minWidth:0,flex:1}}>
            <h2 title={data.activite_nom}
              onMouseEnter={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;const d=sp.scrollWidth-ev.currentTarget.clientWidth;if(d>0){sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`;sp.style.transform=`translateX(-${d}px)`;}}}
              onMouseLeave={ev=>{const sp=ev.currentTarget.firstElementChild as HTMLElement|null;if(!sp)return;sp.style.transition="transform 0.4s ease";sp.style.transform="translateX(0)";}}
              style={{fontWeight:800,fontSize:"1.1rem",color:"var(--encre)",lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap" as const,margin:0}}>
              <span style={{display:"inline-block"}}>{data.activite_nom}</span>
            </h2>
            <div style={{display:"flex",gap:6,marginTop:8,minWidth:0}}>
              {data.secteur_nom&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.07)",padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap" as const,flexShrink:0}}>{data.secteur_nom}</span>}
              {data.branche_nom&&(
                <span title={data.branche_nom}
                  onMouseEnter={ev=>{const box=ev.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;const sp=box?.firstElementChild as HTMLElement|null;if(!box||!sp)return;const d=sp.scrollWidth-box.clientWidth;if(d>0){sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`;sp.style.transform=`translateX(-${d}px)`;}}}
                  onMouseLeave={ev=>{const sp=(ev.currentTarget.querySelector("[data-marquee]") as HTMLElement|null)?.firstElementChild as HTMLElement|null;if(!sp)return;sp.style.transition="transform 0.4s ease";sp.style.transform="translateX(0)";}}
                  style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"var(--orange)",background:"rgb(var(--orange-rgb) / 0.08)",padding:"3px 10px",borderRadius:999,minWidth:0}}>
                  <span data-marquee style={{overflow:"hidden",whiteSpace:"nowrap" as const,minWidth:0}}>
                    <span style={{display:"inline-block"}}>{data.branche_nom}</span>
                  </span>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"var(--champ)",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
            onMouseEnter={ev=>(ev.currentTarget.style.background="var(--fond-creux2)")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="var(--champ)")}>
            <X size={15} color="var(--texte)"/>
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
                  <div key={s.id} style={{background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:s.commentaire?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"var(--vert-action)",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--vert)"}}>{s.type_libelle}</span>
                    </div>
                    {s.commentaire&&<p style={{fontSize:13,color:"var(--texte)",lineHeight:1.7,marginLeft:14,whiteSpace:"pre-wrap" as const}}>{s.commentaire}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {data.avantages&&(
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:data.avantages}} style={{fontSize:13,color:"var(--texte)",lineHeight:1.7}}/>
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
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgb(var(--bleu-rgb) / 0.05)",border:"1px solid rgb(var(--bleu-rgb) / 0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"var(--bleu)",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"var(--bleu)",fontWeight:600}}>{f.titre||f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid var(--bordure)",background:"var(--carte-douce)",flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:"10px 20px",borderRadius:10,border:"1px solid var(--bordure-forte)",background:"var(--carte)",color:"var(--texte)",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
          <button className="ro-w" onClick={()=>{onClose();onEdit(data);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"var(--bleu-action)",color:"var(--sur-bleu)",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)"}}>
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
      // per_page large : les compteurs par niveau sont calculés sur la liste
      // complète (50 tronquait les fiches et faussait les « n/total »)
      const res=await fetch(`${API}/opportunites/potentialites?admin=true&per_page=1000`);
      const d=await res.json();
      setPots(d.data||[]);
    } finally{setPotsLoad(false);}
  },[]);

  const chargerAvgs = useCallback(async()=>{
    setAvgsLoad(true);
    try {
      // per_page large : les cards secteurs comptent sur la liste complète —
      // à 50, le Secteur primaire affichait 0/17 (fiches au-delà de la page 1)
      const p=new URLSearchParams({admin:"true",per_page:"1000"});
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
    if(!(await confirmer("Supprimer cette fiche ?")))return;
    setPotDel(id);
    await fetch(`${API}/opportunites/potentialites/${id}`,{method:"DELETE",headers:await authHeaders()});
    setPotDel(null);chargerPots();
  };
  const togglePot=async(p:any)=>{
    setPotToggle(p.id);
    await fetch(`${API}/opportunites/potentialites/${p.id}/toggle`,{method:"PATCH",headers:{"Content-Type":"application/json", ...(await authHeaders())},body:JSON.stringify({est_publie:!p.est_publie})});
    setPotToggle(null);chargerPots();
  };
  const deleteAvg=async(id:number)=>{
    if(!(await confirmer("Supprimer cet avantage ?")))return;
    setAvgDel(id);
    await fetch(`${API}/opportunites/avantages/${id}`,{method:"DELETE",headers:await authHeaders()});
    setAvgDel(null);chargerAvgs();
  };
  const toggleAvg=async(a:any)=>{
    setAvgToggle(a.id);
    await fetch(`${API}/opportunites/avantages/${a.id}/toggle`,{method:"PATCH",headers:{"Content-Type":"application/json", ...(await authHeaders())},body:JSON.stringify({est_publie:!a.est_publie})});
    setAvgToggle(null);chargerAvgs();
  };

  const openNewProjet = useRef<(() => void) | null>(null);

  const TABS=[
    {key:"projets",       label:"Banque de projets",      color:"var(--orange)"},
    {key:"potentialites", label:"Potentialités par zone",  color:"var(--vert)"},
    {key:"avantages",     label:"Avantages & incitations", color:"var(--vert-fonce)"},
  ] as const;

  const niveauBadge=(p:any)=>{
    if(p.pole_id)          return {label:p.pole_nom||"Pôle",            color:"var(--orange)"};
    if(p.region_id)        return {label:p.region_nom||"Région",        color:"var(--danger)"};
    if(p.departement_id)   return {label:p.departement_nom||"Dép.",     color:"var(--cyan)"};
    if(p.arrondissement_id)return {label:p.arrondissement_nom||"Arr.",  color:"var(--vert-fonce)"};
    return {label:"Global",color:"var(--gris-fort)"};
  };
  const potTitle = (p:any) => (p.titre||"")
    .replace(/^[Pp]otentialités?\s+(de\s+l[''']|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
    .replace(/^(.)/, (_:string,c:string) => c.toUpperCase());

  // Action principale du bandeau, propre à l'onglet affiché
  const actionOnglet = onglet==="projets"
    ? { label:"Nouveau projet",  onClick:()=>openNewProjet.current?.() }
    : onglet==="potentialites"
    ? { label:"Nouvelle fiche",  onClick:()=>{setPotEdit(null);setPotModal(true);} }
    : { label:"Nouvel avantage", onClick:()=>{setAvgEdit(null);setAvgModal(true);} };

  return (
    <div style={{fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Opportunités d'investissement" compact ton="orange" pleineLargeur
        droite={
          <button className="ro-w" onClick={actionOnglet.onClick}
            style={{display:"inline-flex",alignItems:"center",gap:8,background:"var(--carte)",color:"var(--orange)",fontWeight:700,fontSize:13,padding:"9px 18px",borderRadius:999,border:"none",cursor:"pointer",boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.16)",fontFamily:"var(--font-google-sans)",transition:"background 0.15s, transform 0.15s",flexShrink:0,whiteSpace:"nowrap" as const}}
            onMouseEnter={ev=>{ev.currentTarget.style.background="var(--orange-voile)";ev.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={ev=>{ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="none";}}>
            <Plus size={15}/> {actionOnglet.label}
          </button>
        }>
        <BarreTitreSegment
          options={TABS.map(t=>({
            v: t.key,
            l: t.label,
            count: t.key==="projets" ? projetsCount : t.key==="potentialites" ? pots.length : avgsTotal,
          }))}
          value={onglet} onChange={v=>setOnglet(v)} />
      </BarreTitre>

      <div style={{padding:"28px 40px 80px"}}>
      {onglet==="projets" && <BanqueProjets registerOpenNew={fn=>{ openNewProjet.current=fn; }}/>}

      {onglet==="potentialites" && (
        <div>
          {potsLoad ? (
            <SkeletonCards n={4} cols={4} height={190}/>
          ) : (
            <>
            {/* ── Sélecteur de niveau territorial (gabarit public) ── */}
            <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14}}>
              {NIVEAUX_POTS.map(n=>{
                const count = pots.filter((p:any)=>p.niveau===n.key).length;
                const total = n.key==="pole" ? poles.length
                  : n.key==="region" ? geoTotaux.regions
                  : n.key==="departement" ? geoTotaux.departements
                  : geoTotaux.arrondissements;
                const pct = total>0 ? Math.round(count/total*100) : 0;
                const actif = selectedNiveau===n.key;
                return (
                  // Clic = bascule : les fiches se déplient sous les cards
                  <div key={n.key} onClick={()=>count>0&&setSelectedNiveau(actif?null:n.key)}
                    style={{background:"var(--carte)",border:actif?`1.5px solid ${voile(n.color, 53)}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:actif?`0 4px 18px ${voile(n.color, 15)}`:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                    onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${voile(n.color, 53)}`;}}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=actif?`0 4px 18px ${voile(n.color, 15)}`:"none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=actif?`${voile(n.color, 53)}`:"rgb(var(--encre-rgb) / 0.12)";}}>

                    {/* Niveau */}
                    <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:n.color,flexShrink:0}}/>
                      <span style={{fontSize:10.5,fontWeight:800,color:n.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{n.label}</span>
                    </div>

                    {/* Compteur principal */}
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:"2rem",fontWeight:800,color:total>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{total||"—"}</span>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--gris)"}}>{n.unit}{total>1?"s":""}</span>
                    </div>

                    {/* Couverture des fiches */}
                    <div style={{marginTop:"auto"}}>
                      <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                        <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:n.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                      </div>
                      <p style={{fontSize:11,fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
                        {count>0
                          ? <>{count} fiche{count>1?"s":""} définie{count>1?"s":""}{total>0?<span style={{color:"var(--gris)",fontWeight:500}}> · {pct} %</span>:null}</>
                          : "Aucune fiche définie"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Fiches du niveau sélectionné, dépliées sous les cards ── */}
            {selectedNiveau!==null && (
              <div className="charge-in">
              {(()=>{
                const meta = NIVEAUX_POTS.find(x=>x.key===selectedNiveau)!;
                const items = pots.filter((p:any)=>p.niveau===selectedNiveau);
                const bandeauNiveau = (
                  <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",margin:"26px 0 14px",borderRadius:16,
                    background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                    border:`1px solid ${voile(meta.color, 13)}`}}>
                    <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                      <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{items.length}</span>
                    </div>
                    <div style={{minWidth:0,flex:1}}>
                      <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Niveau territorial</p>
                      <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{meta.label}</div>
                    </div>
                  </div>
                );
                if (items.length===0) return <>{bandeauNiveau}<div style={{textAlign:"center",padding:"40px 0",color:"var(--gris)"}}><p style={{fontSize:13}}>Aucune fiche</p></div></>;

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
                // Regroupement des fiches par rattachement territorial
                const groupeDe = (p:any): string => selectedNiveau==="pole" ? meta.label
                  : selectedNiveau==="region" ? (poleDeRegion(p.region_nom||"") || "Autres")
                  : selectedNiveau==="departement" ? (p.region_nom || regionDuDept(p.departement_nom||"") || "Autres")
                  : (p.departement_nom || deptDeArr(p.arrondissement_nom||"") || "Autres");
                const rattachement = selectedNiveau==="region" ? "Pôle" : selectedNiveau==="departement" ? "Région" : "Département";
                const groupes = new Map<string, any[]>();
                items.forEach((p:any)=>{ const k=groupeDe(p); if(!groupes.has(k)) groupes.set(k,[]); groupes.get(k)!.push(p); });
                const cles = Array.from(groupes.keys()).sort((a,b)=>a.localeCompare(b,"fr"));

                // Tuile compacte (gabarit public) + actions d'administration
                const Tuile = ({p}:{p:any}) => {
                  const nbActs = (p.activite_ids||[]).length;
                  return (
                    <div onClick={()=>setPotVue(p)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0,opacity:p.est_publie===false?0.7:1}}
                      onMouseEnter={ev=>{
                        ev.currentTarget.style.borderColor=`${voile(meta.color, 33)}`;ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-2)";
                        // Nom trop long : glisse pour révéler la fin
                        const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                        const span = box?.firstElementChild as HTMLElement | null;
                        if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                      }}
                      onMouseLeave={ev=>{
                        ev.currentTarget.style.borderColor="var(--bordure)";ev.currentTarget.style.background="var(--carte-douce)";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                        const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                        if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                      }}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                      <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                        <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                      </div>
                      {nbActs>0&&<span style={{fontSize:10.5,fontWeight:700,color:"var(--gris)",flexShrink:0,whiteSpace:"nowrap" as const}}>{nbActs} activité{nbActs>1?"s":""}</span>}
                      {/* Actions d'administration */}
                      <div className="ro-w" style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}} onClick={ev=>ev.stopPropagation()}>
                        <button onClick={()=>{setPotEdit(p);setPotModal(true);}} title="Modifier"
                          style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgb(var(--bleu-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}
                          onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.14)"}
                          onMouseLeave={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.07)"}>
                          <Pencil size={12} style={{color:"var(--bleu)"}}/>
                        </button>
                        <button onClick={()=>togglePot(p)} disabled={potToggle===p.id} title={p.est_publie?"Retirer de la page publique":"Publier"}
                          style={{display:"flex",alignItems:"center",justifyContent:"center",background:p.est_publie?"rgb(var(--vert-rgb) / 0.07)":"rgb(var(--orange-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}>
                          {potToggle===p.id
                            ? <Loader2 size={12} style={{animation:"spin 1s linear infinite",color:"var(--gris)"}}/>
                            : p.est_publie ? <EyeOff size={12} style={{color:"var(--vert)"}}/> : <Eye size={12} style={{color:"var(--orange)"}}/>}
                        </button>
                        <button onClick={()=>deletePot(p.id)} disabled={potDel===p.id} title="Supprimer"
                          style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgb(var(--danger-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}
                          onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.14)"}
                          onMouseLeave={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.07)"}>
                          {potDel===p.id?<Loader2 size={12} style={{color:"var(--danger)",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"var(--danger)"}}/>}
                        </button>
                      </div>
                    </div>
                  );
                };

                // Pôles : pas de regroupement pertinent → conteneur sans en-tête
                if (selectedNiveau==="pole") return (
                  <>
                  {bandeauNiveau}
                  <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:16}}>
                      {items.map((p:any)=><Tuile key={p.id} p={p}/>)}
                    </div>
                  </div>
                  </>
                );
                // Autres niveaux : un bandeau de rattachement par groupe
                return (
                  <div style={{marginTop:26,display:"flex",flexDirection:"column" as const,gap:22}}>
                    {cles.map(cle=>{
                      const fiches = groupes.get(cle)!;
                      return (
                        <div key={cle}>
                          {/* Bandeau du rattachement territorial */}
                          <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:16,
                            background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                            border:`1px solid ${voile(meta.color, 13)}`}}>
                            <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                              <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{fiches.length}</span>
                            </div>
                            <div style={{minWidth:0,flex:1}}>
                              <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>{rattachement}</p>
                              <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{cle}</div>
                            </div>
                          </div>
                          {/* Fiches du groupe */}
                          <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:16}}>
                              {fiches.map((p:any)=><Tuile key={p.id} p={p}/>)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            )}
            </>
          )}
          <PotentialiteModal open={potModal} onClose={()=>setPotModal(false)} edit={potEdit} poles={poles} onSaved={chargerPots}/>
          {potVue && <PotentialiteVueModal pot={potVue} onClose={()=>setPotVue(null)} onEdit={p=>{ setPotVue(null); setPotEdit(p); setPotModal(true); }}/>}
        </div>
      )}

      {onglet==="avantages" && (
        <div>
          {avgsLoad ? (
            <SkeletonCards n={3} cols={3} height={190}/>
          ) : avgs.length===0 ? (
            <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
              <Award size={48} style={{marginBottom:16,opacity:0.3}}/>
              <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun avantage enregistré</p>
              <p style={{fontSize:14,marginTop:6}}>Cliquez sur « Nouvel avantage » pour commencer.</p>
            </div>
          ) : (
            <>
            {/* ── Sélecteur de secteur (gabarit public) ── */}
            <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>
              {SECTEURS_AVGS.map(s=>{
                const count = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(s.key)).length;
                const sec = refSecteurs.find((r:any)=>r.nom.toLowerCase().includes(s.key));
                const branches = sec ? refBranches.filter((b:any)=>b.secteur_id===sec.id) : [];
                const branchIds = new Set(branches.map((b:any)=>b.id));
                const actCount = refActivites.filter((a:any)=>branchIds.has(a.branche_id)).length;
                const pct = actCount>0 ? Math.round(count/actCount*100) : 0;
                const actif = selectedSec===s.key;
                return (
                  // Clic = bascule : les branches se déplient sous les cards
                  <div key={s.key} onClick={()=>count>0&&setSelectedSec(actif?null:s.key)}
                    style={{background:"var(--carte)",border:actif?`1.5px solid ${voile(s.color, 53)}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:actif?`0 4px 18px ${voile(s.color, 15)}`:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                    onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${voile(s.color, 53)}`;}}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=actif?`0 4px 18px ${voile(s.color, 15)}`:"none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=actif?`${voile(s.color, 53)}`:"rgb(var(--encre-rgb) / 0.12)";}}>

                    {/* Secteur */}
                    <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                      <span style={{fontSize:10.5,fontWeight:800,color:s.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{s.label}</span>
                    </div>

                    {/* Compteur principal */}
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:"2rem",fontWeight:800,color:actCount>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{actCount||"—"}</span>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--gris)"}}>activité{actCount>1?"s":""}</span>
                    </div>

                    {/* Couverture des avantages */}
                    <div style={{marginTop:"auto"}}>
                      <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                        <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:s.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                      </div>
                      <p style={{fontSize:11,fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
                        {count>0
                          ? <>{count} avantage{count>1?"s":""} défini{count>1?"s":""}{actCount>0?<span style={{color:"var(--gris)",fontWeight:500}}> · {pct} %</span>:null}</>
                          : "Aucun avantage défini"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Branches du secteur sélectionné, dépliées sous les cards ── */}
            {selectedSec!==null && (
              <div className="charge-in">
              {(()=>{
                const meta = SECTEURS_AVGS.find(x=>x.key===selectedSec)!;
                const filtered = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(selectedSec!));
                const braMap = new Map<number,{id:number;nom:string;items:any[]}>();
                filtered.forEach((a:any)=>{
                  const bid=a.branche_id||0;
                  if(!braMap.has(bid)) braMap.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
                  braMap.get(bid)!.items.push(a);
                });
                const bras=Array.from(braMap.values()).sort((a,b)=>a.nom.localeCompare(b.nom,"fr"));
                return (
                  <div style={{marginTop:26,display:"flex",flexDirection:"column" as const,gap:22}}>
                    {bras.map(bra=>(
                      <div key={bra.id}>
                        {/* Bandeau de la branche */}
                        <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:16,
                          background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                          border:`1px solid ${voile(meta.color, 13)}`}}>
                          <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                            <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{bra.items.length}</span>
                          </div>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Branche</p>
                            <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</div>
                          </div>
                        </div>
                        {/* Activités de la branche */}
                        <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
                          <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSec==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                            {bra.items.map((a:any)=>(
                              <div key={a.id} onClick={()=>setAvgVue(a)}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0,opacity:a.est_publie===false?0.7:1}}
                                onMouseEnter={ev=>{
                                  ev.currentTarget.style.borderColor=`${voile(meta.color, 33)}`;ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-2)";
                                  // Nom trop long : glisse pour révéler la fin
                                  const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                  const span = box?.firstElementChild as HTMLElement | null;
                                  if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                }}
                                onMouseLeave={ev=>{
                                  ev.currentTarget.style.borderColor="var(--bordure)";ev.currentTarget.style.background="var(--carte-douce)";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                  const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                  if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                }}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                                <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{a.activite_nom}</span>
                                </div>
                                {/* Actions d'administration */}
                                <div className="ro-w" style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}} onClick={ev=>ev.stopPropagation()}>
                                  <button onClick={()=>{setAvgEdit(a);setAvgModal(true);}} title="Modifier"
                                    style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgb(var(--bleu-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}
                                    onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.14)"}
                                    onMouseLeave={ev=>ev.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.07)"}>
                                    <Pencil size={12} style={{color:"var(--bleu)"}}/>
                                  </button>
                                  <button onClick={()=>toggleAvg(a)} disabled={avgToggle===a.id} title={a.est_publie?"Retirer de la page publique":"Publier"}
                                    style={{display:"flex",alignItems:"center",justifyContent:"center",background:a.est_publie?"rgb(var(--vert-rgb) / 0.07)":"rgb(var(--orange-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}>
                                    {avgToggle===a.id
                                      ? <Loader2 size={12} style={{animation:"spin 1s linear infinite",color:"var(--gris)"}}/>
                                      : a.est_publie ? <EyeOff size={12} style={{color:"var(--vert)"}}/> : <Eye size={12} style={{color:"var(--orange)"}}/>}
                                  </button>
                                  <button onClick={()=>deleteAvg(a.id)} disabled={avgDel===a.id} title="Supprimer"
                                    style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgb(var(--danger-rgb) / 0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 7px",transition:"background 0.15s"}}
                                    onMouseEnter={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.14)"}
                                    onMouseLeave={ev=>ev.currentTarget.style.background="rgb(var(--danger-rgb) / 0.07)"}>
                                    {avgDel===a.id?<Loader2 size={12} style={{color:"var(--danger)",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"var(--danger)"}}/>}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              </div>
            )}
            </>
          )}

          <AvantageModal open={avgModal} onClose={()=>setAvgModal(false)} edit={avgEdit} onSaved={chargerAvgs}/>
          {avgVue&&<AvantageVueModal avg={avgVue} onClose={()=>setAvgVue(null)} onEdit={a=>{setAvgVue(null);setAvgEdit(a);setAvgModal(true);}} onSaved={chargerAvgs}/>}
        </div>
      )}
      </div>
    </div>
  );
}
