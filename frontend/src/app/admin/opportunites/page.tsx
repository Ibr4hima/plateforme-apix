"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Search, Eye, EyeOff, Upload, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
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

const CATEGORIES_META: { key:string; label:string; color:string; emoji:string }[] = [
  { key:"ressources_naturelles",    label:"Ressources naturelles",       color:"#059669", emoji:"" },
  { key:"infrastructure",           label:"Infrastructure",              color:"#0891b2", emoji:"" },
  { key:"demographie",              label:"Démographie & main d'œuvre",  color:"#7c3aed", emoji:"" },
  { key:"atouts_economiques",       label:"Atouts économiques",          color:"#ca631f", emoji:"" },
  { key:"environnement_affaires",   label:"Environnement des affaires",  color:"#d97706", emoji:"" },
  { key:"localisation_strategique", label:"Localisation stratégique",    color:"#E35336", emoji:"" },
];

const TYPES_AVANTAGE = [
  { value:"fiscal",        label:"Fiscal",        color:"#0891b2" },
  { value:"douanier",      label:"Douanier",       color:"#7c3aed" },
  { value:"foncier",       label:"Foncier",        color:"#ca631f" },
  { value:"financier",     label:"Financier",      color:"#059669" },
  { value:"administratif", label:"Administratif",  color:"#d97706" },
  { value:"autre",         label:"Autre",          color:"#6b7280" },
];
const typeColor = (t:string) => TYPES_AVANTAGE.find(x=>x.value===t)?.color||"#6b7280";
const typeLabel = (t:string) => TYPES_AVANTAGE.find(x=>x.value===t)?.label||t;

const CAT_COLORS = ["#059669","#0891b2","#7c3aed","#ca631f","#d97706","#E35336","#004f91","#188038"];

