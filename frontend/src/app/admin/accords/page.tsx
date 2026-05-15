"use client";

import { Check, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { NaemaCascade, NaemaCascadeMulti } from "@/components/shared/NaemaSelects";
import PaysSelect from "@/components/shared/PaysSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUTS = ["en_vigueur","expire"];
const STATUT_LABELS: Record<string,string> = {
  en_vigueur:"En vigueur",
  expire:"Expiré",
};
const STATUT_COLORS: Record<string,{bg:string;text:string}> = {
  en_vigueur:        {bg:"#dcfce7",text:"#15803d"},
  expire:            {bg:"#f3f4f6",text:"#6b7280"},
};

const EMPTY_FORM = {
  titre:"", pays_signataires:[] as string[],
  date_signature:"", date_entree_vigueur:"", date_expiration:"",
  secteur_activite:"", branche_activite:"", activite_detail:"",
  commentaires:"", domaines_couverts:"", avantages_principaux:"",
  statut:"en_vigueur", est_publie:true,
};


function PaysMultiSelect({ selected, onToggle, onClear }: {
  selected: string[];
  onToggle: (pays: string) => void;
  onClear:  (pays: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const [pays,   setPays]   = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/entreprises/ref/pays")
      .then(r => r.json()).then(setPays).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = pays.filter(p => p.nom_fr.toLowerCase().includes(search.toLowerCase()));
  const grouped  = filtered.reduce((acc: any, p: any) => {
    const r = p.region_monde || "Autre";
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {});

  const IS = {
    width: "100%", background: "#F2F0EF", border: `1px solid ${open ? "#7c3aed" : "#C5BFBB"}`,
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Tags sélectionnés */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {selected.map(p => (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
              {p}
              <button onClick={() => onClear(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={10} style={{ color: "#7c3aed" }} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Input recherche */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length > 0 ? "Ajouter un pays..." : "Rechercher un pays..."}
          style={IS}
        />
      </div>
      {/* Dropdown */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 260, overflowY: "auto" }}>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([region, list]: any) => (
            <div key={region}>
              <div style={{ padding: "5px 12px 2px", fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", background: "#F8F7F6" }}>{region}</div>
              {list.map((p: any) => {
                const isSel = selected.includes(p.nom_fr);
                return (
                  <div key={p.id} onMouseDown={e => { e.preventDefault(); onToggle(p.nom_fr); setSearch(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: isSel ? "rgba(124,58,237,0.06)" : "transparent", borderBottom: "1px solid #F2F0EF" }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSel ? "rgba(124,58,237,0.06)" : "transparent"; }}
                  >
                    <div style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${isSel ? "#7c3aed" : "#C5BFBB"}`, background: isSel ? "#7c3aed" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isSel && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize: 16 }}>{String.fromCodePoint(...p.code_iso2.toUpperCase().split("").map((c: string) => 127397 + c.charCodeAt(0)))}</span>
                    <span style={{ fontSize: 13, color: isSel ? "#7c3aed" : "#1a1a2e", fontWeight: isSel ? 600 : 400 }}>{p.nom_fr}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: "12px", fontSize: 13, color: "#9aa5b4", textAlign: "center" }}>Aucun pays trouvé</div>}
        </div>
      )}
    </div>
  );
}

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
  const [fichier,       setFichier]       = useState<File|null>(null);
  const [titreFichier,  setTitreFichier]  = useState("");
  const [fichiers,      setFichiers]       = useState<any[]>([]);
  const [loadingFiles,  setLoadingFiles]   = useState(false);
  const [deleting,      setDeleting]      = useState<string|null>(null);

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
    setEditItem(null); setFichier(null); setTitreFichier(""); setFichiers([]);
    setShowForm(true); setError(""); setSaveOk(false);
  };

  const openEdit = (a: any) => {
    setForm({
      titre:                   a.titre                   || "",
      pays_signataires:        a.pays_signataires ? a.pays_signataires.split(", ").filter(Boolean) : [] as string[],
      date_signature:          a.date_signature          || "",
      date_entree_vigueur:     a.date_entree_vigueur     || "",
      date_expiration:         a.date_expiration         || "",
      secteur_activite:        a.secteur_activite        || "",
      branche_activite:        a.branche_activite        || "",
      activite_detail:         a.activite_detail         || "",
      commentaires:            a.commentaires            || "",
      domaines_couverts:       a.domaines_couverts       || "",
      avantages_principaux:    a.avantages_principaux    || "",
      statut:                  a.statut                  || "en_vigueur",
      est_publie:              a.est_publie              ?? true,
    });
    setEditItem(a); setFichier(null); setTitreFichier(""); setFichiers([]);
    setShowForm(true); setError(""); setSaveOk(false);
    // Charger les fichiers existants
    fetch(`${API_BASE}/accords/${a.id}/fichiers`)
      .then(r => r.json()).then(setFichiers).catch(() => {});
  };

  const handleSave = async () => {
    if (!form.titre.trim()) { setError("Le titre est obligatoire"); return; }
    if (!form.date_signature) { setError("La date de signature est obligatoire"); return; }
    if (form.date_signature > new Date().toISOString().split("T")[0]) {
      setError("La date de signature ne peut pas être dans le futur"); return;
    }
    if (!form.date_entree_vigueur) { setError("La date d'entrée en vigueur est obligatoire"); return; }
    if (!form.date_expiration) { setError("La date d'expiration est obligatoire"); return; }
    if (form.date_entree_vigueur <= form.date_signature) {
      setError("L'entrée en vigueur doit être strictement après la date de signature"); return;
    }
    if (form.date_expiration <= form.date_entree_vigueur) {
      setError("La date d'expiration doit être strictement après l'entrée en vigueur"); return;
    }
    if (!form.pays_signataires || form.pays_signataires.length === 0) {
      setError("Au moins un pays signataire est obligatoire"); return;
    }
    setSaving(true); setError("");
    try {
      if (editItem) {
        const payload: any = { ...form };
        // Convertir pays_signataires array en string
        if (Array.isArray(payload.pays_signataires)) {
          payload.pays_signataires = payload.pays_signataires.join(", ") || null;
        }
        Object.keys(payload).forEach(k => { if (payload[k] === "" || (Array.isArray(payload[k]) && payload[k].length === 0)) payload[k] = null; });
        const res = await fetch(`${API_BASE}/accords/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== "" && v !== null && v !== undefined) fd.append(k, String(v));
        });
        if (fichier) fd.append("fichier", fichier);
        const res = await fetch(`${API_BASE}/accords`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
      }
      // Upload les fichiers temporaires après création
      const savedData = await (await fetch(`${API_BASE}/accords?per_page=1&search=${encodeURIComponent(form.titre)}`)).json();
      const newId = savedData.data?.[0]?.id;
      if (newId) {
        for (const f of fichiers.filter((x: any) => x._file)) {
          const fd = new FormData();
          fd.append("titre", f.titre);
          fd.append("fichier", f._file);
          await fetch(`${API_BASE}/accords/${newId}/fichiers`, { method: "POST", body: fd });
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

              {/* Titre */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Titre *</label>
                <input value={form.titre} onChange={e => update("titre", e.target.value)} placeholder="Intitulé complet de l'accord" style={inputStyle} />
              </div>

              {/* Statut */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Statut</label>
                <select value={form.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Pays signataire(s) + Organisation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Pays signataire(s) *</label>
                  <PaysMultiSelect
                    selected={form.pays_signataires}
                    onToggle={(pays: string) => {
                      const current = form.pays_signataires as string[];
                      const next = current.includes(pays)
                        ? current.filter((p: string) => p !== pays)
                        : [...current, pays];
                      update("pays_signataires", next);
                    }}
                    onClear={(pays: string) => update("pays_signataires", (form.pays_signataires as string[]).filter((p: string) => p !== pays))}
                  />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  { key: "date_signature",      label: "Date de signature"    },
                  { key: "date_entree_vigueur", label: "Entrée en vigueur"    },
                  { key: "date_expiration",     label: "Date d'expiration"    },
                ].map(f => (
                  <div key={f.key} style={fieldStyle}>
                    <label style={labelStyle}>{f.label}</label>
                    <input type="date" value={(form as any)[f.key]} max={(f as any).max} onChange={e => update(f.key, e.target.value)} style={inputStyle} />
                  </div>
                ))}
              </div>

              {/* Classification NAEMA — secteur/branche principal (cascade simple) */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: "16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Secteur & Branche principaux
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <NaemaCascade
                    secteurVal={form.secteur_activite}
                    brancheVal={form.branche_activite}
                    activiteVal={form.activite_detail}
                    onSecteurChange={val => { update("secteur_activite", val); update("branche_activite", ""); update("activite_detail", ""); }}
                    onBrancheChange={val => { update("branche_activite", val); update("activite_detail", ""); }}
                    onActiviteChange={val => update("activite_detail", val)}
                  />
                </div>
              </div>

              {/* Domaines couverts — sélection multiple NAEMA */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: "16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Domaines couverts (multi-sélection)
                </p>
                <NaemaCascadeMulti
                  onChange={({ secteurs, branches, activites }) => {
                    const tous = [...secteurs, ...branches, ...activites];
                    update("domaines_couverts", tous.join(", "));
                  }}
                />
                {form.domaines_couverts && (
                  <p style={{ fontSize: 12, color: "#4a5568", marginTop: 10 }}>
                    <strong>Sélectionnés :</strong> {form.domaines_couverts}
                  </p>
                )}
              </div>

              {/* Commentaires */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Résumé / Commentaires</label>
                <textarea value={form.commentaires} onChange={e => update("commentaires", e.target.value)} rows={4} placeholder="Description et résumé des termes de l'accord..." style={{ ...inputStyle, resize: "vertical" as const }} />
              </div>

              {/* Avantages */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Avantages principaux</label>
                <textarea value={form.avantages_principaux} onChange={e => update("avantages_principaux", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" as const }} />
              </div>

{/* PDF — seulement à la création */}
              {!editItem && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Fichier PDF</label>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                    borderRadius: 8, cursor: "pointer", border: "2px dashed #C5BFBB",
                    background: fichier ? "rgba(124,58,237,0.04)" : "#F2F0EF",
                  }}>
                    <Upload size={15} color={fichier ? "#7c3aed" : "#9aa5b4"} />
                    <span style={{ fontSize: 13, color: fichier ? "#7c3aed" : "#9aa5b4" }}>
                      {fichier ? fichier.name : "Cliquer pour sélectionner un PDF"}
                    </span>
                    <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setFichier(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

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
                  {["Titre","Type","Pays signataires","Date signature","Statut","Publié","Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accords.map((a, i) => {
                  const statut = STATUT_COLORS[a.statut] || STATUT_COLORS.en_vigueur;
                  return (
                    <tr key={a.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                      <td style={{ padding: "14px 16px", maxWidth: 260 }}>
                        <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3, marginBottom: 2 }}>
                          {a.titre.length > 50 ? a.titre.slice(0, 50) + "…" : a.titre}
                        </div>
                      </td>
<td style={{ padding: "14px 16px", color: "#4a5568", maxWidth: 180 }}>
                        {a.pays_signataires || "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                        {a.date_signature ? new Date(a.date_signature).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
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
