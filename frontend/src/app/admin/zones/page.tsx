"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Upload, FileText, Building2, Check, Settings, ChevronDown, ChevronRight } from "lucide-react";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TYPE_ZONES = [
  { key: "ZES", label: "Zones Économiques Spéciales",        available: true  },
  { key: "ZAI", label: "Zones Aménagées à l'Investissement", available: true  },
  { key: "ZFI", label: "Zones Franches Industrielles",        available: false },
];

const ONGLETS = [
  { key: "ZES",     label: "Écon. Spéciales",     full: "Zones Économiques Spéciales",        zfi: false, gestion: false },
  { key: "ZAI",     label: "Aménagées",            full: "Zones Aménagées à l'Investissement", zfi: false, gestion: false },
  { key: "ZFI",     label: "Franches Ind.",        full: "Zones Franches Industrielles",        zfi: true,  gestion: false },
  { key: "gestion", label: "Gestion des Zones",    full: "Gestion des Zones",                  zfi: false, gestion: true  },
];

const EMPTY_FORM = { denomination: "", type_zone: "ZES", description: "", thematiques: "" };

// ── Recherche entreprise ──────────────────────────────────────────────────────
function EntrepriseSearch({ onSelect }: { onSelect: (e: any) => void }) {
  const [search,  setSearch]  = useState("");
  const [options, setOptions] = useState<any[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setOptions([]); setOpen(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${API_BASE}/entreprises?search=${encodeURIComponent(search)}&per_page=20`)
        .then(r => r.json())
        .then(d => { setOptions(d.data || []); setOpen(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => options.length > 0 && setOpen(true)}
        placeholder="Rechercher une entreprise installée..."
        style={{ width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10, padding: "9px 14px", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }}
      />
      {loading && <Loader2 size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", animation: "spin 1s linear infinite" }} />}
      {open && options.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300, background: "#fff", border: "1px solid rgba(0,79,145,0.3)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto" }}>
          {options.map((e: any) => (
            <div key={e.id}
              onMouseDown={ev => { ev.preventDefault(); onSelect(e); setSearch(""); setOpen(false); setOptions([]); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F2F0EF" }}
              onMouseEnter={ev => ev.currentTarget.style.background = "#F8F7F6"}
              onMouseLeave={ev => ev.currentTarget.style.background = "#fff"}
            >
              <div style={{ fontWeight: 600, color: "#1a1a2e", fontSize: 13 }}>{e.nom}</div>
              <div style={{ fontSize: 11, color: "#9aa5b4" }}>{[e.forme_juridique, e.secteur?.nom, e.region_nom].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet ZES / ZAI / ZFI ────────────────────────────────────────────────────
function OngletType({ typeZone, available }: { typeZone: string; available: boolean }) {
  const [zones,        setZones]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<string|null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [zoneSelectee, setZoneSelectee] = useState<any>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/zones?type_zone=${typeZone}`);
      setZones(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [typeZone]);

  useEffect(() => { if (available) charger(); }, [charger, available]);

  const ajouterEntreprise = async (entreprise: any) => {
    await fetch(`${API_BASE}/zones/${zoneSelectee.id}/entreprises?entreprise_id=${entreprise.id}`, { method: "POST" });
    setShowModal(false);
    charger();
  };

  const retirerEntreprise = async (zoneId: string, zeId: string) => {
    await fetch(`${API_BASE}/zones/${zoneId}/entreprises/${zeId}`, { method: "DELETE" });
    charger();
  };

  if (!available) return (
    <div style={{ textAlign: "center", padding: "60px 24px", color: "#C5BFBB" }}>
      <Settings size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
      <p style={{ fontSize: 15, fontWeight: 600 }}>Bientôt disponible</p>
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Loader2 size={28} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (zones.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 24px", color: "#9aa5b4" }}>
      <Building2 size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
      <p style={{ fontSize: 15, fontWeight: 600, color: "#4a5568" }}>Aucune zone {typeZone}</p>
      <p style={{ fontSize: 13, marginTop: 4 }}>Allez dans "Gestion des Zones" pour en créer.</p>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {zones.map(z => (
          <div key={z.id} style={{ background: "#fff", border: "1px solid #C5BFBB", borderLeft: "4px solid #004f91", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", cursor: "pointer" }}
              onClick={() => setExpanded(expanded === z.id ? null : z.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {expanded === z.id ? <ChevronDown size={15} style={{ color: "#004f91" }} /> : <ChevronRight size={15} style={{ color: "#9aa5b4" }} />}
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{z.denomination}</h3>
                </div>
                {z.description && <p style={{ fontSize: 12, color: "#9aa5b4", marginLeft: 23, marginTop: 2 }}>{z.description.length > 100 ? z.description.slice(0, 100) + "…" : z.description}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#4a5568" }}>🏭 {z.entreprises?.length || 0} entreprise{(z.entreprises?.length || 0) > 1 ? "s" : ""}</span>
                <button onClick={e => { e.stopPropagation(); setZoneSelectee(z); setShowModal(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={12} /> Ajouter une entreprise
                </button>
              </div>
            </div>

            {expanded === z.id && (
              <div style={{ borderTop: "1px solid #F2F0EF", padding: "14px 20px" }}>
                {!z.entreprises?.length ? (
                  <p style={{ fontSize: 13, color: "#9aa5b4", textAlign: "center", padding: "12px 0" }}>Aucune entreprise. Cliquez sur "Ajouter une entreprise".</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                    {z.entreprises.map((ze: any) => (
                      <div key={ze.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.12)", borderRadius: 10, padding: "10px 12px" }}>
                        <Building2 size={14} style={{ color: "#004f91", flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ze.entreprise?.nom}</div>
                          <div style={{ fontSize: 11, color: "#9aa5b4" }}>{[ze.entreprise?.forme_juridique, ze.entreprise?.secteur?.nom].filter(Boolean).join(" · ")}</div>
                          {ze.entreprise?.region_nom && <div style={{ fontSize: 11, color: "#9aa5b4" }}>{ze.entreprise.region_nom}</div>}
                        </div>
                        <button onClick={() => retirerEntreprise(z.id, ze.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                          <X size={12} style={{ color: "#dc2626" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {z.fichiers?.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {z.fichiers.map((f: any) => (
                      <a key={f.id} href={`${API_BASE}/zones/${z.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.12)", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#004f91", textDecoration: "none", fontWeight: 500 }}>
                        <FileText size={11} /> {f.titre || f.fichier_nom}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && zoneSelectee && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 500, border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #004f91, #1a6ab0)", borderRadius: "20px 20px 0 0" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e" }}>Ajouter une entreprise</h2>
                  <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>{zoneSelectee.denomination}</p>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                  <X size={16} color="#4a5568" />
                </button>
              </div>
              <EntrepriseSearch onSelect={ajouterEntreprise} />
              <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 10 }}>Tapez le nom pour chercher parmi les entreprises installées au Sénégal.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Onglet Gestion ────────────────────────────────────────────────────────────
function OngletGestion() {
  const [zones,    setZones]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form,     setForm]     = useState<any>({ ...EMPTY_FORM });
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [error,    setError]    = useState("");
  const [deleting, setDeleting] = useState<string|null>(null);
  const [pdfQueue, setPdfQueue] = useState<{file: File; titre: string}[]>([]);
  const [fichiers, setFichiers] = useState<any[]>([]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/zones`);
      setZones(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditItem(null); setPdfQueue([]); setFichiers([]);
    setShowForm(true); setError(""); setSaveOk(false);
  };

  const openEdit = (z: any) => {
    setForm({ denomination: z.denomination || "", type_zone: z.type_zone || "ZES", description: z.description || "", thematiques: z.thematiques || "" });
    setFichiers(z.fichiers || []);
    setEditItem(z); setPdfQueue([]);
    setShowForm(true); setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!form.denomination.trim()) { setError("La dénomination est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      fd.append("denomination", form.denomination);
      fd.append("type_zone",    form.type_zone);
      if (form.description) fd.append("description", form.description);
      if (form.thematiques) fd.append("thematiques", form.thematiques);
      fd.append("est_publie", "true");

      const url    = editItem ? `${API_BASE}/zones/${editItem.id}` : `${API_BASE}/zones`;
      const method = editItem ? "PATCH" : "POST";
      const res    = await fetch(url, { method, body: fd });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const zone = await res.json();

      for (const p of pdfQueue) {
        const fd2 = new FormData();
        fd2.append("titre",   p.titre || p.file.name);
        fd2.append("fichier", p.file);
        await fetch(`${API_BASE}/zones/${zone.id}/fichiers`, { method: "POST", body: fd2 });
      }
      setSaveOk(true);
      setTimeout(() => { setShowForm(false); charger(); }, 800);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette zone ?")) return;
    setDeleting(id);
    try { await fetch(`${API_BASE}/zones/${id}`, { method: "DELETE" }); charger(); }
    finally { setDeleting(null); }
  };

  const supprimerFichier = async (zoneId: string, fichId: string) => {
    await fetch(`${API_BASE}/zones/${zoneId}/fichiers/${fichId}`, { method: "DELETE" });
    setFichiers(prev => prev.filter((f: any) => f.id !== fichId));
  };

  const IS: any = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
  const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };

  const grouped = TYPE_ZONES.reduce((acc, t) => { acc[t.key] = zones.filter(z => z.type_zone === t.key); return acc; }, {} as Record<string, any[]>);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> Nouvelle zone
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {TYPE_ZONES.map(t => (
            <div key={t.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "3px 10px", borderRadius: 999 }}>{t.key}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#4a5568" }}>{t.label}</span>
                <span style={{ fontSize: 11, color: "#9aa5b4" }}>({grouped[t.key]?.length || 0})</span>
              </div>
              {!grouped[t.key]?.length ? (
                <p style={{ fontSize: 12, color: "#C5BFBB", paddingLeft: 8, marginBottom: 4 }}>Aucune zone</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped[t.key].map(z => (
                    <div key={z.id} style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e" }}>{z.denomination}</div>
                        {z.description && <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>{z.description.length > 90 ? z.description.slice(0, 90) + "…" : z.description}</div>}
                        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: "#4a5568" }}>🏭 {z.entreprises?.length || 0} entreprise{(z.entreprises?.length || 0) > 1 ? "s" : ""}</span>
                          {z.fichiers?.length > 0 && <span style={{ fontSize: 11, color: "#4a5568" }}>📄 {z.fichiers.length} doc</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                        <button onClick={() => openEdit(z)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px" }}>
                          <Pencil size={13} style={{ color: "#004f91" }} />
                        </button>
                        <button onClick={() => handleDelete(z.id)} disabled={deleting === z.id} style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px" }}>
                          {deleting === z.id ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} style={{ color: "#dc2626" }} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #1a1a2e, #004f91)", borderRadius: "20px 20px 0 0" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a1a2e" }}>{editItem ? "Modifier la zone" : "Nouvelle zone"}</h2>
                <button onClick={() => setShowForm(false)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}><X size={16} color="#4a5568" /></button>
              </div>

              {/* Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={LS}>Type de zone *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {TYPE_ZONES.map(t => (
                    <button key={t.key} onClick={() => update("type_zone", t.key)} style={{ padding: "8px 10px", borderRadius: 8, border: `2px solid ${form.type_zone === t.key ? "#004f91" : "#C5BFBB"}`, background: form.type_zone === t.key ? "rgba(0,79,145,0.08)" : "#fff", color: form.type_zone === t.key ? "#004f91" : "#4a5568", fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "center" as const }}>
                      <div style={{ fontSize: 13 }}>{t.key}</div>
                      <div style={{ fontSize: 10, fontWeight: 400, lineHeight: 1.3 }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={LS}>Dénomination *</label>
                <input value={form.denomination} onChange={e => update("denomination", e.target.value)} placeholder="Ex : ZES de Diamniadio" style={IS} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={LS}>Description</label>
                <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} style={{ ...IS, resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={LS}>Thématiques / Activités prévues</label>
                <ThematiquesNaema value={form.thematiques} onChange={val => update("thematiques", val)} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={LS}>Documents PDF</label>
                {fichiers.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    {fichiers.map((f: any) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 8, padding: "7px 12px" }}>
                        <FileText size={13} style={{ color: "#004f91" }} />
                        <span style={{ fontSize: 13, flex: 1, color: "#1a1a2e", fontWeight: 500 }}>{f.titre || f.fichier_nom}</span>
                        <button onClick={() => editItem && supprimerFichier(editItem.id, f.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 8, cursor: "pointer", border: "2px dashed #C5BFBB", background: "#F2F0EF" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#004f91"} onMouseLeave={e => e.currentTarget.style.borderColor = "#C5BFBB"}>
                  <Upload size={14} color="#9aa5b4" />
                  <span style={{ fontSize: 13, color: "#9aa5b4" }}>Ajouter un ou plusieurs PDF</span>
                  <input type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); setPdfQueue(prev => [...prev, ...files.map(f => ({ file: f, titre: f.name.replace(/\.pdf$/i, "") }))]); e.target.value = ""; }} />
                </label>
                {pdfQueue.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {pdfQueue.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8, padding: "7px 12px" }}>
                        <FileText size={13} style={{ color: "#7c3aed" }} />
                        <input value={p.titre} onChange={e => setPdfQueue(prev => prev.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))} placeholder="Titre" style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(124,58,237,0.3)", outline: "none", fontSize: 12, padding: "2px 0", fontFamily: "var(--font-google-sans)" }} />
                        <span style={{ fontSize: 11, color: "#9aa5b4" }}>{(p.file.size / 1024).toFixed(0)} Ko</span>
                        <button onClick={() => setPdfQueue(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} style={{ color: "#dc2626" }} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Annuler</button>
                <button onClick={handleSave} disabled={saving || saveOk} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: saveOk ? "#059669" : "#1a1a2e", color: "#fff", fontWeight: 700, cursor: saving || saveOk ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement...</> : saveOk ? <><Check size={13} /> Enregistré</> : editItem ? "Modifier" : "Créer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function AdminZones() {
  const [onglet, setOnglet] = useState("ZES");

  return (
    <div style={{ minHeight: "100vh", background: "#F2F0EF", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontWeight: 800, fontSize: "2rem", color: "#1a1a2e", marginBottom: 8 }}>Zones d'investissement</h1>
          <p style={{ color: "#9aa5b4", fontSize: 14 }}>Gérez les zones économiques spéciales, aménagées et industrielles du Sénégal</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 4, border: "1px solid #C5BFBB", gap: 2 }}>
            {ONGLETS.map(o => (
              <button key={o.key}
                disabled={o.zfi}
                onClick={() => !o.zfi && setOnglet(o.key)}
                style={{
                  padding: "8px 16px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700,
                  cursor: o.zfi ? "not-allowed" : "pointer",
                  background: onglet === o.key ? (o.gestion ? "#1a1a2e" : "#004f91") : "transparent",
                  color: o.zfi ? "#C5BFBB" : onglet === o.key ? "#fff" : "#4a5568",
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {o.gestion && <Settings size={12} />}
                {o.label}
                {o.zfi && <span style={{ fontSize: 9, color: "#C5BFBB", marginLeft: 3 }}>bientôt</span>}
              </button>
            ))}
          </div>
        </div>

        {!["gestion"].includes(onglet) && (
          <p style={{ textAlign: "center", fontSize: 13, color: "#9aa5b4", marginBottom: 20 }}>
            {ONGLETS.find(o => o.key === onglet)?.full}
          </p>
        )}

        {onglet === "gestion"
          ? <OngletGestion />
          : <OngletType typeZone={onglet} available={!ONGLETS.find(o => o.key === onglet)?.zfi} />
        }
      </div>
    </div>
  );
}
