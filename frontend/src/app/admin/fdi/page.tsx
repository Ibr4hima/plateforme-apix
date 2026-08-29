"use client";

// Consultation et tenue de la classification sectorielle fDi Markets.
//
// Deux opérations, pas trois : créer et corriger. Pas de suppression, et ce
// n'est pas un oubli — un poste supprimé emporterait le rattachement de tous
// les projets qui le référencent, y compris ceux d'il y a quinze ans. Un poste
// que fDi ne publie plus reste donc en base, où il décrit encore le passé.
//
// Renommer se propage tout seul : un projet portera l'identifiant du secteur,
// jamais son libellé. Corriger un nom, c'est une ligne modifiée ; tous les
// projets rattachés affichent aussitôt le nouveau nom.
//
// Les codes techniques ne sont pas affichés : ils n'apprennent rien à qui tient
// la nomenclature, et leur troncature à 40 caractères donnait des chaînes
// illisibles au bout des lignes. Ils restent en base, où ils servent
// l'appariement des imports.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, X } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, Carte, ChampRecherche, Compteur, Segments, btnPrincipal, btnSecondaire, IS } from "@/components/admin/UIAdmin";

type Origine = "depot" | "admin";
type SousSecteur = {
  id: number; code: string; libelle_en: string; libelle_fr: string;
  libelle_en_base: string; partage: boolean; origine: Origine; modifie_le: string | null; ordre: number;
};
type Secteur = {
  id: number; code: string; libelle_en: string; libelle_fr: string; ordre: number;
  origine: Origine; modifie_le: string | null; sous_secteurs: SousSecteur[];
};
type Activite = {
  id: number; code: string; libelle_en: string; libelle_fr: string; ordre: number;
  origine: Origine; modifie_le: string | null;
};
type Signal = Activite & { definition_en: string; definition_fr: string };
type Classification = {
  secteurs: Secteur[];
  activites: Activite[];
  signaux: Signal[];
  types_projet: Activite[];
  totaux: { secteurs: number; sous_secteurs: number; activites: number; signaux: number;
            types_projet: number; libelles_partages: number; lignes_admin: number };
};

/** Insensible à la casse ET aux accents : on cherche « energies » et on trouve
    « Énergies renouvelables ». */
const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ce que le formulaire édite : une paire de libellés, et l'endroit où l'écrire. */
type Famille = "secteur" | "sous" | "activite" | "signal" | "type";
type Edition =
  | { mode: "creer"; famille: "secteur" | "activite" | "signal" | "type" }
  | { mode: "creer"; famille: "sous"; secteur_id: number; secteur_nom: string }
  | { mode: "modifier"; famille: Famille; id: number; libelle_fr: string; libelle_en: string;
      definition_fr?: string; definition_en?: string };

const CHEMIN = { secteur: "secteurs", sous: "sous-secteurs", activite: "activites",
                 signal: "signaux", type: "types-projet" } as const;

function Pastille({ children, couleur = "var(--bleu)", titre }: {
  children: React.ReactNode; couleur?: string; titre?: string;
}) {
  return (
    <span title={titre} style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: couleur, background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
      padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</span>
  );
}

function BoutonIcone({ onClick, titre, children }: {
  onClick: () => void; titre: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={titre} aria-label={titre}
      style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid var(--bordure)",
        background: "var(--carte)", color: "var(--gris)", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--bleu)";
        e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.35)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--gris)";
        e.currentTarget.style.borderColor = "var(--bordure)"; }}>
      {children}
    </button>
  );
}

/** Une liste plate — activités, types de projet : deux libellés, un bouton.
    Le même dessin deux fois se serait décalé au premier ajustement. */
function ListePlate({ items, vide, onCorriger }: {
  items: Activite[]; vide: string; onCorriger: (a: Activite) => void;
}) {
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>{vide}</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
      {items.map(a => (
        <div key={a.id} style={{ border: "1px solid var(--bordure)", borderRadius: 12,
          padding: "11px 10px 11px 14px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--encre)" }}>{a.libelle_fr}</span>
            <span style={{ fontSize: 11.5, color: "var(--gris-fort)" }}>{a.libelle_en}</span>
          </span>
          {a.origine === "admin" && <Pastille couleur="var(--vert)" titre="Créé ou corrigé ici.">tenu ici</Pastille>}
          <BoutonIcone titre={`Corriger « ${a.libelle_fr} »`} onClick={() => onCorriger(a)}>
            <Pencil size={12} />
          </BoutonIcone>
        </div>
      ))}
    </div>
  );
}

