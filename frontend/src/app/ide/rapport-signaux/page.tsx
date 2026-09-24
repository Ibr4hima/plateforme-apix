"use client";

// Rapport sur les signaux d'investissement — la page qu'on imprime et qu'on
// pose sur une table.
//
// CE QU'IL DIT ET QUE CELUI DES PROJETS NE DIT PAS. Un projet annoncé est un
// fait : il se compte, se somme, se compare d'une année à l'autre. Un signal
// est une INTENTION — une entreprise qui étudie un site, lève des fonds, nomme
// un responsable régional. On ne vient pas ici mesurer un flux, on vient
// décider qui approcher, quand, et avec quel argument.
//
// D'où l'ordre des sections, qui est celui des questions d'un décideur :
// combien et de quelle nature, qui vient et d'où, ce qui est visé, quels sont
// les dossiers les plus lourds, et enfin qu'est-ce qui est tombé récemment.
//
// TROIS PARTIS PRIS DE FOND :
//
//   * AUCUN CHIFFRE SANS SA PÉRIODE. Un rapport se cite, et un chiffre sorti
//     de son millésime devient faux l'année suivante.
//
//   * LE DÉCOMPTE EST UN PLANCHER, ET LE RAPPORT LE DIT. La source n'affiche
//     qu'une destination par signal et cache les autres ; tant que la
//     complétion n'est pas faite, tout dénombrement par destination est un
//     minimum. Le taire produirait un document indéfendable.
//
//   * LES DEUX MONTANTS NE S'ADDITIONNENT PAS. Des fonds levés mesurent ce
//     qu'une entreprise a réuni ; un investissement prévu ce qu'elle annonce
//     dépenser. Les mêler ferait un total qui ne correspond à rien.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, BoutonSuite, CarteRapport as Carte, CarteTableauAnnees, CEL,
         ChiffreCle, ClassementRapport, dateDuJour, ENT_RAP, EnteteTri, FENETRE_RAPPORT,
         fmtNombre, fmtVal, GrapheMultiPays, moisEnClair, PastilleRang,
         SegmentRapport } from "../partage";

type Rang = { nom: string; nb: number; iso?: string | null };
type Gros = {
  id: number; periode: string; entreprise: string | null; origine: string | null;
  montant: number | null; estime: boolean | null;
  nature: string | null; destination: string | null;
};
type Signaux = {
  kpis: { signaux: number; funding_musd: number | null; capex_musd: number | null;
          entreprises: number; origines: number;
          annees: [number | null, number | null];
          a_completer: number; plancher: boolean };
  par_annee: { annee: number; nb: number; funding_musd: number | null;
               capex_musd: number | null }[];
  tops: Record<"origines" | "secteurs" | "natures"
             | "destinations" | "activites", Rang[]>;
  zones: Zone[];
  remarquables: { funding: Gros[]; capex: Gros[] };
};

/** Une des trois lectures de l'Afrique de l'Ouest. Le nom vient du référentiel
    des groupements, jamais du code : c'est l'administration qui tient la
    composition, et une adhésion corrigée là-bas doit se voir ici. */
type Zone = {
  code: string; nom: string; court: string;
  secteurs: Rang[]; destinations: Rang[];
};

/** Le périmètre du relevé, tel qu'il a été interrogé chez fDi. Écrit ici comme
    sur l'écran : le jour où un second périmètre sera relevé, c'est de la base
    qu'il devra venir. */
const PERIMETRE = "Afrique";

/** Les colonnes triables d'un signal remarquable. Le montant d'abord — c'est
    lui qui définit la carte —, la période en dernier : elle coupait la ligne
    entre ce qu'on lit et ce qu'on compare. */
const COLS_GROS = [
  { cle: "montant", libelle: "" },
  { cle: "periode", libelle: "Période" },
] as const;
type CleGros = (typeof COLS_GROS)[number]["cle"];

