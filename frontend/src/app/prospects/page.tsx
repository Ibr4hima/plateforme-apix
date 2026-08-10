"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Building2 } from "lucide-react";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import PanneauFiltres, { CompteurResultats, carteCliquable } from "@/components/shared/PanneauFiltres";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { badge_bleu, badge_vert, badge_rouge, badge_gris } from "@/lib/couleurs";
import { SideFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrl } from "@/lib/ficheUrl";
import ProspectVueModal, { ilYa, badgeProspect } from "@/components/shared/ProspectVueModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Statuts : un seul mapping jeton + couleur, partagé par les cartes et le
// filtre. Trois copies vivaient dans ce fichier, dont deux recréées à chaque
// carte rendue.
const STATUT_BADGE: Record<string, React.CSSProperties> = {
  "En cours":             badge_vert,
  "À recontacter":        badge_bleu,
  "Installation à venir": badge_vert,
  "Inactif":              badge_rouge,
  "Décliné":              badge_gris,
  "En attente":           badge_gris,
};
const STATUT_COULEUR: Record<string, string> = {
  "En cours": "var(--vert)", "À recontacter": "var(--bleu)", "Installation à venir": "var(--vert)",
  "Inactif": "var(--danger)", "Décliné": "var(--gris)", "En attente": "var(--gris)",
};

// ── Carte prospect ────────────────────────────────────────────────────────────

function CarteProspect({ p, onglet, onOpen, onOpenInfos }: { p: any; onglet: "cibles" | "historique" | "termines"; onOpen?: () => void; onOpenInfos?: () => void }) {
  const badge = badgeProspect(p);
  const tel = p.telephones?.[0] || p.points_focaux?.[0]?.telephones?.[0] || "";
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

  const badgeStatut = badge ? (STATUT_BADGE[badge.label] || badge_gris) : null;
  const hoverC = badge ? (STATUT_COULEUR[badge.label] || "var(--gris)") : "rgb(var(--bleu-rgb) / 0.33)";

  return (
    <div {...(onOpen ? carteCliquable(onOpen, `Ouvrir la fiche : ${p.nom}`) : {})}
      style={{ background: "var(--carte)", border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16, cursor: onOpen ? "pointer" : "default", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "none", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--ombre-1)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = hoverC; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)"; }}>

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Dénomination + siège | badge de statut à droite */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--encre)", lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
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
              return sousTitre && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--gris)", marginTop: 3 }}>{sousTitre}</div>;
            })()}
          </div>
          {onglet !== "cibles" && badge && badgeStatut && (
            <span style={{ ...badgeStatut, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Infos en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--bordure)", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>Pays</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: p.siege_nom ? "var(--encre)" : "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.siege_nom || "—"}</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--fond)", margin: "0 18px" }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>{info2.label}</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: info2.value ? "var(--encre)" : "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>{info2.value || "—"}</p>
          </div>
        </div>
      </div>

      {/* Actions (deux cibles de clic distinctes : la barre reste nécessaire) */}
      {(onglet === "historique" || onglet === "termines") && (
        <div style={{ display: "flex", borderTop: "1px solid var(--bordure)" }}>
          <div role="button" tabIndex={0}
            onKeyDown={ev => { ev.stopPropagation(); if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpenInfos?.(); } }}
            onClick={ev => { ev.stopPropagation(); onOpenInfos?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "var(--bleu)", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Infos investisseur
          </div>
          <div style={{ width: 1, background: "var(--fond)" }}/>
          <div role="button" tabIndex={0}
            onKeyDown={ev => { ev.stopPropagation(); if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen?.(); } }}
            onClick={ev => { ev.stopPropagation(); onOpen?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "var(--bleu)", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
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
  const [statutSel,   setStatutSel]   = useState<string[]>([]);

  // Statuts filtrables selon l'onglet (issus de badgeProspect) :
  // « en contact » → progression du cycle ; « transformés » → issue finale.
  const statutOpts = onglet === "historique"
    ? ["En cours", "À recontacter", "Inactif"]
    : onglet === "termines"
    ? ["Installation à venir", "Décliné"]
    : [];
  // Le jeu de statuts change d'un onglet à l'autre : on repart à zéro au switch.
  useEffect(() => { setStatutSel([]); }, [onglet]);

  const [erreur, setErreur] = useState(false);
  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
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
    } catch (e) { console.error(e); setErreur(true); }
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
      if (statutSel.length > 0) { const st = badgeProspect(p)?.label; if (!st || !statutSel.includes(st)) return false; }
      return true;
    });
  }, [onglet, cibles, enContact, termines, recherche, paysSel, secteursSel, statutSel]);

  const togglePays    = (v: string) => setPaysSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur = (v: string) => setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleStatut  = (v: string) => setStatutSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = !!recherche || paysSel.length > 0 || secteursSel.length > 0 || statutSel.length > 0;
  const reinit = () => { setRecherche(""); setPaysSel([]); setSecteursSel([]); setStatutSel([]); };
  const nbFiltres = (recherche ? 1 : 0) + paysSel.length + secteursSel.length + statutSel.length;

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* ── Hero ── */}
      <BarreTitre titre="Prospects" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[
          { v:"cibles",     l:"Investisseurs ciblés", count: cibles.length },
          { v:"historique", l: enContact.length > 1 ? "Investisseurs en contact" : "Investisseur en contact", count: enContact.length },
          { v:"termines",   l: termines.length  > 1 ? "Investisseurs transformés" : "Investisseur transformé", count: termines.length },
        ]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Corps : sidebar + grille ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
          recherche={recherche} setRecherche={setRecherche}>
              <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
              {statutOpts.length > 0 && <><SideFilter label="Statut" color="var(--bleu)" colorOf={v => STATUT_COULEUR[v] || "var(--bleu)"} items={statutOpts} selected={statutSel} onToggle={toggleStatut} /><div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} /></>}
              {paysOpts.length > 0 && <SideFilter label="Pays / Siège" color="var(--bleu)" items={paysOpts} selected={paysSel} onToggle={togglePays} listMaxHeight={180} />}
              {secteurOpts.length > 0 && <><div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} /><SideFilter label="Secteur" color="var(--bleu)" items={secteurOpts} selected={secteursSel} onToggle={toggleSecteur} listMaxHeight={180} /></>}
        </PanneauFiltres>

        {/* Grille */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "36px 40px 80px" }}>
          {loading ? (
            <SkeletonCards n={9} cols={3} height={200} />
          ) : erreur ? (
            <ErreurChargement onRetry={() => charger()} />
          ) : listeCourante.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--gris)" }}>
              <Building2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucun prospect trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
              {hasFilter && <BoutonEffacerFiltres onClick={reinit}/>}
            </div>
          ) : (
            <>
            <CompteurResultats n={listeCourante.length} singulier="prospect" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
              {listeCourante.map(p => <CarteProspect key={p.id} p={p} onglet={onglet} onOpen={() => { setSelecInfos(false); setSelec(p); }} onOpenInfos={() => { setSelecInfos(true); setSelec(p); }} />)}
            </div>
            </>
          )}
        </div>
      </div>

      {selec && <ProspectVueModal p={selec} onglet={selecInfos ? "cibles" : onglet} onClose={() => setSelec(null)} />}
    </main>
  );
}
