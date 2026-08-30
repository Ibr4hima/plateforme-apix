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
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";

import FicheModal, { FicheBloc, FicheCarteNeutre, FicheGrille, FicheSection, FicheValeur }
  from "@/components/shared/FicheModal";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import { GrapheBarresH } from "@/components/charts/GrapheBarresH";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { demarrerRedimension } from "@/lib/redimension";
import { API, CarteTableauAnnees, fmtNombre, fmtVal, GrapheMultiPays } from "./partage";

type Compte = { nom: string; nb: number };
type Perimetre = {
  sens: string; annees: [number | null, number | null]; total_projets: number;
  pays: Compte[]; secteurs: Compte[]; activites: Compte[]; types: Compte[];
};
type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null };
type Projet = {
  id: number; periode: string; annee: number; entreprise: string | null;
  entreprise_a_arbitrer: boolean; pays: string | null; partenaire: string | null;
  secteur: string | null; sous_secteur: string | null; activite: string | null;
  type_projet: string | null; capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null; description: string | null;
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

const TITRE_SS = { fontSize: 11, fontWeight: 700, color: "var(--gris)",
  textTransform: "uppercase" as const, letterSpacing: "0.1em" };

/** Un montant estimé par l'algorithme du Financial Times ne se lit pas comme un
    montant déclaré par l'entreprise. Le « ≈ » le dit sans phrase. */
function Valeur({ v, estime, fmt }: { v: number | null; estime: boolean | null; fmt: (n: number | null) => string }) {
  if (v == null) return <span style={{ color: "var(--gris)" }}>—</span>;
  return (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée" : "Valeur déclarée par l'entreprise"}
      style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
      {estime && <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈ </span>}{fmt(v)}
    </span>
  );
}

function CarteKpi({ label, valeur, note }: { label: string; valeur: string; note?: string | null }) {
  return (
    <div style={{ background: "var(--carte)", borderRadius: 14, padding: "13px 14px",
      border: "1px solid rgb(var(--encre-rgb) / 0.12)", minWidth: 0 }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)",
        textTransform: "uppercase" as const, lineHeight: 1.4, marginBottom: 7 }}>{label}</p>
      <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1 }}>{valeur}</p>
      <div style={{ marginTop: 5, minHeight: 12 }}>
        {note && <p style={{ fontSize: 10, color: "var(--gris)", lineHeight: 1.2 }}>{note}</p>}
      </div>
    </div>
  );
}

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
  const reinit = () => {
    setSecteurs([]); setActivites([]); setTypes([]); setRecherche("");
    setAnneeMin(bornes[0]); setAnneeMax(bornes[1]);
  };

  const paysFiltres = (per?.pays ?? []).filter(p =>
    !chercherPays || p.nom.toLowerCase().includes(chercherPays.toLowerCase()));

  // Une seule série par graphe : la période est courte et les projets sont des
  // événements, pas un flux continu — la barre dit mieux qu'une courbe qu'il
  // s'agit d'un dénombrement.
  const serie = (cle: "nb" | "capex_musd" | "emplois", nom: string, couleur: string) => [{
    nom, couleur,
    data: (d?.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a[cle] as number | null })),
  }];
  const tag = d?.kpis?.annees?.[0] != null
    ? (d.kpis.annees[0] === d.kpis.annees[1] ? `${d.kpis.annees[0]}` : `${d.kpis.annees[0]}–${d.kpis.annees[1]}`)
    : undefined;

  // Deux libellés voisins mais distincts : le compteur dénombre des PAYS, le
  // classement montre des PROJETS par pays. Le pays d'en face est toujours
  // celui d'origine, la page ne se lisant que dans un sens.
  const ficheOuverte = (d?.projets ?? []).find(p => p.id === ouvert) ?? null;

  const libellePartenaire = "Pays d'origine";
  const libelleSens = "Origine des projets";

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
              {/* En-tête : le pays, son rôle, la période couverte */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--bleu-action)" }} />
                <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
                  {pays ?? "—"}
                </h2>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--bleu)",
                  background: "var(--bleu-voile)", padding: "4px 11px", borderRadius: 999 }}>
                  Projets reçus
                </span>
                {tag && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gris)",
                    background: "var(--fond)", padding: "4px 11px", borderRadius: 999,
                    fontVariantNumeric: "tabular-nums" }}>{tag}</span>
                )}
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
                  {/* Compteurs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                    <CarteKpi label="Projets annoncés" valeur={fmtNombre(d.kpis.projets)}
                      note={`${d.kpis.entreprises} entreprise${d.kpis.entreprises > 1 ? "s" : ""}`} />
                    <CarteKpi label="Investissement annoncé" valeur={fmtVal(d.kpis.capex_musd)}
                      note={d.kpis.part_estimee != null
                        ? `dont ${d.kpis.part_estimee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % estimés par le FT`
                        : null} />
                    <CarteKpi label="Emplois annoncés" valeur={fmtNombre(d.kpis.emplois)}
                      note="à la création du projet" />
                    <CarteKpi label={libellePartenaire} valeur={fmtNombre(d.kpis.partenaires)}
                      note={`${fmtVal(d.kpis.capex_moyen)} par projet en moyenne`} />
                  </div>

                  {/* Séries annuelles — un graphe par ligne, comme le reste du site */}
                  <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
                    {/* Le montant se lit en courbe : c'est une grandeur, elle a
                        une trajectoire. Les DÉNOMBREMENTS, eux, passent en
                        tableau — une barre par année n'ajoute rien à un
                        nombre, et sur deux années elle occupe l'écran sans le
                        renseigner. C'est la règle déjà retenue ailleurs sur le
                        site pour les comptages. */}
                    <GrapheCard titre="Investissement annoncé" unite="M$ USD" source="fDi Markets · Financial Times"
                      series={serie("capex_musd", "Capex", "var(--bleu)")} grapheId="fdi-capex" statique tag={tag} hideLegend>
                      <GrapheMultiPays series={serie("capex_musd", "Capex", "var(--bleu)")} height={250} type="line"
                        titre="fdi-capex" showDots />
                    </GrapheCard>
                    <CarteTableauAnnees titre="Projets annoncés"
                      rows={(d.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.nb }))} />
                    <CarteTableauAnnees titre="Emplois annoncés" accent="var(--violet)"
                      rows={(d.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.emplois }))} />
                  </div>

                  {/* Classements — le nombre de projets, la valeur en infobulle */}
                  <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
                    {([
                      { id: "partenaires", titre: libelleSens, couleur: "var(--orange)" },
                      { id: "secteurs", titre: "Secteurs les plus visés", couleur: "var(--bleu)" },
                      { id: "activites", titre: "Nature des implantations", couleur: "var(--vert)" },
                      { id: "entreprises", titre: "Entreprises les plus actives", couleur: "var(--violet)" },
                    ] as const).map(c => {
                      const rows = (d.tops[c.id] ?? []).map(r => ({ label: r.nom, valeur: r.nb }));
                      if (rows.length === 0) return null;
                      return (
                        <GrapheCard key={c.id} titre={c.titre} unite="Nombre de projets"
                          source="fDi Markets · Financial Times" grapheId={`fdi-top-${c.id}`} statique tag={tag} hideLegend>
                          {/* Échelle linéaire, pas en racine : sur des dénombrements courts,
                              un projet ne doit pas paraître valoir presque autant que quatre. */}
                          <GrapheBarresH data={rows} couleur={c.couleur} fmt={fmtNombre} exposant={1} />
                        </GrapheCard>
                      );
                    })}
                  </div>

                  {/* La table : c'est elle que les compteurs décrivent */}
                  <div style={{ background: "var(--carte)", borderRadius: 14,
                    border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12, flexWrap: "wrap" as const, marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.14em",
                        textTransform: "uppercase" as const }}>
                        Le détail des projets
                        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, color: "var(--gris)",
                          background: "var(--bleu-voile)", padding: "2px 8px", borderRadius: 5,
                          letterSpacing: "0.04em", textTransform: "none" as const }}>{d.projets.length}</span>
                      </p>
                      <div style={{ position: "relative" as const, minWidth: 240, flex: "0 1 320px" }}>
                        <Search size={13} style={{ position: "absolute" as const, left: 10, top: "50%",
                          transform: "translateY(-50%)", color: "var(--gris)" }} />
                        <input value={recherche} onChange={e => setRecherche(e.target.value)}
                          placeholder="Rechercher une entreprise, un mot de la description…"
                          style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: 999,
                            border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)",
                            fontSize: 12, color: "var(--encre)", outline: "none",
                            fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                      </div>
                    </div>

                    {/* Une carte par projet, dépliable. Un projet fDi n'est pas
                        une ligne de tableau : c'est une entreprise, un pays,
                        un métier et un montant, et la moitié de ces champs ne
                        tient pas dans une colonne. La carte montre ce qui
                        identifie, le clic donne le reste. */}
                    <div style={{ display: "grid", gap: 10,
                      gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
                      {d.projets.map(p => (
                        <CarteProjet key={p.id} p={p} onOuvrir={() => setOuvert(p.id)} />
                      ))}
                    </div>

                    <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                      Un <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈</span>{" "}signale une valeur
                      estimée par l&apos;algorithme du Financial Times, et non déclarée par l&apos;entreprise.
                      Source : fDi Markets.
                    </p>
                  </div>
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

/** Un projet, en tuile.

    Elle porte ce qui l'identifie — qui, d'où, quand, quel secteur, combien —
    et rien de plus : la tuile sert à parcourir, pas à consulter. Le clic ouvre
    la fiche, comme partout ailleurs sur les pages publiques. */
function CarteProjet({ p, onOuvrir }: { p: Projet; onOuvrir: () => void }) {
  return (
    <div onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir(); } }}
      style={{ background: "var(--carte)", border: "1px solid rgb(var(--encre-rgb) / 0.12)",
        borderRadius: 14, padding: "14px 16px", cursor: "pointer",
        transition: "border-color 0.18s, box-shadow 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.35)";
        e.currentTarget.style.boxShadow = "0 2px 10px rgb(var(--ombre-rgb) / 0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)";
        e.currentTarget.style.boxShadow = "none"; }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)", lineHeight: 1.3 }}>
            {p.entreprise ?? "—"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--gris)", marginTop: 3 }}>
            {p.partenaire ?? "—"} · {p.periode}
          </p>
        </div>
        <ChevronRight size={14} style={{ flexShrink: 0, color: "var(--gris)", marginTop: 2 }} />
      </div>

      <p style={{ fontSize: 12, color: "var(--texte)", marginTop: 10, lineHeight: 1.4 }}>{p.secteur ?? "—"}</p>

      <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" as const }}>
        <span>
          <span style={{ ...ETIQ, display: "block" }}>Investissement</span>
          <Valeur v={p.capex_musd} estime={p.capex_estime}
            fmt={v => `${(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M$`} />
        </span>
        <span>
          <span style={{ ...ETIQ, display: "block" }}>Emplois</span>
          <Valeur v={p.emplois} estime={p.emplois_estime} fmt={fmtNombre} />
        </span>
      </div>
    </div>
  );
}

