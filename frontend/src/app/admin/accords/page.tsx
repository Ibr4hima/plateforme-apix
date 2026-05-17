"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUTS = ["en_vigueur","expire"];
const STATUT_LABELS: Record<string,string> = {
  en_vigueur: "En vigueur",
  expire:     "Expiré",
};
const STATUT_COLORS: Record<string,{bg:string;text:string}> = {
  en_vigueur: {bg:"#dcfce7",text:"#15803d"},
  expire:     {bg:"#f3f4f6",text:"#6b7280"},
};

const SENEGAL = "Sénégal";

const EMPTY_FORM = {
  titre:"", reference:"", pays_signataires:[SENEGAL] as string[],
  date_signature:"", date_entree_vigueur:"", date_expiration:"",
  thematiques:"", commentaires:"",
  statut:"en_vigueur", est_publie:true,
};

export default function AdminAccords() {
  const [accords,  setAccords]  = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [error,    setError]    = useState("");
  const [form,     setForm]     = useState<any>({ ...EMPTY_FORM });
  const [fichiers,      setFichiers]       = useState<any[]>([]);
  const [loadingFiles,  setLoadingFiles]   = useState(false);
  const [deleting,      setDeleting]      = useState<string|null>(null);
  // Multi-PDF : liste de { file: File, titre: string }
  const [pdfQueue,      setPdfQueue]      = useState<{file: File; titre: string}[]>([]);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/accords?per_page=100`);
      const data = await res.json();
      setAccords(data.data || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditItem(null); setPdfQueue([]); setFichiers([]);
    setShowForm(true); setError(""); setSaveOk(false);
  };

  const openEdit = (a: any) => {
    const paysExistants: string[] = a.pays_signataires
      ? a.pays_signataires.split(", ").filter(Boolean)
      : [];
    // Sénégal toujours présent
    const paysAvecSenegal = paysExistants.includes(SENEGAL)
      ? paysExistants
      : [SENEGAL, ...paysExistants];

    setForm({
      titre:               a.titre               || "",
      reference:           a.reference           || "",
      pays_signataires:    paysAvecSenegal,
      date_signature:      a.date_signature       || "",
      date_entree_vigueur: a.date_entree_vigueur  || "",
      date_expiration:     a.date_expiration      || "",
      thematiques:         a.secteur_activite     || "",
      commentaires:        a.commentaires         || "",
      statut:              a.statut               || "en_vigueur",
      est_publie:          a.est_publie           ?? true,
    });
    setEditItem(a); setPdfQueue([]); setFichiers([]);
    setShowForm(true); setError(""); setSaveOk(false);
    // Charger les fichiers existants
    fetch(`${API_BASE}/accords/${a.id}/fichiers`)
      .then(r => r.json()).then(setFichiers).catch(() => {});
  };

  const handleSave = async () => {
    if (!form.titre.trim())     { setError("Le titre est obligatoire"); return; }
    if (!form.reference.trim()) { setError("La référence est obligatoire"); return; }
    if (!form.date_signature) { setError("La date de signature est obligatoire"); return; }
    if (!form.date_entree_vigueur) { setError("La date d'entrée en vigueur est obligatoire"); return; }
    if (!form.date_expiration) { setError("La date d'expiration est obligatoire"); return; }

    const today = new Date().toISOString().split("T")[0];

    // Date de signature <= aujourd'hui (peut être aujourd'hui)
    if (form.date_signature > today) {
      setError("La date de signature doit être aujourd'hui ou dans le passé"); return;
    }
    // Entrée en vigueur >= date de signature
    if (form.date_entree_vigueur < form.date_signature) {
      setError("L'entrée en vigueur doit être égale ou postérieure à la date de signature"); return;
    }
    // Date d'expiration > date de signature (strictement)
    if (form.date_expiration <= form.date_signature) {
      setError("La date d'expiration doit être strictement après la date de signature"); return;
    }
    // Date d'expiration > entrée en vigueur (strictement)
    if (form.date_expiration <= form.date_entree_vigueur) {
      setError("La date d'expiration doit être strictement après la date d'entrée en vigueur"); return;
    }
    // Date d'expiration > aujourd'hui (strictement)
    if (form.date_expiration <= today) {
      setError("La date d'expiration doit être dans le futur (après aujourd'hui)"); return;
    }
    if (!form.pays_signataires || form.pays_signataires.length === 0) {
      setError("Au moins un pays signataire est obligatoire"); return;
    }
    // Validation : au moins un autre pays en plus du Sénégal
    if ((form.pays_signataires as string[]).length < 2) {
      setError("Il doit y avoir au moins un autre pays signataire en plus du Sénégal"); return;
    }

    setSaving(true); setError("");
    try {
      const paysStr = (form.pays_signataires as string[]).join(", ") || null;

      if (editItem) {
        const payload: any = {
          titre:               form.titre,
          reference:           form.reference       || null,
          pays_signataires:    paysStr,
          date_signature:      form.date_signature      || null,
          date_entree_vigueur: form.date_entree_vigueur || null,
          date_expiration:     form.date_expiration     || null,
          secteur_activite:    form.thematiques         || null,
          commentaires:        form.commentaires        || null,
          statut:              form.statut,
          est_publie:          form.est_publie,
        };
        const res = await fetch(`${API_BASE}/accords/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        // Upload les nouveaux PDFs en mode édition
        for (const p of pdfQueue) {
          const fd = new FormData();
          fd.append("titre",   p.titre || p.file.name);
          fd.append("fichier", p.file);
          await fetch(`${API_BASE}/accords/${editItem.id}/fichiers`, { method: "POST", body: fd });
        }
      } else {
        // Créer l'accord SANS fichier dans la table principale
        const fd = new FormData();
        fd.append("titre",               form.titre);
        fd.append("reference",           form.reference);
        fd.append("pays_signataires",    paysStr || "");
        if (form.date_signature)         fd.append("date_signature",      form.date_signature);
        if (form.date_entree_vigueur)    fd.append("date_entree_vigueur", form.date_entree_vigueur);
        if (form.date_expiration)        fd.append("date_expiration",     form.date_expiration);
        if (form.thematiques)            fd.append("secteur_activite",    form.thematiques);
        if (form.commentaires)           fd.append("commentaires",        form.commentaires);
        fd.append("statut",              form.statut);
        fd.append("est_publie",          String(form.est_publie));
        const res = await fetch(`${API_BASE}/accords`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const newAccord = await res.json();
        // Tous les PDFs via /fichiers sans exception
        for (const p of pdfQueue) {
          const fd2 = new FormData();
          fd2.append("titre",   p.titre || p.file.name);
          fd2.append("fichier", p.file);
          await fetch(`${API_BASE}/accords/${newAccord.id}/fichiers`, { method: "POST", body: fd2 });
        }
      }
      setSaveOk(true);
      setTimeout(() => { setShowForm(false); charger(); }, 1000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet accord ?")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/accords/${id}`, { method: "DELETE" });
      charger();
    } finally { setDeleting(null); }
  };

  const handleTogglePublie = async (a: any) => {
    await fetch(`${API_BASE}/accords/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ est_publie: !a.est_publie }),
    });
    charger();
  };

  const inputStyle = {
    width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };
  const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 3 };

  return (
    <div style={{ padding: "36px 40px 80px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
            Administration
          </p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>
            Accords & Traités
          </h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>
            {total} accord{total > 1 ? "s" : ""} au total
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          color: "#fff", fontWeight: 600, fontSize: 14,
          padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
        }}>
          <Plus size={16} /> Ajouter un accord
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20,
          marginBottom: 32, overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #7c3aed, #6d28d9)" }} />
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                {editItem ? "Modifier l'accord" : "Nouvel accord / traité"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                <X size={15} color="#4a5568" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Titre + Référence sur 2 colonnes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Titre *</label>
                  <input value={form.titre} onChange={e => update("titre", e.target.value)} placeholder="Intitulé complet de l'accord" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Référence *</label>
                  <input value={form.reference} onChange={e => update("reference", e.target.value)} placeholder="Ex : APIX/2024/ACC-001" style={inputStyle} />
                </div>
              </div>

              {/* Statut */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Statut</label>
                <select value={form.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Pays signataire(s) */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Pays signataire(s) *</label>
                <PaysMultiSelect
                  value={(form.pays_signataires as string[]).join(", ")}
                  onChange={(val: string) => {
                    const liste = val ? val.split(", ").map(s => s.trim()).filter(Boolean) : [];
                    // Sénégal toujours présent — ne peut pas être retiré
                    const avecSenegal = liste.includes(SENEGAL) ? liste : [SENEGAL, ...liste];
                    update("pays_signataires", avecSenegal);
                  }}
                />
                <span style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>
                  Le Sénégal est toujours signataire. Au moins un autre pays est requis.
                </span>
                {(form.pays_signataires as string[]).length < 2 && (
                  <span style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                    Ajoutez au moins un autre pays signataire
                  </span>
                )}
              </div>

              {/* Dates — 3 colonnes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

                {/* Date de signature */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date de signature *</label>
                  <input
                    type="date"
                    value={form.date_signature}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => update("date_signature", e.target.value)}
                    style={{
                      ...inputStyle,
                      borderColor: form.date_signature && form.date_signature > new Date().toISOString().split("T")[0] ? "#dc2626" : "#C5BFBB",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9aa5b4" }}>≤ aujourd'hui</span>
                </div>

                {/* Entrée en vigueur */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Entrée en vigueur *</label>
                  <input
                    type="date"
                    value={form.date_entree_vigueur}
                    min={form.date_signature || undefined}
                    onChange={e => update("date_entree_vigueur", e.target.value)}
                    style={{
                      ...inputStyle,
                      borderColor: form.date_entree_vigueur && form.date_signature && form.date_entree_vigueur < form.date_signature ? "#dc2626" : "#C5BFBB",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9aa5b4" }}>≥ date de signature</span>
                </div>

                {/* Date d'expiration */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date d'expiration *</label>
                  <input
                    type="date"
                    value={form.date_expiration}
                    min={form.date_entree_vigueur
                      ? (() => { const d = new Date(form.date_entree_vigueur); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()
                      : form.date_signature
                        ? (() => { const d = new Date(form.date_signature); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()
                        : new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0]
                    }
                    onChange={e => update("date_expiration", e.target.value)}
                    style={{
                      ...inputStyle,
                      borderColor: form.date_expiration && form.date_expiration <= new Date().toISOString().split("T")[0] ? "#dc2626" : "#C5BFBB",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9aa5b4" }}>{'>'} aujourd'hui, {'>'} entrée en vigueur</span>
                </div>
              </div>

              {/* Thématiques — secteurs, branches, activités */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Thématiques</label>
                <ThematiquesNaema
                  value={form.thematiques}
                  onChange={val => update("thematiques", val)}
                />
              </div>

              {/* Commentaires */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Résumé / Commentaires</label>
                <textarea value={form.commentaires} onChange={e => update("commentaires", e.target.value)} rows={4} placeholder="Description et résumé des termes de l'accord..." style={{ ...inputStyle, resize: "vertical" as const }} />
              </div>

              {/* PDFs — multi-fichiers */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Fichiers PDF</label>

                {/* Fichiers déjà enregistrés (mode édition) */}
                {fichiers.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                      Fichiers enregistrés
                    </span>
                    {fichiers.map((f: any) => (
                      <div key={f.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.2)",
                        borderRadius: 8, padding: "8px 12px",
                      }}>
                        <FileText size={14} style={{ color: "#004f91", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#1a1a2e", flex: 1, fontWeight: 500 }}>
                          {f.titre || f.fichier_nom || "Document PDF"}
                        </span>
                        <a
                          href={`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}/download`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#004f91", fontWeight: 600, textDecoration: "none" }}
                          onClick={e => e.stopPropagation()}
                        >
                          Voir
                        </a>
                        <button
                          onClick={async () => {
                            await fetch(`${API_BASE}/accords/${editItem?.id}/fichiers/${f.id}`, { method: "DELETE" });
                            setFichiers(prev => prev.filter((x: any) => x.id !== f.id));
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                        >
                          <X size={13} style={{ color: "#dc2626" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zone d'ajout de nouveaux PDFs */}
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                  borderRadius: 8, cursor: "pointer", border: "2px dashed #C5BFBB",
                  background: "#F2F0EF", transition: "border-color 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#C5BFBB"}
                >
                  <Upload size={15} color="#9aa5b4" />
                  <span style={{ fontSize: 13, color: "#9aa5b4" }}>
                    Cliquer pour ajouter un ou plusieurs PDF
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    style={{ display: "none" }}
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      const nouveaux = files.map(f => ({ file: f, titre: f.name.replace(/\.pdf$/i, "") }));
                      setPdfQueue(prev => [...prev, ...nouveaux]);
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* PDFs en attente d'upload */}
                {pdfQueue.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                      À ajouter
                    </span>
                    {pdfQueue.map((p, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)",
                        borderRadius: 8, padding: "8px 12px",
                      }}>
                        <FileText size={14} style={{ color: "#7c3aed", flexShrink: 0 }} />
                        <input
                          value={p.titre}
                          onChange={e => setPdfQueue(prev => prev.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))}
                          placeholder="Titre du document"
                          style={{ ...inputStyle, flex: 1, padding: "5px 8px", fontSize: 12, background: "transparent", border: "none", borderBottom: "1px solid rgba(124,58,237,0.3)" }}
                        />
                        <span style={{ fontSize: 11, color: "#9aa5b4", flexShrink: 0 }}>
                          {(p.file.size / 1024).toFixed(0)} Ko
                        </span>
                        <button
                          onClick={() => setPdfQueue(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                        >
                          <X size={13} style={{ color: "#dc2626" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

{/* Publié */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#4a5568" }}>
                <input type="checkbox" checked={form.est_publie} onChange={e => update("est_publie", e.target.checked)} style={{ width: 16, height: 16 }} />
                Publier sur le site public
              </label>

              {error && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowForm(false)} style={{
                  padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB",
                  background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Annuler</button>
                <button onClick={handleSave} disabled={saving || saveOk} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: saveOk ? "#dcfce7" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: saveOk ? "#15803d" : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {saveOk ? <><Check size={14} /> Enregistré !</> :
                   saving  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> :
                   editItem ? "Modifier" : "Créer l'accord"}
                  <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E8E5E3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>
            Liste des accords
          </h2>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{total} résultat{total > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, gap: 10, color: "#9aa5b4" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Chargement...</span>
          </div>
        ) : accords.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9aa5b4" }}>
            <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#4a5568" }}>Aucun accord</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Cliquez sur "Ajouter un accord" pour commencer.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8F7F6" }}>
                  {["Titre","Référence","Date signature","Date expiration","Statut","Publié","Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accords.map((a, i) => {
                  const statut = STATUT_COLORS[a.statut] || STATUT_COLORS.en_vigueur;
                  const fmtDate = (d: string) => {
                    if (!d) return "—";
                    const [y,m,day] = d.split("-").map(Number);
                    return new Date(y, m-1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                  };
                  return (
                    <tr key={a.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                      <td style={{ padding: "14px 16px", maxWidth: 240 }}>
                        <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3 }}>
                          {a.titre.length > 45 ? a.titre.slice(0, 45) + "…" : a.titre}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                        {a.reference || "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                        {fmtDate(a.date_signature)}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                        {fmtDate(a.date_expiration)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: statut.bg, color: statut.text, padding: "3px 10px", borderRadius: 999 }}>
                          {STATUT_LABELS[a.statut] || a.statut}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button onClick={() => handleTogglePublie(a)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                          {a.est_publie
                            ? <Eye size={16} style={{ color: "#15803d" }} />
                            : <EyeOff size={16} style={{ color: "#9aa5b4" }} />
                          }
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(a)} style={{ background: "rgba(124,58,237,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            <Pencil size={13} style={{ color: "#7c3aed" }} />
                          </button>
                          <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            {deleting === a.id
                              ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                              : <Trash2 size={13} style={{ color: "#dc2626" }} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
