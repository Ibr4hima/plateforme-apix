"use client";

import { NaemaCascadeMulti } from "@/components/shared/NaemaSelects";
import { Building2, Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const FORMES_JURIDIQUES = [
  "SA","SARL","SAS","GIE","SUARL","SNC","SCS","Entreprise individuelle","Association","ONG","Autre"
];

const EMPTY_FORM = {
  nom:"", forme_juridique:"", date_creation:"",
  pays:"Sénégal", region:"", departement:"", commune:"", adresse:"",
  telephone:"", mail:"", siteweb:"",
secteurs:[], branches:[], activites:[],
  statut:"actif", est_publie:true, note_interne:"",
};

const EMPTY_FOCAL = { nom:"", prenom:"", poste:"", telephone:"", mail:"", est_principal:false };

export default function AdminEntreprises() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editItem,    setEditItem]    = useState<any>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [error,       setError]       = useState("");
  const [form,        setForm]        = useState<any>({ ...EMPTY_FORM });
  const [focaux,      setFocaux]      = useState<any[]>([]);
  const [deleting,    setDeleting]    = useState<string|null>(null);

  // NAEMA
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/entreprises?per_page=100`);
      const data = await res.json();
      setEntreprises(data.data || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Charger secteurs au montage
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/secteurs`)
      .then(r => r.json()).then(setSecteurs).catch(() => {});
  }, []);

  // Charger branches quand secteur change
  useEffect(() => {
    if (form.secteur_id) {
      fetch(`${API_BASE}/entreprises/ref/branches?secteur_id=${form.secteur_id}`)
        .then(r => r.json()).then(setBranches).catch(() => {});
      setActivites([]);
      setForm((f: any) => ({ ...f, branche_id: "", activite_id: "" }));
    } else {
      setBranches([]); setActivites([]);
    }
  }, [form.secteur_id]);

  // Charger activités quand branche change
  useEffect(() => {
    if (form.branche_id) {
      fetch(`${API_BASE}/entreprises/ref/activites?branche_id=${form.branche_id}`)
        .then(r => r.json()).then(setActivites).catch(() => {});
      setForm((f: any) => ({ ...f, activite_id: "" }));
    } else {
      setActivites([]);
    }
  }, [form.branche_id]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM }); setFocaux([{ ...EMPTY_FOCAL }]);
    setEditItem(null); setShowForm(true); setError(""); setSaveOk(false);
  };

  const openEdit = (e: any) => {
    setForm({
      nom: e.nom || "", forme_juridique: e.forme_juridique || "",
      date_creation: e.date_creation || "",
      pays: e.pays || "Sénégal", region: e.region || "",
      departement: e.departement || "", commune: e.commune || "",
      adresse: e.adresse || "", telephone: e.telephone || "",
      mail: e.mail || "", siteweb: e.siteweb || "",
      secteur_id: e.secteur?.id?.toString() || "",
      branche_id: e.branche?.id?.toString() || "",
      activite_id: e.activite?.id?.toString() || "",
      statut: e.statut || "actif", est_publie: e.est_publie ?? true,
      note_interne: e.note_interne || "",
    });
    setFocaux(e.points_focaux?.length > 0
      ? e.points_focaux.map((pf: any) => ({
          nom: pf.nom || "", prenom: pf.prenom || "", poste: pf.poste || "",
          telephone: pf.telephone || "", mail: pf.mail || "", est_principal: pf.est_principal || false,
        }))
      : [{ ...EMPTY_FOCAL }]
    );
    setEditItem(e); setShowForm(true); setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = { ...form };
      // Convertir strings vides en null
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      if (payload.secteur_id) payload.secteur_id = parseInt(payload.secteur_id);
      if (payload.branche_id) payload.branche_id = parseInt(payload.branche_id);
      if (payload.activite_id) payload.activite_id = parseInt(payload.activite_id);

      // Points focaux valides
      const pf = focaux.filter(f => f.nom.trim());
      if (!editItem) payload.points_focaux = pf;

      const url    = editItem ? `${API_BASE}/entreprises/${editItem.id}` : `${API_BASE}/entreprises`;
      const method = editItem ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);

      setSaveOk(true);
      setTimeout(() => { setShowForm(false); charger(); }, 1000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette entreprise ?")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/entreprises/${id}`, { method: "DELETE" });
      charger();
    } finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e: any) => {
    await fetch(`${API_BASE}/entreprises/${e.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ est_publie: !e.est_publie }),
    });
    charger();
  };

  const updateFocal = (i: number, k: string, v: any) => {
    setFocaux(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  };
  const addFocal    = () => setFocaux(prev => [...prev, { ...EMPTY_FOCAL }]);
  const removeFocal = (i: number) => setFocaux(prev => prev.filter((_, idx) => idx !== i));

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
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>
            Entreprises Installées
          </h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>{total} entreprise{total > 1 ? "s" : ""} au total</p>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #ca631f, #a84e18)",
          color: "#fff", fontWeight: 600, fontSize: 14,
          padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(202,99,31,0.3)",
        }}>
          <Plus size={16} /> Ajouter une entreprise
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20,
          marginBottom: 32, overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #ca631f, #e07a3a)" }} />
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                {editItem ? "Modifier l'entreprise" : "Nouvelle entreprise"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                <X size={15} color="#4a5568" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Section : Identification */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Identification
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Dénomination sociale *</label>
                    <input value={form.nom} onChange={e => update("nom", e.target.value)} placeholder="Nom de l'entreprise" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Forme juridique</label>
                    <select value={form.forme_juridique} onChange={e => update("forme_juridique", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="">— Sélectionner —</option>
                      {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Date de création</label>
                    <input type="date" value={form.date_creation} onChange={e => update("date_creation", e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Section : Localisation */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Localisation
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Pays</label>
                    <input value={form.pays} onChange={e => update("pays", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Région</label>
                    <input value={form.region} onChange={e => update("region", e.target.value)} placeholder="Ex: Dakar" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Département</label>
                    <input value={form.departement} onChange={e => update("departement", e.target.value)} style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Commune</label>
                    <input value={form.commune} onChange={e => update("commune", e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Adresse complète</label>
                  <input value={form.adresse} onChange={e => update("adresse", e.target.value)} placeholder="Adresse physique de l'entreprise" style={inputStyle} />
                </div>
              </div>

              {/* Section : Contact */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Contact
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Téléphone</label>
                    <input value={form.telephone} onChange={e => update("telephone", e.target.value)} placeholder="+221 XX XXX XX XX" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={form.mail} onChange={e => update("mail", e.target.value)} placeholder="contact@entreprise.sn" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Site web</label>
                    <input value={form.siteweb} onChange={e => update("siteweb", e.target.value)} placeholder="https://..." style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Section : Classification NAEMA */}
<div>
  <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
    Classification NAEMA
  </p>
  <NaemaCascadeMulti
    onChange={({ secteurs, branches, activites }) => {
      update("secteurs", secteurs);
      update("branches", branches);
      update("activites", activites);
    }}
  />
</div>

              {/* Section : Points focaux */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Points focaux
                  </p>
                  <button onClick={addFocal} style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
                    color: "#ca631f", background: "rgba(202,99,31,0.08)", border: "none",
                    borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  }}>
                    <Plus size={12} /> Ajouter un contact
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {focaux.map((pf, i) => (
                    <div key={i} style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <User size={13} style={{ color: "#ca631f" }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Contact {i + 1}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4a5568", cursor: "pointer" }}>
                            <input type="checkbox" checked={pf.est_principal} onChange={e => updateFocal(i, "est_principal", e.target.checked)} />
                            Principal
                          </label>
                          {focaux.length > 1 && (
                            <button onClick={() => removeFocal(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                              <Trash size={13} style={{ color: "#dc2626" }} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                        <div style={fieldStyle}>
                          <label style={labelStyle}>Nom *</label>
                          <input value={pf.nom} onChange={e => updateFocal(i, "nom", e.target.value)} placeholder="Nom" style={inputStyle} />
                        </div>
                        <div style={fieldStyle}>
                          <label style={labelStyle}>Prénom</label>
                          <input value={pf.prenom} onChange={e => updateFocal(i, "prenom", e.target.value)} placeholder="Prénom" style={inputStyle} />
                        </div>
                        <div style={fieldStyle}>
                          <label style={labelStyle}>Poste</label>
                          <input value={pf.poste} onChange={e => updateFocal(i, "poste", e.target.value)} placeholder="DG, Directeur..." style={inputStyle} />
                        </div>
                        <div style={fieldStyle}>
                          <label style={labelStyle}>Téléphone</label>
                          <input value={pf.telephone} onChange={e => updateFocal(i, "telephone", e.target.value)} placeholder="+221..." style={inputStyle} />
                        </div>
                        <div style={fieldStyle}>
                          <label style={labelStyle}>Email</label>
                          <input value={pf.mail} onChange={e => updateFocal(i, "mail", e.target.value)} placeholder="email@..." style={inputStyle} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statut + Publié + Note */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Statut</label>
                  <select value={form.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="actif">Active</option>
                    <option value="inactif">Inactive</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Note interne</label>
                  <input value={form.note_interne} onChange={e => update("note_interne", e.target.value)} placeholder="Note visible uniquement en admin" style={inputStyle} />
                </div>
              </div>

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
                  background: saveOk ? "#dcfce7" : "linear-gradient(135deg, #ca631f, #a84e18)",
                  color: saveOk ? "#15803d" : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {saveOk ? <><Check size={14} /> Enregistré !</> :
                   saving  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> :
                   editItem ? "Modifier" : "Créer l'entreprise"}
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
            Liste des entreprises
          </h2>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{total} résultat{total > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, gap: 10, color: "#9aa5b4" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : entreprises.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9aa5b4" }}>
            <Building2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#4a5568" }}>Aucune entreprise</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Cliquez sur "Ajouter une entreprise" pour commencer.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8F7F6" }}>
                  {["Entreprise","Forme juridique","Localisation","Secteur","Statut","Publié","Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entreprises.map((e, i) => (
                  <tr key={e.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                    <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3, marginBottom: 2 }}>
                        {e.nom.length > 35 ? e.nom.slice(0, 35) + "…" : e.nom}
                      </div>
                      {e.mail && <div style={{ fontSize: 11, color: "#9aa5b4" }}>{e.mail}</div>}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                      {e.forme_juridique || "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                      {[e.commune, e.region].filter(Boolean).join(", ") || e.pays || "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {e.secteur ? (
                        <span style={{ fontSize: 11, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "2px 8px", borderRadius: 999 }}>
                          {e.secteur.nom}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                        background: e.statut === "actif" ? "#dcfce7" : "#f3f4f6",
                        color: e.statut === "actif" ? "#15803d" : "#6b7280",
                      }}>
                        {e.statut === "actif" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={() => handleTogglePublie(e)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        {e.est_publie
                          ? <Eye size={16} style={{ color: "#15803d" }} />
                          : <EyeOff size={16} style={{ color: "#9aa5b4" }} />
                        }
                      </button>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(e)} style={{ background: "rgba(202,99,31,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                          <Pencil size={13} style={{ color: "#ca631f" }} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                          {deleting === e.id
                            ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                            : <Trash2 size={13} style={{ color: "#dc2626" }} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
