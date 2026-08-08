"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { confirmer } from "@/components/shared/Confirmation";
import { voile } from "@/lib/couleurs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Couleur de chaque rôle (badges) : dev et admin en bleu, admin+ en vert, agent en orange
const ROLE_COLORS: Record<string, string> = { dev: "var(--bleu)", admin: "var(--bleu)", admin_plus: "var(--vert)", agent: "var(--orange)" };
const ROLE_LABELS: Record<string, string> = { dev: "Développeur", admin: "Admin", admin_plus: "Admin+", agent: "Agent" };

const ROLES: { v: string; l: string; desc: string }[] = [
  { v: "agent",      l: "Agent",       desc: "Tous les modules publics, pas d'accès admin" },
  { v: "admin",      l: "Admin",       desc: "Pages admin en lecture seule (aucune modification)" },
  { v: "admin_plus", l: "Admin+",      desc: "Édition sur les pages admin cochées" },
];

// Toutes les pages de la barre de menu admin
const MODULE_LABELS: Record<string, string> = {
  "utilisateurs":         "Utilisateurs & accès",
  "evenements":           "Événements",
  "accords":              "Accords & Traités",
  "entreprises":          "Entreprises",
  "gestion-zones":        "Pôles & Zones d'investissement",
  "opportunites":         "Opportunités d'investissement",
  "intentions":           "Intentions d'investissement",
  "prospects":            "Prospects",
  "analyse":              "Analyse de données",
  "statistiques":         "Données Statistiques",
  "ref-pays":             "Pays & Groupements",
  "geo":                  "Découpage administratif",
  "naema":                "Classification NAEMA",
  "classifications":      "Tableaux de correspondance",
  "ide":                  "Données IDE",
  "bdef":                 "Données BDEF",
  "code-investissement":  "Code des investissements",
};

