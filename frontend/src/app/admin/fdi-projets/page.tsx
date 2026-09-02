"use client";

// fDi Markets — les trois bases du fournisseur, sous leur nom d'origine.
//
//   PROJECT DATABASE   les projets annoncés. Seule base chargée à ce jour.
//   INVESTOR SIGNALS   les intentions déclarées, en amont du projet.
//   COMPANY DATABASE   les entreprises investisseuses.
//
// Les deux dernières sont annoncées avant d'être remplies, et le disent : un
// onglet qui n'existe pas laisse croire que la source s'arrête là.
//
// Sous « Project database », trois vues, deux natures de travail :
//
//   PROJETS       ce qui est entré. Les montants et effectifs estimés par
//                 l'algorithme du Financial Times y sont marqués : afficher une
//                 estimation comme un fait exposerait à une contradiction
//                 publique.
//
//   ENTREPRISES   l'arbitrage des noms tronqués par la source. La décision
//                 porte sur TOUS les projets qui portent le même texte brut —
//                 « Banque de dévelo… » en couvre quatre, c'est une seule
//                 décision, pas quatre.
//
//   DESCRIPTIONS  la saisie de ce que le tableau de la source ne donne pas. Il
//                 y en a des centaines : cette vue est faite pour la série, un
//                 projet à la fois, sans jamais quitter le clavier.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, Carte, ChampRecherche, Compteur, Segments, btnPrincipal, btnSecondaire, IS, TH, TD } from "@/components/admin/UIAdmin";

type Projet = {
  id: number; lot: string; ligne: number; periode: string;
  entreprise: string | null; entreprise_brut: string | null; entreprise_tronquee: boolean;
  parent: string | null; statut_entreprise: "resolu" | "propose" | "en_attente";
  source: string | null; destination: string | null;
  source_resolue: boolean; destination_resolue: boolean;
  secteur: string | null; sous_secteur: string | null; activite: string | null; type_projet: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
  description_en: string | null; description_fr: string | null;
  origine: "import" | "saisie"; champs_verrouilles: string[];
  // Les cases telles que fDi les écrit — « Mar 2014 », « * $9.60m ». C'est
  // ce que le formulaire modifie, et ce que le serveur sait relire.
  brut: LigneBrute;
  // Les postes du référentiel auxquels la ligne est rattachée : le formulaire
  // s'en sert pour présélectionner ses listes.
  ids: Partial<Record<ClefListe, number | null>>;
};
type LigneBrute = {
  date: string; parent: string | null; entreprise: string | null;
  source: string | null; dest: string | null; secteur: string | null;
  sous_secteur: string | null; activite: string | null; type: string | null;
  capex: string; emplois: string;
};
type Candidat = { id: number; nom: string; origine: "memoire" | "prefixe" };
type Groupe = {
  brut: string; tronque: boolean; nb_projets: number;
  entreprise_id: number | null; entreprise_nom: string | null;
  candidats: Candidat[];
  projets: { id: number; ligne: number; periode: string; lot: string;
             secteur: string | null; type: string | null; capex_musd: number | null }[];
};

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Un montant estimé ne se lit pas comme un montant déclaré. Le « ≈ » le dit
    sans bruit, l'infobulle l'explique. */
function Valeur({ v, estime, unite }: { v: number | null; estime: boolean | null; unite?: string }) {
  if (v == null) return <span style={{ color: "var(--gris)" }}>—</span>;
  return (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée" : "Valeur déclarée"}
      style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
        color: estime ? "var(--gris-fort)" : "var(--encre)" }}>
      {estime && <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈ </span>}
      {nf.format(v)}{unite ? ` ${unite}` : ""}
    </span>
  );
}

/** Un pays du référentiel s'écrit en français. Un pays que le rapprochement
    n'a pas atteint garde le libellé anglais de la source, en gris et signalé :
    la lacune se voit, et personne ne prend « Turkey » pour un nom canonique. */
function Pays({ nom, resolu }: { nom: string | null; resolu: boolean }) {
  if (!nom) return <span style={{ color: "var(--gris)" }}>—</span>;
  if (resolu) return <>{nom}</>;
  return (
    <span title="Libellé de la source, non rapproché du référentiel pays."
      style={{ color: "var(--gris-fort)", fontStyle: "italic" }}>{nom}</span>
  );
}

function Pastille({ children, couleur, titre }: {
  children: React.ReactNode; couleur: string; titre?: string;
}) {
  return (
    <span title={titre} style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: couleur, background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
      padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</span>
  );
}

// ── Le formulaire d'une ligne : le même pour corriger et pour ajouter ─────────
// On ne retape plus les nomenclatures, on les CHOISIT. Les listes s'affichent
// en ANGLAIS — la langue de fDi, celle qu'on a sous les yeux en recopiant une
// capture — avec le français dessous, celui que la plateforme publiera. C'est
// l'anglais qui repart au serveur, où le MÊME analyseur que l'import le
// rapproche : un seul chemin d'interprétation de la donnée, quel que soit le
// geste qui l'a produite.
//
// Quatre cases restent libres, faute de liste qui puisse les contenir : la
// société mère, l'entreprise, le montant et l'effectif. Pour les deux nombres,
// l'astérisque de fDi devient une case à cocher et la devise disparaît — on
// saisit une valeur, pas une notation. La notation, c'est l'affaire du code.

type Poste = { id: number; en: string; fr: string; secteur_id?: number };
type Referentiels = {
  types: Poste[]; secteurs: Poste[]; sous_secteurs: Poste[];
  activites: Poste[]; pays: Poste[];
};
type ClefListe = "type" | "source" | "dest" | "secteur" | "sous_secteur" | "activite";

/** Une fiche vierge : rien n'est prérempli, tout se choisit ou se saisit. */
const LIGNE_VIDE: LigneBrute = {
  date: "", parent: "", entreprise: "", source: "", dest: "", secteur: "",
  sous_secteur: "", activite: "", type: "", capex: "", emplois: "",
};

const MOIS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
                 "septembre", "octobre", "novembre", "décembre"];

