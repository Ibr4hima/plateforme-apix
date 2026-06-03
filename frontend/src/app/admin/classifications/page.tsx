"use client";

import { Check, Link2, Loader2, Search, Unlink, X } from "lucide-react";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Hook : charger activités NAEMA enrichies (code S1-B1-A1) ────────────────
function useActivitesNAEMA() {
  const [activites, setActivites] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([
      fetch(`${API}/entreprises/ref/secteurs`).then(r => r.json()),
      fetch(`${API}/entreprises/ref/branches`).then(r => r.json()),
      fetch(`${API}/entreprises/ref/activites`).then(r => r.json()),
    ]).then(([secs, bras, acts]) => {
      const s = Array.isArray(secs) ? secs : [];
      const b = Array.isArray(bras) ? bras : [];
      const a = Array.isArray(acts) ? acts : [];
      setActivites(a.map((act: any) => {
        const bra  = b.find((x: any) => x.id === act.branche_id);
        const sec  = s.find((x: any) => x.id === bra?.secteur_id);
        const si   = s.findIndex((x: any) => x.id === sec?.id) + 1;
        const bi   = b.filter((x: any) => x.secteur_id === sec?.id).findIndex((x: any) => x.id === bra?.id) + 1;
        const acti = a.filter((x: any) => x.branche_id === bra?.id).findIndex((x: any) => x.id === act.id) + 1;
        return { ...act, naema_code: `S${si}-B${bi}-A${acti}` };
      }));
    }).catch(() => setActivites([]));
  }, []);
  return activites;
}

