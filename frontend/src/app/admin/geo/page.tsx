"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight, ChevronDown, MapPin, Upload } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const IS: any = {
  width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
  outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
};
const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 5, display: "block" };

export default function AdminGeo() {
  const [regions,         setRegions]         = useState<any[]>([]);
  const [departements,    setDepartements]     = useState<any[]>([]);
  const [arrondissements, setArrondissements]  = useState<any[]>([]);
  const [loading,         setLoading]          = useState(true);
  const [expandedReg,     setExpandedReg]      = useState<number|null>(null);
  const [expandedDep,     setExpandedDep]      = useState<number|null>(null);

  // Modal simple (région / département / arrondissement individuel)
  const [modal, setModal] = useState<{
    type: "region"|"departement"|"arrondissement"|null;
    mode: "create"|"edit";
    data?: any;
    parentId?: number;
  }>({ type: null, mode: "create" });
  const [formNom,  setFormNom]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [error,    setError]    = useState("");
  const [deleting, setDeleting] = useState<number|null>(null);

  // Modal import bulk arrondissements
  const [importModal, setImportModal] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d, a] = await Promise.all([
        fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/departements`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/arrondissements`).then(r => r.json()),
      ]);
      setRegions(r);
      setDepartements(d);
      setArrondissements(a);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const depsDuReg = (rid: number) => departements.filter(d => d.region_id === rid);
  const arrsDuDep = (did: number) => arrondissements.filter(a => a.departement_id === did);

  const openModal = (type: any, mode: "create"|"edit", data?: any, parentId?: number) => {
    setModal({ type, mode, data, parentId });
    setFormNom(data?.nom || "");
    setError(""); setSaveOk(false);
  };
  const closeModal = () => setModal({ type: null, mode: "create" });

  const handleSave = async () => {
    if (!formNom.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const { type, mode, data, parentId } = modal;
      const endpoints: Record<string, string> = {
        region:         "/entreprises/ref/regions",
        departement:    "/entreprises/ref/departements",
        arrondissement: "/entreprises/ref/arrondissements",
      };
      const endpoint = endpoints[type!];
      const body: any = { nom: formNom.trim() };
      if (type === "departement")    body.region_id      = parentId;
      if (type === "arrondissement") body.departement_id = parentId;

      const url    = mode === "edit" ? `${API_BASE}${endpoint}/${data.id}` : `${API_BASE}${endpoint}`;
      const method = mode === "edit" ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaveOk(true);
      setTimeout(() => { closeModal(); charger(); }, 700);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally { setSaving(false); }
  };

  const handleDelete = async (type: "region"|"departement"|"arrondissement", id: number, nom: string) => {
    const warnings: Record<string, string> = {
      region:         `Supprimer la région "${nom}" et tous ses départements et arrondissements ?`,
      departement:    `Supprimer le département "${nom}" et tous ses arrondissements ?`,
      arrondissement: `Supprimer l'arrondissement "${nom}" ?`,
    };
    if (!confirm(warnings[type])) return;
    setDeleting(id);
    const endpoints: Record<string, string> = {
      region:         `/entreprises/ref/regions/${id}`,
      departement:    `/entreprises/ref/departements/${id}`,
      arrondissement: `/entreprises/ref/arrondissements/${id}`,
    };
    await fetch(`${API_BASE}${endpoints[type]}`, { method: "DELETE", headers: authHeaders() });
    setDeleting(null);
    charger();
  };

  // ── Import bulk ──────────────────────────────────────────────────────────────
  const [importTab,       setImportTab]       = useState<"excel"|"manual">("excel");
  const [importRegionId,  setImportRegionId]  = useState<number|"">("");
  const [importInputs,    setImportInputs]    = useState<Record<number, string>>({});
  const [importing,       setImporting]       = useState(false);
  const [importResult,    setImportResult]    = useState<{created:number}|null>(null);
  const [importError,     setImportError]     = useState("");
  // Mode Excel : coller tout d'un coup
  const [excelPaste,      setExcelPaste]      = useState("");
  const [excelPreview,    setExcelPreview]    = useState<{dep:string; arrs:string[]}[]>([]);
  const [excelPayload,    setExcelPayload]    = useState<{departement_id:number; noms:string[]}[]>([]);

  const openImport = () => {
    setImportTab("excel");
    setImportRegionId("");
    setImportInputs({});
    setImportResult(null);
    setImportError("");
    setExcelPaste("");
    setExcelPreview([]);
    setExcelPayload([]);
    setImportModal(true);
  };

  // Parse le collé Excel (colonnes séparées par Tab, lignes par \n)
  // Formats acceptés (avec ou sans cellules fusionnées) :
  //   4 col : Région | Département | Arrondissement | Commune  → on prend col 1 et 2
  //   3 col : Région | Département | Arrondissement
  //   2 col : Département | Arrondissement
  // Les cellules fusionnées génèrent des lignes avec les premières colonnes vides :
  // on "descend" la dernière valeur non-vide (carry-forward).
  const normalise = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  const parseExcel = (text: string) => {
    setImportResult(null); setImportError("");
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const byDep = new Map<string, Set<string>>();
    let lastDep = "";
    let lastArr = "";

    for (const line of lines) {
      // NE PAS filtrer les colonnes vides — elles indiquent des cellules fusionnées
      const cols = line.split("\t").map(c => c.trim());
      const ncols = cols.length;

      let depNom: string;
      let arrNom: string;

      if (ncols >= 4) {
        // Format : Région | Département | Arrondissement | Commune
        depNom = cols[1] || lastDep;
        arrNom = cols[2] || lastArr;
      } else if (ncols === 3) {
        // Format : Région | Département | Arrondissement
        depNom = cols[1] || lastDep;
        arrNom = cols[2] || lastArr;
      } else {
        // Format : Département | Arrondissement
        depNom = cols[0] || lastDep;
        arrNom = cols[1] || lastArr;
      }

      // Carry-forward
      if (depNom) lastDep = depNom;
      if (arrNom) lastArr = arrNom;
      if (!lastDep || !lastArr) continue;

      if (!byDep.has(lastDep)) byDep.set(lastDep, new Set());
      byDep.get(lastDep)!.add(lastArr);
    }

    // Construire preview et payload
    const preview: {dep:string; arrs:string[]}[] = [];
    const payload: {departement_id:number; noms:string[]}[] = [];
    const notFound: string[] = [];
    for (const [depNom, arrsSet] of byDep) {
      const dep = departements.find(d => normalise(d.nom) === normalise(depNom));
      if (!dep) { notFound.push(depNom); continue; }
      const arrs = Array.from(arrsSet);
      preview.push({ dep: dep.nom, arrs });
      payload.push({ departement_id: dep.id, noms: arrs });
    }
    if (notFound.length > 0) setImportError(`Départements non reconnus : ${notFound.join(", ")}`);
    setExcelPreview(preview);
    setExcelPayload(payload);
  };

  const sendBulk = async (payload: {departement_id:number; noms:string[]}[]) => {
    if (payload.length === 0) { setImportError("Aucun arrondissement à importer."); return; }
    setImporting(true); setImportError(""); setImportResult(null);
    try {
      const res = await fetch(`${API_BASE}/entreprises/ref/arrondissements/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setImportResult(data);
      charger();
    } catch (e: any) {
      setImportError(e.message || "Erreur");
    } finally { setImporting(false); }
  };

  const handleImportManual = async () => {
    const depsVisible = importRegionId ? depsDuReg(Number(importRegionId)) : [];
    const payload = depsVisible
      .map(dep => ({
        departement_id: dep.id,
        noms: (importInputs[dep.id] || "")
          .split(/\r?\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
      }))
      .filter(item => item.noms.length > 0);
    await sendBulk(payload);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Découpage Administratif</h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>
            {regions.length} régions · {departements.length} départements · {arrondissements.length} arrondissements
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openImport}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#ca631f", fontWeight: 600, fontSize: 13,
              padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(202,99,31,0.35)", cursor: "pointer" }}>
            <Upload size={14}/> Importer arrondissements
          </button>
          <button onClick={() => openModal("region", "create")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#ca631f,#a84e18)",
              color: "#fff", fontWeight: 600, fontSize: 14, padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(202,99,31,0.3)" }}>
            <Plus size={16}/> Nouvelle région
          </button>
        </div>
      </div>

      {/* Arborescence */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {regions.map(reg => {
          const deps      = depsDuReg(reg.id);
          const isRegOpen = expandedReg === reg.id;
          const totalArr  = deps.reduce((acc, d) => acc + arrsDuDep(d.id).length, 0);

          return (
            <div key={reg.id} style={{ background: "#fff", border: "1px solid #C5BFBB", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              {/* Header région */}
              <div onClick={() => setExpandedReg(isRegOpen ? null : reg.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer",
                  borderLeft: "4px solid #ca631f", background: isRegOpen ? "rgba(202,99,31,0.04)" : "#fff" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(202,99,31,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={16} style={{ color: "#ca631f" }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{reg.nom}</div>
                  <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>
                    {deps.length} département{deps.length > 1 ? "s" : ""} · {totalArr} arrondissement{totalArr > 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openModal("departement", "create", undefined, reg.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(202,99,31,0.1)", border: "none", cursor: "pointer", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#ca631f" }}>
                    <Plus size={11}/> Dép.
                  </button>
                  <button onClick={() => openModal("region", "edit", reg)}
                    style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px" }}>
                    <Pencil size={13} style={{ color: "#4a5568" }}/>
                  </button>
                  <button onClick={() => handleDelete("region", reg.id, reg.nom)} disabled={deleting === reg.id}
                    style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px" }}>
                    {deleting === reg.id
                      ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }}/>
                      : <Trash2 size={13} style={{ color: "#dc2626" }}/>}
                  </button>
                </div>
                {isRegOpen ? <ChevronDown size={16} style={{ color: "#9aa5b4", flexShrink: 0 }}/> : <ChevronRight size={16} style={{ color: "#9aa5b4", flexShrink: 0 }}/>}
              </div>

              {/* Départements */}
              {isRegOpen && (
                <div style={{ padding: "0 20px 16px" }}>
                  {deps.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#9aa5b4", fontSize: 13 }}>
                      Aucun département — cliquez sur "+ Dép." pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {deps.map(dep => {
                        const arrs      = arrsDuDep(dep.id);
                        const isDepOpen = expandedDep === dep.id;

                        return (
                          <div key={dep.id} style={{ background: "#F8F7F6", borderRadius: 12, border: "1px solid #E8E5E3", overflow: "hidden" }}>
                            {/* Header département */}
                            <div onClick={() => setExpandedDep(isDepOpen ? null : dep.id)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", flex: 1 }}>{dep.nom}</span>
                              <span style={{ fontSize: 11, color: "#9aa5b4", marginRight: 8 }}>{arrs.length} arr.</span>
                              <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => openModal("arrondissement", "create", undefined, dep.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#004f91" }}>
                                  <Plus size={10}/> Arr.
                                </button>
                                <button onClick={() => openModal("departement", "edit", dep)}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Pencil size={12} style={{ color: "#9aa5b4" }}/>
                                </button>
                                <button onClick={() => handleDelete("departement", dep.id, dep.nom)} disabled={deleting === dep.id}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  {deleting === dep.id
                                    ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }}/>
                                    : <Trash2 size={12} style={{ color: "#dc2626" }}/>}
                                </button>
                              </div>
                              {isDepOpen ? <ChevronDown size={13} style={{ color: "#9aa5b4" }}/> : <ChevronRight size={13} style={{ color: "#9aa5b4" }}/>}
                            </div>

                            {/* Arrondissements */}
                            {isDepOpen && (
                              <div style={{ borderTop: "1px solid #E8E5E3", padding: "8px 14px 12px" }}>
                                {arrs.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "#9aa5b4", padding: "6px 0" }}>Aucun arrondissement.</p>
                                ) : (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                    {arrs.map(arr => (
                                      <div key={arr.id} style={{ display: "flex", alignItems: "center", gap: 6,
                                        padding: "5px 10px", background: "#fff", borderRadius: 8, border: "1px solid #E8E5E3" }}>
                                        <span style={{ fontSize: 12, color: "#4a5568" }}>{arr.nom}</span>
                                        <button onClick={() => openModal("arrondissement", "edit", arr)}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                          <Pencil size={11} style={{ color: "#C5BFBB" }}/>
                                        </button>
                                        <button onClick={() => handleDelete("arrondissement", arr.id, arr.nom)} disabled={deleting === arr.id}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                          {deleting === arr.id
                                            ? <Loader2 size={11} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }}/>
                                            : <X size={11} style={{ color: "#C5BFBB" }}/>}
                                        </button>
                                      </div>
                                    ))}
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
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modal simple création/édition ─────────────────────────────────────── */}
      {modal.type && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 420,
            border: "1px solid #C5BFBB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg,#ca631f,#e07a3a)" }}/>
            <div style={{ padding: "22px 26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e" }}>
                  {modal.mode === "create" ? "Nouveau" : "Modifier"}{" "}
                  {modal.type === "region" ? "région" : modal.type === "departement" ? "département" : "arrondissement"}
                </h2>
                <button onClick={closeModal} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 7 }}>
                  <X size={14} color="#4a5568"/>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={LS}>Nom *</label>
                  <input value={formNom} onChange={e => setFormNom(e.target.value)}
                    placeholder="Nom officiel" style={IS} autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); }}/>
                </div>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "9px 12px", borderRadius: 8, fontSize: 12 }}>{error}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button onClick={closeModal} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  <button onClick={handleSave} disabled={saving || saveOk}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9, border: "none",
                      background: saveOk ? "#059669" : saving ? "#ccc" : "#ca631f",
                      color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saveOk ? <><Check size={13}/> Enregistré !</>
                     : saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> Sauvegarde…</>
                     : <><Check size={13}/> {modal.mode === "create" ? "Créer" : "Modifier"}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal import bulk arrondissements ─────────────────────────────────── */}
      {importModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setImportModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
          <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 820, maxHeight: "92vh",
            overflowY: "auto", border: "1px solid #C5BFBB", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg,#ca631f,#e07a3a)", borderRadius: "20px 20px 0 0" }}/>
            <div style={{ padding: "24px 28px 28px" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e" }}>Importer des arrondissements</h2>
                </div>
                <button onClick={() => setImportModal(false)}
                  style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 7 }}>
                  <X size={14} color="#4a5568"/>
                </button>
              </div>

              {/* Onglets */}
              <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: 3, marginBottom: 24, width: "fit-content", border: "1px solid #E8E5E3" }}>
                {([["excel","Coller depuis Excel"],["manual","Par département"]] as const).map(([key,label]) => (
                  <button key={key} onClick={() => { setImportTab(key); setImportResult(null); setImportError(""); }}
                    style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      background: importTab === key ? "#ca631f" : "transparent", color: importTab === key ? "#fff" : "#4a5568" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Onglet Excel ── */}
              {importTab === "excel" && (
                <div>
                  <div style={{ background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#004f91", marginBottom: 6 }}>Mode rapide — tout en une seule fois</p>
                    <ol style={{ fontSize: 12, color: "#4a5568", lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                      <li>Sélectionnez vos colonnes dans Excel — <strong>Région · Département · Arrondissement · Commune</strong> ou moins</li>
                      <li>Copiez (<strong>Ctrl+C</strong>) — les cellules fusionnées sont gérées automatiquement</li>
                      <li>Collez ci-dessous (<strong>Ctrl+V</strong>), puis cliquez <strong>Analyser</strong> pour voir l'aperçu avant import</li>
                    </ol>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={LS}>Données copiées depuis Excel</label>
                    <textarea
                      value={excelPaste}
                      onChange={e => { setExcelPaste(e.target.value); setExcelPreview([]); setExcelPayload([]); setImportResult(null); setImportError(""); }}
                      placeholder={"Dakar\tDakar\tAlmadies\tMermoz-Sacré Cœur\n\t\t\tOuakam\n\t\t\tNgor\n\t\tDakar-Plateau\tDakar-Plateau\n…"}
                      rows={8}
                      style={{ ...IS, resize: "vertical" as const, lineHeight: 1.8, fontSize: 12, fontFamily: "monospace" }}
                    />
                  </div>
                  <button onClick={() => parseExcel(excelPaste)} disabled={!excelPaste.trim()}
                    style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
                    Analyser
                  </button>
                  {/* Prévisualisation */}
                  {excelPreview.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#4a5568", marginBottom: 10 }}>
                        Aperçu — {excelPayload.reduce((s,p)=>s+p.noms.length,0)} arrondissements dans {excelPreview.length} département{excelPreview.length>1?"s":""}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                        {excelPreview.map((row, i) => (
                          <div key={i} style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>{row.dep}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {row.arrs.map((a,j) => (
                                <span key={j} style={{ fontSize: 11, background: "rgba(202,99,31,0.08)", color: "#ca631f", padding: "2px 7px", borderRadius: 999 }}>{a}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Onglet Manuel par département ── */}
              {importTab === "manual" && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={LS}>Région</label>
                    <select value={importRegionId} onChange={e => { setImportRegionId(e.target.value ? Number(e.target.value) : ""); setImportInputs({}); setImportResult(null); }}
                      style={IS}>
                      <option value="">— Sélectionner une région —</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                    </select>
                  </div>
                  {importRegionId !== "" && (() => {
                    const deps = depsDuReg(Number(importRegionId));
                    if (deps.length === 0) return <p style={{ color: "#9aa5b4", fontSize: 13 }}>Aucun département dans cette région.</p>;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                        {deps.map(dep => {
                          const existants = arrsDuDep(dep.id);
                          return (
                            <div key={dep.id} style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 12, padding: "12px 14px" }}>
                              <div style={{ marginBottom: 8 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{dep.nom}</p>
                                {existants.length > 0 && <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 2 }}>{existants.length} déjà présent{existants.length>1?"s":""}</p>}
                              </div>
                              <textarea value={importInputs[dep.id] || ""}
                                onChange={e => setImportInputs(prev => ({ ...prev, [dep.id]: e.target.value }))}
                                placeholder={"Un arrondissement\npar ligne…"} rows={5}
                                style={{ ...IS, resize: "vertical" as const, lineHeight: 1.7, fontSize: 12 }}/>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {importError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{importError}</div>}
              {importResult && (
                <div style={{ background: "#dcfce7", color: "#15803d", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={14}/> <strong>{importResult.created}</strong> arrondissement{importResult.created > 1 ? "s" : ""} importé{importResult.created > 1 ? "s" : ""} avec succès.
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setImportModal(false)}
                  style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #C5BFBB", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Fermer</button>
                {importTab === "excel" ? (
                  <button onClick={() => sendBulk(excelPayload)}
                    disabled={importing || excelPayload.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9, border: "none",
                      background: importing || excelPayload.length === 0 ? "#ccc" : "#ca631f",
                      color: "#fff", fontWeight: 700, cursor: importing || excelPayload.length === 0 ? "not-allowed" : "pointer", fontSize: 13 }}>
                    {importing ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> Import…</> : <><Upload size={13}/> Tout importer</>}
                  </button>
                ) : (
                  <button onClick={handleImportManual}
                    disabled={importing || importRegionId === ""}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9, border: "none",
                      background: importing || importRegionId === "" ? "#ccc" : "#ca631f",
                      color: "#fff", fontWeight: 700, cursor: importing || importRegionId === "" ? "not-allowed" : "pointer", fontSize: 13 }}>
                    {importing ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> Import…</> : <><Upload size={13}/> Importer</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
