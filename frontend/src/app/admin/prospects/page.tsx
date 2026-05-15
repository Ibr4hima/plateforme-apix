"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, Building2, User, Trash, ChevronDown, ChevronUp, Clock, MessageSquare, AlertTriangle } from "lucide-react";
import { NaemaCascade } from "@/components/shared/NaemaSelects";
import PaysSelect from "@/components/shared/PaysSelect";
import { RegionSelect, DepartementSelect, ArrondissementSelect } from "@/components/shared/GeoSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const FORMES_JURIDIQUES = [
  "Société en nom collectif (SNC)", "Société en commandite simple (SCS)",
  "Société à responsabilité limitée (SARL)", "Société Anonyme (SA)",
  "Société par actions simplifiée (SAS)", "Société par actions simplifiée unipersonnelle (SASU)",
  "Société à responsabilité limitée unipersonnelle (SARLU)", "Société en participation",
  "Groupement d'intérêt économique (GIE)", "Coopérative simplifiée",
  "Coopérative avec conseil d'administration", "Entreprise individuelle",
  "Succursale", "Bureau de liaison",
];

const ETATS = [
  { value: "en_cours",  label: "En cours",  bg: "#dcfce7", text: "#15803d" },
  { value: "en_attente",label: "En attente",bg: "#fef9c3", text: "#a16207" },
  { value: "inactif",   label: "Inactif",   bg: "#f3f4f6", text: "#6b7280" },
  { value: "termine",   label: "Terminé",   bg: "#dbeafe", text: "#1d4ed8" },
];

function getEtat(val: string) {
  return ETATS.find(e => e.value === val) || ETATS[0];
}

function validatePhone(val: string) {
  if (!val) return true;
  return /^\+221[37]\d{8}$/.test(val.replace(/\s/g, ""));
}

const EMPTY_FORM = {
  nom: "", forme_juridique: "", date_creation_ent: "",
  siege_pays: "", pays: "Sénégal",
  region: "", departement: "", arrondissement: "", adresse: "",
  telephone: "", mail: "", siteweb: "",
  secteur_nom: "", branche_nom: "", activite_nom: "",
  secteur_id: "", branche_id: "", activite_id: "",
  point_entree: "", est_publie: true, note_interne: "",
};

const EMPTY_FOCAL = { nom: "", prenom: "", poste: "", telephone: "", mail: "", est_principal: false };

const EMPTY_CONTACT = {
  projet_nom: "", projet_description: "",
  date_premier_contact: "", etat_avancement: "en_cours",
  commentaires: "", contraintes: "",
};