/** Un tableau de signaux remarquables. Les deux montants ont le même gabarit —
    ils se lisent l'un après l'autre — mais jamais la même colonne : voir
    l'en-tête du fichier.

    LE MÊME TABLEAU QUE LE RAPPORT DES PROJETS : rang en pastille, colonnes
    triables, dix lignes puis le reste au dépliage. Les deux documents se
    lisent l'un après l'autre et doivent se manœuvrer de la même façon ; les
    briques viennent du fichier partagé pour qu'aucune ne puisse dériver d'un
    rapport à l'autre.

    IL S'OUVRE SUR LE MONTANT, décroissant — c'est le critère qui définit la
    carte. LE CLASSEMENT EST COMPLET : tous les signaux qui portent ce montant,
    et non plus les vingt plus gros. « Afficher la suite » déplie donc TOUT le
    reste, et le tri par période porte sur le relevé entier. */
function TableauGros({ lignes, unite }: { lignes: Gros[]; unite: string }) {
  const [triCol, setTriCol] = useState<CleGros>("montant");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [tout, setTout] = useState(false);

  // Cliquer la colonne active RETOURNE le tri ; cliquer l'autre s'y pose en
  // décroissant — personne ne demande d'un classement qu'il s'ouvre par le bas.
  const trierPar = (c: CleGros) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const rangees = useMemo(() => {
    const l = [...lignes];
    l.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      // Un montant manquant n'est pas un petit montant : on ne le connaît pas,
      // et il reste en queue dans les deux sens.
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      // La période se compare comme un texte — « 2024-12 » et « 2010-05 » se
      // rangent d'eux-mêmes —, le montant comme un nombre.
      const d = typeof x === "string" || typeof y === "string"
        ? String(x).localeCompare(String(y))
        : (x as number) - (y as number);
      return triSens === "desc" ? -d : d;
    });
    return l;
  }, [lignes, triCol, triSens]);

  if (lignes.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--gris)" }}>Aucun montant renseigné.</p>;
  }
  const reste = rangees.length - FENETRE_RAPPORT;

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
              {["Entreprise", "Origine", "Destination", "Stade"].map(t => (
                <th key={t} style={{ ...ENT_RAP, textAlign: "left" as const }}>{t}</th>
              ))}
              {/* LA COLONNE DU MONTANT PORTE LE NOM DE CE QU'ELLE COMPTE —
                  « Investissement » ou « Fonds levés » — et jamais l'autre :
                  des fonds levés mesurent ce qu'une entreprise a réuni, un
                  investissement ce qu'elle annonce dépenser. */}
              {COLS_GROS.map(c => (
                <EnteteTri key={c.cle} libelle={c.libelle || unite} sens={triSens}
                  actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(tout ? rangees : rangees.slice(0, FENETRE_RAPPORT)).map((l, i) => {
              const chiffre = (cle: CleGros) => ({ ...CEL, textAlign: "right" as const,
                whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const,
                fontWeight: triCol === cle ? 800 : undefined,
                color: triCol === cle ? "var(--vert)" : undefined });
              return (
                <tr key={`${l.id}-${unite}`}>
                  {/* LE RANG SUIT LE TRI : il dit la place dans le classement
                      qu'on a sous les yeux, non une place absolue qui
                      contredirait l'ordre des lignes. */}
                  <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                  <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>{l.entreprise ?? "—"}</td>
                  <td style={CEL}>{l.origine ?? "—"}</td>
                  <td style={CEL}>{l.destination ?? "—"}</td>
                  <td style={CEL}>{l.nature ?? "—"}</td>
                  <td style={chiffre("montant")}>
                    {l.estime && <span style={{ fontWeight: 800 }}>≈ </span>}{fmtVal(l.montant)}
                  </td>
                  <td style={chiffre("periode")}>{moisEnClair(l.periode)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <BoutonSuite reste={reste} tout={tout} onBasculer={() => setTout(v => !v)} />
    </>
  );
}

export default function RapportSignaux() {
  const d3Pret = useD3Pret();

  // La zone ouest-africaine regardée. Le rang plutôt que le code : l'ordre vient
  // du serveur — géographie, union commerciale, union monétaire — et une zone
  // que le référentiel ne porterait pas n'aurait pas d'onglet à sélectionner.
  const [zone, setZone] = useState(0);

  // Le rapport porte sur ce que le lecteur regardait, et le lien de retour le
  // ramène EXACTEMENT à son écran — filtres compris. C'est l'onglet qui écrit
  // cet état dans son URL ; on ne fait que le transporter.
  const [retour, setRetour] = useState("?section=projetes&vue=signaux");
  const [filtres, setFiltres] = useState("");
  useEffect(() => {
    const brut = new URLSearchParams(window.location.search).get("retour");
    if (!brut) return;
    setRetour(brut.startsWith("?") ? brut : `?${brut}`);
    // LES FILTRES DE L'ÉCRAN S'APPLIQUENT AU RAPPORT. Un document tiré d'une
    // sélection doit porter cette sélection, sinon il dément l'écran d'où on
    // l'a demandé. On ne reprend que les clefs du relevé — « section » et
    // « vue » décrivent la navigation, pas les données.
    const p = new URLSearchParams(brut);
    const q = new URLSearchParams();
    // Les clefs de l'onglet sont préfixées — « sec » et « act » appartiennent
    // déjà aux projets — et l'API attend les siennes. La correspondance est
    // écrite ici, une fois.
    for (const [depuis, vers] of [["s_ori", "origine"], ["s_dest", "destination"],
                                  ["s_sec", "secteurs"], ["s_act", "activites"],
                                  ["s_nat", "natures"], ["s_q", "recherche"]]) {
      if (p.get(depuis)) q.set(vers, p.get(depuis) as string);
    }
    setFiltres(q.toString());
  }, []);

  const q = useDonnees<Signaux>(
    `${API}/fdi/public/signaux?par_page=1&rapport=1${filtres ? `&${filtres}` : ""}`, { garder: true });
  const d = q.data;

  const periode = d?.kpis?.annees?.[0] != null
    ? `${d.kpis.annees[0]} — ${d.kpis.annees[1]}` : "";
  const dateEdition = dateDuJour();

  // Les années les plus denses en signaux. Elles se lisent comme un climat, non
  // comme une performance : un signal n'est pas un investissement réalisé.
  const anneesFortes = useMemo(() => [...(d?.par_annee ?? [])]
    .sort((a, b) => b.nb - a.nb).slice(0, 3), [d]);

  const serie = [{
    nom: "Signaux relevés", couleur: "var(--bleu)",
    data: (d?.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.nb })),
  }];

  return (
    <main style={{ minHeight: "100vh", background: "var(--champ)",
      fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .rap-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .rap-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
        /* TROIS COLONNES, TROIS CLASSEMENTS : la rangée est pleine, et c'est
           tout ce qu'il faut depuis que le quatrième est remonté à côté du
           compte par année. La grille à six colonnes qui vivait ici servait à
           loger cinq cartes sans laisser de trou ; elle n'a plus d'objet. */
        .rap-trio { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1080px) { .rap-trio { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 720px) { .rap-trio { grid-template-columns: 1fr; } }
        @media (max-width: 980px) { .rap-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rap-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .rap-kpis { grid-template-columns: 1fr; } }
        @media print {
          .rap-sans-impression { display: none !important; }
          .rap-eviter-coupure { break-inside: avoid; }
          .rap-zone-impression { display: block !important; }
        }
      `}</style>

      <div style={{ background: "var(--degrade-hero)", color: "var(--sur-bleu)",
        padding: "26px 40px 74px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14,
                flexWrap: "wrap", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>APIX S.A — DIPE</p>
                <Link href={`/ide${retour}`} className="rap-sans-impression"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5,
                    fontWeight: 700, color: "rgba(255,255,255,0.85)",
                    background: "rgba(255,255,255,0.12)", padding: "5px 12px",
                    borderRadius: 999, textDecoration: "none" }}>
                  <ArrowLeft size={13} /> Retour aux données
                </Link>
              </div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.15,
                letterSpacing: "-0.01em" }}>
                Signaux d&apos;investissement — {PERIMETRE}
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "9px 0 0",
                fontWeight: 500 }}>
                Source fDi Markets — Mise à jour le {dateEdition}
              </p>
            </div>
            <div style={{ flexShrink: 0 }} className="rap-sans-impression">
              <NavActions onDark home flouTotal />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 90px" }}>
        {d && (
          <>
            {/* CE QUE LES QUATRE COMPTEURS DISENT, ET DANS CET ORDRE : combien
                d'intentions, qui les porte, ce qu'elles ont levé, ce qu'elles
                annoncent dépenser. */}
            <div className="rap-kpis" style={{ marginTop: -46, position: "relative", zIndex: 2 }}>
              {/* « NB DE PROJETS ANNONCÉS », ET SOUS LUI CE QUE CE NOMBRE EST.
                  Un signal n'est pas un projet réalisé : c'est une intention
                  exprimée — une entreprise qui étudie un site, lève des fonds,
                  nomme un responsable régional. La ligne de note le dit
                  désormais en toutes lettres, à la place du nombre
                  d'entreprises, qui comptait autre chose que le compteur
                  au-dessus de lui et se lisait pour lui. */}
              <ChiffreCle label="Nb de projets annoncés" valeur={fmtNombre(d.kpis.signaux)} annee={periode}
                note="Intentions d'invest. exprimées" />
              <ChiffreCle label="Fonds levés" valeur={fmtVal(d.kpis.funding_musd)} annee={periode}
                note="cumul des levées annoncées" />
              <ChiffreCle label="Investissement prévu" valeur={fmtVal(d.kpis.capex_musd)} annee={periode}
                note="cumul des montants annoncés" />
              {/* LE NOMBRE DE PAYS D'OÙ PARTENT LES INTENTIONS. C'est la mesure
                  de l'ÉTENDUE du vivier : cent signaux venus de six pays et cent
                  signaux venus de quarante ne demandent pas la même prospection. */}
              <ChiffreCle label="NB pays source" valeur={fmtNombre(d.kpis.origines)} annee={periode}
                note="pays d'origine des entreprises" />
            </div>

            <section style={{ marginTop: 26 }}>
              {d3Pret && serie[0].data.length > 0 && (
                <Carte titre="Signaux relevés par année" tag={periode}>
                  <GrapheMultiPays series={serie} height={250} type="line"
                    titre="rap-signaux" showDots />
                </Carte>
              )}

              {/* ── LE COMPTE PAR ANNÉE, PUIS D'OÙ ILS VIENNENT ───────────────
                  « FONDS LEVÉS PAR ANNÉE » EST RETIRÉ. Il doublait le compteur
                  du haut et la courbe, pour une mesure que ce rapport ne met
                  pas en avant — 57 Md $ de fonds levés contre 512 Md $
                  d'investissement prévu —, et sa série annuelle sautait d'un
                  facteur mille d'un millésime à l'autre : 11 M $ en 2019,
                  22 141 M $ en 2024. Une série qui bondit ainsi ne se lit pas
                  comme une tendance, elle se lit comme une anomalie. Les fonds
                  levés gardent leur compteur en tête de page et leur tableau
                  nommé plus bas, où ils disent quelque chose : QUI les a levés.

                  LES DEUX CLASSEMENTS GÉOGRAPHIQUES PRENNENT SA PLACE, et la
                  rangée passe à trois colonnes : le compte par année, d'où part
                  l'intention, où elle va. Les trois se lisent ensemble — un
                  signal se résume par sa date, son origine et sa cible. */}
              <div className="rap-trio" style={{ marginTop: 16 }}>
                <CarteTableauAnnees titre="Signaux relevés"
                  rows={d.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <ClassementRapport titre="Pays d'origine" colonne="Pays" drapeaux max={10}
                  accent="var(--bleu)" rows={d.tops.origines ?? []} />
                {/* LE SÉNÉGAL Y FIGURE TOUJOURS, comme au bilan ouest-africain
                    plus bas : le rapport se lit depuis Dakar, et un classement
                    continental où le pays n'apparaît pas laisse sans réponse —
                    onzième, ou dernier des cinquante ? */}
                <ClassementRapport titre="Destinations visées" tag="pays d'Afrique"
                  colonne="Pays" drapeaux epingle="Sénégal" max={10}
                  accent="var(--vert)" rows={d.tops.destinations ?? []} />
              </div>

              {/* CE QU'ON VISE, DANS QUEL SECTEUR, POUR Y FAIRE QUOI. Les deux
                  questions géographiques — d'où l'on vient, où l'on va — sont
                  remontées d'un cran, à côté du compte par année ; restent les
                  deux qui décrivent le CONTENU de l'intention.

                  LA GRILLE SUIT LE NOMBRE DE CARTES, comme à chaque fois dans ce
                  rapport : ils étaient cinq, puis quatre, puis trois. À deux,
                  une rangée de deux est pleine — et c'est la seule qui le soit.

                  « ENTREPRISES LES PLUS ACTIVES » EST RETIRÉ D'ICI. Sur tout le
                  continent, ses valeurs tiennent en un mouchoir — dix signaux
                  pour la première, huit pour la quatrième : un palmarès qui se
                  retourne au premier signal relevé, quand les quatre autres
                  classements séparent nettement leur tête de leur queue. Le
                  bilan ouest-africain, plus bas, garde le sien : à l'échelle
                  d'une zone il compare des entreprises réellement présentes sur
                  le même terrain.

                  DIX LIGNES ET NON HUIT : c'est ce que le service renvoie, et
                  la largeur gagnée leur laisse la place. Une dixième ligne
                  affichée coûte un rang de plus à lire, pas une requête. */}
              <div className="rap-duo" style={{ marginTop: 16 }}>
                <ClassementRapport titre="Secteurs visés" colonne="Secteur" max={10}
                  accent="var(--violet)" rows={d.tops.secteurs ?? []} />
                <ClassementRapport titre="Activités prévues" colonne="Activité" max={10}
                  accent="var(--bleu)" rows={d.tops.activites ?? []} />
              </div>

              {/* ─── L'AFRIQUE DE L'OUEST, LUE DE TROIS FAÇONS ──────────────────
                  POURQUOI UNE BASCULE ET NON TROIS SECTIONS. La géographie,
                  l'union commerciale et l'union monétaire recouvrent presque les
                  mêmes pays ; ce qui intéresse, c'est l'ÉCART entre elles, et un
                  écart se voit en changeant de zone sur place, pas en faisant
                  trois pages de haut en bas.

                  La composition vient du référentiel des groupements, jamais du
                  code : une adhésion corrigée par l'administration se répercute
                  ici toute seule. Une zone absente du référentiel ne fait pas
                  d'onglet — la bascule n'offre que ce qui donnera un classement. */}
              {d.zones?.length > 0 && (() => {
                const z = d.zones[Math.min(zone, d.zones.length - 1)];
                return (
                  <div style={{ marginTop: 26 }} className="rap-eviter-coupure">
                    {/* L'EN-TÊTE DE SECTION DE LA PLATEFORME : le titre, puis
                        la bascule COLLÉE À LUI plutôt que repoussée au bord
                        droit. C'est le dessin des « Flux bilatéraux » du
                        tableau de bord, et il se lit mieux : l'œil passe du
                        sujet au choix sans traverser la page, et la bascule
                        appartient visiblement au titre — donc à la section
                        entière — au lieu de flotter au-dessus de la troisième
                        carte. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16,
                      flexWrap: "wrap", marginBottom: 16 }}>
                      <h2 style={{ fontSize: "1.3rem", fontWeight: 800,
                        color: "var(--encre)", letterSpacing: "-0.015em", margin: 0 }}>
                        Bilan ouest-africain des investissements
                      </h2>
                      {/* LE SIGLE, PAS LE NOM DÉPLOYÉ. Le référentiel porte
                          « Communauté économique des États de l'Afrique de
                          l'Ouest » ; personne ne dit cela, et trois noms de cette
                          longueur débordent la bascule. Le nom complet reste en
                          infobulle, et la pastille de chaque carte rappelle la
                          zone lue. */}
                      <span className="rap-sans-impression">
                        <SegmentRapport valeur={String(zone)} onChange={(v) => setZone(Number(v))}
                          options={d.zones.map((o, i) => ({ v: String(i), l: o.court, titre: o.nom }))} />
                      </span>
                    </div>
                    {/* À L'IMPRESSION, LA BASCULE DISPARAÎT ET LA ZONE RESTE :
                        une feuille de papier ne se clique pas, et trois
                        classements sans zone nommée ne voudraient rien dire. */}
                    <p style={{ display: "none", fontSize: 12, fontWeight: 700,
                      color: "var(--encre)", marginBottom: 10 }}
                      className="rap-zone-impression">Zone : {z.nom}</p>

                    {/* DEUX CLASSEMENTS, DEUX MOITIÉS DE PAGE.

                        « ENTREPRISES LES PLUS ACTIVES » EST RETIRÉ D'ICI AUSSI.
                        À l'échelle d'une zone, ses valeurs s'écrasent : trois
                        signaux pour la première, deux pour les cinq suivantes.
                        Un palmarès qui se retourne au premier signal relevé ne
                        classe rien — et il occupait un tiers de page à côté de
                        deux classements qui, eux, séparent nettement leur tête
                        de leur queue (195 contre 4 sur les pays).

                        LE SIGLE EST DANS LA PASTILLE, PAS DANS LE TITRE. Accolé
                        au titre, il le faisait passer à deux lignes sur une
                        carte et une seule sur les autres, et les trois en-têtes
                        ne s'alignaient plus. La pastille le porte sans allonger
                        la ligne, et une carte découpée ou imprimée reste
                        interprétable. */}
                    <div className="rap-duo">
                        <ClassementRapport titre="Secteurs les plus visés" tag={z.court}
                          colonne="Secteur" accent="var(--violet)" rows={z.secteurs} />
                        {/* LE SÉNÉGAL EST TOUJOURS LÀ. Le rapport se lit depuis
                            Dakar, et le premier réflexe devant un classement
                            régional est d'y chercher le Sénégal : ne pas l'y
                            trouver laisse sans réponse — est-il onzième ou
                            dernier ? Le service le joint au classement avec son
                            rang réel quand il sort des dix premiers, et la
                            carte l'y montre après un filet pointillé. Quand il
                            est dans le haut, il est seulement mis en évidence :
                            sa pastille de rang suffit à le situer. */}
                        <ClassementRapport titre="Pays les plus visés" tag={z.court}
                          colonne="Pays" drapeaux epingle="Sénégal"
                          accent="var(--orange)" rows={z.destinations} />
                    </div>
                  </div>
                );
              })()}

              {/* L'INVESTISSEMENT PRÉVU PASSE DEVANT LES FONDS LEVÉS. C'est le
                  montant que le rapport met en avant — 512 Md $ au compteur
                  contre 57 Md $ — et celui qui intéresse une agence de
                  promotion : ce qu'une entreprise compte dépenser sur place,
                  non ce qu'elle a réuni auprès de ses actionnaires. Les deux
                  tableaux gardent leur contenu ; seul leur ordre change. */}
              <div style={{ marginTop: 26 }} className="rap-eviter-coupure">
                <Carte titre="Classement des signaux d'investissement annoncés" tag={periode}>
                  <TableauGros lignes={d.remarquables.capex} unite="Investissement" />
                </Carte>
              </div>

              <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                <Carte titre="Classement des levées de fonds" tag={periode}>
                  <TableauGros lignes={d.remarquables.funding} unite="Fonds levés" />
                </Carte>
              </div>

              <ARetenir>
                {d.tops.natures?.[0] && d.tops.origines?.[0] ? (
                  <>
                    Sur {periode}, <strong>{fmtNombre(d.kpis.signaux)} signaux</strong> ont été
                    relevés, portés par <strong>{fmtNombre(d.kpis.entreprises)} entreprises</strong>{" "}
                    venues de <strong>{d.kpis.origines} pays</strong>. Le stade le plus fréquent est{" "}
                    <strong>{d.tops.natures[0].nom.toLowerCase()}</strong>{" "}
                    ({fmtNombre(d.tops.natures[0].nb)} signaux), et le premier pays d&apos;origine{" "}
                    <strong>{d.tops.origines[0].nom}</strong> ({fmtNombre(d.tops.origines[0].nb)}).
                    {d.tops.secteurs?.[0] && (
                      <> Le secteur le plus visé est{" "}
                        <strong>{d.tops.secteurs[0].nom}</strong>{" "}
                        ({fmtNombre(d.tops.secteurs[0].nb)} signaux).</>
                    )}
                    {anneesFortes[0] && (
                      <> L&apos;année la plus dense est <strong>{anneesFortes[0].annee}</strong>{" "}
                        ({fmtNombre(anneesFortes[0].nb)} signaux).</>
                    )}
                  </>
                ) : "Aucun signal n'a encore été importé pour ce périmètre."}
              </ARetenir>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
