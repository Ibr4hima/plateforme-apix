"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight, ChevronDown, MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function AdminGeo() {
  const [regions,       setRegions]       = useState<any[]>([]);
  const [departements,  setDepartements]  = useState<any[]>([]);
  const [arrondissements, setArrondissements] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [expandedReg,   setExpandedReg]   = useState<number|null>(null);
  const [expandedDep,   setExpandedDep]   = useState<number|null>(null);

  const [modal, setModal] = useState<{
    type: "region"|"departement"|"arrondissement"|null;
    mode: "create"|"edit";
    data?: any;
    parentId?: number;
  }>({ type: null, mode: "create" });

  const [formNom,  setFormNom]  = useState("");
  const [formCode, setFormCode] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [error,    setError]    = useState("");
  const [deleting, setDeleting] = useState<number|null>(null);

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

  const depsDuReg  = (rid: number) => departements.filter(d => d.region_id === rid);
  const arrsDuDep  = (did: number) => arrondissements.filter(a => a.departement_id === did);

  const openModal = (type: any, mode: "create"|"edit", data?: any, parentId?: number) => {
    setModal({ type, mode, data, parentId });
    setFormNom(data?.nom || "");
    setFormCode(data?.code || "");
    setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!formNom.trim()) { setError("Le nom est obligatoire"); return; }
    if (!formCode.trim()) { setError("Le code est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const { type, mode, data, parentId } = modal;
      const endpoints: Record<string, string> = {
        region: "/entreprises/ref/regions",
        departement: "/entreprises/ref/departements",
        arrondissement: "/entreprises/ref/arrondissements",
      };
      const endpoint = endpoints[type!];

      const body: any = { code: formCode, nom: formNom };
      if (type === "departement")   body.region_id      = parentId;
      if (type === "arrondissement") body.departement_id = parentId;

      if (mode === "create") {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
      } else {
        const res = await fetch(`${API_BASE}${endpoint}/${data.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: formCode, nom: formNom }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
      }
      setSaveOk(true);
      setTimeout(() => { setModal({ type: null, mode: "create" }); charger(); }, 800);
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
    try {
      const endpoints: Record<string, string> = {
        region:         `/entreprises/ref/regions/${id}`,
        departement:    `/entreprises/ref/departements/${id}`,
        arrondissement: `/entreprises/ref/arrondissements/${id}`,
      };
      await fetch(`${API_BASE}${endpoints[type]}`, { method: "DELETE" });
      charger();
    } finally { setDeleting(null); }
  };

  const inputStyle = {
    width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>
            Découpage Administratif
          </h1>
          <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 2 }}>
            {regions.length} régions · {departements.length} départements · {arrondissements.length} arrondissements
          </p>
        </div>
        <button
          onClick={() => openModal("region", "create")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #ca631f, #a84e18)",
            color: "#fff", fontWeight: 600, fontSize: 14,
            padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(202,99,31,0.3)",
          }}
        >
          <Plus size={16} /> Nouvelle région
        </button>
      </div>

      {/* Arborescence */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {regions.map(reg => {
          const deps      = depsDuReg(reg.id);
          const isRegOpen = expandedReg === reg.id;
          const totalArr  = deps.reduce((acc, d) => acc + arrsDuDep(d.id).length, 0);

          return (
            <div key={reg.id} style={{
              background: "#fff", border: "1px solid #C5BFBB",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}>
              {/* Header région */}
              <div
                onClick={() => setExpandedReg(isRegOpen ? null : reg.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 20px", cursor: "pointer",
                  borderLeft: "4px solid #ca631f",
                  background: isRegOpen ? "rgba(202,99,31,0.04)" : "#fff",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(202,99,31,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <MapPin size={16} style={{ color: "#ca631f" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
                    {reg.nom}
                  </div>
                  <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>
                    {reg.code} · {deps.length} département{deps.length > 1 ? "s" : ""} · {totalArr} arrondissement{totalArr > 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openModal("departement", "create", undefined, reg.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(202,99,31,0.1)", border: "none", cursor: "pointer", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#ca631f" }}
                  >
                    <Plus size={11} /> Dép.
                  </button>
                  <button onClick={() => openModal("region", "edit", reg)} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px" }}>
                    <Pencil size={13} style={{ color: "#4a5568" }} />
                  </button>
                  <button
                    onClick={() => handleDelete("region", reg.id, reg.nom)}
                    disabled={deleting === reg.id}
                    style={{ background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px" }}
                  >
                    {deleting === reg.id
                      ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                      : <Trash2 size={13} style={{ color: "#dc2626" }} />
                    }
                  </button>
                </div>
                {isRegOpen ? <ChevronDown size={16} style={{ color: "#9aa5b4", flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
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
                          <div key={dep.id} style={{
                            background: "#F8F7F6", borderRadius: 12,
                            border: "1px solid #E8E5E3", overflow: "hidden",
                          }}>
                            {/* Header département */}
                            <div
                              onClick={() => setExpandedDep(isDepOpen ? null : dep.id)}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}
                            >
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                                {dep.code}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", flex: 1 }}>{dep.nom}</span>
                              <span style={{ fontSize: 11, color: "#9aa5b4", marginRight: 8 }}>
                                {arrs.length} arr.
                              </span>
                              <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => openModal("arrondissement", "create", undefined, dep.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#004f91" }}
                                >
                                  <Plus size={10} /> Arr.
                                </button>
                                <button onClick={() => openModal("departement", "edit", dep)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                  <Pencil size={12} style={{ color: "#9aa5b4" }} />
                                </button>
                                <button
                                  onClick={() => handleDelete("departement", dep.id, dep.nom)}
                                  disabled={deleting === dep.id}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                                >
                                  {deleting === dep.id
                                    ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                                    : <Trash2 size={12} style={{ color: "#dc2626" }} />
                                  }
                                </button>
                              </div>
                              {isDepOpen ? <ChevronDown size={13} style={{ color: "#9aa5b4" }} /> : <ChevronRight size={13} style={{ color: "#9aa5b4" }} />}
                            </div>

                            {/* Arrondissements */}
                            {isDepOpen && (
                              <div style={{ borderTop: "1px solid #E8E5E3", padding: "8px 14px 12px" }}>
                                {arrs.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "#9aa5b4", padding: "6px 0" }}>
                                    Aucun arrondissement — cliquez sur "+ Arr.".
                                  </p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                                    {arrs.map(arr => (
                                      <div key={arr.id} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "7px 12px", background: "#fff",
                                        borderRadius: 8, border: "1px solid #E8E5E3",
                                      }}>
                                        <span style={{ fontSize: 10, fontWeight: 600, color: "#9aa5b4", background: "#F2F0EF", padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>
                                          {arr.code}
                                        </span>
                                        <span style={{ fontSize: 13, color: "#4a5568", flex: 1 }}>{arr.nom}</span>
                                        <button onClick={() => openModal("arrondissement", "edit", arr)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}>
                                          <Pencil size={12} style={{ color: "#9aa5b4" }} />
                                        </button>
                                        <button
                                          onClick={() => handleDelete("arrondissement", arr.id, arr.nom)}
                                          disabled={deleting === arr.id}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                                        >
                                          {deleting === arr.id
                                            ? <Loader2 size={12} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                                            : <Trash2 size={12} style={{ color: "#dc2626" }} />
                                          }
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

      {/* Modal création/édition */}
      {modal.type && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModal({ type: null, mode: "create" }); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24,
          }}
        >
          <div style={{
            background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 460,
            border: "1px solid #C5BFBB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #ca631f, #e07a3a)" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                  {modal.mode === "create" ? "Nouveau" : "Modifier"}{" "}
                  {modal.type === "region" ? "région" : modal.type === "departement" ? "département" : "arrondissement"}
                </h2>
                <button onClick={() => setModal({ type: null, mode: "create" })} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                  <X size={15} color="#4a5568" />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Code *</label>
                  <input
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder={modal.type === "region" ? "Ex: DK" : modal.type === "departement" ? "Ex: DK-D1" : "Ex: DK-D1-A1"}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Nom *</label>
                  <input
                    value={formNom}
                    onChange={e => setFormNom(e.target.value)}
                    placeholder="Nom officiel"
                    style={inputStyle}
                    autoFocus
                  />
                </div>

                {error && (
                  <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button onClick={() => setModal({ type: null, mode: "create" })} style={{
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
                     modal.mode === "create" ? "Créer" : "Modifier"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