// ─── Modal Lier ───────────────────────────────────────────────────────────────
function LierModal({ classe, systeme, onClose, onSaved }: {
  classe: any; systeme: "citi" | "nace"; onClose: () => void; onSaved: () => void;
}) {
  const activites       = useActivitesNAEMA();
  const [selected,  setSelected]  = useState<number[]>([]);
  const [searchQ,   setSearchQ]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [ok,        setOk]        = useState(false);

  useEffect(() => {
    fetch(`${API}/classifications/${systeme}/classes/${classe.id}/correspondances`)
      .then(r => r.json())
      .then(d => setSelected(Array.isArray(d) ? d.map((c: any) => c.activite.id) : []))
      .catch(() => {});
  }, [classe.id, systeme]);

  const toggle = (id: number) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/classifications/${systeme}/classes/${classe.id}/correspondances`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naema_activite_ids: selected }),
      });
      setOk(true);
      setTimeout(() => { onClose(); onSaved(); }, 600);
    } catch { } finally { setSaving(false); }
  };

  const q = searchQ.toLowerCase();
  const filtered = activites.filter(a => !q || a.nom.toLowerCase().includes(q) || a.naema_code.toLowerCase().includes(q));
  const color = systeme === "citi" ? "#004f91" : "#7c3aed";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FAFAF9", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "88vh", border: "1px solid #E8E5E3", boxShadow: "0 32px 80px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 4, background: `linear-gradient(90deg,${color},#ca631f)` }} />
        <div style={{ padding: "18px 22px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: 3 }}>
                Lier à NAEMA · {systeme.toUpperCase()}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ fontSize: 13, fontWeight: 800, color, background: `${color}14`, padding: "2px 8px", borderRadius: 6 }}>{classe.full_code}</code>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{classe.libelle}</span>
              </div>
              <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>{selected.length} activité{selected.length > 1 ? "s" : ""} sélectionnée{selected.length > 1 ? "s" : ""}</p>
            </div>
            <button onClick={onClose} style={{ background: "#F2F0EF", border: "none", cursor: "pointer", borderRadius: 8, padding: 7 }}><X size={14} color="#4a5568" /></button>
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Rechercher une activité NAEMA…"
              style={{ width: "100%", paddingLeft: 32, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 22px 4px" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9aa5b4", padding: "24px 0", fontSize: 13 }}>
              {activites.length === 0 ? "Chargement…" : "Aucun résultat"}
            </p>
          ) : filtered.map((act: any) => {
            const sel = selected.includes(act.id);
            return (
              <button key={act.id} onClick={() => toggle(act.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: sel ? `${color}0d` : "transparent", textAlign: "left", marginBottom: 2 }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = sel ? `${color}0d` : "transparent"; }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? color : "#C5BFBB"}`, background: sel ? color : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                  {sel && <svg width="10" height="8" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <code style={{ fontSize: 10, fontWeight: 700, color: sel ? color : "#9aa5b4", background: sel ? `${color}14` : "#F2F0EF", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{act.naema_code}</code>
                <span style={{ fontSize: 13, color: sel ? "#1a1a2e" : "#4a5568", fontWeight: sel ? 600 : 400 }}>{act.nom}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: "12px 22px 18px", borderTop: "1px solid #F2F0EF", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #C5BFBB", background: "transparent", color: "#4a5568", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} disabled={saving || ok}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 9, border: "none", background: ok ? "#059669" : color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {ok ? <><Check size={13} /> Enregistré</> : saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</> : <><Link2 size={13} /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet générique CITI ou NACE ───────────────────────────────────────────
function OngletClassification({ systeme }: { systeme: "citi" | "nace" }) {
  const activites       = useActivitesNAEMA();
  const [stats,         setStats]         = useState<any>(null);
  const [classes,       setClasses]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [searchQ,       setSearchQ]       = useState("");
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [corrs,         setCorrs]         = useState<any[]>([]);
  const [corrsLoad,     setCorrsLoad]     = useState(false);
  const [deleting,      setDeleting]      = useState<number | null>(null);
  const [lierModal,     setLierModal]     = useState(false);

  const color = systeme === "citi" ? "#004f91" : "#7c3aed";
  const label = systeme === "citi" ? "CITI" : "NACE";

  const chargerStats = () =>
    fetch(`${API}/classifications/${systeme}/stats`).then(r => r.json()).then(setStats).catch(() => {});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/classifications/${systeme}/toutes-classes`).then(r => r.json()),
    ]).then(([cls]) => {
      setClasses(Array.isArray(cls) ? cls : []);
      setLoading(false);
    }).catch(() => setLoading(false));
    chargerStats();
  }, [systeme]);

  const chargerCorrs = async (cls: any) => {
    setCorrsLoad(true);
    try {
      const r = await fetch(`${API}/classifications/${systeme}/classes/${cls.id}/correspondances`);
      const data = await r.json();
      const enriched = (Array.isArray(data) ? data : []).map((c: any) => {
        const act = activites.find(a => a.id === c.activite.id);
        return { ...c, naema_code: act?.naema_code || "—" };
      });
      setCorrs(enriched);
    } finally { setCorrsLoad(false); }
  };

  const selectClass = (cls: any) => {
    setSelectedClass(cls);
    chargerCorrs(cls);
  };

  const delCorr = async (corrId: number) => {
    if (!selectedClass) return;
    setDeleting(corrId);
    await fetch(`${API}/classifications/${systeme}/classes/${selectedClass.id}/correspondances/${corrId}`, { method: "DELETE" });
    setDeleting(null);
    chargerCorrs(selectedClass);
    chargerStats();
    setClasses(prev => prev.map(c => c.id === selectedClass.id ? { ...c, nb_correspondances: Math.max(0, (c.nb_correspondances || 1) - 1) } : c));
  };

  const q = searchQ.toLowerCase();
  const classesFiltrees = classes.filter(c =>
    !q || c.libelle?.toLowerCase().includes(q) || `${c.section_code}${c.code}`.toLowerCase().includes(q)
  );

  const fullCode = (cls: any) => `${cls.section_code || ""}${cls.code}`;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Liste classes */}
      <div style={{ width: 420, flexShrink: 0, borderRight: "1px solid #E8E5E3", background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #F2F0EF" }}>
          {stats && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#4a5568" }}>
                <span style={{ fontWeight: 700, color }}>{stats.classes_liees}</span>
                <span style={{ color: "#9aa5b4" }}>/{stats.classes} classes liées</span>
              </span>
              <div style={{ width: 100, height: 5, background: "#F2F0EF", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${(stats.classes_liees / stats.classes) * 100}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.5s" }} />
              </div>
            </div>
          )}
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder={`Rechercher parmi ${classes.length} classes ${label}…`}
              style={{ width: "100%", paddingLeft: 32, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, outline: "none", boxSizing: "border-box" as const, fontFamily: "var(--font-google-sans)" }} />
          </div>
          {searchQ && <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 5 }}>{classesFiltrees.length} résultat{classesFiltrees.length > 1 ? "s" : ""}</p>}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} />
            </div>
          ) : classesFiltrees.map(cls => {
            const isSelected = selectedClass?.id === cls.id;
            const code = fullCode(cls);
            return (
              <button key={cls.id} onClick={() => selectClass(cls)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", border: "none", background: isSelected ? `${color}0f` : "transparent", cursor: "pointer", textAlign: "left", borderLeft: `3px solid ${isSelected ? color : "transparent"}`, borderBottom: "1px solid #F8F7F6" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? `${color}0f` : "transparent"; }}>
                <code style={{ fontSize: 10, fontWeight: 700, color: isSelected ? color : "#9aa5b4", background: isSelected ? `${color}14` : "#F2F0EF", padding: "2px 7px", borderRadius: 5, flexShrink: 0, minWidth: 52, textAlign: "center" as const }}>{code}</code>
                <span style={{ fontSize: 12, color: isSelected ? "#1a1a2e" : "#4a5568", fontWeight: isSelected ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cls.libelle}</span>
                {cls.nb_correspondances > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "rgba(5,150,105,0.12)", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>{cls.nb_correspondances}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panneau détail */}
      <div style={{ flex: 1, background: "#FAFAF9", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selectedClass ? (
          <>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F2F0EF", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <code style={{ fontSize: 14, fontWeight: 800, color, background: `${color}12`, padding: "3px 10px", borderRadius: 6 }}>{fullCode(selectedClass)}</code>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginTop: 6, lineHeight: 1.4, maxWidth: 480 }}>{selectedClass.libelle}</p>
                  <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 4 }}>{corrs.length} activité{corrs.length > 1 ? "s" : ""} NAEMA liée{corrs.length > 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => setLierModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  <Link2 size={13} /> Lier à NAEMA
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
              {corrsLoad ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={22} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} />
                </div>
              ) : corrs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "#9aa5b4" }}>
                  <Link2 size={36} style={{ marginBottom: 14, opacity: 0.2 }} />
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Aucune correspondance</p>
                  <p style={{ fontSize: 13 }}>Cliquez "Lier à NAEMA" pour associer des activités.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {corrs.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 10, background: "#fff", border: "1px solid #E8E5E3" }}>
                      <code style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", background: "#F2F0EF", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{c.naema_code}</code>
                      <span style={{ fontSize: 13, color: "#1a1a2e", flex: 1 }}>{c.activite.nom}</span>
                      <button onClick={() => delCorr(c.id)} disabled={deleting === c.id}
                        style={{ width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {deleting === c.id ? <Loader2 size={11} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} /> : <Unlink size={11} style={{ color: "#dc2626" }} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9aa5b4" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F2F0EF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Link2 size={28} style={{ opacity: 0.3 }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Sélectionnez une classe {label}</p>
            <p style={{ fontSize: 13, textAlign: "center", maxWidth: 300 }}>Cliquez sur une classe pour gérer ses correspondances NAEMA.</p>
          </div>
        )}
      </div>

      {lierModal && selectedClass && (
        <LierModal
          classe={{ ...selectedClass, full_code: fullCode(selectedClass) }}
          systeme={systeme}
          onClose={() => setLierModal(false)}
          onSaved={() => {
            setLierModal(false);
            chargerCorrs(selectedClass);
            chargerStats();
            setClasses(prev => prev.map(c =>
              c.id === selectedClass.id ? { ...c, nb_correspondances: corrs.length } : c
            ));
          }}
        />
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AdminClassifications() {
  const [onglet, setOnglet] = useState<"citi" | "nace">("citi");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-google-sans)", background: "#F2F0EF" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ padding: "20px 32px 0", background: "#fff", borderBottom: "1px solid #E8E5E3" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 4 }}>Administration · Classifications</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <h1 style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1a1a2e" }}>Correspondances ↔ NAEMA</h1>
        </div>
        {/* Onglets */}
        <div style={{ display: "flex", marginTop: 16 }}>
          {([
            { key: "citi", label: "CITI Rév.4 ↔ NAEMA", color: "#004f91" },
            { key: "nace", label: "NACE Rév.2.1 ↔ NAEMA", color: "#7c3aed" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              style={{ padding: "12px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", fontSize: 13, fontWeight: 700, color: onglet === t.key ? t.color : "#9aa5b4", borderBottom: `3px solid ${onglet === t.key ? t.color : "transparent"}`, transition: "all 0.15s", marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu de l'onglet sélectionné */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {onglet === "citi" && <OngletClassification systeme="citi" />}
        {onglet === "nace" && <OngletClassification systeme="nace" />}
      </div>
    </div>
  );
}
