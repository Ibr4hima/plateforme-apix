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
import { GrapheBarresH } from "@/components/charts/GrapheBarresH";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, CarteRapport as Carte, CarteTableauAnnees, CEL, ChiffreCle,
         dateDuJour, fmtNombre, fmtVal, GrapheMultiPays, moisEnClair } from "../partage";

type Rang = { nom: string; nb: number };
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
  tops: Record<"origines" | "entreprises" | "secteurs" | "natures"
             | "destinations" | "activites", Rang[]>;
  zones: Zone[];
  remarquables: { funding: Gros[]; capex: Gros[] };
};

/** Une des trois lectures de l'Afrique de l'Ouest. Le nom vient du référentiel
    des groupements, jamais du code : c'est l'administration qui tient la
    composition, et une adhésion corrigée là-bas doit se voir ici. */
type Zone = {
  code: string; nom: string; signaux: number; entreprises: number;
  secteurs: Rang[]; destinations: Rang[]; entreprises_top: Rang[];
};

/** Le périmètre du relevé, tel qu'il a été interrogé chez fDi. Écrit ici comme
    sur l'écran : le jour où un second périmètre sera relevé, c'est de la base
    qu'il devra venir. */
const PERIMETRE = "Afrique";

/** Un tableau de signaux remarquables. Les deux montants ont le même gabarit —
    ils se lisent l'un après l'autre — mais jamais la même colonne : voir
    l'en-tête du fichier. */
function TableauGros({ lignes, unite }: { lignes: Gros[]; unite: string }) {
  if (lignes.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--gris)" }}>Aucun montant renseigné.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Entreprise", "Origine", "Destination", "Stade", "Période", unite].map((t, i) => (
              <th key={t} style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                textAlign: i === 5 ? "right" : "left", padding: "8px 10px",
                borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(l => (
            <tr key={`${l.id}-${unite}`}>
              <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>{l.entreprise ?? "—"}</td>
              <td style={CEL}>{l.origine ?? "—"}</td>
              <td style={CEL}>{l.destination ?? "—"}</td>
              <td style={CEL}>{l.nature ?? "—"}</td>
              <td style={{ ...CEL, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {moisEnClair(l.periode)}
              </td>
              <td style={{ ...CEL, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {l.estime && <span style={{ fontWeight: 800 }}>≈ </span>}{fmtVal(l.montant)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

              {/* LES CINQ CLASSEMENTS, dans l'ordre des questions : qui vient,
                  d'où, ce qu'il vise, et pour y faire quoi. */}
              {d3Pret && (
                <div className="rap-duo" style={{ marginTop: 16 }}>
                  {([
                    { cle: "origines" as const, titre: "Pays d'origine", couleur: "var(--bleu)" },
                    { cle: "destinations" as const, titre: "Destinations visées — pays d'Afrique", couleur: "var(--vert)" },
                    { cle: "secteurs" as const, titre: "Secteurs visés", couleur: "var(--violet)" },
                    { cle: "activites" as const, titre: "Activités prévues", couleur: "var(--bleu)" },
                    { cle: "entreprises" as const, titre: "Entreprises les plus actives", couleur: "var(--orange)" },
                  ]).map(c => {
                    const rows = (d.tops[c.cle] ?? []).slice(0, 8)
                      .map(r => ({ label: r.nom, valeur: r.nb }));
                    if (rows.length === 0) return null;
                    return (
                      <Carte key={c.cle} titre={c.titre} tag="nombre de signaux">
                        <GrapheBarresH data={rows} couleur={c.couleur} fmt={fmtNombre} exposant={1} />
                      </Carte>
                    );
                  })}
                </div>
              )}

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
              {d3Pret && d.zones?.length > 0 && (() => {
                const z = d.zones[Math.min(zone, d.zones.length - 1)];
                const carte = (titre: string, couleur: string, rangs: Rang[]) => {
                  const rows = rangs.slice(0, 8).map(r => ({ label: r.nom, valeur: r.nb }));
                  if (rows.length === 0) return null;
                  return (
                    <Carte titre={`${titre} — ${z.nom}`} tag="nombre de signaux">
                      <GrapheBarresH data={rows} couleur={couleur} fmt={fmtNombre} exposant={1} />
                    </Carte>
                  );
                };
                return (
                  <div style={{ marginTop: 26 }} className="rap-eviter-coupure">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14,
                      flexWrap: "wrap", marginBottom: 14 }}>
                      <h2 style={{ fontSize: "1.05rem", fontWeight: 800,
                        color: "var(--encre)", letterSpacing: "-0.01em" }}>
                        L&apos;Afrique de l&apos;Ouest, trois périmètres
                      </h2>
                      {/* LE POIDS DE LA ZONE À CÔTÉ DE SON NOM. « Premier secteur
                          avec 40 signaux » ne se lit pas de la même façon selon
                          que la zone en porte 60 ou 600. */}
                      <p style={{ fontSize: 12, color: "var(--gris)" }}>
                        {fmtNombre(z.signaux)} signaux · {fmtNombre(z.entreprises)} entreprises
                        {periode ? ` · ${periode}` : ""}
                      </p>
                    </div>

                    <div className="rap-sans-impression" style={{ display: "inline-flex",
                      gap: 4, padding: 4, borderRadius: 999, background: "var(--champ)",
                      border: "1px solid var(--bordure)", marginBottom: 14, flexWrap: "wrap" }}>
                      {d.zones.map((o, i) => (
                        <button key={o.code} type="button" onClick={() => setZone(i)}
                          aria-pressed={i === zone}
                          style={{ border: "none", cursor: "pointer", borderRadius: 999,
                            padding: "6px 15px", fontSize: 12, fontWeight: 700,
                            fontFamily: "inherit",
                            background: i === zone ? "var(--carte)" : "transparent",
                            color: i === zone ? "var(--encre)" : "var(--gris)",
                            boxShadow: i === zone ? "0 1px 3px rgb(0 0 0 / 0.10)" : "none" }}>
                          {o.nom}
                        </button>
                      ))}
                    </div>
                    {/* À L'IMPRESSION, LA BASCULE DISPARAÎT ET LE NOM RESTE : une
                        feuille de papier ne se clique pas, et trois graphiques
                        sans zone nommée ne voudraient rien dire. */}
                    <p style={{ display: "none", fontSize: 12, fontWeight: 700,
                      color: "var(--encre)", marginBottom: 10 }}
                      className="rap-zone-impression">Zone : {z.nom}</p>

                    {/* LES TROIS CARTES GARDENT LA MÊME DEMI-LARGEUR, la
                        troisième laissant une demi-colonne vide. Lui donner la
                        pleine largeur a été essayé et rejeté : une barre longue
                        comme la page pour une entreprise qui porte TROIS signaux
                        donne à un petit nombre l'allure d'un grand. La colonne
                        vide coûte moins cher que cette illusion. */}
                    <div className="rap-duo">
                      {carte("Secteurs les plus visés", "var(--violet)", z.secteurs)}
                      {carte("Pays les plus visés", "var(--vert)", z.destinations)}
                      {carte("Entreprises les plus actives", "var(--orange)", z.entreprises_top)}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: 26 }} className="rap-eviter-coupure">
                <Carte titre="Les plus grosses levées de fonds" tag={periode}>
                  <TableauGros lignes={d.remarquables.funding} unite="Fonds levés" />
                </Carte>
              </div>

              <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                <Carte titre="Les plus gros investissements annoncés" tag={periode}>
                  <TableauGros lignes={d.remarquables.capex} unite="Investissement" />
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