/** Sans accent ni casse : « Côte d'Ivoire » se trouve en tapant « cote ». */
const pliage = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ── Une liste déroulante avec recherche ──────────────────────────────────────
// 273 sous-secteurs ne se parcourent pas à la molette. On tape trois lettres du
// libellé anglais — ou du français, la recherche porte sur les deux — et la
// liste se réduit. Le clavier suffit : flèches, Entrée, Échap.
function ChampListe({ options, valeur, onChoisir, placeholder, vide, autoriseVide = true }: {
  options: Poste[];
  valeur: Poste | null;
  onChoisir: (p: Poste | null) => void;
  placeholder: string;
  /** Ce qu'on affiche quand rien n'est choisi mais que la source, elle, disait
      quelque chose : un libellé que la nomenclature n'a pas reconnu. */
  vide?: React.ReactNode;
  autoriseVide?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [survol, setSurvol] = useState(0);
  const boite = useRef<HTMLDivElement | null>(null);
  const champ = useRef<HTMLInputElement | null>(null);

  const filtres = useMemo(() => {
    const c = pliage(q.trim());
    if (!c) return options;
    const commence = options.filter(o => pliage(o.en).startsWith(c) || pliage(o.fr).startsWith(c));
    const contient = options.filter(o => !commence.includes(o)
      && (pliage(o.en).includes(c) || pliage(o.fr).includes(c)));
    // Ce qui commence par la saisie d'abord : en recopiant « Financial ser… »
    // on veut « Financial services » en tête, pas « Alternative/renewable ».
    return [...commence, ...contient];
  }, [options, q]);

  const fermer = useCallback(() => { setOuvert(false); setQ(""); setSurvol(0); }, []);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) fermer();
    };
    document.addEventListener("mousedown", dehors);
    champ.current?.focus();
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert, fermer]);

  const prendre = (p: Poste | null) => { onChoisir(p); fermer(); };

  return (
    <div ref={boite} style={{ position: "relative" }}>
      <button
        type="button" onClick={() => setOuvert(o => !o)}
        aria-haspopup="listbox" aria-expanded={ouvert}
        style={{
          ...IS, display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, textAlign: "left", cursor: "pointer", minHeight: 44,
          borderColor: ouvert ? "var(--bleu)" : undefined,
        }}
      >
        {valeur ? (
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: "var(--encre)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valeur.en}</span>
            <span style={{ fontSize: 11, color: "var(--gris)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valeur.fr}</span>
          </span>
        ) : (
          <span style={{ color: "var(--gris)", overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap" }}>{vide ?? placeholder}</span>
        )}
        <ChevronDown size={15} style={{ color: "var(--gris)", flexShrink: 0 }} />
      </button>

      {ouvert && (
        <div
          role="listbox"
          style={{
            position: "absolute", zIndex: 5, top: "calc(100% + 5px)", left: 0, right: 0,
            background: "var(--carte)", border: "1px solid var(--bordure)", borderRadius: 12,
            boxShadow: "0 14px 34px rgb(var(--encre-rgb) / 0.16)", overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid var(--bordure)" }}>
            <input
              ref={champ} value={q} placeholder="Filtrer…"
              onChange={e => { setQ(e.target.value); setSurvol(0); }}
              onKeyDown={e => {
                if (e.key === "Escape") { e.preventDefault(); fermer(); }
                if (e.key === "ArrowDown") { e.preventDefault(); setSurvol(i => Math.min(i + 1, filtres.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSurvol(i => Math.max(i - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); if (filtres[survol]) prendre(filtres[survol]); }
              }}
              style={{ ...IS, padding: "7px 10px", fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {autoriseVide && (
              <button type="button" onClick={() => prendre(null)}
                style={{ ...ligneListe, color: "var(--gris)", fontStyle: "italic" }}>
                Aucun
              </button>
            )}
            {filtres.length === 0 && (
              <p style={{ padding: "12px 12px 14px", fontSize: 12.5, color: "var(--gris)", margin: 0 }}>
                Rien sous ce nom dans la nomenclature.
              </p>
            )}
            {filtres.map((o, i) => (
              <button
                key={o.id} type="button" role="option" aria-selected={valeur?.id === o.id}
                onMouseEnter={() => setSurvol(i)} onClick={() => prendre(o)}
                style={{
                  ...ligneListe,
                  background: i === survol ? "color-mix(in srgb, var(--bleu) 8%, transparent)" : "transparent",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, color: "var(--encre)" }}>{o.en}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--gris)" }}>{o.fr}</span>
                  </span>
                  {valeur?.id === o.id && <Check size={14} style={{ color: "var(--bleu)", flexShrink: 0 }} />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ligneListe: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
  border: "none", background: "transparent", cursor: "pointer", fontSize: 13,
  fontFamily: "inherit", lineHeight: 1.35,
};

/** L'intitulé d'une case, avec la pastille des cases protégées. */
function Etiquette({ children, verrouille }: { children: React.ReactNode; verrouille?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11,
      fontWeight: 700, color: "var(--gris-fort)", marginBottom: 6,
      letterSpacing: "0.03em", textTransform: "uppercase" }}>
      {children}
      {verrouille && (
        <Pastille couleur="var(--violet)"
          titre="Corrigée à la main : un réimport du relevé ne la réécrira pas.">corrigée</Pastille>
      )}
    </span>
  );
}

/** Un groupe de cases, sous son titre. Quatre blocs valent mieux qu'une grille
    de onze champs où l'œil ne sait plus où il en est. */
function Bloc({ titre, children, colonnes = 3 }: {
  titre: string; children: React.ReactNode; colonnes?: number;
}) {
  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.13em",
        textTransform: "uppercase", color: "var(--gris)", margin: "0 0 10px",
        paddingBottom: 7, borderBottom: "1px solid var(--bordure)" }}>{titre}</h3>
      <div style={{ display: "grid", gap: 14,
        gridTemplateColumns: `repeat(auto-fit, minmax(${colonnes >= 3 ? 210 : 260}px, 1fr))` }}>
        {children}
      </div>
    </section>
  );
}

/** La case à cocher qui remplace l'astérisque de fDi. */
function Coche({ actif, onBascule, titre }: {
  actif: boolean; onBascule: () => void; titre: string;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={actif} onClick={onBascule} title={titre}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7,
        border: "none", background: "transparent", padding: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12, color: actif ? "var(--orange)" : "var(--gris)",
        fontWeight: actif ? 700 : 500,
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${actif ? "var(--orange)" : "var(--bordure-forte, var(--bordure))"}`,
        background: actif ? "var(--orange)" : "transparent",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {actif && <Check size={11} strokeWidth={3.2} style={{ color: "var(--carte)" }} />}
      </span>
      Valeur estimée
    </button>
  );
}

// L'état du formulaire. Les listes gardent un Poste ; les nombres, du texte,
// parce qu'une saisie en cours n'est pas encore un nombre.
type EtatSaisie = {
  mois: string; annee: string;
  parent: string; entreprise: string;
  capex: string; capexUnite: "m" | "bn"; capexEstime: boolean;
  emplois: string; emploisEstime: boolean;
} & Record<ClefListe, Poste | null>;

/** « * $9.60m » → la valeur, l'échelle et le drapeau. L'inverse de ce que le
    serveur écrit ; les deux doivent rester d'accord. */
function lireMontant(v: string): { valeur: string; unite: "m" | "bn"; estime: boolean } {
  const m = /^\s*(\*)?\s*\$?\s*([\d\s.,]+?)\s*(bn|m)?\s*$/i.exec(v || "");
  if (!m) return { valeur: "", unite: "m", estime: false };
  return {
    valeur: (m[2] || "").replace(/[\s,]/g, ""),
    unite: (m[3] || "m").toLowerCase() === "bn" ? "bn" : "m",
    estime: Boolean(m[1]),
  };
}

function lireEntier(v: string): { valeur: string; estime: boolean } {
  const m = /^\s*(\*)?\s*([\d\s,]+)\s*$/.exec(v || "");
  if (!m) return { valeur: "", estime: false };
  return { valeur: (m[2] || "").replace(/[\s,]/g, ""), estime: Boolean(m[1]) };
}

function FormulaireLigne({ valeurs, ids, nomenclature, titre, sousTitre, verrous, notes, onFermer, onEnvoyer }: {
  valeurs: LigneBrute;
  /** Les postes auxquels la ligne est DÉJÀ rattachée : c'est eux qu'on
      présélectionne, et non le libellé brut, souvent tronqué. */
  ids?: Partial<Record<ClefListe, number | null>>;
  nomenclature: Referentiels | null;
  titre: string; sousTitre?: React.ReactNode;
  verrous?: string[];
  notes?: Partial<Record<keyof LigneBrute, React.ReactNode>>;
  onFermer: () => void;
  onEnvoyer: (v: LigneBrute) => Promise<string[] | null>;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [alertes, setAlertes] = useState<string[]>([]);

  // L'état de départ, calculé une fois : les postes viennent des identifiants
  // du projet, les nombres de la notation que le serveur a rendue.
  const depart = useMemo<EtatSaisie>(() => {
    const trouver = (liste: Poste[] | undefined, id: number | null | undefined) =>
      (id == null ? null : liste?.find(o => o.id === id) ?? null);
    const d = /^([A-Za-z]{3})\s+(\d{4})$/.exec(valeurs.date || "");
    const c = lireMontant(valeurs.capex);
    const e = lireEntier(valeurs.emplois);
    return {
      mois: d ? String(MOIS_EN.indexOf(d[1]) + 1) : "",
      annee: d ? d[2] : (/^\d{4}$/.test(valeurs.date || "") ? valeurs.date : ""),
      parent: valeurs.parent ?? "", entreprise: valeurs.entreprise ?? "",
      type: trouver(nomenclature?.types, ids?.type),
      source: trouver(nomenclature?.pays, ids?.source),
      dest: trouver(nomenclature?.pays, ids?.dest),
      secteur: trouver(nomenclature?.secteurs, ids?.secteur),
      sous_secteur: trouver(nomenclature?.sous_secteurs, ids?.sous_secteur),
      activite: trouver(nomenclature?.activites, ids?.activite),
      capex: c.valeur, capexUnite: c.unite, capexEstime: c.estime,
      emplois: e.valeur, emploisEstime: e.estime,
    };
  }, [valeurs, ids, nomenclature]);

  const [f, setF] = useState<EtatSaisie>(depart);
  const maj = <K extends keyof EtatSaisie>(k: K, v: EtatSaisie[K]) => setF(x => ({ ...x, [k]: v }));

  // Un sous-secteur appartient à un secteur : n'offrir que les siens évite de
  // ranger « Retail banking » sous « Automotive OEM », ce qu'aucune capture ne
  // dira jamais mais qu'un menu de 273 lignes rend possible d'un clic.
  const sousSecteurs = useMemo(() => {
    const tous = nomenclature?.sous_secteurs ?? [];
    return f.secteur ? tous.filter(s => s.secteur_id === f.secteur!.id) : tous;
  }, [nomenclature, f.secteur]);

  // Ce qui part au serveur. Une liste qu'on n'a pas touchée renvoie le libellé
  // BRUT d'origine : le relevé est verbatim, et remplacer « Central African R… »
  // par le nom entier au seul motif qu'on a ouvert la fiche effacerait ce que la
  // source a réellement écrit — et poserait un verrou que personne n'a demandé.
  const aEnvoyer = (): LigneBrute => {
    const liste = (k: ClefListe, brut: string | null) =>
      f[k] ? (f[k]!.id === depart[k]?.id ? (brut ?? "") : f[k]!.en) : (depart[k] ? "" : (brut ?? ""));
    const nombre = (v: string) => v.trim().replace(/\s/g, "").replace(",", ".");
    return {
      date: f.annee.trim()
        ? (f.mois ? `${MOIS_EN[Number(f.mois) - 1]} ${f.annee.trim()}` : f.annee.trim())
        : "",
      parent: f.parent.trim(), entreprise: f.entreprise.trim(),
      source: liste("source", valeurs.source), dest: liste("dest", valeurs.dest),
      secteur: liste("secteur", valeurs.secteur),
      sous_secteur: liste("sous_secteur", valeurs.sous_secteur),
      activite: liste("activite", valeurs.activite),
      type: liste("type", valeurs.type),
      capex: nombre(f.capex) ? `${f.capexEstime ? "* " : ""}$${nombre(f.capex)}${f.capexUnite}` : "",
      emplois: nombre(f.emplois) ? `${f.emploisEstime ? "* " : ""}${nombre(f.emplois)}` : "",
    };
  };

  const envoyer = async () => {
    setEnvoi(true); setErreur(null); setAlertes([]);
    try {
      const a = await onEnvoyer(aEnvoyer());
      if (a && a.length) { setAlertes(a); setEnvoi(false); return; }
      onFermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      setEnvoi(false);
    }
  };

  const V = (colonne: string) => verrous?.includes(colonne);
  // Le libellé que la source donnait, quand la nomenclature ne l'a pas reconnu :
  // la case est vide, mais on montre ce qu'il y avait, sinon la lacune disparaît.
  const orphelin = (k: ClefListe, brut: string | null) =>
    !depart[k] && brut ? <span style={{ fontStyle: "italic" }}>{brut} — non reconnu</span> : undefined;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={titre}
      onClick={e => { if (e.target === e.currentTarget) onFermer(); }}
      onKeyDown={e => { if (e.key === "Escape") onFermer(); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgb(var(--encre-rgb) / 0.45)",
        backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start",
        justifyContent: "center", padding: "4vh 16px", overflowY: "auto" }}
    >
      <div style={{ background: "var(--carte)", border: "1px solid var(--bordure)", borderRadius: 20,
        padding: "24px 28px 22px", width: "100%", maxWidth: 880,
        boxShadow: "0 24px 64px rgb(var(--encre-rgb) / 0.22)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, paddingBottom: 14, borderBottom: "1px solid var(--bordure)" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--encre)", margin: 0,
              letterSpacing: "-0.01em" }}>{titre}</h2>
            {sousTitre && (
              <p style={{ fontSize: 12.5, color: "var(--gris)", lineHeight: 1.6, margin: "6px 0 0" }}>
                {sousTitre}
              </p>
            )}
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"
            style={{ ...btnSecondaire, padding: "4px 8px", flexShrink: 0, lineHeight: 0 }}>
            <X size={15} />
          </button>
        </div>

        {erreur && <div style={{ marginTop: 16 }}><Avis ton="erreur">{erreur}</Avis></div>}
        {alertes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Avis ton="info">
              Enregistré, mais ces cases n&apos;ont pas pu être rattachées au référentiel — leur
              texte est conservé, elles ne compteront dans aucun filtre :
              <ul style={{ margin: "6px 0 0 18px" }}>
                {alertes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </Avis>
          </div>
        )}

        {!nomenclature && (
          <p style={{ marginTop: 18, fontSize: 13, color: "var(--gris)",
            display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={14} className="tourne" /> Chargement des nomenclatures…
          </p>
        )}

        {nomenclature && (
          <>
            <Bloc titre="Période et nature">
              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("annee") || V("mois")}>Période</Etiquette>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={f.mois} onChange={e => maj("mois", e.target.value)}
                    aria-label="Mois" style={{ ...IS, flex: 1, minHeight: 44, cursor: "pointer" }}>
                    <option value="">Mois —</option>
                    {MOIS_FR.map((m, i) => (
                      <option key={m} value={i + 1}>{MOIS_EN[i]} · {m}</option>
                    ))}
                  </select>
                  <input value={f.annee} onChange={e => maj("annee", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric" placeholder="2014" aria-label="Année"
                    style={{ ...IS, width: 92, minHeight: 44, textAlign: "center",
                      fontVariantNumeric: "tabular-nums" }} />
                </div>
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("type_brut")}>Type de projet</Etiquette>
                <ChampListe options={nomenclature.types} valeur={f.type}
                  onChoisir={p => maj("type", p)} placeholder="Choisir un type"
                  vide={orphelin("type", valeurs.type)} />
              </label>
            </Bloc>

            <Bloc titre="Investisseur et pays">
              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("entreprise_brut")}>Entreprise</Etiquette>
                <input value={f.entreprise} onChange={e => maj("entreprise", e.target.value)}
                  placeholder="Nom tel que fDi l'écrit" style={{ ...IS, minHeight: 44 }} />
                {notes?.entreprise && (
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--gris)",
                    lineHeight: 1.5, marginTop: 6 }}>{notes.entreprise}</span>
                )}
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("parent_brut")}>Société mère</Etiquette>
                <input value={f.parent} onChange={e => maj("parent", e.target.value)}
                  placeholder="Groupe, si différent" style={{ ...IS, minHeight: 44 }} />
              </label>

              <div />

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("pays_source_brut")}>Pays d&apos;origine</Etiquette>
                <ChampListe options={nomenclature.pays} valeur={f.source}
                  onChoisir={p => maj("source", p)} placeholder="Choisir un pays"
                  vide={orphelin("source", valeurs.source)} />
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("pays_dest_brut")}>Pays de destination</Etiquette>
                <ChampListe options={nomenclature.pays} valeur={f.dest}
                  onChoisir={p => maj("dest", p)} placeholder="Choisir un pays"
                  vide={orphelin("dest", valeurs.dest)} />
              </label>
            </Bloc>

            <Bloc titre="Classement" colonnes={2}>
              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("secteur_brut")}>Secteur</Etiquette>
                <ChampListe options={nomenclature.secteurs} valeur={f.secteur}
                  onChoisir={p => {
                    maj("secteur", p);
                    // Le sous-secteur suit son secteur : en changer laisserait
                    // sinon en place un poste qui n'en dépend plus.
                    if (p && f.sous_secteur && f.sous_secteur.secteur_id !== p.id) maj("sous_secteur", null);
                  }}
                  placeholder="Choisir un secteur" vide={orphelin("secteur", valeurs.secteur)} />
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("sous_secteur_brut")}>Sous-secteur</Etiquette>
                <ChampListe options={sousSecteurs} valeur={f.sous_secteur}
                  onChoisir={p => maj("sous_secteur", p)}
                  placeholder={f.secteur ? "Choisir un sous-secteur" : "Choisir un secteur d'abord"}
                  vide={orphelin("sous_secteur", valeurs.sous_secteur)} />
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("activite_brut")}>Activité</Etiquette>
                <ChampListe options={nomenclature.activites} valeur={f.activite}
                  onChoisir={p => maj("activite", p)} placeholder="Choisir une activité"
                  vide={orphelin("activite", valeurs.activite)} />
              </label>
            </Bloc>

            <Bloc titre="Montants" colonnes={2}>
              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("capex_musd") || V("capex_estime")}>
                  Investissement
                </Etiquette>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      fontSize: 13, fontWeight: 700, color: "var(--gris)", pointerEvents: "none" }}>$</span>
                    <input value={f.capex} onChange={e => maj("capex", e.target.value.replace(/[^\d.,\s]/g, ""))}
                      inputMode="decimal" placeholder="9.60" aria-label="Montant"
                      style={{ ...IS, minHeight: 44, paddingLeft: 26, fontVariantNumeric: "tabular-nums" }} />
                  </div>
                  <select value={f.capexUnite} onChange={e => maj("capexUnite", e.target.value as "m" | "bn")}
                    aria-label="Échelle" style={{ ...IS, width: 108, minHeight: 44, cursor: "pointer" }}>
                    <option value="m">millions</option>
                    <option value="bn">milliards</option>
                  </select>
                </div>
                <Coche actif={f.capexEstime} onBascule={() => maj("capexEstime", !f.capexEstime)}
                  titre="Chez fDi, l'astérisque. Une estimation de l'algorithme du Financial Times, non déclarée par l'entreprise." />
              </label>

              <label style={{ display: "block" }}>
                <Etiquette verrouille={V("emplois") || V("emplois_estime")}>Emplois</Etiquette>
                <input value={f.emplois} onChange={e => maj("emplois", e.target.value.replace(/[^\d\s]/g, ""))}
                  inputMode="numeric" placeholder="1012"
                  style={{ ...IS, minHeight: 44, fontVariantNumeric: "tabular-nums" }} />
                <Coche actif={f.emploisEstime} onBascule={() => maj("emploisEstime", !f.emploisEstime)}
                  titre="Chez fDi, l'astérisque. Un effectif estimé par l'algorithme du Financial Times, non déclaré." />
              </label>
            </Bloc>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end",
              gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--bordure)" }}>
              <button type="button" onClick={onFermer} style={btnSecondaire}>Annuler</button>
              <button type="button" onClick={envoyer} disabled={envoi}
                style={{ ...btnPrincipal, opacity: envoi ? 0.6 : 1 }}>
                {envoi ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminFdiProjets() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [totaux, setTotaux] = useState({ total: 0, sans_description: 0, a_arbitrer: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [base, setBase] = useState<"projets" | "signaux" | "entreprises">("projets");
  const [vue, setVue] = useState<"projets" | "entreprises" | "descriptions">("projets");
  const [recherche, setRecherche] = useState("");
  // Les nomenclatures ne bougent pas d'une session à l'autre : on les charge une
  // fois, pas à chaque ouverture du formulaire.
  const [nomenclature, setNomenclature] = useState<Referentiels | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try {
      const [p, a] = await Promise.all([
        fetch(`${API_BASE}/fdi/projets`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${API_BASE}/fdi/arbitrage`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      ]);
      setProjets(p.projets); setTotaux(p.totaux); setGroupes(a.groupes);
    } catch {
      setErreur("Projets indisponibles. Vérifier que la migration 134 est appliquée et qu'un lot a été importé.");
    } finally { setChargement(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    fetch(`${API_BASE}/fdi/referentiels`)
      .then(r => (r.ok ? r.json() : null))
      .then(r => { if (r) setNomenclature(r); })
      .catch(() => {});
  }, []);

  const annoncer = (t: string) => { setMessage(t); setTimeout(() => setMessage(null), 4000); };

  const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Le tableau se lit par pays : à vingt lignes par écran, l'ordre du relevé
  // ferait sauter d'un pays à l'autre sans qu'aucun soit jamais complet.
  // Comparaison française pour que les accents se rangent où on les cherche
  // (Égypte entre l'Eswatini et l'Érythrée, pas rejetée en fin de liste), et
  // tri stable : à destination égale, l'ordre du relevé est conservé.
  const collateur = useMemo(() => new Intl.Collator("fr", { sensitivity: "base" }), []);
  const projetsFiltres = useMemo(() => {
    const q = norm(recherche.trim());
    const retenus = !q ? projets : projets.filter(p => [p.entreprise, p.parent, p.secteur,
      p.sous_secteur, p.source, p.destination, p.type_projet].some(v => v && norm(v).includes(q)));
    return [...retenus].sort((a, b) =>
      collateur.compare(a.destination ?? "", b.destination ?? ""));
  }, [projets, recherche, collateur]);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1280, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--encre)", marginBottom: 18 }}>
        fDi Markets
      </h1>

      {/* Les trois bases du fournisseur, sous leur nom d'origine : c'est celui
          que les analystes lisent dans fDi, et le traduire ferait chercher. */}
      <div style={{ marginBottom: 18 }}>
        <Segments
          options={[
            { v: "projets" as const,     l: "Project database" },
            { v: "signaux" as const,     l: "Investor signals" },
            { v: "entreprises" as const, l: "Company database" },
          ]}
          value={base} onChange={setBase}
        />
      </div>

      {base !== "projets" ? (
        <ABientot base={base} />
      ) : (
      <>
      {erreur && <div style={{ marginBottom: 18 }}><Avis ton="erreur">{erreur}</Avis></div>}
      {message && <div style={{ marginBottom: 18 }}><Avis ton="ok">{message}</Avis></div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Segments
          options={[
            { v: "projets" as const,      l: "Projets",       n: totaux.total },
            { v: "entreprises" as const,  l: "Entreprises",   n: groupes.length },
            { v: "descriptions" as const, l: "Descriptions",  n: totaux.sans_description },
          ]}
          value={vue} onChange={setVue}
        />
        {vue === "projets" && (
          <ChampRecherche value={recherche} onChange={setRecherche}
            placeholder="Rechercher une entreprise, un secteur, un pays…"
            style={{ flex: 1, minWidth: 240 }} />
        )}
      </div>

      {chargement ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "70px 0", color: "var(--gris)" }}>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : vue === "projets" ? (
        <VueProjets projets={projetsFiltres} recherche={recherche} nomenclature={nomenclature}
          onFait={async (t) => { annoncer(t); await charger(); }} />
      ) : vue === "entreprises" ? (
        <VueEntreprises groupes={groupes} onFait={async (t) => { annoncer(t); await charger(); }} />
      ) : (
        <VueDescriptions projets={projets} onFait={async (t) => { annoncer(t); await charger(); }} />
      )}
      </>
      )}
    </div>
  );
}

/** Une base annoncée, pas encore chargée. Dire ce qu'elle contient vaut mieux
    qu'un onglet vide : le lecteur sait ce qui viendra, et ce qui manque. */
function ABientot({ base }: { base: "signaux" | "entreprises" }) {
  const t = base === "signaux"
    ? { titre: "Investor signals",
        quoi: "Les intentions déclarées par les investisseurs — recrutement, recherche de site, levée de fonds — en amont de tout projet annoncé.",
        ou: "La nomenclature des signaux est déjà en base, et se consulte dans « Classification fDi Markets »." }
    : { titre: "Company database",
        quoi: "Les entreprises investisseuses : siège, secteur, historique de leurs implantations.",
        ou: "Les entreprises rencontrées dans les projets sont déjà tenues à jour par l'arbitrage des noms, sous « Project database »." };
  return (
    <Carte titre={t.titre}>
      <div style={{ padding: "30px 4px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--gris-fort)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 10px" }}>
          {t.quoi}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--gris)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto" }}>
          Base non encore chargée. {t.ou}
        </p>
      </div>
    </Carte>
  );
}

// ── Vue 1 : les projets ───────────────────────────────────────────────────────

const PAR_PAGE = 20;

/** Les numéros à afficher autour de la page courante, sans jamais dérouler les
    centaines de pages que compte le relevé : premières, dernières, et une
    fenêtre autour de l'endroit où l'on se trouve. Le « … » n'est pas cliquable :
    c'est une ellipse, pas un bouton, et le prétendre tromperait. */
function fenetre(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const vues = new Set([1, 2, total - 1, total, page - 1, page, page + 1]);
  const nums = [...vues].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const sortie: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) sortie.push("…");
    sortie.push(n);
  });
  return sortie;
}

function VueProjets({ projets, recherche, nomenclature, onFait }: {
  // onFait recharge la liste : le formulaire l'attend avant de se fermer, pour
  // que la ligne corrigée soit déjà à l'écran quand le voile se lève.
  projets: Projet[]; recherche: string; nomenclature: Referentiels | null;
  onFait: (t: string) => void | Promise<void>;
}) {
  const [page, setPage] = useState(1);
  // « null » = fermé, « "nouveau" » = ajout, un projet = correction.
  const [edite, setEdite] = useState<Projet | "nouveau" | null>(null);

  // Une nouvelle recherche ramène au premier écran : rester en page 12 d'un
  // résultat qui n'en compte plus que deux n'aurait aucun sens. L'ajustement se
  // fait pendant le rendu et non dans un effet — React le prévoit, et un effet
  // provoquerait ici un second rendu pour rien.
  const [rechercheVue, setRechercheVue] = useState(recherche);
  if (recherche !== rechercheVue) { setRechercheVue(recherche); setPage(1); }

  const pages = Math.max(1, Math.ceil(projets.length / PAR_PAGE));
  // Le nombre de pages peut avoir fondu sans que la recherche change (un import
  // qui retire des lignes) : on borne l'affichage sans toucher à l'état.
  const courante = Math.min(page, pages);
  const visibles = projets.slice((courante - 1) * PAR_PAGE, courante * PAR_PAGE);

  return (
    <Carte
      titre="Projets annoncés"
      extra={
        <button type="button" onClick={() => setEdite("nouveau")} style={btnSecondaire}>
          + Ajouter un projet
        </button>
      }
    >
      {projets.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          {recherche ? `Aucun projet ne correspond à « ${recherche} ».` : "Aucun projet importé."}
        </p>
      ) : (
        <div style={{ border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Période</th>
                  <th style={TH}>Entreprise</th>
                  <th style={TH}>Origine</th>
                  <th style={TH}>Destination</th>
                  <th style={TH}>Secteur</th>
                  <th style={TH}>Activité</th>
                  <th style={TH}>Type</th>
                  <th style={{ ...TH, textAlign: "right" }}>Capex (M$)</th>
                  <th style={{ ...TH, textAlign: "right" }}>Emplois</th>
                  <th style={{ ...TH, width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...TD, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p.periode}</td>
                    <td style={TD}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        {/* Le nom d'une entreprise non arbitrée passe en orange, sans
                            étiquette : la couleur suffit à signaler qu'il reste à trancher,
                            et l'infobulle donne le texte brut de la source à celui qui
                            s'arrête dessus. */}
                        <span
                          style={{
                            fontWeight: 600,
                            color: p.statut_entreprise !== "resolu" ? "var(--orange)" : undefined,
                          }}
                          title={p.statut_entreprise !== "resolu"
                            ? `Nom affiché tronqué par la source : « ${p.entreprise_brut} ». À arbitrer.`
                            : undefined}
                        >{p.entreprise ?? "—"}</span>
                        {p.parent && p.parent !== p.entreprise && (
                          <span style={{ fontSize: 11, color: "var(--gris)" }}>groupe {p.parent}</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      <Pays nom={p.source} resolu={p.source_resolue} />
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      <Pays nom={p.destination} resolu={p.destination_resolue} />
                    </td>
                    <td style={TD}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span>{p.secteur ?? "—"}</span>
                        <span style={{ fontSize: 11, color: "var(--gris)" }}>{p.sous_secteur ?? ""}</span>
                      </span>
                    </td>
                    <td style={TD}>{p.activite ?? "—"}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{p.type_projet ?? "—"}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <Valeur v={p.capex_musd} estime={p.capex_estime} />
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <Valeur v={p.emplois} estime={p.emplois_estime} />
                    </td>
                    <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => setEdite(p)}
                        title="Corriger cette ligne"
                        style={{ ...btnSecondaire, padding: "3px 10px", fontSize: 11.5 }}>
                        Corriger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edite && (
        <FormulaireLigne
          titre={edite === "nouveau" ? "Ajouter un projet" : "Corriger la ligne"}
          nomenclature={nomenclature}
          sousTitre={edite === "nouveau" ? undefined
            : <>Les cases modifiées seront <strong>protégées</strong>{" "}: un réimport du relevé
                réécrira les autres depuis le fichier, mais laissera celles-là.{" "}
                {edite.origine === "saisie"
                  ? "Ce projet a été saisi à la main ; il ne vient d'aucun fichier."
                  : `Ligne ${edite.ligne} du lot « ${edite.lot} ».`}</>}
          valeurs={edite === "nouveau" ? LIGNE_VIDE : {
            date: edite.brut.date, parent: edite.brut.parent ?? "",
            entreprise: edite.brut.entreprise ?? "", source: edite.brut.source ?? "",
            dest: edite.brut.dest ?? "", secteur: edite.brut.secteur ?? "",
            sous_secteur: edite.brut.sous_secteur ?? "", activite: edite.brut.activite ?? "",
            type: edite.brut.type ?? "", capex: edite.brut.capex, emplois: edite.brut.emplois,
          }}
          verrous={edite === "nouveau" ? [] : edite.champs_verrouilles}
          ids={edite === "nouveau" ? undefined : edite.ids}
          // Le tableau affiche le nom ARBITRÉ, le formulaire le libellé que fDi
          // a écrit : « Attijariwafa Bank … » d'un côté, « Attijariwafa Bank
          // Egypt » de l'autre. Sans ce rappel, l'écart passe pour une erreur.
          notes={edite === "nouveau" || !edite.entreprise
            || edite.entreprise === (edite.brut.entreprise ?? "") ? undefined : {
            entreprise: <>Rattachée à <strong style={{ color: "var(--gris-fort)" }}>{edite.entreprise}</strong>,
              le nom que le tableau affiche. Ce champ-ci porte le libellé du relevé.</>,
          }}
          onFermer={() => setEdite(null)}
          onEnvoyer={async (v) => {
            const nouveau = edite === "nouveau";
            const r = await fetch(
              nouveau ? `${API_BASE}/fdi/projets` : `${API_BASE}/fdi/projets/${edite.id}`,
              { method: nouveau ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json", ...(await authHeaders()) },
                body: JSON.stringify(v) });
            const corps = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(corps.detail || "Enregistrement impossible.");
            // Les avertissements laissent le formulaire ouvert : la ligne est
            // écrite, mais l'utilisateur doit voir ce qui n'a pas été rattaché
            // pendant qu'il a encore le texte fautif sous les yeux.
            const alertes: string[] = corps.avertissements ?? [];
            await onFait(nouveau ? "Projet ajouté." : "Ligne corrigée.");
            return alertes.length ? alertes : null;
          }}
        />
      )}

      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
          <BoutonPage onClick={() => setPage(courante - 1)} inactif={courante === 1} titre="Page précédente">
            <ChevronLeft size={14} />
          </BoutonPage>
          {fenetre(courante, pages).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} style={{ fontSize: 12, color: "var(--gris)", padding: "0 2px" }}>…</span>
            ) : (
              <BoutonPage key={n} onClick={() => setPage(n)} actif={n === courante} titre={`Page ${n}`}>
                {n}
              </BoutonPage>
            )
          )}
          <BoutonPage onClick={() => setPage(courante + 1)} inactif={courante === pages} titre="Page suivante">
            <ChevronRight size={14} />
          </BoutonPage>
        </div>
      )}
    </Carte>
  );
}

/** Un pas de navigation. Désactivé, il reste visible mais ne réagit plus : le
    faire disparaître déplacerait les autres boutons sous le curseur. */
function BoutonPage({ children, onClick, actif, inactif, titre }: {
  children: React.ReactNode; onClick: () => void; actif?: boolean; inactif?: boolean; titre?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={inactif} title={titre}
      aria-current={actif ? "page" : undefined}
      style={{
        minWidth: 30, height: 30, padding: "0 8px", borderRadius: 9, cursor: inactif ? "default" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: actif ? 800 : 600, fontVariantNumeric: "tabular-nums",
        border: `1px solid ${actif ? "var(--bleu)" : "var(--bordure)"}`,
        background: actif ? "color-mix(in srgb, var(--bleu) 10%, transparent)" : "transparent",
        color: inactif ? "var(--gris)" : actif ? "var(--bleu)" : "var(--gris-fort)",
        opacity: inactif ? 0.45 : 1,
      }}
    >{children}</button>
  );
}

// ── Vue 2 : l'arbitrage des entreprises ───────────────────────────────────────
function VueEntreprises({ groupes, onFait }: { groupes: Groupe[]; onFait: (t: string) => void }) {
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const trancher = async (brut: string, corps: Record<string, unknown>) => {
    setEnvoi(brut); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/arbitrage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ brut, ...corps }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Refusé (HTTP ${r.status}).`);
      }
      const d = await r.json();
      onFait(`${d.projets_rattaches} projet${d.projets_rattaches > 1 ? "s" : ""} rattaché${d.projets_rattaches > 1 ? "s" : ""}.`);
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setEnvoi(null); }
  };

  if (groupes.length === 0) {
    return (
      <Carte titre="Entreprises">
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          Rien à arbitrer : toutes les entreprises des projets importés portent un nom complet.
        </p>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Entreprises à arbitrer"
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groupes.map(g => (
          <div key={g.brut} style={{ border: "1px solid var(--bordure)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{g.brut}</span>
              {g.tronque && <Pastille couleur="var(--orange)" titre="Nom coupé par la source">tronqué</Pastille>}
              <Compteur n={g.nb_projets} mot="projet" couleur="var(--violet)" />
            </div>

            {/* Le contexte : sans lui, impossible de deviner de quelle entreprise il s'agit. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {g.projets.map(p => (
                <span key={p.id} style={{ fontSize: 11, color: "var(--gris-fort)", background: "var(--carte-douce)",
                  border: "1px solid var(--filet)", borderRadius: 8, padding: "3px 9px", whiteSpace: "nowrap" }}>
                  {p.periode} · {p.secteur ?? "?"}{p.capex_musd != null ? ` · ${nf.format(p.capex_musd)} M$` : ""}
                  {p.type ? ` · ${p.type}` : ""}
                </span>
              ))}
            </div>

            {g.candidats.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "var(--gris)" }}>Déjà connu :</span>
                {g.candidats.map(c => (
                  <button key={c.id} disabled={envoi === g.brut}
                    onClick={() => trancher(g.brut, { mode: "rattacher", entreprise_id: c.id })}
                    title={c.origine === "memoire" ? "Ce texte a déjà été tranché ainsi" : "Le nom commence par ce texte"}
                    style={{ ...btnSecondaire, padding: "6px 12px", fontSize: 12,
                      borderColor: c.origine === "memoire" ? "rgb(var(--bleu-rgb) / 0.35)" : "var(--bordure-forte)" }}>
                    {c.nom}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                value={saisies[g.brut] ?? ""}
                onChange={e => setSaisies(s => ({ ...s, [g.brut]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === "Enter" && (saisies[g.brut] ?? "").trim()) {
                    trancher(g.brut, { mode: "nommer", nom: saisies[g.brut] });
                  }
                }}
                placeholder="Nom complet de l'entreprise…"
                style={{ ...IS, flex: 1, minWidth: 240 }}
              />
              <button
                disabled={envoi === g.brut || !(saisies[g.brut] ?? "").trim()}
                onClick={() => trancher(g.brut, { mode: "nommer", nom: saisies[g.brut] })}
                style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 7,
                  opacity: envoi === g.brut || !(saisies[g.brut] ?? "").trim() ? 0.5 : 1 }}>
                {envoi === g.brut ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                  : <Check size={13} />}
                Confirmer
              </button>
            </div>
          </div>
        ))}
      </div>
    </Carte>
  );
}

// ── Vue 3 : la saisie des descriptions, en série ──────────────────────────────
function VueDescriptions({ projets, onFait }: { projets: Projet[]; onFait: (t: string) => void }) {
  // On travaille sur la liste complète, mais en démarrant sur le premier projet
  // sans description : on peut ainsi revenir corriger une saisie passée sans
  // sortir de la vue.
  const [i, setI] = useState(() => Math.max(0, projets.findIndex(p => !p.description_en)));
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const p = projets[i];
  useEffect(() => {
    setEn(p?.description_en ?? ""); setFr(p?.description_fr ?? ""); setErreur(null);
  }, [p?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const restants = projets.filter(x => !x.description_en).length;

  const enregistrer = async (avancer: boolean) => {
    if (!p) return;
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/projets/${p.id}/description`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ description_en: en, description_fr: fr }),
      });
      if (!r.ok) throw new Error(`Refusé (HTTP ${r.status}).`);
      // La liste locale suit sans rechargement : enchaîner vingt saisies ne doit
      // pas déclencher vingt allers-retours de liste complète.
      p.description_en = en.trim() || null;
      p.description_fr = fr.trim() || null;
      if (avancer) {
        const suivant = projets.findIndex((x, k) => k > i && !x.description_en);
        setI(suivant >= 0 ? suivant : Math.min(i + 1, projets.length - 1));
      } else {
        onFait("Description enregistrée.");
      }
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setEnvoi(false); }
  };

  if (!p) {
    return (
      <Carte titre="Descriptions">
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          Aucun projet importé.
        </p>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Saisie des descriptions"
      extra={
        <span style={{ fontSize: 11.5, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>
          {i + 1} / {projets.length} · {restants} sans description
        </span>
      }
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}

      {/* Le contexte du projet : on n'écrit pas une description à l'aveugle. */}
      <div style={{ border: "1px solid var(--bordure)", borderRadius: 12, padding: "12px 15px",
        background: "var(--carte-douce)", marginBottom: 14, display: "flex", flexWrap: "wrap",
        alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{p.entreprise ?? "—"}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.periode}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.source} → {p.destination}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.sous_secteur ?? p.secteur}</span>
        {p.type_projet && <Pastille couleur="var(--bleu)">{p.type_projet}</Pastille>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 12 }}>
          <span><Valeur v={p.capex_musd} estime={p.capex_estime} unite="M$" /></span>
          <span><Valeur v={p.emplois} estime={p.emplois_estime} unite="emplois" /></span>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--gris)" }}>Description (anglais)</span>
          <textarea value={en} onChange={e => setEn(e.target.value)} rows={7} autoFocus
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enregistrer(true); }}
            style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--gris)" }}>Description (français, facultatif)</span>
          <textarea value={fr} onChange={e => setFr(e.target.value)} rows={7}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enregistrer(true); }}
            style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => setI(k => Math.max(0, k - 1))} disabled={i === 0}
          style={{ ...btnSecondaire, display: "inline-flex", alignItems: "center", gap: 6, opacity: i === 0 ? 0.5 : 1 }}>
          <ChevronLeft size={13} /> Précédent
        </button>
        <button onClick={() => setI(k => Math.min(projets.length - 1, k + 1))} disabled={i >= projets.length - 1}
          style={{ ...btnSecondaire, display: "inline-flex", alignItems: "center", gap: 6,
            opacity: i >= projets.length - 1 ? 0.5 : 1 }}>
          Suivant <ChevronRight size={13} />
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--gris)" }}>⌘/Ctrl + Entrée</span>
        <button onClick={() => enregistrer(false)} disabled={envoi} style={btnSecondaire}>
          Enregistrer
        </button>
        <button onClick={() => enregistrer(true)} disabled={envoi}
          style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 7, opacity: envoi ? 0.6 : 1 }}>
          {envoi ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
          Enregistrer et suivant
        </button>
      </div>
    </Carte>
  );
}
