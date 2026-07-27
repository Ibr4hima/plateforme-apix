"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { FModal, FSection, FGrid, FLabel, FInput, FSegmented, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import BarreTitre from "@/components/shared/BarreTitre";
import AdminMenu from "@/components/admin/AdminMenu";
import AccordVueModal from "@/components/shared/AccordVueModal";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fetchTous } from "@/lib/fetchTous";
import { badge_bleu, badge_vert, badge_gris } from "@/lib/couleurs";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import { fmtDate as fmtDateLib } from "@/lib/format";
import { computeStatutAccord as computeStatut } from "@/lib/statuts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SENEGAL = "Sénégal";
const APIX    = "APIX S.A";

const fmtDate = (d: string) => fmtDateLib(d) || "—";

// ── Pastille pays (badge_bleu) avec suppression optionnelle ───────────────────
function PillPays({ nom, onRemove }: { nom: string; onRemove?: () => void }) {
  return (
    <span style={{ ...badge_bleu, fontWeight: 700 }}>
      {nom}
      {onRemove && (
        <button onClick={onRemove} aria-label={`Retirer ${nom}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit" }}>
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// ── Bouton « + » d'ajout de pays : popover avec recherche et liste groupée ────
// fermerApresChoix : true = sélection unique (TBI), false = on enchaîne les ajouts.
function BoutonAjoutPays({ allPays, exclusIds, onPick, fermerApresChoix = false }: {
  allPays: any[]; exclusIds: number[]; onPick: (p: any) => void; fermerApresChoix?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const dispo = allPays.filter((p: any) => p.nom_fr !== SENEGAL && !exclusIds.includes(p.id)
    && (!q || p.nom_fr.toLowerCase().includes(q.toLowerCase())));
  const groupes = Object.entries(
    dispo.reduce((acc: any, p: any) => { const c = p.region_monde || "Autre"; (acc[c] ||= []).push(p); return acc; }, {})
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Ajouter un pays" title="Ajouter un pays"
        style={{ width: 28, height: 28, borderRadius: 999, border: `1.5px dashed ${open ? "#004f91" : "rgba(0,79,145,0.35)"}`,
          background: open ? "rgba(0,79,145,0.08)" : "rgba(255,255,255,0.7)", color: "#004f91", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#004f91"; e.currentTarget.style.background = "rgba(0,79,145,0.08)"; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = "rgba(0,79,145,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.7)"; } }}>
        <Plus size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 220, width: 300,
          border: "1px solid #E4E1DE", borderRadius: 12, background: "#fff", boxShadow: "var(--ombre-2)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #F2F0EF" }}>
            <input ref={inputRef} className="fui-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", boxSizing: "border-box" as const, background: "#FCFCFB", borderWidth: 1, borderStyle: "solid", borderColor: "#E2E1DE", borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" as const }}>
            {groupes.map(([continent, pays]: any) => (
              <div key={continent}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.04)", padding: "5px 12px", letterSpacing: "0.1em", textTransform: "uppercase" as const, position: "sticky" as const, top: 0 }}>{continent}</div>
                {pays.map((p: any) => (
                  <button key={p.id} onClick={() => { onPick(p); setQ(""); if (fermerApresChoix) setOpen(false); else inputRef.current?.focus(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const, borderBottom: "1px solid #F2F0EF", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 500 }}>{p.nom_fr}</span>
                  </button>
                ))}
              </div>
            ))}
            {dispo.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "14px 0" }}>Aucun pays trouvé</p>}
          </div>
        </div>
      )}
    </div>
  );
}

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
    setPdfQueue([]); setError(""); setSaveOk(false);
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
  const tbiTitre   = tbiAutreId ? `Sénégal — ${allPays.find((p:any)=>p.id===tbiAutreId)?.nom_fr||""}` : "";

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
      subtitle={editItem ? editItem.titre : "Les champs marqués * sont obligatoires"}
      footer={<>
        {error && <FError style={{ flex:1, minWidth:0 }}>{error}</FError>}
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Sauvegarde…" : editItem ? "Modifier" : "Créer l'accord"}
        </FButton>
      </>}>

      {/* Type d'accord + identification (le titre TBI est dérivé des deux pays) */}
      <FSection title="Type d'accord">
        <FSegmented options={[
          {value:"tbi",   label:"Traité Bilatéral d'Investissement"},
          {value:"inter", label:"Traité International"},
        ]} value={form.type_accord} onChange={v=>update("type_accord",v)} />
        {form.type_accord !== "tbi" && (
          <FGrid cols="2fr 1fr" style={{ marginTop:14 }}>
            <div><FLabel>Titre *</FLabel><FInput value={form.titre} onChange={e=>update("titre",e.target.value)} placeholder="Intitulé complet de l'accord" /></div>
            <div><FLabel>Référence *</FLabel><FInput value={form.reference} onChange={e=>update("reference",e.target.value)} placeholder="Ex : APIX/2024/ACC-001" /></div>
          </FGrid>
        )}
      </FSection>

      {form.type_accord === "tbi" ? (
      /* TBI : Sénégal + un pays — le titre de l'accord est dérivé (ex. Sénégal - Maroc) */
      <FSection title="Pays signataires">
        <div style={{display:"flex",alignItems:"center",flexWrap:"wrap" as const,gap:6}}>
          <PillPays nom="Sénégal" />
          {tbiAutreId&&(()=>{const p=allPays.find((r:any)=>r.id===tbiAutreId); return p?(
            <PillPays nom={p.nom_fr} onRemove={()=>update("pays_ids",senIdRef?[senIdRef]:[])} />
          ):null;})()}
          <BoutonAjoutPays allPays={allPays} exclusIds={[senIdRef, tbiAutreId].filter(Boolean) as number[]} fermerApresChoix
            onPick={p=>update("pays_ids",senIdRef?[senIdRef,p.id]:[p.id])} />
        </div>
        {tbiTitre&&<p style={{fontSize:12,color:"#9aa5b4",marginTop:12}}>Titre de l&apos;accord : <strong style={{color:"#1a1a2e"}}>{tbiTitre}</strong></p>}
      </FSection>
      ) : (<>
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
          <div style={{display:"flex",alignItems:"center",flexWrap:"wrap" as const,gap:6}}>
            {(form.pays_ids as number[]).map((id:number)=>{
              const p=allPays.find((r:any)=>r.id===id);
              if (!p) return null;
              const isSen=p.nom_fr===SENEGAL;
              return <PillPays key={id} nom={p.nom_fr} onRemove={isSen?undefined:()=>update("pays_ids",(form.pays_ids as number[]).filter((x:number)=>x!==id))} />;
            })}
            <BoutonAjoutPays allPays={allPays} exclusIds={form.pays_ids as number[]}
              onPick={p=>update("pays_ids",[...(form.pays_ids as number[]),p.id])} />
          </div>
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
    </FModal>
  );
}
// ── Carte accord (gabarit public + barre d'actions d'administration) ──────────

// Durée écoulée depuis une date : « 3 ans », « 1 an », « 7 mois »…
const dureeDepuis = (dstr: string): string => {
  const d = new Date(dstr + "T00:00:00"), now = new Date();
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) mois -= 1;
  if (mois < 1) return "moins d'un mois";
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `${ans} an${ans > 1 ? "s" : ""}`;
  return `${mois} mois`;
};

// Statuts sur les jetons du design system : en vigueur vert, signé bleu,
// expiré gris ; l'accent de survol suit la couleur du statut.
const STATUT_CARTE: Record<string, { label: string; badge: React.CSSProperties; accent: string }> = {
  en_vigueur: { label: "En vigueur",           badge: badge_vert, accent: "#188038" },
  signe:      { label: "Signé non en vigueur", badge: badge_bleu, accent: "#004f91" },
  expire:     { label: "Expiré",               badge: badge_gris, accent: "#9aa5b4" },
};

function CarteAccord({ a, onVoir, onEditer, onPublier, onSupprimer, publiant, supprimant }: {
  a: any; onVoir: () => void; onEditer: () => void; onPublier: () => void; onSupprimer: () => void;
  publiant: boolean; supprimant: boolean;
}) {
  const statut = computeStatut(a);
  const st = statut ? STATUT_CARTE[statut] : null;
  const estExpire = statut === "expire";
  const txtC = estExpire ? "#4a5568" : "#1a1a2e";
  const accent = st ? st.accent : "#C5BFBB";
  // Date secondaire : expiration si renseignée, sinon entrée en vigueur
  const dateSec = a.date_expiration
    ? { label: "Expiration", val: fmtDate(a.date_expiration), vide: false }
    : { label: "Entrée en vigueur", val: a.date_entree_vigueur ? fmtDate(a.date_entree_vigueur) : "Non définie", vide: !a.date_entree_vigueur };
  const sousTitre = statut === "en_vigueur" && a.date_entree_vigueur ? `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`
    : statut === "signe" && a.date_signature ? `Signé il y a ${dureeDepuis(a.date_signature)}`
    : statut === "expire" && a.date_expiration ? `Expiré depuis ${dureeDepuis(a.date_expiration)}`
    : a.reference || null;

  return (
    <div onClick={onVoir}
      style={{ background: estExpire ? "#FBFAF9" : "#fff", border: "1px solid rgba(16,26,46,0.12)", borderRadius: 16, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "none", display: "flex", flexDirection: "column" as const, overflow: "hidden", opacity: a.est_publie === false ? 0.85 : 1 }}
      onMouseEnter={ev => { ev.currentTarget.style.boxShadow = "var(--ombre-1)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = accent; }}
      onMouseLeave={ev => { ev.currentTarget.style.boxShadow = "none"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = "rgba(16,26,46,0.12)"; }}>

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Titre + ancienneté du statut | publication & statut */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: txtC, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{a.titre}</div>
            {sousTitre && <div style={{ fontSize: 11, fontWeight: 500, color: "#9aa5b4", marginTop: 3 }}>{sousTitre}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" as const, justifyContent: "flex-end" }}>
            {a.est_publie === false && <span style={{ ...badge_gris, whiteSpace: "nowrap" as const, flexShrink: 0 }}>Non publié</span>}
            {st && <span style={{ ...st.badge, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{st.label}</span>}
          </div>
        </div>

        {/* Dates en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #F2F0EF", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Signature</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: a.date_signature ? txtC : "#C5BFBB", fontVariantNumeric: "tabular-nums" }}>{a.date_signature ? fmtDate(a.date_signature) : "—"}</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#F2F0EF", margin: "0 18px" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>{dateSec.label}</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: dateSec.vide ? "#C5BFBB" : txtC, fontVariantNumeric: "tabular-nums" }}>{dateSec.val}</p>
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
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: a.est_publie ? "#188038" : "#ca631f", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
          onMouseEnter={ev => ev.currentTarget.style.background = a.est_publie ? "rgba(24,128,56,0.05)" : "rgba(202,99,31,0.06)"}
          onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
          {publiant ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : a.est_publie ? <><EyeOff size={12} /> Retirer</> : <><Eye size={12} /> Publier</>}
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
export default function AdminAccords() {
  const [accords,    setAccords]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [erreur,     setErreur]     = useState(false);
  const [modal,      setModal]      = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [vue,        setVue]        = useState<any>(null);
  const [deleting,   setDeleting]   = useState<number|null>(null);
  const [togglingId, setTogglingId] = useState<number|null>(null);

  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
    try {
      // Pagination complète : `per_page` est plafonné à 100 côté API.
      const data = await fetchTous(`${API_BASE}/accords?admin=true`);
      // Les échéances les plus proches d'abord ; sans expiration en dernier.
      setAccords(data.slice().sort((a: any, b: any) => {
        if (!a.date_expiration && !b.date_expiration) return 0;
        if (!a.date_expiration) return 1;
        if (!b.date_expiration) return -1;
        return a.date_expiration.localeCompare(b.date_expiration);
      }));
    } catch (e) { console.error(e); setErreur(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const openCreate = () => { setEditItem(null); setModal(true); };
  const openEdit   = (a: any) => { setEditItem(a); setModal(true); };

  const handleDelete = async (id: number) => {
    if (!(await confirmer("Supprimer cet accord ?"))) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/accords/${id}`, { method: "DELETE", headers: await authHeaders() }); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (a: any) => {
    setTogglingId(a.id);
    try {
      await fetch(`${API_BASE}/accords/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ est_publie: !a.est_publie }) });
      charger();
    } finally { setTogglingId(null); }
  };

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Accords & Traités" compact ton="orange" pleineLargeur actions={<AdminMenu />}
        droite={
          <button className="ro-w" onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#ca631f", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 3px 12px rgba(0,0,0,0.16)", fontFamily: "var(--font-google-sans)", transition: "background 0.15s, transform 0.15s", flexShrink: 0, whiteSpace: "nowrap" as const }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FFF6EF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "none"; }}>
            <Plus size={15} /> Ajouter un accord
          </button>
        }>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.24)", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{accords.length}</span>
      </BarreTitre>

      {/* ── Grille pleine largeur (3 colonnes) ── */}
      <div style={{ padding: "28px 40px 80px" }}>
        {loading ? (
          <SkeletonCards n={6} cols={3} height={200} />
        ) : erreur ? (
          <ErreurChargement onRetry={() => charger()} />
        ) : accords.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
            <FileText size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun accord enregistré</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>Cliquez sur « Ajouter un accord » pour commencer.</p>
          </div>
        ) : (
          <div className="charge-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {accords.map(a => (
              <CarteAccord key={a.id} a={a}
                onVoir={() => setVue(a)} onEditer={() => openEdit(a)}
                onPublier={() => handleTogglePublie(a)} onSupprimer={() => handleDelete(a.id)}
                publiant={togglingId === a.id} supprimant={deleting === a.id} />
            ))}
          </div>
        )}
      </div>

      {/* Fiche (même modal que la page publique) + raccourci de modification */}
      {vue && <AccordVueModal accord={vue} onClose={() => setVue(null)} actions={
        <button className="ro-w" onClick={() => { const v = vue; setVue(null); openEdit(v); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgba(0,79,145,0.25)" }}>
          <Pencil size={13} /> Modifier
        </button>
      } />}

      <AccordModal open={modal} onClose={() => setModal(false)} editItem={editItem} onSaved={charger} />
    </div>
  );
}
