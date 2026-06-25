"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import Badge, { BadgeVariant } from "@/components/shared/Badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_LABELS:  Record<string,string>      = { en_vigueur:"En vigueur", expire:"Expiré", signe:"Signé" };
const STATUT_VARIANT: Record<string,BadgeVariant> = { en_vigueur:"green", signe:"blue", expire:"gray" };

function computeStatut(a: any): "en_vigueur"|"expire"|"signe"|null {
  const today = new Date().toISOString().split("T")[0];
  if (a.date_expiration && a.date_expiration < today) return "expire";
  if (a.date_signature && a.date_entree_vigueur && a.date_signature <= today && today < a.date_entree_vigueur) return "signe";
  const ref = a.date_entree_vigueur || a.date_signature;
  if (ref && ref <= today) return "en_vigueur";
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
    titre:"", reference:"",
    mode_signataire:"pays" as "pays"|"organisation",
    pays_ids:[] as number[], orgs:[] as string[],
    date_signature:"", date_entree_vigueur:"", date_expiration:"",
    secteur_ids:[] as number[], branche_ids:[] as number[], activite_ids:[] as number[],
    commentaires:"",
  });
  const [saisieOrg,  setSaisieOrg]  = useState("");
  const [searchPays, setSearchPays] = useState("");
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
      setForm((f:any)=>({...f, titre:"", reference:"", mode_signataire:"pays", pays_ids:senId?[senId]:[], orgs:[], date_signature:"", date_entree_vigueur:"", date_expiration:"", secteur_ids:[], branche_ids:[], activite_ids:[], commentaires:""}));
      setFichiers([]); setSaisieOrg("");
    }
  },[open, editItem?.id, allPays]);

  const buildPartiesStr = () => {
    if (form.mode_signataire==="pays") {
      return (form.pays_ids as number[]).map((id:number)=>allPays.find((p:any)=>p.id===id)?.nom_fr).filter(Boolean).join(", ");
    }
    return [APIX, ...(form.orgs as string[])].join(", ");
  };

  const handleSave = async () => {
    if (!form.titre.trim())        { setError("Le titre est obligatoire"); return; }
    if (!form.reference.trim())    { setError("La référence est obligatoire"); return; }
    if (!form.date_signature)      { setError("La date de signature est obligatoire"); return; }
    const today = new Date().toISOString().split("T")[0];
    if (form.date_signature > today) { setError("La date de signature doit être dans le passé"); return; }
    if (form.date_entree_vigueur && form.date_entree_vigueur < form.date_signature) { setError("L'entrée en vigueur doit être après la signature"); return; }
    if (form.date_expiration && form.date_entree_vigueur && form.date_expiration <= form.date_entree_vigueur) { setError("L'expiration doit être après l'entrée en vigueur"); return; }
    if (form.mode_signataire==="pays" && (form.pays_ids as number[]).length < 2) { setError("Ajoutez au moins deux pays signataires"); return; }
    if (form.mode_signataire==="organisation" && (form.orgs as string[]).length === 0) { setError("Ajoutez au moins une organisation partenaire"); return; }
    setSaving(true); setError("");
    try {
      const partiesStr = buildPartiesStr();
      if (editItem) {
        const res = await fetch(`${API_BASE}/accords/${editItem.id}`,{
          method:"PATCH", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            titre:form.titre, reference:form.reference||null,
            parties_signataires: form.mode_signataire==="organisation" ? [APIX,...(form.orgs as string[])].join(", ") : null,
            parties_pays_ids:    form.mode_signataire==="pays" ? form.pays_ids : [],
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
          await fetch(`${API_BASE}/accords/${editItem.id}/fichiers`,{method:"POST",body:fd});
        }
      } else {
        const fd = new FormData();
        fd.append("titre",form.titre);
        fd.append("reference",form.reference);
        if (form.mode_signataire==="organisation") {
          fd.append("parties_signataires",[APIX,...(form.orgs as string[])].join(", "));
          fd.append("parties_pays_ids","[]");
        } else {
          fd.append("parties_pays_ids",JSON.stringify(form.pays_ids));
        }
        fd.append("secteur_ids",JSON.stringify(form.secteur_ids));
        fd.append("branche_ids",JSON.stringify(form.branche_ids));
        fd.append("activite_ids",JSON.stringify(form.activite_ids));
        if (form.date_signature)      fd.append("date_signature",     form.date_signature);
        if (form.date_entree_vigueur) fd.append("date_entree_vigueur",form.date_entree_vigueur);
        if (form.date_expiration)     fd.append("date_expiration",    form.date_expiration);
        if (form.commentaires)        fd.append("commentaires",       form.commentaires);
        fd.append("est_publie","true");
        const res = await fetch(`${API_BASE}/accords`,{method:"POST",body:fd});
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const na = await res.json();
        for (const p of pdfQueue) {
          const fd2=new FormData(); fd2.append("titre",p.titre||p.file.name); fd2.append("fichier",p.file);
          await fetch(`${API_BASE}/accords/${na.id}/fichiers`,{method:"POST",body:fd2});
        }
      }
      setSaveOk(true);
      setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(e:any){ setError(e.message||"Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  const IS:any = { width:"100%", background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const };
  const LS:any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:4, display:"block" };
  const SS:any = { fontSize:11, fontWeight:700, color:"#ca631f", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:820,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e"}}>{editItem?"Modifier l'accord":"Nouvel accord / traité"}</h2>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7}}><X size={15} color="#4a5568"/></button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>

            {/* Identification */}
            <div>
              <p style={SS}>Identification</p>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:12}}>
                <div><label style={LS}>Titre *</label><input value={form.titre} onChange={e=>update("titre",e.target.value)} placeholder="Intitulé complet de l'accord" style={IS}/></div>
                <div><label style={LS}>Référence *</label><input value={form.reference} onChange={e=>update("reference",e.target.value)} placeholder="Ex : APIX/2024/ACC-001" style={IS}/></div>
              </div>
            </div>

            {/* Parties signataires */}
            <div>
              <p style={SS}>Parties signataires</p>
              <div style={{display:"flex",gap:0,marginBottom:14,border:"1px solid #C5BFBB",borderRadius:8,overflow:"hidden",width:"fit-content"}}>
                {(["pays","organisation"] as const).map(mode=>(
                  <button key={mode} onClick={()=>{
                    update("mode_signataire",mode);
                    if (mode==="pays") { const senId=allPays.find((p:any)=>p.nom_fr===SENEGAL)?.id; update("pays_ids",senId?[senId]:[]); update("orgs",[]); }
                    else { update("pays_ids",[]); update("orgs",[]); }
                    setSaisieOrg("");
                  }} style={{padding:"7px 18px",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:form.mode_signataire===mode?"#ca631f":"#F2F0EF",color:form.mode_signataire===mode?"#fff":"#9aa5b4"}}>
                    {mode==="pays"?"Pays signataires":"Organisation / Entreprise"}
                  </button>
                ))}
              </div>
              {form.mode_signataire==="pays" ? (
                <>
                  {/* Tags des pays sélectionnés */}
                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:5,marginBottom:10}}>
                    {(form.pays_ids as number[]).map((id:number)=>{
                      const p=allPays.find((r:any)=>r.id===id);
                      const isSen=p?.nom_fr===SENEGAL;
                      const fl=p?.code_iso2?String.fromCodePoint(...p.code_iso2.toUpperCase().split("").map((c:string)=>127397+c.charCodeAt(0))):"";
                      return p?<span key={id} style={{display:"inline-flex",alignItems:"center",gap:5,background:isSen?"rgba(0,79,145,0.1)":"rgba(202,99,31,0.1)",color:isSen?"#004f91":"#ca631f",border:`1px solid ${isSen?"rgba(0,79,145,0.2)":"rgba(202,99,31,0.2)"}`,borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                        {fl&&<span style={{fontSize:14}}>{fl}</span>}{p.nom_fr}
                        {!isSen&&<button onClick={()=>update("pays_ids",(form.pays_ids as number[]).filter((x:number)=>x!==id))} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10}/></button>}
                      </span>:null;
                    })}
                  </div>
                  {/* Recherche pays */}
                  <div style={{position:"relative",marginBottom:8}}>
                    <input value={searchPays} onChange={e=>setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                      style={{width:"100%",padding:"7px 10px 7px 30px",borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                    <svg style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)"}} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    {searchPays&&<button onClick={()=>setSearchPays("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
                  </div>
                  {/* Liste groupée par continent */}
                  <div style={{border:"1px solid #E8E5E3",borderRadius:10,overflow:"hidden",maxHeight:260,overflowY:"auto" as const,background:"#fff"}}>
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
                        <div style={{fontSize:10,fontWeight:700,color:"#9aa5b4",background:"#F8F7F6",padding:"5px 12px",letterSpacing:"0.1em",textTransform:"uppercase" as const,position:"sticky" as const,top:0}}>{continent}</div>
                        {pays.map((p:any)=>{
                          const fl=p.code_iso2?String.fromCodePoint(...p.code_iso2.toUpperCase().split("").map((c:string)=>127397+c.charCodeAt(0))):"";
                          return (
                            <button key={p.id} onClick={()=>update("pays_ids",[...(form.pays_ids as number[]),p.id])}
                              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left" as const,borderBottom:"1px solid #F2F0EF",transition:"background 0.1s"}}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(202,99,31,0.06)"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              {fl&&<span style={{fontSize:16,flexShrink:0}}>{fl}</span>}
                              <span style={{fontSize:12,color:"#1a1a2e",fontWeight:500}}>{p.nom_fr}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <span style={{fontSize:11,color:"#9aa5b4",marginTop:4,display:"block"}}>Le Sénégal est toujours inclus. Cliquez sur un pays pour l'ajouter.</span>
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
                    <input value={saisieOrg} onChange={e=>setSaisieOrg(e.target.value)} placeholder="Ex : Organisation Mondiale du Commerce" style={{...IS,flex:1}}
                      onKeyDown={e=>{ if(e.key==="Enter"&&saisieOrg.trim()){ e.preventDefault(); const v=saisieOrg.trim(); if(!(form.orgs as string[]).includes(v)) update("orgs",[...(form.orgs as string[]),v]); setSaisieOrg(""); }}}/>
                    <button onClick={()=>{ const v=saisieOrg.trim(); if(!v) return; if(!(form.orgs as string[]).includes(v)) update("orgs",[...(form.orgs as string[]),v]); setSaisieOrg(""); }}
                      style={{padding:"9px 16px",background:"#ca631f",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>Ajouter</button>
                  </div>
                </>
              )}
            </div>

            {/* Dates */}
            <div>
              <p style={SS}>Dates</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div><label style={LS}>Date de signature *</label><input type="date" value={form.date_signature} max={new Date().toISOString().split("T")[0]} onChange={e=>update("date_signature",e.target.value)} style={IS}/></div>
                <div><label style={LS}>Entrée en vigueur</label><input type="date" value={form.date_entree_vigueur} min={form.date_signature||undefined} onChange={e=>update("date_entree_vigueur",e.target.value)} style={IS}/></div>
                <div><label style={LS}>Date d'expiration</label><input type="date" value={form.date_expiration} onChange={e=>update("date_expiration",e.target.value)} style={IS}/></div>
              </div>
            </div>

            {/* Thématiques NAEMA */}
            <div>
              <p style={SS}>Thématiques NAEMA</p>
              <NaemaSelect
                secteurIds={form.secteur_ids||[]}
                brancheIds={form.branche_ids||[]}
                activiteIds={form.activite_ids||[]}
                onChangeSecteurs={ids=>update("secteur_ids",ids)}
                onChangeBranches={ids=>update("branche_ids",ids)}
                onChangeActivites={ids=>update("activite_ids",ids)}
              />
            </div>

            {/* Commentaires */}
            <div>
              <p style={SS}>Résumé / Commentaires</p>
              <RichTextEditor value={form.commentaires} onChange={v=>update("commentaires",v)}/>
            </div>

            {/* PDFs */}
            <div>
              <p style={SS}>Fichiers PDF</p>
              {fichiers.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:10}}>
                  {fichiers.map((f:any)=>(
                    <div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:5}}>
                      <a href={`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(202,99,31,0.06)",border:"1px solid rgba(202,99,31,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#ca631f",textDecoration:"none",fontWeight:500}}>
                        <FileText size={11}/> {f.titre||f.fichier_nom}
                      </a>
                      <button onClick={async()=>{ await fetch(`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}`,{method:"DELETE"}); setFichiers(prev=>prev.filter((x:any)=>x.id!==f.id)); }}
                        style={{background:"rgba(220,38,38,0.08)",border:"none",cursor:"pointer",borderRadius:5,padding:"3px 5px",display:"flex",alignItems:"center"}}>
                        <X size={10} style={{color:"#dc2626"}}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pdfQueue.length>0&&(
                <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:8}}>
                  {pdfQueue.map((p,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.05)",border:"1px solid rgba(202,99,31,0.2)",borderRadius:8,padding:"7px 12px"}}>
                      <FileText size={13} style={{color:"#ca631f",flexShrink:0}}/>
                      <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                        placeholder="Titre du document"
                        style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(202,99,31,0.3)",outline:"none",fontSize:12,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                      <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"#dc2626"}}/></button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:8,cursor:"pointer",border:"2px dashed #C5BFBB",background:"#F2F0EF"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#ca631f"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#C5BFBB"}>
                <Upload size={14} color="#9aa5b4"/>
                <span style={{fontSize:13,color:"#9aa5b4"}}>Ajouter un ou plusieurs PDF</span>
                <input type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>{
                  const files=Array.from(e.target.files||[]);
                  setPdfQueue(prev=>[...prev,...files.map(f=>({file:f,titre:f.name.replace(/\.pdf$/i,"")}))]);
                  e.target.value="";
                }}/>
              </label>
            </div>

            {error&&<div style={{background:"#fee2e2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>{error}</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||saveOk}
                style={{padding:"10px 24px",borderRadius:10,border:"none",background:saveOk?"#dcfce7":"linear-gradient(135deg,#ca631f,#a84e18)",color:saveOk?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                {saveOk?<><Check size={14}/> Enregistré</>:saving?<><Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> Sauvegarde...</>:editItem?"Modifier":"Créer l'accord"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  // Construire arborescence depuis les IDs
  const secIds:number[]  = a.secteur_ids  || [];
  const braIds:number[]  = a.branche_ids  || [];
  const actIds:number[]  = a.activite_ids || [];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{a.titre}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {a.reference&&<span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{a.reference}</span>}
                {(()=>{ const st=computeStatut(a); return st&&<span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:999,
                  color:st==="en_vigueur"?"#188038":st==="signe"?"#004f91":"#6b7280",
                  background:st==="en_vigueur"?"rgba(24,128,56,0.08)":st==="signe"?"rgba(0,79,145,0.08)":"#f3f4f6",
                  border:`1px solid ${st==="en_vigueur"?"rgba(24,128,56,0.2)":st==="signe"?"rgba(0,79,145,0.2)":"#e5e7eb"}`}}>
                  {STATUT_LABELS[st]}
                </span>; })()}
                <span style={{fontSize:11,fontWeight:700,color:a.est_publie?"#15803d":"#9aa5b4",background:a.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{a.est_publie?"Publié":"Non publié"}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>
          {a.commentaires&&<div style={{background:"rgba(202,99,31,0.04)",border:"1px solid rgba(202,99,31,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}><style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style><LBL>Résumé</LBL><div data-rte dangerouslySetInnerHTML={{__html:a.commentaires}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/></div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {a.date_signature&&<div style={{background:"rgba(0,79,145,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date de signature</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_signature)}</p></div>}
            {a.date_entree_vigueur&&<div style={{background:"rgba(24,128,56,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Entrée en vigueur</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></div>}
            <div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Expiration</LBL><p style={{fontSize:13,fontWeight:600,color:a.date_expiration?"#1a1a2e":"#9aa5b4"}}>{a.date_expiration?fmtDate(a.date_expiration):"Date d'expiration non définie"}</p></div>
          </div>
          {(a.parties_pays_ids?.length>0||a.parties_signataires)&&<div style={{marginBottom:16}}>
            <LBL>Parties signataires</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {(a.parties_pays_ids||[]).map((id:number)=>{
                const p=allPays.find((r:any)=>r.id===id);
                return <span key={id} style={{fontSize:12,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.18)",padding:"3px 11px",borderRadius:999}}>
                  {p?.nom_fr||`Pays #${id}`}
                </span>;
              })}
              {a.parties_signataires&&a.parties_signataires.split(", ").filter(Boolean).map((p:string)=>(
                <span key={p} style={{fontSize:12,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.07)",border:"1px solid rgba(202,99,31,0.18)",padding:"3px 11px",borderRadius:999}}>{p}</span>
              ))}
            </div>
          </div>}
          {hasNaema&&<div style={{marginBottom:16}}>
            <LBL>Thématiques</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {secIds.map((secId:number)=>{
                const secNom = secteurs.find(s=>s.id===secId)?.nom;
                if (!secNom) return null;
                const brasDuSec = branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                return (
                  <div key={secId}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#ca631f"}}>{secNom}</span>
                    </div>
                    {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(202,99,31,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                      {brasDuSec.map((bra:any)=>{
                        const actsDeBra = activites.filter(ac=>ac.branche_id===bra.id&&actIds.includes(ac.id));
                        return (
                          <div key={bra.id}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                              <span style={{fontSize:11,fontWeight:600,color:"#004f91"}}>{bra.nom}</span>
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
          </div>}
          {fichiers.length>0&&<div style={{marginBottom:16}}>
            <LBL>Documents</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {fichiers.map((f:any)=>(
                <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(202,99,31,0.06)",border:"1px solid rgba(202,99,31,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#ca631f",textDecoration:"none",fontWeight:500}}>
                  <FileText size={11}/> {f.titre||f.fichier_nom}
                </a>
              ))}
            </div>
          </div>}
          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(a);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#ca631f,#a0521a)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
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
    try { await fetch(`${API_BASE}/accords/${id}`,{method:"DELETE"}); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (a:any) => {
    setTogglingId(a.id);
    try {
      await fetch(`${API_BASE}/accords/${a.id}`,{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({est_publie:!a.est_publie}) });
      charger();
    } finally { setTogglingId(null); }
  };

  return (
    <div style={{padding:"36px 40px 80px",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Accords &amp; Traités</h1>
          <p style={{color:"#9aa5b4",fontSize:13,marginTop:2}}>{total} accord{total>1?"s":""} au total</p>
        </div>
        <button onClick={openCreate} style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#ca631f,#a84e18)",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(202,99,31,0.3)"}}>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
          {accords.map(a=>{
            const statut = computeStatut(a);
            return (
            <div key={a.id} onClick={()=>setVue(a)}
              style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:"3px solid #ca631f",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative" as const}}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";ev.currentTarget.style.borderColor="#ca631f";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor="#ca631f";}}>

              {statut&&<div style={{position:"absolute" as const,top:12,right:12}}>
                <Badge variant={STATUT_VARIANT[statut]||"gray"} size="xs">{STATUT_LABELS[statut]}</Badge>
              </div>}

              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:a.reference?2:8,paddingRight:statut?90:0}}>{a.titre}</div>
              {a.reference&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{a.reference}</div>}
              <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:a.date_expiration?"#188038":"#C5BFBB",flexShrink:0}}/>
                  <span style={{color:a.date_expiration?"#4a5568":"#9aa5b4"}}>{a.date_expiration?"Expire le "+fmtDate(a.date_expiration):"Date d'expiration non définie"}</span>
                </div>
                {getPaysNoms(a)&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#B7410E",flexShrink:0}}/>
                  <span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{getPaysNoms(a)}</span>
                </div>}
              </div>
              <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>openEdit(a)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#ca631f",fontWeight:600}}>
                  <Pencil size={12}/> Modifier
                </button>
                <button onClick={()=>handleTogglePublie(a)} disabled={togglingId===a.id}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:a.est_publie?"rgba(21,128,61,0.07)":"rgba(156,163,175,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:a.est_publie?"#15803d":"#6b7280",fontWeight:600}}>
                  {togglingId===a.id?<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>:a.est_publie?<><EyeOff size={12}/> Public</>:<><Eye size={12}/> Publier</>}
                </button>
                <button onClick={()=>handleDelete(a.id)} disabled={deleting===a.id}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(220,38,38,0.07)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 9px"}}>
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
