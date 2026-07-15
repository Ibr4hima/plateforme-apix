"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import { FModal, FSection, FGrid, FLabel, FInput, FSegmented, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import { authHeaders } from "@/lib/authHeaders";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_LABELS:  Record<string,string>      = { en_vigueur:"En vigueur", expire:"Expiré", signe:"Signé non en vigueur" };
const STATUT_VARIANT: Record<string,BadgeVariant> = { en_vigueur:"green", signe:"blue", expire:"gray" };

function computeStatut(a: any): "en_vigueur"|"expire"|"signe"|null {
  const today = new Date().toISOString().split("T")[0];
  if (a.date_expiration && a.date_expiration < today) return "expire";
  if (a.date_entree_vigueur && a.date_entree_vigueur <= today) return "en_vigueur";
  if (a.date_signature && a.date_signature <= today) return "signe";
  return null;
}
const SENEGAL = "Sénégal";
const APIX    = "APIX S.A";

const fmtDate = (d: string) => {
  if (!d) return "—";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
};

// ── Modal formulaire accord ───────────────────────────────────────────────────
function AccordModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,      setForm]      = useState<any>({
    type_accord:"tbi" as "tbi"|"inter",
    titre:"", reference:"",
    mode_signataire:"pays" as "pays"|"organisation",
    pays_ids:[] as number[], orgs:[] as string[],
    date_signature:"", date_entree_vigueur:"", date_expiration:"",
    secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
    commentaires:"",
  });
  const [saisieOrg,  setSaisieOrg]  = useState("");
  const [searchPays, setSearchPays] = useState("");
  const [paysOpen,   setPaysOpen]   = useState(false);
  const paysRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paysRef.current && !paysRef.current.contains(e.target as Node)) { setPaysOpen(false); setSearchPays(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [fichiers,   setFichiers]   = useState<any[]>([]);
  const [pdfQueue,  setPdfQueue]  = useState<{file:File;titre:string}[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);
  const [error,     setError]     = useState("");
  const [allPays,   setAllPays]   = useState<any[]>([]);

  const update = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));

  useEffect(()=>{
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).then(setAllPays).catch(()=>{});
  },[]);

  useEffect(()=>{
    if (!open) return;
    setPdfQueue([]); setError(""); setSaveOk(false); setSearchPays("");
    if (editItem) {
      const mode = editItem.parties_pays_ids?.length > 0 ? "pays" : "organisation";
      const pays_ids = editItem.parties_pays_ids || [];
      const orgs = mode==="organisation"
        ? (editItem.parties_signataires||"").split(", ").map((s:string)=>s.trim()).filter((s:string)=>s&&s!==APIX)
        : [];
      setForm({
        type_accord:         editItem.type_accord         || "tbi",
        titre:               editItem.titre               || "",
        reference:           editItem.reference           || "",
        mode_signataire:     mode,
        pays_ids,
        orgs,
        date_signature:      editItem.date_signature      || "",
        date_entree_vigueur: editItem.date_entree_vigueur || "",
        date_expiration:     editItem.date_expiration     || "",
        secteur_ids:         editItem.secteur_ids         || [],
        branche_ids:         editItem.branche_ids         || [],
        activite_ids:        editItem.activite_ids        || [],
        commentaires:        editItem.commentaires        || "",
      });
      setSaisieOrg("");
      fetch(`${API_BASE}/accords/${editItem.id}/fichiers`)
        .then(r=>r.json()).then(setFichiers).catch(()=>{});
    } else {
      const senId = allPays.find((p:any)=>p.nom_fr===SENEGAL)?.id;
      setForm((f:any)=>({...f, type_accord:"tbi", titre:"", reference:"", mode_signataire:"pays", pays_ids:senId?[senId]:[], orgs:[], date_signature:"", date_entree_vigueur:"", date_expiration:"", secteur_ids:[], branche_ids:[], activite_ids:[], commentaires:""}));
      setFichiers([]); setSaisieOrg("");
    }
  },[open, editItem?.id, allPays]);

  // TBI : Sénégal + un seul autre pays ; le titre est dérivé des deux noms
  const estTbi     = form.type_accord === "tbi";
  const senIdRef   = allPays.find((p:any)=>p.nom_fr===SENEGAL)?.id;
  const tbiAutreId = (form.pays_ids as number[]).find((id:number)=>id!==senIdRef) ?? null;
  const tbiTitre   = tbiAutreId ? `Sénégal - ${allPays.find((p:any)=>p.id===tbiAutreId)?.nom_fr||""}` : "";

  const buildPartiesStr = () => {
    if (form.mode_signataire==="pays") {
      return (form.pays_ids as number[]).map((id:number)=>allPays.find((p:any)=>p.id===id)?.nom_fr).filter(Boolean).join(", ");
    }
    return [APIX, ...(form.orgs as string[])].join(", ");
  };

  const handleSave = async () => {
    if (estTbi) {
      if (!tbiAutreId) { setError("Sélectionnez le pays signataire avec le Sénégal"); return; }
    } else {
      if (!form.titre.trim())     { setError("Le titre est obligatoire"); return; }
      if (!form.reference.trim()) { setError("La référence est obligatoire"); return; }
    }
    if (!form.date_signature)      { setError("La date de signature est obligatoire"); return; }
    const today = new Date().toISOString().split("T")[0];
    if (form.date_signature > today) { setError("La date de signature doit être dans le passé"); return; }
    if (form.date_entree_vigueur && form.date_entree_vigueur < form.date_signature) { setError("L'entrée en vigueur doit être après la signature"); return; }
    if (form.date_expiration && form.date_entree_vigueur && form.date_expiration <= form.date_entree_vigueur) { setError("L'expiration doit être après l'entrée en vigueur"); return; }
    if (!estTbi && form.mode_signataire==="pays" && (form.pays_ids as number[]).length < 2) { setError("Ajoutez au moins deux pays signataires"); return; }
    if (!estTbi && form.mode_signataire==="organisation" && (form.orgs as string[]).length === 0) { setError("Ajoutez au moins une organisation partenaire"); return; }
    const titreEnvoye = estTbi ? tbiTitre : form.titre;
    const paysEnvoyes = estTbi ? [senIdRef, tbiAutreId].filter(Boolean) : (form.mode_signataire==="pays" ? form.pays_ids : []);
    setSaving(true); setError("");
    try {
      const partiesStr = buildPartiesStr();
      if (editItem) {
        const res = await fetch(`${API_BASE}/accords/${editItem.id}`,{
          method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())},
          body:JSON.stringify({
            type_accord:form.type_accord,
            titre:titreEnvoye, reference:estTbi ? null : (form.reference||null),
            parties_signataires: !estTbi && form.mode_signataire==="organisation" ? [APIX,...(form.orgs as string[])].join(", ") : null,
            parties_pays_ids:    paysEnvoyes,
            date_signature:form.date_signature||null,
            date_entree_vigueur:form.date_entree_vigueur||null,
            date_expiration:form.date_expiration||null,
            secteur_ids:form.secteur_ids, branche_ids:form.branche_ids, activite_ids:form.activite_ids,
            commentaires:form.commentaires||null,
          }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        for (const p of pdfQueue) {
          const fd=new FormData(); fd.append("titre",p.titre||p.file.name); fd.append("fichier",p.file);
          await fetch(`${API_BASE}/accords/${editItem.id}/fichiers`,{method:"POST",headers:await authHeaders(),body:fd});
        }
      } else {
        const fd = new FormData();
        fd.append("type_accord",form.type_accord);
        fd.append("titre",titreEnvoye);
        if (!estTbi) fd.append("reference",form.reference);
        if (!estTbi && form.mode_signataire==="organisation") {
          fd.append("parties_signataires",[APIX,...(form.orgs as string[])].join(", "));
          fd.append("parties_pays_ids","[]");
        } else {
          fd.append("parties_pays_ids",JSON.stringify(paysEnvoyes));
        }
        fd.append("secteur_ids",JSON.stringify(form.secteur_ids));
        fd.append("branche_ids",JSON.stringify(form.branche_ids));
        fd.append("activite_ids",JSON.stringify(form.activite_ids));
        if (form.date_signature)      fd.append("date_signature",     form.date_signature);
        if (form.date_entree_vigueur) fd.append("date_entree_vigueur",form.date_entree_vigueur);
        if (form.date_expiration)     fd.append("date_expiration",    form.date_expiration);
        if (form.commentaires)        fd.append("commentaires",       form.commentaires);
        fd.append("est_publie","true");
        const res = await fetch(`${API_BASE}/accords`,{method:"POST",headers:await authHeaders(),body:fd});
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const na = await res.json();
        for (const p of pdfQueue) {
          const fd2=new FormData(); fd2.append("titre",p.titre||p.file.name); fd2.append("fichier",p.file);
          await fetch(`${API_BASE}/accords/${na.id}/fichiers`,{method:"POST",headers:await authHeaders(),body:fd2});
        }
      }
      setSaveOk(true);
      setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(e:any){ setError(e.message||"Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  return (
    <FModal open={open} onClose={onClose} maxWidth={820}
      title={editItem ? "Modifier l'accord" : "Nouvel accord / traité"}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Sauvegarde…" : editItem ? "Modifier" : "Créer l'accord"}
        </FButton>
      </>}>

      {/* Type d'accord — détermine l'onglet public et les champs proposés */}
      <FSection title="Type d'accord">
        <FSegmented options={[
          {value:"tbi",   label:"Traité Bilatéral d'Investissement"},
          {value:"inter", label:"Traité International"},
        ]} value={form.type_accord} onChange={v=>update("type_accord",v)} />
      </FSection>

      {form.type_accord === "tbi" ? (
      /* TBI : Sénégal + un pays — le titre de l'accord est dérivé (ex. Sénégal - Maroc) */
      <FSection title="Pays signataires">
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:10}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(0,79,145,0.1)",color:"#004f91",border:"1px solid rgba(0,79,145,0.2)",borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>Sénégal</span>
          {tbiAutreId&&(()=>{const p=allPays.find((r:any)=>r.id===tbiAutreId); return p?(
            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(202,99,31,0.1)",color:"#ca631f",border:"1px solid rgba(202,99,31,0.2)",borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>
              {p.nom_fr}
              <button onClick={()=>update("pays_ids",senIdRef?[senIdRef]:[])} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10}/></button>
            </span>
          ):null;})()}
        </div>
        <div ref={paysRef} style={{position:"relative"}}>
          <FInput value={searchPays} onChange={e=>setSearchPays(e.target.value)} onFocus={()=>setPaysOpen(true)}
            placeholder={tbiAutreId?"Remplacer le pays signataire…":"Rechercher le pays signataire…"} style={{ padding:"10px 13px 10px 32px" }} />
          <svg style={{position:"absolute",left:11,top:20,transform:"translateY(-50%)"}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {paysOpen && (
          <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:210,border:"1px solid #E4E1DE",borderRadius:10,overflow:"hidden",maxHeight:260,overflowY:"auto" as const,background:"#fff",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
          {Object.entries(
            allPays
              .filter((p:any)=>p.nom_fr!==SENEGAL && p.id!==tbiAutreId && (!searchPays||p.nom_fr.toLowerCase().includes(searchPays.toLowerCase())))
              .reduce((acc:any,p:any)=>{
                const cont=p.region_monde||"Autre";
                if(!acc[cont]) acc[cont]=[];
                acc[cont].push(p);
                return acc;
              },{})
          ).sort(([a],[b])=>a.localeCompare(b)).map(([continent,pays]:any)=>(
            <div key={continent}>
              <div style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.04)",padding:"5px 12px",letterSpacing:"0.1em",textTransform:"uppercase" as const,position:"sticky" as const,top:0}}>{continent}</div>
              {pays.map((p:any)=>(
                <button key={p.id} onClick={()=>{ update("pays_ids",senIdRef?[senIdRef,p.id]:[p.id]); setPaysOpen(false); setSearchPays(""); }}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const,borderBottom:"1px solid #F2F0EF",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(0,79,145,0.05)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:12,color:"#1a1a2e",fontWeight:500}}>{p.nom_fr}</span>
                </button>
              ))}
            </div>
          ))}
          </div>
          )}
        </div>
        {tbiTitre&&<p style={{fontSize:12,color:"#9aa5b4",marginTop:10}}>Titre de l&apos;accord : <strong style={{color:"#1a1a2e"}}>{tbiTitre}</strong></p>}
      </FSection>
      ) : (<>
      {/* Identification */}
      <FSection title="Identification">
        <FGrid cols="2fr 1fr">
          <div><FLabel>Titre *</FLabel><FInput value={form.titre} onChange={e=>update("titre",e.target.value)} placeholder="Intitulé complet de l'accord" /></div>
          <div><FLabel>Référence *</FLabel><FInput value={form.reference} onChange={e=>update("reference",e.target.value)} placeholder="Ex : APIX/2024/ACC-001" /></div>
        </FGrid>
      </FSection>

      {/* Parties signataires */}
      <FSection title="Parties signataires">
        <div style={{ marginBottom:14 }}>
          <FSegmented options={[{value:"pays",label:"Pays signataires"},{value:"organisation",label:"Organisation / Entreprise"}]}
            value={form.mode_signataire}
            onChange={mode=>{
              update("mode_signataire",mode);
              if (mode==="pays") { const senId=allPays.find((p:any)=>p.nom_fr===SENEGAL)?.id; update("pays_ids",senId?[senId]:[]); update("orgs",[]); }
              else { update("pays_ids",[]); update("orgs",[]); }
              setSaisieOrg("");
            }} />
        </div>
        {form.mode_signataire==="pays" ? (
          <>
            {/* Tags des pays sélectionnés */}
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:10}}>
              {(form.pays_ids as number[]).map((id:number)=>{
                const p=allPays.find((r:any)=>r.id===id);
                const isSen=p?.nom_fr===SENEGAL;
                return p?<span key={id} style={{display:"inline-flex",alignItems:"center",gap:5,background:isSen?"rgba(0,79,145,0.1)":"rgba(202,99,31,0.1)",color:isSen?"#004f91":"#ca631f",border:`1px solid ${isSen?"rgba(0,79,145,0.2)":"rgba(202,99,31,0.2)"}`,borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                  {p.nom_fr}
                  {!isSen&&<button onClick={()=>update("pays_ids",(form.pays_ids as number[]).filter((x:number)=>x!==id))} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10}/></button>}
                </span>:null;
              })}
            </div>
            {/* Recherche + liste en popover (replié par défaut) */}
            <div ref={paysRef} style={{position:"relative"}}>
              <FInput value={searchPays} onChange={e=>setSearchPays(e.target.value)} onFocus={()=>setPaysOpen(true)}
                placeholder="Rechercher et ajouter un pays…" style={{ padding:"10px 13px 10px 32px" }} />
              <svg style={{position:"absolute",left:11,top:20,transform:"translateY(-50%)"}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              {paysOpen && (
              <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:210,border:"1px solid #E4E1DE",borderRadius:10,overflow:"hidden",maxHeight:260,overflowY:"auto" as const,background:"#fff",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
              {Object.entries(
                allPays
                  .filter((p:any)=>!(form.pays_ids as number[]).includes(p.id) && (!searchPays||p.nom_fr.toLowerCase().includes(searchPays.toLowerCase())))
                  .reduce((acc:any,p:any)=>{
                    const cont=p.region_monde||"Autre";
                    if(!acc[cont]) acc[cont]=[];
                    acc[cont].push(p);
                    return acc;
                  },{})
              ).sort(([a],[b])=>a.localeCompare(b)).map(([continent,pays]:any)=>(
                <div key={continent}>
                  <div style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.04)",padding:"5px 12px",letterSpacing:"0.1em",textTransform:"uppercase" as const,position:"sticky" as const,top:0}}>{continent}</div>
                  {pays.map((p:any)=>{
                    return (
                      <button key={p.id} onClick={()=>update("pays_ids",[...(form.pays_ids as number[]),p.id])}
                        style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const,borderBottom:"1px solid #F2F0EF",transition:"background 0.1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(0,79,145,0.05)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{fontSize:12,color:"#1a1a2e",fontWeight:500}}>{p.nom_fr}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(0,79,145,0.1)",color:"#004f91",border:"1px solid rgba(0,79,145,0.2)",borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>APIX S.A</span>
              {(form.orgs as string[]).map((org:string)=>(
                <span key={org} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(202,99,31,0.1)",color:"#ca631f",border:"1px solid rgba(202,99,31,0.2)",borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                  {org}<button onClick={()=>update("orgs",(form.orgs as string[]).filter((x:string)=>x!==org))} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10}/></button>
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <FInput value={saisieOrg} onChange={e=>setSaisieOrg(e.target.value)} placeholder="Ex : Organisation Mondiale du Commerce" style={{flex:1}}
                onKeyDown={e=>{ if(e.key==="Enter"&&saisieOrg.trim()){ e.preventDefault(); const v=saisieOrg.trim(); if(!(form.orgs as string[]).includes(v)) update("orgs",[...(form.orgs as string[]),v]); setSaisieOrg(""); }}}/>
              <FButton onClick={()=>{ const v=saisieOrg.trim(); if(!v) return; if(!(form.orgs as string[]).includes(v)) update("orgs",[...(form.orgs as string[]),v]); setSaisieOrg(""); }}
                style={{ padding:"10px 18px", boxShadow:"none" }}>Ajouter</FButton>
            </div>
          </>
        )}
      </FSection>
      </>)}

      {/* Dates */}
      <FSection title="Dates">
        <FGrid cols={3}>
          <div><FLabel>Date de signature *</FLabel><FInput type="date" value={form.date_signature} max={new Date().toISOString().split("T")[0]} onChange={e=>update("date_signature",e.target.value)} /></div>
          <div><FLabel>Entrée en vigueur</FLabel><FInput type="date" value={form.date_entree_vigueur} min={form.date_signature||undefined} onChange={e=>update("date_entree_vigueur",e.target.value)} /></div>
          <div><FLabel>Date d'expiration</FLabel><FInput type="date" value={form.date_expiration} onChange={e=>update("date_expiration",e.target.value)} /></div>
        </FGrid>
      </FSection>

      {/* Thématiques */}
      <FSection title="Thématiques">
        <NaemaSelect
          secteurIds={form.secteur_ids||[]}
          brancheIds={form.branche_ids||[]}
          activiteIds={form.activite_ids||[]}
          onChangeSecteurs={ids=>update("secteur_ids",ids)}
          onChangeBranches={ids=>update("branche_ids",ids)}
          onChangeActivites={ids=>update("activite_ids",ids)}
        />
      </FSection>

      {/* Commentaires */}
      <FSection title="Résumé / Commentaires">
        <RichTextEditor value={form.commentaires} onChange={v=>update("commentaires",v)}/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length>0&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:8}}>
            {fichiers.map((f:any)=>(
              <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"8px 12px"}}>
                <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                <a href={`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:13,flex:1,color:"#1a1a2e",fontWeight:500,textDecoration:"none"}}>{f.titre||f.fichier_nom}</a>
                <button onClick={async()=>{ await fetch(`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}`,{method:"DELETE",headers:await authHeaders()}); setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id)); }}
                  style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"#dc2626"}}/></button>
              </div>
            ))}
          </div>
        )}
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,cursor:"pointer",border:"2px dashed #E4E1DE",background:"#FAFAF9",transition:"border-color 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#004f91"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#E4E1DE"}>
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
                  placeholder="Titre du document"
                  style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(106,27,154,0.3)",outline:"none",fontSize:12.5,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"#dc2626"}}/></button>
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

// ── Modal vue accord ──────────────────────────────────────────────────────────
function AccordVue({ accord: a, onClose, onEdit }: { accord:any; onClose:()=>void; onEdit:(a:any)=>void }) {
  const [fichiers, setFichiers] = useState<any[]>([]);
  const [secteurs, setSecteurs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activites,setActivites]= useState<any[]>([]);
  const [allPays,  setAllPays]  = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r=>r.json()).then(setFichiers).catch(()=>{});
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).then(setAllPays).catch(()=>{});
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,ac])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(ac||[]); }).catch(()=>{});
  },[a.id]);

  // Construire arborescence depuis les IDs
  const secIds:number[]  = a.secteur_ids  || [];
  const braIds:number[]  = a.branche_ids  || [];
  const actIds:number[]  = a.activite_ids || [];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;

  const st = computeStatut(a);
  const ST_VUE: any = {
    en_vigueur: { label:"En vigueur", c:"#004f91", bg:"rgba(0,79,145,0.07)" },
    signe:      { label:"Signé non en vigueur", c:"#004f91", bg:"rgba(0,79,145,0.07)" },
    expire:     { label:"Expiré",    c:"#6b7280", bg:"#F2F0EF"              },
  };
  const stV = st ? ST_VUE[st] : null;
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
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{a.titre}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {stV&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:stV.c,background:stV.bg,padding:"3px 10px",borderRadius:999}}>{stV.label}</span>}
              {a.reference&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{a.reference}</span>}
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

          {/* Dates */}
          <section>
            <SecTitle>Dates</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Bloc label="Signature"><p style={{fontSize:12.5,fontWeight:600,color:a.date_signature?"#1a1a2e":"#9aa5b4"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p></Bloc>
              {a.date_entree_vigueur&&<Bloc label="Entrée en vigueur"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></Bloc>}
              <Bloc label="Expiration"><p style={{fontSize:12.5,fontWeight:600,color:a.date_expiration?"#1a1a2e":"#9aa5b4"}}>{a.date_expiration?fmtDate(a.date_expiration):"Non définie"}</p></Bloc>
            </div>
          </section>

          {/* Résumé */}
          {a.commentaires&&(
            <section>
              <SecTitle>Résumé</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:a.commentaires}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Parties signataires */}
          {(a.parties_pays_ids?.length>0||a.parties_signataires)&&(
            <section>
              <SecTitle>Parties signataires</SecTitle>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                {(a.parties_pays_ids||[]).map((id:number)=>{
                  const p=allPays.find((r:any)=>r.id===id);
                  return <span key={id} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p?.nom_fr||`Pays #${id}`}</span>;
                })}
                {a.parties_signataires&&a.parties_signataires.split(", ").filter(Boolean).map((p:string)=>(
                  <span key={p} style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.07)",padding:"3px 10px",borderRadius:999}}>{p}</span>
                ))}
              </div>
            </section>
          )}

          {/* Thématiques */}
          {hasNaema&&(
            <section>
              <SecTitle>Thématiques</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number)=>{
                  const secNom = secteurs.find(s=>s.id===secId)?.nom;
                  if (!secNom) return null;
                  const brasDuSec = branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{secNom}</span>
                      </div>
                      {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                        {brasDuSec.map((bra:any)=>{
                          const actsDeBra = activites.filter(ac=>ac.branche_id===bra.id&&actIds.includes(ac.id));
                          return (
                            <div key={bra.id}>
                              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                              </div>
                              {actsDeBra.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                {actsDeBra.map((act:any)=>(
                                  <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                    <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
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

          {/* Documents */}
          {fichiers.length>0&&(
            <section>
              <SecTitle>{fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
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
          <button className="ro-w" onClick={()=>{onClose();onEdit(a);}}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)",boxShadow:"0 3px 12px rgba(0,79,145,0.25)"}}>
            <Pencil size={13}/> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AdminAccords() {
  const [accords,    setAccords]    = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [deleting,   setDeleting]   = useState<number|null>(null);
  const [togglingId, setTogglingId] = useState<number|null>(null);
  const [allPays,    setAllPays]    = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).then(setAllPays).catch(()=>{});
  },[]);

  const getPaysNoms = (a:any, max=2) => {
    let noms: string[] = [];
    if (a.parties_pays_ids?.length>0) {
      noms = (a.parties_pays_ids as number[])
        .map((id:number)=>{ const p=allPays.find((r:any)=>r.id===id); return p?.nom_fr||null; })
        .filter(Boolean) as string[];
    } else if (a.parties_signataires) {
      noms = a.parties_signataires.split(", ").filter(Boolean);
    }
    if (max && noms.length > max) return noms.slice(0, max).join(", ") + `, +${noms.length - max}`;
    return noms.join(", ");
  };

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/accords?per_page=100&admin=true`);
      const data = await res.json();
      const sorted = (data.data||[]).slice().sort((a:any,b:any)=>{
        if (!a.date_expiration && !b.date_expiration) return 0;
        if (!a.date_expiration) return 1;
        if (!b.date_expiration) return -1;
        return a.date_expiration.localeCompare(b.date_expiration);
      });
      setAccords(sorted); setTotal(data.total||0);
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (a:any) => { setEditItem(a); setModal(true); };

  const handleDelete = async (id:number) => {
    if (!confirm("Supprimer cet accord ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/accords/${id}`,{method:"DELETE",headers:await authHeaders()}); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (a:any) => {
    setTogglingId(a.id);
    try {
      await fetch(`${API_BASE}/accords/${a.id}`,{ method:"PATCH", headers:{"Content-Type":"application/json", ...(await authHeaders())}, body:JSON.stringify({est_publie:!a.est_publie}) });
      charger();
    } finally { setTogglingId(null); }
  };

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Accords &amp; Traités</h1>
          <span style={{fontSize:14,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"3px 12px",borderRadius:999}}>{total}</span>
        </div>
        <button className="ro-w" onClick={openCreate} style={{display:"flex",alignItems:"center",gap:8,background:"#004f91",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,79,145,0.3)"}}>
          <Plus size={15}/> Ajouter un accord
        </button>
      </div>

      {loading ? (
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:200,gap:10,color:"#9aa5b4"}}>
          <Loader2 size={22} style={{animation:"spin 1s linear infinite"}}/>
        </div>
      ) : accords.length===0 ? (
        <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
          <FileText size={40} style={{marginBottom:12,opacity:0.25}}/>
          <p style={{fontSize:14,color:"#4a5568"}}>Aucun accord — cliquez sur "Ajouter un accord" pour commencer.</p>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))",gap:14}}>
          {accords.map(a=>{
            const statut = computeStatut(a);
            const ST: any = {
              en_vigueur: { label:"En vigueur", c:"#004f91", bg:"rgba(0,79,145,0.07)" },
              signe:      { label:"Signé non en vigueur", c:"#004f91", bg:"rgba(0,79,145,0.07)" },
              expire:     { label:"Expiré",    c:"#6b7280", bg:"#F2F0EF"              },
            };
            const st = statut ? ST[statut] : null;
            const estExpire = statut==="expire";
            const blocC  = estExpire ? "#6b7280" : "#004f91";
            const blocBg = estExpire ? "#F5F4F3" : "rgba(0,79,145,0.04)";
            const blocBd = estExpire ? "#E8E5E3" : "rgba(0,79,145,0.10)";
            const txtC   = estExpire ? "#4a5568" : "#1a1a2e";
            return (
              <div key={a.id} onClick={()=>setVue(a)}
                style={{background:estExpire?"#FAFAF9":"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=estExpire?"#D8D4D0":"rgba(0,79,145,0.25)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                <div style={{height:3,background:estExpire?"linear-gradient(90deg,#DDD9D5 0%,#C5BFBB 50%,#DDD9D5 100%)":"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",flexShrink:0}}/>
                <div style={{padding:"14px 16px 14px",flex:1}}>
                  {/* Statut + référence */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    {st ? (
                      <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:st.c,background:st.bg,padding:"3px 10px",borderRadius:999}}>{st.label}</span>
                    ) : <span/>}
                    {a.reference && <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:estExpire?"#6b7280":"#004f91",background:estExpire?"#F2F0EF":"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{a.reference}</span>}
                  </div>

                  {/* Titre */}
                  <div style={{fontWeight:700,fontSize:13.5,color:txtC,lineHeight:1.35}}>{a.titre}</div>

                  {/* Dates libellées */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                    <div style={{background:blocBg,border:`1px solid ${blocBd}`,borderRadius:10,padding:"8px 11px"}}>
                      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:blocC,textTransform:"uppercase" as const,marginBottom:3}}>Signature</p>
                      <p style={{fontSize:12,fontWeight:600,color:a.date_signature?txtC:"#9aa5b4"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p>
                    </div>
                    {a.date_expiration ? (
                      <div style={{background:blocBg,border:`1px solid ${blocBd}`,borderRadius:10,padding:"8px 11px"}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:blocC,textTransform:"uppercase" as const,marginBottom:3}}>Expiration</p>
                        <p style={{fontSize:12,fontWeight:600,color:txtC}}>{fmtDate(a.date_expiration)}</p>
                      </div>
                    ) : (
                      <div style={{background:blocBg,border:`1px solid ${blocBd}`,borderRadius:10,padding:"8px 11px"}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:blocC,textTransform:"uppercase" as const,marginBottom:3}}>Entrée en vigueur</p>
                        <p style={{fontSize:12,fontWeight:600,color:a.date_entree_vigueur?txtC:"#9aa5b4"}}>{a.date_entree_vigueur?fmtDate(a.date_entree_vigueur):"Non définie"}</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* Actions */}
                <div className="ro-w" style={{display:"flex",alignItems:"stretch",borderTop:"1px solid #F2F0EF"}} onClick={ev=>ev.stopPropagation()}>
                  <button onClick={()=>openEdit(a)}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                    <Pencil size={12}/> Modifier
                  </button>
                  <div style={{width:1,background:"#F2F0EF"}}/>
                  <button onClick={()=>handleTogglePublie(a)} disabled={togglingId===a.id}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"10px 0",fontSize:11.5,color:a.est_publie?"#188038":"#6b7280",fontWeight:600,fontFamily:"var(--font-google-sans)",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background=a.est_publie?"rgba(24,128,56,0.05)":"rgba(156,163,175,0.07)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                    {togglingId===a.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:a.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                  </button>
                  <div style={{width:1,background:"#F2F0EF"}}/>
                  <button onClick={()=>handleDelete(a.id)} disabled={deleting===a.id}
                    style={{width:46,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",transition:"background 0.15s"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(220,38,38,0.05)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                    {deleting===a.id?<Loader2 size={12} style={{color:"#dc2626",animation:"spin 1s linear infinite"}}/>:<Trash2 size={12} style={{color:"#dc2626"}}/>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {vue&&<AccordVue accord={vue} onClose={()=>setVue(null)} onEdit={a=>{ setVue(null); openEdit(a); }}/>}
      <AccordModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger}/>
    </div>
  );
}
