"use client";

// Rapport sur les projets annoncés — la page qu'on imprime et qu'on pose sur
// une table.
//
// Elle reprend, sans rien y ajouter, ce que montre l'onglet « Investissements
// projetés » : les quatre compteurs, la série annuelle, les deux
// dénombrements et les quatre classements. Sa raison d'être n'est pas de dire
// autre chose, c'est de tenir sur une feuille.
//
// Deux partis pris de fond :
//
//   * AUCUN CHIFFRE SANS SA PÉRIODE. Un rapport se cite, et un chiffre sorti
//     de son millésime devient faux l'année suivante.
//
//   * LA LECTURE EST ÉCRITE. L'encadré « à retenir » est calculé à partir des
//     données affichées, jamais rédigé d'avance : si les données changent, la
//     phrase change.

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, CarteRapport as Carte, CarteTableauAnnees, CEL, ChiffreCle,
         ClassementRapport, dateDuJour, fmtNombre, fmtVal, GrapheMultiPays } from "../partage";

const PAYS = "Sénégal";

/** L'en-tête de colonne des deux tableaux du rapport, écrit une fois : ils se
    suivent dans la page et doivent se lire de la même façon. */
const ENT_RAP = { fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
  letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "8px 10px",
  borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" as const } as const;

/** Le rang d'une ligne de tableau — la pastille des classements en liste, pour
    que le podium se repère de la même façon dans toute la plateforme.
    (Nommée `PastilleRang` et non `Rang` : ce dernier est déjà le type d'une
    ligne de classement dans ce fichier, et deux `Rang` se relisent mal.) */
const PastilleRang = ({ n }: { n: number }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10, fontSize: 10, fontWeight: 800,
    background: n <= 3 ? "var(--bleu)" : "var(--bleu-voile)",
    color: n <= 3 ? "var(--sur-bleu)" : "var(--texte)" }}>{n}</span>
);

/** Les trois colonnes chiffrées du classement des activités, et ce qu'on lit
    dans chacune. L'ordre de la liste EST l'ordre des colonnes : le montant
    d'abord, parce que c'est par lui que le tableau s'ouvre — un décideur
    demande d'abord où va l'argent, le nombre de projets vient qualifier
    ensuite. */
const COLS_ACTIVITES = [
  { cle: "capex_musd", libelle: "Montant investi*" },
  { cle: "nb", libelle: "Projets" },
  { cle: "emplois", libelle: "Emplois créés*" },
] as const;
type CleTri = (typeof COLS_ACTIVITES)[number]["cle"];

/** L'en-tête cliquable d'une colonne triable.

    TOUTES LES COLONNES PORTENT UNE FLÈCHE, et c'est la seule façon d'annoncer
    qu'elles se trient. On n'avait d'abord mis le chevron que sur la colonne
    active, pour ne pas donner à lire trois tris là où il n'y en a qu'un : le
    résultat est qu'on ne devinait pas les deux autres. Un tableau dont il faut
    savoir d'avance qu'il se trie ne se trie pour personne.

    LES DEUX ÉTATS SE DISTINGUENT PAR LA FORME, non par la seule couleur. La
    colonne inactive porte une double flèche grise — « ceci se trie, dans un
    sens ou dans l'autre » — et la colonne active un chevron unique, bleu, qui
    pointe le sens en vigueur. La différence tient donc aussi à l'impression et
    pour qui distingue mal les teintes.

    Le survol colore le titre en bleu : le curseur et la couleur confirment
    ensemble que la chose se clique. */
function EnteteTri({ libelle, actif, sens, onClick }: {
  libelle: string; actif: boolean; sens: "asc" | "desc"; onClick: () => void;
}) {
  return (
    <th style={{ ...ENT_RAP, textAlign: "right" as const, padding: 0 }}
      aria-sort={actif ? (sens === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={onClick}
        title={actif
          ? `Trier par ${libelle.replace("*", "")} — ordre ${sens === "desc" ? "croissant" : "décroissant"}`
          : `Trier par ${libelle.replace("*", "")}`}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
          width: "100%", padding: "8px 10px", border: "none", background: "transparent",
          cursor: "pointer", font: "inherit", letterSpacing: "inherit",
          textTransform: "inherit" as const, whiteSpace: "nowrap" as const,
          color: actif ? "var(--bleu)" : "inherit" }}
        onMouseEnter={e => { if (!actif) e.currentTarget.style.color = "var(--bleu)"; }}
        onMouseLeave={e => { if (!actif) e.currentTarget.style.color = "inherit"; }}>
        {libelle}
        {actif
          ? (sens === "desc"
              ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
              : <ChevronUp size={12} style={{ flexShrink: 0 }} />)
          : <ChevronsUpDown size={12} style={{ flexShrink: 0 }} />}
      </button>
    </th>
  );
}

