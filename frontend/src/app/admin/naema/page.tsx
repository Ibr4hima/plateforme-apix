"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight, ChevronDown } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function AdminNaema() {
  const [secteurs,       setSecteurs]       = useState<any[]>([]);
  const [branches,       setBranches]       = useState<any[]>([]);
  const [activites,      setActivites]      = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expandedSec,    setExpandedSec]    = useState<number|null>(null);
  const [expandedBranch, setExpandedBranch] = useState<number|null>(null);

  // Modals
  const [modal, setModal] = useState<{
    type: "branche"|"activite"|null;
    mode: "create"|"edit";
    data?: any;
    parentId?: number;
  }>({ type: null, mode: "create" });

  const [formNom,   setFormNom]   = useState("");
  const [formCode,  setFormCode]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);
  const [error,     setError]     = useState("");
  const [deleting,  setDeleting]  = useState<number|null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, a] = await Promise.all([
        fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
        fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
      ]);
      setSecteurs(s);
      setBranches(b);
      setActivites(a);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const branchesDuSecteur  = (sid: number) => branches.filter(b => b.secteur_id === sid);
  const activitesDeLaBranche = (bid: number) => activites.filter(a => a.branche_id === bid);

  const openCreateBranche  = (secteur_id: number) => {
    setModal({ type: "branche", mode: "create", parentId: secteur_id });
    setFormNom(""); setFormCode(""); setError(""); setSaveOk(false);
  };
  const openEditBranche    = (b: any) => {
    setModal({ type: "branche", mode: "edit", data: b });
    setFormNom(b.nom); setFormCode(b.code); setError(""); setSaveOk(false);
  };
  const openCreateActivite = (branche_id: number) => {
    setModal({ type: "activite", mode: "create", parentId: branche_id });
    setFormNom(""); setFormCode(""); setError(""); setSaveOk(false);
  };
  const openEditActivite   = (a: any) => {
    setModal({ type: "activite", mode: "edit", data: a });
    setFormNom(a.nom); setFormCode(a.code); setError(""); setSaveOk(false);
  };

  const handleSave = async () => {
    if (!formNom.trim()) { setError("Le nom est obligatoire"); return; }
    if (!formCode.trim()) { setError("Le code est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const { type, mode, data, parentId } = modal;
      const endpoint = type === "branche" ? "/entreprises/ref/branches" : "/entreprises/ref/activites";
      const body = type === "branche"
        ? { code: formCode, nom: formNom, secteur_id: parentId }
        : { code: formCode, nom: formNom, branche_id: parentId };

      if (mode === "create") {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
      } else {
        const res = await fetch(`${API_BASE}${endpoint}/${data.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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

  const handleDelete = async (type: "branche"|"activite", id: number) => {
    const label = type === "branche" ? "cette branche et toutes ses activités" : "cette activité";
    if (!(await confirmer(`Supprimer ${label} ?`))) return;
    setDeleting(id);
    try {
      const endpoint = type === "branche" ? "branches" : "activites";
      await fetch(`${API_BASE}/entreprises/ref/${endpoint}/${id}`, { method: "DELETE", headers: await authHeaders() });
      charger();
    } finally { setDeleting(null); }
  };

  const inputStyle = {
    width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  };

  const SECTEUR_COLORS = ["#ca631f", "#004f91", "#059669"];

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
          Administration
        </p>
        <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>
          Classification NAEMA
        </h1>
        <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 4 }}>
          {secteurs.length} secteurs · {branches.length} branches · {activites.length} activités
        </p>
      </div>

      {/* Secteurs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {secteurs.map((sec, si) => {
          const color      = SECTEUR_COLORS[si] || "#ca631f";
          const bSec       = branchesDuSecteur(sec.id);
          const isExpanded = expandedSec === sec.id;

          return (
            <div key={sec.id} style={{
              background: "#fff", border: "1px solid #C5BFBB",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "var(--ombre-1)",
            }}>
              {/* Header secteur */}
              <div
                onClick={() => setExpandedSec(isExpanded ? null : sec.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "18px 24px", cursor: "pointer",
                  borderLeft: `4px solid ${color}`,
                  background: isExpanded ? `${color}06` : "#fff",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color }}>{sec.code}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>
                    {sec.nom}
                  </div>
                  <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>
                    {bSec.length} branche{bSec.length > 1 ? "s" : ""} ·{" "}
                    {bSec.reduce((acc, b) => acc + activitesDeLaBranche(b.id).length, 0)} activités
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); openCreateBranche(sec.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: `${color}12`, border: "none", cursor: "pointer",
                    borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color,
                  }}
                >
                  <Plus size={12} /> Branche
                </button>
                {isExpanded
                  ? <ChevronDown size={18} style={{ color: "#9aa5b4", flexShrink: 0 }} />
                  : <ChevronRight size={18} style={{ color: "#9aa5b4", flexShrink: 0 }} />
                }
              </div>

              {/* Branches */}
              {isExpanded && (
                <div style={{ padding: "0 24px 20px" }}>
                  {bSec.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "#9aa5b4", fontSize: 13 }}>
                      Aucune branche — cliquez sur "+ Branche" pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {bSec.map(branch => {
                        const asBranch     = activitesDeLaBranche(branch.id);
                        const isBranchOpen = expandedBranch === branch.id;

                        return (
                          <div key={branch.id} style={{
                            background: "#F8F7F6", borderRadius: 12,
                            border: "1px solid #E8E5E3", overflow: "hidden",
                          }}>
                            {/* Header branche */}
                            <div
                              onClick={() => setExpandedBranch(isBranchOpen ? null : branch.id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "12px 16px", cursor: "pointer",
                              }}
                            >
                              <span style={{
                                fontSize: 10, fontWeight: 700, color,
                                background: `${color}12`, padding: "2px 8px", borderRadius: 999,
                                flexShrink: 0,
                              }}>
                                {branch.code}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", flex: 1 }}>
                                {branch.nom}
                              </span>
                              <span style={{ fontSize: 11, color: "#9aa5b4", marginRight: 8 }}>
                                {asBranch.length} activité{asBranch.length > 1 ? "s" : ""}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); openCreateActivite(branch.id); }}
                                style={{
                                  background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
                                  borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#4a5568",
                                  display: "flex", alignItems: "center", gap: 3,
                                }}
                              >
                                <Plus size={10} /> Activité
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openEditBranche(branch); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                              >
                                <Pencil size={13} style={{ color: "#9aa5b4" }} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete("branche", branch.id); }}
                                disabled={deleting === branch.id}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                              >
                                {deleting === branch.id
                                  ? <Loader2 size={13} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
                                  : <Trash2 size={13} style={{ color: "#dc2626" }} />
                                }
                              </button>
                              {isBranchOpen
                                ? <ChevronDown size={14} style={{ color: "#9aa5b4" }} />
                                : <ChevronRight size={14} style={{ color: "#9aa5b4" }} />
                              }
                            </div>

                            {/* Activités */}
                            {isBranchOpen && (
                              <div style={{ borderTop: "1px solid #E8E5E3", padding: "8px 16px 12px" }}>
                                {asBranch.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "#9aa5b4", padding: "8px 0" }}>
                                    Aucune activité — cliquez sur "+ Activité".
                                  </p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                                    {asBranch.map(act => (
                                      <div key={act.id} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "8px 12px", background: "#fff",
                                        borderRadius: 8, border: "1px solid #E8E5E3",
                                      }}>
                                        <span style={{
                                          fontSize: 10, fontWeight: 600, color: "#9aa5b4",
                                          background: "#F2F0EF", padding: "1px 6px", borderRadius: 999, flexShrink: 0,
                                        }}>
                                          {act.code}
                                        </span>
                                        <span style={{ fontSize: 13, color: "#4a5568", flex: 1 }}>{act.nom}</span>
                                        <button
                                          onClick={() => openEditActivite(act)}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                                        >
                                          <Pencil size={12} style={{ color: "#9aa5b4" }} />
                                        </button>
                                        <button
                                          onClick={() => handleDelete("activite", act.id)}
                                          disabled={deleting === act.id}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                                        >
                                          {deleting === act.id
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

      {/* Modal branche / activité */}
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
            background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 480,
            border: "1px solid #C5BFBB", boxShadow: "var(--ombre-2)",
            overflow: "hidden",
          }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, #ca631f, #e07a3a)" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e" }}>
                  {modal.mode === "create" ? "Nouvelle" : "Modifier"}{" "}
                  {modal.type === "branche" ? "branche" : "activité"}
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
                    placeholder={modal.type === "branche" ? "Ex: S1-B5" : "Ex: S1-B1-A8"}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568" }}>Nom *</label>
                  <input
                    value={formNom}
                    onChange={e => setFormNom(e.target.value)}
                    placeholder="Intitulé complet"
                    style={inputStyle}
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
                    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
