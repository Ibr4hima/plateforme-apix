"use client";

// Investissements projetés — les projets annoncés relevés par fDi Markets
// (Financial Times).
//
// Ce que cette page dit et que « Investissements réalisés » ne dit pas : la
// CNUCED mesure ce qui est ENTRÉ, une fois l'argent versé et compté dans la
// balance des paiements ; fDi relève ce qui a été ANNONCÉ, projet par projet,
// avec son entreprise, son secteur et son pays. Les deux ne se contredisent
// pas — ils regardent deux moments différents de la même décision.
//
// UNE SEULE QUESTION. Un projet a deux pays, celui d'où part l'investissement
// et celui où il arrive ; cette page ne pose que la seconde question : qu'un
// pays REÇOIT-il ? Le pays d'origine se lit alors comme le partenaire, dans
// les classements et sur chaque projet.
//
// UNE SEULE RÈGLE DE CHIFFRE : compteurs, séries et classements sortent tous du
// même filtre que la table du bas. Un chiffre qu'on ne retrouve pas dans la
// liste en dessous est un chiffre qu'on ne peut pas défendre en réunion.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import { badge_bleu, badge_vert, badge_violet } from "@/lib/couleurs";
import FicheModal from "@/components/shared/FicheModal";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { demarrerRedimension } from "@/lib/redimension";
import { API, BadgePeriode, fmtNombre } from "./partage";

type Compte = { nom: string; nb: number };
type Perimetre = {
  sens: string; annees: [number | null, number | null]; total_projets: number;
  pays: Compte[]; secteurs: Compte[]; activites: Compte[]; types: Compte[];
};
type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null };
type Projet = {
  id: number; periode: string; annee: number; entreprise: string | null;
  entreprise_a_arbitrer: boolean;
  pays: string | null; pays_iso: string | null;
  partenaire: string | null; partenaire_iso: string | null;
  secteur: string | null; sous_secteur: string | null; activite: string | null;
  type_projet: string | null; capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
  description_fr: string | null; description_en: string | null;
};
type Reponse = {
  sens: string;
  kpis: { projets: number; capex_musd: number | null; emplois: number | null;
          capex_moyen: number | null; entreprises: number; partenaires: number;
          part_estimee: number | null; annees: [number | null, number | null] };
  par_annee: { annee: number; nb: number; capex_musd: number | null; emplois: number | null }[];
  tops: Record<"partenaires" | "secteurs" | "activites" | "entreprises" | "types", Rang[]>;
  projets: Projet[];
};

const VUES = [
  { v: "projets" as const, l: "Projets", src: "Project database" },
  { v: "signaux" as const, l: "Signaux d'investissement", src: "Investor signals" },
  { v: "entreprises" as const, l: "Entreprises", src: "Company database" },
];

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-06 » → « Juin 2026 ». La source ne donne jamais le jour ; écrire le
    mois en toutes lettres évite de faire lire une date comme un code. */
function moisEnClair(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  const nom = MOIS_FR[Number(m[2]) - 1];
  return nom ? `${nom[0].toUpperCase()}${nom.slice(1)} ${m[1]}` : periode;
}

const TITRE_SS = { fontSize: 11, fontWeight: 700, color: "var(--gris)",
  textTransform: "uppercase" as const, letterSpacing: "0.1em" };

/** Un groupe de cases à cocher, avec le nombre de projets de chaque valeur.
    Le compte n'est pas décoratif : il dit d'avance si le filtre laissera
    quelque chose, et évite de cliquer pour découvrir un écran vide. */