// `iso` n'est renseigné que pour le classement des PAYS : c'est lui qui porte
// le drapeau. Il reste nul quand le pays n'a pas été rapproché du référentiel —
// le drapeau disparaît alors, le nom reste.
type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null;
              iso?: string | null };
type Projet = {
  id: number; periode: string; annee: number; entreprise: string | null;
  partenaire: string | null; secteur: string | null; sous_secteur: string | null;
  activite: string | null; type_projet: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
};
type Fdi = {
  kpis: { projets: number; capex_musd: number | null; emplois: number | null;
          capex_moyen: number | null; entreprises: number; partenaires: number;
          part_estimee: number | null; annees: [number | null, number | null] };
  par_annee: { annee: number; nb: number; capex_musd: number | null; emplois: number | null }[];
  tops: Record<"partenaires" | "secteurs" | "activites" | "entreprises" | "types", Rang[]>;
  projets: Projet[];
};

export default function RapportIde() {
  const d3Pret = useD3Pret();

  // Le rapport porte sur le pays que le lecteur regardait, et le lien de
  // retour le ramène EXACTEMENT à son écran — vue, pays, période, facettes.
  // C'est l'onglet qui écrit cet état dans son URL ; on ne fait que le
  // transporter.
  const [retour, setRetour] = useState("?section=projetes");
  // CE QUE LE RAPPORT PORTE EN TÊTE ET INTERROGE : un pays, ou une RÉGION
  // entière depuis que l'écran se lit aux deux échelles. Les deux s'écrivent
  // pareil dans le titre — c'est le périmètre lu, et il se nomme — mais pas
  // dans l'adresse du service, qui les distingue.
  const [cible, setCible] = useState<{ cle: "pays" | "region"; nom: string }>(
    { cle: "pays", nom: PAYS });
  useEffect(() => {
    const brut = new URLSearchParams(window.location.search).get("retour");
    if (!brut) return;
    setRetour(brut.startsWith("?") ? brut : `?${brut}`);
    const p = new URLSearchParams(brut);
    if (p.get("region")) setCible({ cle: "region", nom: p.get("region") as string });
    else if (p.get("pays")) setCible({ cle: "pays", nom: p.get("pays") as string });
  }, []);
  const pays = cible.nom;

  const qFdi = useDonnees<Fdi>(
    `${API}/fdi/public/projets?${cible.cle}=${encodeURIComponent(cible.nom)}`, { garder: true });
  const fdi = qFdi.data;

  // Les cinq années les plus riches en annonces.
  const anneesFortes = useMemo(() => [...(fdi?.par_annee ?? [])]
    .filter(a => a.capex_musd)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 5), [fdi]);

  const plusGrands = useMemo(() => [...(fdi?.projets ?? [])]
    .filter(p => p.capex_musd != null)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 8), [fdi]);

  // ── LE CLASSEMENT DES ACTIVITÉS, TRIÉ PAR LE LECTEUR ───────────────────────
  // IL S'OUVRE SUR LE MONTANT, décroissant. C'est la première question d'un
  // comité — où va l'argent —, et le nombre de projets, qui menait ce tableau
  // jusqu'ici, ne la posait pas : « Services aux entreprises » mène de loin en
  // projets (69) et pèse trois fois moins que « Fabrication » en capital.
  //
  // LES TROIS COLONNES SE TRIENT, parce qu'aucune ne résume les deux autres.
  // Un même relevé se lit différemment selon qu'on cherche des projets, des
  // capitaux ou des emplois, et trancher pour le lecteur revenait à lui cacher
  // deux lectures sur trois.
  const [triCol, setTriCol] = useState<CleTri>("capex_musd");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [toutesActivites, setToutesActivites] = useState(false);
  // Cliquer la colonne active RETOURNE le tri ; cliquer une autre colonne s'y
  // pose en décroissant. Repartir de l'ordre croissant sur une colonne qu'on
  // vient de choisir montrerait d'abord les plus petites valeurs, ce que
  // personne ne demande d'un classement.
  const trierPar = (c: CleTri) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };
  const activites = useMemo(() => {
    const lignes = [...(fdi?.tops?.activites ?? [])];
    // LES VALEURS MANQUANTES RESTENT EN QUEUE DANS LES DEUX SENS. Une activité
    // dont le relevé ne dit pas le capital n'est pas « la plus petite » : on ne
    // sait pas. La remonter en tête d'un tri croissant en ferait une réponse.
    lignes.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
      if (x == null) return 1;
      if (y == null) return -1;
      if (x !== y) return triSens === "desc" ? y - x : x - y;
      return a.nom.localeCompare(b.nom, "fr");
    });
    return lignes;
  }, [fdi, triCol, triSens]);

  const dateEdition = dateDuJour();
  const periodeFdi = fdi?.kpis?.annees?.[0] != null
    ? `${fdi.kpis.annees[0]} — ${fdi.kpis.annees[1]}` : "";

  const serieCapex = [{
    nom: "Investissement annoncé", couleur: "var(--bleu)",
    data: (fdi?.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.capex_musd })),
  }];

  return (
    <main style={{ minHeight: "100vh", background: "var(--champ)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .rap-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .rap-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
        .rap-trio { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1080px) { .rap-trio { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 980px) { .rap-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rap-duo { grid-template-columns: 1fr; } }
        @media (max-width: 720px) { .rap-trio { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .rap-kpis { grid-template-columns: 1fr; } }
        /* À l'impression, la page perd ses commandes et ses cartes cessent de
           se couper en deux entre deux feuilles. */
        @media print {
          .rap-sans-impression { display: none !important; }
          .rap-eviter-coupure { break-inside: avoid; }
        }
      `}</style>

      {/* ── Bandeau ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--degrade-hero)", color: "var(--sur-bleu)", padding: "26px 40px 74px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" as const, marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em",
                  textTransform: "uppercase" as const, color: "rgba(255,255,255,0.55)" }}>APIX S.A — DIPE</p>
                <Link href={`/ide${retour}`} className="rap-sans-impression"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
                    color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.12)",
                    padding: "5px 12px", borderRadius: 999, textDecoration: "none" }}>
                  <ArrowLeft size={13} /> Retour aux données
                </Link>
              </div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                Projets annoncés — {pays}
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", fontWeight: 500 }}>
                Source fDi Markets — Mise à jour le {dateEdition}
              </p>
            </div>
            <div style={{ flexShrink: 0 }} className="rap-sans-impression"><NavActions onDark home flouTotal /></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 90px" }}>

        {fdi && (
          <>
            {/* Les quatre compteurs, chevauchant le bandeau. */}
            <div className="rap-kpis" style={{ marginTop: -46, position: "relative" as const, zIndex: 2 }}>
              <ChiffreCle label="Projets annoncés" valeur={fmtNombre(fdi.kpis.projets)} annee={periodeFdi}
                note={`${fdi.kpis.entreprises} entreprises · ${fdi.kpis.partenaires} pays d'origine`} />
              <ChiffreCle label="Investissement annoncé" valeur={fmtVal(fdi.kpis.capex_musd)} annee={periodeFdi}
                note={fdi.kpis.part_estimee != null
                  ? `dont ${fdi.kpis.part_estimee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % estimés par le FT`
                  : null} />
              <ChiffreCle label="Emplois annoncés" valeur={fmtNombre(fdi.kpis.emplois)} annee={periodeFdi}
                note="à la création des projets" />
              <ChiffreCle label="Taille moyenne" valeur={fmtVal(fdi.kpis.capex_moyen)} annee={periodeFdi}
                note="par projet annoncé" />
            </div>

            <section style={{ marginTop: 44 }}>
              {/* ── LES TROIS SÉRIES ANNUELLES, CHIFFRÉES, EN PREMIER ──────────
                  LE CHIFFRE AVANT LA COURBE. Les quatre compteurs du haut de
                  page donnent un total par mesure ; la question qui vient
                  ensuite est « combien par année », et c'est un tableau qui y
                  répond — avec, en plus, le millésime précédent et l'écart, que
                  nulle courbe ne donne à lire sans qu'on la survole.

                  LES TROIS MESURES SONT CELLES DES COMPTEURS, dans le même
                  ordre : l'argent annoncé, les projets qui le portent, les
                  emplois qu'ils promettent. Chacune garde sa teinte d'un bout à
                  l'autre du rapport.

                  L'INVESTISSEMENT S'ÉCRIT EN MONTANTS, non en nombres bruts.
                  Le tableau reçoit `fmtVal` — celui des compteurs du haut — et
                  ses colonnes chiffrées s'élargissent en conséquence : « 1,2 Md
                  $ » ne tient pas dans la place d'un nombre de projets. */}
              <div className="rap-trio">
                <CarteTableauAnnees titre="Valeur des invest. annoncés par année"
                  libelleValeur="Montant" fmt={fmtVal} largeurValeur={58} largeurEcart={62} barre={false}
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.capex_musd }))} />
                <CarteTableauAnnees titre="Projets annoncés" accent="var(--orange)"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <CarteTableauAnnees titre="Emplois annoncés" accent="var(--vert)"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.emplois }))} />
              </div>

              {/* ── PUIS LA COURBE ─────────────────────────────────────────────
                  ELLE NE RÉPÈTE PAS LE TABLEAU, ELLE EN DIT AUTRE CHOSE : le
                  tableau donne les valeurs, la courbe donne la FORME — les
                  creux, les paliers, le pic. Elle vient donc après les chiffres
                  qu'elle résume, et son titre le dit : c'est l'ÉVOLUTION qu'on
                  y lit, quand le tableau, lui, porte encore le nom de la mesure.
                  Deux cartes nommées à l'identique dans une même page auraient
                  fait croire à un doublon. */}
              {d3Pret && serieCapex[0].data.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Carte titre="Évolution des investissements annoncés par année" tag={periodeFdi}>
                    <GrapheMultiPays series={serieCapex} height={250} type="line" titre="rap-capex" showDots />
                  </Carte>
                </div>
              )}

              {/* Les classements de la page : d'où vient l'argent, dans quoi il
                  va, et ce que l'entreprise vient faire. d3 arrive dans un
                  module séparé — rendre un graphe avant lui lève, et une page de
                  rapport qui casse à l'ouverture ne se rattrape pas.

                  « ENTREPRISES LES PLUS ACTIVES » EST RETIRÉ. Ce classement
                  comptait des PROJETS par entreprise, et sur un pays il donnait
                  des colonnes de sept, quatre, trois, trois, trois… — des écarts
                  trop faibles pour qu'un graphe à barres dise quoi que ce soit,
                  et un palmarès qui se retourne au premier projet annoncé. Les
                  entreprises ont leur écran, avec leurs comptes sur tout le
                  relevé ; c'est là qu'on les classe.

                  « NATURE DES IMPLANTATIONS » DEVIENT « LES ACTIVITÉS LES PLUS
                  MENÉES ». Le classement lit la colonne des ACTIVITÉS — ce que
                  l'entreprise vient faire sur place : fabriquer, vendre,
                  distribuer. « Nature des implantations » nommait une autre
                  colonne du relevé, celle des TYPES de projet, qui n'est pas
                  affichée ici. */}
              {/* ── LES DEUX PREMIERS CLASSEMENTS SONT DES LISTES ORDONNÉES ──
                  CELLES DU RAPPORT DES SIGNAUX, au composant près. Un graphe à
                  barres range par longueur ; ces deux classements-là se lisent
                  par RANG — quel est le premier pays d'origine, le deuxième, le
                  troisième —, et le rang n'y était écrit nulle part : il fallait
                  le compter de l'œil. La liste le numérote, met le podium en
                  pastille pleine, garde la barre pour la proportion, et tient
                  huit lignes dans la hauteur que le graphe prenait pour six.

                  Les deux rapports de la plateforme se ressemblent désormais là
                  où ils disent la même chose. La colonne chiffrée dit « Projets »
                  et non « Signaux » : ce sont deux relevés distincts, et le
                  lecteur qui passe de l'un à l'autre doit voir lequel il lit. */}
              <div className="rap-duo" style={{ marginTop: 16 }}>
                {/* LES DRAPEAUX, comme sur le rapport des signaux. Un pays se
                    reconnaît à son drapeau avant d'être lu, et c'est le seul
                    classement du rapport dont les lignes en portent un. */}
                <ClassementRapport titre="Origine des projets" colonne="Pays" drapeaux
                  libelleValeur="Projets" accent="var(--orange)" rows={fdi.tops.partenaires ?? []} />
                <ClassementRapport titre="Secteurs les plus visés" colonne="Secteur"
                  libelleValeur="Projets" accent="var(--bleu)" rows={fdi.tops.secteurs ?? []} />
              </div>

              {/* ── LES ACTIVITÉS, EN TABLEAU ───────────────────────────────────
                  LE GRAPHE NE PORTAIT QU'UN NOMBRE. Il rangeait les activités
                  par nombre de projets, et c'est tout ce qu'on en tirait. Or le
                  relevé sait dire, pour chacune, ce qu'elle pèse en ARGENT et en
                  EMPLOIS — et les trois ne disent pas la même chose : une
                  activité peut mener le classement des projets et peser peu en
                  capital, ou l'inverse. Un tableau porte les trois côte à côte
                  là où une barre n'en portait qu'une.

                  Il prend le dessin des « plus gros projets annoncés », juste
                  en dessous : deux tableaux voisins dans une même page doivent
                  se lire de la même façon. */}
              {activites.length > 0 && (
                <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                  <Carte titre="Classement des activités menées" tag={periodeFdi}>
                    <div style={{ overflowX: "auto" as const }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                        <thead>
                          <tr>
                            <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                            <th style={{ ...ENT_RAP, textAlign: "left" as const }}>Activité</th>
                            {COLS_ACTIVITES.map(c => (
                              <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                                actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(toutesActivites ? activites : activites.slice(0, 10)).map((r, i) => (
                            <tr key={r.nom}>
                              {/* LE RANG SUIT LE TRI : il dit la place dans le
                                  classement qu'on a sous les yeux, non une
                                  place absolue qui contredirait l'ordre des
                                  lignes. */}
                              <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                              <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={r.nom}>{r.nom}</td>
                              {/* LA COLONNE QUI TRIE PORTE LA COULEUR ET LE
                                  GRAS. Le vert était sur les projets quand ils
                                  menaient le tableau ; il suit maintenant le
                                  tri, sans quoi l'œil serait attiré par une
                                  colonne qui ne commande plus rien. */}
                              {COLS_ACTIVITES.map(c => (
                                <td key={c.cle} style={{ ...CEL, textAlign: "right" as const,
                                  fontVariantNumeric: "tabular-nums" as const,
                                  fontWeight: triCol === c.cle ? 800 : undefined,
                                  color: triCol === c.cle ? "var(--vert)" : undefined }}>
                                  {c.cle === "capex_musd" ? fmtVal(r.capex_musd) : fmtNombre(r[c.cle])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* AU-DELÀ DES DIX. Le service rend la nomenclature entière
                        — dix-sept activités au plus —, et le tableau s'ouvre sur
                        les dix premières : c'est un classement, et sa queue
                        n'intéresse qu'après coup. Le bouton dit combien de
                        lignes il reste, pour qu'on sache ce qu'on déplie. */}
                    {/* LE BOUTON DES SÉRIES ANNUELLES, AU PIXEL PRÈS. Trois
                        cartes de cette même page en portent déjà un — même
                        libellé, même pilule, même « Réduire » au retour. Un
                        quatrième bouton d'un dessin à soi, sur la même page,
                        se serait lu comme un autre geste. */}
                    {activites.length > 10 && (
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}
                        className="rap-sans-impression">
                        <button onClick={() => setToutesActivites(v => !v)}
                          style={{ padding: "6px 16px", borderRadius: 999,
                            border: "1px solid var(--bordure-forte)", background: "var(--carte)",
                            color: toutesActivites ? "var(--texte)" : "var(--bleu)", fontSize: 11.5,
                            fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--champ)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--carte)"; }}>
                          {toutesActivites ? "Réduire" : `Afficher la suite (${activites.length - 10})`}
                        </button>
                      </div>
                    )}
                    {/* L'ASTÉRISQUE PORTE L'AVERTISSEMENT, ET UNE LIGNE SUFFIT.
                        Ces deux colonnes sont des SOMMES : elles ne peuvent pas
                        porter le « ≈ » ligne à ligne du tableau voisin, puisque
                        chacune mêle des projets déclarés et des projets estimés
                        sans qu'on puisse dire lesquels. « Comprend » et non
                        « sont » : tout n'y est pas estimé, et écrire le
                        contraire discréditerait des chiffres en partie
                        déclarés. */}
                    <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                      {/* LA PHRASE DIT CE QUE LES FLÈCHES NE DISENT PAS : que
                          le tri se change, et qu'un second clic le retourne.
                          Les flèches annoncent la possibilité, elles
                          n'apprennent pas le geste. Elle ne s'imprime pas —
                          sur papier, plus rien ne se clique. */}
                      <span className="rap-sans-impression">
                        Cliquez un en-tête de colonne pour trier le classement ; un second clic
                        inverse l&apos;ordre.<br />
                      </span>
                      * Comprend des valeurs estimées par l&apos;algorithme du Financial Times,
                      non déclarées par l&apos;entreprise.
                    </p>
                  </Carte>
                </div>
              )}

              <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                <Carte titre="Les plus gros projets annoncés" tag={periodeFdi}>
                  <div style={{ overflowX: "auto" as const }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                      <thead>
                        <tr>
                          <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                          {["Entreprise", "Origine", "Secteur", "Période", "Montant", "Emplois"].map((t, i) => (
                            <th key={t} style={{ ...ENT_RAP,
                              textAlign: i >= 4 ? "right" as const : "left" as const }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plusGrands.map((p, i) => (
                          <tr key={p.id}>
                            <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                            <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>{p.entreprise ?? "—"}</td>
                            <td style={CEL}>{p.partenaire ?? "—"}</td>
                            <td style={CEL}>{p.secteur ?? "—"}</td>
                            <td style={{ ...CEL, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>{p.periode}</td>
                            <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
                              {p.capex_estime && <span style={{ fontWeight: 800 }}>≈ </span>}
                              {fmtVal(p.capex_musd)}
                            </td>
                            <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
                              {p.emplois_estime && <span style={{ fontWeight: 800 }}>≈ </span>}
                              {fmtNombre(p.emplois)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Carte>
              </div>

              <ARetenir>
                {fdi.tops.partenaires?.[0] && fdi.tops.secteurs?.[0] ? (
                  <>
                    Sur {periodeFdi}, <strong>{fdi.kpis.projets} projets</strong> ont été annoncés par{" "}
                    <strong>{fdi.kpis.entreprises} entreprises</strong> venues de{" "}
                    <strong>{fdi.kpis.partenaires} pays</strong>. Le premier pays d&apos;origine est{" "}
                    <strong>{fdi.tops.partenaires[0].nom}</strong> ({fdi.tops.partenaires[0].nb} projets), le
                    premier secteur visé <strong>{fdi.tops.secteurs[0].nom}</strong> ({fdi.tops.secteurs[0].nb}).
                    {anneesFortes[0] && (
                      <> L&apos;année la plus riche en annonces est <strong>{anneesFortes[0].annee}</strong>{" "}
                        ({fmtVal(anneesFortes[0].capex_musd)}).</>
                    )}
                    {fdi.kpis.part_estimee != null && fdi.kpis.part_estimee > 50 && (
                      <> Ces montants sont à manier avec précaution :{" "}
                        <strong>{fdi.kpis.part_estimee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong>{" "}
                        d&apos;entre eux sont estimés par le Financial Times, l&apos;entreprise ne les ayant pas déclarés.</>
                    )}
                  </>
                ) : "Aucun projet n'a encore été importé pour ce périmètre."}
              </ARetenir>
            </section>
          </>
        )}
      </div>
    </main>
  );
}