export default function AdminProspects() {
  const [onglet,     setOnglet]     = useState<"ciblees"|"contactees">("ciblees");
  const [prospects,  setProspects]  = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [errors,     setErrors]     = useState<Record<string,string>>({});
  const [form,       setForm]       = useState<any>({ ...EMPTY_FORM });
  const [focaux,     setFocaux]     = useState<any[]>([{ ...EMPTY_FOCAL }]);
  const [deleting,   setDeleting]   = useState<string|null>(null);
  const [regionId,   setRegionId]   = useState<number|null>(null);
  const [depId,      setDepId]      = useState<number|null>(null);

  // Contact modal
  const [showContact,    setShowContact]    = useState(false);
  const [contactProspect,setContactProspect]= useState<any>(null);
  const [contactForm,    setContactForm]    = useState<any>({ ...EMPTY_CONTACT });
  const [editContact,    setEditContact]    = useState<any>(null);
  const [savingContact,  setSavingContact]  = useState(false);
  const [contactOk,      setContactOk]      = useState(false);

  // Détail prospect (historique)
  const [showDetail,  setShowDetail]  = useState(false);
  const [detailItem,  setDetailItem]  = useState<any>(null);
  const [expandedContact, setExpandedContact] = useState<string|null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("per_page", "100");
      if (onglet === "contactees") params.append("est_contacte", "true");
      else params.append("est_contacte", "false");
      const res  = await fetch(`${API_BASE}/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [onglet]);

  useEffect(() => { charger(); }, [charger]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.nom.trim())            e.nom             = "Obligatoire";
    if (!form.forme_juridique)       e.forme_juridique = "Obligatoire";
    if (!form.date_creation_ent)     e.date_creation_ent = "Obligatoire";
    if (!form.siege_pays)            e.siege_pays      = "Obligatoire";
    if (!form.region)                e.region          = "Obligatoire";
    if (!form.departement)           e.departement     = "Obligatoire";
    if (!form.adresse.trim())        e.adresse         = "Obligatoire";
    if (!form.telephone)             e.telephone       = "Obligatoire";
    else if (!validatePhone(form.telephone)) e.telephone = "Format invalide (+221...)";
    if (!form.mail.trim())           e.mail            = "Obligatoire";
    else if (!/\S+@\S+\.\S+/.test(form.mail)) e.mail = "Email invalide";
    if (!form.secteur_id)            e.secteur_id      = "Obligatoire";
    if (!form.branche_id)            e.branche_id      = "Obligatoire";
    if (!form.activite_id)           e.activite_id     = "Obligatoire";
    if (!form.point_entree.trim())   e.point_entree    = "Obligatoire";
    focaux.forEach((pf, i) => {
      if (!pf.nom.trim())    e[`fn_${i}`] = "Obligatoire";
      if (!pf.prenom.trim()) e[`fp_${i}`] = "Obligatoire";
      if (!pf.telephone)     e[`ft_${i}`] = "Obligatoire";
      else if (!validatePhone(pf.telephone)) e[`ft_${i}`] = "Format invalide (+221...)";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM }); setFocaux([{ ...EMPTY_FOCAL }]);
    setRegionId(null); setDepId(null);
    setEditItem(null); setShowForm(true); setErrors({}); setSaveOk(false);
  };

  const openEdit = (p: any) => {
    setForm({
      nom: p.nom || "", forme_juridique: p.forme_juridique || "",
      date_creation_ent: p.date_creation_ent || "",
      siege_pays: p.siege_pays || "", pays: "Sénégal",
      region: p.region || "", departement: p.departement || "",
      arrondissement: p.arrondissement || "", adresse: p.adresse || "",
      telephone: p.telephone || "", mail: p.mail || "", siteweb: p.siteweb || "",
      secteur_nom: p.secteur?.nom || "", branche_nom: p.branche?.nom || "",
      activite_nom: p.activite?.nom || "",
      secteur_id: p.secteur?.id?.toString() || "",
      branche_id: p.branche?.id?.toString() || "",
      activite_id: p.activite?.id?.toString() || "",
      point_entree: p.point_entree || "",
      est_publie: p.est_publie ?? true, note_interne: p.note_interne || "",
    });
    setFocaux(p.points_focaux?.length > 0
      ? p.points_focaux.map((pf: any) => ({ nom: pf.nom||"", prenom: pf.prenom||"", poste: pf.poste||"", telephone: pf.telephone||"", mail: pf.mail||"", est_principal: pf.est_principal||false }))
      : [{ ...EMPTY_FOCAL }]
    );
    setEditItem(p); setShowForm(true); setErrors({}); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.secteur_id) payload.secteur_id = parseInt(payload.secteur_id);
      if (payload.branche_id) payload.branche_id = parseInt(payload.branche_id);
      if (payload.activite_id) payload.activite_id = parseInt(payload.activite_id);
      delete payload.secteur_nom; delete payload.branche_nom; delete payload.activite_nom;
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      payload.pays = "Sénégal";
      if (!editItem) payload.points_focaux = focaux.filter(f => f.nom.trim());

      const url    = editItem ? `${API_BASE}/prospects/${editItem.id}` : `${API_BASE}/prospects`;
      const method = editItem ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true);
      setTimeout(() => { setShowForm(false); charger(); }, 1000);
    } catch (e: any) { setErrors({ global: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce prospect ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/prospects/${id}`, { method: "DELETE" }); charger(); }
    finally { setDeleting(null); }
  };

  // ── Contact ───────────────────────────────────────────────────────────────
  const openAddContact = (prospect: any) => {
    setContactProspect(prospect);
    setContactForm({ ...EMPTY_CONTACT });
    setEditContact(null);
    setShowContact(true); setContactOk(false);
  };

  const openEditContact = (prospect: any, contact: any) => {
    setContactProspect(prospect);
    setContactForm({
      projet_nom: contact.projet_nom || "",
      projet_description: contact.projet_description || "",
      date_premier_contact: contact.date_premier_contact || "",
      etat_avancement: contact.etat_avancement || "en_cours",
      commentaires: contact.commentaires || "",
      contraintes: contact.contraintes || "",
    });
    setEditContact(contact);
    setShowContact(true); setContactOk(false);
  };

  const handleSaveContact = async () => {
    if (!contactForm.projet_nom.trim()) return;
    if (!contactForm.date_premier_contact) return;
    setSavingContact(true);
    try {
      const payload = { ...contactForm };
      Object.keys(payload).forEach(k => { if ((payload as any)[k] === "") (payload as any)[k] = null; });
      const url    = editContact
        ? `${API_BASE}/prospects/${contactProspect.id}/contacts/${editContact.id}`
        : `${API_BASE}/prospects/${contactProspect.id}/contacts`;
      const method = editContact ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setContactOk(true);
      setTimeout(() => { setShowContact(false); charger(); }, 1000);
    } catch {} finally { setSavingContact(false); }
  };

  // ── Détail ────────────────────────────────────────────────────────────────
  const openDetail = async (p: any) => {
    const res = await fetch(`${API_BASE}/prospects/${p.id}`);
    const data = await res.json();
    setDetailItem(data);
    setShowDetail(true);
  };

  const updateFocal  = (i: number, k: string, v: any) => setFocaux(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  const addFocal     = () => setFocaux(prev => [...prev, { ...EMPTY_FOCAL }]);
  const removeFocal  = (i: number) => setFocaux(prev => prev.filter((_, idx) => idx !== i));

  const IS = (f?: string) => ({
    width: "100%", background: "#F2F0EF",
    border: `1px solid ${f && errors[f] ? "#dc2626" : "#C5BFBB"}`,
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  });
  const LS = (f?: string) => ({ fontSize: 12, fontWeight: 600, color: f && errors[f] ? "#dc2626" : "#4a5568", marginBottom: 4, display: "block" });
  const FS = { display: "flex", flexDirection: "column" as const, gap: 3 };
  const ST = (title: string, color = "#ca631f") => (
    <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 12 }}>{title}</p>
  );
  const EM = (f: string) => errors[f] ? <span style={{ fontSize: 11, color: "#dc2626" }}>{errors[f]}</span> : null;

  return (
    <div style={{ padding: "36px 40px 80px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Prospects</h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>{total} prospect{total > 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #004f91, #003a6e)",
          color: "#fff", fontWeight: 600, fontSize: 14,
          padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,79,145,0.3)",
        }}>
          <Plus size={16} /> Ajouter un prospect
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, background: "#F2F0EF", borderRadius: 12, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {[
          { key: "ciblees",    label: "Entreprises ciblées"   },
          { key: "contactees", label: "Entreprises contactées" },
        ].map(o => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key as any)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              background: onglet === o.key ? "#fff" : "transparent",
              color:      onglet === o.key ? "#1a1a2e" : "#9aa5b4",
              boxShadow:  onglet === o.key ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Formulaire prospect */}
      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 20, marginBottom: 32, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #004f91, #1a6ab0)" }} />
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                {editItem ? "Modifier le prospect" : "Nouveau prospect"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                <X size={15} color="#4a5568" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Identification */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {ST("Identification", "#004f91")}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div style={FS}>
                    <label style={LS("nom")}>Dénomination sociale *</label>
                    <input value={form.nom} onChange={e => update("nom", e.target.value)} placeholder="Nom de l'entreprise" style={IS("nom")} />
                    {EM("nom")}
                  </div>
                  <div style={FS}>
                    <label style={LS("forme_juridique")}>Forme juridique *</label>
                    <select value={form.forme_juridique} onChange={e => update("forme_juridique", e.target.value)} style={{ ...IS(), cursor: "pointer" }}>
                      <option value="">— Sélectionner —</option>
                      {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {EM("forme_juridique")}
                  </div>
                  <div style={FS}>
                    <label style={LS("date_creation_ent")}>Date de création *</label>
                    <input type="date" value={form.date_creation_ent}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={e => update("date_creation_ent", e.target.value)} style={IS("date_creation_ent")} />
                    {EM("date_creation_ent")}
                  </div>
                </div>
              </div>

              {/* Siège + Localisation */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {ST("Siège social & Localisation", "#004f91")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={FS}>
                    <label style={LS("siege_pays")}>Pays du siège social *</label>
                    <PaysSelect value={form.siege_pays} onChange={val => update("siege_pays", val)} placeholder="Pays du siège" />
                    {EM("siege_pays")}
                  </div>
                  <div style={FS}>
                    <label style={LS()}>Pays d'installation</label>
                    <input value="Sénégal" disabled style={{ ...IS(), opacity: 0.6, cursor: "not-allowed", background: "#E8E5E3" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={FS}>
                    <label style={LS("region")}>Région *</label>
                    <RegionSelect value={form.region} onChange={(nom, id) => { update("region", nom); update("departement", ""); update("arrondissement", ""); setRegionId(id); setDepId(null); }} />
                    {EM("region")}
                  </div>
                  <div style={FS}>
                    <label style={LS("departement")}>Département *</label>
                    <DepartementSelect regionId={regionId} value={form.departement} onChange={(nom, id) => { update("departement", nom); update("arrondissement", ""); setDepId(id); }} />
                    {EM("departement")}
                  </div>
                  <div style={FS}>
                    <label style={LS()}>Arrondissement</label>
                    <ArrondissementSelect departementId={depId} value={form.arrondissement} onChange={nom => update("arrondissement", nom)} />
                  </div>
                </div>
                <div style={FS}>
                  <label style={LS("adresse")}>Adresse *</label>
                  <input value={form.adresse} onChange={e => update("adresse", e.target.value)} placeholder="Adresse physique" style={IS("adresse")} />
                    {EM("adresse")}
                </div>
              </div>

              {/* Contact */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {ST("Contact", "#004f91")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={FS}>
                    <label style={LS("telephone")}>Téléphone <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(+221...)</span></label>
                    <input value={form.telephone} onChange={e => update("telephone", e.target.value)} placeholder="+221 7X XXX XX XX" style={IS("telephone")} />
                    {EM("telephone")}
                  </div>
                  <div style={FS}>
                    <label style={LS("mail")}>Email *</label>
                    <input type="email" value={form.mail} onChange={e => update("mail", e.target.value)} placeholder="contact@entreprise.com" style={IS("mail")} />
                    {EM("mail")}
                  </div>
                  <div style={FS}>
                    <label style={LS()}>Site web</label>
                    <input value={form.siteweb} onChange={e => update("siteweb", e.target.value)} placeholder="https://..." style={IS()} />
                  </div>
                </div>
              </div>

              {/* NAEMA */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {ST("Classification NAEMA", "#004f91")}
                {(errors.secteur_id || errors.branche_id || errors.activite_id) && (
                  <p style={{ fontSize: 11, color: "#dc2626", marginBottom: 8 }}>Secteur, branche et activité sont obligatoires</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <NaemaCascade
                    secteurVal={form.secteur_nom} brancheVal={form.branche_nom} activiteVal={form.activite_nom}
                    onSecteurChange={(val, id) => { update("secteur_nom", val); update("secteur_id", id?.toString()||""); update("branche_nom",""); update("branche_id",""); update("activite_nom",""); update("activite_id",""); }}
                    onBrancheChange={(val, id) => { update("branche_nom", val); update("branche_id", id?.toString()||""); update("activite_nom",""); update("activite_id",""); }}
                    onActiviteChange={(val, id) => { update("activite_nom", val); update("activite_id", id?.toString()||""); }}
                  />
                </div>
              </div>

              {/* Point d'entrée */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                {ST("Point d'entrée", "#004f91")}
                <div style={FS}>
                  <label style={LS("point_entree")}>Canal / Outil utilisé pour cibler l'entreprise *</label>
                  <textarea value={form.point_entree} onChange={e => update("point_entree", e.target.value)} rows={2} placeholder="Ex: FDI Markets, salon, recommandation partenaire..." style={{ ...IS("point_entree"), resize: "vertical" as const }} />
                    {EM("point_entree")}
                </div>
              </div>

              {/* Points focaux */}
              <div style={{ background: "#F8F7F6", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  {ST("Points focaux", "#004f91")}
                  <button onClick={addFocal} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.08)", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {focaux.map((pf, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #E8E5E3", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <User size={13} style={{ color: "#004f91" }} />
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
                        {[
                          { key: "fn", field: "nom",    label: "Nom *",    ph: "Nom"       },
                          { key: "fp", field: "prenom", label: "Prénom *", ph: "Prénom"    },
                          { key: "",   field: "poste",  label: "Poste",    ph: "DG, Dir..."  },
                        ].map(f => (
                          <div key={f.field} style={FS}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: errors[`${f.key}_${i}`] ? "#dc2626" : "#4a5568", marginBottom: 3, display: "block" }}>{f.label}</label>
                            <input value={pf[f.field]} onChange={e => updateFocal(i, f.field, e.target.value)} placeholder={f.ph}
                              style={{ ...IS(), fontSize: 12, borderColor: errors[`${f.key}_${i}`] ? "#dc2626" : "#C5BFBB" }} />
                            {errors[`${f.key}_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`${f.key}_${i}`]}</span>}
                          </div>
                        ))}
                        <div style={FS}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: errors[`ft_${i}`] ? "#dc2626" : "#4a5568", marginBottom: 3, display: "block" }}>Téléphone *</label>
                          <input value={pf.telephone} onChange={e => updateFocal(i, "telephone", e.target.value)} placeholder="+221..."
                            style={{ ...IS(), fontSize: 12, borderColor: errors[`ft_${i}`] ? "#dc2626" : "#C5BFBB" }} />
                          {errors[`ft_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`ft_${i}`]}</span>}
                          {errors[`ft_${i}`] && <span style={{ fontSize: 10, color: "#dc2626" }}>{errors[`ft_${i}`]}</span>}
                        </div>
                        <div style={FS}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", marginBottom: 3, display: "block" }}>Email</label>
                          <input value={pf.mail} onChange={e => updateFocal(i, "mail", e.target.value)} placeholder="email@..." style={{ ...IS(), fontSize: 12 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Publié */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#4a5568" }}>
                <input type="checkbox" checked={form.est_publie} onChange={e => update("est_publie", e.target.checked)} style={{ width: 16, height: 16 }} />
                Publier sur le site public
              </label>

              {errors.global && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{errors.global}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                <button onClick={handleSave} disabled={saving || saveOk} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: saveOk ? "#dcfce7" : "linear-gradient(135deg, #004f91, #003a6e)",
                  color: saveOk ? "#15803d" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {saveOk ? <><Check size={14} /> Enregistré !</> : saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> : editItem ? "Modifier" : "Ajouter"}
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
            {onglet === "ciblees" ? "Entreprises ciblées" : "Entreprises contactées"}
          </h2>
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{total} résultat{total > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, gap: 10, color: "#9aa5b4" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : prospects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9aa5b4" }}>
            <Building2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#4a5568" }}>Aucun prospect</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8F7F6" }}>
                  {["Entreprise", "Secteur", "Localisation",
                    onglet === "contactees" ? "Dernier contact" : "Point d'entrée",
                    "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => {
                  const dernierContact = p.contacts?.[p.contacts.length - 1];
                  const etat = dernierContact ? getEtat(dernierContact.etat_avancement) : null;
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #F2F0EF", background: i % 2 === 0 ? "#fff" : "#FAFAF9" }}>
                      <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                        <div style={{ fontWeight: 600, color: "#1a1a2e", lineHeight: 1.3 }}>{p.nom.length > 35 ? p.nom.slice(0, 35) + "…" : p.nom}</div>
                        {p.mail && <div style={{ fontSize: 11, color: "#9aa5b4" }}>{p.mail}</div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {p.secteur ? <span style={{ fontSize: 11, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "2px 8px", borderRadius: 999 }}>{p.secteur.nom}</span> : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4a5568" }}>
                        {[p.region, p.pays].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {onglet === "contactees" && dernierContact ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", marginBottom: 3 }}>{dernierContact.projet_nom}</div>
                            <span style={{ fontSize: 11, fontWeight: 600, background: etat?.bg, color: etat?.text, padding: "2px 8px", borderRadius: 999 }}>
                              {etat?.label}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#4a5568" }}>{p.point_entree ? p.point_entree.slice(0, 40) + (p.point_entree.length > 40 ? "…" : "") : "—"}</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openDetail(p)} title="Historique" style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            <Clock size={13} style={{ color: "#004f91" }} />
                          </button>
                          <button onClick={() => openAddContact(p)} title="Ajouter un contact" style={{ background: "rgba(5,150,105,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            <MessageSquare size={13} style={{ color: "#059669" }} />
                          </button>
                          <button onClick={() => openEdit(p)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            <Pencil size={13} style={{ color: "#004f91" }} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 8px" }}>
                            {deleting === p.id ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "#dc2626" }} />}
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

      {/* Modal : Ajouter/Modifier un contact */}
      {showContact && contactProspect && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowContact(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 560, border: "1px solid #C5BFBB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #059669, #047857)" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                    {editContact ? "Modifier le contact" : "Nouveau contact"}
                  </h2>
                  <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>{contactProspect.nom}</p>
                </div>
                <button onClick={() => setShowContact(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                  <X size={15} color="#4a5568" />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={FS}>
                  <label style={LS()}>Projet concerné *</label>
                  <input value={contactForm.projet_nom} onChange={e => setContactForm((f: any) => ({ ...f, projet_nom: e.target.value }))} placeholder="Nom du projet d'investissement" style={IS()} />
                </div>
                <div style={FS}>
                  <label style={LS()}>Description du projet</label>
                  <textarea value={contactForm.projet_description} onChange={e => setContactForm((f: any) => ({ ...f, projet_description: e.target.value }))} rows={2} style={{ ...IS(), resize: "vertical" as const }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={FS}>
                    <label style={LS()}>Date premier contact * <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(≤ aujourd'hui)</span></label>
                    <input type="date" value={contactForm.date_premier_contact}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={e => setContactForm((f: any) => ({ ...f, date_premier_contact: e.target.value }))} style={IS()} />
                  </div>
                  <div style={FS}>
                    <label style={LS()}>État d'avancement</label>
                    <select value={contactForm.etat_avancement} onChange={e => setContactForm((f: any) => ({ ...f, etat_avancement: e.target.value }))} style={{ ...IS(), cursor: "pointer" }}>
                      {ETATS.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={FS}>
                  <label style={LS()}>Commentaires</label>
                  <textarea value={contactForm.commentaires} onChange={e => setContactForm((f: any) => ({ ...f, commentaires: e.target.value }))} rows={3} placeholder="Résumé des échanges..." style={{ ...IS(), resize: "vertical" as const }} />
                </div>
                <div style={FS}>
                  <label style={LS()}>Contraintes <span style={{ fontWeight: 400, color: "#9aa5b4" }}>(préoccupations exprimées)</span></label>
                  <textarea value={contactForm.contraintes} onChange={e => setContactForm((f: any) => ({ ...f, contraintes: e.target.value }))} rows={3}
                    placeholder="- Contrainte foncière&#10;- Besoin de garanties fiscales&#10;- ..."
                    style={{ ...IS(), resize: "vertical" as const }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowContact(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  <button onClick={handleSaveContact} disabled={savingContact || contactOk} style={{
                    padding: "10px 24px", borderRadius: 10, border: "none",
                    background: contactOk ? "#dcfce7" : "linear-gradient(135deg, #059669, #047857)",
                    color: contactOk ? "#15803d" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {contactOk ? <><Check size={14} /> Enregistré !</> : savingContact ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Sauvegarde...</> : editContact ? "Modifier" : "Ajouter"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Historique prospect */}
      {showDetail && detailItem && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowDetail(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto", border: "1px solid #C5BFBB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #004f91, #1a6ab0)" }} />
            <div style={{ padding: "24px 28px", overflowY: "auto", maxHeight: "calc(88vh - 4px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.25rem", color: "#1a1a2e" }}>{detailItem.nom}</h2>
                  <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>{detailItem.forme_juridique || ""}</p>
                </div>
                <button onClick={() => setShowDetail(false)} style={{ background: "#E8E5E3", border: "none", cursor: "pointer", borderRadius: 10, padding: 8 }}>
                  <X size={16} color="#4a5568" />
                </button>
              </div>

              {/* Infos */}
              <div style={{ background: "#F2F0EF", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 13 }}>
                {detailItem.secteur && <div><span style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Secteur</span>{detailItem.secteur.nom}</div>}
                {detailItem.region  && <div><span style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Région</span>{detailItem.region}</div>}
                {detailItem.mail    && <div><span style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Email</span>{detailItem.mail}</div>}
              </div>

              {/* Historique contacts */}
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                Historique des contacts ({detailItem.contacts?.length || 0})
              </p>

              {(!detailItem.contacts || detailItem.contacts.length === 0) ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#9aa5b4", fontSize: 13 }}>
                  Aucun contact enregistré pour ce prospect.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {detailItem.contacts.map((c: any) => {
                    const etat = getEtat(c.etat_avancement);
                    const isOpen = expandedContact === c.id;
                    return (
                      <div key={c.id} style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 14, overflow: "hidden" }}>
                        {/* Header contact */}
                        <div
                          onClick={() => setExpandedContact(isOpen ? null : c.id)}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e", marginBottom: 4 }}>{c.projet_nom}</div>
                            <div style={{ fontSize: 12, color: "#9aa5b4" }}>
                              Premier contact : {new Date(c.date_premier_contact).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, background: etat.bg, color: etat.text, padding: "3px 12px", borderRadius: 999 }}>
                            {etat.label}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); openEditContact(detailItem, c); }}
                            style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 7px" }}
                          >
                            <Pencil size={12} style={{ color: "#004f91" }} />
                          </button>
                          {isOpen ? <ChevronUp size={14} style={{ color: "#9aa5b4" }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4" }} />}
                        </div>

                        {/* Détail contact */}
                        {isOpen && (
                          <div style={{ borderTop: "1px solid #E8E5E3", padding: "14px 16px" }}>
                            {c.projet_description && (
                              <div style={{ marginBottom: 12 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", marginBottom: 4 }}>Description</p>
                                <p style={{ fontSize: 13, color: "#4a5568" }}>{c.projet_description}</p>
                              </div>
                            )}
                            {c.commentaires && (
                              <div style={{ marginBottom: 12 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", marginBottom: 4 }}>Commentaires</p>
                                <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>{c.commentaires}</p>
                              </div>
                            )}
                            {c.contraintes && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                                  <AlertTriangle size={12} style={{ color: "#d97706" }} />
                                  <p style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>Contraintes</p>
                                </div>
                                <div style={{ background: "#fef9c3", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#4a5568", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                                  {c.contraintes}
                                </div>
                              </div>
                            )}

                            {/* Timeline historique */}
                            {c.historique?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", marginBottom: 8 }}>
                                  Évolution de l'état
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {c.historique.map((h: any, idx: number) => {
                                    const he = getEtat(h.etat);
                                    return (
                                      <div key={h.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: he.text, marginTop: 4 }} />
                                          {idx < c.historique.length - 1 && <div style={{ width: 1, height: 20, background: "#E8E5E3", marginTop: 2 }} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: he.text, background: he.bg, padding: "1px 8px", borderRadius: 999 }}>{he.label}</span>
                                            <span style={{ fontSize: 11, color: "#9aa5b4" }}>
                                              {new Date(h.date_changement).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                          </div>
                                          {h.commentaire && <p style={{ fontSize: 12, color: "#4a5568", marginTop: 3 }}>{h.commentaire}</p>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
