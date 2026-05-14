"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, Calendar } from "lucide-react";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TYPES = ["salon","forum","conference","mission_prospection","roadshow","b2b","webinaire","visite_terrain","autre"];
const TYPE_LABELS: Record<string,string> = {
  salon:"Salon", forum:"Forum", conference:"Conférence",
  mission_prospection:"Mission", roadshow:"Roadshow",
  b2b:"B2B", webinaire:"Webinaire", visite_terrain:"Terrain", autre:"Autre",
};
const STATUTS = ["planifie","en_cours","termine","annule","reporte"];
const STATUT_LABELS: Record<string,string> = {
  planifie:"Planifié", en_cours:"En cours", termine:"Terminé", annule:"Annulé", reporte:"Reporté",
};
const STATUT_COLORS: Record<string,{bg:string;text:string}> = {
  planifie:  {bg:"#dbeafe",text:"#1d4ed8"},
  en_cours:  {bg:"#dcfce7",text:"#15803d"},
  termine:   {bg:"#f3f4f6",text:"#6b7280"},
  annule:    {bg:"#fee2e2",text:"#dc2626"},
  reporte:   {bg:"#fef9c3",text:"#a16207"},
};

const EMPTY_FORM = {
  nom_event:"", edition:"", type_evenement:"forum", organisateur:"",
  role_apix:"", description:"", lien_site_officiel:"",
  date_debut:"", date_fin:"", est_recurrent:false, frequence:"",
  pays_nom:"", ville:"", lieu_nom:"", est_virtuel:false, lien_virtuel:"",
  thematiques:"", pays_invites:"", entreprises_invitees:"",
  nombre_participants:"", nombre_prospects_rencontres:"", montant_intentions_usd:"",
  statut:"planifie", est_publie:true, note_interne:"",
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
      // Admin voit tout — on bypass est_publie via per_page large
      const res = await fetch(`${API_BASE}/evenements?per_page=100`);
      const data = await res.json();
      setEvenements(data.data || []);
      setTotal(data.total || 0);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setEditItem(null); setShowForm(true); setError(""); setSaveOk(false); };
  const openEdit   = (e: any) => {
    setForm({
      nom_event: e.nom_event || "", edition: e.edition || "",
      type_evenement: e.type_evenement || "forum",
      organisateur: e.organisateur || "", role_apix: e.role_apix || "",
      description: e.description || "", lien_site_officiel: e.lien_site_officiel || "",
      date_debut: e.date_debut || "", date_fin: e.date_fin || "",
      est_recurrent: e.est_recurrent || false, frequence: e.frequence || "",
      pays_nom: e.pays_nom || "", ville: e.ville || "", lieu_nom: e.lieu_nom || "",
      est_virtuel: e.est_virtuel || false, lien_virtuel: e.lien_virtuel || "",
      thematiques: e.thematiques || "", pays_invites: e.pays_invites || "",
      entreprises_invitees: e.entreprises_invitees || "",
      nombre_participants: e.nombre_participants || "",
      nombre_prospects_rencontres: e.nombre_prospects_rencontres || "",
      montant_intentions_usd: e.montant_intentions_usd || "",
      statut: e.statut || "planifie", est_publie: e.est_publie ?? true,
      note_interne: e.note_interne || "",
    });
    setEditItem(e); setShowForm(true); setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!form.nom_event.trim()) { setError("Le nom est obligatoire"); return; }
    if (!form.date_debut)       { setError("La date de début est obligatoire"); return; }
    if (!form.date_fin)         { setError("La date de fin est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = { ...form };
      if (payload.nombre_participants       === "") delete payload.nombre_participants;
      if (payload.nombre_prospects_rencontres === "") delete payload.nombre_prospects_rencontres;
      if (payload.montant_intentions_usd    === "") delete payload.montant_intentions_usd;

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
    try {
      await api.evenements.supprimer(id);
      charger();
    } finally { setDeleting(null); }
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

      {/* Header page */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>
            Événements
          </h1>
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
        <div style={{
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20,
          marginBottom: 32, overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
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
                  <label style={labelStyle}>Édition</label>
                  <input value={form.edition} onChange={e => update("edition", e.target.value)} placeholder="Ex: 5ème édition" style={inputStyle} />
                </div>
              </div>

              {/* Type + Statut + Rôle APIX */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Type *</label>
                  <select value={form.type_evenement} onChange={e => update("type_evenement", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Statut</label>
                  <select value={form.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Rôle APIX</label>
                  <select value={form.role_apix} onChange={e => update("role_apix", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">— Sélectionner —</option>
                    {["organisateur","co_organisateur","participant","sponsor","invite"].map(r => (
                      <option key={r} value={r}>{r.replace("_"," ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date de début *</label>
                  <input type="date" value={form.date_debut} onChange={e => update("date_debut", e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date de fin *</label>
                  <input type="date" value={form.date_fin} onChange={e => update("date_fin", e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Lieu */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Pays</label>
                  <input value={form.pays_nom} onChange={e => update("pays_nom", e.target.value)} placeholder="Ex: Sénégal" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Ville</label>
                  <input value={form.ville} onChange={e => update("ville", e.target.value)} placeholder="Ex: Dakar" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Lieu / Salle</label>
                  <input value={form.lieu_nom} onChange={e => update("lieu_nom", e.target.value)} placeholder="Ex: CICAD" style={inputStyle} />
                </div>
              </div>

              {/* Organisateur */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Organisateur</label>
                <input value={form.organisateur} onChange={e => update("organisateur", e.target.value)} placeholder="Nom de l'organisateur" style={inputStyle} />
              </div>

              {/* Thématiques / Pays / Entreprises */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Thématiques <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(virgules)</span></label>
                  <input value={form.thematiques} onChange={e => update("thematiques", e.target.value)} placeholder="Agriculture, Énergie..." style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Pays invités <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(virgules)</span></label>
                  <input value={form.pays_invites} onChange={e => update("pays_invites", e.target.value)} placeholder="France, Maroc..." style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Entreprises invitées <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(virgules)</span></label>
                  <input value={form.entreprises_invitees} onChange={e => update("entreprises_invitees", e.target.value)} placeholder="TotalEnergies..." style={inputStyle} />
                </div>
              </div>

              {/* Description */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} placeholder="Description de l'événement..." style={{ ...inputStyle, resize: "vertical" as const }} />
              </div>

              {/* Résultats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nb participants</label>
                  <input type="number" value={form.nombre_participants} onChange={e => update("nombre_participants", e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nb prospects rencontrés</label>
                  <input type="number" value={form.nombre_prospects_rencontres} onChange={e => update("nombre_prospects_rencontres", e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Intentions (USD)</label>
                  <input type="number" value={form.montant_intentions_usd} onChange={e => update("montant_intentions_usd", e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Lien + Note interne */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Lien site officiel</label>
                  <input value={form.lien_site_officiel} onChange={e => update("lien_site_officiel", e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Note interne</label>
                  <input value={form.note_interne} onChange={e => update("note_interne", e.target.value)} placeholder="Note visible uniquement en admin" style={inputStyle} />
                </div>
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

              {/* Boutons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowForm(false)} style={{
                  padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB",
                  background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Annuler</button>
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
          <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>
            Liste des événements
          </h2>
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
            <p style={{ fontSize: 13, marginTop: 4 }}>Cliquez sur "Ajouter un événement" pour commencer.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8F7F6" }}>
                  {["Événement","Type","Dates","Lieu","Statut","Publié","Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evenements.map((e, i) => {
                  const statut = STATUT_COLORS[e.statut] || STATUT_COLORS.planifie;
                  return (
                    <tr key={e.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                      <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3, marginBottom: 2 }}>
                          {e.nom_event.length > 40 ? e.nom_event.slice(0, 40) + "…" : e.nom_event}
                        </div>
                        {e.edition && <div style={{ fontSize: 11, color: "#9aa5b4" }}>{e.edition}</div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "2px 8px", borderRadius: 999 }}>
                          {TYPE_LABELS[e.type_evenement] || e.type_evenement}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568", whiteSpace: "nowrap" }}>
                        {new Date(e.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {e.date_debut !== e.date_fin && (
                          <div style={{ fontSize: 11, color: "#9aa5b4" }}>
                            → {new Date(e.date_fin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                        {[e.ville, e.pays_nom].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: statut.bg, color: statut.text, padding: "3px 10px", borderRadius: 999 }}>
                          {STATUT_LABELS[e.statut] || e.statut}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={() => handleTogglePublie(e)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                          title={e.est_publie ? "Dépublier" : "Publier"}
                        >
                          {e.est_publie
                            ? <Eye size={16} style={{ color: "#15803d" }} />
                            : <EyeOff size={16} style={{ color: "#9aa5b4" }} />
                          }
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => openEdit(e)}
                            style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px", display: "flex", alignItems: "center" }}
                            title="Modifier"
                          >
                            <Pencil size={13} style={{ color: "#004f91" }} />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting === e.id}
                            style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px", display: "flex", alignItems: "center" }}
                            title="Supprimer"
                          >
                            {deleting === e.id
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
