"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Building2, ChevronDown, ChevronUp, Clock, FileText, Globe, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Phone, Search, Send, SlidersHorizontal, User, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useNaema } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { foncerPastel } from "@/lib/couleurs";
import { demarrerRedimension } from "@/lib/redimension";
import { SideFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrl } from "@/lib/ficheUrl";
import ProspectVueModal, { ilYa, badgeProspect, cycleCourantDebut, contraintesCycleCourant, canalIcon } from "@/components/shared/ProspectVueModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Helpers ───────────────────────────────────────────────────────────────────


// ── Carte prospect ────────────────────────────────────────────────────────────

function CarteProspect({ p, onglet, onOpen, onOpenInfos }: { p: any; onglet: "cibles" | "historique" | "termines"; onOpen?: () => void; onOpenInfos?: () => void }) {
  const badge = badgeProspect(p);
  const tel = p.telephones?.[0] || p.points_focaux?.[0]?.telephones?.[0] || "";
  const mail = p.mails?.[0] || p.points_focaux?.[0]?.mails?.[0] || "";
  const nbActs = (p.activite_ids || []).length;
  // Second bloc libellé, contextuel selon l'onglet
  const info2 = onglet === "cibles"
    ? { label: "Téléphone", value: tel ? fmtPhone(tel) : null }
    : onglet === "historique"
    ? { label: "Dernier échange", value: p.date_dernier_echange ? fmtDate(p.date_dernier_echange) : null }
    : (p.issue === "installe"
        ? { label: "Accord conclu", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : p.issue === "decline"
        ? { label: "Décliné le", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : { label: "Conclusion", value: null });

  // Statuts en pastels (fond très clair, texte foncé de la même teinte)
  const PASTELS: Record<string, string> = {
    "En cours":             "#B4DE9D", // vert tendre
    "En attente":           "#D5D2CE", // gris chaud
    "Inactif":              "#E6AC9D", // corail
    "À recontacter":        "#9DC3E6", // bleu clair
    "Installation à venir": "#B4DE9D", // vert tendre
    "Décliné":              "#D5D2CE", // gris chaud
  };
  const pastel = badge ? (PASTELS[badge.label] || "#C5BFBB") : null;
  const hoverC = pastel || "rgba(0,79,145,0.33)";

  return (
    <div onClick={onOpen}
      style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 16, cursor: onOpen ? "pointer" : "default", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 14px 32px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = hoverC; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Dénomination + siège | badge de statut à droite */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1a1a2e", lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
            {(() => {
              const rel = onglet === "cibles" && p.created_at ? (() => {
                    const r = ilYa(p.created_at);
                    if (!r) return null;
                    return r === "Aujourd'hui" ? "Ciblé aujourd'hui" : `Ciblé depuis ${r.replace("Il y a ", "")}`;
                  })()
                : onglet === "historique" ? ilYa(p.date_dernier_echange)
                : onglet === "termines" && p.issue_conclu_le ? (() => {
                    const r = ilYa(p.issue_conclu_le);
                    if (!r) return null;
                    const suffixe = r === "Aujourd'hui" ? "aujourd'hui" : r.replace("Il y a", "il y a");
                    return `${p.issue === "decline" ? "Décliné" : "Conclu"} ${suffixe}`;
                  })()
                : null;
              const sousTitre = rel ?? p.siege_nom;
              return sousTitre && <div style={{ fontSize: 11, fontWeight: 500, color: "#9aa5b4", marginTop: 3 }}>{sousTitre}</div>;
            })()}
          </div>
          {onglet !== "cibles" && badge && pastel && (
            <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: foncerPastel(pastel), background: `${pastel}40`, border: `1px solid ${pastel}90`, padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Infos en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #F2F0EF", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>Pays</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: p.siege_nom ? "#1a1a2e" : "#C5BFBB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.siege_nom || "—"}</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#F2F0EF", margin: "0 18px" }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#9aa5b4", textTransform: "uppercase" as const, marginBottom: 4 }}>{info2.label}</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: info2.value ? "#1a1a2e" : "#C5BFBB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>{info2.value || "—"}</p>
          </div>
        </div>
      </div>

      {/* Actions (deux cibles de clic distinctes : la barre reste nécessaire) */}
      {(onglet === "historique" || onglet === "termines") && (
        <div style={{ display: "flex", borderTop: "1px solid #F2F0EF" }}>
          <div onClick={ev => { ev.stopPropagation(); onOpenInfos?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Infos investisseur
          </div>
          <div style={{ width: 1, background: "#F2F0EF" }}/>
          <div onClick={ev => { ev.stopPropagation(); onOpen?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Voir les échanges
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal fiche prospect (lecture seule) ──────────────────────────────────────

// ── Page principale ───────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const [onglet, setOnglet] = useEtatUrl<"cibles" | "historique" | "termines">("onglet", "cibles", ["cibles","historique","termines"]);

  // Données
  const [cibles,    setCibles]    = useState<any[]>([]);
  const [enContact, setEnContact] = useState<any[]>([]);
  const [termines,  setTermines]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selec,     setSelec]     = useState<any>(null);
  const [selecInfos, setSelecInfos] = useState(false);
  // Ouverture directe depuis la recherche globale (⌘K) — cherche dans les 3 onglets
  const tousProspects = useMemo(() => [...cibles, ...enContact, ...termines], [cibles, enContact, termines]);
  useFicheUrl(tousProspects, p => { setSelecInfos(false); setSelec(p); });

  // Filtres
  const [recherche,   setRecherche]   = useState("");
  const [paysOpts,    setPaysOpts]    = useState<string[]>([]);
  const [paysSel,     setPaysSel]     = useState<string[]>([]);
  const [secteurOpts, setSecteurOpts] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);

  // Sidebar
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 480);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e, t] = await Promise.all([
        fetchTous(`${API_BASE}/prospects?conclu=false&contactes=false`),
        fetchTous(`${API_BASE}/prospects?conclu=false&contactes=true`),
        fetchTous(`${API_BASE}/prospects?conclu=true`),
      ]);
      setCibles(c);
      setEnContact(e);
      setTermines(t);

      const tous = [...c, ...e, ...t];
      const pays = [...new Set(tous.map((p: any) => p.siege_nom).filter(Boolean))] as string[];
      const secs = [...new Set(tous.flatMap((p: any) => p.secteur_noms || []).filter(Boolean))] as string[];
      setPaysOpts(pays.sort());
      setSecteurOpts(secs.sort());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Filtrage (mémoïsé : recalculé uniquement quand données ou filtres changent)
  const listeCourante = useMemo(() => {
    const liste = onglet === "cibles" ? cibles : onglet === "historique" ? enContact : termines;
    return liste.filter(p => {
      if (recherche) {
        const q = recherche.toLowerCase();
        if (!p.nom?.toLowerCase().includes(q)) return false;
      }
      if (paysSel.length > 0 && !paysSel.includes(p.siege_nom || "")) return false;
      if (secteursSel.length > 0 && !secteursSel.some((s: string) => (p.secteur_noms || []).includes(s))) return false;
      return true;
    });
  }, [onglet, cibles, enContact, termines, recherche, paysSel, secteursSel]);

  const togglePays    = (v: string) => setPaysSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur = (v: string) => setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = !!recherche || paysSel.length > 0 || secteursSel.length > 0;
  const reinit = () => { setRecherche(""); setPaysSel([]); setSecteursSel([]); };
  const nbFiltres = (recherche ? 1 : 0) + paysSel.length + secteursSel.length;

  const total = cibles.length + enContact.length + termines.length;

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
      <Navbar />

      {/* ── Hero ── */}
      <BarreTitre titre="Prospects">
        <BarreTitreSegment options={[
          { v:"cibles",     l:"Investisseurs ciblés", count: cibles.length },
          { v:"historique", l: enContact.length > 1 ? "Investisseurs en contact" : "Investisseur en contact", count: enContact.length },
          { v:"termines",   l: termines.length  > 1 ? "Investisseurs transformés" : "Investisseur transformé", count: termines.length },
        ]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Corps : sidebar + grille ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* Sidebar */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 64px)", overflowY: "auto" as const, position: "sticky" as const, top: 64, display: "flex", flexDirection: "column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.3)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
                {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen && hasFilter && <button onClick={reinit} title="Tout réinitialiser"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#dc2626", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen && (
            <div style={{ padding: "16px", overflowY: "auto" as const, flex: 1 }}>
              {/* Recherche */}
              <div style={{ position: "relative" as const, marginBottom: 18 }}>
                <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
                <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
                  style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                {recherche && <button onClick={() => setRecherche("")} style={{ position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
              </div>
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
              {paysOpts.length > 0 && <SideFilter label="Pays / Siège" color="#004f91" items={paysOpts} selected={paysSel} onToggle={togglePays} listMaxHeight={180} />}
              {secteurOpts.length > 0 && <><div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} /><SideFilter label="Secteur" color="#004f91" items={secteurOpts} selected={secteursSel} onToggle={toggleSecteur} listMaxHeight={180} /></>}
            </div>
          )}
        </aside>

        {/* Grille */}
        <div style={{ flex: 1, minWidth: 0, padding: "36px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
            </div>
          ) : listeCourante.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <Building2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun prospect trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
              {hasFilter && <BoutonEffacerFiltres onClick={reinit}/>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
              {listeCourante.map(p => <CarteProspect key={p.id} p={p} onglet={onglet} onOpen={() => { setSelecInfos(false); setSelec(p); }} onOpenInfos={() => { setSelecInfos(true); setSelec(p); }} />)}
            </div>
          )}
        </div>
      </div>

      {selec && <ProspectVueModal p={selec} onglet={selecInfos ? "cibles" : onglet} onClose={() => setSelec(null)} />}
    </main>
  );
}
