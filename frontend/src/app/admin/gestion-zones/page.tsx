"use client";

import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import GeoCascadeSelect from "@/components/shared/GeoCascadeSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import { FModal, FSection, FGrid, FLabel, FInput, FSelect, FButton, FButtonGhost, FError } from "@/components/shared/FormUI";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { Building2, Check, ChevronDown, ChevronRight, Eye, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TYPE_ZONES = [
  { key: "ZES", label: "Zones Économiques Spéciales",           code: "ZES", color: "#004f91", bg: "rgba(0,79,145,0.06)",  border: "rgba(0,79,145,0.2)" },
  { key: "ZAI", label: "Zones Aménagées pour l'Investissement", code: "ZAI", color: "#ca631f", bg: "rgba(202,99,31,0.06)", border: "rgba(202,99,31,0.2)" },
  { key: "ZFI", label: "Zones Franches Industrielles",          code: "ZFI", color: "#188038", bg: "rgba(24,128,56,0.06)",  border: "rgba(24,128,56,0.2)" },
];

// Couleurs des pôles territoriaux — identiques à la page publique
// (VueTerritorialeSenegal), indexées par nom normalisé.
const POLE_COULEURS: Record<string, string> = {
  "dakar": "#9DC3E6",          // bleu clair
  "thies": "#9DD3DE",          // bleu-teal
  "diourbel louga": "#9DDEC2", // menthe
  "centre": "#B4DE9D",         // vert tendre
  "nord": "#D2DE9D",           // vert-jaune
  "nord est": "#E6DE9D",       // jaune doux
  "sud": "#E6C79D",            // pêche
  "sud est": "#E6AC9D",        // corail clair
};
const normPole = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/pole/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
const getPoleColor = (nom: string) => POLE_COULEURS[normPole(nom)] || "#E8E5E3";
// Assombrit une couleur pastel pour obtenir un texte lisible de la même teinte
const darken = (hex: string, f = 0.42) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

const EMPTY_ZONE_FORM = {
  nom_zone: "", description: "",
  secteur_ids: [] as number[],
  branche_ids: [] as number[],
  activite_ids: [] as number[],
  pole_id: "" as string | number,
  date_creation: "", decret_creation: "", superficie: "",
  region_id: "" as string | number,
  departement_id: "" as string | number,
  arrondissement_id: "" as string | number,
};