// ── Checkboxes par catégorie ───────────────────────────────────────────────────
function CategorieCheckboxes({ catId, catLabel, catColor, avantages, selected, onChange }:
  { catId:number; catLabel:string; catColor:string; avantages:any[]; selected:number[]; onChange:(ids:number[])=>void }) {
  const [open, setOpen] = useState(false);
  const items = avantages.filter((a:any)=>a.categorie_id===catId && a.actif);
  const selCount = items.filter(i=>selected.includes(i.id)).length;

  const toggle = (id:number) => {
    if (selected.includes(id)) onChange(selected.filter(x=>x!==id));
    else onChange([...selected, id]);
  };

  return (
    <div style={{ border:"1px solid #E8E5E3", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:"#F8F7F6", border:"none", cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
        <span style={{ flex:1, fontSize:13, fontWeight:600, color:"#1a1a2e", textAlign:"left" as const }}>{catLabel}</span>
        {selCount > 0 && (
          <span style={{ fontSize:11, fontWeight:700, color:catColor, background:`${catColor}15`, padding:"2px 8px", borderRadius:99 }}>
            {selCount} sélectionné{selCount>1?"s":""}
          </span>
        )}
        {open ? <ChevronUp size={14} style={{color:"#9aa5b4"}}/> : <ChevronDown size={14} style={{color:"#9aa5b4"}}/>}
      </button>

      {open && (
        <div style={{ padding:"10px 14px 12px", display:"flex", flexWrap:"wrap" as const, gap:6 }}>
          {items.length === 0 ? (
            <p style={{ fontSize:12, color:"#9aa5b4" }}>Aucun avantage dans cette catégorie</p>
          ) : items.map((item:any) => {
            const sel = selected.includes(item.id);
            return (
              <button key={item.id} onClick={()=>toggle(item.id)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:99, border:`1.5px solid ${sel?catColor:"#E8E5E3"}`, background:sel?`${catColor}12`:"#fff", cursor:"pointer", fontSize:12, color:sel?catColor:"#4a5568", fontWeight:sel?600:400, fontFamily:"var(--font-google-sans)", transition:"all 0.12s" }}>
                {sel && <Check size={10} strokeWidth={3}/>}
                {item.libelle}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Modal Potentialité
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_POT: any = {
  niveau:"pole",
  pole_id:"", region_id:"", departement_id:"", arrondissement_id:"",
  secteur_ids:[], branche_ids:[], activite_ids:[],
  avantage_ids:[],
  autres:"",
  est_publie: true,
};

function PotentialiteModal({ open, onClose, edit, poles, avantages, categories, onSaved }:
  { open:boolean; onClose:()=>void; edit:any; poles:any[]; avantages:any[]; categories:any[]; onSaved:()=>void }) {
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
        avantage_ids: edit.avantage_ids||[],
        autres: edit.autres||"",
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
        avantage_ids: form.avantage_ids,
        autres: form.autres||null,
        // Champs de texte legacy — on ne les utilise plus mais on les reset
        ressources_naturelles: null, infrastructure: null,
        demographie: null, atouts_economiques: null, contraintes: null,
        pole_id: null, region_id: null, departement_id: null, arrondissement_id: null,
      };
      if (form.niveau==="pole")           payload.pole_id           = form.pole_id||null;
      if (form.niveau==="region")         payload.region_id         = form.region_id||null;
      if (form.niveau==="departement")    payload.departement_id    = form.departement_id||null;
      if (form.niveau==="arrondissement") payload.arrondissement_id = form.arrondissement_id||null;

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

  if (!open) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FAFAF9", borderRadius:20, width:"100%", maxWidth:800, maxHeight:"92vh", overflowY:"auto", border:"1px solid #C5BFBB", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ height:4, background:"linear-gradient(90deg,#059669,#34d399)", borderRadius:"20px 20px 0 0" }}/>
        <div style={{ padding:"24px 32px 32px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.15rem", color:"#1a1a2e" }}>
              {edit ? "Modifier la fiche" : "Nouvelle fiche de potentialités"}
            </h2>
            <button onClick={onClose} style={{ background:"#F2F0EF", border:"none", cursor:"pointer", borderRadius:8, padding:7 }}><X size={15} color="#4a5568"/></button>
          </div>

          {/* Zone géographique — titre fixe en mode édition, sélection en mode création */}
          {edit ? (
            <div style={{ marginBottom:22, padding:"14px 18px", background:"rgba(5,150,105,0.05)", border:"1px solid rgba(5,150,105,0.2)", borderRadius:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#059669", textTransform:"uppercase" as const, letterSpacing:"0.12em", marginBottom:6 }}>Fiche de potentialités</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#1a1a2e" }}>{titreAuto() || edit.titre}</div>
            </div>
          ) : (
            <div style={{ marginBottom:22 }}>
              <p style={SEC}>Zone géographique</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
                {NIVEAUX.map(n=>(
                  <button key={n.value} onClick={()=>{ upd("niveau",n.value); upd("pole_id",""); upd("region_id",""); upd("departement_id",""); upd("arrondissement_id",""); }}
                    style={{ padding:"9px 6px", borderRadius:9, border:`2px solid ${form.niveau===n.value?"#059669":"#C5BFBB"}`, background:form.niveau===n.value?"rgba(5,150,105,0.06)":"#fff", color:form.niveau===n.value?"#059669":"#4a5568", fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
                    {n.label}
                  </button>
                ))}
              </div>
              {form.niveau==="pole" && (
                <div>
                  <select value={form.pole_id||""} onChange={e=>upd("pole_id",e.target.value?parseInt(e.target.value):"")} style={IS}>
                    <option value="">— Sélectionner un pôle —</option>
                    {poles.filter((p:any)=>!usedGeo.pole_ids.includes(p.id)).map((p:any)=><option key={p.id} value={p.id}>{p.pole_territoire}</option>)}
                  </select>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div><label style={LS}>Région</label>
                    <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); }} />
                  </div>
                  <div><label style={LS}>Département</label>
                    <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>upd("departement_id",v)} />
                  </div>
                </div>
              )}
              {form.niveau==="arrondissement" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  <div><label style={LS}>Région</label>
                    <RegionSelect value={form.region_id} onChange={v=>{ upd("region_id",v); upd("departement_id",""); upd("arrondissement_id",""); }} />
                  </div>
                  <div><label style={LS}>Département</label>
                    <DepartementSelect regionId={form.region_id} value={form.departement_id} onChange={v=>{ upd("departement_id",v); upd("arrondissement_id",""); }} />
                  </div>
                  <div><label style={LS}>Arrondissement</label>
                    <ArrondissementSelect departementId={form.departement_id} value={form.arrondissement_id} onChange={v=>upd("arrondissement_id",v)} />
                  </div>
                </div>
              )}
              {(form.pole_id || form.region_id || form.departement_id || form.arrondissement_id) && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(5,150,105,0.06)", border:"1px solid rgba(5,150,105,0.2)", borderRadius:8, fontSize:12, color:"#059669", fontWeight:500 }}>
                  Titre généré : <strong>{titreAuto()}</strong>
                </div>
              )}
            </div>
          )}

          {/* Activités porteuses */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Activités porteuses</p>
            <NaemaSelect
              secteurIds={form.secteur_ids} brancheIds={form.branche_ids} activiteIds={form.activite_ids}
              onChangeSecteurs={ids=>upd("secteur_ids",ids)}
              onChangeBranches={ids=>upd("branche_ids",ids)}
              onChangeActivites={ids=>upd("activite_ids",ids)}
            />
          </div>

          {/* Détails — checkboxes par catégorie */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Détails</p>
            {categories.filter((c:any)=>c.actif).map((cat:any, idx:number)=>(
              <CategorieCheckboxes
                key={cat.id}
                catId={cat.id} catLabel={cat.libelle} catColor={CAT_COLORS[idx % CAT_COLORS.length]}
                avantages={avantages}
                selected={form.avantage_ids}
                onChange={ids=>upd("avantage_ids",ids)}
              />
            ))}
            {/* Champ libre complémentaire */}
            <div style={{ marginTop:10 }}>
              <label style={LS}>Informations complémentaires (optionnel)</label>
              <textarea value={form.autres} onChange={e=>upd("autres",e.target.value)} rows={2}
                placeholder="Tout autre élément pertinent pour un investisseur…"
                style={{...IS, resize:"vertical" as const}} />
            </div>
          </div>

          {/* Documents PDF */}
          <div style={{ marginBottom:22 }}>
            <p style={SEC}>Documents PDF</p>
            {fichiers.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6, marginBottom:8 }}>
                {fichiers.map((f:any)=>(
                  <div key={f.id} style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                    <a href={`${API}/opportunites/potentialites/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(5,150,105,0.06)", border:"1px solid rgba(5,150,105,0.2)", borderRadius:7, padding:"4px 10px", fontSize:11, color:"#059669", textDecoration:"none", fontWeight:500 }}>
                      <FileText size={11}/> {f.titre||f.fichier_nom}
                    </a>
                    <button onClick={async()=>{
                      if (edit?.id) await fetch(`${API}/opportunites/potentialites/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                      setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                    }} style={{ background:"rgba(220,38,38,0.08)", border:"none", cursor:"pointer", borderRadius:5, padding:"3px 5px", display:"flex", alignItems:"center" }}>
                      <X size={10} style={{color:"#dc2626"}}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pdfQueue.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5, marginBottom:8 }}>
                {pdfQueue.map((p,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(124,58,237,0.05)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:8, padding:"7px 12px" }}>
                    <FileText size={13} style={{color:"#7c3aed",flexShrink:0}}/>
                    <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                      placeholder="Titre du document" style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid rgba(124,58,237,0.3)", outline:"none", fontSize:12, padding:"2px 0", fontFamily:"var(--font-google-sans)" }}/>
                    <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <X size={13} style={{color:"#dc2626"}}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:8, cursor:"pointer", border:"2px dashed #C5BFBB", background:"#F2F0EF" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#059669"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#C5BFBB"}>
              <Upload size={14} color="#9aa5b4"/>
              <span style={{ fontSize:13, color:"#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display:"none" }} onChange={e=>{
                const files = Array.from(e.target.files||[]);
                setPdfQueue(prev=>[...prev, ...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
                e.target.value="";
              }}/>
            </label>
          </div>

          {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #C5BFBB", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:ok?"#059669":"#059669", color:"#fff", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontSize:13 }}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>Enregistrement…</>
               :ok?<><Check size={14}/>Enregistré!</>
               :<><Check size={14}/>{edit?"Modifier":"Créer"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Modal Avantage & Incitation
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_AVG: any = {
  secteur_id: null, branche_id: null, activite_id: null,
  commentaire_global: "", est_publie: true, selections: [],
};

function AvantageModal({ open, onClose, edit, onSaved }:
  { open:boolean; onClose:()=>void; edit:any; onSaved:()=>void }) {
  const [form,        setForm]        = useState<any>({...EMPTY_AVG});
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [branches,    setBranches]    = useState<any[]>([]);
  const [activites,   setActivites]   = useState<any[]>([]);
  const [refCats,     setRefCats]     = useState<any[]>([]); // types d'avantages (Foncier, Fiscal...)
  const [usedActivites,setUsedActivites]=useState<number[]>([]);
  const [fichiers,    setFichiers]    = useState<any[]>([]);
  const [pdfQueue,    setPdfQueue]    = useState<{file:File;titre:string}[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [ok,          setOk]          = useState(false);

  const upd = (k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));

  useEffect(()=>{
    fetch(`${API}/entreprises/ref/secteurs`).then(r=>r.json()).then(setSecteurs).catch(()=>{});
    fetch(`${API}/ref-avantages`).then(r=>r.json()).then(setRefCats).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!form.secteur_id){setBranches([]);setActivites([]);upd("branche_id",null);upd("activite_id",null);return;}
    fetch(`${API}/entreprises/ref/branches?secteur_id=${form.secteur_id}`).then(r=>r.json()).then(setBranches).catch(()=>{});
    upd("branche_id",null);upd("activite_id",null);setActivites([]);
  },[form.secteur_id]);

  useEffect(()=>{
    if (!form.branche_id){setActivites([]);upd("activite_id",null);return;}
    fetch(`${API}/entreprises/ref/activites?branche_id=${form.branche_id}`).then(r=>r.json()).then(setActivites).catch(()=>{});
    upd("activite_id",null);
  },[form.branche_id]);

  useEffect(()=>{
    if (!open) return;
    if (!edit){
      fetch(`${API}/opportunites/avantages/used-activites`).then(r=>r.json()).then(d=>setUsedActivites(d.activite_ids||[])).catch(()=>{});
    }
    if (edit){
      setForm({
        secteur_id: edit.secteur_id||null, branche_id: edit.branche_id||null,
        activite_id: edit.activite_id||null,
        commentaire_global: edit.avantages||"",
        selections: (edit.selections||[]).map((s:any)=>({item_id:s.type_id,commentaire:s.commentaire||""})),
        est_publie: edit.est_publie??true,
      });
      fetch(`${API}/opportunites/avantages/${edit.id}`)
        .then(r=>r.json()).then(d=>setFichiers(d.fichiers||[])).catch(()=>{});
    } else { setForm({...EMPTY_AVG}); setFichiers([]); }
    setPdfQueue([]); setError(""); setOk(false);
  },[open, edit]);

  // Toggle sélection item
  const toggleItem = (itemId:number) => {
    setForm((f:any)=>{
      const exists = f.selections.find((s:any)=>s.item_id===itemId);
      if (exists) return {...f, selections: f.selections.filter((s:any)=>s.item_id!==itemId)};
      return {...f, selections: [...f.selections, {item_id:itemId, commentaire:""}]};
    });
  };
  const setCommentaire = (itemId:number, val:string) => {
    setForm((f:any)=>({...f, selections: f.selections.map((s:any)=>s.item_id===itemId?{...s,commentaire:val}:s)}));
  };
  const isSelected = (itemId:number) => form.selections.some((s:any)=>s.item_id===itemId);
  const getCommentaire = (itemId:number) => form.selections.find((s:any)=>s.item_id===itemId)?.commentaire||"";

  const handleSave = async () => {
    if (!form.activite_id && !edit){setError("Veuillez sélectionner une activité");return;}
    if (!edit && usedActivites.includes(form.activite_id)){setError("Des avantages existent déjà pour cette activité.");return;}
    setSaving(true);setError("");
    try {
      const url=edit?`${API}/opportunites/avantages/${edit.id}`:`${API}/opportunites/avantages`;
      const method=edit?"PATCH":"POST";
      const payload = {
        ...form,
        activite_id: form.activite_id || edit?.activite_id,
        secteur_id: form.secteur_id || edit?.secteur_id,
        branche_id: form.branche_id || edit?.branche_id,
        selections: form.selections.map((s:any)=>({type_id: s.item_id, commentaire: s.commentaire||null}))
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

  const IS:any={background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",width:"100%",boxSizing:"border-box" as const,fontFamily:"var(--font-google-sans)"};
  const LS:any={fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:5,display:"block"};
  const SEC:any={fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #E8E5E3"};


  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e"}}>{edit?"Modifier":"Nouvel avantage / incitation"}</h2>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>

          {/* Activité NAEMA */}
          {edit ? (
            <div style={{marginBottom:22,padding:"14px 18px",background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"#7c3aed",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:8}}>Activité NAEMA</div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                {edit.secteur_nom&&<span style={{fontSize:11,fontWeight:600,color:"#9aa5b4",background:"#F2F0EF",padding:"3px 10px",borderRadius:99}}>{edit.secteur_nom}</span>}
                {edit.branche_nom&&<><span style={{fontSize:11,color:"#C5BFBB"}}>›</span><span style={{fontSize:11,fontWeight:600,color:"#9aa5b4",background:"#F2F0EF",padding:"3px 10px",borderRadius:99}}>{edit.branche_nom}</span></>}
                {edit.activite_nom&&<><span style={{fontSize:11,color:"#C5BFBB"}}>›</span><span style={{fontSize:12,fontWeight:700,color:"#7c3aed",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.25)",padding:"4px 12px",borderRadius:99}}>{edit.activite_nom}</span></>}
              </div>
            </div>
          ) : (
            <div style={{marginBottom:22}}>
              <p style={SEC}>Activité NAEMA</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                <div><label style={LS}>Secteur</label>
                  <select value={form.secteur_id||""} onChange={e=>upd("secteur_id",e.target.value?parseInt(e.target.value):null)} style={IS}>
                    <option value="">— Sélectionner —</option>
                    {secteurs.map((s:any)=><option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                {branches.length>0&&<div><label style={LS}>Branche</label>
                  <select value={form.branche_id||""} onChange={e=>upd("branche_id",e.target.value?parseInt(e.target.value):null)} style={IS}>
                    <option value="">— Sélectionner —</option>
                    {branches.map((b:any)=><option key={b.id} value={b.id}>{b.nom}</option>)}
                  </select>
                </div>}
                {activites.length>0&&<div><label style={LS}>Activité *</label>
                  <select value={form.activite_id||""} onChange={e=>upd("activite_id",e.target.value?parseInt(e.target.value):null)} style={{...IS,borderColor:!form.activite_id?"#C5BFBB":"#7c3aed"}}>
                    <option value="">— Sélectionner —</option>
                    {activites.filter((a:any)=>!usedActivites.includes(a.id)).map((a:any)=><option key={a.id} value={a.id}>{a.nom}</option>)}
                  </select>
                  {activites.filter((a:any)=>usedActivites.includes(a.id)).length>0&&<p style={{fontSize:11,color:"#9aa5b4",marginTop:4}}>{activites.filter((a:any)=>usedActivites.includes(a.id)).length} activité(s) déjà définie(s)</p>}
                </div>}
              </div>
            </div>
          )}

          {/* Types d'avantages — liste plate */}
          <div style={{marginBottom:22}}>
            <p style={SEC}>Avantages & incitations</p>
            {refCats.filter((t:any)=>t.actif).length===0 ? (
              <p style={{fontSize:13,color:"#9aa5b4",fontStyle:"italic"}}>Aucun type d'avantage — ajoutez-en dans la page Référentiels.</p>
            ) : (
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {refCats.filter((t:any)=>t.actif).map((type:any)=>{
                  const sel = isSelected(type.id);
                  return (
                    <div key={type.id} style={{background:sel?"rgba(124,58,237,0.04)":"#fff",border:`1px solid ${sel?"rgba(124,58,237,0.2)":"#E8E5E3"}`,borderRadius:10,padding:"10px 14px",transition:"all 0.15s"}}>
                      <button onClick={()=>toggleItem(type.id)}
                        style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const,padding:0}}>
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${sel?"#7c3aed":"#C5BFBB"}`,background:sel?"#7c3aed":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                          {sel&&<svg width="10" height="8" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{fontSize:13,fontWeight:sel?700:500,color:sel?"#7c3aed":"#4a5568"}}>{type.libelle}</span>
                      </button>
                      {sel&&(
                        <div style={{marginTop:10,marginLeft:28}}>
                          <textarea value={getCommentaire(type.id)} onChange={e=>setCommentaire(type.id,e.target.value)}
                            rows={2} placeholder={`Précisions sur l'avantage ${type.libelle.toLowerCase()}…`}
                            style={{...IS,fontSize:12,resize:"vertical" as const,lineHeight:"1.6",color:"#4a5568"}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documents PDF */}
          <div style={{marginBottom:22}}>
            <p style={SEC}>Documents PDF</p>
            {fichiers.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
                {fichiers.map((f:any)=>(
                  <div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <a href={`${API}/opportunites/avantages/${edit?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#7c3aed",textDecoration:"none",fontWeight:500}}>
                      <FileText size={11}/> {f.titre||f.fichier_nom}
                    </a>
                    <button onClick={async()=>{
                      if(edit?.id) await fetch(`${API}/opportunites/avantages/${edit.id}/fichiers/${f.id}`,{method:"DELETE"});
                      setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id));
                    }} style={{background:"rgba(220,38,38,0.08)",border:"none",cursor:"pointer",borderRadius:5,padding:"3px 5px",display:"flex",alignItems:"center"}}>
                      <X size={10} style={{color:"#dc2626"}}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pdfQueue.length>0&&(
              <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:8}}>
                {pdfQueue.map((p,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:8,padding:"7px 12px"}}>
                    <FileText size={13} style={{color:"#7c3aed",flexShrink:0}}/>
                    <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                      placeholder="Titre du document" style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(124,58,237,0.3)",outline:"none",fontSize:12,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                    <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
                      <X size={13} style={{color:"#dc2626"}}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:8,cursor:"pointer",border:"2px dashed #C5BFBB",background:"#F2F0EF"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#7c3aed";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#C5BFBB";}}>
              <Upload size={14} color="#9aa5b4"/>
              <span style={{fontSize:13,color:"#9aa5b4"}}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>{
                const files=Array.from(e.target.files||[]);
                setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
                e.target.value="";
              }}/>
            </label>
          </div>

          {/* Commentaire global */}
          <div style={{marginBottom:22}}>
            <p style={SEC}>Commentaire global <span style={{fontSize:10,fontWeight:400,color:"#9aa5b4",textTransform:"none",letterSpacing:0}}>(optionnel)</span></p>
            <textarea value={form.commentaire_global} onChange={e=>upd("commentaire_global",e.target.value)} rows={4}
              placeholder="Contexte général, précisions complémentaires, conditions particulières…"
              style={{...IS,resize:"vertical" as const,lineHeight:"1.6"}}/>
          </div>

          {error&&<p style={{fontSize:12,color:"#dc2626",marginBottom:12}}>{error}</p>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Annuler</button>
            <button onClick={handleSave} disabled={saving||ok}
              style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:ok?"#059669":"#7c3aed",color:"#fff",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontSize:13}}>
              {saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>Enregistrement…</>:ok?<><Check size={14}/>Enregistré!</>:<><Check size={14}/>{edit?"Modifier":"Créer"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant accordéon avantages groupés par secteur → branche → activité
// ══════════════════════════════════════════════════════════════════════════════

const SECTEUR_COLORS = ["#ca631f","#004f91","#059669","#7c3aed","#0891b2","#d97706","#E35336","#188038"];

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
      {secteurs.map((sec, si) => {
        const color = SECTEUR_COLORS[si % SECTEUR_COLORS.length];
        return (
          <div key={sec.id}>
            {/* Header secteur */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:20,borderRadius:2,background:color,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:700,color,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{sec.nom}</span>
              <span style={{fontSize:11,color:"#9aa5b4"}}>({sec.items.length} fiche{sec.items.length>1?"s":""})</span>
            </div>
            {/* Grille de cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
              {sec.items.map((a:any) => (
                <div key={a.id} onClick={()=>onVue(a)}
                  style={{background:"#fff",borderTop:"1px solid #E8E5E3",borderRight:"1px solid #E8E5E3",borderBottom:"1px solid #E8E5E3",borderLeft:`3px solid ${a.est_publie?color:"#C5BFBB"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                  onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${color}18`;ev.currentTarget.style.borderTopColor=`${color}50`;ev.currentTarget.style.borderRightColor=`${color}50`;ev.currentTarget.style.borderBottomColor=`${color}50`;}}
                  onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderTopColor="#E8E5E3";ev.currentTarget.style.borderRightColor="#E8E5E3";ev.currentTarget.style.borderBottomColor="#E8E5E3";}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:3,lineHeight:1.35,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{a.activite_nom||"Activité non définie"}</div>
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
function PotentialiteVueModal({ pot: p, refAvantages, onClose, onEdit }: {
  pot:any; refAvantages:any[]; onClose:()=>void; onEdit:(p:any)=>void;
}) {
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
  const CAT_COLORS: Record<string,string> = {
    "Ressources naturelles":"#059669","Infrastructure":"#0891b2",
    "Démographie":"#7c3aed","Atouts économiques":"#ca631f",
    "Environnement des affaires":"#d97706","Localisation stratégique":"#E35336",
  };
  const avantagesSelected = refAvantages.filter(a=>(p.avantage_ids||[]).includes(a.id));
  const catMap: Record<string,string[]> = {};
  avantagesSelected.forEach((a:any) => {
    const cat = a.categorie_libelle || "Autres";
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(a.libelle);
  });
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#059669,#34d399)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{p.titre}</h2>
              <span style={{fontSize:11,fontWeight:700,color:p.est_publie?"#15803d":"#9aa5b4",background:p.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{p.est_publie?"Public":"Non publié"}</span>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {Object.keys(catMap).length>0&&(
            <div style={{marginBottom:18}}>
              <LBL>Atouts et potentialités</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {Object.entries(catMap).map(([cat,items])=>{
                  const color=CAT_COLORS[cat]||"#9aa5b4";
                  return (
                    <div key={cat} style={{background:`${color}06`,border:`1px solid ${color}20`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:11,fontWeight:700,color,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{cat}</div>
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                        {items.map((item,i)=>(
                          <span key={i} style={{fontSize:12,color:"#1a1a2e",background:"#fff",border:"1px solid #E8E5E3",padding:"4px 10px",borderRadius:999}}>{item}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(p.secteur_ids?.length > 0 || p.branche_ids?.length > 0) && (
            <div style={{marginBottom:16}}>
              <LBL>Activités porteuses</LBL>
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

          {p.autres&&(
            <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <LBL>Informations complémentaires</LBL>
              <p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,whiteSpace:"pre-wrap" as const}}>{p.autres}</p>
            </div>
          )}

          {fichiers.length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(5,150,105,0.06)",border:"1px solid rgba(5,150,105,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#059669",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(p);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#059669",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
              <Pencil size={13}/> Modifier
            </button>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
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

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#7c3aed,#a78bfa)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{data.activite_nom}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {data.secteur_nom&&<span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",background:"#F2F0EF",border:"1px solid #E8E5E3",padding:"2px 9px",borderRadius:999}}>{data.secteur_nom}</span>}
                {data.branche_nom&&<span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",background:"#F2F0EF",border:"1px solid #E8E5E3",padding:"2px 9px",borderRadius:999}}>{data.branche_nom}</span>}
                <span style={{fontSize:11,fontWeight:700,color:data.est_publie?"#15803d":"#9aa5b4",background:data.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{data.est_publie?"Public":"Non publié"}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Avantages sélectionnés */}
          {(data.selections||[]).length>0&&(
            <div style={{marginBottom:18}}>
              <LBL>Avantages & incitations</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {(data.selections||[]).map((s:any)=>(
                  <div key={s.id} style={{background:"rgba(124,58,237,0.04)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:s.commentaire?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#7c3aed",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"#7c3aed"}}>{s.type_libelle}</span>
                    </div>
                    {s.commentaire&&<p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,marginLeft:14,whiteSpace:"pre-wrap" as const}}>{s.commentaire}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commentaire global */}
          {data.avantages&&(
            <div style={{background:"#F8F7F6",border:"1px solid #E8E5E3",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <LBL>Commentaire général</LBL>
              <p style={{fontSize:13,color:"#4a5568",lineHeight:1.7,whiteSpace:"pre-wrap" as const}}>{data.avantages}</p>
            </div>
          )}

          {/* Documents */}
          {(data.fichiers||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {(data.fichiers||[]).map((f:any)=>(
                  <a key={f.id} href={`${API}/opportunites/avantages/${data.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#7c3aed",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(data);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#7c3aed",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
              <Pencil size={13}/> Modifier
            </button>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
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
  const [poles,       setPoles]       = useState<any[]>([]);
  const [avantages,   setAvantages]   = useState<any[]>([]);
  const [categories,  setCategories]  = useState<any[]>([]);
  // Noms géo pour le titre auto
  const [regionNom,   setRegionNom]   = useState("");
  const [deptNom,     setDeptNom]     = useState("");
  const [arrNom,      setArrNom]      = useState("");

  const [pots,      setPots]      = useState<any[]>([]);
  const [potsTotal, setPotsTotal] = useState(0);
  const [potsQ,     setPotsQ]     = useState("");
  const [potsLoad,  setPotsLoad]  = useState(true);
  const [potModal,  setPotModal]  = useState(false);
  const [potEdit,   setPotEdit]   = useState<any>(null);
  const [potVue,    setPotVue]    = useState<any>(null);
  const [potDel,    setPotDel]    = useState<number|null>(null);
  const [potToggle, setPotToggle] = useState<number|null>(null);

  const [avgs,      setAvgs]      = useState<any[]>([]);
  const [avgsTotal, setAvgsTotal] = useState(0);
  const [avgsQ,     setAvgsQ]     = useState("");
  const [avgsLoad,  setAvgsLoad]  = useState(true);
  const [avgModal,  setAvgModal]  = useState(false);
  const [avgEdit,   setAvgEdit]   = useState<any>(null);
  const [avgVue,    setAvgVue]    = useState<any>(null);
  const [avgDel,    setAvgDel]    = useState<number|null>(null);
  const [avgToggle, setAvgToggle] = useState<number|null>(null);

  useEffect(()=>{
    fetch(`${API}/zones-types/poles`).then(r=>r.json()).then(setPoles).catch(()=>{});
    fetch(`${API}/ref-potentialites/flat`).then(r=>r.json()).then(setAvantages).catch(()=>{});
    fetch(`${API}/ref-potentialites`).then(r=>r.json()).then(setCategories).catch(()=>{});
  },[]);

  const chargerPots = useCallback(async()=>{
    setPotsLoad(true);
    try {
      const p=new URLSearchParams({admin:"true",per_page:"50"});
      if(potsQ)p.set("q",potsQ);
      const res=await fetch(`${API}/opportunites/potentialites?${p}`);
      const d=await res.json();
      setPots(d.data||[]); setPotsTotal(d.total||0);
    } finally{setPotsLoad(false);}
  },[potsQ]);

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

  useEffect(()=>{chargerPots();},[chargerPots]);
  useEffect(()=>{chargerAvgs();},[chargerAvgs]);

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

  const TABS=[
    {key:"projets",       label:"Banque de projets",      color:"#ca631f"},
    {key:"potentialites", label:"Potentialités par zone",  color:"#059669"},
    {key:"avantages",     label:"Avantages & incitations", color:"#7c3aed"},
  ] as const;

  const niveauBadge=(p:any)=>{
    if(p.pole_id)          return {label:p.pole_nom||"Pôle",            color:"#ca631f"};
    if(p.region_id)        return {label:p.region_nom||"Région",        color:"#E35336"};
    if(p.departement_id)   return {label:p.departement_nom||"Dép.",     color:"#0891b2"};
    if(p.arrondissement_id)return {label:p.arrondissement_nom||"Arr.",  color:"#7c3aed"};
    return {label:"Global",color:"#6b7280"};
  };

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{marginBottom:28}}>
        <p style={{fontSize:11,fontWeight:700,color:"#ca631f",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Administration</p>
        <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Opportunités d'investissement</h1>
        <p style={{color:"#9aa5b4",fontSize:13,marginTop:4}}>Gérez les projets, potentialités territoriales et avantages fiscaux</p>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:28,borderBottom:"2px solid #E8E5E3"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setOnglet(t.key)}
            style={{padding:"11px 20px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-google-sans)",fontSize:13,fontWeight:600,color:onglet===t.key?t.color:"#9aa5b4",borderBottom:`2px solid ${onglet===t.key?t.color:"transparent"}`,marginBottom:-2,transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {onglet==="projets" && <BanqueProjets/>}

      {onglet==="potentialites" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{position:"relative",maxWidth:360,flex:1}}>
              <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
              <input value={potsQ} onChange={e=>setPotsQ(e.target.value)} placeholder="Rechercher une potentialité…" style={{...IS,paddingLeft:36}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,color:"#9aa5b4"}}>{potsTotal} fiche{potsTotal>1?"s":""}</span>
              <button onClick={()=>{setPotEdit(null);setPotModal(true);}}
                style={{display:"flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#059669,#10b981)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,boxShadow:"0 4px 14px rgba(5,150,105,0.25)"}}>
                <Plus size={14}/> Nouvelle fiche
              </button>
            </div>
          </div>

          {potsLoad?(
            <div style={{display:"flex",justifyContent:"center",padding:60}}><Loader2 size={28} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/></div>
          ):pots.length===0?(
            <div style={{textAlign:"center",padding:"80px 0",color:"#9aa5b4"}}>
              <p style={{fontSize:16,fontWeight:600}}>Aucune fiche</p>
              <p style={{fontSize:13}}>Créez votre première fiche de potentialités</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:24}}>
              {([
                {key:"pole",   label:"Pôles territoires",  color:"#ca631f"},
                {key:"region", label:"Régions",            color:"#E35336"},
                {key:"departement",   label:"Départements",color:"#0891b2"},
                {key:"arrondissement",label:"Arrondissements",color:"#7c3aed"},
              ] as const).map(groupe=>{
                const items = pots.filter((p:any)=>p.niveau===groupe.key);
                if (items.length===0) return null;
                return (
                  <div key={groupe.key}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                      <div style={{width:3,height:18,borderRadius:2,background:groupe.color}}/>
                      <span style={{fontSize:12,fontWeight:700,color:groupe.color,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{groupe.label}</span>
                      <span style={{fontSize:11,color:"#9aa5b4"}}>({items.length})</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                      {items.map((p:any)=>{
                        const badge=niveauBadge(p);
                        const selCount=(p.avantage_ids||[]).length;
                        return(
                          <div key={p.id} onClick={()=>setPotVue(p)}
                            style={{background:"#fff",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderLeft:`3px solid ${p.est_publie?groupe.color:"#C5BFBB"}`,cursor:"pointer",transition:"all 0.15s"}}
                            onMouseEnter={ev=>{ev.currentTarget.style.boxShadow=`0 4px 16px ${groupe.color}20`;ev.currentTarget.style.borderColor=`${groupe.color}50`;}}
                            onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor=p.est_publie?groupe.color:"#C5BFBB";}}>
                            <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:6,lineHeight:1.4}}>{p.titre}</div>
                            {selCount>0&&<div style={{fontSize:11,color:"#9aa5b4",marginBottom:8}}>{selCount} atout{selCount>1?"s":""} défini{selCount>1?"s":""}</div>}
                            <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                              <button onClick={()=>{setPotEdit(p);setPotModal(true);}}
                                style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#366FE3",fontWeight:600}}>
                                <Pencil size={12}/> Modifier
                              </button>
                              <button onClick={()=>togglePot(p)} disabled={potToggle===p.id}
                                style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:p.est_publie?"rgba(5,150,105,0.07)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:p.est_publie?"#059669":"#6b7280",fontWeight:600}}>
                                {potToggle===p.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:p.est_publie?<><EyeOff size={12}/> Publié</>:<><Eye size={12}/> Publier</>}
                              </button>
                              <button onClick={()=>deletePot(p.id)} disabled={potDel===p.id}
                                style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                                {potDel===p.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <PotentialiteModal open={potModal} onClose={()=>setPotModal(false)} edit={potEdit} poles={poles} avantages={avantages} categories={categories} onSaved={chargerPots}/>
          {potVue && <PotentialiteVueModal pot={potVue} refAvantages={avantages} onClose={()=>setPotVue(null)} onEdit={p=>{ setPotVue(null); setPotEdit(p); setPotModal(true); }}/>}
        </div>
      )}

      {onglet==="avantages" && (
        <div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

          {/* Barre de recherche + bouton */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{position:"relative",maxWidth:360,flex:1}}>
              <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
              <input value={avgsQ} onChange={e=>setAvgsQ(e.target.value)} placeholder="Rechercher par activité ou avantage…" style={{...{background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",width:"100%",boxSizing:"border-box" as const,fontFamily:"var(--font-google-sans)"},paddingLeft:36}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,color:"#9aa5b4"}}>{avgsTotal} fiche{avgsTotal>1?"s":""}</span>
              <button onClick={()=>{setAvgEdit(null);setAvgModal(true);}}
                style={{display:"flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,boxShadow:"0 4px 14px rgba(124,58,237,0.25)"}}>
                <Plus size={14}/> Nouvel avantage
              </button>
            </div>
          </div>

          {avgsLoad ? (
            <div style={{display:"flex",justifyContent:"center",padding:60}}>
              <Loader2 size={28} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/>
            </div>
          ) : avgs.length===0 ? (
            <div style={{textAlign:"center",padding:"80px 0",color:"#9aa5b4"}}>
              <p style={{fontSize:16,fontWeight:600}}>Aucune fiche</p>
              <p style={{fontSize:13}}>Créez votre premier avantage ou incitation</p>
            </div>
          ) : (
            <AvantagesGroupes
              avgs={avgs}
              onVue={(a:any)=>setAvgVue(a)}
              onEdit={(a:any)=>{setAvgEdit(a);setAvgModal(true);}}
              onToggle={toggleAvg}
              onDelete={deleteAvg}
              avgToggle={avgToggle}
              avgDel={avgDel}
            />
          )}

          <AvantageModal open={avgModal} onClose={()=>setAvgModal(false)} edit={avgEdit} onSaved={chargerAvgs}/>
          {avgVue&&<AvantageVueModal avg={avgVue} onClose={()=>setAvgVue(null)} onEdit={a=>{setAvgVue(null);setAvgEdit(a);setAvgModal(true);}} onSaved={chargerAvgs}/>}
        </div>
      )}
    </div>
  );
}
