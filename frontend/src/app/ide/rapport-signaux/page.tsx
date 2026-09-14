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
import DrapeauPays from "@/components/shared/DrapeauPays";
import { badge_ambre, badge_bleu, badge_gris, badge_orange, badge_vert,
         badge_violet } from "@/lib/couleurs";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, CarteRapport as Carte, CarteTableauAnnees, ChiffreCle,
         ClassementRapport, dateDuJour, fmtNombre, fmtVal, GrapheMultiPays,
         moisEnClair, SegmentRapport } from "../partage";

type Rang = { nom: string; nb: number; iso?: string | null };
type Gros = {
  id: number; periode: string; entreprise: string | null; origine: string | null;
  origine_iso: string | null; destination_iso: string | null;
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
  tops: Record<"origines" | "entreprises" | "secteurs" | "natures"
             | "destinations" | "activites", Rang[]>;
  zones: Zone[];
  remarquables: { funding: Gros[]; capex: Gros[] };
};

/** Une des trois lectures de l'Afrique de l'Ouest. Le nom vient du référentiel
    des groupements, jamais du code : c'est l'administration qui tient la
    composition, et une adhésion corrigée là-bas doit se voir ici. */
type Zone = {
  code: string; nom: string; court: string; signaux: number; entreprises: number;
  secteurs: Rang[]; destinations: Rang[]; entreprises_top: Rang[];
};

/** Le périmètre du relevé, tel qu'il a été interrogé chez fDi. Écrit ici comme
    sur l'écran : le jour où un second périmètre sera relevé, c'est de la base
    qu'il devra venir. */
const PERIMETRE = "Afrique";

/** LES CINQ TEINTES DES STADES, celles des pastilles de la vue publique. Un
    rapport qui recolorerait « Financement levé » obligerait à refaire le
    rapprochement de tête en passant de l'écran au document. Le gris reste le
    repli : un stade que fDi ajouterait demain se verrait, au lieu d'emprunter
    la couleur d'un autre et de mentir en silence. */
const BADGES_STADE: Record<string, React.CSSProperties> = {
  "Projet à l'étude": badge_vert,
  "Stratégie d'investissement": badge_orange,
  "Financement levé": badge_violet,
  "Nomination régionale": badge_bleu,
  "Contrat de fourniture": badge_ambre,
};

/** Les signaux les plus lourds — le tableau qu'on lit en diagonale pour savoir
    qui approcher.

    CE QUI A CHANGÉ PAR RAPPORT AU TABLEAU ORDINAIRE QU'IL ÉTAIT, et pourquoi :

      * L'ORIGINE ET LA DESTINATION SONT UN TRAJET, non deux colonnes. « Émirats
        arabes unis » puis, deux centimètres plus loin, « Égypte » demandait de
        recomposer le mouvement ; une flèche entre deux drapeaux le donne d'un
        coup d'œil, et rend au passage la moitié de la largeur que ces deux
        colonnes se partageaient.

      * LE MONTANT EST LA COLONNE QU'ON VIENT LIRE, il en a donc la taille et le
        poids. Il était rendu au même corps que la période, dans un tableau
        classé par montant : la hiérarchie de la page démentait son propre tri.

      * UNE BARRE SOUS CHAQUE MONTANT dit l'écart au plus gros. Entre 80 et
        60 Md $ l'œil ne fait pas la différence sur des chiffres alignés ; la
        barre montre que le second vaut les trois quarts du premier, et que le
        huitième n'en vaut pas le vingtième.

      * LE RANG EST ÉCRIT. Un tableau trié par montant porte un classement
        implicite ; l'écrire évite de recompter les lignes pour citer « le
        troisième plus gros ».

      * PLUS DE FILETS ENTRE LES LIGNES, un fond alterné à la place — c'est ce
        que font les classements du même rapport, et deux grammaires de tableau
        sur une même page se voient.

    L'ENTREPRISE PEUT S'AFFICHER TRONQUÉE — « Vantage Data Ce… ». Ce n'est pas la
    colonne qui coupe : la source elle-même ne publie qu'un nom écourté, et le
    relevé porte ce que la source montre. Inventer la fin serait pire. */