function Facette({ titre, options, choix, setChoix, max = 6 }: {
  titre: string; options: Compte[]; choix: string[]; setChoix: (v: string[]) => void; max?: number;
}) {
  const [tout, setTout] = useState(false);
  if (options.length === 0) return null;
  const visibles = tout ? options : options.slice(0, max);
  const bascule = (n: string) => setChoix(choix.includes(n) ? choix.filter(x => x !== n) : [...choix, n]);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={TITRE_SS}>{titre}</span>
        {choix.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)",
            background: "rgb(var(--bleu-rgb) / 0.18)", padding: "1px 6px", borderRadius: 999 }}>{choix.length}</span>
        )}
      </div>
      {visibles.map(o => {
        const sel = choix.includes(o.nom);
        return (
          <button key={o.nom} onClick={() => bascule(o.nom)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7,
              border: "none", cursor: "pointer", background: "transparent", textAlign: "left" as const, width: "100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`,
              background: sel ? "var(--bleu)" : "transparent", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
              {sel && <span style={{ color: "var(--carte)", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </span>
            <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{o.nom}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
              fontVariantNumeric: "tabular-nums" }}>{o.nb}</span>
          </button>
        );
      })}
      {options.length > max && (
        <button onClick={() => setTout(t => !t)}
          style={{ marginTop: 4, marginLeft: 8, background: "none", border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, color: "var(--bleu)", fontFamily: "var(--font-google-sans)", padding: 0 }}>
          {tout ? "Voir moins" : `Voir les ${options.length}`}
        </button>
      )}
    </div>
  );
}

/** Une base annoncée, pas encore chargée : dire ce qu'elle contiendra vaut
    mieux qu'un onglet muet. */
function ABientot({ vue }: { vue: "signaux" | "entreprises" }) {
  const t = vue === "signaux"
    ? { titre: "Signaux d'investissement",
        quoi: "Les intentions déclarées par les entreprises — recrutement, recherche de site, levée de fonds — repérées en amont de tout projet annoncé. C'est le stade où la prospection a encore prise." }
    : { titre: "Entreprises",
        quoi: "Les investisseurs eux-mêmes : siège, secteur, et l'historique de leurs implantations dans le monde. C'est ce qui permet de savoir qui approcher, et avec quel argument." };
  return (
    <div style={{ maxWidth: 620, margin: "80px auto", textAlign: "center" as const }}>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--encre)", marginBottom: 12 }}>{t.titre}</h2>
      <p style={{ fontSize: 14, color: "var(--gris-fort)", lineHeight: 1.8, marginBottom: 14 }}>{t.quoi}</p>
      <p style={{ fontSize: 13, color: "var(--gris)", lineHeight: 1.7 }}>
        Cette base de fDi Markets n&apos;est pas encore chargée. Les projets annoncés, eux, le sont :
        ils se consultent dans l&apos;onglet <strong>Projets</strong>.
      </p>
    </div>
  );
}

