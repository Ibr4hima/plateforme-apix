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
import { ArrowLeft } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import { GrapheBarresH } from "@/components/charts/GrapheBarresH";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, CarteRapport as Carte, CarteTableauAnnees, CEL, ChiffreCle,
         dateDuJour, fmtNombre, fmtVal, GrapheMultiPays } from "../partage";

const PAYS = "Sénégal";

type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null };
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
  const [pays, setPays] = useState(PAYS);
  useEffect(() => {
    const brut = new URLSearchParams(window.location.search).get("retour");
    if (!brut) return;
    setRetour(brut.startsWith("?") ? brut : `?${brut}`);
    const p = new URLSearchParams(brut);
    if (p.get("pays")) setPays(p.get("pays") as string);
  }, []);

  const qFdi = useDonnees<Fdi>(
    `${API}/fdi/public/projets?pays=${encodeURIComponent(pays)}`, { garder: true });
  const fdi = qFdi.data;

  // Les cinq années les plus riches en annonces.
  const anneesFortes = useMemo(() => [...(fdi?.par_annee ?? [])]
    .filter(a => a.capex_musd)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 5), [fdi]);

  const plusGrands = useMemo(() => [...(fdi?.projets ?? [])]
    .filter(p => p.capex_musd != null)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 8), [fdi]);

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
                <CarteTableauAnnees titre="Investissement annoncé par année"
                  libelleValeur="Montant" fmt={fmtVal} largeurValeur={58} largeurEcart={62} barre={false}
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.capex_musd }))} />
                <CarteTableauAnnees titre="Projets annoncés"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <CarteTableauAnnees titre="Emplois annoncés" accent="var(--violet)"
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
              {d3Pret && (
              <div className="rap-duo" style={{ marginTop: 16 }}>
                {([
                  { cle: "partenaires" as const, titre: "Origine des projets", couleur: "var(--orange)" },
                  { cle: "secteurs" as const, titre: "Secteurs les plus visés", couleur: "var(--bleu)" },
                  { cle: "activites" as const, titre: "Les activités les plus menées", couleur: "var(--vert)" },
                ]).map((c, i) => {
                  const rows = (fdi.tops[c.cle] ?? []).slice(0, 8).map(r => ({ label: r.nom, valeur: r.nb }));
                  if (rows.length === 0) return null;
                  // LE TROISIÈME PREND TOUTE LA LARGEUR. À quatre classements la
                  // grille tombait juste ; à trois, le dernier laissait une
                  // demi-page blanche à sa droite. Il l'occupe — et c'est celui
                  // qui en profite le plus : ses libellés sont les plus longs
                  // du rapport (« Logistique, distribution et transport »), et
                  // une colonne de moitié les serrait contre leurs barres.
                  const pleineLargeur = i === 2;
                  return (
                    <div key={c.cle} style={pleineLargeur ? { gridColumn: "1 / -1" } : undefined}>
                      <Carte titre={c.titre} tag="nombre de projets">
                        <GrapheBarresH data={rows} couleur={c.couleur} fmt={fmtNombre} exposant={1} />
                      </Carte>
                    </div>
                  );
                })}
              </div>
              )}

              <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
                <Carte titre="Les plus gros projets annoncés" tag={periodeFdi}>
                  <div style={{ overflowX: "auto" as const }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                      <thead>
                        <tr>
                          {["Entreprise", "Origine", "Secteur", "Période", "Montant", "Emplois"].map((t, i) => (
                            <th key={t} style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                              letterSpacing: "0.1em", textTransform: "uppercase" as const,
                              textAlign: i >= 4 ? "right" as const : "left" as const, padding: "8px 10px",
                              borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" as const }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plusGrands.map(p => (
                          <tr key={p.id}>
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
                  <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                    Un <span style={{ fontWeight: 800, color: "var(--encre)" }}>≈</span>{" "}signale une valeur
                    estimée par l&apos;algorithme du Financial Times, et non déclarée par l&apos;entreprise.
                  </p>
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