// ── Modal ajout/modif zone ────────────────────────────────────────────────────
function ZoneModal({ open, onClose, onSaved, typeZone, editZone }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  typeZone: string; editZone: any | null;
}) {
  const [form,          setForm]          = useState<any>({ ...EMPTY_ZONE_FORM });
  const [pdfQueue,      setPdfQueue]      = useState<{ file: File; titre: string }[]>([]);
  const [fichiers,      setFichiers]      = useState<any[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saveOk,        setSaveOk]        = useState(false);
  const [error,         setError]         = useState("");
  const [regionId,      setRegionId]      = useState<number | null>(null);
  const [depId,         setDepId]         = useState<number | null>(null);
  const [poles,         setPoles]         = useState<any[]>([]);
  const [poleRegionIds, setPoleRegionIds] = useState<number[]>([]);   // ← NOUVEAU

  // Charger les pôles une fois
  useEffect(() => {
    fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()).then(setPoles).catch(() => {});
  }, []);

  // Init form à l'ouverture
  useEffect(() => {
    if (!open) return;
    setSaveOk(false); setError(""); setPdfQueue([]);
    if (editZone) {
      setForm({
        nom_zone:          editZone.nom_zone          || "",
        description:       editZone.description       || "",
        secteur_ids:       editZone.secteur_ids       || [],
        branche_ids:       editZone.branche_ids       || [],
        activite_ids:      editZone.activite_ids      || [],
        pole_id:           editZone.pole_id           ?? "",
        date_creation:     editZone.date_creation     || "",
        decret_creation:   editZone.decret_creation   || "",
        superficie:        editZone.superficie != null ? String(editZone.superficie) : "",
        region_id:         editZone.region_id         || "",
        departement_id:    editZone.departement_id    || "",
        arrondissement_id: editZone.arrondissement_id || "",
      });
      setFichiers(editZone.fichiers || []);
      setRegionId(editZone.region_id || null);
      setDepId(editZone.departement_id || null);
      // Init poleRegionIds depuis le pôle de la zone en édition
      if (editZone.pole_id) {
        const pole = poles.find((p: any) => p.id === editZone.pole_id);
        setPoleRegionIds(pole?.region_ids || []);
      } else {
        setPoleRegionIds([]);
      }
    } else {
      setForm({ ...EMPTY_ZONE_FORM });
      setFichiers([]);
      setRegionId(null);
      setDepId(null);
      setPoleRegionIds([]);
    }
  }, [open, editZone]);   // NE PAS mettre `poles` en dépendance — ça bouclerait

  if (!open) return null;

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // ── Changement de pôle → restreindre les régions ─────────────────────────
  const handlePoleChange = (poleIdStr: string) => {
    const poleId = poleIdStr ? parseInt(poleIdStr) : null;
    update("pole_id", poleId || "");
    // Réinitialiser la localisation quand le pôle change
    update("region_id",         "");
    update("departement_id",    "");
    update("arrondissement_id", "");
    setRegionId(null);
    setDepId(null);
    // Restreindre les régions aux régions du pôle
    if (poleId) {
      const pole = poles.find((p: any) => p.id === poleId);
      setPoleRegionIds(pole?.region_ids || []);
    } else {
      setPoleRegionIds([]);
    }
  };

  const handleSave = async () => {
    if (!form.nom_zone.trim()) { setError("La dénomination est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const secIds: number[] = form.secteur_ids  || [];
      const braIds: number[] = form.branche_ids  || [];
      const actIds: number[] = form.activite_ids || [];

      const url    = editZone ? `${API_BASE}/zones-types/${editZone.id}` : `${API_BASE}/zones-types`;
      const method = editZone ? "PATCH" : "POST";
      let res: Response;

      if (editZone) {
        res = await fetch(url, {
          method, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom_zone:          form.nom_zone,
            pole_id:           form.pole_id           ? String(form.pole_id)           : "0",
            description:       form.description       ?? "",
            date_creation:     form.date_creation      ?? "",
            decret_creation:   form.decret_creation    ?? "",
            superficie:        form.superficie         ?? "",
            region_id:         form.region_id         ? String(form.region_id)         : "0",
            departement_id:    form.departement_id    ? String(form.departement_id)    : "0",
            arrondissement_id: form.arrondissement_id ? String(form.arrondissement_id) : "0",
            secteur_ids:  JSON.stringify(secIds),
            branche_ids:  JSON.stringify(braIds),
            activite_ids: JSON.stringify(actIds),
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("nom_zone",        form.nom_zone);
        fd.append("type_zone",       typeZone);
        fd.append("pole_id",         form.pole_id        ? String(form.pole_id)        : "0");
        fd.append("description",     form.description    ?? "");
        fd.append("date_creation",   form.date_creation  ?? "");
        fd.append("decret_creation", form.decret_creation ?? "");
        fd.append("superficie",      form.superficie      ?? "");
        fd.append("secteur_ids",     JSON.stringify(secIds));
        fd.append("branche_ids",     JSON.stringify(braIds));
        fd.append("activite_ids",    JSON.stringify(actIds));
        fd.append("est_publie",      "true");
        if (form.region_id)         fd.append("region_id",         String(form.region_id));
        if (form.departement_id)    fd.append("departement_id",    String(form.departement_id));
        if (form.arrondissement_id) fd.append("arrondissement_id", String(form.arrondissement_id));
        res = await fetch(url, { method, body: fd });
      }

      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const zone = await res.json();

      for (const p of pdfQueue) {
        const fd2 = new FormData();
        fd2.append("titre",   p.titre || p.file.name);
        fd2.append("fichier", p.file);
        await fetch(`${API_BASE}/zones-types/${zone.id}/fichiers`, { method: "POST", body: fd2 });
      }

      setSaveOk(true);
      setTimeout(() => { onClose(); onSaved(); }, 700);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const supprimerFichier = async (fichId: string) => {
    if (!editZone) return;
    await fetch(`${API_BASE}/zones-types/${editZone.id}/fichiers/${fichId}`, { method: "DELETE" });
    setFichiers(prev => prev.filter((f: any) => f.id !== fichId));
  };

  const t = TYPE_ZONES.find(tz => tz.key === typeZone)!;
  const localisationBloquee = !form.pole_id;

  return (
    <FModal open={open} onClose={onClose} maxWidth={680}
      title={editZone ? "Modifier la zone" : `Nouvelle zone ${typeZone}`}
      subtitle={t.label}
      footer={<>
        <FButtonGhost onClick={onClose}>Annuler</FButtonGhost>
        <FButton onClick={handleSave} disabled={saving || saveOk} loading={saving} success={saveOk}>
          {saveOk ? "Enregistré !" : saving ? "Enregistrement…" : editZone ? "Modifier" : "Créer la zone"}
        </FButton>
      </>}>

      {/* Identification */}
      <FSection title="Identification">
        <FGrid cols="1fr 1fr">
          <div>
            <FLabel>Dénomination *</FLabel>
            <FInput value={form.nom_zone} onChange={e => update("nom_zone", e.target.value)} placeholder={`Ex : ${typeZone} de Diamniadio`} />
          </div>
          <div>
            <FLabel>Pôle territorial *</FLabel>
            <FSelect value={form.pole_id || ""} onChange={e => handlePoleChange(e.target.value)}>
              <option value="">— Sélectionner un pôle d'abord —</option>
              {poles.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.pole_territoire}{p.localisation ? ` — ${p.localisation}` : ""}
                </option>
              ))}
            </FSelect>
          </div>
        </FGrid>
      </FSection>

      {/* Localisation — grisée si pas de pôle, restreinte aux régions du pôle */}
      <div style={{ opacity: localisationBloquee ? 0.45 : 1, pointerEvents: localisationBloquee ? "none" : "auto", transition: "opacity 0.2s" }}>
        <FSection title="Localisation">
          <GeoCascadeSelect
            regionId={form.region_id || null}
            departementId={form.departement_id || null}
            arrondissementId={form.arrondissement_id || null}
            filterRegionIds={poleRegionIds.length > 0 ? poleRegionIds : undefined}
            onChangeRegion={id => { update("region_id", id || ""); update("departement_id", ""); update("arrondissement_id", ""); setRegionId(id); setDepId(null); }}
            onChangeDepartement={id => { update("departement_id", id || ""); update("arrondissement_id", ""); setDepId(id); }}
            onChangeArrondissement={id => update("arrondissement_id", id || "")}
          />
        </FSection>
      </div>

      {/* Informations officielles */}
      <FSection title="Informations officielles">
        <FGrid cols={2} gap={10} style={{ marginBottom: 10 }}>
          <div>
            <FLabel>Date de création</FLabel>
            <FInput type="date" value={form.date_creation} max={new Date().toISOString().split("T")[0]} onChange={e => update("date_creation", e.target.value)} />
          </div>
          <div>
            <FLabel>Superficie (hectares)</FLabel>
            <FInput type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={form.superficie} onChange={e => update("superficie", e.target.value)} placeholder="Ex : 1700.50" />
          </div>
        </FGrid>
        <div>
          <FLabel>Décret de création</FLabel>
          <FInput value={form.decret_creation} onChange={e => update("decret_creation", e.target.value)} placeholder="Ex : Décret n° 2002-1036 du 03/10/2002" />
        </div>
      </FSection>

      {/* Classification NAEMA */}
      <FSection title="Activité(s) autorisées">
        <NaemaSelect
          secteurIds={form.secteur_ids || []}
          brancheIds={form.branche_ids || []}
          activiteIds={form.activite_ids || []}
          onChangeSecteurs={ids => update("secteur_ids", ids)}
          onChangeBranches={ids => update("branche_ids", ids)}
          onChangeActivites={ids => update("activite_ids", ids)}
        />
      </FSection>

      {/* Description */}
      <FSection title="Description">
        <RichTextEditor value={form.description} onChange={v => update("description", v)}/>
      </FSection>

      {/* Documents */}
      <FSection title="Documents">
        {fichiers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
            {fichiers.map((f: any) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 10, padding: "8px 12px" }}>
                <FileText size={13} style={{ color: "#004f91" }} />
                <span style={{ fontSize: 13, flex: 1, color: "#1a1a2e", fontWeight: 500 }}>{f.titre || f.fichier_nom}</span>
                <button onClick={() => supprimerFichier(f.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: "2px dashed #E4E1DE", background: "#FAFAF9", transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#004f91"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#E4E1DE"}>
          <Upload size={14} color="#9aa5b4" />
          <span style={{ fontSize: 13, color: "#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
          <input type="file" accept=".pdf" multiple style={{ display: "none" }}
            onChange={e => { const files = Array.from(e.target.files || []); setPdfQueue(prev => [...prev, ...files.map(f => ({ file: f, titre: f.name.replace(/\.pdf$/i, "") }))]); e.target.value = ""; }} />
        </label>
        {pdfQueue.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
            {pdfQueue.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(106,27,154,0.05)", border: "1px solid rgba(106,27,154,0.2)", borderRadius: 10, padding: "8px 12px" }}>
                <FileText size={13} style={{ color: "#6A1B9A" }} />
                <input value={p.titre} onChange={e => setPdfQueue(prev => prev.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))} placeholder="Titre du document"
                  style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(106,27,154,0.3)", outline: "none", fontSize: 12.5, padding: "2px 0", fontFamily: "var(--font-google-sans)" }} />
                <button onClick={() => setPdfQueue(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#9aa5b4" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
          </div>
        )}
      </FSection>

      {error && <FError>{error}</FError>}
    </FModal>
  );
}

// ── Modal ajout entreprises avec statuts ─────────────────────────────────────
const STATUT_CONFIG: Record<string,{label:string;color:string;bg:string;border:string}> = {
  installee:    { label:"Installée",    color:"#188038", bg:"rgba(24,128,56,0.08)",  border:"rgba(24,128,56,0.2)"  },
  eligible:     { label:"Éligible",     color:"#ca631f", bg:"rgba(202,99,31,0.08)",  border:"rgba(202,99,31,0.2)"  },
  non_eligible: { label:"Non éligible", color:"#9aa5b4", bg:"#F2F0EF",               border:"#E8E5E3"              },
};

function EntreprisesModal({ open, onClose, zoneId, onSaved, zoneNom }: {
  open:boolean; onClose:()=>void; zoneId:string; onSaved:()=>void; zoneNom:string;
}) {
  const [search,  setSearch]  = useState("");
  const [all,     setAll]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saveOk,  setSaveOk]  = useState(false);
  const [filtre,  setFiltre]  = useState<"eligible"|"installee"|"non_eligible"|"tous">("eligible");
  const [choix,   setChoix]   = useState<Record<number,"eligible"|"installee">>({});

  useEffect(() => {
    if (!open) return;
    setChoix({}); setSearch(""); setSaveOk(false); setLoading(true);
    fetch(`${API_BASE}/zones-types/${zoneId}/entreprises-eligibles`)
      .then(r=>r.json()).then(setAll).catch(()=>{}).finally(()=>setLoading(false));
  }, [open, zoneId]);

  if (!open) return null;

  const filtered = all
    .filter(e=>filtre==="tous"?true:e.statut===filtre)
    .filter(e=>e.nom.toLowerCase().includes(search.toLowerCase())||(e.region_nom||"").toLowerCase().includes(search.toLowerCase()));

  const toggleChoix = (e:any) => {
    if (e.statut==="non_eligible") return;
    setChoix(prev=>{
      const cur=prev[e.id];
      if (cur===undefined) return {...prev,[e.id]:e.statut==="installee"?"installee":"eligible"};
      if (cur==="eligible") return {...prev,[e.id]:"installee"};
      const next={...prev}; delete next[e.id]; return next;
    });
  };

  const handleSauvegarder = async () => {
    const entries=Object.entries(choix);
    if (!entries.length) return;
    setSaving(true);
    try {
      for (const [eid,statut] of entries)
        await fetch(`${API_BASE}/zones-types/${zoneId}/entreprises?entreprise_id=${eid}&statut=${statut}`,{method:"POST"});
      setSaveOk(true);
      setTimeout(()=>{onClose();onSaved();},700);
    } finally { setSaving(false); }
  };

  const nbI=all.filter(e=>e.statut==="installee").length;
  const nbE=all.filter(e=>e.statut==="eligible").length;
  const nbN=all.filter(e=>e.statut==="non_eligible").length;
  const nbChoix=Object.keys(choix).length;

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(5px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:720,maxHeight:"90vh",display:"flex",flexDirection:"column",border:"1px solid #C5BFBB",boxShadow:"0 24px 64px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)",flexShrink:0}}/>
        {/* Header */}
        <div style={{padding:"18px 24px 14px",borderBottom:"1px solid #F2F0EF"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <h2 style={{fontWeight:700,fontSize:"1rem",color:"#1a1a2e"}}>Entreprises — {zoneNom}</h2>
              <p style={{fontSize:12,color:"#9aa5b4",marginTop:2}}>
                {nbI>0&&<span style={{color:"#059669",fontWeight:600,marginRight:10}}>✓ {nbI} installée{nbI>1?"s":""}</span>}
                <span style={{color:"#b45309",fontWeight:600,marginRight:10}}>{nbE} éligible{nbE>1?"s":""}</span>
                <span style={{color:"#9aa5b4"}}>{nbN} non éligible{nbN>1?"s":""}</span>
              </p>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:8}}><X size={15} color="#4a5568"/></button>
          </div>
          {/* Légende */}
          <div style={{display:"flex",gap:12,marginBottom:12,padding:"7px 12px",background:"#F8F7F6",borderRadius:8,fontSize:11,color:"#4a5568",flexWrap:"wrap" as const}}>
            <span>1 clic → <span style={{fontWeight:700,color:"#b45309"}}>Éligible</span></span>
            <span style={{color:"#C5BFBB"}}>·</span>
            <span>2 clics → <span style={{fontWeight:700,color:"#059669"}}>Installée</span></span>
            <span style={{color:"#C5BFBB"}}>·</span>
            <span>3 clics → Désélectionner</span>
          </div>
          {/* Filtres */}
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" as const}}>
            {([{v:"eligible",l:`Éligibles (${nbE})`},{v:"installee",l:`Installées (${nbI})`},{v:"non_eligible",l:`Non éligibles (${nbN})`},{v:"tous",l:"Toutes"}] as {v:string;l:string}[]).map(f=>(
              <button key={f.v} onClick={()=>setFiltre(f.v as any)}
                style={{padding:"4px 11px",borderRadius:999,fontSize:11,fontWeight:600,cursor:"pointer",border:`1.5px solid ${filtre===f.v?"#1a1a2e":"#E8E5E3"}`,background:filtre===f.v?"#1a1a2e":"#fff",color:filtre===f.v?"#fff":"#9aa5b4"}}>
                {f.l}
              </button>
            ))}
          </div>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{width:"100%",background:"#F2F0EF",border:"1px solid #C5BFBB",borderRadius:9,padding:"8px 12px 8px 32px",fontSize:13,outline:"none",boxSizing:"border-box" as const,fontFamily:"var(--font-google-sans)"}}/>
          </div>
        </div>
        {/* Liste */}
        <div style={{flex:1,overflowY:"auto",padding:"10px 24px"}}>
          {loading
            ?<div style={{display:"flex",justifyContent:"center",padding:40}}><Loader2 size={22} style={{color:"#9aa5b4",animation:"spin 1s linear infinite"}}/></div>
            :filtered.length===0
              ?<p style={{textAlign:"center",color:"#9aa5b4",fontSize:13,padding:"24px 0"}}>Aucun résultat</p>
              :<div style={{display:"flex",flexDirection:"column",gap:5}}>
                {filtered.map((e:any)=>{
                  const curChoix=choix[e.id];
                  const isChoisi=curChoix!==undefined;
                  const statutAff=isChoisi?curChoix:e.statut;
                  const cfg=STATUT_CONFIG[statutAff];
                  const clickable=e.statut!=="non_eligible";
                  return (
                    <div key={e.id} onClick={()=>clickable&&toggleChoix(e)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:clickable?"pointer":"default",borderTop:`1px solid ${isChoisi?cfg.color:cfg.border}`,borderRight:`1px solid ${isChoisi?cfg.color:cfg.border}`,borderBottom:`1px solid ${isChoisi?cfg.color:cfg.border}`,borderLeft:`3px solid ${cfg.color}`,background:isChoisi?cfg.bg:"#fff",transition:"all 0.12s",opacity:e.statut==="non_eligible"?0.5:1}}>
                      <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:`2px solid ${isChoisi?cfg.color:"#E8E5E3"}`,background:isChoisi?cfg.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {isChoisi&&<svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{width:32,height:32,borderRadius:8,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <Building2 size={14} style={{color:cfg.color}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#1a1a2e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                        <div style={{fontSize:11,color:"#9aa5b4",marginTop:1}}>
                          {[e.forme_juridique,e.region_nom].filter(Boolean).join(" · ")}
                          {e.activites_communes?.length>0&&<span style={{color:"#004f91",marginLeft:6}}>· {e.activites_communes.length} activité{e.activites_communes.length>1?"s":""} commune{e.activites_communes.length>1?"s":""}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:cfg.color,background:cfg.bg,border:`1px solid ${cfg.border}`,padding:"2px 8px",borderRadius:999,flexShrink:0}}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>}
        </div>
        {/* Footer */}
        <div style={{padding:"12px 24px",borderTop:"1px solid #F2F0EF",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:nbChoix>0?"#1a1a2e":"#9aa5b4"}}>
            {nbChoix>0?<span style={{fontWeight:600}}>{nbChoix} à enregistrer</span>:`${filtered.length} affiché${filtered.length>1?"s":""}`}
          </span>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{padding:"8px 16px",borderRadius:9,border:"1px solid #C5BFBB",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
            <button onClick={handleSauvegarder} disabled={!nbChoix||saving||saveOk}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:9,border:"none",background:saveOk?"#059669":nbChoix?"#1a1a2e":"#C5BFBB",color:"#fff",fontWeight:700,cursor:!nbChoix||saving||saveOk?"not-allowed":"pointer",fontSize:13}}>
              {saving?<><Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> Enregistrement…</>:saveOk?<><Check size={13}/> Enregistré</>:`Enregistrer (${nbChoix})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OngletPoles() {
  const [poles,    setPoles]    = useState<any[]>([]);
  const [regions,  setRegions]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<number|"new"|null>(null);
  const [forms,    setForms]    = useState<Record<string|number, any>>({});
  const [expanded, setExpanded] = useState<number|"new"|null>(null);
  const [error,    setError]    = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()),
      ]);
      setPoles(p); setRegions(r);
      const init: Record<string|number, any> = {};
      p.forEach((pole: any) => {
        init[pole.id] = { pole_territoire: pole.pole_territoire, localisation: pole.localisation || "", description: pole.description || "", region_ids: pole.region_ids || [] };
      });
      setForms(init);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const updateForm = (id: number|"new", k: string, v: any) =>
    setForms(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [k]: v } }));

  const toggleRegion = (id: number|"new", regionId: number) => {
    const current = forms[id]?.region_ids || [];
    const next = current.includes(regionId) ? current.filter((r: number) => r !== regionId) : [...current, regionId];
    updateForm(id, "region_ids", next);
    updateForm(id, "localisation", regions.filter(r => next.includes(r.id)).map(r => r.nom).join(", "));
  };

  const handleSave = async (id: number|"new") => {
    const f = forms[id] || {};
    if (!f.pole_territoire?.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(id); setError("");
    try {
      const url = id === "new" ? `${API_BASE}/zones-types/poles` : `${API_BASE}/zones-types/poles/${id}`;
      const res = await fetch(url, { method: id === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const saved = await res.json().catch(() => null);
      // Téléverser les PDF en attente
      const poleId = id === "new" ? saved?.id : id;
      if (poleId) {
        for (const p of (f.pdfQueue || [])) {
          const fd = new FormData();
          fd.append("titre", p.titre);
          fd.append("fichier", p.file);
          await fetch(`${API_BASE}/zones-types/poles/${poleId}/fichiers`, { method: "POST", body: fd });
        }
      }
      setExpanded(null);
      setForms(prev => { const n = { ...prev }; if (id === "new") delete n["new"]; return n; });
      charger();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const supprimerPoleFichier = async (poleId: number, fichierId: number) => {
    await fetch(`${API_BASE}/zones-types/poles/${poleId}/fichiers/${fichierId}`, { method: "DELETE" });
    charger();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce pôle ? Les zones liées perdront leur pôle.")) return;
    await fetch(`${API_BASE}/zones-types/poles/${id}`, { method: "DELETE" });
    charger();
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} /></div>;
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poles.map((p: any) => (
          <PoleCard key={p.id} pole={p} form={forms[p.id] || {}} isOpen={expanded === p.id}
            onToggleOpen={() => setExpanded(prev => prev === p.id ? null : p.id)}
            updateForm={updateForm} toggleRegion={toggleRegion} regions={regions}
            onSave={() => handleSave(p.id)} onCancel={() => setExpanded(null)}
            onDelete={() => handleDelete(p.id)}
            onDeleteFichier={(fid: number) => supprimerPoleFichier(p.id, fid)}
            saving={saving === p.id} error={error} />
        ))}
      </div>
    </div>
  );
}

// Composant au niveau module : son identité reste stable entre les re-rendus
// d'OngletPoles. Défini à l'intérieur, il était recréé à chaque frappe → React
// remontait tout le sous-arbre (perte de focus, touches mortes « ô » cassées,
// scroll qui saute).
function PoleCard({ pole, isNew = false, form, isOpen, onToggleOpen, updateForm, toggleRegion, regions, onSave, onCancel, onDelete, onDeleteFichier, saving, error }: {
  pole?: any; isNew?: boolean; form: any; isOpen: boolean; onToggleOpen: () => void;
  updateForm: (id: number | "new", k: string, v: any) => void;
  toggleRegion: (id: number | "new", regionId: number) => void;
  regions: any[]; onSave: () => void; onCancel: () => void; onDelete?: () => void;
  onDeleteFichier?: (fid: number) => void; saving: boolean; error: string;
}) {
  const IS: any = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
  const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };
  const id: number | "new" = isNew ? "new" : pole.id;
  const f = form;
  const pc = isNew ? null : getPoleColor(pole.pole_territoire);
  const accentColor = isNew ? "#059669" : pc!;
  const initial = (!isNew && (f.pole_territoire || pole.pole_territoire)?.[0]) || "P";
  return (
    <div style={{ background: "#fff", borderTop: `1px solid ${isOpen ? accentColor : "#C5BFBB"}`, borderRight: `1px solid ${isOpen ? accentColor : "#C5BFBB"}`, borderBottom: `1px solid ${isOpen ? accentColor : "#C5BFBB"}`, borderLeft: `4px solid ${accentColor}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
        onClick={onToggleOpen}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: isNew ? "rgba(5,150,105,0.1)" : accentColor, border: isNew ? "none" : "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isNew ? <Plus size={14} style={{ color: "#059669" }} /> : <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e" }}>{initial}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{isNew ? "Ajouter un nouveau pôle" : f.pole_territoire || pole.pole_territoire}</div>
          {!isNew && (f.localisation || pole.localisation) && <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 1 }}>{f.localisation || pole.localisation}</div>}
        </div>
        {!isNew && <button onClick={e => { e.stopPropagation(); onDelete?.(); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 8px" }}><Trash2 size={13} style={{ color: "#dc2626" }} /></button>}
        {isOpen ? <ChevronDown size={15} style={{ color: "#9aa5b4" }} /> : <ChevronRight size={15} style={{ color: "#9aa5b4" }} />}
      </div>
      {isOpen && (
        <div style={{ borderTop: `1px solid ${accentColor}30`, padding: "16px 18px", background: isNew ? "transparent" : `${accentColor}08`, display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={LS}>Nom du pôle *</label><input value={f.pole_territoire || ""} onChange={e => updateForm(id, "pole_territoire", e.target.value)} placeholder="Ex : Pôle Dakar" style={IS} /></div>
          <div>
            <label style={LS}>Régions composant ce pôle</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: "#F8F7F6", borderRadius: 10, border: "1px solid #C5BFBB" }}>
              {regions.map((r: any) => {
                const sel = (f.region_ids || []).includes(r.id);
                return <button key={r.id} onClick={() => toggleRegion(id, r.id)}
                  style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? accentColor : "#C5BFBB"}`, background: sel ? accentColor : "#fff", color: sel ? "#1a1a2e" : "#4a5568", transition: "all 0.12s" }}>
                  {r.nom}
                </button>;
              })}
            </div>
            {(f.region_ids || []).length > 0 && <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 6 }}>Localisation : {regions.filter(r => f.region_ids.includes(r.id)).map((r: any) => r.nom).join(", ")}</p>}
          </div>
          <div><label style={LS}>Description</label><RichTextEditor value={f.description || ""} onChange={v => updateForm(id, "description", v)}/></div>

          {/* Documents PDF */}
          <div>
            <label style={LS}>Documents PDF</label>
            {!isNew && (pole.fichiers || []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {pole.fichiers.map((fi: any) => (
                  <div key={fi.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 8, padding: "7px 12px" }}>
                    <FileText size={13} style={{ color: "#004f91" }} />
                    <a href={`${API_BASE}/zones-types/poles/${pole.id}/fichiers/${fi.id}/download`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, flex: 1, color: "#1a1a2e", fontWeight: 500, textDecoration: "none" }}>{fi.titre}</a>
                    <button onClick={() => onDeleteFichier?.(fi.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 8, cursor: "pointer", border: "2px dashed #C5BFBB", background: "#F8F7F6" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = accentColor}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#C5BFBB"}>
              <Upload size={14} color="#9aa5b4" />
              <span style={{ fontSize: 13, color: "#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display: "none" }}
                onChange={e => { const files = Array.from(e.target.files || []); updateForm(id, "pdfQueue", [...(f.pdfQueue || []), ...files.map(file => ({ file, titre: file.name.replace(/\.pdf$/i, "") }))]); e.target.value = ""; }} />
            </label>
            {(f.pdfQueue || []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {f.pdfQueue.map((p: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8, padding: "7px 12px" }}>
                    <FileText size={13} style={{ color: "#7c3aed" }} />
                    <input value={p.titre} onChange={e => updateForm(id, "pdfQueue", f.pdfQueue.map((x: any, j: number) => j === i ? { ...x, titre: e.target.value } : x))} placeholder="Titre"
                      style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(124,58,237,0.3)", outline: "none", fontSize: 12, padding: "2px 0", fontFamily: "var(--font-google-sans)" }} />
                    <button onClick={() => updateForm(id, "pdfQueue", f.pdfQueue.filter((_: any, j: number) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "#9aa5b4" }}>Les fichiers seront téléversés à l&apos;enregistrement.</p>
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
            <button onClick={onSave} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 18px", borderRadius: 9, border: "none", background: isNew ? "#059669" : "#1a1a2e", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : <><Check size={13} /> {isNew ? "Créer" : "Enregistrer"}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal détail d'une zone ───────────────────────────────────────────────────
function ZoneVue({ zone: z, onClose, onEdit, onAddEntreprise, onRetirerEntreprise, ouvrirFicheEnt, secteurs, branches, activites, deletingEnt, charger }: {
  zone: any | null; onClose: () => void; onEdit: () => void; onAddEntreprise: () => void;
  onRetirerEntreprise: (zoneId: string, entId: number) => void;
  ouvrirFicheEnt: (id: number) => void;
  secteurs: any[]; branches: any[]; activites: any[];
  deletingEnt: number | null; charger: () => void;
}) {
  if (!z) return null;
  const t = TYPE_ZONES.find(tz => tz.key === z.type_zone)!;
  const locStr = [z.departement_nom, z.region_nom].filter(Boolean).join(", ");

  const SecTitle = ({children}:{children:React.ReactNode}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:680, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,30,60,0.28)", animation:"vueIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height:4, background:"#004f91", flexShrink:0 }}/>

        {/* En-tête */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", lineHeight:1.3 }}>{z.nom_zone}</h2>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const, marginTop:8 }}>
              <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:800, letterSpacing:"0.04em", color:t.color, background:`${t.color}12`, padding:"3px 10px", borderRadius:999 }}>{t.code}</span>
              {z.pole_nom && <span style={{ display:"inline-flex", alignItems:"center", fontSize:10.5, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.07)", padding:"3px 10px", borderRadius:999 }}>{z.pole_nom}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"#F5F4F3", border:"none", cursor:"pointer", borderRadius:99, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>

          {/* Informations */}
          {(z.date_creation || z.decret_creation || z.superficie || locStr) && (
            <section>
              <SecTitle>Informations</SecTitle>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {locStr && <Bloc label="Localisation"><p style={{ fontSize:12.5, fontWeight:600, color:"#1a1a2e" }}>{locStr}</p></Bloc>}
                {z.superficie && <Bloc label="Superficie"><p style={{ fontSize:12.5, fontWeight:600, color:"#1a1a2e" }}>{Number(z.superficie).toLocaleString("fr-FR")} ha</p></Bloc>}
                {z.date_creation && <Bloc label="Création"><p style={{ fontSize:12.5, fontWeight:600, color:"#1a1a2e" }}>{new Date(z.date_creation + "T00:00:00").toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</p></Bloc>}
                {z.decret_creation && <Bloc label="Décret"><p style={{ fontSize:12.5, fontWeight:600, color:"#1a1a2e" }}>{z.decret_creation}</p></Bloc>}
              </div>
            </section>
          )}

          {/* Description */}
          {z.description && (
            <section>
              <SecTitle>Description</SecTitle>
              <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"13px 15px" }}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{ __html:z.description }} style={{ fontSize:13, color:"#4a5568", lineHeight:1.7 }}/>
              </div>
            </section>
          )}

          {/* NAEMA */}
          {(() => {
            const secIds: number[] = z.secteur_ids || [];
            const braIds: number[] = z.branche_ids || [];
            const actIds: number[] = z.activite_ids || [];
            if (!secIds.length && !braIds.length && !actIds.length) return null;
            if (!secteurs.length) return null;
            return (
              <section>
                <SecTitle>Activités autorisées</SecTitle>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                  {secIds.map((secId: number) => {
                    const sec = secteurs.find((s: any) => s.id === secId); if (!sec) return null;
                    const brasDuSec = branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id));
                    return (
                      <div key={secId}>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:brasDuSec.length ? 5 : 0 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:"#004f91", flexShrink:0 }}/>
                          <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>{sec.nom}</span>
                        </div>
                        {brasDuSec.length > 0 && (
                          <div style={{ paddingLeft:20, borderLeft:"2px solid rgba(0,79,145,0.15)", display:"flex", flexDirection:"column" as const, gap:5 }}>
                            {brasDuSec.map((bra: any) => {
                              const actsDeBra = activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id));
                              return (
                                <div key={bra.id}>
                                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:actsDeBra.length ? 4 : 0 }}>
                                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#ca631f", flexShrink:0 }}/>
                                    <span style={{ fontSize:11, fontWeight:600, color:"#ca631f" }}>{bra.nom}</span>
                                  </div>
                                  {actsDeBra.length > 0 && (
                                    <div style={{ paddingLeft:18, display:"flex", flexDirection:"column" as const, gap:3 }}>
                                      {actsDeBra.map((act: any) => (
                                        <div key={act.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                          <div style={{ width:5, height:5, borderRadius:"50%", background:"#188038", flexShrink:0 }}/>
                                          <span style={{ fontSize:11, color:"#188038", fontWeight:500 }}>{act.nom}</span>
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
              </section>
            );
          })()}

          {/* Entreprises */}
          <section>
            <SecTitle>Entreprises ({z.entreprises?.length || 0})</SecTitle>
            {!z.entreprises?.length
              ? <p style={{ fontSize:13, color:"#9aa5b4", fontStyle:"italic" }}>Aucune entreprise installée.</p>
              : <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                {z.entreprises.map((ze: any) => {
                  const curStatut = ze.statut || "installee";
                  const cfg = STATUT_CONFIG[curStatut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.installee;
                  const nextStatut = curStatut === "installee" ? "eligible" : "installee";
                  const nextCfg = STATUT_CONFIG[nextStatut];
                  return (
                    <div key={ze.id} onClick={() => ouvrirFicheEnt(ze.entreprise?.id)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#FAFAF9", borderRadius:12, border:"1px solid #F0EEEC", cursor:"pointer", transition:"border-color 0.15s, background 0.15s" }}
                      onMouseEnter={ev=>{ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";ev.currentTarget.style.background="#fff";}}
                      onMouseLeave={ev=>{ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";}}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ze.entreprise?.nom}</div>
                        <div style={{ fontSize:11, color:"#9aa5b4" }}>{ze.entreprise?.forme_juridique || "—"}</div>
                      </div>
                      <button title={`Passer en "${nextCfg.label}"`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await fetch(`${API_BASE}/zones-types/${z.id}/entreprises/${ze.entreprise?.id}`, { method:"POST", headers:{} });
                          await fetch(`${API_BASE}/zones-types/${z.id}/entreprises?entreprise_id=${ze.entreprise?.id}&statut=${nextStatut}`, { method:"POST" });
                          charger();
                        }}
                        style={{ fontSize:10, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}`, padding:"3px 10px", borderRadius:999, flexShrink:0, cursor:"pointer", display:"flex", alignItems:"center", gap:4, transition:"all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = nextCfg.bg; e.currentTarget.style.color = nextCfg.color; e.currentTarget.style.borderColor = nextCfg.border; }}
                        onMouseLeave={e => { e.currentTarget.style.background = cfg.bg; e.currentTarget.style.color = cfg.color; e.currentTarget.style.borderColor = cfg.border; }}>
                        {cfg.label}
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.6 }}><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); ouvrirFicheEnt(ze.entreprise?.id); }}
                        style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(0,79,145,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 10px", fontSize:11, color:"#004f91", fontWeight:600 }}>
                        <Eye size={12}/> Fiche
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onRetirerEntreprise(z.id, ze.entreprise?.id); }} disabled={deletingEnt === ze.entreprise?.id}
                        style={{ background:"rgba(220,38,38,0.07)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 7px" }}>
                        {deletingEnt === ze.entreprise?.id ? <Loader2 size={12} style={{ color:"#dc2626", animation:"spin 1s linear infinite" }}/> : <Trash2 size={12} style={{ color:"#dc2626" }}/>}
                      </button>
                    </div>
                  );
                })}
              </div>}
          </section>

          {/* Documents */}
          {z.fichiers?.length > 0 && (
            <section>
              <SecTitle>{z.fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                {z.fichiers.map((f: any) => (
                  <a key={f.id} href={`${API_BASE}/zones-types/${z.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,79,145,0.05)", border:"1px solid rgba(0,79,145,0.15)", borderRadius:10, padding:"9px 12px", textDecoration:"none" }}>
                    <FileText size={13} style={{ color:"#004f91", flexShrink:0 }}/>
                    <span style={{ fontSize:12.5, color:"#004f91", fontWeight:600 }}>{f.titre || f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", flexShrink:0 }}>
          <button onClick={onAddEntreprise}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:"none", background:"rgba(24,128,56,0.08)", color:"#188038", fontWeight:700, cursor:"pointer", fontSize:12.5, fontFamily:"var(--font-google-sans)" }}>
            <Plus size={13}/> Entreprise
          </button>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose}
              style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={onEdit}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--font-google-sans)", boxShadow:"0 3px 12px rgba(0,79,145,0.25)" }}>
              <Pencil size={13}/> Modifier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function GestionZonesPage() {
  const [zones,        setZones]        = useState<any[]>([]);
  const [polesCount,   setPolesCount]   = useState(0);
  const [secteurs,     setSecteurs]     = useState<any[]>([]);
  const [branches,     setBranches]     = useState<any[]>([]);
  const [activites,    setActivites]    = useState<any[]>([]);
  const [onglet,       setOnglet]       = useState<"zones"|"poles">("zones");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [vueId,        setVueId]        = useState<string | null>(null);
  const [zoneModal,    setZoneModal]    = useState(false);
  const [zoneModalType,setZoneModalType]= useState("ZES");
  const [editZone,     setEditZone]     = useState<any>(null);
  const [entModal,     setEntModal]     = useState(false);
  const [entModalZone, setEntModalZone] = useState<any>(null);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [deletingEnt,  setDeletingEnt]  = useState<number | null>(null);
  const [detailEnt,    setDetailEnt]    = useState<any>(null);

  const vue = vueId ? (zones.find(z => z.id === vueId) ?? null) : null;

  const ouvrirFicheEnt = async (entrepriseId: number) => {
    try {
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`);
      setDetailEnt(await res.json());
    } catch(e) { console.error(e); }
  };

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/zones-types`);
      setZones(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()).then(d => setPolesCount(Array.isArray(d) ? d.length : 0)).catch(() => {});
  }, [onglet]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
    ]).then(([s, b, a]) => { setSecteurs(s || []); setBranches(b || []); setActivites(a || []); }).catch(() => {});
  }, []);

  const openAjouterZone = (type: string) => { setZoneModalType(type); setEditZone(null); setZoneModal(true); };
  const openEditZone    = (z: any)        => { setZoneModalType(z.type_zone); setEditZone(z); setZoneModal(true); };

  const handleDeleteZone = async (id: string) => {
    if (!confirm("Supprimer cette zone et toutes ses associations ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/zones-types/${id}`, { method: "DELETE" }); charger(); }
    finally { setDeleting(null); }
  };

  const handleRetirerEntreprise = async (zoneId: string, entId: number) => {
    setDeletingEnt(entId);
    try { await fetch(`${API_BASE}/zones-types/${zoneId}/entreprises/${entId}`, { method: "DELETE" }); charger(); }
    finally { setDeletingEnt(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, color: "#9aa5b4" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Pôles &amp; Zones d&apos;investissement</h1>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #E8E5E3", marginBottom: 28 }}>
        {[{ key: "zones", label: "Zones d'investissement", count: zones.length }, { key: "poles", label: "Pôles territoires", count: polesCount }].map(o => {
          const actif = onglet === o.key;
          return (
          <button key={o.key} onClick={() => setOnglet(o.key as any)}
            style={{ padding: "14px 22px", border: "none", borderBottom: `2px solid ${actif ? "#004f91" : "transparent"}`, background: "transparent", color: actif ? "#004f91" : "#9aa5b4", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)", transition: "all 0.15s" }}>
            {o.label}
            {o.count > 0 && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: actif ? "#004f91" : "#9aa5b4", background: actif ? "rgba(0,79,145,0.1)" : "#F2F0EF", padding: "1px 7px", borderRadius: 999 }}>{o.count}</span>}
          </button>
          );
        })}
      </div>

      {onglet === "poles" ? <OngletPoles /> : (
        <div>
          {/* Cards types — style page publique */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(TYPE_ZONES.length, 3)},1fr)`, gap: 14, marginBottom: selectedType ? 32 : 0 }}>
            {TYPE_ZONES.map(t => {
              const zDuT = zones.filter(z => z.type_zone === t.key);
              const nbEnt = zDuT.reduce((a, z) => a + (z.entreprises?.length || 0), 0);
              const active = selectedType === t.key;
              const c = t.color;
              const GRADS: Record<string,string> = {
                "#004f91":"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
                "#ca631f":"linear-gradient(90deg,#9c4a15 0%,#ca631f 60%,#e07a2e 100%)",
                "#188038":"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)",
              };
              const grad = GRADS[c] || `linear-gradient(90deg,${c} 0%,${c} 100%)`;
              return (
                <div key={t.key} onClick={() => setSelectedType(active ? null : t.key)}
                  style={{ background: "#fff", border: `1.5px solid ${c}${active ? "99" : "73"}`, borderRadius: 14, cursor: "pointer",
                    transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s",
                    boxShadow: active ? `0 12px 28px ${c}2e` : `0 4px 18px ${c}26`,
                    transform: active ? "translateY(-2px)" : "none",
                    display: "flex", flexDirection: "column" as const, overflow: "hidden", minWidth: 0 }}
                  onMouseEnter={ev => {
                    if (!active) { ev.currentTarget.style.boxShadow = `0 12px 28px ${c}2e`; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = `${c}99`; }
                    // Titre trop long : glisse pour révéler la fin
                    const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                    const span = box?.firstElementChild as HTMLElement | null;
                    if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                  }}
                  onMouseLeave={ev => {
                    if (!active) { ev.currentTarget.style.boxShadow = `0 4px 18px ${c}26`; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = `${c}73`; }
                    const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                    if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                  }}>

                  {/* Bandeau du type — même style que la page publique */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, background: grad, padding: "6px 16px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{t.code}</span>
                    {active && (
                      <span style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "14px 16px 14px", flex: 1 }}>
                    {/* Libellé du type (défile au survol si trop long) */}
                    <div data-marquee style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", lineHeight: 1.35, overflow: "hidden", whiteSpace: "nowrap" as const }}>
                      <span style={{ display: "inline-block" }}>{t.label}</span>
                    </div>

                    {/* Compteurs libellés */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <div style={{ background: `${c}0A`, border: `1px solid ${c}1F`, borderRadius: 10, padding: "8px 11px" }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: c, textTransform: "uppercase" as const, marginBottom: 3 }}>Entreprise{nbEnt > 1 ? "s" : ""}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: nbEnt > 0 ? "#1a1a2e" : "#9aa5b4" }}>{nbEnt}</p>
                      </div>
                      <div style={{ background: `${c}0A`, border: `1px solid ${c}1F`, borderRadius: 10, padding: "8px 11px" }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: c, textTransform: "uppercase" as const, marginBottom: 3 }}>Zone{zDuT.length > 1 ? "s" : ""}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: zDuT.length > 0 ? "#1a1a2e" : "#9aa5b4" }}>{zDuT.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div style={{ display: "flex", borderTop: "1px solid #F2F0EF" }}>
                    <button onClick={ev => { ev.stopPropagation(); openAjouterZone(t.key); }}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: c, fontWeight: 700, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = `${c}0D`}
                      onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
                      <Plus size={13} /> Zone
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zones du type sélectionné */}
          {selectedType && (() => {
            const t = TYPE_ZONES.find(x => x.key === selectedType)!;
            const zDuT = zones.filter(z => z.type_zone === t.key);
            return zDuT.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#9aa5b4", fontSize: 13 }}>
                Aucune zone {t.code} — cliquez sur &quot;+ Zone&quot; pour en ajouter.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {zDuT.map(z => (
                  <div key={z.id} onClick={() => setVueId(z.id)}
                    style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}
                    onMouseEnter={ev => {
                      ev.currentTarget.style.boxShadow = "0 12px 28px rgba(0,30,60,0.10)"; ev.currentTarget.style.transform = "translateY(-2px)"; ev.currentTarget.style.borderColor = `${t.color}40`;
                      // Contenus trop longs : glissent pour révéler la fin
                      ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box => {
                        const span = box.firstElementChild as HTMLElement | null;
                        if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                      });
                    }}
                    onMouseLeave={ev => {
                      ev.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; ev.currentTarget.style.transform = "none"; ev.currentTarget.style.borderColor = "#ECEAE7";
                      ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box => {
                        const span = box.firstElementChild as HTMLElement | null;
                        if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                      });
                    }}>

                    <div style={{ height: 3, background: `linear-gradient(90deg,${t.color}CC 0%,${t.color} 50%,${t.color}99 100%)`, flexShrink: 0 }}/>
                    <div style={{ padding: "14px 16px 14px", flex: 1 }}>
                      {/* Pôle */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        {z.pole_nom ? (
                          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: t.color, background: `${t.color}12`, padding: "3px 10px", borderRadius: 999, overflow: "hidden", whiteSpace: "nowrap" as const, maxWidth: "100%" }}>{z.pole_nom}</span>
                        ) : <span />}
                      </div>

                      {/* Nom de la zone */}
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.nom_zone}</div>

                      {/* Infos libellées */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                        <div style={{ background: `${t.color}0A`, border: `1px solid ${t.color}1F`, borderRadius: 10, padding: "8px 11px", minWidth: 0 }}>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: t.color, textTransform: "uppercase" as const, marginBottom: 3 }}>Localisation</p>
                          <p data-marquee style={{ fontSize: 12, fontWeight: 600, color: (z.departement_nom || z.region_nom) ? "#1a1a2e" : "#9aa5b4", overflow: "hidden", whiteSpace: "nowrap" as const }}>
                            <span style={{ display: "inline-block" }}>{[z.departement_nom, z.region_nom].filter(Boolean).join(", ") || "—"}</span>
                          </p>
                        </div>
                        <div style={{ background: `${t.color}0A`, border: `1px solid ${t.color}1F`, borderRadius: 10, padding: "8px 11px" }}>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: t.color, textTransform: "uppercase" as const, marginBottom: 3 }}>Entreprise{(z.entreprises?.length || 0) > 1 ? "s" : ""}</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: (z.entreprises?.length || 0) > 0 ? "#1a1a2e" : "#9aa5b4" }}>{z.entreprises?.length || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "stretch", borderTop: "1px solid #F2F0EF" }} onClick={ev => ev.stopPropagation()}>
                      <button onClick={() => openEditZone(z)}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
                        onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                        onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
                        <Pencil size={12} /> Modifier
                      </button>
                      <div style={{ width: 1, background: "#F2F0EF" }} />
                      <button onClick={() => { setEntModalZone(z); setEntModal(true); }}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 0", fontSize: 11.5, color: "#188038", fontWeight: 600, fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
                        onMouseEnter={ev => ev.currentTarget.style.background = "rgba(24,128,56,0.05)"}
                        onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
                        <Plus size={12} /> Entreprise
                      </button>
                      <div style={{ width: 1, background: "#F2F0EF" }} />
                      <button onClick={() => handleDeleteZone(z.id)} disabled={deleting === z.id}
                        style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={ev => ev.currentTarget.style.background = "rgba(220,38,38,0.05)"}
                        onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
                        {deleting === z.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {vue && (
        <ZoneVue
          zone={vue}
          onClose={() => setVueId(null)}
          onEdit={() => { setVueId(null); openEditZone(vue); }}
          onAddEntreprise={() => { setEntModalZone(vue); setEntModal(true); }}
          onRetirerEntreprise={handleRetirerEntreprise}
          ouvrirFicheEnt={ouvrirFicheEnt}
          secteurs={secteurs} branches={branches} activites={activites}
          deletingEnt={deletingEnt}
          charger={charger}
        />
      )}

      <ZoneModal open={zoneModal} onClose={() => setZoneModal(false)} onSaved={charger} typeZone={zoneModalType} editZone={editZone} />
      {entModalZone && (
        <EntreprisesModal open={entModal} onClose={() => setEntModal(false)}
          zoneId={entModalZone.id} zoneNom={entModalZone.nom_zone} onSaved={charger} />
      )}
      <EntreprisePublicModal entreprise={detailEnt} onClose={() => setDetailEnt(null)} />
    </div>
  );
}
