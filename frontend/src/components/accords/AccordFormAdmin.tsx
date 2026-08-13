"use client";

import { useState } from "react";
import { useDialogue } from "@/lib/dialogue";
import { X, Upload, Check, Loader2 } from "lucide-react";

import { API_BASE as API } from "@/lib/api";

const STATUTS = [
  { value: "en_vigueur",        label: "En vigueur"        },
  { value: "signe_non_ratifie", label: "Signé non ratifié" },
  { value: "expire",            label: "Expiré"            },
  { value: "suspendu",          label: "Suspendu"          },
  { value: "negocie",           label: "En négociation"    },
];

export default function AccordFormAdmin({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const dial = useDialogue(true);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error,   setError]     = useState("");
  const [fichier, setFichier]   = useState<File | null>(null);

  const [form, setForm] = useState({
    titre: "", reference: "", type_accord: "",
    pays_signataires: "", organisation_partenaire: "",
    date_signature: "", date_ratification: "",
    date_entree_vigueur: "", date_expiration: "",
    secteur_activite: "", branche_activite: "",
    commentaires: "", domaines_couverts: "", avantages_principaux: "",
    statut: "en_vigueur", lien_texte_officiel: "",
    est_publie: true,
  });

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titre.trim()) { setError("Le titre est obligatoire"); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) fd.append(k, String(v));
      });
      if (fichier) fd.append("fichier", fichier);

      const res = await fetch(`${API}/accords`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Erreur ${res.status}`);
      }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", background: "var(--fond)", border: "1px solid var(--bordure-forte)",
    borderRadius: 10, padding: "10px 14px", fontSize: "var(--t-13)", color: "var(--encre)",
    outline: "none", fontFamily: "var(--font-body)", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: "var(--t-12)", fontWeight: 600, color: "var(--texte)", marginBottom: 6, display: "block" };
  const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 4 };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgb(var(--ombre-rgb) / 0.4)",
        backdropFilter: "blur(6px)", display: "flex",
        alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 24,
      }}
    >
      <div {...dial} aria-label="Nouvel accord ou traité" style={{
        background: "var(--carte-douce)", borderRadius: 24,
        border: "1px solid var(--bordure-forte)", width: "100%", maxWidth: 680,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgb(var(--ombre-rgb) / 0.15)",
      }}>
        <div style={{ height: 5, background: "linear-gradient(90deg, var(--bleu-action), var(--bleu-clair))", borderRadius: "24px 24px 0 0" }} />

        <div style={{ padding: "24px 28px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "var(--t-r120)", color: "var(--encre)" }}>
                Nouvel accord / traité
              </h2>
              <p style={{ fontSize: "var(--t-13)", color: "var(--gris)", marginTop: 2 }}>Remplissez les informations de l'accord</p>
            </div>
            <button onClick={onClose} style={{ background: "var(--fond-creux2)", border: "none", cursor: "pointer", borderRadius: 10, padding: 8 }}>
              <X size={16} color="var(--texte)" />
            </button>
          </div>

          {/* Formulaire */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Titre + Référence */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Titre <span style={{ color: "var(--orange)" }}>*</span></label>
                <input value={form.titre} onChange={e => update("titre", e.target.value)} placeholder="Intitulé complet de l'accord" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Référence</label>
                <input value={form.reference} onChange={e => update("reference", e.target.value)} placeholder="Ex: TBI-2024-01" style={inputStyle} />
              </div>
            </div>

            {/* Type + Statut */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Type d'accord</label>
                <input value={form.type_accord} onChange={e => update("type_accord", e.target.value)} placeholder="Ex: TBI, APE, Coopération..." style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Statut</label>
                <select value={form.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Pays + Organisation */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Pays signataires</label>
                <input value={form.pays_signataires} onChange={e => update("pays_signataires", e.target.value)} placeholder="Ex: France, Allemagne" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Organisation partenaire</label>
                <input value={form.organisation_partenaire} onChange={e => update("organisation_partenaire", e.target.value)} placeholder="Ex: Union Européenne" style={inputStyle} />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                { key: "date_signature",      label: "Date de signature"   },
                { key: "date_ratification",   label: "Date de ratification"},
                { key: "date_entree_vigueur", label: "Entrée en vigueur"   },
                { key: "date_expiration",     label: "Date d'expiration"   },
              ].map(f => (
                <div key={f.key} style={fieldStyle}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type="date" value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} style={inputStyle} />
                </div>
              ))}
            </div>

            {/* Secteur + Branche */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Secteur d'activité</label>
                <input value={form.secteur_activite} onChange={e => update("secteur_activite", e.target.value)} placeholder="Ex: Secteur primaire" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Branche d'activité</label>
                <input value={form.branche_activite} onChange={e => update("branche_activite", e.target.value)} placeholder="Ex: Agriculture, pêche" style={inputStyle} />
              </div>
            </div>

            {/* Domaines */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Domaines couverts <span style={{ fontSize: "var(--t-11)", color: "var(--gris)", fontWeight: 400 }}>(séparés par des virgules)</span></label>
              <input value={form.domaines_couverts} onChange={e => update("domaines_couverts", e.target.value)} placeholder="Ex: Investissement, Commerce, Fiscalité" style={inputStyle} />
            </div>

            {/* Commentaires */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Résumé / Commentaires</label>
              <textarea
                value={form.commentaires}
                onChange={e => update("commentaires", e.target.value)}
                placeholder="Description et résumé des termes de l'accord..."
                rows={4}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
            </div>

            {/* Avantages */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Avantages principaux</label>
              <textarea
                value={form.avantages_principaux}
                onChange={e => update("avantages_principaux", e.target.value)}
                placeholder="Principaux avantages pour le Sénégal..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" as const }}
              />
            </div>

            {/* Lien officiel */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Lien texte officiel</label>
              <input value={form.lien_texte_officiel} onChange={e => update("lien_texte_officiel", e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>

            {/* Upload PDF */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Fichier PDF</label>
              <label style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                border: "2px dashed var(--bordure-forte)", background: fichier ? "rgb(var(--bleu-rgb) / 0.04)" : "var(--fond)",
                transition: "all 0.2s",
              }}>
                <Upload size={16} color={fichier ? "var(--bleu)" : "var(--gris)"} />
                <span style={{ fontSize: "var(--t-13)", color: fichier ? "var(--bleu)" : "var(--gris)" }}>
                  {fichier ? fichier.name : "Cliquer pour sélectionner un PDF"}
                </span>
                <input
                  type="file" accept=".pdf" style={{ display: "none" }}
                  onChange={e => setFichier(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Publié */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox" id="est_publie" checked={form.est_publie}
                onChange={e => update("est_publie", e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="est_publie" style={{ fontSize: "var(--t-13)", color: "var(--texte)", cursor: "pointer" }}>
                Publier sur le site public
              </label>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{ background: "var(--danger-voile)", color: "var(--danger)", padding: "10px 14px", borderRadius: 10, fontSize: "var(--t-13)" }}>
                {error}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={onClose} style={{
                padding: "11px 22px", borderRadius: 12, border: "1px solid var(--bordure-forte)",
                background: "transparent", color: "var(--texte)", fontSize: "var(--t-14)", fontWeight: 600, cursor: "pointer",
              }}>
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={loading || success} style={{
                padding: "11px 28px", borderRadius: 12, border: "none",
                background: success ? "var(--vert-voile)" : "linear-gradient(135deg, var(--bleu-action), var(--bleu-nuit))",
                color: success ? "var(--vert-fonce)" : "var(--sur-bleu)",
                fontSize: "var(--t-14)", fontWeight: 600, cursor: loading ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s",
              }}>
                {success ? <><Check size={15} /> Enregistré !</> : loading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement...</> : "Enregistrer l'accord"}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
