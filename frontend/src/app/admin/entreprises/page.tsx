"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, Building2, User, Trash } from "lucide-react";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import PaysSelect from "@/components/shared/PaysSelect";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const FORMES_JURIDIQUES = [
  "Société en nom collectif (SNC)",
  "Société en commandite simple (SCS)",
  "Société à responsabilité limitée (SARL)",
  "Société Anonyme (SA)",
  "Société par actions simplifiée (SAS)",
  "Société par actions simplifiée unipersonnelle (SASU)",
  "Société à responsabilité limitée unipersonnelle (SARLU)",
  "Société en participation",
  "Groupement d'intérêt économique (GIE)",
  "Coopérative simplifiée",
  "Coopérative avec conseil d'administration",
  "Entreprise individuelle",
  "Succursale",
  "Bureau de liaison",
];

// Validation numéro sénégalais : +221 suivi de 9 chiffres
// Mobile : +221 7X XXX XX XX
// Fixe   : +221 3X XXX XX XX
function validatePhone(val: string): boolean {
  if (!val) return true; // optionnel sauf si requis
  const cleaned = val.replace(/\s/g, "");
  return /^\+221[37]\d{8}$/.test(cleaned);
}

function formatPhoneDisplay(val: string): string {
  const cleaned = val.replace(/\s/g, "").replace(/[^+\d]/g, "");
  return cleaned;
}

const EMPTY_FORM = {
  nom: "", forme_juridique: "", date_creation: "",
  siege_pays_id: "" as string | number,
  pays: "Sénégal",
  region_id: "" as string | number, departement_id: "" as string | number, arrondissement_id: "" as string | number,
  adresse: "",
  telephone: "", mail: "", siteweb: "",
  thematiques: "",
  secteur_id: "", branche_id: "", activite_id: "",
  secteur_nom: "", branche_nom: "", activite_nom: "",
  statut: "actif", est_publie: true,
};

const EMPTY_FOCAL = { civilite: "Monsieur", nom: "", prenom: "", poste: "", telephone: "", mail: "", est_principal: false };