export default function OngletFdi() {
  const [vue, setVue] = useState<"projets" | "signaux" | "entreprises">("projets");
  const [pays, setPays] = useState<string | null>(null);
  const [secteurs, setSecteurs] = useState<string[]>([]);
  const [activites, setActivites] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [chercherPays, setChercherPays] = useState("");
  const [anneeMin, setAnneeMin] = useState<number | null>(null);
  const [anneeMax, setAnneeMax] = useState<number | null>(null);
  // Le projet dont la fiche est ouverte, par identifiant.
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const rechercheD = useDebounced(recherche, 300);

  // Reprise de l'état porté par l'URL, une seule fois au montage : c'est par
  // là que revient le lecteur qui ferme le rapport.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const liste = (cle: string) => (p.get(cle) ?? "").split("|").filter(Boolean);
    const v = p.get("vue");
    if (v === "signaux" || v === "entreprises") setVue(v);
    if (p.get("pays")) setPays(p.get("pays"));
    if (p.get("a0")) setAnneeMin(Number(p.get("a0")));
    if (p.get("a1")) setAnneeMax(Number(p.get("a1")));
    if (liste("sec").length) setSecteurs(liste("sec"));
    if (liste("act").length) setActivites(liste("act"));
    if (liste("typ").length) setTypes(liste("typ"));
    if (p.get("q")) setRecherche(p.get("q") as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le périmètre dépend du sens : les pays proposés sont ceux qui existent
  // DANS CE SENS. Basculer de destination à source ne doit pas laisser un pays
  // qui n'y a aucun projet.
  const qPer = useDonnees<Perimetre>(`${API}/fdi/public/perimetre`, { garder: true });
  const per = qPer.data;

  // Premier pays du sens (le mieux fourni) tant que rien n'est choisi, et
  // retour à ce défaut si le pays courant sort du périmètre.
  useEffect(() => {
    if (!per?.pays?.length) return;
    if (!pays || !per.pays.some(p => p.nom === pays)) setPays(per.pays[0].nom);
  }, [per, pays]);

  useEffect(() => {
    if (!per?.annees) return;
    setAnneeMin(a => a ?? per.annees[0]);
    setAnneeMax(a => a ?? per.annees[1]);
  }, [per]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (pays) p.set("pays", pays);
    if (anneeMin != null) p.set("annee_min", String(anneeMin));
    if (anneeMax != null) p.set("annee_max", String(anneeMax));
    if (secteurs.length) p.set("secteurs", secteurs.join("|"));
    if (activites.length) p.set("activites", activites.join("|"));
    if (types.length) p.set("types", types.join("|"));
    if (rechercheD.trim()) p.set("recherche", rechercheD.trim());
    return `${API}/fdi/public/projets?${p}`;
  }, [pays, anneeMin, anneeMax, secteurs, activites, types, rechercheD]);

  const q = useDonnees<Reponse>(url, { garder: true });
  const d = q.data;


  const bornes = per?.annees ?? [null, null];
  const nbFiltres = secteurs.length + activites.length + types.length
    + (rechercheD.trim() ? 1 : 0)
    + ((anneeMin !== bornes[0] || anneeMax !== bornes[1]) ? 1 : 0);
  // L'état de la page s'écrit dans l'URL — vue, pays, période, facettes,
  // recherche. Trois raisons : le lien devient partageable, F5 ne perd rien,
  // et le rapport peut ramener EXACTEMENT ici, filtres compris.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    p.set("section", "projetes");
    const poser = (cle: string, v: string | null | undefined) => {
      if (v) p.set(cle, v); else p.delete(cle);
    };
    poser("vue", vue === "projets" ? null : vue);
    poser("pays", pays);
    poser("a0", anneeMin != null && anneeMin !== bornes[0] ? String(anneeMin) : null);
    poser("a1", anneeMax != null && anneeMax !== bornes[1] ? String(anneeMax) : null);
    poser("sec", secteurs.join("|"));
    poser("act", activites.join("|"));
    poser("typ", types.join("|"));
    poser("q", rechercheD.trim());
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
  }, [vue, pays, anneeMin, anneeMax, secteurs, activites, types, rechercheD, bornes]);

  const reinit = () => {
    setSecteurs([]); setActivites([]); setTypes([]); setRecherche("");
    setAnneeMin(bornes[0]); setAnneeMax(bornes[1]);
  };

  const paysFiltres = (per?.pays ?? []).filter(p =>
    !chercherPays || p.nom.toLowerCase().includes(chercherPays.toLowerCase()));

  const ficheOuverte = (d?.projets ?? []).find(p => p.id === ouvert) ?? null;

  const tag = d?.kpis?.annees?.[0] != null
    ? (d.kpis.annees[0] === d.kpis.annees[1] ? `${d.kpis.annees[0]}` : `${d.kpis.annees[0]} — ${d.kpis.annees[1]}`)
    : undefined;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0,
        transition: isResizing.current ? "none" : "width 0.25s", background: "var(--carte)",
        borderRight: "1px solid var(--bordure-forte)", height: "100%", overflowY: "auto" as const,
        overscrollBehavior: "contain" as const, display: "flex", flexDirection: "column" as const }}>
        {sidebarOpen && (
          <div onMouseDown={e => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520)}
            style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4,
              cursor: "col-resize", zIndex: 10, background: "transparent" }} />
        )}
        <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px",
          borderBottom: "1px solid var(--bordure)", display: "flex", alignItems: "center",
          justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
          {sidebarOpen && <span style={{ ...TITRE_SS, fontSize: 12, color: "var(--encre)" }}>Filtres</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSidebarOpen(o => !o)}
              aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"}
              style={{ background: "rgb(var(--bleu-rgb) / 0.08)", border: "none", cursor: "pointer",
                borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <SlidersHorizontal size={14} style={{ color: "var(--bleu)" }} />
              {sidebarOpen && nbFiltres > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)",
                  background: "rgb(var(--bleu-rgb) / 0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>
              )}
            </button>
            {sidebarOpen && nbFiltres > 0 && (
              <button onClick={reinit} title="Tout réinitialiser"
                style={{ background: "rgb(var(--danger-rgb) / 0.08)", border: "1px solid rgb(var(--danger-rgb) / 0.20)",
                  cursor: "pointer", borderRadius: 999, padding: 5, display: "flex", alignItems: "center" }}>
                <X size={13} style={{ color: "var(--danger)" }} />
              </button>
            )}
          </div>
        </div>

        {sidebarOpen && (
          <div style={{ padding: 16, overflowY: "auto" as const, flex: 1 }}>
            {/* Vue : les trois bases de fDi Markets */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ ...TITRE_SS, display: "block", marginBottom: 8 }}>Vue</span>
              {VUES.map(o => {
                const sel = vue === o.v;
                return (
                  <button key={o.v} onClick={() => setVue(o.v)}
                    title={`fDi Markets · ${o.src}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7,
                      border: "none", cursor: "pointer", width: "100%", textAlign: "left" as const,
                      background: sel ? "rgb(var(--bleu-rgb) / 0.10)" : "transparent" }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <span style={{ fontSize: 12.5, color: sel ? "var(--bleu)" : "var(--texte)", fontWeight: sel ? 700 : 400 }}>{o.l}</span>
                  </button>
                );
              })}
            </div>

            {vue === "projets" && (
              <>
                <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />

                {/* Les pays qui REÇOIVENT les projets. La base porte les deux
                    bouts de chaque projet, mais la question posée ici est
                    toujours la même : qu'est-ce qu'un pays attire ? Offrir la
                    lecture inverse ajoutait un choix sans ajouter de réponse. */}
                <div style={{ marginBottom: 18 }}>
                  <span style={{ ...TITRE_SS, display: "block", marginBottom: 8 }}>Pays destinataire</span>
                  {(per?.pays?.length ?? 0) > 6 && (
                    <div style={{ position: "relative" as const, marginBottom: 8 }}>
                      <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%",
                        transform: "translateY(-50%)", color: "var(--gris)" }} />
                      <input value={chercherPays} onChange={e => setChercherPays(e.target.value)}
                        placeholder="Rechercher un pays…"
                        style={{ width: "100%", padding: "8px 8px 8px 30px", borderRadius: 8,
                          border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)",
                          fontSize: 12, color: "var(--encre)", outline: "none",
                          fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                    </div>
                  )}
                  <div style={{ maxHeight: 220, overflowY: "auto" as const }}>
                    {paysFiltres.map(p => {
                      const sel = pays === p.nom;
                      return (
                        <button key={p.nom} onClick={() => setPays(p.nom)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                            borderRadius: 7, border: "none", cursor: "pointer", background: "transparent",
                            textAlign: "left" as const, width: "100%" }}
                          onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--carte-douce)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`,
                            background: sel ? "var(--bleu-action)" : "transparent" }} />
                          <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.nom}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--gris)",
                            fontVariantNumeric: "tabular-nums" }}>{p.nb}</span>
                        </button>
                      );
                    })}
                    {paysFiltres.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "8px 0" }}>
                        Aucun pays trouvé
                      </p>
                    )}
                  </div>
                </div>

                {/* Période — bornée par ce que les données couvrent */}
                {bornes[0] != null && bornes[1] != null && bornes[1] > bornes[0] && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={TITRE_SS}>Période</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bleu)",
                        fontVariantNumeric: "tabular-nums" }}>{anneeMin} – {anneeMax}</span>
                    </div>
                    <CurseurPlageNace min={bornes[0]} max={bornes[1]}
                      debut={anneeMin ?? bornes[0]} fin={anneeMax ?? bornes[1]}
                      onChange={(a, b) => { setAnneeMin(a); setAnneeMax(b); }} />
                  </div>
                )}

                <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
                <Facette titre="Secteur" options={per?.secteurs ?? []} choix={secteurs} setChoix={setSecteurs} />
                <Facette titre="Activité" options={per?.activites ?? []} choix={activites} setChoix={setActivites} />
                <Facette titre="Type de projet" options={per?.types ?? []} choix={types} setChoix={setTypes} />
              </>
            )}
          </div>
        )}
      </aside>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" as const,
        overscrollBehavior: "contain" as const, padding: "22px 30px 60px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          {vue !== "projets" ? <ABientot vue={vue} /> : (
            <>
              {/* En-tête : le pays, sa qualification, la période couverte — et
                  la recherche sur la même ligne, alignée à droite. Les deux
                  jetons reprennent ceux de la vue Secteurs : la petite étiquette
                  grise qualifie, la pastille de période date. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 20 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--bleu-action)", flexShrink: 0 }} />
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
                  {pays ?? "—"}
                </h2>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 5,
                  background: "var(--fond)", border: "1px solid var(--bordure-forte)", fontSize: 9, fontWeight: 700,
                  color: "var(--gris)", textTransform: "uppercase" as const, letterSpacing: "0.05em", flexShrink: 0 }}>
                  Projets reçus
                </span>
                {tag && <BadgePeriode>{tag}</BadgePeriode>}
                <div style={{ marginLeft: "auto", position: "relative" as const, minWidth: 200, flex: "0 1 300px" }}>
                  <Search size={13} style={{ position: "absolute" as const, left: 12, top: "50%",
                    transform: "translateY(-50%)", color: "var(--gris)" }} />
                  <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher"
                    style={{ width: "100%", padding: "8px 10px 8px 34px", borderRadius: 999,
                      border: "1px solid var(--bordure-forte)", background: "var(--carte)",
                      fontSize: 12.5, color: "var(--encre)", outline: "none",
                      fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                </div>
              </div>

              {q.isError ? <ErreurChargement onRetry={() => q.refetch()} /> : !d ? (
                <SkeletonChartGrid n={3} cols={1} height={230} />
              ) : d.kpis.projets === 0 ? (
                <div style={{ textAlign: "center" as const, padding: "80px 24px", color: "var(--gris)" }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucun projet sur ce périmètre</p>
                  <p style={{ fontSize: 13.5, marginTop: 8 }}>
                    Les filtres actifs ne laissent aucun projet. {nbFiltres > 0 && (
                      <button onClick={reinit} style={{ background: "none", border: "none", cursor: "pointer",
                        color: "var(--bleu)", fontWeight: 700, fontSize: 13.5, fontFamily: "var(--font-google-sans)", padding: 0 }}>
                        Tout réinitialiser
                      </button>
                    )}
                  </p>
                </div>
              ) : (
                <div className="charge-in">
                  {/* Ni compteur ni cadre : les cartes reposent directement sur
                      la page, comme partout ailleurs sur le site, et le nombre
                      de projets se lit deja dans le filtre « Pays ». */}
                  <div style={{ display: "grid", gap: 14,
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                    {d.projets.map(p => (
                      <CarteProjet key={p.id} p={p} onOuvrir={() => setOuvert(p.id)} />
                    ))}
                  </div>

                  <p style={{ fontSize: 11, color: "var(--gris)", marginTop: 18, lineHeight: 1.6 }}>
                    Un <span style={{ fontWeight: 800, color: "var(--encre)" }}>≈</span>{" "}signale une valeur
                    estimée par l&apos;algorithme du Financial Times, et non déclarée par l&apos;entreprise.
                    Source : fDi Markets.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* La fiche du projet ouvert. Elle est montée ici, hors de la grille :
          une modale enfant d'une carte hériterait de son curseur et de ses
          gestionnaires de clic. */}
      {ficheOuverte && <FicheProjet p={ficheOuverte} onClose={() => setOuvert(null)} />}
    </div>
  );
}

