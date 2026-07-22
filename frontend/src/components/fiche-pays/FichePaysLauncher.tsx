"use client";

// Lanceur « Fiche Pays » (navbar) : ouvre un modal de sélection de DEUX pays
// (Sénégal épinglé en référence), puis « Générer la fiche » navigue vers la
// page /fiche-pays où l'on peut ensuite changer les pays sans quitter.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"];

type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

function ouvrirFiche(ids: number[]) {
  window.location.href = `/fiche-pays?pays=${ids.join(",")}`;
}

// ── Sélecteur de pays (modal) ─────────────────────────────────────────────────
function FichePaysPicker({ pays, senId, initial, onClose }: {
  pays: Pays[]; senId: number | null; initial: number[]; onClose: () => void;
}) {
  const MAX = 2;
  const [sel, setSel] = useState<number[]>(initial.length ? initial.slice(0, MAX) : (senId ? [senId] : []));
  const [search, setSearch] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  const couleur = (id: number) => PALETTE[sel.indexOf(id) % PALETTE.length];

  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Pays[]>> = {};
    pays.filter(p => !search || p.nom.toLowerCase().includes(search.toLowerCase()))
      .forEach(p => { const c = p.continent || "Autre"; const z = p.region_geo || "Autre"; ((g[c] ||= {})[z] ||= []).push(p); });
    for (const c of Object.keys(g)) for (const z of Object.keys(g[c]))
      g[c][z].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [pays, search]);
  useEffect(() => { if (search) setOpenConts(new Set(Object.keys(grouped))); }, [search, grouped]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const clickPays = (id: number) => setSel(prev => prev.includes(id)
    ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
    : (prev.length >= MAX ? prev : [...prev, id]));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 400, maxHeight: "84vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,#003a6e,#1a6ab0)", flexShrink: 0 }} />
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: 0 }}>Fiche Pays</h2>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.12)", padding: "2px 8px", borderRadius: 999 }}>{sel.length}/{MAX}</span>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={14} color="#4a5568" />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pays…" autoFocus
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 9, paddingBottom: 9, borderRadius: 9, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 18px" }}>
          {/* Sénégal épinglé (référence) */}
          {senId !== null && (() => {
            const on = sel.includes(senId);
            const col = on ? couleur(senId) : "#C5BFBB";
            const removable = on && sel.length > 1;
            const canAdd = !on && sel.length < MAX;
            return (
              <div style={{ marginBottom: 8, marginLeft: 6 }}>
                <button onClick={() => { if (removable) setSel(prev => prev.filter(x => x !== senId)); else if (canAdd) setSel(prev => [...prev, senId]); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#4a5568", fontWeight: on ? 700 : 400 }}>Sénégal</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                </button>
              </div>
            );
          })()}
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
          {sortContinents(Object.keys(grouped)).map(continent => {
            const isOpen = openConts.has(continent);
            const zones = grouped[continent];
            return (
              <div key={continent} style={{ marginBottom: 6 }}>
                <button onClick={() => toggleCont(continent)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgba(0,79,145,0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                  <ChevronDown size={11} style={{ color: "#004f91", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                </button>
                {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                  <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                    <p style={{ fontSize: 9, fontWeight: 600, color: "#C5BFBB", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                    {paysInZone.map(p => {
                      const on = sel.includes(p.id);
                      const col = on ? couleur(p.id) : "#C5BFBB";
                      const disabled = !on && sel.length >= MAX;
                      if (p.id === senId) return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                          <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4" }}>Réf.</span>
                        </div>
                      );
                      return (
                        <button key={p.id} onClick={() => clickPays(p.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: "transparent", textAlign: "left", width: "100%", opacity: disabled ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!disabled && !on) e.currentTarget.style.background = "#F8F7F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#4a5568", fontWeight: on ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {sel.map(id => { const p = pays.find(x => x.id === id); const canRemove = sel.length > 1; return p ? (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: couleur(id), background: `${couleur(id)}12`, padding: "3px 5px 3px 9px", borderRadius: 999 }}>
                {p.nom}
                <button onClick={() => canRemove && setSel(prev => prev.filter(x => x !== id))} disabled={!canRemove} title={canRemove ? `Retirer ${p.nom}` : "Au moins un pays requis"}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "none", padding: 0, background: "transparent", color: couleur(id), cursor: canRemove ? "pointer" : "not-allowed", opacity: canRemove ? 1 : 0.35 }}
                  onMouseEnter={e => { if (canRemove) e.currentTarget.style.background = `${couleur(id)}22`; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <X size={10} strokeWidth={2.6} />
                </button>
              </span>
            ) : null; })}
          </div>
          <button onClick={() => sel.length === MAX && ouvrirFiche(sel)} disabled={sel.length !== MAX}
            title={sel.length !== MAX ? "Sélectionnez deux pays" : undefined}
            style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: sel.length === MAX ? "pointer" : "not-allowed", opacity: sel.length === MAX ? 1 : 0.4, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap", flexShrink: 0 }}>
            Générer la fiche
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sélecteur global (monté une fois dans Providers) ──────────────────────────
// Écoute les événements d'ouverture, indépendamment de la navbar (retirée de la
// plupart des pages). Le menu et la recherche ⌘K déclenchent ces événements.
export function FichePaysPickerGlobal() {
  const [pays, setPays] = useState<Pays[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);
  useEffect(() => { fetch(`${API}/statistiques/pays`).then(r => r.json()).then(setPays).catch(() => {}); }, []);
  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);
  // Recherche globale ⌘K : ouvre directement la fiche Sénégal × pays choisi
  useEffect(() => {
    const h = (e: Event) => {
      const paysId = (e as CustomEvent).detail?.paysId;
      if (paysId == null) return;
      ouvrirFiche(senId !== null && senId !== paysId ? [senId, paysId] : [paysId]);
    };
    window.addEventListener("apix:fiche-pays", h);
    return () => window.removeEventListener("apix:fiche-pays", h);
  }, [senId]);
  // Ouverture du sélecteur depuis le menu
  useEffect(() => {
    const open = () => setPickerOpen(true);
    window.addEventListener("apix:fiche-pays-picker", open);
    return () => window.removeEventListener("apix:fiche-pays-picker", open);
  }, []);

  if (!monte || !pickerOpen) return null;
  return createPortal(
    <FichePaysPicker pays={pays} senId={senId} initial={senId ? [senId] : []} onClose={() => setPickerOpen(false)} />,
    document.body);
}

// ── Lanceur (navbar) ──────────────────────────────────────────────────────────
// Simple déclencheur : ouvre le sélecteur global via l'événement.
export default function FichePaysLauncher({ textColor, textHover }: { textColor: string; textHover: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event("apix:fiche-pays-picker"))}
      style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
      Fiche Pays
    </button>
  );
}
