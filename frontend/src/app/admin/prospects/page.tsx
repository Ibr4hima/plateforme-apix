"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Building2, User, Trash, ChevronDown, ChevronUp, Clock, MessageSquare, AlertTriangle, Eye, EyeOff } from "lucide-react";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import PaysSelect from "@/components/shared/PaysSelect";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";

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

const ETATS = [
  { value:"en_cours",   label:"En cours",   bg:"#dcfce7", text:"#15803d" },
  { value:"en_attente", label:"En attente", bg:"#fef9c3", text:"#a16207" },
  { value:"inactif",    label:"Inactif",    bg:"#f3f4f6", text:"#6b7280" },
  { value:"termine",    label:"Terminé",    bg:"#dbeafe", text:"#1d4ed8" },
];
const getEtat = (val:string) => ETATS.find(e=>e.value===val)||ETATS[0];
const validatePhone = (val:string) => !val||/^\+\d{7,15}$/.test(val.replace(/\s/g,""));
const fmtDate = (d:string) => d ? new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}) : "—";

const EMPTY_FORM = {
  type_prospect:"", entreprise_installee_id:"",
  nom:"", forme_juridique:"", date_creation_ent:"",
  siege_pays:"", siege_pays_id:"" as string|number, siege_pays_nom:"", pays:"Sénégal",
  region_id:"" as string|number, departement_id:"" as string|number, arrondissement_id:"" as string|number,
  adresse:"", telephone:"", mail:"", siteweb:"",
  thematiques:"", secteur_nom:"", branche_nom:"", activite_nom:"",
  secteur_id:"", branche_id:"", activite_id:"", point_entree:"", est_publie:true,
};
const EMPTY_FOCAL   = { nom:"", prenom:"", poste:"", telephone:"", mail:"", est_principal:false };
const EMPTY_CONTACT = { projet_nom:"", projet_description:"", date_premier_contact:"", etat_avancement:"en_cours", commentaires:"", contraintes:"" };

