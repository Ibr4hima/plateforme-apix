"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight, ChevronDown, Upload, FileText, Building2, Search, Eye } from "lucide-react";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import EntrepriseModal from "@/components/entreprises/EntrepriseModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";


const TYPE_ZONES = [
  { key: "ZES", label: "Zones Économiques Spéciales",        code: "ZES", color: "#E35336" },
  { key: "ZAI", label: "Zones Aménagées pour l'Investissement", code: "ZAI", color: "#366FE3" },
  { key: "ZFI", label: "Zones Franches Industrielles",       code: "ZFI", color: "#188038" },
];

const EMPTY_ZONE_FORM = {
  nom_zone: "", description: "", thematiques: "",
  pole_id: "" as string | number,
  date_creation: "", decret_creation: "", superficie: "",
  region_id: "" as string | number,
  departement_id: "" as string | number,
  arrondissement_id: "" as string | number,
};

// ── Modal ajout/modif zone ────────────────────────────────────────────────────
function ZoneModal({
  open, onClose, onSaved, typeZone, editZone,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  typeZone: string; editZone: any | null;
}) {
  const [form,     setForm]     = useState<any>({ ...EMPTY_ZONE_FORM });
  const [pdfQueue, setPdfQueue] = useState<{ file: File; titre: string }[]>([]);
  const [fichiers, setFichiers] = useState<any[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [error,    setError]    = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [depId,    setDepId]    = useState<number | null>(null);
  const [poles,    setPoles]    = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()).then(setPoles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editZone) {
      setForm({
        nom_zone: editZone.nom_zone || "", description: editZone.description || "",
        thematiques: editZone.thematiques || "",
        pole_id: editZone.pole_id ?? "",
        date_creation: editZone.date_creation || "",
        decret_creation: editZone.decret_creation || "",
        superficie: editZone.superficie != null ? String(editZone.superficie) : "",
        region_id: editZone.region_id || "", departement_id: editZone.departement_id || "",
        arrondissement_id: editZone.arrondissement_id || "",
      });
      setFichiers(editZone.fichiers || []);
      setRegionId(editZone.region_id || null);
      setDepId(editZone.departement_id || null);
    } else {
      setForm({ ...EMPTY_ZONE_FORM }); setFichiers([]); setRegionId(null); setDepId(null);
    }
    setPdfQueue([]); setError(""); setSaveOk(false);
  }, [open, editZone]);

  if (!open) return null;

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nom_zone.trim()) { setError("La dénomination est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      fd.append("nom_zone", form.nom_zone);
      fd.append("type_zone", typeZone);
      fd.append("pole_id", form.pole_id ? String(form.pole_id) : "0");
      fd.append("description",     form.description     ?? "");
      fd.append("date_creation",   form.date_creation   ?? "");
      fd.append("decret_creation", form.decret_creation ?? "");
      fd.append("superficie",      form.superficie      ?? "");
      if (form.region_id)         fd.append("region_id",         String(form.region_id));
      if (form.departement_id)    fd.append("departement_id",    String(form.departement_id));
      if (form.arrondissement_id) fd.append("arrondissement_id", String(form.arrondissement_id));

      // Résoudre les noms NAEMA → IDs (toujours, pour POST et PATCH)
      let secIds: number[] = [], braIds: number[] = [], actIds: number[] = [];
      if (form.thematiques) {
        fd.append("thematiques", form.thematiques);
        const items = form.thematiques.split(",").map((t: string) => t.trim());
        const secNoms = items.filter((t: string) => t.startsWith("sec:")).map((t: string) => t.slice(4));
        const braNoms = items.filter((t: string) => t.startsWith("bra:")).map((t: string) => t.slice(4));
        const actNoms = items.filter((t: string) => t.startsWith("act:")).map((t: string) => t.slice(4));
        const [allSec, allBra, allAct] = await Promise.all([
          fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
          fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
          fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
        ]);
        secIds = allSec.filter((s: any) => secNoms.includes(s.nom)).map((s: any) => s.id);
        braIds = allBra.filter((b: any) => braNoms.includes(b.nom)).map((b: any) => b.id);
        actIds = allAct.filter((a: any) => actNoms.includes(a.nom)).map((a: any) => a.id);
      }
      fd.append("secteur_ids",  JSON.stringify(secIds));
      fd.append("branche_ids",  JSON.stringify(braIds));
      fd.append("activite_ids", JSON.stringify(actIds));
      fd.append("est_publie", "true");

      const url    = editZone ? `${API_BASE}/zones-types/${editZone.id}` : `${API_BASE}/zones-types`;
      const method = editZone ? "PATCH" : "POST";

      let res: Response;
      if (editZone) {
        // PATCH — JSON body pour permettre les valeurs null/vides
        const jsonPayload: any = {
          nom_zone:          form.nom_zone,
          pole_id:           form.pole_id ? String(form.pole_id) : "0",
          description:       form.description   ?? "",
          date_creation:     form.date_creation  ?? "",
          decret_creation:   form.decret_creation ?? "",
          superficie:        form.superficie     ?? "",
          region_id:         form.region_id      ? String(form.region_id)         : "0",
          departement_id:    form.departement_id ? String(form.departement_id)    : "0",
          arrondissement_id: form.arrondissement_id ? String(form.arrondissement_id) : "0",
          secteur_ids:  JSON.stringify(secIds),
          branche_ids:  JSON.stringify(braIds),
          activite_ids: JSON.stringify(actIds),
        };
        res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(jsonPayload) });
      } else {
        // POST — FormData (fichiers PDF inclus plus bas)
        res = await fetch(url, { method, body: fd });
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const zone = await res.json();

      for (const p of pdfQueue) {
        const fd2 = new FormData();
        fd2.append("titre", p.titre || p.file.name);
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
  const t = TYPE_ZONES.find(t => t.key === typeZone)!;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(5px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${t.color}, ${t.color}aa)`, borderRadius: "20px 20px 0 0" }} />
        <div style={{ padding: "24px 28px" }}>
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

          {/* Pôle territorial */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Pôle territorial</label>
            <select value={form.pole_id || ""} onChange={e => update("pole_id", e.target.value ? parseInt(e.target.value) : "")} style={IS}>
              <option value="">— Sélectionner un pôle —</option>
              {poles.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.pole_territoire} — {p.localisation}
                </option>
              ))}
            </select>
          </div>

          {/* Localisation */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Localisation</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Région</label>
                <RegionSelect value={form.region_id} onChange={(id) => { update("region_id", id || ""); update("departement_id", ""); update("arrondissement_id", ""); setRegionId(id); setDepId(null); }} />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Département</label>
                <DepartementSelect regionId={regionId} value={form.departement_id} onChange={(id) => { update("departement_id", id || ""); update("arrondissement_id", ""); setDepId(id); }} />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Arrondissement</label>
                <ArrondissementSelect departementId={depId} value={form.arrondissement_id} onChange={(id) => update("arrondissement_id", id || "")} />
              </div>
            </div>
          </div>

          {/* Infos officielles */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Informations officielles</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Date de création</label>
                <input type="date" value={form.date_creation}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e => update("date_creation", e.target.value)} style={IS} />
              </div>
              <div>
                <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Superficie (hectares)</label>
                <input type="number" min="0" step="0.01" value={form.superficie}
                  onChange={e => update("superficie", e.target.value)}
                  placeholder="Ex: 1700.50" style={IS} />
              </div>
            </div>
            <div>
              <label style={{ ...LS, fontSize: 11, color: "#9aa5b4" }}>Décret de création</label>
              <input value={form.decret_creation} onChange={e => update("decret_creation", e.target.value)}
                placeholder="Ex: Décret n° 2002-1036 du 03/10/2002" style={IS} />
            </div>
          </div>

          {/* Classification NAEMA */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Thématiques / Classification NAEMA</label>
            <ThematiquesNaema value={form.thematiques} onChange={val => update("thematiques", val)} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Description</label>
            <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} placeholder="Présentation générale…" style={{ ...IS, resize: "vertical" }} />
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
              <input type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); setPdfQueue(prev => [...prev, ...files.map(f => ({ file: f, titre: f.name.replace(/\.pdf$/i, "") }))]); e.target.value = ""; }} />
            </label>
            {pdfQueue.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {pdfQueue.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8, padding: "7px 12px" }}>
                    <FileText size={13} style={{ color: "#7c3aed" }} />
                    <input value={p.titre} onChange={e => setPdfQueue(prev => prev.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))} placeholder="Titre" style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(124,58,237,0.3)", outline: "none", fontSize: 12, padding: "2px 0", fontFamily: "var(--font-google-sans)" }} />
                    <button onClick={() => setPdfQueue(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving || saveOk} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: saveOk ? "#059669" : t.color, color: "#fff", fontWeight: 700, cursor: saving || saveOk ? "not-allowed" : "pointer", fontSize: 13 }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : saveOk ? <><Check size={13} /> Enregistré</> : editZone ? "Modifier" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal fiche entreprise ────────────────────────────────────────────────────

// ── Modal ajout entreprises (choix multiple) ──────────────────────────────────
function EntreprisesModal({
  open, onClose, zoneId, onSaved, existingIds,
}: {
  open: boolean; onClose: () => void; zoneId: string; onSaved: () => void; existingIds: string[];
}) {
  const [search,    setSearch]    = useState("");
  const [all,       setAll]       = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set()); setSearch(""); setSaveOk(false);
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/entreprises?per_page=500&est_publie=true`).then(r => r.json()),
      fetch(`${API_BASE}/zones-types/entreprises-assignees`).then(r => r.json()),
    ])
      .then(([data, assignees]) => {
        // Exclure celles déjà dans la zone courante ET celles dans d'autres zones
        const toExclude = new Set([...existingIds, ...assignees]);
        setAll((data.data || []).filter((e: any) => !toExclude.has(e.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = all.filter(e =>
    e.nom.toLowerCase().includes(search.toLowerCase()) ||
    (e.secteur?.nom || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.region_nom || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const handleAjouter = async () => {
    if (!selected.size) return;
    setSaving(true);
    try {
      for (const eid of selected) {
        await fetch(`${API_BASE}/zones-types/${zoneId}/entreprises?entreprise_id=${eid}`, { method: "POST" });
      }
      setSaveOk(true);
      setTimeout(() => { onClose(); onSaved(); }, 600);
    } finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(5px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg, #ca631f, #e07a3a)", borderRadius: "20px 20px 0 0" }} />
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F2F0EF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e" }}>Ajouter des entreprises</h2>
              <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>
                {selected.size > 0 ? <span style={{ color: "#ca631f", fontWeight: 600 }}>{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span> : "Sélectionnez une ou plusieurs entreprises"}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}><X size={15} color="#4a5568" /></button>
          </div>
          {/* Barre de recherche */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, secteur, région…"
              style={{ width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10, padding: "9px 12px 9px 34px", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }} />
          </div>
        </div>

        {/* Liste entreprises */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} />
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9aa5b4", fontSize: 13, padding: "24px 0" }}>
              {search ? "Aucun résultat" : "Toutes les entreprises sont déjà dans cette zone"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((e: any) => {
                const isSelected = selected.has(e.id);
                return (
                  <div key={e.id} onClick={() => toggle(e.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `2px solid ${isSelected ? "#ca631f" : "#E8E5E3"}`, background: isSelected ? "rgba(202,99,31,0.06)" : "#fff", transition: "all 0.15s" }}>
                    {/* Checkbox */}
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? "#ca631f" : "#C5BFBB"}`, background: isSelected ? "#ca631f" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>
                    {/* Icône */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(202,99,31,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 size={16} style={{ color: "#ca631f" }} />
                    </div>
                    {/* Infos */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nom}</div>
                      <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 1 }}>
                        {[e.forme_juridique, e.secteur?.nom, e.region_nom].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {/* Badge statut */}
                    <span style={{ fontSize: 10, fontWeight: 700, color: e.statut === "actif" ? "#059669" : "#9aa5b4", background: e.statut === "actif" ? "#dcfce7" : "#F2F0EF", padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                      {e.statut === "actif" ? "Actif" : e.statut}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #F2F0EF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{filtered.length} entreprise{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Annuler</button>
            <button onClick={handleAjouter} disabled={!selected.size || saving || saveOk}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: saveOk ? "#059669" : selected.size ? "#ca631f" : "#C5BFBB", color: "#fff", fontWeight: 700, cursor: !selected.size || saving || saveOk ? "not-allowed" : "pointer", fontSize: 13, transition: "background 0.2s" }}>
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Ajout…</> : saveOk ? <><Check size={13} /> Ajoutées</> : `Ajouter${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Gestion des pôles territoires ─────────────────────────────────────
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
      setPoles(p);
      setRegions(r);
      // Initialiser les forms depuis la BDD
      const init: Record<string|number, any> = {};
      p.forEach((pole: any) => {
        init[pole.id] = {
          pole_territoire: pole.pole_territoire,
          localisation:    pole.localisation || "",
          description:     pole.description  || "",
          region_ids:      pole.region_ids   || [],
        };
      });
      setForms(init);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const updateForm = (id: number|"new", k: string, v: any) =>
    setForms(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [k]: v } }));

  const toggleRegion = (id: number|"new", regionId: number) => {
    const current = forms[id]?.region_ids || [];
    const next = current.includes(regionId)
      ? current.filter((r: number) => r !== regionId)
      : [...current, regionId];
    updateForm(id, "region_ids", next);
    // Mettre à jour localisation lisible
    const noms = regions.filter(r => next.includes(r.id)).map(r => r.nom);
    updateForm(id, "localisation", noms.join(", "));
  };

  const handleSave = async (id: number|"new") => {
    const f = forms[id] || {};
    if (!f.pole_territoire?.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(id); setError("");
    try {
      if (id === "new") {
        await fetch(`${API_BASE}/zones-types/poles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        });
      } else {
        await fetch(`${API_BASE}/zones-types/poles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        });
      }
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

    return (
      <div style={{ background: "#fff", border: `1px solid ${isOpen ? "#ca631f" : "#C5BFBB"}`, borderLeft: `4px solid ${isNew ? "#059669" : "#ca631f"}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
          onClick={() => { setExpanded(isOpen ? null : id); if (!isNew && !forms[id]) updateForm(id, "pole_territoire", pole.pole_territoire); }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: isNew ? "rgba(5,150,105,0.1)" : "rgba(202,99,31,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isNew ? <Plus size={14} style={{ color: "#059669" }} /> : <span style={{ fontSize: 12, fontWeight: 800, color: "#ca631f" }}>P</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>
              {isNew ? "Ajouter un nouveau pôle" : f.pole_territoire || pole.pole_territoire}
            </div>
            {!isNew && (pole.localisation || f.localisation) && (
              <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 1 }}>{f.localisation || pole.localisation}</div>
            )}
          </div>
          {!isNew && (
            <button onClick={e => { e.stopPropagation(); handleDelete(pole.id); }}
              style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 8px" }}>
              <Trash2 size={13} style={{ color: "#dc2626" }} />
            </button>
          )}
          {isOpen ? <ChevronDown size={15} style={{ color: "#9aa5b4" }} /> : <ChevronRight size={15} style={{ color: "#9aa5b4" }} />}
        </div>

        {isOpen && (
          <div style={{ borderTop: "1px solid #F2F0EF", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={LS}>Nom du pôle *</label>
              <input value={f.pole_territoire || ""} onChange={e => updateForm(id, "pole_territoire", e.target.value)} placeholder="Ex : Pôle Dakar" style={IS} />
            </div>

            <div>
              <label style={LS}>Régions composant ce pôle</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px", background: "#F8F7F6", borderRadius: 10, border: "1px solid #C5BFBB" }}>
                {regions.map((r: any) => {
                  const selected = (f.region_ids || []).includes(r.id);
                  return (
                    <button key={r.id} onClick={() => toggleRegion(id, r.id)}
                      style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${selected ? "#ca631f" : "#C5BFBB"}`, background: selected ? "rgba(202,99,31,0.1)" : "#fff", color: selected ? "#ca631f" : "#4a5568", transition: "all 0.15s" }}>
                      {r.nom}
                    </button>
                  );
                })}
              </div>
              {(f.region_ids || []).length > 0 && (
                <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 6 }}>
                  Localisation : {regions.filter(r => f.region_ids.includes(r.id)).map((r: any) => r.nom).join(", ")}
                </p>
              )}
            </div>

            <div>
              <label style={LS}>Description</label>
              <textarea value={f.description || ""} onChange={e => updateForm(id, "description", e.target.value)}
                rows={2} placeholder="Description du pôle..." style={{ ...IS, resize: "vertical" }} />
            </div>

            {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setExpanded(null)} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={() => handleSave(id)} disabled={saving === id}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 18px", borderRadius: 9, border: "none", background: isNew ? "#059669" : "#ca631f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving === id ? "not-allowed" : "pointer" }}>
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
      <p style={{ color: "#9aa5b4", fontSize: 13, marginBottom: 20 }}>
        {poles.length} pôle{poles.length > 1 ? "s" : ""} territorial{poles.length > 1 ? "aux" : ""}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poles.map((p: any) => <PoleCard key={p.id} pole={p} />)}
        {/* Séparateur + ajout */}
        <div style={{ height: 1, background: "#F2F0EF", margin: "8px 0" }} />
        <PoleCard isNew />
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function GestionZonesPage() {
  const [zones,        setZones]        = useState<any[]>([]);
  const [onglet, setOnglet] = useState<"zones"|"poles">("zones");
  const [loading,      setLoading]      = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>("ZES");
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  // Modal zone
  const [zoneModal, setZoneModal]     = useState(false);
  const [zoneModalType, setZoneModalType] = useState("ZES");
  const [editZone, setEditZone]       = useState<any>(null);

  // Modal entreprises
  const [entModal, setEntModal]       = useState(false);
  const [entModalZone, setEntModalZone] = useState<any>(null);

  const [deleting, setDeleting]       = useState<string | null>(null);
  const [deletingEnt, setDeletingEnt] = useState<string | null>(null);
  const [detailEntreprise, setDetailEntreprise] = useState<any>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [zes, zai, zfi] = await Promise.all([
        fetch(`${API_BASE}/zones-types?type_zone=ZES`).then(r => r.json()),
        fetch(`${API_BASE}/zones-types?type_zone=ZAI`).then(r => r.json()),
        fetch(`${API_BASE}/zones-types?type_zone=ZFI`).then(r => r.json()),
      ]);
      setZones([...zes, ...zai, ...zfi]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const zonesDuType = (type: string) => zones.filter(z => z.type_zone === type);

  const openAjouterZone = (type: string) => { setZoneModalType(type); setEditZone(null); setZoneModal(true); };
  const openEditZone    = (z: any) => { setZoneModalType(z.type_zone); setEditZone(z); setZoneModal(true); };

  const handleDeleteZone = async (id: string) => {
    if (!confirm("Supprimer cette zone et toutes ses associations ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/zones-types/${id}`, { method: "DELETE" }); charger(); }
    finally { setDeleting(null); }
  };

  const handleRetirerEntreprise = async (zoneId: string, zeId: string) => {
    setDeletingEnt(zeId);
    try { await fetch(`${API_BASE}/zones-types/${zoneId}/entreprises/${zeId}`, { method: "DELETE" }); charger(); }
    finally { setDeletingEnt(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#E35336", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Zones d'investissement</h1>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, background: "#F2F0EF", borderRadius: 12, padding: 4, marginBottom: 28, width: "fit-content" }}>
        {[{ key: "zones", label: "Zones d'investissement" }, { key: "poles", label: "Pôles territoires" }].map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key as any)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: onglet === o.key ? "#fff" : "transparent", color: onglet === o.key ? "#1a1a2e" : "#9aa5b4", boxShadow: onglet === o.key ? "0 2px 8px rgba(0,0,0,0.08)" : "none" }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "poles" ? <OngletPoles /> : (
        <>
          {/* Stats globales */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {TYPE_ZONES.map(t => {
              const zDuT = zones.filter(z => z.type_zone === t.key);
              const nbEnt = zDuT.reduce((a, z) => a + (z.entreprises?.length || 0), 0);
              return (
                <div key={t.key} onClick={() => setExpandedType(expandedType === t.key ? null : t.key)}
                  style={{ flex: 1, background: "#fff", borderTop: `1px solid ${expandedType === t.key ? t.color : "#E8E5E3"}`, borderRight: `1px solid ${expandedType === t.key ? t.color : "#E8E5E3"}`, borderBottom: `1px solid ${expandedType === t.key ? t.color : "#E8E5E3"}`, borderLeft: `4px solid ${t.color}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", transition: "all 0.15s", boxShadow: expandedType === t.key ? `0 4px 16px ${t.color}20` : "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: t.color, background: `${t.color}12`, padding: "3px 10px", borderRadius: 999 }}>{t.code}</span>
                    <button onClick={e => { e.stopPropagation(); openAjouterZone(t.key); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: `${t.color}10`, border: "none", cursor: "pointer", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: t.color }}>
                      <Plus size={11} /> Zone
                    </button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: "#9aa5b4" }}>
                    <span style={{ fontWeight: 700, color: t.color, fontSize: 18, marginRight: 4 }}>{zDuT.length}</span>zone{zDuT.length > 1 ? "s" : ""}
                    <span style={{ margin: "0 6px" }}>·</span>
                    <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{nbEnt}</span> entreprise{nbEnt > 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zones du type sélectionné */}
          {TYPE_ZONES.map(t => {
            const zonesDuT = zones.filter(z => z.type_zone === t.key);
            if (expandedType !== t.key) return null;
            return (
              <div key={t.key}>
                {zonesDuT.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#9aa5b4", fontSize: 13, background: "#fff", borderRadius: 12, border: "1px dashed #E8E5E3" }}>
                    Aucune zone {t.code} — cliquez sur "+ Zone" dans la carte ci-dessus pour en ajouter.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {zonesDuT.map(z => {
                      const isZoneOpen = expandedZone === z.id;
                      return (
                        <div key={z.id} style={{ background: "#fff", borderTop: `1px solid ${isZoneOpen ? t.color : "#E8E5E3"}`, borderRight: `1px solid ${isZoneOpen ? t.color : "#E8E5E3"}`, borderBottom: `1px solid ${isZoneOpen ? t.color : "#E8E5E3"}`, borderLeft: `3px solid ${t.color}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}>

                          {/* Header zone */}
                          <div onClick={() => setExpandedZone(isZoneOpen ? null : z.id)}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", background: isZoneOpen ? `${t.color}04` : "#fff" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{z.nom_zone}</span>
                                {z.pole_nom && <span style={{ fontSize: 11, fontWeight: 600, color: "#366FE3", background: "rgba(54,111,227,0.08)", border: "1px solid rgba(54,111,227,0.2)", padding: "1px 8px", borderRadius: 999 }}>{z.pole_nom}</span>}
                              </div>
                              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#9aa5b4" }}>
                                {(z.region_nom || z.departement_nom) && <span>{[z.departement_nom, z.region_nom].filter(Boolean).join(", ")}</span>}
                                <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{z.entreprises?.length || 0} entreprise{(z.entreprises?.length || 0) > 1 ? "s" : ""}</span>
                                {z.superficie && <span>{Number(z.superficie).toLocaleString("fr-FR")} ha</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEntModalZone(z); setEntModal(true); }}
                                style={{ display: "flex", alignItems: "center", gap: 4, background: `${t.color}10`, border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: t.color }}>
                                <Plus size={11} /> Entreprise
                              </button>
                              <button onClick={() => openEditZone(z)}
                                style={{ background: "rgba(54,111,227,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 8px" }}>
                                <Pencil size={12} style={{ color: "#366FE3" }} />
                              </button>
                              <button onClick={() => handleDeleteZone(z.id)} disabled={deleting === z.id}
                                style={{ background: "rgba(220,38,38,0.07)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 8px" }}>
                                {deleting === z.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                              </button>
                            </div>
                            {isZoneOpen ? <ChevronDown size={15} style={{ color: "#9aa5b4", flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
                          </div>

                          {/* Contenu zone dépliée */}
                          {isZoneOpen && (
                            <div style={{ borderTop: `1px solid ${t.color}20`, padding: "14px 18px" }}>
                              {/* Description si présente */}
                              {z.description && (
                                <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6, marginBottom: 14, padding: "10px 14px", background: `${t.color}04`, borderRadius: 8 }}>{z.description}</p>
                              )}
                              {/* Infos officielles */}
                              {(z.date_creation || z.decret_creation) && (
                                <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "#9aa5b4" }}>
                                  {z.date_creation && <span>Créée le <strong style={{ color: "#4a5568" }}>{new Date(z.date_creation+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</strong></span>}
                                  {z.decret_creation && <span>Décret : <strong style={{ color: "#4a5568" }}>{z.decret_creation}</strong></span>}
                                </div>
                              )}
                              {/* Entreprises */}
                              {!z.entreprises?.length ? (
                                <p style={{ fontSize: 12, color: "#9aa5b4", fontStyle: "italic" }}>Aucune entreprise installée.</p>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {z.entreprises.map((ze: any) => (
                                    <div key={ze.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8F7F6", borderRadius: 9, border: "1px solid #E8E5E3" }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <Building2 size={14} style={{ color: t.color }} />
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ze.entreprise?.nom}</div>
                                        <div style={{ fontSize: 11, color: "#9aa5b4" }}>{ze.entreprise?.forme_juridique || "—"}</div>
                                      </div>
                                      <button onClick={() => setDetailEntreprise(ze.entreprise)}
                                        style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(54,111,227,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#366FE3", fontWeight: 600, flexShrink: 0 }}>
                                        <Eye size={12} /> Fiche
                                      </button>
                                      <button onClick={() => handleRetirerEntreprise(z.id, ze.id)} disabled={deletingEnt === ze.id}
                                        style={{ background: "rgba(220,38,38,0.07)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 7px", flexShrink: 0 }}>
                                        {deletingEnt === ze.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Fichiers PDF */}
                              {z.fichiers?.length > 0 && (
                                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {z.fichiers.map((f: any) => (
                                    <a key={f.id} href={`${API_BASE}/zones-types/${z.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${t.color}06`, border: `1px solid ${t.color}20`, borderRadius: 7, padding: "4px 10px", fontSize: 11, color: t.color, textDecoration: "none", fontWeight: 500 }}>
                                      <FileText size={11} /> {f.titre || f.fichier_nom}
                                    </a>
                                  ))}
                                </div>
                              )}
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
        </>
      )}

      <ZoneModal open={zoneModal} onClose={() => setZoneModal(false)} onSaved={charger} typeZone={zoneModalType} editZone={editZone} />
      {entModalZone && (
        <EntreprisesModal open={entModal} onClose={() => setEntModal(false)} zoneId={entModalZone.id} onSaved={charger} existingIds={(entModalZone.entreprises || []).map((ze: any) => ze.entreprise_id)} />
      )}
      <EntrepriseModal entreprise={detailEntreprise} onClose={() => setDetailEntreprise(null)} />
    </div>
  );
}
