"use client";

import { ArrondissementSelect, DepartementSelect, RegionSelect } from "@/components/shared/GeoSelect";
import PaysSelect from "@/components/shared/PaysSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import { Building2, Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const FORMES_JURIDIQUES = [
  "Société en nom collectif (SNC)", "Société en commandite simple (SCS)",
  "Société à responsabilité limitée (SARL)", "Société Anonyme (SA)",
  "Société par actions simplifiée (SAS)", "Société par actions simplifiée unipersonnelle (SASU)",
  "Société à responsabilité limitée unipersonnelle (SARLU)", "Société en participation",
  "Groupement d'intérêt économique (GIE)", "Coopérative simplifiée",
  "Coopérative avec conseil d'administration", "Entreprise individuelle",
  "Succursale", "Bureau de liaison",
];

function validatePhone(val: string): boolean {
  if (!val) return true;
  return /^\+221[37]\d{8}$/.test(val.replace(/\s/g, ""));
}
function fmtPhone(val: string): string { return val.replace(/\s/g, "").replace(/[^+\d]/g, ""); }

const EMPTY_FORM = {
  nom:"", forme_juridique:"", date_creation:"",
  siege_pays_id:"" as string|number, pays:"Sénégal",
  region_id:"" as string|number, departement_id:"" as string|number, arrondissement_id:"" as string|number,
  adresse:"", telephone:"", mail:"", siteweb:"",
  thematiques:"", secteur_id:"", branche_id:"", activite_id:"",
  secteur_nom:"", branche_nom:"", activite_nom:"",
  statut:"actif",
};
const EMPTY_FOCAL = { civilite:"Monsieur", nom:"", prenom:"", poste:"", telephone:"", mail:"", est_principal:false };