export default function AdminEntreprises() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editItem,    setEditItem]    = useState<any>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [errors,      setErrors]      = useState<Record<string,string>>({});
  const [form,        setForm]        = useState<any>({ ...EMPTY_FORM });
  const [focaux,      setFocaux]      = useState<any[]>([{ ...EMPTY_FOCAL }]);
  const [deleting,    setDeleting]    = useState<string|null>(null);

  // IDs pour les cascades géographiques
  const [regionId,      setRegionId]      = useState<number|null>(null);
  const [departementId, setDepartementId] = useState<number|null>(null);
  const [siegePaysNom,  setSiegePaysNom]  = useState("");

  // IDs pour NAEMA (nécessaires pour les selects cascades)
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

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string,string> = {};
    if (!form.nom.trim())             e.nom             = "Obligatoire";
    if (!form.forme_juridique)        e.forme_juridique = "Obligatoire";
    if (!form.date_creation)          e.date_creation   = "Obligatoire";
    else if (form.date_creation > new Date().toISOString().split("T")[0]) e.date_creation = "La date ne peut pas être dans le futur";
    // region non obligatoire pour l'instant
    // departement non obligatoire pour l'instant
    if (!form.adresse.trim())         e.adresse         = "Obligatoire";
    if (!form.telephone)              e.telephone       = "Obligatoire";
    else if (!validatePhone(form.telephone)) e.telephone = "Format invalide (+221 suivi de 9 chiffres)";
    if (!form.mail.trim())            e.mail            = "Obligatoire";
    else if (!/\S+@\S+\.\S+/.test(form.mail)) e.mail   = "Email invalide";
    if (!form.secteur_nom)            e.secteur_id      = "Obligatoire";
    if (!form.branche_nom)            e.branche_id      = "Obligatoire";
    if (!form.activite_nom)           e.activite_id     = "Obligatoire";

    // Valider points focaux obligatoires
    focaux.forEach((pf, i) => {
      if (!pf.nom.trim())    e[`focal_nom_${i}`]    = "Obligatoire";
      if (!pf.prenom.trim()) e[`focal_prenom_${i}`] = "Obligatoire";
      if (!pf.telephone)     e[`focal_tel_${i}`]    = "Obligatoire";
      else if (!validatePhone(pf.telephone)) e[`focal_tel_${i}`] = "Format invalide (+221...)";
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFocaux([{ ...EMPTY_FOCAL }]);
    setRegionId(null); setDepartementId(null);
    setEditItem(null); setShowForm(true); setErrors({}); setSaveOk(false);
  };

  const openEdit = (e: any) => {
    // Reconstruire thematiques depuis les objets secteur/branche/activite
    const thematiquesVal = [
      e.secteur?.nom  ? `sec:${e.secteur.nom}`  : "",
      e.branche?.nom  ? `bra:${e.branche.nom}`  : "",
      e.activite?.nom ? `act:${e.activite.nom}` : "",
    ].filter(Boolean).join(", ");

    setForm({
      nom:              e.nom              || "",
      forme_juridique:  e.forme_juridique  || "",
      date_creation:    e.date_creation    || "",
      siege_pays_id:    e.siege_pays_id    || "",
      pays:             "Sénégal",
      region_id:        e.region_id        || "",
      departement_id:   e.departement_id   || "",
      arrondissement_id:e.arrondissement_id|| "",
      adresse:          e.adresse          || "",
      telephone:        e.telephone        || "",
      mail:             e.mail             || "",
      siteweb:          e.siteweb          || "",
      thematiques:      thematiquesVal,
      secteur_id:       e.secteur?.id?.toString()  || "",
      secteur_nom:      e.secteur?.nom             || "",
      branche_id:       e.branche?.id?.toString()  || "",
      branche_nom:      e.branche?.nom             || "",
      activite_id:      e.activite?.id?.toString() || "",
      activite_nom:     e.activite?.nom            || "",
      statut:           e.statut           || "actif",
      est_publie:       e.est_publie       ?? true,
    });
    setFocaux(e.points_focaux?.length > 0
      ? e.points_focaux.map((pf: any) => ({
          civilite:     pf.civilite    || "Monsieur",
          nom:          pf.nom         || "",
          prenom:       pf.prenom      || "",
          poste:        pf.poste       || "",
          telephone:    pf.telephone   || "",
          mail:         pf.mail        || "",
          est_principal: pf.est_principal || false,
        }))
      : [{ ...EMPTY_FOCAL }]
    );
    setEditItem(e); setShowForm(true); setErrors({}); setSaveOk(false);

    // Initialiser les IDs géo pour que les cascades fonctionnent
    if (e.region_id) {
      setRegionId(e.region_id);
      if (e.departement_id) setDepartementId(e.departement_id);
    }
    setSiegePaysNom(e.siege_pays_nom || "");
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Résoudre les noms NAEMA en IDs depuis les référentiels
      const [allSecteurs, allBranches, allActivites] = await Promise.all([
        fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
      ]);
      const secteur  = allSecteurs.find((s: any) => s.nom === form.secteur_nom);
      const branche  = allBranches.find((b: any) => b.nom === form.branche_nom);
      const activite = allActivites.find((a: any) => a.nom === form.activite_nom);

      const payload: any = { ...form };
      payload.secteur_id  = secteur?.id  || null;
      payload.branche_id  = branche?.id  || null;
      payload.activite_id = activite?.id || null;
      // IDs geo — déjà dans le form, s'assurer qu'ils sont des entiers
      if (payload.region_id)         payload.region_id         = parseInt(payload.region_id)         || null;
      if (payload.departement_id)    payload.departement_id    = parseInt(payload.departement_id)    || null;
      if (payload.arrondissement_id) payload.arrondissement_id = parseInt(payload.arrondissement_id) || null;
      // Nettoyer les champs non nécessaires pour le backend
      delete payload.thematiques;
      delete payload.secteur_nom;
      delete payload.branche_nom;
      delete payload.activite_nom;
      // Convertir les IDs en entiers
      if (payload.siege_pays_id)     payload.siege_pays_id     = parseInt(payload.siege_pays_id)     || null;
      if (payload.region_id)         payload.region_id         = parseInt(payload.region_id)         || null;
      if (payload.departement_id)    payload.departement_id    = parseInt(payload.departement_id)    || null;
      if (payload.arrondissement_id) payload.arrondissement_id = parseInt(payload.arrondissement_id) || null;
      // Nettoyer les champs vides
      Object.keys(payload).forEach(k => { if (payload[k] === "" || payload[k] === 0) payload[k] = null; });
      payload.pays = "Sénégal";

      const pf = focaux.filter(f => f.nom.trim()).map(f => ({
        civilite: f.civilite || "Monsieur",
        nom: f.nom, prenom: f.prenom, poste: f.poste,
        telephone: f.telephone, mail: f.mail, est_principal: f.est_principal,
      }));
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
      setErrors({ global: e.message || "Erreur lors de la sauvegarde" });
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

  const updateFocal  = (i: number, k: string, v: any) =>
    setFocaux(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  const addFocal    = () => setFocaux(prev => [...prev, { ...EMPTY_FOCAL }]);
  const removeFocal = (i: number) => setFocaux(prev => prev.filter((_, idx) => idx !== i));

  const inputStyle = (field?: string) => ({
    width: "100%", background: "#F2F0EF",
    border: `1px solid ${field && errors[field] ? "#dc2626" : "#C5BFBB"}`,
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  });
  const labelStyle = (field?: string) => ({
    fontSize: 12, fontWeight: 600,
    color: field && errors[field] ? "#dc2626" : "#4a5568",
    marginBottom: 4, display: "block",
  });
  const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 3 };
  const errMsg = (field: string) => errors[field]
    ? <span style={{ fontSize: 11, color: "#dc2626" }}>{errors[field]}</span>
    : null;

  const sectionTitle = (title: string, color = "#ca631f") => (
    <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 12 }}>
      {title}
    </p>
  );

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
        <div style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20, marginBottom: 32, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
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

              {/* ── Identification ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {sectionTitle("Identification")}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle("nom")}>Dénomination sociale *</label>
                    <input value={form.nom} onChange={e => update("nom", e.target.value)} placeholder="Nom de l'entreprise" style={inputStyle("nom")} />
                    {errMsg("nom")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle("forme_juridique")}>Forme juridique *</label>
                    <select
                      value={form.forme_juridique}
                      onChange={e => update("forme_juridique", e.target.value)}
                      style={{ ...inputStyle("forme_juridique"), cursor: "pointer" }}
                    >
                      <option value="">— Sélectionner —</option>
                      {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {errMsg("forme_juridique")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle("date_creation")}>Date de création *</label>
                    <input type="date" value={form.date_creation} onChange={e => update("date_creation", e.target.value)} style={inputStyle("date_creation")} />
                    {errMsg("date_creation")}
                  </div>
                </div>
              </div>

              {/* ── Siège social ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {sectionTitle("Siège social")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle()}>Pays du siège social</label>
                    <PaysSelect
                      value={siegePaysNom}
                      onChange={nom => setSiegePaysNom(nom)}
                      onChangeId={id => update("siege_pays_id", id || "")}
                      placeholder="Pays du siège social"
                      excludeNoms={["Sénégal"]}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle()}>Pays d'installation</label>
                    <input
                      value="Sénégal"
                      disabled
                      style={{ ...inputStyle(), opacity: 0.6, cursor: "not-allowed", background: "#E8E5E3" }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Localisation au Sénégal ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {sectionTitle("Localisation au Sénégal")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle("region_id")}>Région *</label>
                    <RegionSelect
                      value={form.region_id}
                      required
                      onChange={(id, nom) => {
                        update("region_id", id || "");
                        update("departement_id", "");
                        update("arrondissement_id", "");
                        setRegionId(id);
                        setDepartementId(null);
                      }}
                    />
                    {errMsg("region_id")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle("departement_id")}>Département *</label>
                    <DepartementSelect
                      regionId={regionId}
                      value={form.departement_id}
                      required
                      onChange={(id, nom) => {
                        update("departement_id", id || "");
                        update("arrondissement_id", "");
                        setDepartementId(id);
                      }}
                    />
                    {errMsg("departement_id")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle("arrondissement_id")}>Arrondissement</label>
                    <ArrondissementSelect
                      departementId={departementId}
                      value={form.arrondissement_id}
                      onChange={(id, nom) => update("arrondissement_id", id || "")}
                    />
                  </div>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle("adresse")}>Adresse complète *</label>
                  <input value={form.adresse} onChange={e => update("adresse", e.target.value)} placeholder="Adresse physique de l'entreprise" style={inputStyle("adresse")} />
                  {errMsg("adresse")}
                </div>
              </div>

              {/* ── Contact ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {sectionTitle("Contact")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle("telephone")}>Téléphone * <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(+221...)</span></label>
                    <input
                      value={form.telephone}
                      onChange={e => update("telephone", formatPhoneDisplay(e.target.value))}
                      placeholder="+221 7X XXX XX XX"
                      style={inputStyle("telephone")}
                    />
                    {errMsg("telephone")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle("mail")}>Email *</label>
                    <input type="email" value={form.mail} onChange={e => update("mail", e.target.value)} placeholder="contact@entreprise.sn" style={inputStyle("mail")} />
                    {errMsg("mail")}
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle()}>Site web</label>
                    <input value={form.siteweb} onChange={e => update("siteweb", e.target.value)} placeholder="https://..." style={inputStyle()} />
                  </div>
                </div>
              </div>

              {/* ── Thématiques ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {sectionTitle("Thématiques")}
                {(errors.secteur_id || errors.branche_id || errors.activite_id) && (
                  <p style={{ fontSize: 11, color: "#dc2626", marginBottom: 8 }}>
                    Secteur, branche et activité sont obligatoires
                  </p>
                )}
                <ThematiquesNaema
                  value={form.thematiques}
                  onChange={val => {
                    update("thematiques", val);
                    // Extraire les IDs pour la compatibilité avec le backend
                    const items = val.split(",").map((t: string) => t.trim()).filter(Boolean);
                    const secNom = items.find((t: string) => t.startsWith("sec:"))?.slice(4) || "";
                    const braNom = items.find((t: string) => t.startsWith("bra:"))?.slice(4) || "";
                    const actNom = items.find((t: string) => t.startsWith("act:"))?.slice(4) || "";
                    update("secteur_nom", secNom);
                    update("branche_nom", braNom);
                    update("activite_nom", actNom);
                  }}
                />
              </div>

              {/* ── Points focaux ── */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  {sectionTitle("Points focaux")}
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
                    <div key={i} style={{ background: "#fff", border: "1px solid #E8E5E3", borderRadius: 12, padding: "14px 16px" }}>
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
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", marginBottom: 3, display: "block" }}>Civilité</label>
                          <select value={pf.civilite || "Monsieur"} onChange={e => updateFocal(i, "civilite", e.target.value)}
                            style={{ ...inputStyle(), fontSize: 12, cursor: "pointer", minWidth: 110 }}>
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                          </select>
                        </div>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: errors[`focal_nom_${i}`] ? "#dc2626" : "#4a5568", marginBottom: 3, display: "block" }}>Nom *</label>
                          <input value={pf.nom} onChange={e => updateFocal(i, "nom", e.target.value)} placeholder="Nom"
                            style={{ ...inputStyle(), fontSize: 12, borderColor: errors[`focal_nom_${i}`] ? "#dc2626" : "#C5BFBB" }} />
                          {errors[`focal_nom_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`focal_nom_${i}`]}</span>}
                        </div>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: errors[`focal_prenom_${i}`] ? "#dc2626" : "#4a5568", marginBottom: 3, display: "block" }}>Prénom *</label>
                          <input value={pf.prenom} onChange={e => updateFocal(i, "prenom", e.target.value)} placeholder="Prénom"
                            style={{ ...inputStyle(), fontSize: 12, borderColor: errors[`focal_prenom_${i}`] ? "#dc2626" : "#C5BFBB" }} />
                          {errors[`focal_prenom_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`focal_prenom_${i}`]}</span>}
                        </div>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", marginBottom: 3, display: "block" }}>Poste</label>
                          <input value={pf.poste} onChange={e => updateFocal(i, "poste", e.target.value)} placeholder="DG, Dir..."
                            style={{ ...inputStyle(), fontSize: 12 }} />
                        </div>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: errors[`focal_tel_${i}`] ? "#dc2626" : "#4a5568", marginBottom: 3, display: "block" }}>Téléphone *</label>
                          <input value={pf.telephone} onChange={e => updateFocal(i, "telephone", formatPhoneDisplay(e.target.value))} placeholder="+221..."
                            style={{ ...inputStyle(), fontSize: 12, borderColor: errors[`focal_tel_${i}`] ? "#dc2626" : "#C5BFBB" }} />
                          {errors[`focal_tel_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`focal_tel_${i}`]}</span>}
                        </div>
                        <div style={fieldStyle}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", marginBottom: 3, display: "block" }}>Email</label>
                          <input value={pf.mail} onChange={e => updateFocal(i, "mail", e.target.value)} placeholder="email@..."
                            style={{ ...inputStyle(), fontSize: 12 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>



              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#4a5568" }}>
                <input type="checkbox" checked={form.est_publie} onChange={e => update("est_publie", e.target.checked)} style={{ width: 16, height: 16 }} />
                Publier sur le site public
              </label>

              {errors.global && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  {errors.global}
                </div>
              )}

              {Object.keys(errors).filter(k => k !== "global").length > 0 && !errors.global && (
                <div style={{ background: "#fef9c3", color: "#a16207", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  Veuillez corriger les champs obligatoires avant de continuer.
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || saveOk} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: saveOk ? "#dcfce7" : "linear-gradient(135deg, #ca631f, #a84e18)",
                  color: saveOk ? "#15803d" : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {saveOk ? <><Check size={14} /> Enregistré !</> :
                   saving  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> :
                   editItem ? "Modifier" : "Ajouter"}
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
          <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>Liste des entreprises</h2>
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
                    <td style={{ padding: "14px 16px", color: "#4a5568", fontSize: 12 }}>
                      {e.forme_juridique ? e.forme_juridique.split("(")[0].trim() : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                      {[e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ") || "—"}
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
                        color:      e.statut === "actif" ? "#15803d" : "#6b7280",
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
