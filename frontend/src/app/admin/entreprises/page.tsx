"use client";

import GeoCascadeSelect from "@/components/shared/GeoCascadeSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import NaemaSelect from "@/components/shared/NaemaSelect";
import PaysSelect from "@/components/shared/PaysSelect";
import PhoneInput, { isPhoneComplete, isEmailComplete } from "@/components/shared/PhoneInput";
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
  const [focaux, setFocaux] = useState<any[]>([]);
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
        : []);
    } else {
      setForm({...EMPTY_FORM});
      setFocaux([]);
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
      // Métadonnées /max : validation stricte des préfixes, pas seulement des longueurs
      const { isValidPhoneNumber } = await import("libphonenumber-js/max");
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

  const errStyle = (f: string) => errors[f] ? { borderColor: "#dc2626" } : undefined;
  const Err = ({ f }: { f: string }) => errors[f] ? <span style={{ fontSize: 11, color: "#dc2626", marginTop: 3, display: "block" }}>{errors[f]}</span> : null;
  const btnAjout: any = { fontSize: 11, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.08)", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-google-sans)" };
  // Ajouter n'est possible que si toutes les entrées existantes sont complètes et valides
  const btnAjoutOff = (ok: boolean): any => ok ? btnAjout : { ...btnAjout, opacity: 0.35, cursor: "not-allowed" };

  return (
    <FModal open={open} onClose={onClose} maxWidth={900}
      title={editItem ? "Modifier l'entreprise" : "Nouvelle entreprise"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Sauvegarde…" : editItem ? "Modifier" : "Créer l'entreprise"}
        </FButton>
      </>}>

      {/* Identification */}
      <FSection title="Identification">
        <FGrid cols="2fr 1fr 1fr">
          <div><FLabel>Dénomination sociale *</FLabel><FInput value={form.nom} onChange={e=>update("nom",e.target.value)} placeholder="Nom de l'entreprise" style={errStyle("nom")}/><Err f="nom"/></div>
          <div><FLabel>Forme juridique *</FLabel>
            <FSelect value={form.forme_juridique} onChange={e=>update("forme_juridique",e.target.value)} style={errStyle("forme_juridique")}>
              <option value="">— Sélectionner —</option>
              {FORMES_JURIDIQUES.map(f=><option key={f} value={f}>{f}</option>)}
            </FSelect><Err f="forme_juridique"/>
          </div>
          <div><FLabel>Date de création *</FLabel><FInput type="date" value={form.date_creation} max={new Date().toISOString().split("T")[0]} onChange={e=>update("date_creation",e.target.value)} style={errStyle("date_creation")}/><Err f="date_creation"/></div>
        </FGrid>
      </FSection>

      {/* Siège social */}
      <FSection title="Siège social">
        <FLabel>Pays du siège social</FLabel>
        <PaysSelect
          value={form.siege_pays_nom}
          onChange={nom => update("siege_pays_nom", nom)}
          onChangeId={id => update("siege_pays_id", id)}
          placeholder="Sélectionner le pays du siège social"
        />
      </FSection>

      {/* Localisation Sénégal */}
      <FSection title="Localisation au Sénégal">
        <GeoCascadeSelect
          regionId={form.region_id} departementId={form.departement_id} arrondissementId={form.arrondissement_id}
          onChangeRegion={id=>{update("region_id",id);update("departement_id",null);update("arrondissement_id",null);}}
          onChangeDepartement={id=>{update("departement_id",id);update("arrondissement_id",null);}}
          onChangeArrondissement={id=>update("arrondissement_id",id)}/>
        <div style={{marginTop:14}}><FLabel>Adresse complète *</FLabel><FInput value={form.adresse} onChange={e=>update("adresse",e.target.value)} placeholder="Adresse physique" style={errStyle("adresse")}/><Err f="adresse"/></div>
      </FSection>

      {/* Contact */}
      <FSection title="Contact">
        {/* Téléphones */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <FLabel>Téléphone(s) *</FLabel>
            {(()=>{ const ok=form.telephones.every(isPhoneComplete); return (
              <button onClick={()=>ok&&update("telephones",[...form.telephones,""])} disabled={!ok}
                title={ok?undefined:"Saisissez d'abord un numéro valide"} style={btnAjoutOff(ok)}><Plus size={11}/> Ajouter</button>
            ); })()}
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <FLabel>Email(s) *</FLabel>
            {(()=>{ const ok=form.mails.every(isEmailComplete); return (
              <button onClick={()=>ok&&update("mails",[...form.mails,""])} disabled={!ok}
                title={ok?undefined:"Saisissez d'abord un email valide"} style={btnAjoutOff(ok)}><Plus size={11}/> Ajouter</button>
            ); })()}
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
            {form.mails.map((mail:string, i:number) => (
              <div key={i} style={{display:"flex",gap:6}}>
                <FInput type="email" value={mail} onChange={e=>{const arr=[...form.mails];arr[i]=e.target.value;update("mails",arr);}}
                  placeholder="email@domaine.sn" style={{flex:1}} />
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
        <div><FLabel>Site web</FLabel><FInput value={form.siteweb} onChange={e=>update("siteweb",e.target.value)} placeholder="https://…"/></div>
      </FSection>

      {/* NAEMA */}
      <FSection title="Activité(s) de l'entreprise">
        <NaemaSelect secteurIds={form.secteur_ids||[]} brancheIds={form.branche_ids||[]} activiteIds={form.activite_ids||[]}
          onChangeSecteurs={ids=>update("secteur_ids",ids)} onChangeBranches={ids=>update("branche_ids",ids)} onChangeActivites={ids=>update("activite_ids",ids)}/>
      </FSection>

      {/* Points focaux */}
      <FSection title="Points focaux">
        {focaux.length > 0 && (
          <div style={{display:"flex",flexDirection:"column" as const,gap:12,marginBottom:10}}>
            {focaux.map((pf,i)=>(
              <FPanel key={i}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><User size={13} style={{color:"#004f91"}}/><span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>Point focal {i+1}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a5568",cursor:"pointer"}}>
                      <input type="checkbox" checked={pf.est_principal} onChange={e=>updFocal(i,"est_principal",e.target.checked)}/> Principal
                    </label>
                    <button onClick={()=>setFocaux(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash size={13} style={{color:"#dc2626"}}/></button>
                  </div>
                </div>
                <FGrid cols="auto 1fr 1fr 1fr" gap={10} style={{marginBottom:12}}>
                  <div><FLabel>Civilité</FLabel>
                    <FSelect value={pf.civilite||"Monsieur"} onChange={e=>updFocal(i,"civilite",e.target.value)} style={{minWidth:110}}>
                      <option value="Monsieur">Monsieur</option><option value="Madame">Madame</option>
                    </FSelect>
                  </div>
                  <div><FLabel>Nom *</FLabel><FInput value={pf.nom} onChange={e=>updFocal(i,"nom",e.target.value)} placeholder="Nom"/></div>
                  <div><FLabel>Prénom *</FLabel><FInput value={pf.prenom} onChange={e=>updFocal(i,"prenom",e.target.value)} placeholder="Prénom"/></div>
                  <div><FLabel>Poste</FLabel><FInput value={pf.poste} onChange={e=>updFocal(i,"poste",e.target.value)} placeholder="DG, Dir…"/></div>
                </FGrid>

                {/* Téléphones du focal */}
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <FLabel>Téléphone(s)</FLabel>
                    {(()=>{ const ok=pf.telephones.every(isPhoneComplete); return (
                      <button onClick={()=>ok&&updFocal(i,"telephones",[...pf.telephones,""])} disabled={!ok}
                        title={ok?undefined:"Saisissez d'abord un numéro valide"} style={btnAjoutOff(ok)}><Plus size={10}/> Ajouter</button>
                    ); })()}
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
                    <FLabel>Email(s)</FLabel>
                    {(()=>{ const ok=pf.mails.every(isEmailComplete); return (
                      <button onClick={()=>ok&&updFocal(i,"mails",[...pf.mails,""])} disabled={!ok}
                        title={ok?undefined:"Saisissez d'abord un email valide"} style={btnAjoutOff(ok)}><Plus size={10}/> Ajouter</button>
                    ); })()}
                  </div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                    {pf.mails.map((mail:string, mi:number)=>(
                      <div key={mi} style={{display:"flex",gap:6}}>
                        <FInput type="email" value={mail} onChange={e=>{const arr=[...pf.mails];arr[mi]=e.target.value;updFocal(i,"mails",arr);}}
                          placeholder="email@domaine.sn" style={{flex:1}}/>
                        {pf.mails.length>1&&<button onClick={()=>updFocal(i,"mails",pf.mails.filter((_:any,idx:number)=>idx!==mi))} style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 7px"}}><X size={11} style={{color:"#dc2626"}}/></button>}
                      </div>
                    ))}
                  </div>
                </div>
              </FPanel>
            ))}
          </div>
        )}
        <button onClick={()=>setFocaux(prev=>[...prev,{...EMPTY_FOCAL, est_principal: prev.length===0}])}
          style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 14px",borderRadius:10,cursor:"pointer",border:"2px dashed #E4E1DE",background:"#FAFAF9",transition:"border-color 0.15s",fontFamily:"var(--font-google-sans)"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Plus size={14} color="#9aa5b4"/>
          <span style={{fontSize:13,color:"#9aa5b4"}}>Ajouter un point focal</span>
        </button>
      </FSection>

      {errors.global && <FError>{errors.global}</FError>}
    </FModal>
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

  const fmtD = (d:string) => d ? new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) : "";
  const secIds:number[] = e.secteur_ids||[]; const braIds:number[] = e.branche_ids||[]; const actIds:number[] = e.activite_ids||[];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
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
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{e.nom}</h2>
            {e.forme_juridique&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
                <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#6b7280",background:"#F2F0EF",padding:"3px 10px",borderRadius:999}}>{e.forme_juridique}</span>
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

          {/* Informations */}
          <section>
            <SecTitle>Informations</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {e.date_creation&&<Bloc label="Création"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtD(e.date_creation)}</p></Bloc>}
              {locStr&&<Bloc label="Localisation"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{locStr}</p></Bloc>}
              {e.adresse&&<Bloc label="Adresse"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p></Bloc>}
              {e.siteweb&&<Bloc label="Site web"><a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:12.5,fontWeight:600,color:"#004f91",textDecoration:"none",wordBreak:"break-all" as const}}>{e.siteweb}</a></Bloc>}
            </div>
          </section>

          {/* Contact */}
          {(e.telephone||e.mail)&&(
            <section>
              <SecTitle>Contact</SecTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {e.telephone&&(
                  <Bloc label={e.telephone.includes(",")?"Téléphones":"Téléphone"}>
                    {e.telephone.split(",").map((t:string,i:number)=><p key={i} style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtPhone(t.trim())}</p>)}
                  </Bloc>
                )}
                {e.mail&&(
                  <Bloc label={e.mail.includes(",")?"Emails":"Email"}>
                    {e.mail.split(",").map((m:string,i:number)=><p key={i} style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e",wordBreak:"break-all" as const}}>{m.trim()}</p>)}
                  </Bloc>
                )}
              </div>
            </section>
          )}

          {/* Activités */}
          {hasNaema&&(
            <section>
              <SecTitle>Activités de l&apos;entreprise</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number)=>{
                  const sec=secteurs.find(s=>s.id===secId); if (!sec) return null;
                  const brasDuSec=branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                        {brasDuSec.map((bra:any)=>{
                          const actsDeBra=activites.filter(a=>a.branche_id===bra.id&&actIds.includes(a.id));
                          return (
                            <div key={bra.id}>
                              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
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
            </section>
          )}

          {/* Points focaux */}
          {e.points_focaux?.length>0&&(
            <section>
              <SecTitle>Points focaux</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {e.points_focaux.map((pf:any,i:number)=>(
                  <div key={i} style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"11px 14px",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                      <span style={{fontWeight:700,color:"#1a1a2e"}}>{[pf.civilite,pf.prenom,pf.nom].filter(Boolean).join(" ")}</span>
                      {pf.poste&&<span style={{color:"#9aa5b4"}}>{pf.poste}</span>}
                      {pf.est_principal&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",borderRadius:999,padding:"2px 8px"}}>Principal</span>}
                    </div>
                    {(pf.telephone||pf.mail)&&(
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginTop:7}}>
                        {pf.telephone&&pf.telephone.split(",").map((t:string,ti:number)=>(
                          <span key={`t${ti}`} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{fmtPhone(t.trim())}</span>
                        ))}
                        {pf.mail&&pf.mail.split(",").map((m:string,mi:number)=>(
                          <span key={`m${mi}`} style={{fontSize:11,fontWeight:600,color:"#188038",background:"rgba(24,128,56,0.07)",padding:"3px 10px",borderRadius:999}}>{m.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
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
          <button onClick={()=>{onClose();onEdit(e);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgba(0,79,145,0.25)"}}>
            <Pencil size={13}/> Modifier
          </button>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
          {entreprises.map(e=>(
            <div key={e.id} onClick={()=>setVue(e)}
              style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

              <div style={{height:3,background:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
              <div style={{padding:"14px 16px 14px",flex:1}}>
                {/* Forme juridique + pôle territoire */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12,minWidth:0}}>
                  {e.forme_juridique ? (
                    <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{e.forme_juridique.replace(/\s*\([^)]*\)\s*$/,"")}</span>
                  ) : <span/>}
                  {e.pole_territoire_nom ? (
                    <span title={e.pole_territoire_nom} style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>{e.pole_territoire_nom}</span>
                  ) : <span/>}
                </div>

                {/* Dénomination */}
                <div style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>

                {/* Infos libellées */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                  <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                    <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Création</p>
                    <p style={{fontSize:12,fontWeight:600,color:e.date_creation?"#1a1a2e":"#9aa5b4"}}>{e.date_creation?fmtD(e.date_creation):"—"}</p>
                  </div>
                  <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px",minWidth:0}}>
                    <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Région</p>
                    <p style={{fontSize:12,fontWeight:600,color:e.region_nom?"#1a1a2e":"#9aa5b4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.region_nom||"—"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{display:"flex",alignItems:"stretch",borderTop:"1px solid #F2F0EF"}} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>{setEditItem(e);setModal(true);}}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  <Pencil size={12}/> Modifier
                </button>
                <div style={{width:1,background:"#F2F0EF"}}/>
                <button onClick={()=>handleTogglePublie(e)} disabled={togglingId===e.id}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:e.est_publie?"#188038":"#6b7280",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                  onMouseEnter={ev=>ev.currentTarget.style.background=e.est_publie?"rgba(24,128,56,0.05)":"rgba(156,163,175,0.07)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                  {togglingId===e.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:e.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <div style={{width:1,background:"#F2F0EF"}}/>
                <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id}
                  style={{width:46,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",transition:"background 0.15s"}}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
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
