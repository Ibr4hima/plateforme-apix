"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Loader2, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ROLES: { v: string; l: string; desc: string }[] = [
  { v: "admin",     l: "Administrateur", desc: "Tous les modules + administration" },
  { v: "agent",     l: "Agent",          desc: "Tous les modules en consultation" },
  { v: "restreint", l: "Restreint",      desc: "Uniquement les modules cochés" },
];

const MODULE_LABELS: Record<string, string> = {
  "tableau-de-bord": "Tableau de bord",
  "ide":             "Investissements privés",
  "prospects":       "Prospects",
  "opportunites":    "Opportunités",
  "evenements":      "Événements",
  "accords":         "Accords & Traités",
  "zones":           "Zones d'investissement",
  "entreprises":     "Entreprises",
};

export default function UtilisateursAdminPage() {
  const { data: session } = useSession();
  const [users,   setUsers]   = useState<any[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<number|null>(null);
  const [savedId, setSavedId] = useState<number|null>(null);
  const [error,   setError]   = useState("");

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.accessToken) h["Authorization"] = `Bearer ${session.accessToken}`;
    return h;
  }, [session?.accessToken]);

  const charger = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [u, m] = await Promise.all([
        fetch(`${API}/auth/users`,   { headers: headers() }).then(r => { if (!r.ok) throw new Error(`Accès refusé (${r.status})`); return r.json(); }),
        fetch(`${API}/auth/modules`, { headers: headers() }).then(r => r.json()),
      ]);
      setUsers(u || []); setModules(m || []);
    } catch (e: any) { setError(e.message || "Erreur de chargement"); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { charger(); }, [charger]);

  const patcher = async (u: any, payload: any) => {
    setSaving(u.id); setError("");
    try {
      const res = await fetch(`${API}/auth/users/${u.id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Erreur"); }
      const maj = await res.json();
      setUsers(prev => prev.map(x => x.id === u.id ? maj : x));
      setSavedId(u.id); setTimeout(() => setSavedId(null), 1200);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const toggleModule = (u: any, slug: string) => {
    const next = (u.modules || []).includes(slug)
      ? u.modules.filter((m: string) => m !== slug)
      : [...(u.modules || []), slug];
    patcher(u, { modules: next });
  };

  return (
    <div style={{ padding: "36px 40px 80px", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e" }}>Utilisateurs &amp; accès</h1>
        <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 4 }}>
          Attribuez à chaque utilisateur son rôle et, pour les profils restreints, les modules autorisés. Les changements prennent effet immédiatement.
        </p>
      </div>

      {error && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", color: "#dc2626", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 10, margin: "14px 0" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }}/>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginTop: 18, maxWidth: 900 }}>
          {users.map(u => {
            const estDev = u.role === "dev";
            return (
              <div key={u.id} style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", opacity: u.is_active ? 1 : 0.55 }}>
                <div style={{ height: 3, background: estDev ? "linear-gradient(90deg,#4A148C 0%,#6A1B9A 60%,#8E24AA 100%)" : u.role === "admin" ? "linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)" : u.role === "agent" ? "linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)" : "linear-gradient(90deg,#9c4a15 0%,#ca631f 60%,#e07a2e 100%)", flexShrink: 0 }}/>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,79,145,0.07)", color: "#004f91", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                        {(u.email || "?")[0].toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{u.email}</p>
                        {estDev && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 10, fontWeight: 700, color: "#6A1B9A", background: "rgba(106,27,154,0.08)", padding: "2px 9px", borderRadius: 999 }}>
                            <ShieldCheck size={10}/> Développeur — accès total, non modifiable
                          </span>
                        )}
                      </div>
                    </div>

                    {!estDev && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                        {/* Rôle */}
                        <div style={{ display: "flex", gap: 4, background: "#F5F4F3", borderRadius: 999, padding: 3 }}>
                          {ROLES.map(r => (
                            <button key={r.v} onClick={() => u.role !== r.v && patcher(u, { role: r.v })} title={r.desc}
                              style={{ padding: "5px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: u.role === r.v ? 700 : 600, background: u.role === r.v ? "#004f91" : "transparent", color: u.role === r.v ? "#fff" : "#9aa5b4", fontFamily: "var(--font-google-sans)", transition: "all 0.15s" }}>
                              {r.l}
                            </button>
                          ))}
                        </div>
                        {/* Actif */}
                        <button onClick={() => patcher(u, { is_active: !u.is_active })}
                          style={{ padding: "5px 13px", borderRadius: 999, border: `1px solid ${u.is_active ? "rgba(24,128,56,0.25)" : "rgba(220,38,38,0.25)"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, background: u.is_active ? "rgba(24,128,56,0.08)" : "rgba(220,38,38,0.07)", color: u.is_active ? "#188038" : "#dc2626", fontFamily: "var(--font-google-sans)" }}>
                          {u.is_active ? "Actif" : "Désactivé"}
                        </button>
                        {saving === u.id && <Loader2 size={14} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }}/>}
                        {savedId === u.id && <Check size={14} style={{ color: "#188038" }}/>}
                      </div>
                    )}
                  </div>

                  {/* Modules du profil restreint */}
                  {!estDev && u.role === "restreint" && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F2F0EF" }}>
                      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#ca631f", textTransform: "uppercase" as const, marginBottom: 8 }}>
                        Modules autorisés {(u.modules || []).length === 0 && <span style={{ color: "#9aa5b4", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>— aucun : l&apos;utilisateur ne peut accéder à aucun module protégé</span>}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                        {modules.map(slug => {
                          const on = (u.modules || []).includes(slug);
                          return (
                            <button key={slug} onClick={() => toggleModule(u, slug)}
                              style={{ padding: "5px 13px", borderRadius: 999, border: `1.5px solid ${on ? "#004f91" : "#E8E5E3"}`, cursor: "pointer", fontSize: 11.5, fontWeight: on ? 700 : 600, background: on ? "rgba(0,79,145,0.08)" : "#fff", color: on ? "#004f91" : "#9aa5b4", fontFamily: "var(--font-google-sans)", transition: "all 0.15s" }}>
                              {MODULE_LABELS[slug] || slug}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {users.length === 0 && <p style={{ color: "#9aa5b4", fontSize: 14, textAlign: "center" as const, padding: "40px 0" }}>Aucun utilisateur enregistré</p>}
        </div>
      )}
    </div>
  );
}
