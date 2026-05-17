"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import PaysSelect from "@/components/shared/PaysSelect";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Affiche une date YYYY-MM-DD sans décalage UTC (évite le -1 jour en heure locale)
function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day); // constructeur local, pas UTC
  return d.toLocaleDateString("fr-FR", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

// Retourne "1ère", "2ème", "3ème", etc.
function ordinalEdition(n: number): string {
  return n === 1 ? "1ère édition" : `${n}ème édition`;
}

const TYPES = ["salon","forum","conference","mission_prospection","roadshow","b2b","webinaire","visite_terrain","autre"];
const TYPE_LABELS: Record<string,string> = {
  salon:"Salon", forum:"Forum", conference:"Conférence",
  mission_prospection:"Mission de prospection", roadshow:"Roadshow",
  b2b:"B2B", webinaire:"Webinaire", visite_terrain:"Visite terrain", autre:"Autre",
};

const ROLES_APIX = [
  { value: "organisateur",    label: "Organisateur"     },
  { value: "co_organisateur", label: "Co-organisateur"  },
  { value: "participant",     label: "Participant"       },
  { value: "sponsor",         label: "Sponsor"          },
  { value: "invite",          label: "Invité"           },
];

const STATUT_COLORS: Record<string,{bg:string;text:string}> = {
  planifie:  {bg:"#dbeafe",text:"#1d4ed8"},
  en_cours:  {bg:"#dcfce7",text:"#15803d"},
  termine:   {bg:"#f3f4f6",text:"#6b7280"},
  annule:    {bg:"#fee2e2",text:"#dc2626"},
  reporte:   {bg:"#fef9c3",text:"#a16207"},
};

const STATUT_LABELS: Record<string,string> = {
  planifie:"Planifié", en_cours:"En cours", termine:"Terminé", annule:"Annulé", reporte:"Reporté",
};

const EMPTY_FORM = {
  nom_event:"", edition: "" as string, type_evenement:"forum", type_autre:"",
  organisateur:"", role_apix:"", description:"",
  date_unique: true,
  date_debut:"", date_fin:"",
  pays_hote_id: "" as string | number, pays_hote_nom: "",
  ville:"",
  est_virtuel: false, lien_virtuel:"",
  thematiques_naema:"", pays_invites:"", entreprises_invitees:"",
  est_publie: true,
};

export default function AdminEvenements() {
  const [evenements, setEvenements] = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [error,      setError]      = useState("");
  const [form,       setForm]       = useState<any>({ ...EMPTY_FORM });
  const [deleting,   setDeleting]   = useState<string|null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/evenements/admin?per_page=100`);
      const data = await res.json();
      setEvenements(data.data || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditItem(null); setShowForm(true); setError(""); setSaveOk(false);
  };

  const openEdit = (e: any) => {
    const isSameDay = e.date_debut === e.date_fin;
    setForm({
      nom_event:    e.nom_event    || "",
      edition:      e.edition != null ? String(e.edition) : "",
      type_evenement: e.type_evenement || "forum",
      type_autre:   TYPES.includes(e.type_evenement) ? "" : e.type_evenement,
      organisateur: e.organisateur || "",
      role_apix:    e.role_apix    || "",
      description:  e.description  || "",
      date_unique:  isSameDay,
      date_debut:   e.date_debut   || "",
      date_fin:     e.date_fin     || "",
      pays_hote_id: e.pays_hote_id  || "",
      pays_hote_nom:e.pays_hote_nom  || "",
      ville:        e.ville        || "",
      est_virtuel:  e.est_virtuel  || false,
      lien_virtuel: e.lien_virtuel || "",
      thematiques_naema: e.thematiques_naema || "",
      pays_invites: e.pays_invites || "",
      entreprises_invitees: e.entreprises_invitees || "",
      est_publie:   e.est_publie   ?? true,
    });
    setEditItem(e); setShowForm(true); setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!form.nom_event.trim()) { setError("Le nom est obligatoire"); return; }
    if (!form.date_debut)       { setError("La date est obligatoire"); return; }

    // Validation édition : doit être un entier > 0 si renseignée
    let editionInt: number | null = null;
    if (form.edition !== "") {
      const parsed = parseInt(form.edition, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setError("L'édition doit être un nombre entier supérieur à 0 (ex : 1, 5, 12)");
        return;
      }
      editionInt = parsed;
    }

    // Validation date
    const dateDebut = new Date(form.date_debut);
    const dateFin   = form.date_unique ? dateDebut : new Date(form.date_fin);

    if (!form.date_unique && !form.date_fin) {
      setError("La date de fin est obligatoire"); return;
    }
    if (!form.date_unique && dateFin <= dateDebut) {
      setError("La date de fin doit être strictement après la date de début"); return;
    }

    setSaving(true); setError("");
    try {
      const typeEvenement = form.type_evenement === "autre" ? (form.type_autre || "autre") : form.type_evenement;
      const payload: any = {
        nom_event:    form.nom_event,
        edition:      editionInt,
        type_evenement: typeEvenement,
        organisateur: form.organisateur || null,
        role_apix:    form.role_apix    || null,
        description:  form.description  || null,
        date_debut:   form.date_debut,
        date_fin:     form.date_unique ? form.date_debut : form.date_fin,
        pays_hote_id: form.pays_hote_id ? parseInt(String(form.pays_hote_id)) : null,
        ville:        form.ville        || null,
        est_virtuel:  form.est_virtuel,
        lien_virtuel: form.lien_virtuel || null,
        thematiques_naema:    form.thematiques_naema  || null,
        pays_invites: form.pays_invites || null,
        entreprises_invitees: form.entreprises_invitees || null,
        statut:       "planifie",
        est_publie:   form.est_publie,
      };

      if (editItem) {
        await api.evenements.modifier(editItem.id, payload);
      } else {
        await fetch(`${API_BASE}/evenements`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSaveOk(true);
      setTimeout(() => { setShowForm(false); charger(); }, 1000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet événement ?")) return;
    setDeleting(id);
    try { await api.evenements.supprimer(id); charger(); }
    finally { setDeleting(null); }
  };

  const handleTogglePublie = async (e: any) => {
    await api.evenements.modifier(e.id, { est_publie: !e.est_publie });
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
          <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Événements</h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>{total} événement{total > 1 ? "s" : ""} au total</p>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #004f91, #003a6e)",
          color: "#fff", fontWeight: 600, fontSize: 14,
          padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,79,145,0.3)",
        }}>
          <Plus size={16} /> Ajouter un événement
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20, marginBottom: 32, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #004f91, #1a6ab0)" }} />
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                {editItem ? "Modifier l'événement" : "Nouvel événement"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                <X size={15} color="#4a5568" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Nom + Edition */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nom de l'événement *</label>
                  <input value={form.nom_event} onChange={e => update("nom_event", e.target.value)} placeholder="Intitulé de l'événement" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    Édition
                    <span style={{ fontWeight: 400, color: "#9aa5b4", marginLeft: 4 }}>(entier &gt; 0)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.edition}
                    onChange={e => {
                      const raw = e.target.value;
                      // Bloquer les décimales et les négatifs à la frappe
                      if (raw === "" || /^[1-9][0-9]*$/.test(raw)) {
                        update("edition", raw);
                      }
                    }}
                    onKeyDown={e => {
                      // Bloquer e, +, -, . et ,
                      if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Ex : 5"
                    style={{
                      ...inputStyle,
                      borderColor: form.edition !== "" && (isNaN(parseInt(form.edition)) || parseInt(form.edition) <= 0)
                        ? "#dc2626"
                        : "#C5BFBB",
                    }}
                  />
                  {form.edition !== "" && (isNaN(parseInt(form.edition)) || parseInt(form.edition) <= 0) && (
                    <span style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                      Entier positif requis (1, 2, 3…)
                    </span>
                  )}
                  {form.edition !== "" && parseInt(form.edition) > 0 && (
                    <span style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>
                      {ordinalEdition(parseInt(form.edition))}
                    </span>
                  )}
                </div>
              </div>

              {/* Type + Rôle APIX */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Type *</label>
                  <select value={form.type_evenement} onChange={e => update("type_evenement", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                  {form.type_evenement === "autre" && (
                    <input
                      value={form.type_autre}
                      onChange={e => update("type_autre", e.target.value)}
                      placeholder="Précisez le type..."
                      style={{ ...inputStyle, marginTop: 6 }}
                    />
                  )}
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Rôle APIX</label>
                  <select value={form.role_apix} onChange={e => update("role_apix", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">— Sélectionner —</option>
                    {ROLES_APIX.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: "16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Dates
                </p>

                {/* Toggle date unique / plage */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { val: true,  label: "Date unique"              },
                    { val: false, label: "Sur plusieurs jours"      },
                  ].map(opt => (
                    <button
                      key={String(opt.val)}
                      onClick={() => { update("date_unique", opt.val); if (opt.val) update("date_fin", ""); }}
                      style={{
                        padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: form.date_unique === opt.val ? "#004f91" : "#E8E5E3",
                        color:      form.date_unique === opt.val ? "#fff"    : "#4a5568",
                        transition: "all 0.2s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {form.date_unique ? (
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" value={form.date_debut} onChange={e => update("date_debut", e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} />
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Date de début *</label>
                      <input type="date" value={form.date_debut} onChange={e => update("date_debut", e.target.value)} style={inputStyle} />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Date de fin * <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(après le début)</span></label>
                      <input
                        type="date"
                        value={form.date_fin}
                        min={form.date_debut || undefined}
                        onChange={e => update("date_fin", e.target.value)}
                        style={{
                          ...inputStyle,
                          borderColor: form.date_fin && form.date_fin <= form.date_debut ? "#dc2626" : "#C5BFBB",
                        }}
                      />
                      {form.date_fin && form.date_fin <= form.date_debut && (
                        <span style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
                          La date de fin doit être après la date de début
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Lieu */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Pays hôte</label>
                  <PaysSelect
                    value={form.pays_hote_nom}
                    onChange={nom => update("pays_hote_nom", nom)}
                    onChangeId={id => update("pays_hote_id", id || "")}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Ville</label>
                  <input value={form.ville} onChange={e => update("ville", e.target.value)} placeholder="Ex: Dakar" style={inputStyle} />
                </div>
              </div>

              {/* Virtuel */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#4a5568" }}>
                <input type="checkbox" checked={form.est_virtuel} onChange={e => update("est_virtuel", e.target.checked)} style={{ width: 16, height: 16 }} />
                Événement virtuel / en ligne
              </label>
              {form.est_virtuel && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Lien de connexion</label>
                  <input value={form.lien_virtuel} onChange={e => update("lien_virtuel", e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
              )}

              {/* Organisateur */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Organisateur</label>
                <input value={form.organisateur} onChange={e => update("organisateur", e.target.value)} placeholder="Nom de l'organisateur" style={inputStyle} />
              </div>

              {/* Thématiques */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Thématiques</label>
                <ThematiquesNaema
                  value={form.thematiques_naema}
                  onChange={val => update("thematiques_naema", val)}
                />
              </div>

              {/* Pays invités / Entreprises invitées */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Pays invités <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(séparés par des virgules)</span></label>
                  <PaysMultiSelect
                    value={form.pays_invites}
                    onChange={val => update("pays_invites", val)}
                    placeholder="Sélectionner les pays invités"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Entreprises invitées <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(séparés par des virgules)</span></label>
                  <input value={form.entreprises_invitees} onChange={e => update("entreprises_invitees", e.target.value)} placeholder="TotalEnergies, Orange..." style={inputStyle} />
                </div>
              </div>

              {/* Description */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} placeholder="Description de l'événement..." style={{ ...inputStyle, resize: "vertical" as const }} />
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
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || saveOk} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: saveOk ? "#dcfce7" : "linear-gradient(135deg, #004f91, #003a6e)",
                  color: saveOk ? "#15803d" : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {saveOk ? <><Check size={14} /> Enregistré !</> :
                   saving  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> :
                   editItem ? "Modifier" : "Créer l'événement"}
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
          <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>Liste des événements</h2>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{total} résultat{total > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, gap: 10, color: "#9aa5b4" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Chargement...</span>
          </div>
        ) : evenements.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9aa5b4" }}>
            <Calendar size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#4a5568" }}>Aucun événement</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8F7F6" }}>
                  {["Événement","Type","Dates","Lieu","Publié","Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evenements.map((e, i) => (
                  <tr key={e.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                    <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3, marginBottom: 2 }}>
                        {e.nom_event.length > 40 ? e.nom_event.slice(0, 40) + "…" : e.nom_event}
                      </div>
                      {e.edition != null && <div style={{ fontSize: 11, color: "#9aa5b4" }}>{ordinalEdition(e.edition)}</div>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "2px 8px", borderRadius: 999 }}>
                        {TYPE_LABELS[e.type_evenement] || e.type_evenement}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                      {formatDate(e.date_debut)}
                      {e.date_debut !== e.date_fin && (
                        <div style={{ fontSize: 11, color: "#9aa5b4" }}>
                          → {formatDate(e.date_fin, { day: "numeric", month: "short" })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                      {[e.ville, e.pays_hote_nom].filter(Boolean).join(", ") || "—"}
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
                        <button onClick={() => openEdit(e)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                          <Pencil size={13} style={{ color: "#004f91" }} />
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
