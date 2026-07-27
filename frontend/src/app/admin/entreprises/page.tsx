"use client";

import GeoCascadeSelect from "@/components/shared/GeoCascadeSelect";
import { FModal, FSection, FGrid, FPanel, FLabel, FInput, FSelect, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import NaemaSelect from "@/components/shared/NaemaSelect";
import PaysSelect from "@/components/shared/PaysSelect";
import PhoneInput, { isPhoneComplete, isEmailComplete, isContactComplete, listePreteAjout, doublonsDans, contactsPartages, normPhone, normEmail } from "@/components/shared/PhoneInput";
import { Building2, Eye, EyeOff, Loader2, Pencil, Plus, Trash, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import BarreTitre from "@/components/shared/BarreTitre";
import AdminMenu from "@/components/admin/AdminMenu";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fetchTous } from "@/lib/fetchTous";
import { fmtDate } from "@/lib/format";
import { badgePole, poleAccent, badge_gris } from "@/lib/couleurs";

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

// Extrait le domaine de base d'une saisie libre (URL complète, avec ou sans schéma,
// avec chemin/paramètres, www., sous-domaines…) → « atlassian.com », « gouv.sn »…
// Retourne null si la saisie ne contient pas un nom de domaine valide.
function extraireDomaine(input: string): string | null {
  const v = (input || "").trim();
  if (!v) return null;
  let host = "";
  try { host = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v) ? v : `https://${v}`).hostname.toLowerCase(); }
  catch { return null; }
  host = host.replace(/^www\./, "");
  // Nom de domaine valide : labels alphanumériques (tirets internes), TLD alphabétique ≥ 2
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  // Suffixes publics à deux niveaux courants (.co.uk, .com.br, .gouv.sn…) : garder 3 labels
  const SLD = new Set(["co","com","org","net","gov","gouv","edu","ac","mil","asso","int"]);
  const keep = labels[labels.length-1].length === 2 && SLD.has(labels[labels.length-2]) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

