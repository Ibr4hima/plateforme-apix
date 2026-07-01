"use client";

import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { ArrondissementSelect, DepartementSelect, RegionSelect } from "@/components/shared/GeoSelect";
import NaemaSelect from "@/components/shared/NaemaSelect";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { Building2, Check, ChevronDown, ChevronRight, Eye, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TYPE_ZONES = [
  { key: "ZES", label: "Zones Économiques Spéciales",           code: "ZES", color: "#E35336" },
  { key: "ZAI", label: "Zones Aménagées pour l'Investissement", code: "ZAI", color: "#366FE3" },
  { key: "ZFI", label: "Zones Franches Industrielles",          code: "ZFI", color: "#188038" },
];

const POLE_PALETTE = ["#FFD9B3","#FFF4A3","#C8EEC8","#A8DFE8","#B8C8F8","#D8B8F0","#FADADD","#F0D8C8"];
const getPoleColor = (poleId: number) => POLE_PALETTE[(poleId - 1) % POLE_PALETTE.length];
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

  const IS: any = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
  const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };
  const t = TYPE_ZONES.find(tz => tz.key === typeZone)!;

  const localisationBloquee = !form.pole_id;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(5px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ height: 5, background: `linear-gradient(90deg,${t.color},${t.color}99)`, borderRadius: "20px 20px 0 0" }} />
        <div style={{ padding: "24px 28px" }}>

          {/* Header modal */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a1a2e" }}>{editZone ? "Modifier la zone" : `Nouvelle zone ${typeZone}`}</h2>
              <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>{t.label}</p>
            </div>
            <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}><X size={15} color="#4a5568" /></button>
          </div>

          {/* Dénomination */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Dénomination *</label>
            <input value={form.nom_zone} onChange={e => update("nom_zone", e.target.value)} placeholder={`Ex : ${typeZone} de Diamniadio`} style={IS} />
          </div>

          {/* ── 1. Pôle territorial EN PREMIER ─────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Pôle territorial *</label>
            <select value={form.pole_id || ""} onChange={e => handlePoleChange(e.target.value)} style={IS}>
              <option value="">— Sélectionner un pôle d'abord —</option>
              {poles.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.pole_territoire}{p.localisation ? ` — ${p.localisation}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* ── 2. Localisation — grisée si pas de pôle, restreinte aux régions du pôle ── */}
          <div style={{ marginBottom: 14, opacity: localisationBloquee ? 0.45 : 1, pointerEvents: localisationBloquee ? "none" : "auto", transition: "opacity 0.2s" }}>
            <label style={LS}>
              Localisation
              {localisationBloquee
                ? <span style={{ fontSize: 11, fontWeight: 400, color: "#ca631f", marginLeft: 8 }}>← Sélectionnez un pôle d'abord</span>
                : poleRegionIds.length > 0
                  ? <span style={{ fontSize: 11, fontWeight: 400, color: "#9aa5b4", marginLeft: 8 }}>Régions du pôle uniquement</span>
                  : null
              }
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Région</label>
                <RegionSelect
                  value={form.region_id}
                  filterIds={poleRegionIds.length > 0 ? poleRegionIds : undefined}
                  onChange={id => { update("region_id", id || ""); update("departement_id", ""); update("arrondissement_id", ""); setRegionId(id); setDepId(null); }}
                />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Département</label>
                <DepartementSelect
                  regionId={regionId}
                  value={form.departement_id}
                  onChange={id => { update("departement_id", id || ""); update("arrondissement_id", ""); setDepId(id); }}
                />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Arrondissement</label>
                <ArrondissementSelect
                  departementId={depId}
                  value={form.arrondissement_id}
                  onChange={id => update("arrondissement_id", id || "")}
                />
              </div>
            </div>
          </div>

          {/* Infos officielles */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Informations officielles</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Date de création</label>
                <input type="date" value={form.date_creation} max={new Date().toISOString().split("T")[0]} onChange={e => update("date_creation", e.target.value)} style={IS} />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Superficie (hectares)</label>
                <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={form.superficie} onChange={e => update("superficie", e.target.value)} placeholder="Ex: 1700.50" style={IS} />
              </div>
            </div>
            <div>
              <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Décret de création</label>
              <input value={form.decret_creation} onChange={e => update("decret_creation", e.target.value)} placeholder="Ex: Décret n° 2002-1036 du 03/10/2002" style={IS} />
            </div>
          </div>

          {/* Classification NAEMA */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Activité(s) autorisées</label>
            <NaemaSelect
              secteurIds={form.secteur_ids || []}
              brancheIds={form.branche_ids || []}
              activiteIds={form.activite_ids || []}
              onChangeSecteurs={ids => update("secteur_ids", ids)}
              onChangeBranches={ids => update("branche_ids", ids)}
              onChangeActivites={ids => update("activite_ids", ids)}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Description</label>
            <RichTextEditor value={form.description} onChange={v => update("description", v)}/>
          </div>

          {/* PDFs */}
          <div style={{ marginBottom: 20 }}>
            <label style={LS}>Documents PDF</label>
            {fichiers.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {fichiers.map((f: any) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 8, padding: "7px 12px" }}>
                    <FileText size={13} style={{ color: "#004f91" }} />
                    <span style={{ fontSize: 13, flex: 1, color: "#1a1a2e", fontWeight: 500 }}>{f.titre || f.fichier_nom}</span>
                    <button onClick={() => supprimerFichier(f.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 8, cursor: "pointer", border: "2px dashed #C5BFBB", background: "#F2F0EF" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = t.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#C5BFBB"}>
              <Upload size={14} color="#9aa5b4" />
              <span style={{ fontSize: 13, color: "#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
              <input type="file" accept=".pdf" multiple style={{ display: "none" }}
                onChange={e => { const files = Array.from(e.target.files || []); setPdfQueue(prev => [...prev, ...files.map(f => ({ file: f, titre: f.name.replace(/\.pdf$/i, "") }))]); e.target.value = ""; }} />
            </label>
            {pdfQueue.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {pdfQueue.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8, padding: "7px 12px" }}>
                    <FileText size={13} style={{ color: "#7c3aed" }} />
                    <input value={p.titre} onChange={e => setPdfQueue(prev => prev.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))} placeholder="Titre"
                      style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(124,58,237,0.3)", outline: "none", fontSize: 12, padding: "2px 0", fontFamily: "var(--font-google-sans)" }} />
                    <button onClick={() => setPdfQueue(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving || saveOk}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: saveOk ? "#059669" : t.color, color: "#fff", fontWeight: 700, cursor: saving || saveOk ? "not-allowed" : "pointer", fontSize: 13 }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : saveOk ? <><Check size={13} /> Enregistré</> : editZone ? "Modifier" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal ajout entreprises avec statuts ─────────────────────────────────────
const STATUT_CONFIG: Record<string,{label:string;color:string;bg:string;border:string}> = {
  installee:    { label:"Installée",    color:"#059669", bg:"#dcfce7", border:"#86efac" },
  eligible:     { label:"Éligible",     color:"#b45309", bg:"#fef9c3", border:"#fde68a" },
  non_eligible: { label:"Non éligible", color:"#9aa5b4", bg:"#F2F0EF", border:"#E8E5E3" },
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
      await fetch(url, { method: id === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      setExpanded(null);
      setForms(prev => { const n = { ...prev }; if (id === "new") delete n["new"]; return n; });
      charger();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce pôle ? Les zones liées perdront leur pôle.")) return;
    await fetch(`${API_BASE}/zones-types/poles/${id}`, { method: "DELETE" });
    charger();
  };

  const IS: any = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
  const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };

  const PoleCard = ({ pole, isNew = false }: { pole?: any; isNew?: boolean }) => {
    const id: number|"new" = isNew ? "new" : pole.id;
    const isOpen = expanded === id;
    const f = forms[id] || (isNew ? { pole_territoire: "", localisation: "", description: "", region_ids: [] } : {});
    const pc = isNew ? null : getPoleColor(pole.id);
    const accentColor = isNew ? "#059669" : pc!;
    const initial = (!isNew && (f.pole_territoire || pole.pole_territoire)?.[0]) || "P";
    return (
      <div style={{ background: "#fff", border: `1px solid ${isOpen ? accentColor : "#C5BFBB"}`, borderLeft: `4px solid ${accentColor}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
          onClick={() => setExpanded(isOpen ? null : id)}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: isNew ? "rgba(5,150,105,0.1)" : accentColor, border: isNew ? "none" : "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isNew ? <Plus size={14} style={{ color: "#059669" }} /> : <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e" }}>{initial}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{isNew ? "Ajouter un nouveau pôle" : f.pole_territoire || pole.pole_territoire}</div>
            {!isNew && (f.localisation || pole.localisation) && <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 1 }}>{f.localisation || pole.localisation}</div>}
          </div>
          {!isNew && <button onClick={e => { e.stopPropagation(); handleDelete(pole.id); }} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 8px" }}><Trash2 size={13} style={{ color: "#dc2626" }} /></button>}
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
            {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setExpanded(null)} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={() => handleSave(id)} disabled={saving === id}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 18px", borderRadius: 9, border: "none", background: isNew ? "#059669" : "#1a1a2e", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {saving === id ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : <><Check size={13} /> {isNew ? "Créer" : "Enregistrer"}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} /></div>;
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poles.map((p: any) => <PoleCard key={p.id} pole={p} />)}
        <div style={{ height: 1, background: "#F2F0EF", margin: "8px 0" }} />
        <PoleCard isNew />
      </div>
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

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column" as const, border: "1px solid #E8E5E3", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ height: 5, background: `linear-gradient(90deg,${t.color},${t.color}99)`, flexShrink: 0 }} />
        <div style={{ padding: "24px 28px 28px", overflowY: "auto" as const, flex: 1 }}>

          {/* En-tête */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: t.color, background: `${t.color}12`, padding: "2px 10px", borderRadius: 999 }}>{t.code}</span>
                {z.pole_nom && <span style={{ fontSize: 11, fontWeight: 700, color: z.pole_id ? darken(getPoleColor(z.pole_id)) : "#4a5568", background: z.pole_id ? getPoleColor(z.pole_id) + "40" : "#F2F0EF", border: `1px solid ${z.pole_id ? getPoleColor(z.pole_id) + "99" : "#E8E5E3"}`, padding: "2px 9px", borderRadius: 999 }}>{z.pole_nom}</span>}
              </div>
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", color: "#1a1a2e", lineHeight: 1.3 }}>{z.nom_zone}</h2>
            </div>
            <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 7, flexShrink: 0 }}><X size={14} color="#4a5568" /></button>
          </div>

          {/* Infos officielles */}
          {(z.date_creation || z.decret_creation || z.superficie || locStr) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {locStr && (
                <div style={{ background: "#F8F7F6", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 4 }}>Localisation</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{locStr}</p>
                </div>
              )}
              {z.superficie && (
                <div style={{ background: `${t.color}06`, borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 4 }}>Superficie</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{Number(z.superficie).toLocaleString("fr-FR")} ha</p>
                </div>
              )}
              {z.date_creation && (
                <div style={{ background: "rgba(54,111,227,0.05)", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 4 }}>Date de création</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{new Date(z.date_creation + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              {z.decret_creation && (
                <div style={{ background: "#F8F7F6", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 4 }}>Décret</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{z.decret_creation}</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {z.description && (
            <div style={{ marginBottom: 20 }}>
              <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
              <div data-rte dangerouslySetInnerHTML={{ __html: z.description }} style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6, padding: "12px 16px", background: `${t.color}04`, borderRadius: 10, border: `1px solid ${t.color}15` }} />
            </div>
          )}

          {/* NAEMA */}
          {(() => {
            const secIds: number[] = z.secteur_ids || [];
            const braIds: number[] = z.branche_ids || [];
            const actIds: number[] = z.activite_ids || [];
            if (!secIds.length && !braIds.length && !actIds.length) return null;
            if (!secteurs.length) return null;
            return (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 8 }}>Activités autorisées</p>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {secIds.map((secId: number) => {
                    const sec = secteurs.find((s: any) => s.id === secId); if (!sec) return null;
                    const brasDuSec = branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id));
                    return (
                      <div key={secId}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: brasDuSec.length ? 5 : 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{sec.nom}</span>
                        </div>
                        {brasDuSec.length > 0 && (
                          <div style={{ paddingLeft: 20, borderLeft: `2px solid ${t.color}30`, display: "flex", flexDirection: "column" as const, gap: 5 }}>
                            {brasDuSec.map((bra: any) => {
                              const actsDeBra = activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id));
                              return (
                                <div key={bra.id}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: actsDeBra.length ? 4 : 0 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#366FE3", flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#366FE3" }}>{bra.nom}</span>
                                  </div>
                                  {actsDeBra.length > 0 && (
                                    <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column" as const, gap: 3 }}>
                                      {actsDeBra.map((act: any) => (
                                        <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#188038", flexShrink: 0 }} />
                                          <span style={{ fontSize: 11, color: "#188038", fontWeight: 500 }}>{act.nom}</span>
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
              </div>
            );
          })()}

          {/* Entreprises */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 8 }}>Entreprises ({z.entreprises?.length || 0})</p>
            {!z.entreprises?.length
              ? <p style={{ fontSize: 13, color: "#9aa5b4", fontStyle: "italic" }}>Aucune entreprise installée.</p>
              : <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {z.entreprises.map((ze: any) => {
                  const curStatut = ze.statut || "installee";
                  const cfg = STATUT_CONFIG[curStatut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.installee;
                  const nextStatut = curStatut === "installee" ? "eligible" : "installee";
                  const nextCfg = STATUT_CONFIG[nextStatut];
                  return (
                    <div key={ze.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8F7F6", borderRadius: 9, border: "1px solid #E8E5E3" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Building2 size={14} style={{ color: t.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ze.entreprise?.nom}</div>
                        <div style={{ fontSize: 11, color: "#9aa5b4" }}>{ze.entreprise?.forme_juridique || "—"}</div>
                      </div>
                      <button title={`Passer en "${nextCfg.label}"`}
                        onClick={async () => {
                          await fetch(`${API_BASE}/zones-types/${z.id}/entreprises/${ze.entreprise?.id}`, { method: "POST", headers: {} });
                          await fetch(`${API_BASE}/zones-types/${z.id}/entreprises?entreprise_id=${ze.entreprise?.id}&statut=${nextStatut}`, { method: "POST" });
                          charger();
                        }}
                        style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: "3px 10px", borderRadius: 999, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = nextCfg.bg; e.currentTarget.style.color = nextCfg.color; e.currentTarget.style.borderColor = nextCfg.border; }}
                        onMouseLeave={e => { e.currentTarget.style.background = cfg.bg; e.currentTarget.style.color = cfg.color; e.currentTarget.style.borderColor = cfg.border; }}>
                        {cfg.label}
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                      </button>
                      <button onClick={() => ouvrirFicheEnt(ze.entreprise?.id)}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(54,111,227,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#366FE3", fontWeight: 600 }}>
                        <Eye size={12} /> Fiche
                      </button>
                      <button onClick={() => onRetirerEntreprise(z.id, ze.entreprise?.id)} disabled={deletingEnt === ze.entreprise?.id}
                        style={{ background: "rgba(220,38,38,0.07)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 7px" }}>
                        {deletingEnt === ze.entreprise?.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                      </button>
                    </div>
                  );
                })}
              </div>}
          </div>

          {/* Fichiers */}
          {z.fichiers?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 8 }}>Documents</p>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                {z.fichiers.map((f: any) => (
                  <a key={f.id} href={`${API_BASE}/zones-types/${z.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${t.color}06`, border: `1px solid ${t.color}20`, borderRadius: 7, padding: "5px 12px", fontSize: 11, color: t.color, textDecoration: "none", fontWeight: 500 }}>
                    <FileText size={11} /> {f.titre || f.fichier_nom}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderTop: "1px solid #F2F0EF", paddingTop: 18 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onAddEntreprise}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: `${t.color}12`, color: t.color, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                <Plus size={13} /> Entreprise
              </button>
              <button onClick={onEdit}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "rgba(202,99,31,0.1)", color: "#ca631f", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                <Pencil size={13} /> Modifier
              </button>
            </div>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 9, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fermer</button>
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
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

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
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
          {TYPE_ZONES.map(t => {
            const zDuT = zones.filter(z => z.type_zone === t.key);
            const nbEnt = zDuT.reduce((a, z) => a + (z.entreprises?.length || 0), 0);
            return (
              <div key={t.key} style={{ background: "#fff", border: "1px solid #E8E5E3", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* En-tête du bloc type */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F0EF", background: `${t.color}05`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: t.color, background: `${t.color}12`, padding: "2px 9px", borderRadius: 999 }}>{t.code}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9aa5b4" }}>
                      <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{zDuT.length}</span> zone{zDuT.length !== 1 ? "s" : ""}
                      <span style={{ margin: "0 6px" }}>·</span>
                      <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{nbEnt}</span> entreprise{nbEnt !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button onClick={() => openAjouterZone(t.key)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: `${t.color}12`, border: "none", cursor: "pointer", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: t.color, flexShrink: 0 }}>
                    <Plus size={12} /> Zone
                  </button>
                </div>

                {/* Contenu : cards */}
                <div style={{ padding: 20 }}>
                  {zDuT.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 0", color: "#9aa5b4", fontSize: 13 }}>
                      Aucune zone {t.code} — cliquez sur &quot;+ Zone&quot; pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      {zDuT.map(z => (
                        <div key={z.id} onClick={() => setVueId(z.id)}
                          style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${t.color}`, cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={ev => { ev.currentTarget.style.boxShadow = `0 4px 16px ${t.color}18`; ev.currentTarget.style.borderColor = t.color; ev.currentTarget.style.background = "#fff"; }}
                          onMouseLeave={ev => { ev.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.borderColor = "#E8E5E3"; ev.currentTarget.style.borderLeftColor = t.color; ev.currentTarget.style.background = "#F8F7F6"; }}>

                          {/* Nom */}
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", lineHeight: 1.35, marginBottom: z.pole_nom ? 2 : 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.nom_zone}</div>

                          {/* Pôle */}
                          {z.pole_nom && <div style={{ fontSize: 11, color: "#9aa5b4", fontWeight: 500, marginBottom: 10 }}>{z.pole_nom}</div>}

                          {/* Bullets */}
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 3, marginBottom: 12 }}>
                            {(z.region_nom || z.departement_nom) && (
                              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#B7410E", flexShrink: 0 }} />
                                <span style={{ color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[z.departement_nom, z.region_nom].filter(Boolean).join(", ")}</span>
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }} onClick={e => e.stopPropagation()}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#188038", flexShrink: 0 }} />
                              <span style={{ color: "#4a5568", flex: 1 }}>
                                <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{z.entreprises?.length || 0}</span> entreprise{(z.entreprises?.length || 0) !== 1 ? "s" : ""}
                              </span>
                              <button onClick={() => { setEntModalZone(z); setEntModal(true); }}
                                style={{ display: "flex", alignItems: "center", gap: 3, background: `${t.color}12`, border: "none", cursor: "pointer", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700, color: t.color }}>
                                <Plus size={9} /> Ajouter
                              </button>
                            </div>
                          </div>

                          {/* Boutons */}
                          <div style={{ display: "flex", gap: 5, borderTop: "1px solid #F2F0EF", paddingTop: 10 }} onClick={ev => ev.stopPropagation()}>
                            <button onClick={() => openEditZone(z)}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "rgba(202,99,31,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 0", fontSize: 11, color: "#ca631f", fontWeight: 600 }}>
                              <Pencil size={12} /> Modifier
                            </button>
                            <button onClick={() => handleDeleteZone(z.id)} disabled={deleting === z.id}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(220,38,38,0.07)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px" }}>
                              {deleting === z.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