function TableauGros({ lignes, unite, accent }: {
  lignes: Gros[]; unite: string; accent: string;
}) {
  if (lignes.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--gris)" }}>Aucun montant renseigné.</p>;
  }
  const sommet = Math.max(1e-9, ...lignes.map(l => l.montant ?? 0));
  const ENT: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: "var(--gris)",
    letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" };
  // Une grille plutôt qu'un <table> : les colonnes se règlent au minmax, la
  // ligne reste une ligne flexible, et rien ne se décale quand un nom s'allonge.
  const COLS = "26px minmax(130px,1.25fr) minmax(190px,1.9fr) minmax(140px,max-content) 92px 132px";
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 720 }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12,
          alignItems: "center", padding: "0 10px 8px" }}>
          <span style={ENT}>#</span>
          <span style={ENT}>Entreprise</span>
          <span style={ENT}>Origine → destination</span>
          <span style={ENT}>Stade</span>
          <span style={ENT}>Période</span>
          <span style={{ ...ENT, textAlign: "right" }}>{unite}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {lignes.map((l, i) => {
            const rang = i + 1, podium = rang <= 3;
            return (
              <div key={`${l.id}-${unite}`} style={{ display: "grid",
                gridTemplateColumns: COLS, gap: 12, alignItems: "center",
                padding: "9px 10px", borderRadius: 9,
                background: i % 2 ? "rgb(var(--encre-rgb) / 0.018)" : "transparent" }}>
                <span style={{ display: "inline-flex", alignItems: "center",
                  justifyContent: "center", minWidth: 20, height: 20, borderRadius: 10,
                  fontSize: 10, fontWeight: 800,
                  background: podium ? accent : "var(--bleu-voile)",
                  color: podium ? "var(--sur-bleu)" : "var(--texte)" }}>{rang}</span>

                <span title={l.entreprise ?? undefined} style={{ fontSize: 13, fontWeight: 700,
                  color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>{l.entreprise ?? "—"}</span>

                <span style={{ display: "inline-flex", alignItems: "center", gap: 7,
                  minWidth: 0, fontSize: 12, color: "var(--texte)" }}>
                  <DrapeauPays iso={l.origine_iso} nom={l.origine ?? ""} taille={14} />
                  <span title={l.origine ?? undefined} style={{ overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.origine ?? "—"}</span>
                  <span style={{ color: "var(--gris)", flexShrink: 0 }}>→</span>
                  <DrapeauPays iso={l.destination_iso} nom={l.destination ?? ""} taille={14} />
                  <span title={l.destination ?? undefined} style={{ fontWeight: 650,
                    color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap" }}>{l.destination ?? "—"}</span>
                </span>

                <span>
                  {l.nature && (
                    <span style={{ ...(BADGES_STADE[l.nature] ?? badge_gris),
                      whiteSpace: "nowrap" }}>{l.nature}</span>
                  )}
                </span>

                <span style={{ fontSize: 11.5, color: "var(--gris)", whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums" }}>{moisEnClair(l.periode)}</span>

                <span style={{ display: "flex", flexDirection: "column",
                  alignItems: "flex-end", gap: 5 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--encre)",
                    whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {/* Le « ≈ » reste, sa note explicative non : la valeur vient
                        de l'algorithme du Financial Times et n'a pas été déclarée
                        par l'entreprise. L'infobulle le dit à qui s'interroge,
                        sans alourdir la page pour tous les autres. */}
                    {l.estime && (
                      <span title="Valeur estimée par la source, non déclarée par l'entreprise"
                        style={{ color: "var(--gris)" }}>≈ </span>
                    )}
                    {fmtVal(l.montant)}
                  </span>
                  <span style={{ width: "100%", height: 4, borderRadius: 99,
                    background: "var(--bleu-voile)", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", borderRadius: 99,
                      background: accent, opacity: podium ? 0.9 : 0.5,
                      width: `${Math.max(3, (l.montant ?? 0) / sommet * 100)}%` }} />
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
    `${API}/fdi/public/signaux?par_page=1${filtres ? `&${filtres}` : ""}`, { garder: true });
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
        /* SIX COLONNES POUR NE JAMAIS LAISSER DE TROU. Cinq classements sur une
           grille de deux ou de trois laissent forcément une case vide au dernier
           rang. Sur six colonnes, trois cartes de deux colonnes remplissent la
           première rangée et deux cartes de trois colonnes remplissent la
           seconde : chaque rangée est pleine, et les largeurs restent lisibles. */
        .rap-grille { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 16px; align-items: start; }
        .rap-tiers  { grid-column: span 2; }
        .rap-moitie { grid-column: span 3; }
        @media (max-width: 1080px) {
          .rap-grille { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .rap-tiers, .rap-moitie { grid-column: span 1; }
        }
        @media (max-width: 980px) { .rap-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rap-duo { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .rap-grille { grid-template-columns: 1fr; } }
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
              <ChiffreCle label="Signaux relevés" valeur={fmtNombre(d.kpis.signaux)} annee={periode}
                note={`${fmtNombre(d.kpis.entreprises)} entreprises`} />
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

              <div className="rap-duo" style={{ marginTop: 16 }}>
                <CarteTableauAnnees titre="Signaux relevés"
                  rows={d.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <CarteTableauAnnees titre="Fonds levés (M$)" accent="var(--violet)"
                  rows={d.par_annee.map(a => ({ annee: a.annee, valeur: a.funding_musd }))} />
              </div>

              {/* LES CINQ CLASSEMENTS, dans l'ordre des questions : d'où l'on
                  vient, ce qu'on vise, dans quel secteur, pour y faire quoi, et
                  qui s'y montre le plus. Les trois premiers tiennent au tiers de
                  page, les deux derniers à la moitié — les noms d'activités et
                  d'entreprises sont les plus longs, ils ont la place en plus. */}
              <div className="rap-grille" style={{ marginTop: 16 }}>
                <div className="rap-tiers">
                  <ClassementRapport titre="Pays d'origine" colonne="Pays" drapeaux
                    accent="var(--bleu)" rows={d.tops.origines ?? []} />
                </div>
                <div className="rap-tiers">
                  <ClassementRapport titre="Destinations visées" tag="pays d'Afrique"
                    colonne="Pays" drapeaux accent="var(--vert)"
                    rows={d.tops.destinations ?? []} />
                </div>
                <div className="rap-tiers">
                  <ClassementRapport titre="Secteurs visés" colonne="Secteur"
                    accent="var(--violet)" rows={d.tops.secteurs ?? []} />
                </div>
                <div className="rap-moitie">
                  <ClassementRapport titre="Activités prévues" colonne="Activité"
                    accent="var(--bleu)" rows={d.tops.activites ?? []} />
                </div>
                <div className="rap-moitie">
                  <ClassementRapport titre="Entreprises les plus actives"
                    colonne="Entreprise" accent="var(--orange)"
                    rows={d.tops.entreprises ?? []} />
                </div>
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

                    {/* TROIS CLASSEMENTS, TROIS TIERS DE PAGE, aucune case vide :
                        c'est ce que la mise en lignes permet et que les barres
                        interdisaient.

                        LE SIGLE EST DANS LA PASTILLE, PAS DANS LE TITRE. Accolé
                        au titre, il le faisait passer à deux lignes sur une
                        carte et une seule sur les autres, et les trois en-têtes
                        ne s'alignaient plus. La pastille le porte sans allonger
                        la ligne, et une carte découpée ou imprimée reste
                        interprétable. */}
                    <div className="rap-grille">
                      <div className="rap-tiers">
                        <ClassementRapport titre="Secteurs les plus visés" tag={z.court}
                          colonne="Secteur" accent="var(--violet)" rows={z.secteurs} />
                      </div>
                      <div className="rap-tiers">
                        <ClassementRapport titre="Pays les plus visés" tag={z.court}
                          colonne="Pays" drapeaux accent="var(--vert)" rows={z.destinations} />
                      </div>
                      <div className="rap-tiers">
                        <ClassementRapport titre="Entreprises les plus actives" tag={z.court}
                          colonne="Entreprise" accent="var(--orange)" rows={z.entreprises_top} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: 26 }} className="rap-eviter-coupure">
                <Carte titre="Les plus grosses levées de fonds" tag={periode}>
                  <TableauGros lignes={d.remarquables.funding} unite="Fonds levés" accent="var(--violet)" />
                </Carte>
              </div>

              <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                <Carte titre="Les plus gros investissements annoncés" tag={periode}>
                  <TableauGros lignes={d.remarquables.capex} unite="Investissement" accent="var(--bleu)" />
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