/** Un montant, écrit comme un chiffre de tableau de bord : la valeur grande,
    son unité petite à côté, et l'estimation signalée sans occuper la ligne. */
function Montant({ v, estime, unite, taille = 16 }: {
  v: number | null; estime: boolean | null; unite: string; taille?: number;
}) {
  if (v == null) return <span style={{ fontSize: taille, fontWeight: 700, color: "var(--gris)" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" as const }}
      title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée" : "Valeur déclarée par l'entreprise"}>
      {/* Le « ≈ » reste noir : il qualifie la valeur, il ne l'alerte pas. Ce
          qu'il signifie se lit dans l'infobulle et dans la fiche. */}
      {estime && <span style={{ fontSize: taille * 0.8, fontWeight: 800, color: "var(--encre)" }}>≈</span>}
      <span style={{ fontSize: taille, fontWeight: 800, color: "var(--encre)",
        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
        {v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
      </span>
      <span style={{ fontSize: taille * 0.62, fontWeight: 700, color: "var(--gris)" }}>{unite}</span>
    </span>
  );
}

/** La pastille du type de projet — les badges de la plateforme, tels quels.

    Trois valeurs seulement, et elles ne disent pas la même chose : une
    extension prolonge un investisseur déjà présent, une implantation nouvelle
    amène quelqu'un qui n'était pas là. La couleur porte la distinction, le mot
    la nomme — en casse normale, parce qu'un libellé de nomenclature n'est pas
    une alerte. */
function PastilleType({ type }: { type: string | null }) {
  if (!type) return null;
  const style = /extension/i.test(type) ? badge_vert
    : /co-implantation|co-location/i.test(type) ? badge_violet : badge_bleu;
  return <span style={{ ...style, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{type}</span>;
}

/** Un projet, en tuile.

    Elle répond à quatre questions et s'arrête là : QUI investit, D'OÙ il
    vient, DANS QUOI, COMBIEN. Le reste — sous-secteur, nature de
    l'implantation, description — appartient à la fiche : une tuile qui dit
    tout ne se parcourt plus, elle se lit, et il y en a deux cent trente-cinq. */
function CarteProjet({ p, onOuvrir }: { p: Projet; onOuvrir: () => void }) {
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir(); } }}
      style={{ display: "flex", flexDirection: "column" as const, background: "var(--carte)",
        border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16, padding: "15px 17px 13px",
        cursor: "pointer", transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.38)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgb(var(--ombre-rgb) / 0.10)";
        e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)";
        e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>

      {/* Période et type : le contexte, avant le nom. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.02em" }}>
          {moisEnClair(p.periode)}
        </span>
        <PastilleType type={p.type_projet} />
      </div>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em" }}>{p.entreprise ?? "—"}</h3>

      {/* Le pied, en deux colonnes séparées par un filet vertical — la forme
          des cartes d'entreprise de la plateforme. D'OÙ vient l'investissement
          d'abord, COMBIEN ensuite : le pays situe, le montant qualifie. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14,
        paddingTop: 13, borderTop: "1px solid var(--bordure)" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>Pays d&apos;origine</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)", display: "block",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {p.partenaire ?? "—"}
          </span>
        </div>
        <div style={{ minWidth: 0, paddingLeft: 14, borderLeft: "1px solid var(--bordure)" }}>
          <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>Investissement</span>
          <Montant v={p.capex_musd} estime={p.capex_estime} unite="M$" taille={13.5} />
        </div>
      </div>
    </article>
  );
}

/** Une ligne de la fiche : le libellé à gauche, la valeur à droite.

    Pas de blocs en damier : les champs d'un projet sont de longueurs très
    inégales — « Fabrication » d'un côté, « Commerce de détail de vêtements et
    d'accessoires vestimentaires » de l'autre — et une grille les aurait tous
    étirés à la taille du plus long. Le libellé reste en casse normale : c'est
    un nom de champ, pas un titre. */
function LigneFiche({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 20, padding: "11px 0",
      borderTop: "1px solid var(--bordure)" }}>
      <span style={{ flex: "0 0 38%", fontSize: 12.5, color: "var(--gris)", lineHeight: 1.5 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600,
        color: "var(--encre)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

/** Un intertitre de fiche : discret, en casse normale.

    Les petites capitales bleues conviennent aux tableaux de bord, où elles
    séparent des cartes ; empilées dans une fiche, elles crient plus fort que
    les valeurs qu'elles annoncent. */
function TitreFiche({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gris-fort)", letterSpacing: "0.01em",
      marginBottom: 2 }}>{children}</p>
  );
}

/** La fiche du projet.

    Elle est construite comme une page, pas comme un formulaire : les deux
    montants ouvrent, en grand et sans cadre ; le trajet de l'investissement
    suit sur une ligne ; le détail vient ensuite en liste, séparé par des
    filets ; la description ferme. Aucun encadré gris — les fonds empilés
    faisaient trois boîtes dans une boîte, et rien ne ressortait. */
function FicheProjet({ p, onClose }: { p: Projet; onClose: () => void }) {
  return (
    <FicheModal maxWidth={620} onClose={onClose}
      titre={
        <span style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" as const }}>
          <span>{p.entreprise ?? "Projet"}</span>
          <PastilleType type={p.type_projet} />
        </span>
      }>

      {/* Les deux montants, sans cadre : ils sont le sujet de la fiche. */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 34, flexWrap: "wrap" as const }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Investissement annoncé</p>
            <Montant v={p.capex_musd} estime={p.capex_estime} unite="M$" taille={30} />
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--bordure)" }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Emplois annoncés</p>
            <Montant v={p.emplois} estime={p.emplois_estime} unite="postes" taille={30} />
          </div>
        </div>
      </div>

      {/* Le trajet, sur une seule ligne : d'où part l'investissement, où il
          arrive, et quand il a été annoncé. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const,
        paddingTop: 18, borderTop: "1px solid var(--bordure)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <DrapeauPays iso={p.partenaire_iso} nom={p.partenaire ?? ""} taille={17} sansIso="rien" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{p.partenaire ?? "—"}</span>
        </span>
        <ArrowRight size={15} style={{ color: "var(--gris)", flexShrink: 0 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <DrapeauPays iso={p.pays_iso} nom={p.pays ?? ""} taille={17} sansIso="rien" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{p.pays ?? "—"}</span>
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--gris)" }}>
          annoncé en <span style={{ color: "var(--encre)", fontWeight: 600 }}>{moisEnClair(p.periode)}</span>
        </span>
      </div>

      <div>
        <TitreFiche>Détails du projet</TitreFiche>
        <LigneFiche label="Secteur">{p.secteur ?? "—"}</LigneFiche>
        <LigneFiche label="Sous-secteur">{p.sous_secteur ?? "—"}</LigneFiche>
        <LigneFiche label="Activité prévue">{p.activite ?? "—"}</LigneFiche>
      </div>

      {/* La page publique est en français : seule la description française est
          affichée. L'anglais de la source reste en base et sert la recherche —
          il ne se lit pas ici. Tant qu'un projet n'a que sa version anglaise,
          un tiret tient la place, la même marque d'absence que partout
          ailleurs. */}
      <div>
        <TitreFiche>Description</TitreFiche>
        <p style={p.description_fr ? TEXTE_DESC : { ...TEXTE_DESC, color: "var(--gris)" }}>
          {p.description_fr ?? "—"}
        </p>
      </div>
    </FicheModal>
  );
}

/** Le texte d'une description : posé contre un filet vertical, jamais dans un
    bloc gris — le texte reste du texte. */
const TEXTE_DESC = { fontSize: 13.5, lineHeight: 1.8, marginTop: 10, paddingLeft: 14,
  borderLeft: "2px solid var(--bordure-forte)", color: "var(--texte)" } as const;

const ETIQ = { fontSize: 9, fontWeight: 800, letterSpacing: "0.11em",
  textTransform: "uppercase" as const, color: "var(--gris)", lineHeight: 1.6 } as const;