// ── Modal formulaire ──────────────────────────────────────────────────────────
function EntrepriseModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,   setForm]   = useState<any>({...EMPTY_FORM});
  const [focaux, setFocaux] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  // Pôle territorial : filtre de saisie (non stocké) — restreint les régions à celles du pôle
  const [poles,  setPoles]  = useState<any[]>([]);
  const [poleId, setPoleId] = useState<number|null>(null);

  const update   = (k:string,v:any) => setForm((f:any)=>({...f,[k]:v}));
  const updFocal = (i:number,k:string,v:any) => setFocaux(prev=>prev.map((f,idx)=>idx===i?{...f,[k]:v}:f));

  useEffect(()=>{
    fetch(`${API_BASE}/zones-types/poles`).then(r=>r.json()).then(d=>setPoles(Array.isArray(d)?d:[])).catch(()=>{});
  },[]);

  // En édition : présélectionner le pôle qui contient la région de l'entreprise
  useEffect(()=>{
    if (!open) return;
    if (editItem?.region_id && poles.length) {
      const p = poles.find((px:any)=>(px.region_ids||[]).includes(editItem.region_id));
      setPoleId(p?.id ?? null);
    } else if (!editItem) {
      setPoleId(null);
    }
  },[open, editItem?.id, poles]);

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
      else {
        const telsDoubles = doublonsDans(telsValides, normPhone);
        if (telsDoubles.length > 0) e.telephone=`Numéro(s) en double : ${telsDoubles.join(", ")}`;
      }
    }

    // Validation emails entreprise (format standard exigé)
    const mailsValides = form.mails.filter(Boolean);
    if (!mailsValides.length) e.mail="Au moins un email obligatoire";
    else {
      const mailsInvalides = mailsValides.filter((m:string)=>!isEmailComplete(m));
      if (mailsInvalides.length > 0) e.mail=`Email(s) invalide(s) : ${mailsInvalides.join(", ")}`;
      else {
        const mailsDoubles = doublonsDans(mailsValides, normEmail);
        if (mailsDoubles.length > 0) e.mail=`Email(s) en double : ${mailsDoubles.join(", ")}`;
      }
    }

    // Validation contacts des points focaux
    const pfMailsInvalides = focaux.flatMap(f=>f.mails.filter(Boolean).filter((m:string)=>!isEmailComplete(m)));
    if (pfMailsInvalides.length > 0) e.global=`Email(s) de point focal invalide(s) : ${pfMailsInvalides.join(", ")}`;
    else {
      const partages = contactsPartages(focaux);
      if (partages.length > 0) e.global=`Téléphone(s) ou email(s) en double entre points focaux : ${partages.join(", ")}`;
    }

    // Validation + normalisation du site web (on ne stocke que le domaine de base)
    let siteweb = form.siteweb?.trim() || "";
    if (siteweb) {
      const dom = extraireDomaine(siteweb);
      if (!dom) e.siteweb="Site web invalide — saisissez une adresse du type exemple.com";
      else siteweb = dom;
    }

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
        siteweb: siteweb||null,
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
      const res = await fetch(url,{method:editItem?"PATCH":"POST",headers:{"Content-Type":"application/json", ...(await authHeaders())},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true); setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(err:any){ setErrors({global:err.message||"Erreur"}); } finally { setSaving(false); }
  };

  const errStyle = (f: string) => errors[f] ? { borderColor: "#dc2626" } : undefined;
  const Err = ({ f }: { f: string }) => errors[f] ? <span style={{ fontSize: 11, color: "#dc2626", marginTop: 3, display: "block" }}>{errors[f]}</span> : null;
  // Bouton « + » rond en pointillés — ajout d'une entrée (grisé tant que la
  // précédente n'est pas complète et valide)
  const BtnPlus = ({ ok, onClick, title }: { ok: boolean; onClick: () => void; title?: string }) => (
    <button onClick={()=>ok&&onClick()} disabled={!ok} title={ok?(title||"Ajouter"):(title||"Complétez d'abord l'entrée précédente")}
      style={{ width:24, height:24, borderRadius:999, border:`1.5px dashed ${ok?"rgba(0,79,145,0.35)":"#D8D4D0"}`,
        background:"rgba(255,255,255,0.7)", color:ok?"#004f91":"#C5BFBB", cursor:ok?"pointer":"not-allowed",
        display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}
      onMouseEnter={e=>{ if(ok){ e.currentTarget.style.borderColor="#004f91"; e.currentTarget.style.background="rgba(0,79,145,0.08)"; } }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=ok?"rgba(0,79,145,0.35)":"#D8D4D0"; e.currentTarget.style.background="rgba(255,255,255,0.7)"; }}>
      <Plus size={13}/>
    </button>
  );

  const nbErreurs = Object.keys(errors).length;

  return (
    <FModal open={open} onClose={onClose} maxWidth={900}
      title={editItem ? "Modifier l'entreprise" : "Nouvelle entreprise"}
      subtitle={editItem ? editItem.nom : "Les champs marqués * sont obligatoires"}
      footer={<>
        {(errors.global || nbErreurs > 0) && (
          <FError style={{ flex:1, minWidth:0 }}>
            {errors.global || "Corrigez les champs signalés en rouge avant d'enregistrer."}
          </FError>
        )}
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

      {/* Siège & localisation au Sénégal */}
      <FSection title="Siège & localisation">
        <FGrid cols={2} style={{marginBottom:14}}>
          <div>
            <FLabel>Pays du siège social</FLabel>
            <PaysSelect
              value={form.siege_pays_nom}
              onChange={nom => update("siege_pays_nom", nom)}
              onChangeId={id => update("siege_pays_id", id)}
              placeholder="Sélectionner le pays du siège social"
            />
          </div>
          <div>
            <FLabel>Pôle territorial *</FLabel>
            <FSelect value={poleId||""} onChange={e=>{
              const id = e.target.value ? parseInt(e.target.value) : null;
              setPoleId(id);
              // Le pôle change : la localisation repart de zéro, restreinte à ses régions
              update("region_id",null); update("departement_id",null); update("arrondissement_id",null);
            }}>
              <option value="">— Sélectionner un pôle d&apos;abord —</option>
              {poles.map((p:any)=>(
                <option key={p.id} value={p.id}>{p.pole_territoire}{p.localisation?` — ${p.localisation}`:""}</option>
              ))}
            </FSelect>
          </div>
        </FGrid>
        {(()=>{ const poleRegionIds: number[] = poles.find((p:any)=>p.id===poleId)?.region_ids || []; return (
        <div style={{opacity: poleId?1:0.45, pointerEvents: poleId?"auto":"none", transition:"opacity 0.2s"}}>
          <GeoCascadeSelect
            regionId={form.region_id} departementId={form.departement_id} arrondissementId={form.arrondissement_id}
            filterRegionIds={poleRegionIds.length>0?poleRegionIds:undefined}
            onChangeRegion={id=>{update("region_id",id);update("departement_id",null);update("arrondissement_id",null);}}
            onChangeDepartement={id=>{update("departement_id",id);update("arrondissement_id",null);}}
            onChangeArrondissement={id=>update("arrondissement_id",id)}/>
        </div>
        ); })()}
        <div style={{marginTop:14}}><FLabel>Adresse complète *</FLabel><FInput value={form.adresse} onChange={e=>update("adresse",e.target.value)} placeholder="Adresse physique" style={errStyle("adresse")}/><Err f="adresse"/></div>
      </FSection>

      {/* Contact : téléphones, emails et site web sur la même ligne */}
      <FSection title="Contact">
        <FGrid cols={3} style={{alignItems:"start"}}>
          {/* Téléphones */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <FLabel>Téléphone(s) *</FLabel>
              <BtnPlus ok={listePreteAjout(form.telephones, isPhoneComplete, normPhone)}
                onClick={()=>update("telephones",[...form.telephones,""])} title="Ajouter un numéro"/>
            </div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {form.telephones.map((tel:string, i:number) => (
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
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
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <FLabel>Email(s) *</FLabel>
              <BtnPlus ok={listePreteAjout(form.mails, isEmailComplete, normEmail)}
                onClick={()=>update("mails",[...form.mails,""])} title="Ajouter un email"/>
            </div>
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {form.mails.map((mail:string, i:number) => (
                <div key={i} style={{display:"flex",gap:6}}>
                  <FInput type="email" value={mail} onChange={e=>{const arr=[...form.mails];arr[i]=e.target.value;update("mails",arr);}}
                    placeholder="email@domaine.sn" style={{flex:1, ...(mail&&(!isEmailComplete(mail)||form.mails.slice(0,i).some((m:string)=>normEmail(m)===normEmail(mail)))?{borderColor:"#dc2626"}:{})}} />
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

          {/* Site web — normalisé au domaine de base dès la sortie du champ */}
          <div>
            {/* même hauteur d'en-tête que les colonnes voisines (bouton +) */}
            <div style={{display:"flex",alignItems:"center",minHeight:24,marginBottom:6}}>
              <FLabel>Site web</FLabel>
            </div>
            <FInput value={form.siteweb} onChange={e=>update("siteweb",e.target.value)}
              onBlur={()=>{ const v=form.siteweb?.trim(); if(v){ const d=extraireDomaine(v); if(d) update("siteweb",d); } }}
              placeholder="www.exemple.com" style={errStyle("siteweb")}/>
            <Err f="siteweb"/>
          </div>
        </FGrid>
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
                  <div><FLabel>Poste</FLabel><FInput value={pf.poste} onChange={e=>updFocal(i,"poste",e.target.value)} /></div>
                </FGrid>

                {/* Contacts du focal : téléphones et emails côte à côte */}
                <FGrid cols={2} style={{alignItems:"start"}}>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <FLabel>Téléphone(s)</FLabel>
                      <BtnPlus ok={listePreteAjout(pf.telephones, isPhoneComplete, normPhone)}
                        onClick={()=>updFocal(i,"telephones",[...pf.telephones,""])} title="Ajouter un numéro"/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                      {pf.telephones.map((tel:string, ti:number)=>(
                        <div key={ti} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                          <div style={{flex:1,minWidth:0}}>
                            <PhoneInput value={tel} onChange={v=>{const arr=[...pf.telephones];arr[ti]=v;updFocal(i,"telephones",arr);}} placeholder="Numéro"/>
                          </div>
                          {pf.telephones.length>1&&<button onClick={()=>updFocal(i,"telephones",pf.telephones.filter((_:any,idx:number)=>idx!==ti))} style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 7px",marginTop:1}}><X size={11} style={{color:"#dc2626"}}/></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <FLabel>Email(s)</FLabel>
                      <BtnPlus ok={listePreteAjout(pf.mails, isEmailComplete, normEmail)}
                        onClick={()=>updFocal(i,"mails",[...pf.mails,""])} title="Ajouter un email"/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                      {pf.mails.map((mail:string, mi:number)=>(
                        <div key={mi} style={{display:"flex",gap:6}}>
                          <FInput type="email" value={mail} onChange={e=>{const arr=[...pf.mails];arr[mi]=e.target.value;updFocal(i,"mails",arr);}}
                            placeholder="email@domaine.sn" style={{flex:1, ...(mail&&(!isEmailComplete(mail)||pf.mails.slice(0,mi).some((m:string)=>normEmail(m)===normEmail(mail)))?{borderColor:"#dc2626"}:{})}}/>
                          {pf.mails.length>1&&<button onClick={()=>updFocal(i,"mails",pf.mails.filter((_:any,idx:number)=>idx!==mi))} style={{background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:6,padding:"9px 7px"}}><X size={11} style={{color:"#dc2626"}}/></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                </FGrid>
              </FPanel>
            ))}
          </div>
        )}
        {(()=>{ const ok=focaux.every(pf=>isContactComplete({...pf, civilite: pf.civilite||"Monsieur"},["civilite","nom","prenom"])) && contactsPartages(focaux).length===0; return (
        <button onClick={()=>ok&&setFocaux(prev=>[...prev,{...EMPTY_FOCAL, est_principal: prev.length===0}])} disabled={!ok}
          title={ok?undefined:"Complétez d'abord le point focal précédent (civilité, nom, prénom, téléphone et email valides)"}
          style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 14px",borderRadius:10,cursor:ok?"pointer":"not-allowed",opacity:ok?1:0.45,border:"2px dashed #E4E1DE",background:"#FAFAF9",transition:"border-color 0.15s",fontFamily:"var(--font-google-sans)"}}
          onMouseEnter={e=>{if(ok)e.currentTarget.style.borderColor="#004f91";}}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
          <Plus size={14} color="#9aa5b4"/>
          <span style={{fontSize:13,color:"#9aa5b4"}}>Ajouter un point focal</span>
        </button>
        ); })()}
      </FSection>
    </FModal>
  );
}
// ── Carte entreprise (gabarit public + barre d'actions d'administration) ──────
function CarteEntreprise({ e, onVoir, onEditer, onPublier, onSupprimer, publiant, supprimant }: {
  e: any; onVoir: () => void; onEditer: () => void; onPublier: () => void; onSupprimer: () => void;
  publiant: boolean; supprimant: boolean;
}) {
  // Couleur du pôle territoire : jetons partagés du design system.
  const accentPole = poleAccent(e.pole_territoire_nom || "");
  return (
    <div onClick={onVoir}
      style={{ background: "#fff", border: "1px solid rgba(16,26,46,0.12)", borderRadius: 16, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "none", display: "flex", flexDirection: "column" as const, overflow: "hidden", opacity: e.est_publie === false ? 0.85 : 1 }}
      onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "var(--ombre-1)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = accentPole; }}
      onMouseLeave={ev => { ev.currentTarget.style.boxShadow = "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = "rgba(16,26,46,0.12)"; }}>

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Dénomination + forme juridique | publication & pôle territoire */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1a1a2e", lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{e.nom}</div>
            {e.forme_juridique && <div style={{ fontSize: 11, fontWeight: 500, color: "#9aa5b4", marginTop: 3 }}>{e.forme_juridique.replace(/\s*\([^)]*\)\s*$/, "")}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexShrink: 1, justifyContent: "flex-end" }}>
            {e.est_publie === false && <span style={{ ...badge_gris, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Non publié</span>}
            {e.pole_territoire_nom && (
              <span title={e.pole_territoire_nom} style={{ ...badgePole(e.pole_territoire_nom), whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>
                {e.pole_territoire_nom}
              </span>
            )}
          </div>
        </div>

        {/* Date de création · Région en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #F2F0EF", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Date de création</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: e.date_creation ? "#1a1a2e" : "#C5BFBB", fontVariantNumeric: "tabular-nums" }}>{e.date_creation ? fmtDate(e.date_creation) : "—"}</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#F2F0EF", margin: "0 18px" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Région</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: e.region_nom ? "#1a1a2e" : "#C5BFBB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{e.region_nom || "—"}</p>
          </div>
        </div>
      </div>

      {/* Actions d'administration */}
      <div className="ro-w" style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid #F2F0EF" }} onClick={ev => ev.stopPropagation()}>
        <button onClick={onEditer}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          <Pencil size={12} /> Modifier
        </button>
        <div style={{ width: 1, background: "#F2F0EF" }} />
        <button onClick={onPublier} disabled={publiant}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: e.est_publie ? "#188038" : "#ca631f", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = e.est_publie ? "rgba(24,128,56,0.05)" : "rgba(202,99,31,0.06)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {publiant ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : e.est_publie ? <><EyeOff size={12} /> Retirer</> : <><Eye size={12} /> Publier</>}
        </button>
        <div style={{ width: 1, background: "#F2F0EF" }} />
        <button onClick={onSupprimer} disabled={supprimant} title="Supprimer"
          style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = "rgba(220,38,38,0.05)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {supprimant ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminEntreprises() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [erreur,      setErreur]      = useState(false);
  const [modal,       setModal]       = useState(false);
  const [editItem,    setEditItem]    = useState<any>(null);
  const [vue,         setVue]         = useState<any>(null);
  const [deleting,    setDeleting]    = useState<string|null>(null);
  const [togglingId,  setTogglingId]  = useState<string|null>(null);

  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
    try {
      // Pagination complète : la liste n'est pas tronquée au-delà de 100 fiches.
      setEntreprises(await fetchTous(`${API_BASE}/entreprises?admin=true`));
    } catch (e) { console.error(e); setErreur(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (e: any) => { setEditItem(e); setModal(true); };

  const handleDelete = async (id: string) => {
    if (!(await confirmer("Supprimer cette entreprise ?"))) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/entreprises/${id}`, { method: "DELETE", headers: await authHeaders() }); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e: any) => {
    setTogglingId(e.id);
    try {
      await fetch(`${API_BASE}/entreprises/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ est_publie: !e.est_publie }) });
      charger();
    } finally { setTogglingId(null); }
  };

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Entreprises installées" compact ton="orange" pleineLargeur actions={<AdminMenu />}
        droite={
          <button className="ro-w" onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#ca631f", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 3px 12px rgba(0,0,0,0.16)", fontFamily: "var(--font-google-sans)", transition: "background 0.15s, transform 0.15s", flexShrink: 0, whiteSpace: "nowrap" as const }}
            onMouseEnter={ev => { ev.currentTarget.style.background = "#FFF6EF"; ev.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = "#fff"; ev.currentTarget.style.transform = "none"; }}>
            <Plus size={15} /> Ajouter une entreprise
          </button>
        }>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.24)", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{entreprises.length}</span>
      </BarreTitre>

      {/* ── Grille pleine largeur (3 colonnes) ── */}
      <div style={{ padding: "28px 40px 80px" }}>
        {loading ? (
          <SkeletonCards n={6} cols={3} height={200} />
        ) : erreur ? (
          <ErreurChargement onRetry={() => charger()} />
        ) : entreprises.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
            <Building2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucune entreprise enregistrée</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>Cliquez sur « Ajouter une entreprise » pour commencer.</p>
          </div>
        ) : (
          <div className="charge-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {entreprises.map(e => (
              <CarteEntreprise key={e.id} e={e}
                onVoir={() => setVue(e)} onEditer={() => openEdit(e)}
                onPublier={() => handleTogglePublie(e)} onSupprimer={() => handleDelete(e.id)}
                publiant={togglingId === e.id} supprimant={deleting === e.id} />
            ))}
          </div>
        )}
      </div>

      {/* Fiche (même modal que la page publique) + raccourci de modification */}
      <EntreprisePublicModal entreprise={vue} onClose={() => setVue(null)} actions={vue ? (
        <button className="ro-w" onClick={() => { const v = vue; setVue(null); openEdit(v); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgba(0,79,145,0.25)" }}>
          <Pencil size={13} /> Modifier
        </button>
      ) : null} />

      <EntrepriseModal open={modal} onClose={() => setModal(false)} editItem={editItem} onSaved={charger} />
    </div>
  );
}