// ── Modal formulaire ──────────────────────────────────────────────────────────
function EntrepriseModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,        setForm]        = useState<any>({...EMPTY_FORM});
  const [focaux,      setFocaux]      = useState<any[]>([{...EMPTY_FOCAL}]);
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string,string>>({});
  const [regionId,    setRegionId]    = useState<number|null>(null);
  const [deptId,      setDeptId]      = useState<number|null>(null);
  const [siegePaysNom,setSiegePaysNom]= useState("");

  const update  = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}));
  const updFocal = (i:number,k:string,v:any) => setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,[k]:v}:f));

  useEffect(()=>{
    if (!open) return;
    setErrors({}); setSaveOk(false);
    if (editItem) {
      const th = [
        editItem.secteur?.nom  ?`sec:${editItem.secteur.nom}`:"",
        editItem.branche?.nom  ?`bra:${editItem.branche.nom}`:"",
        editItem.activite?.nom ?`act:${editItem.activite.nom}`:"",
      ].filter(Boolean).join(", ");
      setForm({
        nom:editItem.nom||"", forme_juridique:editItem.forme_juridique||"",
        date_creation:editItem.date_creation||"",
        siege_pays_id:editItem.siege_pays_id||"", pays:"Sénégal",
        region_id:editItem.region_id||"", departement_id:editItem.departement_id||"",
        arrondissement_id:editItem.arrondissement_id||"",
        adresse:editItem.adresse||"", telephone:editItem.telephone||"",
        mail:editItem.mail||"", siteweb:editItem.siteweb||"",
        thematiques:th,
        secteur_id:editItem.secteur?.id?.toString()||"", secteur_nom:editItem.secteur?.nom||"",
        branche_id:editItem.branche?.id?.toString()||"",  branche_nom:editItem.branche?.nom||"",
        activite_id:editItem.activite?.id?.toString()||"",activite_nom:editItem.activite?.nom||"",
        statut:editItem.statut||"actif",
      });
      setFocaux(editItem.points_focaux?.length>0
        ? editItem.points_focaux.map((pf:any)=>({civilite:pf.civilite||"Monsieur",nom:pf.nom||"",prenom:pf.prenom||"",poste:pf.poste||"",telephone:pf.telephone||"",mail:pf.mail||"",est_principal:pf.est_principal||false}))
        : [{...EMPTY_FOCAL}]);
      setRegionId(editItem.region_id||null); setDeptId(editItem.departement_id||null);
      setSiegePaysNom(editItem.siege_pays_nom||"");
    } else {
      setForm({...EMPTY_FORM}); setFocaux([{...EMPTY_FOCAL}]);
      setRegionId(null); setDeptId(null); setSiegePaysNom("");
    }
  },[open, editItem?.id]);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.nom.trim())          e.nom           = "Obligatoire";
    if (!form.forme_juridique)     e.forme_juridique= "Obligatoire";
    if (!form.date_creation)       e.date_creation = "Obligatoire";
    else if (form.date_creation > new Date().toISOString().split("T")[0]) e.date_creation = "Ne peut pas être dans le futur";
    if (!form.adresse.trim())      e.adresse       = "Obligatoire";
    if (!form.telephone)           e.telephone     = "Obligatoire";
    else if (!validatePhone(form.telephone)) e.telephone = "Format : +221 suivi de 9 chiffres";
    if (!form.mail.trim())         e.mail          = "Obligatoire";
    else if (!/\S+@\S+\.\S+/.test(form.mail)) e.mail = "Email invalide";
    if (!form.secteur_nom)         e.secteur_id    = "Obligatoire";
    if (!form.branche_nom)         e.branche_id    = "Obligatoire";
    if (!form.activite_nom)        e.activite_id   = "Obligatoire";
    focaux.forEach((pf,i)=>{
      if (!pf.nom.trim())    e[`fn_${i}`] = "Obligatoire";
      if (!pf.prenom.trim()) e[`fp_${i}`] = "Obligatoire";
      if (!pf.telephone)     e[`ft_${i}`] = "Obligatoire";
      else if (!validatePhone(pf.telephone)) e[`ft_${i}`] = "Format invalide";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const [allS,allB,allA] = await Promise.all([
        fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
        fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
        fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
      ]);
      const sec = allS.find((s:any)=>s.nom===form.secteur_nom);
      const bra = allB.find((b:any)=>b.nom===form.branche_nom);
      const act = allA.find((a:any)=>a.nom===form.activite_nom);
      const payload:any = {...form};
      payload.secteur_id  = sec?.id||null; payload.branche_id = bra?.id||null; payload.activite_id = act?.id||null;
      payload.region_id         = parseInt(payload.region_id)         ||null;
      payload.departement_id    = parseInt(payload.departement_id)    ||null;
      payload.arrondissement_id = parseInt(payload.arrondissement_id) ||null;
      payload.siege_pays_id     = parseInt(payload.siege_pays_id)     ||null;
      delete payload.thematiques; delete payload.secteur_nom; delete payload.branche_nom; delete payload.activite_nom;
      Object.keys(payload).forEach(k=>{ if(payload[k]===""||payload[k]===0) payload[k]=null; });
      payload.pays = "Sénégal";
      const pf = focaux.filter(f=>f.nom.trim()).map(f=>({civilite:f.civilite||"Monsieur",nom:f.nom,prenom:f.prenom,poste:f.poste,telephone:f.telephone,mail:f.mail,est_principal:f.est_principal}));
      if (!editItem) payload.points_focaux = pf;
      const url = editItem?`${API_BASE}/entreprises/${editItem.id}`:`${API_BASE}/entreprises`;
      const res = await fetch(url,{method:editItem?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true);
      setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(e:any){ setErrors({global:e.message||"Erreur lors de la sauvegarde"}); }
    finally { setSaving(false); }
  };

  const IS = (field?:string):any => ({width:"100%",background:"#F2F0EF",border:`1px solid ${field&&errors[field]?"#dc2626":"#C5BFBB"}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const});
  const LS = (field?:string):any => ({fontSize:12,fontWeight:600,color:field&&errors[field]?"#dc2626":"#4a5568",marginBottom:4,display:"block"});
  const SS:any = {fontSize:11,fontWeight:700,color:"#ca631f",letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #E8E5E3"};
  const Err = ({f}:{f:string}) => errors[f]?<span style={{fontSize:11,color:"#dc2626",marginTop:2,display:"block"}}>{errors[f]}</span>:null;

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:900,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#ca631f,#e07a3a)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e"}}>{editItem?"Modifier l'entreprise":"Nouvelle entreprise"}</h2>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:20}}>

            {/* Identification */}
            <div>
              <p style={SS}>Identification</p>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>
                <div><label style={LS("nom")}>Dénomination sociale *</label><input value={form.nom} onChange={e=>update("nom",e.target.value)} placeholder="Nom de l'entreprise" style={IS("nom")}/><Err f="nom"/></div>
                <div><label style={LS("forme_juridique")}>Forme juridique *</label>
                  <select value={form.forme_juridique} onChange={e=>update("forme_juridique",e.target.value)} style={{...IS("forme_juridique"),cursor:"pointer"}}>
                    <option value="">— Sélectionner —</option>
                    {FORMES_JURIDIQUES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select><Err f="forme_juridique"/>
                </div>
                <div><label style={LS("date_creation")}>Date de création *</label><input type="date" value={form.date_creation} onChange={e=>update("date_creation",e.target.value)} style={IS("date_creation")}/><Err f="date_creation"/></div>
              </div>
            </div>

            {/* Siège social */}
            <div>
              <p style={SS}>Siège social</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={LS()}>Pays du siège social</label>
                  <PaysSelect value={siegePaysNom} onChange={nom=>setSiegePaysNom(nom)} onChangeId={id=>update("siege_pays_id",id||"")} placeholder="Pays du siège social" excludeNoms={["Sénégal"]}/>
                </div>
                <div><label style={LS()}>Pays d'installation</label>
                  <input value="Sénégal" disabled style={{...IS(),opacity:0.6,cursor:"not-allowed",background:"#E8E5E3"}}/>
                </div>
              </div>
            </div>

            {/* Localisation */}
            <div>
              <p style={SS}>Localisation au Sénégal</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <div><label style={LS()}>Région</label>
                  <RegionSelect value={form.region_id} onChange={(id)=>{ update("region_id",id||""); update("departement_id",""); update("arrondissement_id",""); setRegionId(id); setDeptId(null); }}/>
                </div>
                <div><label style={LS()}>Département</label>
                  <DepartementSelect regionId={regionId} value={form.departement_id} onChange={(id)=>{ update("departement_id",id||""); update("arrondissement_id",""); setDeptId(id); }}/>
                </div>
                <div><label style={LS()}>Arrondissement</label>
                  <ArrondissementSelect departementId={deptId} value={form.arrondissement_id} onChange={(id)=>update("arrondissement_id",id||"")}/>
                </div>
              </div>
              <div><label style={LS("adresse")}>Adresse complète *</label><input value={form.adresse} onChange={e=>update("adresse",e.target.value)} placeholder="Adresse physique" style={IS("adresse")}/><Err f="adresse"/></div>
            </div>

            {/* Contact */}
            <div>
              <p style={SS}>Contact</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div><label style={LS("telephone")}>Téléphone * <span style={{fontWeight:400,color:"#9aa5b4"}}>(+221...)</span></label>
                  <input value={form.telephone} onChange={e=>update("telephone",fmtPhone(e.target.value))} placeholder="+221 7X XXX XX XX" style={IS("telephone")}/><Err f="telephone"/>
                </div>
                <div><label style={LS("mail")}>Email *</label>
                  <input type="email" value={form.mail} onChange={e=>update("mail",e.target.value)} placeholder="contact@entreprise.sn" style={IS("mail")}/><Err f="mail"/>
                </div>
                <div><label style={LS()}>Site web</label>
                  <input value={form.siteweb} onChange={e=>update("siteweb",e.target.value)} placeholder="https://..." style={IS()}/>
                </div>
              </div>
            </div>

            {/* Thématiques */}
            <div>
              <p style={SS}>Classification NAEMA</p>
              <ThematiquesNaema value={form.thematiques} onChange={(val:string)=>{
                update("thematiques",val);
                const items = val.split(",").map((t:string)=>t.trim());
                const secNom = items.find((t:string)=>t.startsWith("sec:"))?.slice(4)||"";
                const braNom = items.find((t:string)=>t.startsWith("bra:"))?.slice(4)||"";
                const actNom = items.find((t:string)=>t.startsWith("act:"))?.slice(4)||"";
                update("secteur_nom",secNom); update("branche_nom",braNom); update("activite_nom",actNom);
              }}/>
              {(errors.secteur_id||errors.branche_id||errors.activite_id)&&
                <span style={{fontSize:11,color:"#dc2626",marginTop:4,display:"block"}}>Secteur, branche et activité sont obligatoires</span>}
            </div>

            {/* Points focaux */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <p style={{...SS,marginBottom:0,borderBottom:"none",paddingBottom:0}}>Points focaux</p>
                <button onClick={()=>setFocaux(prev=>[...prev,{...EMPTY_FOCAL}])}
                  style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>
                  <Plus size={12}/> Ajouter un contact
                </button>
              </div>
              <div style={{borderTop:"1px solid #E8E5E3",paddingTop:12,display:"flex",flexDirection:"column" as const,gap:12}}>
                {focaux.map((pf,i)=>(
                  <div key={i} style={{background:"#F8F7F6",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <User size={13} style={{color:"#ca631f"}}/>
                        <span style={{fontSize:12,fontWeight:600,color:"#4a5568"}}>Contact {i+1}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a5568",cursor:"pointer"}}>
                          <input type="checkbox" checked={pf.est_principal} onChange={e=>updFocal(i,"est_principal",e.target.checked)}/> Principal
                        </label>
                        {focaux.length>1&&<button onClick={()=>setFocaux(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash size={13} style={{color:"#dc2626"}}/></button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr 1fr 1fr",gap:10}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Civilité</label>
                        <select value={pf.civilite||"Monsieur"} onChange={e=>updFocal(i,"civilite",e.target.value)} style={{...IS(),fontSize:12,cursor:"pointer",minWidth:110}}>
                          <option value="Monsieur">Monsieur</option><option value="Madame">Madame</option>
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:errors[`fn_${i}`]?"#dc2626":"#4a5568",marginBottom:3,display:"block"}}>Nom *</label>
                        <input value={pf.nom} onChange={e=>updFocal(i,"nom",e.target.value)} placeholder="Nom" style={{...IS(),fontSize:12,borderColor:errors[`fn_${i}`]?"#dc2626":"#C5BFBB"}}/>
                        {errors[`fn_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`fn_${i}`]}</span>}
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:errors[`fp_${i}`]?"#dc2626":"#4a5568",marginBottom:3,display:"block"}}>Prénom *</label>
                        <input value={pf.prenom} onChange={e=>updFocal(i,"prenom",e.target.value)} placeholder="Prénom" style={{...IS(),fontSize:12,borderColor:errors[`fp_${i}`]?"#dc2626":"#C5BFBB"}}/>
                        {errors[`fp_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`fp_${i}`]}</span>}
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Poste</label>
                        <input value={pf.poste} onChange={e=>updFocal(i,"poste",e.target.value)} placeholder="DG, Dir..." style={{...IS(),fontSize:12}}/>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:errors[`ft_${i}`]?"#dc2626":"#4a5568",marginBottom:3,display:"block"}}>Téléphone *</label>
                        <input value={pf.telephone} onChange={e=>updFocal(i,"telephone",fmtPhone(e.target.value))} placeholder="+221..." style={{...IS(),fontSize:12,borderColor:errors[`ft_${i}`]?"#dc2626":"#C5BFBB"}}/>
                        {errors[`ft_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`ft_${i}`]}</span>}
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Email</label>
                        <input value={pf.mail} onChange={e=>updFocal(i,"mail",e.target.value)} placeholder="email@..." style={{...IS(),fontSize:12}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errors.global&&<div style={{background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>{errors.global}</div>}
            {Object.keys(errors).filter(k=>k!=="global").length>0&&!errors.global&&
              <div style={{background:"#fef9c3",color:"#a16207",padding:"10px 14px",borderRadius:8,fontSize:13}}>Veuillez corriger les champs obligatoires avant de continuer.</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-google-sans)"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||saveOk}
                style={{padding:"10px 24px",borderRadius:10,border:"none",background:saveOk?"#dcfce7":"linear-gradient(135deg,#ca631f,#a84e18)",color:saveOk?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-google-sans)"}}>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                {saveOk?<><Check size={14}/> Enregistré</>:saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Sauvegarde...</>:editItem?"Modifier":"Créer l'entreprise"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal vue entreprise ──────────────────────────────────────────────────────
function EntrepriseVue({ ent:e, onClose, onEdit }: { ent:any; onClose:()=>void; onEdit:(e:any)=>void }) {
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  const fmtD = (d:string) => d ? new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : "";

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:38,height:38,borderRadius:10,background:"rgba(227,83,54,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Building2 size={18} style={{color:"#E35336"}}/>
                </div>
                <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{e.nom}</h2>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {e.forme_juridique&&<span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{e.forme_juridique}</span>}
                <span style={{fontSize:11,fontWeight:700,color:e.est_publie?"#15803d":"#9aa5b4",background:e.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{e.est_publie?"Publié":"Non publié"}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Infos principales */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {e.date_creation&&(
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date de création</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtD(e.date_creation)}</p>
              </div>
            )}
            {e.adresse&&(
              <div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Adresse</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p>
              </div>
            )}
            {e.telephone&&(
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Téléphone</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.telephone}</p>
              </div>
            )}
            {e.mail&&(
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Email</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.mail}</p>
              </div>
            )}
            {(e.region_nom||e.departement_nom)&&(
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Localisation</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{[e.arrondissement_nom,e.departement_nom,e.region_nom].filter(Boolean).join(", ")}</p>
              </div>
            )}
            {e.siteweb&&(
              <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Site web</LBL>
                <a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#366FE3",textDecoration:"none"}}>{e.siteweb}</a>
              </div>
            )}
          </div>

          {/* Classification NAEMA en arborescence */}
          {(e.secteur||e.branche||e.activite)&&(
            <div style={{marginBottom:16}}>
              <LBL>Classification NAEMA</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {e.secteur&&(
                  <div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:e.branche?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{e.secteur.nom}</span>
                    </div>
                    {e.branche&&(
                      <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:e.activite?4:0}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{e.branche.nom}</span>
                        </div>
                        {e.activite&&(
                          <div style={{paddingLeft:18}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                              <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{e.activite.nom}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Points focaux */}
          {e.points_focaux?.length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Points focaux</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {e.points_focaux.map((pf:any,i:number)=>(
                  <div key={i} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontWeight:700,color:"#1a1a2e"}}>{pf.civilite} {pf.prenom} {pf.nom}</span>
                      {pf.poste&&<span style={{color:"#9aa5b4"}}>— {pf.poste}</span>}
                      {pf.est_principal&&<span style={{fontSize:10,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",borderRadius:999,padding:"1px 7px"}}>Principal</span>}
                    </div>
                    <div style={{color:"#4a5568"}}>{pf.telephone}{pf.mail&&` · ${pf.mail}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(e);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#366FE3",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
              <Pencil size={13}/> Modifier
            </button>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminEntreprises() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [editItem,    setEditItem]    = useState<any>(null);
  const [vue,         setVue]         = useState<any>(null);
  const [deleting,    setDeleting]    = useState<string|null>(null);
  const [togglingId,  setTogglingId]  = useState<string|null>(null);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/entreprises?per_page=100&admin=true`);
      const data = await res.json();
      setEntreprises(data.data||[]); setTotal(data.total||0);
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (e:any) => { setEditItem(e); setModal(true); };

  const handleDelete = async (id:string) => {
    if (!confirm("Supprimer cette entreprise ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/entreprises/${id}`,{method:"DELETE"}); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e:any) => {
    setTogglingId(e.id);
    try {
      await fetch(`${API_BASE}/entreprises/${e.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({est_publie:!e.est_publie})});
      charger();
    } finally { setTogglingId(null); }
  };

  const fmtD = (d:string) => d ? new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}) : "";

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div>
          <p style={{fontSize:11,fontWeight:700,color:"#E35336",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Administration</p>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Entreprises installées</h1>
          <p style={{color:"#9aa5b4",fontSize:13,marginTop:2}}>{total} entreprise{total>1?"s":""} au total</p>
        </div>
        <button onClick={openCreate} style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#E35336,#c42d1a)",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(227,83,54,0.3)"}}>
          <Plus size={15}/> Ajouter une entreprise
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:200,gap:10,color:"#9aa5b4"}}>
          <Loader2 size={22} style={{animation:"spin 1s linear infinite"}}/>
        </div>
      ) : entreprises.length===0 ? (
        <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
          <Building2 size={40} style={{marginBottom:12,opacity:0.25}}/>
          <p style={{fontSize:14,color:"#4a5568"}}>Aucune entreprise — cliquez sur "Ajouter" pour commencer.</p>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
          {entreprises.map(e=>(
            <div key={e.id}
              onClick={()=>setVue(e)}
              style={{background:"#fff",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderLeft:`3px solid ${e.est_publie?"#E35336":"#C5BFBB"}`,cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(227,83,54,0.12)"; ev.currentTarget.style.borderColor="#FFB0A1";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.borderColor="#E8E5E3"; ev.currentTarget.style.borderLeftColor=e.est_publie?"#E35336":"#C5BFBB";}}>

              {/* Nom */}
              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>

              {/* Infos */}
              <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                {e.forme_juridique&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{e.forme_juridique}</div>}
                {e.date_creation&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                    <span style={{color:"#4a5568"}}>{fmtD(e.date_creation)}</span>
                  </div>
                )}
                {e.adresse&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                    <span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.adresse}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>openEdit(e)}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#366FE3",fontWeight:600}}>
                  <Pencil size={12}/> Modifier
                </button>
                <button onClick={()=>handleTogglePublie(e)} disabled={togglingId===e.id}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:e.est_publie?"rgba(21,128,61,0.07)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:e.est_publie?"#15803d":"#6b7280",fontWeight:600}}>
                  {togglingId===e.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:e.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                  {deleting===e.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vue&&<EntrepriseVue ent={vue} onClose={()=>setVue(null)} onEdit={e=>{setVue(null);openEdit(e);}}/>}
      <EntrepriseModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger}/>
    </div>
  );
}