// ── Modal formulaire prospect ─────────────────────────────────────────────────
function ProspectModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,        setForm]        = useState<any>({...EMPTY_FORM});
  const [focaux,      setFocaux]      = useState<any[]>([{...EMPTY_FOCAL}]);
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string,string>>({});
  const [regionId,    setRegionId]    = useState<number|null>(null);
  const [depId,       setDepId]       = useState<number|null>(null);
  const [siegePaysNom,setSiegePaysNom]= useState("");
  const [entreprisesInstallees, setEntreprisesInstallees] = useState<any[]>([]);

  const update = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}));
  const isLocked = form.type_prospect==="entreprise_installee" && !!form.entreprise_installee_id;

  useEffect(()=>{
    fetch(`${API_BASE}/entreprises?per_page=500`)
      .then(r=>r.json()).then(d=>setEntreprisesInstallees(d.data||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!open) return;
    setErrors({}); setSaveOk(false);
    if (editItem) {
      const th=[editItem.secteur?.nom?`sec:${editItem.secteur.nom}`:"",editItem.branche?.nom?`bra:${editItem.branche.nom}`:"",editItem.activite?.nom?`act:${editItem.activite.nom}`:""].filter(Boolean).join(", ");
      setForm({
        type_prospect:editItem.type_prospect||"entreprise_installee",
        entreprise_installee_id:editItem.entreprise_installee_id||"",
        nom:editItem.nom||"", forme_juridique:editItem.forme_juridique||"",
        date_creation_ent:editItem.date_creation_ent||"",
        siege_pays:editItem.siege_pays_nom||"", siege_pays_id:editItem.siege_pays_id||"", siege_pays_nom:editItem.siege_pays_nom||"",
        pays:"Sénégal", region_id:editItem.region_id||"", departement_id:editItem.departement_id||"", arrondissement_id:editItem.arrondissement_id||"",
        adresse:editItem.adresse||"", telephone:editItem.telephone||"", mail:editItem.mail||"", siteweb:editItem.siteweb||"",
        thematiques:th, secteur_nom:editItem.secteur?.nom||"", branche_nom:editItem.branche?.nom||"", activite_nom:editItem.activite?.nom||"",
        secteur_id:editItem.secteur?.id?.toString()||"", branche_id:editItem.branche?.id?.toString()||"", activite_id:editItem.activite?.id?.toString()||"",
        point_entree:editItem.point_entree||"", est_publie:editItem.est_publie??true,
      });
      setSiegePaysNom(editItem.siege_pays_nom||"");
      if (editItem.region_id){ setRegionId(editItem.region_id); if(editItem.departement_id) setDepId(editItem.departement_id); }
      setFocaux(editItem.points_focaux?.length>0
        ? editItem.points_focaux.map((pf:any)=>({nom:pf.nom||"",prenom:pf.prenom||"",poste:pf.poste||"",telephone:pf.telephone||"",mail:pf.mail||"",est_principal:pf.est_principal||false}))
        : [{...EMPTY_FOCAL}]);
    } else {
      setForm({...EMPTY_FORM}); setFocaux([{...EMPTY_FOCAL}]);
      setRegionId(null); setDepId(null); setSiegePaysNom("");
    }
  },[open,editItem?.id]);

  const prefill = (ent:any) => {
    setForm((f:any)=>({...f,
      entreprise_installee_id:ent.id, nom:ent.nom||"", forme_juridique:ent.forme_juridique||"",
      date_creation_ent:ent.date_creation||"", siege_pays_id:ent.siege_pays_id||"", siege_pays_nom:ent.siege_pays_nom||"",
      region_id:ent.region_id||"", departement_id:ent.departement_id||"", arrondissement_id:ent.arrondissement_id||"",
      adresse:ent.adresse||"", telephone:ent.telephone||"", mail:ent.mail||"", siteweb:ent.siteweb||"",
      thematiques:[ent.secteur?.nom?`sec:${ent.secteur.nom}`:"",ent.branche?.nom?`bra:${ent.branche.nom}`:"",ent.activite?.nom?`act:${ent.activite.nom}`:""].filter(Boolean).join(", "),
      secteur_nom:ent.secteur?.nom||"", branche_nom:ent.branche?.nom||"", activite_nom:ent.activite?.nom||"",
      secteur_id:ent.secteur?.id?.toString()||"", branche_id:ent.branche?.id?.toString()||"", activite_id:ent.activite?.id?.toString()||"",
    }));
    setSiegePaysNom(ent.siege_pays_nom||"");
    if(ent.region_id){setRegionId(ent.region_id);if(ent.departement_id)setDepId(ent.departement_id);}
    if(ent.points_focaux?.length>0) setFocaux(ent.points_focaux.map((pf:any)=>({nom:pf.nom||"",prenom:pf.prenom||"",poste:pf.poste||"",telephone:pf.telephone||"",mail:pf.mail||"",est_principal:pf.est_principal||false})));
  };

  const validate = () => {
    const e:Record<string,string>={};
    if (!form.type_prospect)       e.type_prospect="Choisir un type";
    if (!form.nom.trim())          e.nom="Obligatoire";
    if (!form.forme_juridique)     e.forme_juridique="Obligatoire";
    if (!form.date_creation_ent)   e.date_creation_ent="Obligatoire";
    if (form.type_prospect==="hors_senegal"&&!form.siege_pays_id) e.siege_pays_id="Obligatoire";
    if (!form.adresse.trim())      e.adresse="Obligatoire";
    if (!form.telephone)           e.telephone="Obligatoire";
    else if (!validatePhone(form.telephone)) e.telephone="Format invalide (+...)";
    if (!form.mail.trim())         e.mail="Obligatoire";
    else if (!/\S+@\S+\.\S+/.test(form.mail)) e.mail="Email invalide";
    if (!form.secteur_nom)         e.secteur_id="Obligatoire";
    if (!form.branche_nom)         e.branche_id="Obligatoire";
    if (!form.activite_nom)        e.activite_id="Obligatoire";
    if (!form.point_entree.trim()) e.point_entree="Obligatoire";
    focaux.forEach((pf,i)=>{
      if(!pf.nom.trim())    e[`fn_${i}`]="Obligatoire";
      if(!pf.prenom.trim()) e[`fp_${i}`]="Obligatoire";
      if(!pf.telephone)     e[`ft_${i}`]="Obligatoire";
      else if(!validatePhone(pf.telephone)) e[`ft_${i}`]="Format invalide";
    });
    setErrors(e); return Object.keys(e).length===0;
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
      const sec=allS.find((s:any)=>s.nom===form.secteur_nom), bra=allB.find((b:any)=>b.nom===form.branche_nom), act=allA.find((a:any)=>a.nom===form.activite_nom);
      const payload:any={...form};
      payload.secteur_id=sec?.id||null; payload.branche_id=bra?.id||null; payload.activite_id=act?.id||null;
      if(payload.region_id)         payload.region_id=parseInt(payload.region_id)||null;
      if(payload.departement_id)    payload.departement_id=parseInt(payload.departement_id)||null;
      if(payload.arrondissement_id) payload.arrondissement_id=parseInt(payload.arrondissement_id)||null;
      if(payload.siege_pays_id)     payload.siege_pays_id=parseInt(payload.siege_pays_id)||null;
      delete payload.thematiques; delete payload.secteur_nom; delete payload.branche_nom; delete payload.activite_nom;
      delete payload.siege_pays; delete payload.siege_pays_nom;
      Object.keys(payload).forEach(k=>{if(payload[k]===""||payload[k]===0)payload[k]=null;});
      payload.pays="Sénégal";
      if(!editItem) payload.points_focaux=focaux.filter(f=>f.nom.trim());
      const url=editItem?`${API_BASE}/prospects/${editItem.id}`:`${API_BASE}/prospects`;
      const res=await fetch(url,{method:editItem?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true); setTimeout(()=>{onClose();onSaved();},700);
    } catch(e:any){setErrors({global:e.message});}
    finally{setSaving(false);}
  };

  const IS=(f?:string):any=>({width:"100%",background:isLocked&&f?"#E8E5E3":"#F2F0EF",border:`1px solid ${f&&errors[f]?"#dc2626":"#C5BFBB"}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const,cursor:isLocked&&f?"not-allowed":undefined});
  const LS=(f?:string):any=>({fontSize:12,fontWeight:600,color:f&&errors[f]?"#dc2626":"#4a5568",marginBottom:4,display:"block"});
  const SS:any={fontSize:11,fontWeight:700,color:"#004f91",letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #E8E5E3"};
  const Err=({f}:{f:string})=>errors[f]?<span style={{fontSize:11,color:"#dc2626",marginTop:2,display:"block"}}>{errors[f]}</span>:null;

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:900,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#004f91,#1a6ab0)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e"}}>{editItem?"Modifier le prospect":"Nouveau prospect"}</h2>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:20}}>

            {/* Type */}
            <div>
              <p style={SS}>Type de prospect</p>
              {errors.type_prospect&&<p style={{fontSize:11,color:"#dc2626",marginBottom:8}}>{errors.type_prospect}</p>}
              <div style={{display:"flex",gap:10}}>
                {[{value:"entreprise_installee",label:"Entreprise installée au Sénégal"},{value:"hors_senegal",label:"Entreprise hors Sénégal"}].map(opt=>(
                  <button key={opt.value} onClick={()=>{setForm({...EMPTY_FORM,type_prospect:opt.value});setSiegePaysNom("");setRegionId(null);setDepId(null);setFocaux([{...EMPTY_FOCAL}]);}}
                    style={{padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",border:`2px solid ${form.type_prospect===opt.value?"#004f91":"#C5BFBB"}`,background:form.type_prospect===opt.value?"rgba(0,79,145,0.08)":"#fff",color:form.type_prospect===opt.value?"#004f91":"#4a5568"}}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.type_prospect==="entreprise_installee"&&(
                <div style={{marginTop:14}}>
                  <label style={LS()}>Sélectionner l'entreprise *</label>
                  <select value={form.entreprise_installee_id} onChange={e=>{const ent=entreprisesInstallees.find((x:any)=>x.id===e.target.value);if(ent)prefill(ent);else update("entreprise_installee_id","");}}
                    style={{width:"100%",background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",cursor:"pointer",boxSizing:"border-box" as const}}>
                    <option value="">— Sélectionner une entreprise —</option>
                    {entreprisesInstallees.map((ent:any)=><option key={ent.id} value={ent.id}>{ent.nom}{ent.forme_juridique?` · ${ent.forme_juridique.split("(")[0].trim()}`:""}</option>)}
                  </select>
                  {form.entreprise_installee_id&&<p style={{fontSize:12,color:"#15803d",marginTop:6}}>Informations pré-remplies depuis la fiche entreprise</p>}
                </div>
              )}
            </div>

            {/* Identification */}
            <div>
              <p style={SS}>Identification</p>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>
                <div><label style={LS("nom")}>Dénomination sociale *</label><input value={form.nom} onChange={e=>update("nom",e.target.value)} disabled={isLocked} placeholder="Nom de l'entreprise" style={IS("nom")}/><Err f="nom"/></div>
                <div><label style={LS("forme_juridique")}>Forme juridique *</label>
                  <select value={form.forme_juridique} onChange={e=>update("forme_juridique",e.target.value)} disabled={isLocked} style={{...IS("forme_juridique"),cursor:isLocked?"not-allowed":"pointer"}}>
                    <option value="">— Sélectionner —</option>
                    {FORMES_JURIDIQUES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select><Err f="forme_juridique"/>
                </div>
                <div><label style={LS("date_creation_ent")}>Date de création *</label><input type="date" value={form.date_creation_ent} onChange={e=>update("date_creation_ent",e.target.value)} disabled={isLocked} style={IS("date_creation_ent")}/><Err f="date_creation_ent"/></div>
              </div>
            </div>

            {/* Siège social */}
            {form.type_prospect==="hors_senegal"&&(
              <div>
                <p style={SS}>Siège social</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={LS("siege_pays_id")}>Pays du siège *</label>
                    <PaysSelect value={siegePaysNom} onChange={nom=>setSiegePaysNom(nom)} onChangeId={id=>update("siege_pays_id",id||"")} placeholder="Pays du siège social" excludeNoms={["Sénégal"]}/>
                    <Err f="siege_pays_id"/>
                  </div>
                  <div><label style={LS()}>Pays d'installation</label><input value="Sénégal" disabled style={{...IS(),opacity:0.6,cursor:"not-allowed",background:"#E8E5E3"}}/></div>
                </div>
              </div>
            )}

            {/* Localisation */}
            <div>
              <p style={SS}>Localisation au Sénégal</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <div><label style={LS()}>Région</label><RegionSelect value={form.region_id} onChange={id=>{update("region_id",id||"");update("departement_id","");update("arrondissement_id","");setRegionId(id);setDepId(null);}}/></div>
                <div><label style={LS()}>Département</label><DepartementSelect regionId={regionId} value={form.departement_id} onChange={id=>{update("departement_id",id||"");update("arrondissement_id","");setDepId(id);}}/></div>
                <div><label style={LS()}>Arrondissement</label><ArrondissementSelect departementId={depId} value={form.arrondissement_id} onChange={id=>update("arrondissement_id",id||"")}/></div>
              </div>
              <div><label style={LS("adresse")}>Adresse *</label><input value={form.adresse} onChange={e=>update("adresse",e.target.value)} disabled={isLocked} placeholder="Adresse physique" style={IS("adresse")}/><Err f="adresse"/></div>
            </div>

            {/* Contact */}
            <div>
              <p style={SS}>Contact</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div><label style={LS("telephone")}>Téléphone *</label><input value={form.telephone} onChange={e=>update("telephone",e.target.value.replace(/\s/g,"").replace(/[^+\d]/g,""))} disabled={isLocked} placeholder="+221..." style={IS("telephone")}/><Err f="telephone"/></div>
                <div><label style={LS("mail")}>Email *</label><input type="email" value={form.mail} onChange={e=>update("mail",e.target.value)} disabled={isLocked} placeholder="contact@..." style={IS("mail")}/><Err f="mail"/></div>
                <div><label style={LS()}>Site web</label><input value={form.siteweb} onChange={e=>update("siteweb",e.target.value)} disabled={isLocked} placeholder="https://..." style={IS()}/></div>
              </div>
            </div>

            {/* NAEMA */}
            <div>
              <p style={SS}>Classification NAEMA</p>
              <ThematiquesNaema value={form.thematiques} onChange={(val:string)=>{
                update("thematiques",val);
                const items=val.split(",").map((t:string)=>t.trim());
                update("secteur_nom",items.find((t:string)=>t.startsWith("sec:"))?.slice(4)||"");
                update("branche_nom",items.find((t:string)=>t.startsWith("bra:"))?.slice(4)||"");
                update("activite_nom",items.find((t:string)=>t.startsWith("act:"))?.slice(4)||"");
              }}/>
              {(errors.secteur_id||errors.branche_id||errors.activite_id)&&<span style={{fontSize:11,color:"#dc2626",marginTop:4,display:"block"}}>Secteur, branche et activité sont obligatoires</span>}
            </div>

            {/* Point d'entrée */}
            <div>
              <p style={SS}>Point d'entrée APIX</p>
              <input value={form.point_entree} onChange={e=>update("point_entree",e.target.value)} placeholder="Ex : Forum d'investissement Paris 2024, Mission IDE…" style={IS("point_entree")}/>
              <Err f="point_entree"/>
            </div>

            {/* Points focaux */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <p style={{...SS,marginBottom:0,borderBottom:"none",paddingBottom:0}}>Points focaux</p>
                <button onClick={()=>setFocaux(prev=>[...prev,{...EMPTY_FOCAL}])} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.08)",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>
                  <Plus size={12}/> Ajouter un contact
                </button>
              </div>
              <div style={{borderTop:"1px solid #E8E5E3",paddingTop:12,display:"flex",flexDirection:"column" as const,gap:12}}>
                {focaux.map((pf,i)=>(
                  <div key={i} style={{background:"#F8F7F6",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><User size={13} style={{color:"#004f91"}}/><span style={{fontSize:12,fontWeight:600,color:"#4a5568"}}>Contact {i+1}</span></div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a5568",cursor:"pointer"}}>
                          <input type="checkbox" checked={pf.est_principal} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,est_principal:e.target.checked}:f))}/> Principal
                        </label>
                        {focaux.length>1&&<button onClick={()=>setFocaux(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash size={13} style={{color:"#dc2626"}}/></button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:10}}>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Nom *</label><input value={pf.nom} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,nom:e.target.value}:f))} placeholder="Nom" style={{...IS(),fontSize:12,borderColor:errors[`fn_${i}`]?"#dc2626":"#C5BFBB"}}/>{errors[`fn_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`fn_${i}`]}</span>}</div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Prénom *</label><input value={pf.prenom} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,prenom:e.target.value}:f))} placeholder="Prénom" style={{...IS(),fontSize:12,borderColor:errors[`fp_${i}`]?"#dc2626":"#C5BFBB"}}/>{errors[`fp_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`fp_${i}`]}</span>}</div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Poste</label><input value={pf.poste} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,poste:e.target.value}:f))} placeholder="Directeur..." style={{...IS(),fontSize:12}}/></div>
                      <div><label style={{fontSize:11,fontWeight:600,color:errors[`ft_${i}`]?"#dc2626":"#4a5568",marginBottom:3,display:"block"}}>Téléphone *</label><input value={pf.telephone} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,telephone:e.target.value.replace(/\s/g,"").replace(/[^+\d]/g,"")}:f))} placeholder="+..." style={{...IS(),fontSize:12,borderColor:errors[`ft_${i}`]?"#dc2626":"#C5BFBB"}}/>{errors[`ft_${i}`]&&<span style={{fontSize:10,color:"#dc2626"}}>{errors[`ft_${i}`]}</span>}</div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Email</label><input value={pf.mail} onChange={e=>setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,mail:e.target.value}:f))} placeholder="email@..." style={{...IS(),fontSize:12}}/></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errors.global&&<div style={{background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>{errors.global}</div>}
            {Object.keys(errors).filter(k=>k!=="global").length>0&&!errors.global&&<div style={{background:"#fef9c3",color:"#a16207",padding:"10px 14px",borderRadius:8,fontSize:13}}>Veuillez corriger les champs obligatoires.</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-google-sans)"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||saveOk} style={{padding:"10px 24px",borderRadius:10,border:"none",background:saveOk?"#dcfce7":"linear-gradient(135deg,#004f91,#003a6e)",color:saveOk?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-google-sans)"}}>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                {saveOk?<><Check size={14}/> Enregistré</>:saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Sauvegarde...</>:editItem?"Modifier":"Créer le prospect"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal contact ─────────────────────────────────────────────────────────────
function ContactModal({ open, onClose, prospect, editContact, onSaved }: {
  open:boolean; onClose:()=>void; prospect:any; editContact:any; onSaved:()=>void;
}) {
  const [form,   setForm]   = useState<any>({...EMPTY_CONTACT});
  const [saving, setSaving] = useState(false);
  const [ok,     setOk]     = useState(false);

  useEffect(()=>{
    if (!open) return;
    setOk(false);
    setForm(editContact ? {
      projet_nom:editContact.projet_nom||"", projet_description:editContact.projet_description||"",
      date_premier_contact:editContact.date_premier_contact||"",
      etat_avancement:editContact.etat_avancement||"en_cours",
      commentaires:editContact.commentaires||"", contraintes:editContact.contraintes||"",
    } : {...EMPTY_CONTACT});
  },[open, editContact?.id]);

  const upd = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.projet_nom.trim()||!form.date_premier_contact) return;
    setSaving(true);
    try {
      const payload={...form};
      Object.keys(payload).forEach(k=>{if((payload as any)[k]==="") (payload as any)[k]=null;});
      const url = editContact ? `${API_BASE}/prospects/${prospect.id}/contacts/${editContact.id}` : `${API_BASE}/prospects/${prospect.id}/contacts`;
      const res = await fetch(url,{method:editContact?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error();
      setOk(true); setTimeout(()=>{onClose();onSaved();},700);
    } catch{} finally{setSaving(false);}
  };

  const IS:any={width:"100%",background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const};

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:560,border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)",overflow:"hidden"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#059669,#047857)"}}/>
        <div style={{padding:"24px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h2 style={{fontWeight:800,fontSize:"1.05rem",color:"#1a1a2e"}}>{editContact?"Modifier le contact":"Nouveau contact"}</h2>
              <p style={{fontSize:12,color:"#9aa5b4",marginTop:2}}>{prospect?.nom}</p>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
            <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>Projet concerné *</label><input value={form.projet_nom} onChange={e=>upd("projet_nom",e.target.value)} placeholder="Nom du projet d'investissement" style={IS}/></div>
            <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>Description du projet</label><textarea value={form.projet_description} onChange={e=>upd("projet_description",e.target.value)} rows={2} style={{...IS,resize:"vertical" as const}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>Date premier contact *</label><input type="date" value={form.date_premier_contact} max={new Date().toISOString().split("T")[0]} onChange={e=>upd("date_premier_contact",e.target.value)} style={IS}/></div>
              <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>État d'avancement</label>
                <select value={form.etat_avancement} onChange={e=>upd("etat_avancement",e.target.value)} style={{...IS,cursor:"pointer"}}>
                  {ETATS.map(et=><option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </div>
            </div>
            <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>Commentaires</label><textarea value={form.commentaires} onChange={e=>upd("commentaires",e.target.value)} rows={3} placeholder="Résumé des échanges..." style={{...IS,resize:"vertical" as const}}/></div>
            <div><label style={{fontSize:12,fontWeight:600,color:"#4a5568",marginBottom:4,display:"block"}}>Contraintes</label><textarea value={form.contraintes} onChange={e=>upd("contraintes",e.target.value)} rows={3} placeholder="Contrainte foncière, fiscale..." style={{...IS,resize:"vertical" as const}}/></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||ok} style={{padding:"10px 24px",borderRadius:10,border:"none",background:ok?"#dcfce7":"linear-gradient(135deg,#059669,#047857)",color:ok?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                {ok?<><Check size={14}/> Enregistré</>:saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Sauvegarde...</>:editContact?"Modifier":"Enregistrer le contact"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal historique ──────────────────────────────────────────────────────────
function HistoriqueModal({ open, onClose, item, onEditContact }: {
  open:boolean; onClose:()=>void; item:any; onEditContact:(c:any)=>void;
}) {
  const [expanded, setExpanded] = useState<string|null>(null);
  if (!open||!item) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:680,border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)",overflow:"hidden"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#004f91,#1a6ab0)"}}/>
        <div style={{padding:"24px 28px",overflowY:"auto" as const,maxHeight:"85vh"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e"}}>{item.nom}</h2>
              <p style={{fontSize:12,color:"#9aa5b4",marginTop:2}}>{item.forme_juridique||""}</p>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>
          <div style={{background:"#F2F0EF",borderRadius:12,padding:"12px 16px",marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,fontSize:13}}>
            {item.secteur&&<div><span style={{fontSize:10,color:"#9aa5b4",fontWeight:700,textTransform:"uppercase" as const,display:"block",marginBottom:2}}>Secteur</span>{item.secteur.nom}</div>}
            {item.region&&<div><span style={{fontSize:10,color:"#9aa5b4",fontWeight:700,textTransform:"uppercase" as const,display:"block",marginBottom:2}}>Région</span>{item.region}</div>}
            {item.mail&&<div><span style={{fontSize:10,color:"#9aa5b4",fontWeight:700,textTransform:"uppercase" as const,display:"block",marginBottom:2}}>Email</span>{item.mail}</div>}
          </div>
          <p style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:12}}>Historique des contacts ({item.contacts?.length||0})</p>
          {(!item.contacts||item.contacts.length===0) ? (
            <div style={{textAlign:"center",padding:32,color:"#9aa5b4",fontSize:13}}>Aucun contact enregistré.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
              {item.contacts.map((c:any)=>{
                const etat=getEtat(c.etat_avancement); const isOpen=expanded===c.id;
                return (
                  <div key={c.id} style={{background:"#fff",border:"1px solid #C5BFBB",borderRadius:14,overflow:"hidden"}}>
                    <div onClick={()=>setExpanded(isOpen?null:c.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer"}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e",marginBottom:4}}>{c.projet_nom}</div>
                        <div style={{fontSize:12,color:"#9aa5b4"}}>Premier contact : {fmtDate(c.date_premier_contact)}</div>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,background:etat.bg,color:etat.text,padding:"3px 12px",borderRadius:999}}>{etat.label}</span>
                      <button onClick={e=>{e.stopPropagation();onEditContact(c);}} style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"5px 7px"}}><Pencil size={12} style={{color:"#004f91"}}/></button>
                      {isOpen?<ChevronUp size={14} style={{color:"#9aa5b4"}}/>:<ChevronDown size={14} style={{color:"#9aa5b4"}}/>}
                    </div>
                    {isOpen&&(
                      <div style={{borderTop:"1px solid #E8E5E3",padding:"14px 16px"}}>
                        {c.projet_description&&<div style={{marginBottom:12}}><p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Description</p><p style={{fontSize:13,color:"#4a5568"}}>{c.projet_description}</p></div>}
                        {c.commentaires&&<div style={{marginBottom:12}}><p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Commentaires</p><p style={{fontSize:13,color:"#4a5568",lineHeight:1.6}}>{c.commentaires}</p></div>}
                        {c.contraintes&&<div style={{marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><AlertTriangle size={12} style={{color:"#d97706"}}/><p style={{fontSize:10,fontWeight:700,color:"#d97706",textTransform:"uppercase" as const}}>Contraintes</p></div>
                          <div style={{background:"#fef9c3",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#4a5568",lineHeight:1.7,whiteSpace:"pre-line" as const}}>{c.contraintes}</div>
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminProspects() {
  const [onglet,      setOnglet]      = useState<"ciblees"|"contactees">("ciblees");
  const [prospects,   setProspects]   = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [editItem,    setEditItem]    = useState<any>(null);
  const [deleting,    setDeleting]    = useState<string|null>(null);
  const [togglingId,  setTogglingId]  = useState<string|null>(null);
  const [vueItem,     setVueItem]     = useState<any>(null);

  // Modals secondaires
  const [contactModal,   setContactModal]   = useState(false);
  const [contactProspect,setContactProspect]= useState<any>(null);
  const [editContact,    setEditContact]    = useState<any>(null);
  const [historiqueModal,setHistoriqueModal]= useState(false);
  const [historiqueItem, setHistoriqueItem] = useState<any>(null);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const params=new URLSearchParams({per_page:"100",admin:"true"});
      params.append("est_contacte", onglet==="contactees"?"true":"false");
      const res=await fetch(`${API_BASE}/prospects?${params}`);
      const data=await res.json();
      setProspects(data.data||[]); setTotal(data.total||0);
    } catch{} finally{setLoading(false);}
  },[onglet]);

  useEffect(()=>{charger();},[charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (p:any) => { setEditItem(p); setModal(true); };

  const handleDelete = async (id:string) => {
    if (!confirm("Supprimer ce prospect ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/prospects/${id}`,{method:"DELETE"}); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (p:any) => {
    setTogglingId(p.id);
    try {
      await fetch(`${API_BASE}/prospects/${p.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({est_publie:!p.est_publie})});
      charger();
    } finally { setTogglingId(null); }
  };

  const openContact = (p:any, c?:any) => {
    setContactProspect(p); setEditContact(c||null); setContactModal(true);
  };

  const openHistorique = async (p:any) => {
    const res=await fetch(`${API_BASE}/prospects/${p.id}`);
    const data=await res.json();
    setHistoriqueItem(data); setHistoriqueModal(true);
  };

  const openVue = async (p:any) => {
    const res=await fetch(`${API_BASE}/prospects/${p.id}`);
    const data=await res.json();
    setVueItem(data);
  };

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .marquee-p{display:inline-block;animation:marquee-p 7s linear infinite;}
        @keyframes marquee-p{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div>
          <p style={{fontSize:11,fontWeight:700,color:"#E35336",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Administration</p>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Prospects</h1>
          <p style={{color:"#9aa5b4",fontSize:13,marginTop:2}}>{total} prospect{total>1?"s":""}</p>
        </div>
        <button onClick={openCreate} style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#E35336,#c42d1a)",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(227,83,54,0.3)"}}>
          <Plus size={15}/> Ajouter un prospect
        </button>
      </div>

      {/* Onglets */}
      <div style={{display:"flex",gap:4,background:"#F2F0EF",borderRadius:12,padding:4,marginBottom:28,width:"fit-content"}}>
        {[{key:"ciblees",label:"Entreprises ciblées"},{key:"contactees",label:"Entreprises contactées"}].map(o=>(
          <button key={o.key} onClick={()=>setOnglet(o.key as any)} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all 0.2s",background:onglet===o.key?"#fff":"transparent",color:onglet===o.key?"#1a1a2e":"#9aa5b4",boxShadow:onglet===o.key?"0 2px 8px rgba(0,0,0,0.08)":"none"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:200,gap:10,color:"#9aa5b4"}}>
          <Loader2 size={22} style={{animation:"spin 1s linear infinite"}}/>
        </div>
      ) : prospects.length===0 ? (
        <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
          <Building2 size={40} style={{marginBottom:12,opacity:0.25}}/>
          <p style={{fontSize:14,color:"#4a5568"}}>Aucun prospect — cliquez sur "Ajouter" pour commencer.</p>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
          {prospects.map(p=>{
            const estInstalle = p.type_prospect==="entreprise_installee";
            const dernierContact = p.contacts?.[p.contacts.length-1];
            const etat = dernierContact ? getEtat(dernierContact.etat_avancement) : null;
            return (
              <div key={p.id}
                onClick={()=>openVue(p)}
                style={{background:"#fff",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderLeft:`3px solid ${p.est_publie?"#E35336":"#C5BFBB"}`,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(227,83,54,0.12)";ev.currentTarget.style.borderColor="#FFB0A1";}}
                onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor=p.est_publie?"#E35336":"#C5BFBB";}}>

                {/* Nom défilant */}
                <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:3,overflow:"hidden",whiteSpace:"nowrap"}}>
                  <span className="marquee-p">{p.nom}&nbsp;&nbsp;&nbsp;&nbsp;{p.nom}</span>
                </div>

                {/* Forme juridique grisée */}
                {p.forme_juridique&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{p.forme_juridique}</div>}

                {/* Badge type */}
                <div style={{marginBottom:12}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:999,background:estInstalle?"rgba(24,128,56,0.08)":"rgba(54,111,227,0.08)",color:estInstalle?"#188038":"#366FE3",border:`1px solid ${estInstalle?"rgba(24,128,56,0.2)":"rgba(54,111,227,0.2)"}`}}>
                    {estInstalle?"Installée au Sénégal":"Hors Sénégal"}
                  </span>
                  {etat&&<span style={{fontSize:10,fontWeight:700,background:etat.bg,color:etat.text,padding:"2px 8px",borderRadius:999,marginLeft:5}}>{etat.label}</span>}
                </div>

                {/* Boutons */}
                <div style={{display:"flex",flexDirection:"column" as const,gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>openHistorique(p)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#366FE3",fontWeight:600}}>
                      <Clock size={12}/> Historique
                    </button>
                    <button onClick={()=>handleTogglePublie(p)} disabled={togglingId===p.id}
                      style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:p.est_publie?"rgba(21,128,61,0.07)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:p.est_publie?"#15803d":"#6b7280",fontWeight:600}}>
                      {togglingId===p.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:p.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                    </button>
                    <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                      {deleting===p.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                    </button>
                  </div>
                  {onglet==="ciblees"&&(
                    <button onClick={()=>openContact(p)}
                      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(24,128,56,0.07)",border:"1px solid rgba(24,128,56,0.2)",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#188038",fontWeight:700}}>
                      <MessageSquare size={12}/> Enregistrer un contact
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal vue prospect */}
      {vueItem && (
        <div onClick={()=>setVueItem(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
            <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
            <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
              {(() => {
                const p = vueItem;
                const estInstalle = p.type_prospect==="entreprise_installee";
                const LBL = ({children}:{children:string}) => <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>;
                const dernierContact = p.contacts?.[p.contacts.length-1];
                const etat = dernierContact ? getEtat(dernierContact.etat_avancement) : null;
                return (
                  <>
                    {/* Header */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                      <div style={{flex:1,paddingRight:16}}>
                        <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{p.nom}</h2>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                          {p.forme_juridique&&<span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{p.forme_juridique}</span>}
                          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:999,background:estInstalle?"rgba(24,128,56,0.08)":"rgba(54,111,227,0.08)",color:estInstalle?"#188038":"#366FE3",border:`1px solid ${estInstalle?"rgba(24,128,56,0.2)":"rgba(54,111,227,0.2)"}`}}>
                            {estInstalle?"Installée au Sénégal":"Hors Sénégal"}
                          </span>
                          {etat&&<span style={{fontSize:11,fontWeight:700,background:etat.bg,color:etat.text,padding:"2px 9px",borderRadius:999}}>{etat.label}</span>}
                          <span style={{fontSize:11,fontWeight:700,color:p.est_publie?"#15803d":"#9aa5b4",background:p.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{p.est_publie?"Publié":"Non publié"}</span>
                        </div>
                      </div>
                      <button onClick={()=>setVueItem(null)} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
                    </div>

                    {/* Infos principales */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                      {p.date_creation_ent&&(
                        <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>Date de création</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{new Date(p.date_creation_ent+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</p>
                        </div>
                      )}
                      {(p.region_nom||p.siege_pays_nom)&&(
                        <div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>{estInstalle?"Localisation":"Pays du siège"}</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>
                            {estInstalle?[p.arrondissement_nom,p.departement_nom,p.region_nom].filter(Boolean).join(", "):p.siege_pays_nom}
                          </p>
                        </div>
                      )}
                      {p.adresse&&(
                        <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>Adresse</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.adresse}</p>
                        </div>
                      )}
                      {p.telephone&&(
                        <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>Téléphone</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.telephone}</p>
                        </div>
                      )}
                      {p.mail&&(
                        <div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>Email</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.mail}</p>
                        </div>
                      )}
                      {p.point_entree&&(
                        <div style={{background:"rgba(24,128,56,0.05)",borderRadius:10,padding:"12px 14px"}}>
                          <LBL>Point d'entrée APIX</LBL>
                          <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{p.point_entree}</p>
                        </div>
                      )}
                    </div>

                    {/* NAEMA en arborescence */}
                    {(p.secteur||p.branche||p.activite)&&(
                      <div style={{marginBottom:16}}>
                        <LBL>Classification NAEMA</LBL>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                          {p.secteur&&(
                            <div>
                              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:p.branche?5:0}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                                <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{p.secteur.nom}</span>
                              </div>
                              {p.branche&&(
                                <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
                                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:p.activite?4:0}}>
                                    <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                                    <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{p.branche.nom}</span>
                                  </div>
                                  {p.activite&&(
                                    <div style={{paddingLeft:18}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                                        <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                        <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{p.activite.nom}</span>
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
                    {p.points_focaux?.length>0&&(
                      <div style={{marginBottom:16}}>
                        <LBL>Points focaux</LBL>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                          {p.points_focaux.map((pf:any,i:number)=>(
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

                    {/* Dernier contact */}
                    {dernierContact&&(
                      <div style={{marginBottom:16}}>
                        <LBL>Dernier contact</LBL>
                        <div style={{background:"rgba(54,111,227,0.05)",border:"1px solid rgba(54,111,227,0.1)",borderRadius:10,padding:"12px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{dernierContact.projet_nom}</span>
                            <span style={{fontSize:11,fontWeight:700,background:etat?.bg,color:etat?.text,padding:"2px 8px",borderRadius:999}}>{etat?.label}</span>
                          </div>
                          <p style={{fontSize:11,color:"#9aa5b4"}}>{fmtDate(dernierContact.date_premier_contact)}</p>
                          {dernierContact.commentaires&&<p style={{fontSize:12,color:"#4a5568",marginTop:6,lineHeight:1.6}}>{dernierContact.commentaires}</p>}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
                      <button onClick={()=>{setVueItem(null);openEdit(p);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#366FE3",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
                        <Pencil size={13}/> Modifier
                      </button>
                      <button onClick={()=>setVueItem(null)} style={{padding:"9px 18px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ProspectModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger}/>
      <ContactModal open={contactModal} onClose={()=>setContactModal(false)} prospect={contactProspect} editContact={editContact} onSaved={()=>{charger();setHistoriqueItem(null);}}/>
      <HistoriqueModal open={historiqueModal} onClose={()=>setHistoriqueModal(false)} item={historiqueItem}
        onEditContact={c=>{ setContactProspect(historiqueItem); setEditContact(c); setHistoriqueModal(false); setContactModal(true); }}/>
    </div>
  );
}
