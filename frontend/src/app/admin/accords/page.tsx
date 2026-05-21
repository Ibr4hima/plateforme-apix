"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUTS = ["en_vigueur","expire"];
const STATUT_LABELS: Record<string,string> = { en_vigueur:"En vigueur", expire:"Expiré" };
const STATUT_COLORS: Record<string,{bg:string;text:string}> = {
  en_vigueur: {bg:"#dcfce7", text:"#15803d"},
  expire:     {bg:"#f3f4f6", text:"#6b7280"},
};
const SENEGAL = "Sénégal";
const APIX    = "APIX S.A";

const fmtDate = (d: string) => {
  if (!d) return "—";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
};

const EMPTY_FORM = {
  titre:"", reference:"", pays_signataires:[SENEGAL] as string[],
  mode_signataire:"pays" as "pays"|"organisation",
  date_signature:"", date_entree_vigueur:"", date_expiration:"",
  thematiques:"", commentaires:"", statut:"en_vigueur",
};

// ── Modal accord ──────────────────────────────────────────────────────────────
function AccordModal({ open, onClose, editItem, onSaved }: {
  open:boolean; onClose:()=>void; editItem:any; onSaved:()=>void;
}) {
  const [form,      setForm]      = useState<any>({...EMPTY_FORM});
  const [saisieOrg, setSaisieOrg] = useState("");
  const [fichiers,  setFichiers]  = useState<any[]>([]);
  const [pdfQueue,  setPdfQueue]  = useState<{file:File;titre:string}[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);
  const [error,     setError]     = useState("");

  const update = (k:string, v:any) => setForm((f:any)=>({...f,[k]:v}));

  useEffect(()=>{
    if (!open) return;
    setPdfQueue([]); setError(""); setSaveOk("" as any);
    if (editItem) {
      const parties: string[] = editItem.pays_signataires
        ? editItem.pays_signataires.split(", ").filter(Boolean) : [];
      const mode = parties.includes(APIX) ? "organisation" : "pays";
      setForm({
        titre:               editItem.titre               || "",
        reference:           editItem.reference           || "",
        pays_signataires:    mode==="pays"
          ? (parties.includes(SENEGAL)?parties:[SENEGAL,...parties])
          : (parties.includes(APIX)?parties:[APIX,...parties]),
        mode_signataire:     mode,
        date_signature:      editItem.date_signature      || "",
        date_entree_vigueur: editItem.date_entree_vigueur || "",
        date_expiration:     editItem.date_expiration     || "",
        thematiques:         editItem.secteur_activite    || "",
        commentaires:        editItem.commentaires        || "",
        statut:              editItem.statut              || "en_vigueur",
      });
      setSaisieOrg("");
      setFichiers([]);
      fetch(`${API_BASE}/accords/${editItem.id}/fichiers`)
        .then(r=>r.json()).then(setFichiers).catch(()=>{});
    } else {
      setForm({...EMPTY_FORM}); setFichiers([]); setSaisieOrg("");
    }
  },[open, editItem?.id]);

  const handleSave = async () => {
    if (!form.titre.trim())           { setError("Le titre est obligatoire"); return; }
    if (!form.reference.trim())       { setError("La référence est obligatoire"); return; }
    if (!form.date_signature)         { setError("La date de signature est obligatoire"); return; }
    if (!form.date_entree_vigueur)    { setError("La date d'entrée en vigueur est obligatoire"); return; }
    if (!form.date_expiration)        { setError("La date d'expiration est obligatoire"); return; }
    const today = new Date().toISOString().split("T")[0];
    if (form.date_signature > today)             { setError("La date de signature doit être aujourd'hui ou dans le passé"); return; }
    if (form.date_entree_vigueur < form.date_signature) { setError("L'entrée en vigueur doit être égale ou postérieure à la date de signature"); return; }
    if (form.date_expiration <= form.date_signature)    { setError("La date d'expiration doit être strictement après la date de signature"); return; }
    if (form.date_expiration <= form.date_entree_vigueur) { setError("La date d'expiration doit être strictement après la date d'entrée en vigueur"); return; }
    if (form.date_expiration <= today)           { setError("La date d'expiration doit être dans le futur"); return; }
    if ((form.pays_signataires as string[]).length < 2) {
      setError(`Ajoutez au moins un${form.mode_signataire==="pays"?" autre pays signataire":"e organisation/entreprise partenaire"}`); return;
    }
    setSaving(true); setError("");
    try {
      const paysStr = (form.pays_signataires as string[]).join(", ") || null;
      if (editItem) {
        const res = await fetch(`${API_BASE}/accords/${editItem.id}`,{
          method:"PATCH", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ titre:form.titre, reference:form.reference||null, pays_signataires:paysStr,
            date_signature:form.date_signature||null, date_entree_vigueur:form.date_entree_vigueur||null,
            date_expiration:form.date_expiration||null, secteur_activite:form.thematiques||null,
            commentaires:form.commentaires||null, statut:form.statut }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        for (const p of pdfQueue) {
          const fd=new FormData(); fd.append("titre",p.titre||p.file.name); fd.append("fichier",p.file);
          await fetch(`${API_BASE}/accords/${editItem.id}/fichiers`,{method:"POST",body:fd});
        }
      } else {
        const fd = new FormData();
        fd.append("titre",form.titre); fd.append("reference",form.reference);
        fd.append("pays_signataires",paysStr||"");
        if (form.date_signature)      fd.append("date_signature",     form.date_signature);
        if (form.date_entree_vigueur) fd.append("date_entree_vigueur",form.date_entree_vigueur);
        if (form.date_expiration)     fd.append("date_expiration",    form.date_expiration);
        if (form.thematiques)         fd.append("secteur_activite",   form.thematiques);
        if (form.commentaires)        fd.append("commentaires",       form.commentaires);
        fd.append("statut",form.statut); fd.append("est_publie","true");
        const res = await fetch(`${API_BASE}/accords`,{method:"POST",body:fd});
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const na = await res.json();
        for (const p of pdfQueue) {
          const fd2=new FormData(); fd2.append("titre",p.titre||p.file.name); fd2.append("fichier",p.file);
          await fetch(`${API_BASE}/accords/${na.id}/fichiers`,{method:"POST",body:fd2});
        }
      }
      setSaveOk(true as any);
      setTimeout(()=>{ onClose(); onSaved(); },700);
    } catch(e:any){ setError(e.message||"Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  };

  const IS:any = { width:"100%", background:"#F2F0EF", border:"1px solid #C5BFBB", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const };
  const LS:any = { fontSize:12, fontWeight:600, color:"#4a5568", marginBottom:4, display:"block" };
  const SS:any = { fontSize:11, fontWeight:700, color:"#7c3aed", letterSpacing:"0.12em", textTransform:"uppercase" as const, marginBottom:12, paddingBottom:8, borderBottom:"1px solid #E8E5E3" };

  if (!open) return null;
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:780,maxHeight:"92vh",overflowY:"auto",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{height:4,background:"linear-gradient(90deg,#7c3aed,#6d28d9)",borderRadius:"20px 20px 0 0"}}/>
        <div style={{padding:"24px 32px 32px"}}>

          {/* Header */}
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
              <div style={{maxWidth:200}}>
                <label style={LS}>Statut</label>
                <select value={form.statut} onChange={e=>update("statut",e.target.value)} style={{...IS,cursor:"pointer"}}>
                  {STATUTS.map(s=><option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            {/* Parties */}
            <div>
              <p style={SS}>Parties signataires</p>
              <div style={{display:"flex",gap:0,marginBottom:12,border:"1px solid #C5BFBB",borderRadius:8,overflow:"hidden",width:"fit-content"}}>
                {(["pays","organisation"] as const).map(mode=>(
                  <button key={mode} onClick={()=>{ update("mode_signataire",mode); update("pays_signataires",mode==="pays"?[SENEGAL]:[APIX]); setSaisieOrg(""); }}
                    style={{padding:"7px 18px",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
                      background:form.mode_signataire===mode?"#7c3aed":"#F2F0EF",
                      color:form.mode_signataire===mode?"#fff":"#9aa5b4"}}>
                    {mode==="pays"?"Pays":"Organisation / Entreprise"}
                  </button>
                ))}
              </div>
              {form.mode_signataire==="pays" ? (
                <>
                  <PaysMultiSelect value={(form.pays_signataires as string[]).join(", ")} onChange={(val:string)=>{
                    const liste = val?val.split(", ").map((s:string)=>s.trim()).filter(Boolean):[];
                    update("pays_signataires",liste.includes(SENEGAL)?liste:[SENEGAL,...liste]);
                  }}/>
                  <span style={{fontSize:11,color:"#9aa5b4",marginTop:4,display:"block"}}>Le Sénégal est toujours signataire. Au moins un autre pays est requis.</span>
                </>
              ) : (
                <>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {(form.pays_signataires as string[]).map((p:string)=>(
                      <span key={p} style={{display:"inline-flex",alignItems:"center",gap:5,
                        background:p===APIX?"rgba(0,79,145,0.1)":"rgba(202,99,31,0.1)",
                        color:p===APIX?"#004f91":"#ca631f",
                        border:`1px solid ${p===APIX?"rgba(0,79,145,0.2)":"rgba(202,99,31,0.2)"}`,
                        borderRadius:999,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                        {p}
                        {p!==APIX&&<button onClick={()=>update("pays_signataires",(form.pays_signataires as string[]).filter((x:string)=>x!==p))}
                          style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={10}/></button>}
                      </span>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input value={saisieOrg} onChange={e=>setSaisieOrg(e.target.value)} placeholder="Ex : Organisation Mondiale du Commerce" style={{...IS,flex:1}}
                      onKeyDown={e=>{ if(e.key==="Enter"&&saisieOrg.trim()){ e.preventDefault(); const v=saisieOrg.trim(); if(!(form.pays_signataires as string[]).includes(v)) update("pays_signataires",[...(form.pays_signataires as string[]),v]); setSaisieOrg(""); }}}/>
                    <button onClick={()=>{ const v=saisieOrg.trim(); if(!v) return; if(!(form.pays_signataires as string[]).includes(v)) update("pays_signataires",[...(form.pays_signataires as string[]),v]); setSaisieOrg(""); }}
                      style={{padding:"9px 16px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>Ajouter</button>
                  </div>
                </>
              )}
            </div>

            {/* Dates */}
            <div>
              <p style={SS}>Dates</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <label style={LS}>Date de signature *</label>
                  <input type="date" value={form.date_signature} max={new Date().toISOString().split("T")[0]} onChange={e=>update("date_signature",e.target.value)}
                    style={{...IS,borderColor:form.date_signature&&form.date_signature>new Date().toISOString().split("T")[0]?"#dc2626":"#C5BFBB"}}/>
                  <span style={{fontSize:11,color:"#9aa5b4",marginTop:3,display:"block"}}>Inférieure ou égale à aujourd'hui</span>
                </div>
                <div>
                  <label style={LS}>Entrée en vigueur *</label>
                  <input type="date" value={form.date_entree_vigueur} min={form.date_signature||undefined} onChange={e=>update("date_entree_vigueur",e.target.value)}
                    style={{...IS,borderColor:form.date_entree_vigueur&&form.date_signature&&form.date_entree_vigueur<form.date_signature?"#dc2626":"#C5BFBB"}}/>
                  <span style={{fontSize:11,color:"#9aa5b4",marginTop:3,display:"block"}}>Supérieure ou égale à la signature</span>
                </div>
                <div>
                  <label style={LS}>Date d'expiration *</label>
                  <input type="date" value={form.date_expiration} onChange={e=>update("date_expiration",e.target.value)}
                    style={{...IS,borderColor:form.date_expiration&&form.date_expiration<=new Date().toISOString().split("T")[0]?"#dc2626":"#C5BFBB"}}/>
                  <span style={{fontSize:11,color:"#9aa5b4",marginTop:3,display:"block"}}>Dans le futur, après l'entrée en vigueur</span>
                </div>
              </div>
            </div>

            {/* Thématiques */}
            <div>
              <p style={SS}>Thématiques</p>
              <ThematiquesNaema value={form.thematiques} onChange={val=>update("thematiques",val)}/>
            </div>

            {/* Commentaires */}
            <div>
              <p style={SS}>Résumé / Commentaires</p>
              <textarea value={form.commentaires} onChange={e=>update("commentaires",e.target.value)} rows={3}
                placeholder="Description et résumé des termes de l'accord..."
                style={{...IS,resize:"vertical" as const}}/>
            </div>

            {/* PDFs */}
            <div>
              <p style={SS}>Fichiers PDF</p>
              {fichiers.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {fichiers.map((f:any)=>(
                    <div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:5}}>
                      <a href={`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#7c3aed",textDecoration:"none",fontWeight:500}}>
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
                <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
                  {pdfQueue.map((p,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:8,padding:"7px 12px"}}>
                      <FileText size={13} style={{color:"#7c3aed",flexShrink:0}}/>
                      <input value={p.titre} onChange={e=>setPdfQueue(prev=>prev.map((x,j)=>j===i?{...x,titre:e.target.value}:x))}
                        placeholder="Titre du document"
                        style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid rgba(124,58,237,0.3)",outline:"none",fontSize:12,padding:"2px 0",fontFamily:"var(--font-google-sans)"}}/>
                      <button onClick={()=>setPdfQueue(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><X size={13} style={{color:"#dc2626"}}/></button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:8,cursor:"pointer",border:"2px dashed #C5BFBB",background:"#F2F0EF"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#7c3aed"}
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
              <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-google-sans)"}}>Annuler</button>
              <button onClick={handleSave} disabled={saving||!!saveOk}
                style={{padding:"10px 24px",borderRadius:10,border:"none",background:saveOk?"#dcfce7":"linear-gradient(135deg,#7c3aed,#6d28d9)",color:saveOk?"#15803d":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-google-sans)"}}>
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
  useEffect(()=>{
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r=>r.json()).then(setFichiers).catch(()=>{});
  },[a.id]);

  // Parser la hiérarchie thématique depuis "sec:X, bra:Y, act:Z"
  const parseThematiques = (raw:string) => {
    if (!raw) return null;
    const items = raw.split(",").map((s:string)=>s.trim()).filter(Boolean);
    const secs = items.filter(s=>s.startsWith("sec:")).map(s=>s.slice(4));
    const bras = items.filter(s=>s.startsWith("bra:")).map(s=>s.slice(4));
    const acts = items.filter(s=>s.startsWith("act:")).map(s=>s.slice(4));
    if (!secs.length && !bras.length && !acts.length) return null;
    // Structure plate — on affiche secteur(s) → branche(s) → activité(s)
    return { secs, bras, acts };
  };
  const th = parseThematiques(a.secteur_activite);

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        {/* Bande tricolore */}
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{a.titre}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {a.reference&&<span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{a.reference}</span>}
                <span style={{fontSize:11,fontWeight:700,color:a.statut==="en_vigueur"?"#188038":"#9aa5b4",background:a.statut==="en_vigueur"?"rgba(24,128,56,0.08)":"#F2F0EF",border:`1px solid ${a.statut==="en_vigueur"?"rgba(24,128,56,0.2)":"#E8E5E3"}`,padding:"2px 9px",borderRadius:999}}>
                  {STATUT_LABELS[a.statut]||a.statut}
                </span>
                <span style={{fontSize:11,fontWeight:700,color:a.est_publie?"#15803d":"#9aa5b4",background:a.est_publie?"#dcfce7":"#F2F0EF",padding:"2px 9px",borderRadius:999}}>{a.est_publie?"Publié":"Non publié"}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>

          {/* Résumé */}
          {a.commentaires&&(
            <div style={{background:"rgba(227,83,54,0.04)",border:"1px solid rgba(227,83,54,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
              <LBL>Résumé</LBL>
              <p style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}>{a.commentaires}</p>
            </div>
          )}

          {/* Grille infos */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {a.date_signature&&(
              <div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Date de signature</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_signature)}</p>
              </div>
            )}
            {a.date_entree_vigueur&&(
              <div style={{background:"rgba(24,128,56,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Entrée en vigueur</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p>
              </div>
            )}
            {a.date_expiration&&(
              <div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}>
                <LBL>Expiration</LBL>
                <p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_expiration)}</p>
              </div>
            )}
          </div>

          {/* Parties signataires */}
          {a.pays_signataires&&(
            <div style={{marginBottom:16}}>
              <LBL>Parties signataires</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {a.pays_signataires.split(", ").filter(Boolean).map((p:string)=>(
                  <span key={p} style={{fontSize:12,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.07)",border:"1px solid rgba(54,111,227,0.18)",padding:"3px 11px",borderRadius:999}}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Thématiques en arborescence */}
          {th&&(
            <div style={{marginBottom:16}}>
              <LBL>Thématiques</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {th.secs.map((sec:string)=>(
                  <div key={sec}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:th.bras.length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec}</span>
                    </div>
                    {th.bras.length>0&&(
                      <div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:6}}>
                        {th.bras.map((bra:string)=>(
                          <div key={bra}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:th.acts.length?4:0}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                              <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra}</span>
                            </div>
                            {th.acts.length>0&&(
                              <div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                {th.acts.map((act:string)=>(
                                  <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                    <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Activités sans branche */}
                    {!th.bras.length&&th.acts.length>0&&(
                      <div style={{paddingLeft:20,display:"flex",flexDirection:"column" as const,gap:3}}>
                        {th.acts.map((act:string)=>(
                          <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                            <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {/* Branches sans secteur */}
                {!th.secs.length&&th.bras.map((bra:string)=>(
                  <div key={bra} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/>
                    <span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents PDF */}
          {fichiers.length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Documents</LBL>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(227,83,54,0.06)",border:"1px solid rgba(227,83,54,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#E35336",textDecoration:"none",fontWeight:500}}>
                    <FileText size={11}/> {f.titre||f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end",borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={()=>{onClose();onEdit(a);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 18px",borderRadius:9,border:"none",background:"#366FE3",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
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
  const [deleting,   setDeleting]   = useState<string|null>(null);
  const [togglingId, setTogglingId] = useState<string|null>(null);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/accords?per_page=100&admin=true`);
      const data = await res.json();
      setAccords(data.data||[]); setTotal(data.total||0);
    } catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (a:any) => { setEditItem(a); setModal(true); };

  const handleDelete = async (id:string) => {
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

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
        <div>
          <p style={{fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>Administration</p>
          <h1 style={{fontWeight:800,fontSize:"1.75rem",color:"#1a1a2e"}}>Accords &amp; Traités</h1>
          <p style={{color:"#9aa5b4",fontSize:13,marginTop:2}}>{total} accord{total>1?"s":""} au total</p>
        </div>
        <button onClick={openCreate} style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",fontWeight:700,fontSize:13,padding:"11px 20px",borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(124,58,237,0.3)"}}>
          <Plus size={15}/> Ajouter un accord
        </button>
      </div>

      {/* Cards */}
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
          {accords.map(a=>(
            <div key={a.id}
              onClick={()=>setVue(a)}
              style={{background:"#fff",border:"1px solid #E8E5E3",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",borderLeft:`3px solid ${a.est_publie?"#E35336":"#C5BFBB"}`,cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(227,83,54,0.12)"; ev.currentTarget.style.borderColor="#FFB0A1";}}
              onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.borderColor="#E8E5E3"; ev.currentTarget.style.borderLeftColor=a.est_publie?"#E35336":"#C5BFBB";}}>

              {/* Titre */}
              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:a.reference?3:8}}>
                {a.titre.length>65?a.titre.slice(0,65)+"…":a.titre}
              </div>
              {a.reference&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{a.reference}</div>}

              {/* Expire le */}
              <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                {a.date_expiration&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#E35336",flexShrink:0}}/>
                    <span style={{color:"#4a5568"}}>Expire le {fmtDate(a.date_expiration)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{display:"flex",gap:5,borderTop:"1px solid #F2F0EF",paddingTop:10}} onClick={ev=>ev.stopPropagation()}>
                <button onClick={()=>openEdit(a)}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:7,padding:"6px 0",fontSize:11,color:"#366FE3",fontWeight:600}}>
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
          ))}
        </div>
      )}

      {vue && <AccordVue accord={vue} onClose={()=>setVue(null)} onEdit={a=>{ setVue(null); openEdit(a); }}/>}
      <AccordModal open={modal} onClose={()=>setModal(false)} editItem={editItem} onSaved={charger}/>
    </div>
  );
}
