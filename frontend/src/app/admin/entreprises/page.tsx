"use client";

import LocalisationSelect from "@/components/shared/LocalisationSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import PaysSelect from "@/components/shared/PaysSelect";
import PhoneInput from "@/components/shared/PhoneInput";
import { parsePhoneNumber } from "libphonenumber-js";
import { Building2, Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}

const FORMES_JURIDIQUES = [
  "Société en nom collectif (SNC)", "Société en commandite simple (SCS)",
  "Société à responsabilité limitée (SARL)", "Société Anonyme (SA)",
  "Société par actions simplifiée (SAS)", "Société par actions simplifiée unipersonnelle (SASU)",
  "Société à responsabilité limitée unipersonnelle (SARLU)", "Société en participation",
  "Groupement d'intérêt économique (GIE)", "Coopérative simplifiée",
  "Coopérative avec conseil d'administration", "Entreprise individuelle",
  "Succursale", "Bureau de liaison",
];

const EMPTY_FORM = {
  nom:"", forme_juridique:"", date_creation:"",
  siege_pays_id: null as number|null, siege_pays_nom: "",
  region_id:null as number|null, departement_id:null as number|null, arrondissement_id:null as number|null,
  adresse:"",
  telephones: [""] as string[],
  mails: [""] as string[],
  siteweb:"",
  secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
};
const EMPTY_FOCAL = { civilite:"Monsieur", nom:"", prenom:"", poste:"", telephones:[""] as string[], mails:[""] as string[], est_principal:false };

