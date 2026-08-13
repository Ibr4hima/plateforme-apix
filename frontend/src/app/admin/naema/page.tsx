"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight, ChevronDown } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import { voile } from "@/lib/couleurs";

import { API_BASE } from "@/lib/api";

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
    width: "100%", background: "var(--fond)", border: "1px solid var(--bordure-forte)",
    borderRadius: 8, padding: "9px 12px", fontSize: "var(--t-13)", color: "var(--encre)",
    outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const,
  };

  const SECTEUR_COLORS = ["var(--orange)", "var(--bleu)", "var(--emeraude)"];

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, gap: 12, color: "var(--gris)" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "36px 40px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: "var(--t-11)", fontWeight: 700, color: "var(--orange)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
          Administration
        </p>
        <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "var(--t-r175)", color: "var(--encre)" }}>
          Classification NAEMA
        </h1>
        <p style={{ color: "var(--gris)", fontSize: "var(--t-13)", marginTop: 4 }}>
          {secteurs.length} secteurs · {branches.length} branches · {activites.length} activités
        </p>
      </div>

      {/* Secteurs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {secteurs.map((sec, si) => {
          const color      = SECTEUR_COLORS[si] || "var(--orange)";
          const bSec       = branchesDuSecteur(sec.id);
          const isExpanded = expandedSec === sec.id;

          return (
            <div key={sec.id} style={{
              background: "var(--carte)", border: "1px solid var(--bordure-forte)",
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
                  background: isExpanded ? `${voile(color, 2)}` : "var(--carte)",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${voile(color, 8)}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontSize: "var(--t-12)", fontWeight: 800, color }}>{sec.code}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "var(--t-16)", color: "var(--encre)" }}>
                    {sec.nom}
                  </div>
                  <div style={{ fontSize: "var(--t-12)", color: "var(--gris)", marginTop: 2 }}>
                    {bSec.length} branche{bSec.length > 1 ? "s" : ""} ·{" "}
                    {bSec.reduce((acc, b) => acc + activitesDeLaBranche(b.id).length, 0)} activités
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); openCreateBranche(sec.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: `${voile(color, 7)}`, border: "none", cursor: "pointer",
                    borderRadius: 8, padding: "6px 12px", fontSize: "var(--t-12)", fontWeight: 600, color,
                  }}
                >
                  <Plus size={12} /> Branche
                </button>
                {isExpanded
                  ? <ChevronDown size={18} style={{ color: "var(--gris)", flexShrink: 0 }} />
                  : <ChevronRight size={18} style={{ color: "var(--gris)", flexShrink: 0 }} />
                }
              </div>

              {/* Branches */}
              {isExpanded && (
                <div style={{ padding: "0 24px 20px" }}>
                  {bSec.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "var(--gris)", fontSize: "var(--t-13)" }}>
                      Aucune branche — cliquez sur "+ Branche" pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {bSec.map(branch => {
                        const asBranch     = activitesDeLaBranche(branch.id);
                        const isBranchOpen = expandedBranch === branch.id;

                        return (
                          <div key={branch.id} style={{
                            background: "var(--carte-douce)", borderRadius: 12,
                            border: "1px solid var(--bordure-forte)", overflow: "hidden",
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
                                fontSize: "var(--t-10)", fontWeight: 700, color,
                                background: `${voile(color, 7)}`, padding: "2px 8px", borderRadius: 999,
                                flexShrink: 0,
                              }}>
                                {branch.code}
                              </span>
                              <span style={{ fontSize: "var(--t-13)", fontWeight: 600, color: "var(--encre)", flex: 1 }}>
                                {branch.nom}
                              </span>
                              <span style={{ fontSize: "var(--t-11)", color: "var(--gris)", marginRight: 8 }}>
                                {asBranch.length} activité{asBranch.length > 1 ? "s" : ""}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); openCreateActivite(branch.id); }}
                                style={{
                                  background: "rgb(var(--ombre-rgb) / 0.05)", border: "none", cursor: "pointer",
                                  borderRadius: 6, padding: "4px 8px", fontSize: "var(--t-11)", color: "var(--texte)",
                                  display: "flex", alignItems: "center", gap: 3,
                                }}
                              >
                                <Plus size={10} /> Activité
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openEditBranche(branch); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                              >
                                <Pencil size={13} style={{ color: "var(--gris)" }} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete("branche", branch.id); }}
                                disabled={deleting === branch.id}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                              >
                                {deleting === branch.id
                                  ? <Loader2 size={13} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} />
                                  : <Trash2 size={13} style={{ color: "var(--danger)" }} />
                                }
                              </button>
                              {isBranchOpen
                                ? <ChevronDown size={14} style={{ color: "var(--gris)" }} />
                                : <ChevronRight size={14} style={{ color: "var(--gris)" }} />
                              }
                            </div>

                            {/* Activités */}
                            {isBranchOpen && (
                              <div style={{ borderTop: "1px solid var(--bordure-forte)", padding: "8px 16px 12px" }}>
                                {asBranch.length === 0 ? (
                                  <p style={{ fontSize: "var(--t-12)", color: "var(--gris)", padding: "8px 0" }}>
                                    Aucune activité — cliquez sur "+ Activité".
                                  </p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                                    {asBranch.map(act => (
                                      <div key={act.id} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "8px 12px", background: "var(--carte)",
                                        borderRadius: 8, border: "1px solid var(--bordure-forte)",
                                      }}>
                                        <span style={{
                                          fontSize: "var(--t-10)", fontWeight: 600, color: "var(--gris)",
                                          background: "var(--fond)", padding: "1px 6px", borderRadius: 999, flexShrink: 0,
                                        }}>
                                          {act.code}
                                        </span>
                                        <span style={{ fontSize: "var(--t-13)", color: "var(--texte)", flex: 1 }}>{act.nom}</span>
                                        <button
                                          onClick={() => openEditActivite(act)}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                                        >
                                          <Pencil size={12} style={{ color: "var(--gris)" }} />
                                        </button>
                                        <button
                                          onClick={() => handleDelete("activite", act.id)}
                                          disabled={deleting === act.id}
                                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                                        >
                                          {deleting === act.id
                                            ? <Loader2 size={12} style={{ color: "var(--danger)", animation: "spin 1s linear infinite" }} />
                                            : <Trash2 size={12} style={{ color: "var(--danger)" }} />
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
            position: "fixed", inset: 0, background: "rgb(var(--ombre-rgb) / 0.35)",
            backdropFilter: "blur(4px)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24,
          }}
        >
          <div style={{
            background: "var(--carte-douce)", borderRadius: 20, width: "100%", maxWidth: 480,
            border: "1px solid var(--bordure-forte)", boxShadow: "var(--ombre-2)",
            overflow: "hidden",
          }}>
            <div style={{ height: 4, background: "linear-gradient(90deg, var(--orange-action), var(--orange-action))" }} />
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "var(--t-r110)", color: "var(--encre)" }}>
                  {modal.mode === "create" ? "Nouvelle" : "Modifier"}{" "}
                  {modal.type === "branche" ? "branche" : "activité"}
                </h2>
                <button onClick={() => setModal({ type: null, mode: "create" })} style={{ background: "var(--fond)", border: "none", cursor: "pointer", borderRadius: 8, padding: 8 }}>
                  <X size={15} color="var(--texte)" />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "var(--t-12)", fontWeight: 600, color: "var(--texte)" }}>Code *</label>
                  <input
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder={modal.type === "branche" ? "Ex: S1-B5" : "Ex: S1-B1-A8"}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "var(--t-12)", fontWeight: 600, color: "var(--texte)" }}>Nom *</label>
                  <input
                    value={formNom}
                    onChange={e => setFormNom(e.target.value)}
                    placeholder="Intitulé complet"
                    style={inputStyle}
                  />
                </div>

                {error && (
                  <div style={{ background: "var(--danger-voile)", color: "var(--danger)", padding: "10px 14px", borderRadius: 8, fontSize: "var(--t-13)" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button onClick={() => setModal({ type: null, mode: "create" })} style={{
                    padding: "10px 20px", borderRadius: 10, border: "1px solid var(--bordure-forte)",
                    background: "transparent", color: "var(--texte)", fontSize: "var(--t-13)", fontWeight: 600, cursor: "pointer",
                  }}>Annuler</button>
                  <button onClick={handleSave} disabled={saving || saveOk} style={{
                    padding: "10px 24px", borderRadius: 10, border: "none",
                    background: saveOk ? "var(--vert-voile)" : "linear-gradient(135deg, var(--orange-action), var(--orange-fonce))",
                    color: saveOk ? "var(--vert-fonce)" : "var(--sur-bleu)",
                    fontSize: "var(--t-13)", fontWeight: 600, cursor: "pointer",
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
