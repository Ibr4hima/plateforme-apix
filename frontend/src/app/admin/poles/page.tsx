"use client";

import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Sélecteur multiple de régions ─────────────────────────────────────────────
function RegionsMultiSelect({
  selected, onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [regions,  setRegions]  = useState<any[]>([]);
  const [open,     setOpen]     = useState(false);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()).then(setRegions).catch(() => {});
  }, []);

  const filtered = regions.filter(r => r.nom.toLowerCase().includes(search.toLowerCase()));
  const toggle   = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const noms     = regions.filter(r => selected.includes(r.id)).map(r => r.nom);

  return (
    <div style={{ position: "relative" }}>
      <div onClick={() => setOpen(!open)} style={{
        background: "var(--fond)", border: "1px solid var(--bordure-forte)", borderRadius: 8,
        padding: "9px 12px", fontSize: 13, cursor: "pointer", minHeight: 38,
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
      }}>
        {noms.length === 0
          ? <span style={{ color: "var(--gris)" }}>Sélectionner des régions…</span>
          : noms.map(n => (
            <span key={n} style={{ fontSize: 11, fontWeight: 600, color: "var(--violet)", background: "rgb(var(--violet-rgb) / 0.1)", padding: "2px 8px", borderRadius: 999 }}>{n}</span>
          ))
        }
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: "var(--carte)", border: "1px solid rgb(var(--violet-rgb) / 0.3)", borderRadius: 10, boxShadow: "var(--ombre-2)", maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--bordure)" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ width: "100%", background: "var(--fond)", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 210 }}>
            {filtered.map(r => (
              <div key={r.id} onClick={() => toggle(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--filet)", background: selected.includes(r.id) ? "rgb(var(--violet-rgb) / 0.05)" : "var(--carte)" }}
                onMouseEnter={e => { if (!selected.includes(r.id)) e.currentTarget.style.background = "var(--carte-douce)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = selected.includes(r.id) ? "rgb(var(--violet-rgb) / 0.05)" : "var(--carte)"; }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected.includes(r.id) ? "var(--violet)" : "var(--bordure-forte)"}`, background: selected.includes(r.id) ? "var(--violet-action)" : "var(--carte)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.includes(r.id) && <Check size={11} color="var(--sur-bleu)" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 13, color: "var(--encre)" }}>{r.nom}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--bordure)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 12, fontWeight: 600, color: "var(--violet)", background: "none", border: "none", cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire pôle (inline) ──────────────────────────────────────────────────
function PoleForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [nom,        setNom]        = useState(initial?.pole_territoire || "");
  const [regionIds,  setRegionIds]  = useState<number[]>(initial?.region_ids || []);
  const [description,setDescription]= useState(initial?.description || "");
  const [error,      setError]      = useState("");

  const IS: any = { background: "var(--fond)", border: "1px solid var(--bordure-forte)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--encre)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
  const LS: any = { fontSize: 12, fontWeight: 600, color: "var(--texte)", marginBottom: 4, display: "block" };

  const handleSubmit = async () => {
    if (!nom.trim()) { setError("Le nom du pôle est obligatoire"); return; }
    setError("");
    await onSave({ pole_territoire: nom, region_ids: regionIds, description });
  };

  return (
    <div style={{ background: "var(--carte-douce)", border: "1px solid rgb(var(--violet-rgb) / 0.2)", borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={LS}>Nom du pôle *</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Pôle Dakar" style={IS} />
        </div>
        <div>
          <label style={LS}>Régions composant ce pôle</label>
          <RegionsMultiSelect selected={regionIds} onChange={setRegionIds} />
        </div>
        <div>
          <label style={LS}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Description optionnelle du pôle…" style={{ ...IS, resize: "vertical" }} />
        </div>
        {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--texte)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: "var(--violet-action)", color: "var(--sur-bleu)", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}>
            {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : <><Check size={13} /> {initial ? "Modifier" : "Créer"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function PolesPage() {
  const [poles,       setPoles]       = useState<any[]>([]);
  const [regions,     setRegions]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [savingId,    setSavingId]    = useState<number | null>(null);
  const [savingNew,   setSavingNew]   = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetch(`${API_BASE}/zones-types/poles`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()),
      ]);
      setPoles(p); setRegions(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const nomsRegions = (ids: number[]) =>
    regions.filter(r => ids?.includes(r.id)).map(r => r.nom).join(", ") || "—";

  const handleSaveEdit = async (pole: any, data: any) => {
    setSavingId(pole.id);
    try {
      const res = await fetch(`${API_BASE}/zones-types/poles/${pole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setEditingId(null);
      charger();
    } finally { setSavingId(null); }
  };

  const handleCreate = async (data: any) => {
    setSavingNew(true);
    try {
      const res = await fetch(`${API_BASE}/zones-types/poles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setShowCreate(false);
      charger();
    } finally { setSavingNew(false); }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmer("Supprimer ce pôle ? Les zones associées perdront leur référence."))) return;
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/zones-types/poles/${id}`, { method: "DELETE", headers: await authHeaders() });
      charger();
    } finally { setDeletingId(null); }
  };

  return (
    <div style={{ padding: "36px 40px 80px", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--violet)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "var(--encre)" }}>Gestion des pôles territoires</h1>
        <p style={{ color: "var(--gris)", fontSize: 13, marginTop: 4 }}>
          {poles.length} pôle{poles.length > 1 ? "s" : ""} territorial{poles.length > 1 ? "ux" : ""}
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: "var(--gris)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {poles.map(p => (
            <div key={p.id}>
              {editingId === p.id ? (
                <PoleForm
                  initial={p}
                  onSave={data => handleSaveEdit(p, data)}
                  onCancel={() => setEditingId(null)}
                  saving={savingId === p.id}
                />
              ) : (
                <div style={{ background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderLeft: "4px solid var(--violet)", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                  {/* Numéro */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgb(var(--violet-rgb) / 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--violet)" }}>{p.id}</span>
                  </div>
                  {/* Infos */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--encre)", marginBottom: 3 }}>{p.pole_territoire}</div>
                    <div style={{ fontSize: 12, color: "var(--texte)", marginBottom: 2 }}>
                      {nomsRegions(p.region_ids)}
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: "var(--gris)", lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditingId(p.id)} style={{ background: "rgb(var(--violet-rgb) / 0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px" }}>
                      <Pencil size={13} style={{ color: "var(--violet)" }} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} style={{ background: "rgb(var(--danger-rgb) / 0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px" }}>
                      {deletingId === p.id ? <Loader2 size={13} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "var(--danger)" }} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Séparateur + bouton créer */}
          <div style={{ borderTop: "1px dashed var(--bordure-forte)", marginTop: 8, paddingTop: 16 }}>
            {showCreate ? (
              <PoleForm
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
                saving={savingNew}
              />
            ) : (
              <button onClick={() => setShowCreate(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 20px", borderRadius: 12, border: "2px dashed var(--bordure-forte)", background: "transparent", color: "var(--gris)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "var(--font-google-sans)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--violet)"; e.currentTarget.style.color = "var(--violet)"; e.currentTarget.style.background = "rgb(var(--violet-rgb) / 0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bordure-forte)"; e.currentTarget.style.color = "var(--gris)"; e.currentTarget.style.background = "transparent"; }}
              >
                <Plus size={16} /> Ajouter un nouveau pôle territorial
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
