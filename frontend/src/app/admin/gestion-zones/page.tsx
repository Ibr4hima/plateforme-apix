"use client";

import EntrepriseModal from "@/components/entreprises/EntrepriseModal";
import { ArrondissementSelect, DepartementSelect, RegionSelect } from "@/components/shared/GeoSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import { Building2, Check, ChevronDown, ChevronRight, Eye, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";


const TYPE_ZONES = [
  { key: "ZES", label: "Zones Économiques Spéciales",        code: "ZES", color: "#004f91" },
  { key: "ZAI", label: "Zones Aménagées à l'Investissement", code: "ZAI", color: "#059669" },
  { key: "ZFI", label: "Zones Franches Industrielles",       code: "ZFI", color: "#7c3aed" },
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

// ── Page principale ────────────────────────────────────────────────────────────
export default function GestionZonesPage() {
  const [zones,        setZones]        = useState<any[]>([]);
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
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Gestion des zones et des pôles</h1>
        <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 4 }}>
          {zones.length} zone{zones.length > 1 ? "s" : ""} enregistrée{zones.length > 1 ? "s" : ""} ·{" "}
          {zones.reduce((a, z) => a + (z.entreprises?.length || 0), 0)} entreprise{zones.reduce((a, z) => a + (z.entreprises?.length || 0), 0) > 1 ? "s" : ""} installée{zones.reduce((a, z) => a + (z.entreprises?.length || 0), 0) > 1 ? "s" : ""}
        </p>
      </div>

      {/* Types de zones (calque NAEMA) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TYPE_ZONES.map((t, ti) => {
          const zonesDuT   = zonesDuType(t.key);
          const isExpanded = expandedType === t.key;

          return (
            <div key={t.key} style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>

              {/* Header type — comme header secteur NAEMA */}
              <div onClick={() => setExpandedType(isExpanded ? null : t.key)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", cursor: "pointer", borderLeft: `4px solid ${t.color}`, background: isExpanded ? `${t.color}06` : "#fff", transition: "background 0.2s" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.color }}>{t.code}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>
                    {zonesDuT.length} zone{zonesDuT.length > 1 ? "s" : ""} ·{" "}
                    {zonesDuT.reduce((a, z) => a + (z.entreprises?.length || 0), 0)} entreprise{zonesDuT.reduce((a, z) => a + (z.entreprises?.length || 0), 0) > 1 ? "s" : ""}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); openAjouterZone(t.key); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: `${t.color}12`, border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: t.color }}>
                  <Plus size={12} /> Zone
                </button>
                {isExpanded ? <ChevronDown size={18} style={{ color: "#9aa5b4", flexShrink: 0 }} /> : <ChevronRight size={18} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
              </div>

              {/* Zones (comme branches NAEMA) */}
              {isExpanded && (
                <div style={{ padding: "0 24px 20px" }}>
                  {zonesDuT.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "#9aa5b4", fontSize: 13 }}>
                      Aucune zone — cliquez sur "+ Zone" pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {zonesDuT.map(z => {
                        const isZoneOpen = expandedZone === z.id;
                        return (
                          <div key={z.id} style={{ background: "#F8F7F6", borderRadius: 12, border: "1px solid #E8E5E3", overflow: "hidden" }}>

                            {/* Header zone — comme header branche NAEMA */}
                            <div onClick={() => setExpandedZone(isZoneOpen ? null : z.id)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: `${t.color}12`, padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>{t.code}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", flex: 1 }}>{z.nom_zone}</span>
                              {z.pole_nom && (
                                <span style={{ fontSize: 11, color: "#0e7490", background: "rgba(14,116,144,0.08)", border: "1px solid rgba(14,116,144,0.2)", padding: "2px 8px", borderRadius: 999, fontWeight: 600, marginRight: 4 }}>
                                  {z.pole_nom}
                                </span>
                              )}
                              
                                <span style={{ fontSize: 11, color: "#0e7490", background: "rgba(14,116,144,0.08)", border: "1px solid rgba(14,116,144,0.2)", padding: "2px 8px", borderRadius: 999, fontWeight: 600, marginRight: 4 }}>
                                {z.entreprises?.length || 0} entreprise{(z.entreprises?.length || 0) > 1 ? "s" : ""}
                              </span>
    
                              <button onClick={e => { e.stopPropagation(); setEntModalZone(z); setEntModal(true); }}
                                style={{ background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#4a5568", display: "flex", alignItems: "center", gap: 3 }}>
                                <Plus size={10} /> Entreprise
                              </button>
                              <button onClick={e => { e.stopPropagation(); openEditZone(z); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                <Pencil size={13} style={{ color: "#9aa5b4" }} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); handleDeleteZone(z.id); }} disabled={deleting === z.id}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                {deleting === z.id ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "#dc2626" }} />}
                              </button>
                              {isZoneOpen ? <ChevronDown size={14} style={{ color: "#9aa5b4" }} /> : <ChevronRight size={14} style={{ color: "#9aa5b4" }} />}
                            </div>

                            {/* Entreprises (comme activités NAEMA) */}
                            {isZoneOpen && (
                              <div style={{ borderTop: "1px solid #E8E5E3", padding: "8px 16px 12px" }}>
                                {!z.entreprises?.length ? (
                                  <p style={{ fontSize: 12, color: "#9aa5b4", padding: "8px 0" }}>Aucune entreprise — cliquez sur "+ Entreprise".</p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                                    {z.entreprises.map((ze: any) => (
                                      <div key={ze.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #E8E5E3" }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          <Building2 size={14} style={{ color: t.color }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ze.entreprise?.nom}</div>
                                          <div style={{ fontSize: 11, color: "#9aa5b4" }}>{ze.entreprise?.forme_juridique || "—"}</div>
                                        </div>
                                        <button onClick={() => setDetailEntreprise(ze.entreprise)}
                                          style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(202,99,31,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#ca631f", fontWeight: 600, flexShrink: 0 }}>
                                          <Eye size={12} /> Voir fiche
                                        </button>
                                        <button onClick={() => handleRetirerEntreprise(z.id, ze.id)} disabled={deletingEnt === ze.id}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3, flexShrink: 0 }}>
                                          {deletingEnt === ze.id ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} style={{ color: "#dc2626" }} />}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Fichiers PDF */}
                                {z.fichiers?.length > 0 && (
                                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {z.fichiers.map((f: any) => (
                                      <a key={f.id} href={`${API_BASE}/zones-types/${z.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                                        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.12)", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#004f91", textDecoration: "none", fontWeight: 500 }}>
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
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <ZoneModal
        open={zoneModal} onClose={() => setZoneModal(false)} onSaved={charger}
        typeZone={zoneModalType} editZone={editZone}
      />
      {entModalZone && (
        <EntreprisesModal
          open={entModal} onClose={() => setEntModal(false)}
          zoneId={entModalZone.id} onSaved={charger}
          existingIds={(entModalZone.entreprises || []).map((ze: any) => ze.entreprise_id)}
        />
      )}
      <EntrepriseModal
        entreprise={detailEntreprise}
        onClose={() => setDetailEntreprise(null)}
      />
    </div>
  );
}