// ── Modal formulaire ──────────────────────────────────────────────────────────
function EntrepriseModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,   setForm]   = useState<any>({...EMPTY_FORM});
  const [focaux, setFocaux] = useState<any[]>([{...EMPTY_FOCAL}]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const update   = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}));
  const updFocal = (i:number,k:string,v:any) => setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,[k]:v}:f));

  useEffect(()=>{
    if (!open) return;
    setErrors({}); setSaveOk(false);
    if (editItem) {
      setForm({
        nom: editItem.nom||"",
        forme_juridique: editItem.forme_juridique||"",
        date_creation: editItem.date_creation||"",
        siege_pays_id: editItem.siege_pays_id||null,
        siege_pays_nom: editItem.siege_pays_nom||"",
        region_id: editItem.region_id||null,
        departement_id: editItem.departement_id||null,
        arrondissement_id: editItem.arrondissement_id||null,
        adresse: editItem.adresse||"",
        telephones: editItem.telephone ? editItem.telephone.split(",").map((t:string)=>t.trim()).filter(Boolean) : [""],
        mails: editItem.mail ? editItem.mail.split(",").map((m:string)=>m.trim()).filter(Boolean) : [""],
        siteweb: editItem.siteweb||"",
        secteur_ids: editItem.secteur_ids||[],
        branche_ids: editItem.branche_ids||[],
        activite_ids: editItem.activite_ids||[],
      });
      setFocaux(editItem.points_focaux?.length>0
        ? editItem.points_focaux.map((pf:any)=>({
            civilite:pf.civilite||"Monsieur", nom:pf.nom||"", prenom:pf.prenom||"",
            poste:pf.poste||"",
            telephones: pf.telephones?.length ? pf.telephones
              : pf.telephone ? pf.telephone.split(",").map((t:string)=>t.trim()).filter(Boolean)
              : [""],
            mails: pf.mails?.length ? pf.mails
              : pf.mail ? pf.mail.split(",").map((m:string)=>m.trim()).filter(Boolean)
              : [""],
            est_principal:pf.est_principal||false
          }))
        : [{...EMPTY_FOCAL}]);
    } else {
      setForm({...EMPTY_FORM});
      setFocaux([{...EMPTY_FOCAL, est_principal: true}]);
    }
  },[open, editItem?.id]);

  const handleSave = async () => {
    const e: Record<string,string> = {};
    if (!form.nom.trim()) e.nom="Obligatoire";
    if (!form.forme_juridique) e.forme_juridique="Obligatoire";
    if (!form.date_creation) e.date_creation="Obligatoire";
    else if (form.date_creation > new Date().toISOString().split("T")[0]) e.date_creation="Ne peut pas être dans le futur";
    if (!form.adresse.trim()) e.adresse="Obligatoire";

    // Validation téléphones entreprise
    const telsValides = form.telephones.filter(Boolean);
    if (!telsValides.length) {
      e.telephone="Au moins un numéro obligatoire";
    } else {
      const { isValidPhoneNumber } = await import("libphonenumber-js");
      const invalides = telsValides.filter((t:string) => {
        try { return !isValidPhoneNumber(t); } catch { return true; }
      });
      if (invalides.length > 0) e.telephone=`Numéro(s) invalide(s) : ${invalides.join(", ")}`;
    }

    if (!form.mails.filter(Boolean).length) e.mail="Au moins un email obligatoire";

    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const payload:any = {
        nom: form.nom,
        forme_juridique: form.forme_juridique||null,
        date_creation: form.date_creation||null,
        siege_pays_id: form.siege_pays_id||null,
        region_id: form.region_id||null,
        departement_id: form.departement_id||null,
        arrondissement_id: form.arrondissement_id||null,
        adresse: form.adresse||null,
        telephone: form.telephones.filter(Boolean).join(", ")||null,
        mail: form.mails.filter(Boolean).join(", ")||null,
        siteweb: form.siteweb||null,
        secteur_ids: form.secteur_ids||[],
        branche_ids: form.branche_ids||[],
        activite_ids: form.activite_ids||[],
        est_publie: true,
      };
      const pf = focaux.filter(f=>f.nom.trim()).map(f=>({
        civilite:f.civilite||"Monsieur", nom:f.nom, prenom:f.prenom,
        poste:f.poste,
        telephone: f.telephones.filter(Boolean).join(", ")||null,
        mail: f.mails.filter(Boolean).join(", ")||null,
        est_principal:f.est_principal
      }));
      if (!editItem) payload.points_focaux = pf;

      const url = editItem?`${API_BASE}/entreprises/${editItem.id}`:`${API_BASE}/entreprises`;
      const res = await fetch(url,{method:editItem?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true); setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(err:any){ setErrors({global:err.message||"Erreur"}); } finally { setSaving(false); }
  };

  const IS=(field?:string):any=>({width:"100%",background:"#F2F0EF",border:`1px solid ${field&&errors[field]?"#dc2626":"#C5BFBB"}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const});
  const LS=(field?:string):any=>({fontSize:12,fontWeight:600,color:field&&errors[field]?"#dc2626":"#4a5568",marginBottom:4,display:"block"});
  const SS:any={fontSize:11,fontWeight:700,color:"#ca631f",letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #E8E5E3"};
  const Err=({f}:{f:string})=>errors[f]?<span style={{fontSize:11,color:"#dc2626",marginTop:2,display:"block"}}>{errors[f]}</span>:null;

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:900,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e"}}>{editItem?"Modifier l'entreprise":"Nouvelle entreprise"}</h2>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>

          <div style={{display:"flex",flexDirection:"column" as const,gap:20}}>

            {/* Identification */}
            <div><p style={SS}>Identification</p>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>
                <div><label style={LS("nom")}>Dénomination sociale *</label><input value={form.nom} onChange={e=>update("nom",e.target.value)} placeholder="Nom de l'entreprise" style={IS("nom")}/><Err f="nom"/></div>
                <div><label style={LS("forme_juridique")}>Forme juridique *</label>
                  <select value={form.forme_juridique} onChange={e=>update("forme_juridique",e.target.value)} style={{...IS("forme_juridique"),cursor:"pointer"}}>
                    <option value="">— Sélectionner —</option>
                    {FORMES_JURIDIQUES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select><Err f="forme_juridique"/>
                </div>
                <div><label style={LS("date_creation")}>Date de création *</label><input type="date" value={form.date_creation} max={new Date().toISOString().split("T")[0]} onChange={e=>update("date_creation",e.target.value)} style={IS("date_creation")}/><Err f="date_creation"/></div>
              </div>
            </div>

            {/* Siège social */}
            <div><p style={SS}>Siège social</p>
              <div>
                <label style={LS()}>Pays du siège social</label>
                <PaysSelect
                  value={form.siege_pays_nom}
                  onChange={nom => update("siege_pays_nom", nom)}
                  onChangeId={id => update("siege_pays_id", id)}
                  placeholder="Sélectionner le pays du siège social"
                />
              </div>
            </div>

            {/* Localisation Sénégal */}
            <div><p style={SS}>Localisation au Sénégal</p>
              <LocalisationSelect
                regionId={form.region_id} departementId={form.departement_id} arrondissementId={form.arrondissement_id}
                onChangeRegion={id=>{update("region_id",id);update("departement_id",null);update("arrondissement_id",null);}}
                onChangeDepartement={id=>{update("departement_id",id);update("arrondissement_id",null);}}
                onChangeArrondissement={id=>update("arrondissement_id",id)}/>
              <div style={{marginTop:12}}><label style={LS("adresse")}>Adresse complète *</label><input value={form.adresse} onChange={e=>update("adresse",e.target.value)} placeholder="Adresse physique" style={IS("adresse")}/><Err f="adresse"/></div>
            </div>

            {/* Contact */}
            <div><p style={SS}>Contact</p>
              {/* Téléphones */}
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <label style={LS("telephone")}>Téléphone(s) *</label>
                  <button onClick={()=>update("telephones",[...form.telephones,""])}
                    style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"none",borderRadius:6,padding:"3px 9px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                    <Plus size={11}/> Ajouter
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {form.telephones.map((tel:string, i:number) => (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                      <div style={{flex:1}}>
                        <PhoneInput value={tel} onChange={v=>{const arr=[...form.telephones];arr[i]=v;update("telephones",arr);}} placeholder="Numéro" />
                      </div>
                      {form.telephones.length > 1 && (
                        <button onClick={()=>update("telephones",form.telephones.filter((_:any,idx:number)=>idx!==i))}
                          style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 8px",flexShrink:0,marginTop:1}}>
                          <X size={12} style={{color:"#dc2626"}}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Err f="telephone"/>
              </div>

              {/* Emails */}
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <label style={LS("mail")}>Email(s) *</label>
                  <button onClick={()=>update("mails",[...form.mails,""])}
                    style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"none",borderRadius:6,padding:"3px 9px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                    <Plus size={11}/> Ajouter
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                  {form.mails.map((mail:string, i:number) => (
                    <div key={i} style={{display:"flex",gap:6}}>
                      <input type="email" value={mail} onChange={e=>{const arr=[...form.mails];arr[i]=e.target.value;update("mails",arr);}}
                        placeholder="email@domaine.sn" style={{...IS(),flex:1}} />
                      {form.mails.length > 1 && (
                        <button onClick={()=>update("mails",form.mails.filter((_:any,idx:number)=>idx!==i))}
                          style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 8px",flexShrink:0}}>
                          <X size={12} style={{color:"#dc2626"}}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Err f="mail"/>
              </div>

              {/* Site web */}
              <div><label style={LS()}>Site web</label><input value={form.siteweb} onChange={e=>update("siteweb",e.target.value)} placeholder="https://..." style={IS()}/></div>
            </div>

            {/* NAEMA */}
            <div><p style={SS}>Activité(s) de l&apos;entreprise</p>
              <NaemaSelect secteurIds={form.secteur_ids||[]} brancheIds={form.branche_ids||[]} activiteIds={form.activite_ids||[]}
                onChangeSecteurs={ids=>update("secteur_ids",ids)} onChangeBranches={ids=>update("branche_ids",ids)} onChangeActivites={ids=>update("activite_ids",ids)}/>
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
                      <div style={{display:"flex",alignItems:"center",gap:6}}><User size={13} style={{color:"#ca631f"}}/><span style={{fontSize:12,fontWeight:600,color:"#4a5568"}}>Contact — {i+1}</span></div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a5568",cursor:"pointer"}}>
                          <input type="checkbox" checked={pf.est_principal} onChange={e=>updFocal(i,"est_principal",e.target.checked)}/> Principal
                        </label>
                        {focaux.length>1&&<button onClick={()=>setFocaux(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash size={13} style={{color:"#dc2626"}}/></button>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Civilité</label>
                        <select value={pf.civilite||"Monsieur"} onChange={e=>updFocal(i,"civilite",e.target.value)} style={{background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",cursor:"pointer",minWidth:110}}>
                          <option value="Monsieur">Monsieur</option><option value="Madame">Madame</option>
                        </select>
                      </div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Nom *</label><input value={pf.nom} onChange={e=>updFocal(i,"nom",e.target.value)} placeholder="Nom" style={{background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",width:"100%",boxSizing:"border-box" as const}}/></div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Prénom *</label><input value={pf.prenom} onChange={e=>updFocal(i,"prenom",e.target.value)} placeholder="Prénom" style={{background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",width:"100%",boxSizing:"border-box" as const}}/></div>
                      <div><label style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:3,display:"block"}}>Poste</label><input value={pf.poste} onChange={e=>updFocal(i,"poste",e.target.value)} placeholder="DG, Dir..." style={{background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",width:"100%",boxSizing:"border-box" as const}}/></div>
                    </div>

                    {/* Téléphones du focal */}
                    <div style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <label style={{fontSize:11,fontWeight:600,color:"#4a5568"}}>Téléphone(s)</label>
                        <button onClick={()=>updFocal(i,"telephones",[...pf.telephones,""])}
                          style={{fontSize:10,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"none",borderRadius:5,padding:"2px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                          <Plus size={10}/> Ajouter
                        </button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                        {pf.telephones.map((tel:string, ti:number)=>(
                          <div key={ti} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                            <div style={{flex:1}}>
                              <PhoneInput value={tel} onChange={v=>{const arr=[...pf.telephones];arr[ti]=v;updFocal(i,"telephones",arr);}} placeholder="Numéro"/>
                            </div>
                            {pf.telephones.length>1&&<button onClick={()=>updFocal(i,"telephones",pf.telephones.filter((_:any,idx:number)=>idx!==ti))} style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 7px",marginTop:1}}><X size={11} style={{color:"#dc2626"}}/></button>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Emails du focal */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <label style={{fontSize:11,fontWeight:600,color:"#4a5568"}}>Email(s)</label>
                        <button onClick={()=>updFocal(i,"mails",[...pf.mails,""])}
                          style={{fontSize:10,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"none",borderRadius:5,padding:"2px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                          <Plus size={10}/> Ajouter
                        </button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                        {pf.mails.map((mail:string, mi:number)=>(
                          <div key={mi} style={{display:"flex",gap:6}}>
                            <input type="email" value={mail} onChange={e=>{const arr=[...pf.mails];arr[mi]=e.target.value;updFocal(i,"mails",arr);}}
                              placeholder="email@domaine.sn"
                              style={{flex:1,background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)"}}/>
                            {pf.mails.length>1&&<button onClick={()=>updFocal(i,"mails",pf.mails.filter((_:any,idx:number)=>idx!==mi))} style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 7px"}}><X size={11} style={{color:"#dc2626"}}/></button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errors.global&&<div style={{background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>{errors.global}</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||saveOk}
                style={{padding:"10px 24px",borderRadius:10,border:"none",background:saveOk?"#dcfce7":"linear-gradient(135deg,#ca631f,#a84e18)",color:saveOk?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
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

// ── Vue entreprise (inchangée) ────────────────────────────────────────────────
function EntrepriseVue({ ent:e, onClose, onEdit }: { ent:any; onClose:()=>void; onEdit:(e:any)=>void }) {
  const [secteurs, setSecteurs]   = useState<any[]>([]);
  const [branches, setBranches]   = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(()=>{
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,a])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(a||[]); }).catch(()=>{});
  },[e.id]);

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  const fmtD = (d:string) => d ? new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : "";
  const secIds:number[] = e.secteur_ids||[]; const braIds:number[] = e.branche_ids||[]; const actIds:number[] = e.activite_ids||[];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:38,height:38,borderRadius:10,background:"rgba(202,99,31,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Building2 size={18} style={{color:"#ca631f"}}/>
                </div>
                <div>
                  <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:2}}>{e.nom}</h2>
                  {e.forme_juridique&&<span style={{fontSize:11,color:"#9aa5b4",fontWeight:500}}>{e.forme_juridique}</span>}
                </div>
              </div>
              <span style={{fontSize:11,fontWeight:700,color:e.est_publie?"#15803d":"#9aa5b4",background:e.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{e.est_publie?"Publié":"Non publié"}</span>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {e.date_creation&&<div style={{background:"rgba(0,79,145,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date de création</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtD(e.date_creation)}</p></div>}
            {e.adresse&&<div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Adresse</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p></div>}
            {e.telephone&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Téléphone(s)</LBL>{e.telephone.split(",").map((t:string,i:number)=><p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtPhone(t.trim())}</p>)}</div>}
            {e.mail&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Email(s)</LBL>{e.mail.split(",").map((m:string,i:number)=><p key={i} style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{m.trim()}</p>)}</div>}
            {locStr&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Localisation</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p></div>}
            {e.siteweb&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Site web</LBL><a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#1a1a2e",textDecoration:"none"}}>{e.siteweb}</a></div>}
          </div>

          {hasNaema&&<div style={{marginBottom:16}}>
            <LBL>Activité(s) de l&apos;entreprise</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {secIds.map((secId:number)=>{
                const sec=secteurs.find(s=>s.id===secId); if (!sec) return null;
                const brasDuSec=branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                return (
                  <div key={secId}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:"#ca631f"}}>{sec.nom}</span>
                    </div>
                    {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(202,99,31,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                      {brasDuSec.map((bra:any)=>{
                        const actsDeBra=activites.filter(a=>a.branche_id===bra.id&&actIds.includes(a.id));
                        return (
                          <div key={bra.id}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:"#004f91"}}>{bra.nom}</span>
                            </div>
                            {actsDeBra.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                              {actsDeBra.map((act:any)=>(
                                <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                  <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/><span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
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
          </div>}

          {e.points_focaux?.length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Points focaux</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {e.points_focaux.map((pf:any,i:number)=>(
                  <div key={i} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap" as const}}>
                      <span style={{fontWeight:700,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</span>
                      {pf.poste&&<span style={{color:"#9aa5b4"}}>— {pf.poste}</span>}
                      {pf.est_principal&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",borderRadius:999,padding:"1px 7px"}}>Principal</span>}
                    </div>
                    {pf.telephone&&<div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:6}}>
                      {pf.telephone.split(",").map((t:string,ti:number)=>(
                        <span key={ti} style={{fontSize:11,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.08)",border:"1px solid rgba(54,111,227,0.2)",padding:"2px 9px",borderRadius:999}}>{fmtPhone(t.trim())}</span>
                      ))}
                    </div>}
                    {pf.mail&&<div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:5}}>
                      {pf.mail.split(",").map((m:string,mi:number)=>(
                        <span key={mi} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.08)",border:"1px solid rgba(24,128,56,0.2)",padding:"2px 9px",borderRadius:999}}>{m.trim()}</span>
                      ))}
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(e);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#ca631f,#a0521a)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}><Pencil size={13}/> Modifier</button>
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Entreprises installées</h1>
          <span style={{fontSize:14,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"3px 12px",borderRadius:999}}>{total}</span>
        </div>
        <button onClick={()=>{setEditItem(null);setModal(true);}} style={{display:"flex",alignItems:"center",gap:8,background:"#004f91",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,79,145,0.3)"}}>
          <Plus size={15}/> Ajouter une entreprise
        </button>
      </div>

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
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
          {entreprises.map(e=>(
            <div key={e.id} onClick={()=>setVue(e)}
              style={{background:"#fff",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderLeft:"3px solid #004f91",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(0,79,145,0.12)"; ev.currentTarget.style.borderColor="#004f91";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.borderColor="#E8E5E3"; ev.currentTarget.style.borderLeftColor="#004f91";}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:e.forme_juridique?2:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
              {e.forme_juridique&&<div style={{fontSize:11,color:"#9aa5b4",fontWeight:500,marginBottom:10}}>{e.forme_juridique}</div>}
              <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                {e.date_creation&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><div style={{width:6,height:6,borderRadius:"50%",background:"#4a5568",flexShrink:0}}/><span style={{color:"#4a5568"}}>{fmtD(e.date_creation)}</span></div>}
                {e.adresse&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><div style={{width:6,height:6,borderRadius:"50%",background:"#4a5568",flexShrink:0}}/><span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.adresse}</span></div>}
              </div>
              <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>{setEditItem(e);setModal(true);}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#ca631f",fontWeight:600}}><Pencil size={12}/> Modifier</button>
                <button onClick={()=>handleTogglePublie(e)} disabled={togglingId===e.id} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:e.est_publie?"rgba(24,128,56,0.08)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:e.est_publie?"#188038":"#6b7280",fontWeight:600}}>
                  {togglingId===e.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:e.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id} style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
                  {deleting===e.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vue&&<EntrepriseVue ent={vue} onClose={()=>setVue(null)} onEdit={e=>{setVue(null);setEditItem(e);setModal(true);}}/>}
      <EntrepriseModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger}/>
    </div>
  );
}