const TH: React.CSSProperties = { padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--texte)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "middle" };
const INPUT: React.CSSProperties = { width: "100%", minWidth: 90, background: "var(--carte-douce)", border: "1px solid var(--bordure-forte)", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, color: "var(--encre)", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" };

export default function UtilisateursAdminPage() {
  const { data: session } = useSession();
  const [users,   setUsers]   = useState<any[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<number|null>(null);
  const [savedId, setSavedId] = useState<number|null>(null);
  const [error,   setError]   = useState("");
  const [accesOpen, setAccesOpen] = useState<number|null>(null);
  const popRef = useRef<HTMLDivElement>(null);

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

  // Fermer le menu déroulant des accès au clic extérieur
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setAccesOpen(null); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

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

  const supprimer = async (u: any) => {
    if (!(await confirmer(`Supprimer le compte de ${u.email} ?\n\nLa personne ne pourra plus se connecter (elle pourra recréer un compte, qui repassera par la validation).`))) return;
    setSaving(u.id); setError("");
    try {
      const res = await fetch(`${API}/auth/users/${u.id}`, { method: "DELETE", headers: headers() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Erreur"); }
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  };

  const majChamp = (u: any, champ: "prenom"|"nom", v: string) =>
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, [champ]: v } : x));

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
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "var(--encre)" }}>Utilisateurs &amp; accès</h1>
      </div>

      {error && (
        <div style={{ background: "rgb(var(--danger-rgb) / 0.06)", border: "1px solid rgb(var(--danger-rgb) / 0.20)", color: "var(--danger)", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 10, margin: "14px 0" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: "var(--gris)", animation: "spin 1s linear infinite" }}/>
        </div>
      ) : (
        <div style={{ background: "var(--carte)", borderRadius: 14, border: "1px solid var(--bordure)", overflow: "visible", boxShadow: "var(--ombre-1)", marginTop: 18 }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu-action) 60%,var(--bleu-clair) 100%)", borderRadius: "14px 14px 0 0" }} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bordure)" }}>
                <th style={TH}>Prénom</th>
                <th style={TH}>Nom</th>
                <th style={TH}>Email</th>
                <th style={TH}>Rôle</th>
                <th style={TH}>Accès admin</th>
                <th style={TH}>Statut</th>
                <th style={{ ...TH, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const estDev = u.role === "dev";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--filet)", opacity: u.is_active ? 1 : 0.6, transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--carte-douce)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {/* Prénom / Nom — sauvegardés à la sortie du champ */}
                    <td style={TD}>
                      <input value={u.prenom || ""} placeholder="Prénom(s)" disabled={estDev && false}
                        onChange={e => majChamp(u, "prenom", e.target.value)}
                        onBlur={e => patcher(u, { prenom: e.target.value })}
                        style={INPUT}/>
                    </td>
                    <td style={TD}>
                      <input value={u.nom || ""} placeholder="Nom"
                        onChange={e => majChamp(u, "nom", e.target.value)}
                        onBlur={e => patcher(u, { nom: e.target.value })}
                        style={INPUT}/>
                    </td>
                    {/* Email */}
                    <td style={TD}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--encre)", whiteSpace: "nowrap" }}>{u.email}</span>
                    </td>
                    {/* Rôle */}
                    <td style={TD}>
                      {(() => {
                        const c = ROLE_COLORS[u.role] || "var(--texte)";
                        const badge = (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: c, background: `${voile(c, 8)}`, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
                            {ROLE_LABELS[u.role] || u.role}
                            {!estDev && <ChevronDown size={11} style={{ opacity: 0.7 }}/>}
                          </span>
                        );
                        if (estDev) return badge;
                        // Select natif invisible par-dessus le badge : clic = menu des rôles
                        return (
                          <span style={{ position: "relative", display: "inline-flex" }}>
                            {badge}
                            <select value={u.role} onChange={e => patcher(u, { role: e.target.value })}
                              title={ROLES.find(r => r.v === u.role)?.desc}
                              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}>
                              {ROLES.map(r => <option key={r.v} value={r.v} title={r.desc}>{r.l}</option>)}
                            </select>
                          </span>
                        );
                      })()}
                    </td>
                    {/* Accès admin (admin_plus) : menu déroulant à cases */}
                    <td style={{ ...TD, position: "relative" }}>
                      {estDev ? (
                        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.08)", padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>Tout</span>
                      ) : u.role !== "admin_plus" ? (
                        <span style={{ fontSize: 11.5, color: "var(--gris)" }}>—</span>
                      ) : (
                        <div ref={accesOpen === u.id ? popRef : undefined} style={{ position: "relative", display: "inline-block" }}>
                          <button onClick={() => setAccesOpen(o => o === u.id ? null : u.id)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgb(var(--bleu-rgb) / 0.08)", border: "none", borderRadius: 999, padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--bleu)", cursor: "pointer", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap" }}>
                            {(u.modules || []).length ? `${u.modules.length} page${u.modules.length > 1 ? "s" : ""}` : "Aucune page"}
                            <ChevronDown size={12} style={{ transform: accesOpen === u.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
                          </button>
                          {accesOpen === u.id && (
                            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, width: 240, background: "var(--carte)", border: "1px solid rgb(var(--ombre-rgb) / 0.08)", borderRadius: 12, padding: 6, boxShadow: "0 16px 48px rgb(var(--ombre-rgb) / 0.16)" }}>
                              <p style={{ margin: 0, padding: "6px 10px 8px", fontSize: 9.5, fontWeight: 800, color: "var(--gris)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)" }}>Pages admin éditables</p>
                              {modules.map(slug => {
                                const on = (u.modules || []).includes(slug);
                                return (
                                  <button key={slug} onClick={() => toggleModule(u, slug)}
                                    style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-google-sans)" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--carte-douce)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                    <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? "var(--bleu)" : "var(--bordure-forte)"}`, background: on ? "var(--bleu-action)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      {on && <Check size={10} color="var(--sur-bleu)"/>}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "var(--bleu)" : "var(--texte)" }}>{MODULE_LABELS[slug] || slug}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Statut */}
                    <td style={TD}>
                      {estDev ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--vert)", whiteSpace: "nowrap" }}>Actif</span>
                      ) : (
                        <button onClick={() => patcher(u, { is_active: !u.is_active })}
                          title={u.is_active ? "Cliquer pour désactiver" : "Compte en attente — cliquer pour activer"}
                          style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: u.is_active ? "var(--vert)" : "var(--orange)", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap" }}>
                          {u.is_active ? "Actif" : "En attente"}
                        </button>
                      )}
                    </td>
                    {/* Supprimer */}
                    <td style={{ ...TD, textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {saving === u.id && <Loader2 size={13} style={{ color: "var(--gris)", animation: "spin 1s linear infinite" }}/>}
                        {savedId === u.id && <Check size={13} style={{ color: "var(--vert)" }}/>}
                        {!estDev && (
                          <button onClick={() => supprimer(u)} title="Supprimer ce compte"
                            style={{ background: "rgb(var(--danger-rgb) / 0.07)", border: "none", cursor: "pointer", borderRadius: 999, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.14)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.07)")}>
                            <Trash2 size={13} style={{ color: "var(--danger)" }}/>
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && <p style={{ color: "var(--gris)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>Aucun utilisateur enregistré</p>}
        </div>
      )}
    </div>
  );
}