export default function AdminFdiClassification() {
  const [data, setData]             = useState<Classification | null>(null);
  const [erreur, setErreur]         = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue]               = useState<"secteurs" | "activites" | "signaux" | "types">("secteurs");
  const [recherche, setRecherche]   = useState("");
  const [ouverts, setOuverts]       = useState<Set<number>>(new Set());

  // Formulaire d'édition — un seul à la fois, en modale.
  const [edition, setEdition]   = useState<Edition | null>(null);
  const [champFr, setChampFr]   = useState("");
  const [champEn, setChampEn]   = useState("");
  const [defFr, setDefFr]       = useState("");
  const [defEn, setDefEn]       = useState("");
  const [envoi, setEnvoi]       = useState(false);
  const [erreurForm, setErreurForm] = useState<string | null>(null);
  const [succes, setSucces]     = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/classification`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: Classification = await r.json();
      // Tri alphabétique français, ici et non en SQL : la collation de la base
      // range « Alimentation » avant « Aéronautique », parce qu'elle compare des
      // octets là où Intl compare des lettres.
      const parNom = (a: { libelle_fr: string }, b: { libelle_fr: string }) =>
        a.libelle_fr.localeCompare(b.libelle_fr, "fr");
      d.secteurs = [...d.secteurs].sort(parNom)
        .map(s => ({ ...s, sous_secteurs: [...s.sous_secteurs].sort(parNom) }));
      d.activites = [...d.activites].sort(parNom);
      // Les signaux gardent l'ordre de la source : il va du plus concret au plus
      // faible, gradation que l'alphabet détruirait.
      setData(d);
    } catch {
      setErreur(
        "Classification indisponible. Vérifier que les migrations 130 et 131 sont appliquées "
        + "et que scripts/fdi/importer.py a été exécuté."
      );
    } finally { setChargement(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const ouvrirCreation = (e: Edition) => {
    setEdition(e); setChampFr(""); setChampEn(""); setDefFr(""); setDefEn(""); setErreurForm(null);
  };
  const ouvrirModification = (famille: Famille,
                              l: { id: number; libelle_fr: string; libelle_en: string;
                                   definition_fr?: string; definition_en?: string }) => {
    setEdition({ mode: "modifier", famille, ...l });
    setChampFr(l.libelle_fr); setChampEn(l.libelle_en);
    setDefFr(l.definition_fr ?? ""); setDefEn(l.definition_en ?? "");
    setErreurForm(null);
  };

  const enregistrer = async () => {
    if (!edition) return;
    const fr = champFr.trim(), en = champEn.trim();
    if (!fr || !en) { setErreurForm("Les deux libellés sont obligatoires."); return; }
    setEnvoi(true); setErreurForm(null);
    try {
      const base = `${API_BASE}/fdi/${CHEMIN[edition.famille]}`;
      const corps: Record<string, unknown> = { libelle_fr: fr, libelle_en: en };
      if (edition.mode === "creer" && edition.famille === "sous") corps.secteur_id = edition.secteur_id;
      if (edition.famille === "signal") {
        corps.definition_fr = defFr.trim();
        corps.definition_en = defEn.trim();
      }
      const r = await fetch(edition.mode === "creer" ? base : `${base}/${edition.id}`, {
        method: edition.mode === "creer" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(corps),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Enregistrement refusé (HTTP ${r.status}).`);
      }
      setSucces(edition.mode === "creer" ? "Poste ajouté." : "Libellés corrigés — les projets rattachés suivent.");
      setEdition(null);
      await charger();
      setTimeout(() => setSucces(null), 4000);
    } catch (e: unknown) {
      setErreurForm(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setEnvoi(false); }
  };

  // Un secteur est retenu si LUI correspond (tous ses sous-secteurs restent
  // alors visibles) ou si l'un de ses sous-secteurs correspond (seuls ceux-là
  // s'affichent) : on ne perd jamais le contexte du parent.
  const secteursFiltres = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.secteurs;
    return data.secteurs.flatMap(s => {
      if ([s.libelle_fr, s.libelle_en].some(v => norm(v).includes(q))) return [s];
      const sous = s.sous_secteurs.filter(ss =>
        [ss.libelle_fr, ss.libelle_en].some(v => norm(v).includes(q)));
      return sous.length ? [{ ...s, sous_secteurs: sous }] : [];
    });
  }, [data, recherche]);

  const activitesFiltrees = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.activites;
    return data.activites.filter(a => [a.libelle_fr, a.libelle_en].some(v => norm(v).includes(q)));
  }, [data, recherche]);

  const signauxFiltres = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.signaux;
    // La définition est cherchée elle aussi : on retrouve « capital-risque »
    // sans savoir qu'il se cache derrière « New Funding ».
    return data.signaux.filter(g =>
      [g.libelle_fr, g.libelle_en, g.definition_fr, g.definition_en].some(v => norm(v).includes(q)));
  }, [data, recherche]);

  const typesFiltres = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.types_projet;
    return data.types_projet.filter(t => [t.libelle_fr, t.libelle_en].some(v => norm(v).includes(q)));
  }, [data, recherche]);

  const nbSousTrouves = secteursFiltres.reduce((n, s) => n + s.sous_secteurs.length, 0);

  // Une recherche déplie ce qu'elle trouve : sans cela, on verrait des secteurs
  // correspondants sans voir ce qui a correspondu.
  useEffect(() => {
    if (recherche.trim()) setOuverts(new Set(secteursFiltres.map(s => s.id)));
  }, [recherche, secteursFiltres]);

  const basculer = (id: number) => setOuverts(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const t = data?.totaux;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1180, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--encre)", marginBottom: 4 }}>
        Classification fDi Markets
      </h1>
      <p style={{ fontSize: 13, color: "var(--gris)", lineHeight: 1.6, marginBottom: 18 }}>
        La nomenclature sectorielle du Financial Times, en anglais et en français.
        Elle sert à rattacher chaque projet d&apos;investissement annoncé.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Compteur n={t?.secteurs ?? 0} mot="secteur" />
        <Compteur n={t?.sous_secteurs ?? 0} mot="sous-secteur" couleur="var(--violet)" />
        <Compteur n={t?.activites ?? 0} mot="activité" couleur="var(--orange)" />
        {/* « signal » fait « signaux » : Compteur, qui ajoute un « s », écrirait
            « 6 signals ». */}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cyan)",
          background: "color-mix(in srgb, var(--cyan) 7%, transparent)",
          padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
          {(t?.signaux ?? 0)} signa{(t?.signaux ?? 0) > 1 ? "ux" : "l"}
        </span>
        {/* « type de projet » : c'est « type » qui s'accorde, pas « projet ». */}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--violet)",
          background: "color-mix(in srgb, var(--violet) 7%, transparent)",
          padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
          {(t?.types_projet ?? 0)} type{(t?.types_projet ?? 0) > 1 ? "s" : ""} de projet
        </span>
        {/* Compteur n'accorde que son dernier mot (« ligne tenue icis ») : ce
            libellé-ci s'écrit donc à la main. */}
        {!!t?.lignes_admin && (
          <span title="Lignes créées ou corrigées depuis cet écran : l'import ne les écrase plus."
            style={{ fontSize: 11.5, fontWeight: 700, color: "var(--vert)",
              background: "color-mix(in srgb, var(--vert) 7%, transparent)",
              padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
            {t.lignes_admin} ligne{t.lignes_admin > 1 ? "s" : ""} tenue{t.lignes_admin > 1 ? "s" : ""} ici
          </span>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Avis ton="info">
          <strong>Renommer se propage.</strong>{" "}Un projet porte l&apos;identifiant du poste, jamais
          son libellé : corriger un nom ici met à jour tous les projets rattachés, même les plus
          anciens. La suppression n&apos;existe pas — un poste retiré emporterait le rattachement
          de ces projets. Un poste que fDi ne publie plus reste donc en place et continue de
          décrire le passé.
        </Avis>
      </div>

      {erreur && <div style={{ marginBottom: 18 }}><Avis ton="erreur">{erreur}</Avis></div>}
      {succes && <div style={{ marginBottom: 18 }}><Avis ton="ok">{succes}</Avis></div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Segments
          options={[
            { v: "secteurs" as const,  l: "Secteurs & sous-secteurs", n: t?.secteurs },
            { v: "activites" as const, l: "Activités économiques",    n: t?.activites },
            { v: "signaux" as const,   l: "Signaux d'investisseur",   n: t?.signaux },
            { v: "types" as const,     l: "Types de projet",          n: t?.types_projet },
          ]}
          value={vue} onChange={setVue}
        />
        {/* Recherche et bouton restent solidaires : à quatre onglets, la barre
            de segments occupe presque toute la ligne, et sans ce groupe le
            bouton se retrouvait seul sur la ligne suivante. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 420px", minWidth: 0 }}>
        <ChampRecherche
          value={recherche} onChange={setRecherche}
          placeholder={vue === "signaux" ? "Rechercher un signal, jusque dans sa définition…" : "Rechercher en français ou en anglais…"}
          style={{ flex: 1, minWidth: 180 }}
        />
        <button onClick={() => ouvrirCreation({ mode: "creer",
          famille: vue === "secteurs" ? "secteur" : vue === "activites" ? "activite"
                 : vue === "signaux" ? "signal" : "type" })}
          style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} />
          {vue === "secteurs" ? "Nouveau secteur" : vue === "activites" ? "Nouvelle activité"
            : vue === "signaux" ? "Nouveau signal" : "Nouveau type"}
        </button>
        </div>
      </div>

      {chargement ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "70px 0", color: "var(--gris)" }}>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : vue === "secteurs" ? (
        <Carte
          titre="Arbre sectoriel"
          aide={
            <>
              Deux niveaux : secteur, puis sous-secteur. Un libellé marqué{" "}
              <Pastille>partagé</Pastille> sert à plusieurs secteurs — «&nbsp;Other&nbsp;» en sert
              24 sur 37. Un tel libellé n&apos;identifie donc rien à lui seul : le rattachement
              d&apos;un projet exigera toujours son secteur.
            </>
          }
          extra={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {recherche.trim() && (
                <span style={{ fontSize: 11.5, color: "var(--gris)" }}>
                  {secteursFiltres.length} secteur{secteursFiltres.length > 1 ? "s" : ""} ·{" "}
                  {nbSousTrouves} sous-secteur{nbSousTrouves > 1 ? "s" : ""}
                </span>
              )}
              <button onClick={() => setOuverts(ouverts.size ? new Set() : new Set(secteursFiltres.map(s => s.id)))}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5,
                  fontWeight: 700, color: "var(--bleu)", fontFamily: "var(--font-google-sans)", padding: 0 }}>
                {ouverts.size ? "Tout replier" : "Tout déplier"}
              </button>
            </div>
          }
        >
          {secteursFiltres.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
              Aucun secteur ni sous-secteur ne correspond à « {recherche} ».
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {secteursFiltres.map(s => {
                const ouvert = ouverts.has(s.id);
                return (
                  <div key={s.id} style={{ border: "1px solid var(--bordure)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px 9px 0",
                      background: ouvert ? "var(--bleu-voile)" : "var(--carte)", transition: "background 0.12s" }}>
                      <button onClick={() => basculer(s.id)} aria-expanded={ouvert}
                        style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "2px 0 2px 14px",
                          background: "none", border: "none", cursor: "pointer", textAlign: "left",
                          fontFamily: "var(--font-google-sans)", minWidth: 0 }}>
                        {ouvert ? <ChevronDown size={14} style={{ color: "var(--bleu)", flexShrink: 0 }} />
                                : <ChevronRight size={14} style={{ color: "var(--gris)", flexShrink: 0 }} />}
                        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)" }}>{s.libelle_fr}</span>
                          <span style={{ fontSize: 11.5, color: "var(--gris-fort)" }}>{s.libelle_en}</span>
                        </span>
                        {s.origine === "admin" && <Pastille couleur="var(--vert)" titre="Créé ou corrigé ici : l'import ne l'écrase plus.">tenu ici</Pastille>}
                        <Compteur n={s.sous_secteurs.length} mot="sous-secteur" couleur="var(--violet)" />
                      </button>
                      <BoutonIcone titre={`Corriger « ${s.libelle_fr} »`}
                        onClick={() => ouvrirModification("secteur", s)}>
                        <Pencil size={12} />
                      </BoutonIcone>
                      <BoutonIcone titre={`Ajouter un sous-secteur dans « ${s.libelle_fr} »`}
                        onClick={() => ouvrirCreation({ mode: "creer", famille: "sous", secteur_id: s.id, secteur_nom: s.libelle_fr })}>
                        <Plus size={13} />
                      </BoutonIcone>
                    </div>

                    {ouvert && (
                      <div style={{ borderTop: "1px solid var(--bordure)" }}>
                        {s.sous_secteurs.length === 0 ? (
                          <p style={{ fontSize: 12, color: "var(--gris)", padding: "14px 38px" }}>
                            Aucun sous-secteur. Le bouton « + » de la ligne en ajoute un.
                          </p>
                        ) : s.sous_secteurs.map((ss, i) => (
                          <div key={ss.id} style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px 8px 38px",
                            borderTop: i ? "1px solid var(--filet)" : "none",
                            background: i % 2 ? "var(--carte-douce)" : "var(--carte)" }}>
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 12.5, color: "var(--encre)", fontWeight: 600 }}>{ss.libelle_fr}</span>
                              <span style={{ fontSize: 11, color: "var(--gris-fort)" }}>{ss.libelle_en}</span>
                            </span>
                            {ss.origine === "admin" && <Pastille couleur="var(--vert)" titre="Créé ou corrigé ici : l'import ne l'écrase plus.">tenu ici</Pastille>}
                            {ss.partage && (
                              <Pastille titre={`« ${ss.libelle_en_base} » sert à plusieurs secteurs : le rattachement exige le secteur.`}>
                                partagé
                              </Pastille>
                            )}
                            <BoutonIcone titre={`Corriger « ${ss.libelle_fr} »`}
                              onClick={() => ouvrirModification("sous", ss)}>
                              <Pencil size={12} />
                            </BoutonIcone>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Carte>
      ) : vue === "signaux" ? (
        <Carte
          titre="Signaux d'investisseur"
          aide={
            <>
              La nomenclature la plus prospective de fDi : elle ne décrit pas un projet annoncé
              mais une entreprise qui <em>pourrait</em>{" "}en annoncer un — un projet à l&apos;étude,
              une levée de fonds, une nomination régionale. C&apos;est la matière première du
              démarchage. L&apos;ordre est celui de la source, du signal le plus concret au plus
              faible ; il n&apos;est pas alphabétique, et c&apos;est voulu.
            </>
          }
        >
          {signauxFiltres.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
              Aucun signal ne correspond à « {recherche} ».
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signauxFiltres.map((g, i) => (
                <div key={g.id} style={{ border: "1px solid var(--bordure)", borderRadius: 12,
                  padding: "13px 12px 13px 16px", display: "flex", alignItems: "flex-start",
                  gap: 12, minWidth: 0 }}>
                  {/* Le rang rappelle la gradation : 1 = intention la plus avancée. */}
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                    background: "var(--bleu-voile)", color: "var(--bleu)", fontSize: 10.5,
                    fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {i + 1}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--encre)" }}>{g.libelle_fr}</span>
                    <span style={{ fontSize: 11.5, color: "var(--gris-fort)" }}>{g.libelle_en}</span>
                    {g.definition_fr && (
                      <span style={{ fontSize: 12, color: "var(--texte)", lineHeight: 1.65, marginTop: 4 }}>
                        {g.definition_fr}
                      </span>
                    )}
                  </span>
                  {g.origine === "admin" && <Pastille couleur="var(--vert)" titre="Créé ou corrigé ici.">tenu ici</Pastille>}
                  <BoutonIcone titre={`Corriger « ${g.libelle_fr} »`}
                    onClick={() => ouvrirModification("signal", g)}>
                    <Pencil size={12} />
                  </BoutonIcone>
                </div>
              ))}
            </div>
          )}
        </Carte>
      ) : vue === "activites" ? (
        <Carte
          titre="Activités économiques"
          aide={
            <>
              Elles ne prolongent pas l&apos;arbre sectoriel : elles disent ce que
              l&apos;entreprise vient <em>faire</em>{" "}dans le pays — usine, siège, centre de
              R&amp;D, logistique — et non ce qu&apos;elle produit. Un projet portera donc un
              sous-secteur <strong>et</strong>{" "}une activité. C&apos;est cette colonne qui
              distingue une implantation industrielle d&apos;un bureau de vente, donc la valeur
              ajoutée réellement captée.
            </>
          }
        >
          <ListePlate items={activitesFiltrees}
            vide={`Aucune activité ne correspond à « ${recherche} ».`}
            onCorriger={a => ouvrirModification("activite", a)} />
        </Carte>
      ) : (
        <Carte
          titre="Types de projet"
          aide={
            <>
              Ce que le projet fait à l&apos;existant. La distinction est décisive pour lire les
              chiffres : une <strong>extension</strong>{" "}prolonge un investisseur déjà présent —
              c&apos;est du suivi — quand une <strong>implantation nouvelle</strong>{" "}est une
              conquête. Les additionner sans les distinguer masquerait précisément ce que
              l&apos;agence cherche à mesurer.
            </>
          }
        >
          <ListePlate items={typesFiltres}
            vide={`Aucun type de projet ne correspond à « ${recherche} ».`}
            onCorriger={t => ouvrirModification("type", t)} />
        </Carte>
      )}

      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      {edition && (
        <div onClick={() => !envoi && setEdition(null)}
          style={{ position: "fixed", inset: 0, background: "rgb(var(--encre-rgb) / 0.45)",
            backdropFilter: "blur(6px)", zIndex: 700, display: "flex", alignItems: "center",
            justifyContent: "center", padding: 32 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal
            style={{ background: "var(--carte)", borderRadius: 18, width: "100%", maxWidth: 520,
              maxHeight: "90vh", display: "flex", flexDirection: "column",
              border: "1px solid var(--bordure)", boxShadow: "var(--ombre-2)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--bordure)", flexShrink: 0,
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--encre)", margin: 0 }}>
                  {edition.mode === "creer"
                    ? edition.famille === "secteur" ? "Nouveau secteur"
                      : edition.famille === "sous" ? "Nouveau sous-secteur"
                      : edition.famille === "signal" ? "Nouveau signal"
                      : edition.famille === "type" ? "Nouveau type de projet" : "Nouvelle activité"
                    : "Corriger les libellés"}
                </h2>
                {edition.mode === "creer" && edition.famille === "sous" && (
                  <p style={{ fontSize: 12, color: "var(--gris)", margin: "5px 0 0" }}>
                    Dans « {edition.secteur_nom} »
                  </p>
                )}
                {edition.mode === "modifier" && (
                  <p style={{ fontSize: 12, color: "var(--gris)", margin: "5px 0 0", lineHeight: 1.5 }}>
                    Les projets déjà rattachés suivront le nouveau nom.
                  </p>
                )}
              </div>
              <BoutonIcone titre="Fermer" onClick={() => !envoi && setEdition(null)}>
                <X size={13} />
              </BoutonIcone>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14,
              overflowY: "auto", flex: 1 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--gris)" }}>Libellé français</span>
                <input value={champFr} onChange={e => setChampFr(e.target.value)} style={IS} autoFocus />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--gris)" }}>Libellé anglais</span>
                <input value={champEn} onChange={e => setChampEn(e.target.value)} style={IS} />
                <span style={{ fontSize: 11, color: "var(--gris)", lineHeight: 1.5 }}>
                  Le libellé anglais doit être celui de fDi, au caractère près : c&apos;est lui qui
                  rattachera les projets à l&apos;import.
                </span>
              </label>
              {edition.famille === "signal" && (
                <>
                  {/* La définition n'est pas un commentaire : c'est elle qui dit
                      ce que le signal recouvre. « New Personnel » sans sa
                      définition se lirait comme un simple recrutement. */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "var(--gris)" }}>Définition française</span>
                    <textarea value={defFr} onChange={e => setDefFr(e.target.value)} rows={4}
                      style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "var(--gris)" }}>Définition anglaise</span>
                    <textarea value={defEn} onChange={e => setDefEn(e.target.value)} rows={4}
                      style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
                  </label>
                </>
              )}
              {erreurForm && <Avis ton="erreur">{erreurForm}</Avis>}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--bordure)", flexShrink: 0,
              background: "var(--carte-douce)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setEdition(null)} disabled={envoi} style={btnSecondaire}>Annuler</button>
              <button onClick={enregistrer} disabled={envoi}
                style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 7,
                  opacity: envoi ? 0.6 : 1 }}>
                {envoi ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                       : <Check size={13} />}
                {edition.mode === "creer" ? "Ajouter" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
