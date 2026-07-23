"use client";

// Admin — Lexique de l'investissement : liste éditable (ajout / modification /
// suppression). Alimente la page publique /lexique via l'API GET /lexique.

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { type Terme } from "@/lib/lexique";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BLEU = "#004f91", ENCRE = "#101a2e";

const IS: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E6EC", background: "#fff", fontSize: 13.5, color: ENCRE, outline: "none", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
const LS: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" };

// ── Modal ajout / édition ─────────────────────────────────────────────────────
function ModalTerme({ edit, onClose, onSaved }: { edit: Terme | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    terme: edit?.terme || "",
    definition: edit?.definition || "",
    actif: edit?.actif ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ajoutes, setAjoutes] = useState(0);

  const enregistrer = async (continuer = false) => {
    if (!form.terme.trim()) { setErr("Le terme est requis."); return; }
    setSaving(true); setErr("");
    try {
      const url = edit ? `${API}/lexique/${edit.id}` : `${API}/lexique`;
      const res = await fetch(url, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      onSaved();
      if (!edit && continuer) {
        // Ajout en série : on vide le formulaire et on garde le modal ouvert
        setForm({ terme: "", definition: "", actif: true });
        setAjoutes(n => n + 1);
      } else {
        onClose();
      }
    } catch { setErr("Échec de l'enregistrement."); } finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(16,26,46,0.5)", backdropFilter: "blur(6px)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 560, boxShadow: "var(--ombre-2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #F2F0EF" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: ENCRE }}>{edit ? "Modifier le terme" : "Nouveau terme"}</h2>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#4a5568" />
          </button>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={LS}>Terme</label>
            <input style={IS} value={form.terme} onChange={e => setForm(f => ({ ...f, terme: e.target.value }))} placeholder="ex. Greenfield" autoFocus />
          </div>
          <div>
            <label style={LS}>Définition</label>
            <textarea style={{ ...IS, minHeight: 120, resize: "vertical", lineHeight: 1.6 }} value={form.definition} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} placeholder="Définition claire et concise…" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#4a5568", cursor: "pointer" }}>
            <input type="checkbox" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} style={{ width: 16, height: 16, accentColor: BLEU }} />
            Visible sur la page publique
          </label>
          {err && <p style={{ color: "#dc2626", fontSize: 12.5, margin: 0 }}>{err}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 22px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA" }}>
          <span style={{ fontSize: 12, color: "#188038", fontWeight: 600 }}>{!edit && ajoutes > 0 ? `${ajoutes} terme${ajoutes > 1 ? "s" : ""} ajouté${ajoutes > 1 ? "s" : ""}` : ""}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #E2E6EC", background: "#fff", color: "#4a5568", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>{!edit && ajoutes > 0 ? "Terminer" : "Annuler"}</button>
            {!edit && (
              <button onClick={() => enregistrer(true)} disabled={saving} style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${BLEU}`, background: "#fff", color: BLEU, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "var(--font-google-sans)" }}>
                Ajouter &amp; continuer
              </button>
            )}
            <button onClick={() => enregistrer(false)} disabled={saving} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: BLEU, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgba(0,79,145,0.25)" }}>
              {saving ? "Enregistrement…" : edit ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminLexiquePage() {
  const [termes, setTermes] = useState<Terme[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Terme | null>(null);
  const [aSupprimer, setASupprimer] = useState<Terme | null>(null);

  const charger = () => {
    setLoading(true);
    fetch(`${API}/lexique?inclure_inactifs=true`).then(r => r.json())
      .then(d => setTermes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { charger(); }, []);

  const supprimer = async (t: Terme) => {
    await fetch(`${API}/lexique/${t.id}`, { method: "DELETE", headers: await authHeaders() });
    setASupprimer(null); charger();
  };

  const liste = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return termes
      .filter(t => !nq || t.terme.toLowerCase().includes(nq) || t.definition.toLowerCase().includes(nq))
      .sort((a, b) => a.terme.localeCompare(b.terme, "fr"));
  }, [termes, q]);

  const COLS = "1.2fr 2.6fr 88px";

  return (
    <div style={{ padding: "32px 40px 80px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9aa5b4", margin: "0 0 6px" }}>Référentiels</p>
          <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 800, color: ENCRE }}>Lexique de l&apos;investissement</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0" }}>{termes.length} terme{termes.length > 1 ? "s" : ""} · alimente la page publique <b>/lexique</b></p>
        </div>
        <button onClick={() => { setEdit(null); setModal(true); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: BLEU, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)", boxShadow: "0 3px 12px rgba(0,79,145,0.25)" }}>
          <Plus size={16} /> Nouveau terme
        </button>
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", width: "min(340px, 100%)" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un terme…" style={{ ...IS, paddingLeft: 34 }} />
        </div>
      </div>

      {/* Tableau */}
      <div className="ds-carte" style={{ overflow: "hidden", border: "1px solid rgba(16,26,46,0.10)" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 0, padding: "11px 18px", borderBottom: "1px solid #F2F0EF", background: "#FAFAF9" }}>
          {["Terme", "Définition", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 800, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9aa5b4", fontSize: 13.5 }}>Chargement…</div>
        ) : liste.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9aa5b4", fontSize: 13.5 }}>Aucun terme.</div>
        ) : liste.map(t => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 0, padding: "13px 18px", borderBottom: "1px solid #F5F3F0", alignItems: "center", opacity: t.actif === false ? 0.5 : 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: ENCRE, paddingRight: 12 }}>
              {t.terme}{t.actif === false && <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", marginLeft: 7 }}>(masqué)</span>}
            </span>
            <span style={{ fontSize: 12.5, color: t.definition?.trim() ? "#6b7280" : "#c99a1e", fontStyle: t.definition?.trim() ? "normal" : "italic", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", paddingRight: 12 }}>{t.definition?.trim() || "Définition à compléter"}</span>
            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={() => { setEdit(t); setModal(true); }} title="Modifier"
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E6EC", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: BLEU }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => setASupprimer(t)} title="Supprimer"
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(220,38,38,0.25)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {modal && <ModalTerme edit={edit} onClose={() => setModal(false)} onSaved={charger} />}

      {/* Confirmation de suppression */}
      {aSupprimer && (
        <div onClick={e => { if (e.target === e.currentTarget) setASupprimer(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(16,26,46,0.5)", backdropFilter: "blur(6px)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: "24px", boxShadow: "var(--ombre-2)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 800, color: ENCRE }}>Supprimer ce terme ?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6b7280" }}>« {aSupprimer.terme} » sera retiré définitivement du lexique.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setASupprimer(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #E2E6EC", background: "#fff", color: "#4a5568", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Annuler</button>
              <button onClick={() => supprimer(aSupprimer)} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