/** La fiche du projet — la coquille commune à toutes les fiches publiques.

    Elle dit tout ce que la source porte, y compris ce qu'elle ne porte pas :
    une description absente est écrite comme telle, faute de quoi le lecteur
    croit à un défaut d'affichage. */
function FicheProjet({ p, onClose }: { p: Projet; onClose: () => void }) {
  const montant = (v: number | null, estime: boolean | null, unite: string) =>
    v == null ? <FicheValeur vide>Non communiqué</FicheValeur> : (
      <FicheValeur>
        {estime && <span style={{ color: "var(--orange)", fontWeight: 800 }}>≈ </span>}
        {v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {unite}
        {estime && (
          <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, color: "var(--gris)", marginTop: 2 }}>
            estimation du Financial Times
          </span>
        )}
      </FicheValeur>
    );

  return (
    <FicheModal titre={p.entreprise ?? "Projet"} onClose={onClose} maxWidth={680}>
      <FicheSection titre="Informations">
        <FicheGrille>
          <FicheBloc label="Période"><FicheValeur>{p.periode}</FicheValeur></FicheBloc>
          <FicheBloc label="Type de projet">
            <FicheValeur>{p.type_projet ?? "—"}</FicheValeur>
          </FicheBloc>
          <FicheBloc label="Pays d'origine"><FicheValeur>{p.partenaire ?? "—"}</FicheValeur></FicheBloc>
          <FicheBloc label="Destination"><FicheValeur>{p.pays ?? "—"}</FicheValeur></FicheBloc>
          <FicheBloc label="Investissement annoncé">
            {montant(p.capex_musd, p.capex_estime, "M$")}
          </FicheBloc>
          <FicheBloc label="Emplois annoncés">
            {montant(p.emplois, p.emplois_estime, "emplois")}
          </FicheBloc>
        </FicheGrille>
      </FicheSection>

      <FicheSection titre="Activité">
        <FicheGrille>
          <FicheBloc label="Secteur"><FicheValeur>{p.secteur ?? "—"}</FicheValeur></FicheBloc>
          <FicheBloc label="Sous-secteur"><FicheValeur>{p.sous_secteur ?? "—"}</FicheValeur></FicheBloc>
          <FicheBloc label="Nature de l'implantation" full>
            <FicheValeur>{p.activite ?? "—"}</FicheValeur>
          </FicheBloc>
        </FicheGrille>
      </FicheSection>

      <FicheSection titre="Description">
        <FicheCarteNeutre>
          <p style={{ fontSize: 12.5, color: p.description ? "var(--texte)" : "var(--gris)",
            lineHeight: 1.7, fontStyle: p.description ? "normal" : "italic" }}>
            {p.description ?? "La source ne publie pas de description pour ce projet."}
          </p>
        </FicheCarteNeutre>
      </FicheSection>

      <p style={{ fontSize: 10.5, color: "var(--gris)", lineHeight: 1.6 }}>
        Projet <strong>annoncé</strong>, relevé par fDi Markets (Financial Times). Une annonce dit une
        décision d&apos;investir, pas un décaissement.
      </p>
    </FicheModal>
  );
}

const ETIQ = { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em",
  textTransform: "uppercase" as const, color: "var(--gris)", lineHeight: 1.6 } as const;
