"use client";

// Rapport sur l'investissement au Sénégal — la page qu'on imprime et qu'on
// pose sur une table.
//
// Elle ne montre rien que les deux onglets ne montrent déjà. Sa raison d'être
// est ailleurs : METTRE LES DEUX CÔTE À CÔTE. La CNUCED mesure ce qui est
// entré, fDi relève ce qui a été annoncé ; lues séparément, ces deux séries
// laissent croire à une contradiction, lues ensemble elles racontent le délai
// entre une décision et son décaissement.
//
// Trois partis pris de fond :
//
//   * AUCUN CHIFFRE SANS SON ANNÉE ni sans sa source. Un rapport se cite, et
//     un chiffre sorti de son millésime devient faux l'année suivante.
//
//   * LES ESTIMATIONS SONT DITES. L'essentiel des montants fDi de ce périmètre
//     est estimé par le Financial Times : présenter le total comme un fait
//     serait indéfendable devant quiconque connaît la source.
//
//   * LA LECTURE EST ÉCRITE. Les encadrés « à retenir » sont calculés à partir
//     des données affichées, jamais rédigés d'avance : si les données changent,
//     la phrase change.

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import { GrapheBarresH } from "@/components/charts/GrapheBarresH";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, fmtNombre, fmtVal, GrapheMultiPays } from "../partage";

const PAYS = "Sénégal";

type LigneCnuced = { pays: string; annee: number; direction: string; indicateur: string; valeur: number | null };
type Rang = { nom: string; nb: number; capex_musd: number | null; emplois: number | null };
type Projet = {
  id: number; periode: string; annee: number; entreprise: string | null;
  partenaire: string | null; secteur: string | null; sous_secteur: string | null;
  activite: string | null; type_projet: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null; description: string | null;
};
type Fdi = {
  kpis: { projets: number; capex_musd: number | null; emplois: number | null;
          capex_moyen: number | null; entreprises: number; partenaires: number;
          part_estimee: number | null; annees: [number | null, number | null] };
  par_annee: { annee: number; nb: number; capex_musd: number | null; emplois: number | null }[];
  tops: Record<"partenaires" | "secteurs" | "activites" | "entreprises" | "types", Rang[]>;
  projets: Projet[];
};

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

function ChiffreCle({ label, valeur, note, annee }: {
  label: string; valeur: string; note?: string | null; annee?: string | null;
}) {
  return (
    <div style={{ background: "var(--carte)", borderRadius: 14, padding: "15px 16px",
      border: "1px solid rgb(var(--encre-rgb) / 0.12)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" as const }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)",
          textTransform: "uppercase" as const, lineHeight: 1.4 }}>{label}</p>
        {annee && (
          <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)",
            padding: "1px 7px", borderRadius: 4, lineHeight: 1.5, fontVariantNumeric: "tabular-nums" }}>{annee}</span>
        )}
      </div>
      <p style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1 }}>{valeur}</p>
      <div style={{ marginTop: 6, minHeight: 13 }}>
        {note && <p style={{ fontSize: 10.5, color: "var(--gris)", lineHeight: 1.3 }}>{note}</p>}
      </div>
    </div>
  );
}

function TitreSection({ n, titre, sous }: { n: string; titre: string; sous: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
      <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: "var(--bleu-voile)",
        color: "var(--bleu)", fontSize: 12.5, fontWeight: 800, display: "flex",
        alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.2 }}>{titre}</h2>
        <p style={{ fontSize: 12.5, color: "var(--gris)", marginTop: 4, lineHeight: 1.6, maxWidth: 760 }}>{sous}</p>
      </div>
    </div>
  );
}

/** La lecture, en toutes lettres. Le fond bleu très pâle la distingue des
    chiffres : c'est une interprétation, pas une mesure. */
function ARetenir({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bleu-voile)", border: "1px solid rgb(var(--bleu-rgb) / 0.22)",
      borderRadius: 12, padding: "14px 17px", marginTop: 16 }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const,
        color: "var(--bleu)", marginBottom: 7 }}>À retenir</p>
      <p style={{ fontSize: 13, color: "var(--texte)", lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}

function Carte({ titre, tag, children }: { titre: string; tag?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--carte)", borderRadius: 14,
      border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.14em",
        textTransform: "uppercase" as const, marginBottom: 14, display: "flex",
        alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
        {titre}
        {tag && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)",
          padding: "2px 8px", borderRadius: 5, textTransform: "none" as const,
          letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>{tag}</span>}
      </p>
      {children}
    </div>
  );
}

export default function RapportIde() {
  const d3Pret = useD3Pret();
  const qCnuced = useDonnees<LigneCnuced[]>(
    `${API}/ide/cnuced?pays_list=${encodeURIComponent(PAYS)}&annee_min=1990&annee_max=2025`, { garder: true });
  const qFdi = useDonnees<Fdi>(
    `${API}/fdi/public/projets?pays=${encodeURIComponent(PAYS)}`, { garder: true });

  const cnuced = useMemo(() => (qCnuced.data ?? []) as LigneCnuced[], [qCnuced.data]);
  const fdi = qFdi.data;

  /** Dernier point non nul d'une série, et le point de l'année précédente. */
  const serie = useMemo(() => (direction: string, indicateur: string) => {
    const pts = cnuced
      .filter(l => l.direction === direction && l.indicateur === indicateur && l.valeur !== null)
      .sort((a, b) => a.annee - b.annee);
    const last = pts[pts.length - 1] ?? null;
    const prev = last ? pts.find(p => p.annee === last.annee - 1) ?? null : null;
    return { pts, last, prev };
  }, [cnuced]);

  const fluxEnt = serie("entrant", "flux");
  const fluxSort = serie("sortant", "flux");
  const stockEnt = serie("entrant", "stock");
  const stockSort = serie("sortant", "stock");

  const delta = (s: { last: LigneCnuced | null; prev: LigneCnuced | null }) =>
    s.last?.valeur != null && s.prev?.valeur ? ((s.last.valeur - s.prev.valeur) / Math.abs(s.prev.valeur)) * 100 : null;

  const pctFr = (v: number | null) => v == null ? "—"
    : `${v > 0 ? "+" : "−"} ${Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

  // Les cinq années les plus riches en annonces : c'est là que se lisent les
  // décisions dont les flux CNUCED portent la trace des années plus tard.
  const anneesFortes = useMemo(() => [...(fdi?.par_annee ?? [])]
    .filter(a => a.capex_musd)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 5), [fdi]);

  const plusGrands = useMemo(() => [...(fdi?.projets ?? [])]
    .filter(p => p.capex_musd != null)
    .sort((a, b) => (b.capex_musd ?? 0) - (a.capex_musd ?? 0)).slice(0, 8), [fdi]);

  const aujourdhui = new Date();
  const dateEdition = `${aujourdhui.getDate()} ${MOIS_FR[aujourdhui.getMonth()]} ${aujourdhui.getFullYear()}`;
  const periodeFdi = fdi?.kpis?.annees?.[0] != null ? `${fdi.kpis.annees[0]}–${fdi.kpis.annees[1]}` : "";

  const serieCapex = [{
    nom: "Investissement annoncé", couleur: "var(--bleu)",
    data: (fdi?.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.capex_musd })),
  }];
  const serieFlux = [{
    nom: "Flux entrants", couleur: "var(--bleu)",
    data: fluxEnt.pts.map(p => ({ annee: p.annee, valeur: p.valeur })),
  }];

  return (
    <main style={{ minHeight: "100vh", background: "var(--champ)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .rap-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .rap-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 980px) { .rap-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rap-duo { grid-template-columns: 1fr; } }
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
                <Link href="/ide" className="rap-sans-impression"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
                    color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.12)",
                    padding: "5px 12px", borderRadius: 999, textDecoration: "none" }}>
                  <ArrowLeft size={13} /> Retour aux données
                </Link>
              </div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                Investissement direct étranger — {PAYS}
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", fontWeight: 500 }}>
                Ce qui est entré, ce qui est annoncé · édité le {dateEdition}
              </p>
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => window.print()} className="rap-sans-impression"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700,
                  color: "var(--sur-bleu)", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)",
                  padding: "8px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
                <Printer size={14} /> Imprimer
              </button>
              <div className="rap-sans-impression"><NavActions onDark home flouTotal /></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 90px" }}>

        {/* ── 1. Ce qui est entré ─────────────────────────────────────────── */}
        <div className="rap-kpis" style={{ marginTop: -46, position: "relative" as const, zIndex: 2 }}>
          <ChiffreCle label="Flux entrants" valeur={fmtVal(fluxEnt.last?.valeur ?? null)}
            annee={fluxEnt.last ? String(fluxEnt.last.annee) : null}
            note={delta(fluxEnt) != null ? `${pctFr(delta(fluxEnt))} vs ${fluxEnt.prev?.annee}` : null} />
          <ChiffreCle label="Flux sortants" valeur={fmtVal(fluxSort.last?.valeur ?? null)}
            annee={fluxSort.last ? String(fluxSort.last.annee) : null}
            note={delta(fluxSort) != null ? `${pctFr(delta(fluxSort))} vs ${fluxSort.prev?.annee}` : null} />
          <ChiffreCle label="Stock entrant" valeur={fmtVal(stockEnt.last?.valeur ?? null)}
            annee={stockEnt.last ? String(stockEnt.last.annee) : null}
            note="capital étranger accumulé" />
          <ChiffreCle label="Stock sortant" valeur={fmtVal(stockSort.last?.valeur ?? null)}
            annee={stockSort.last ? String(stockSort.last.annee) : null}
            note="capital sénégalais à l'étranger" />
        </div>

        <section style={{ marginTop: 44 }} className="rap-eviter-coupure">
          <TitreSection n="01" titre="Ce qui est entré"
            sous="Mesure de la CNUCED, à partir de la balance des paiements. Le flux est l'argent effectivement entré dans l'année ; le stock, tout ce qui s'est accumulé depuis l'origine." />
          {d3Pret && serieFlux[0].data.length > 0 && (
            <Carte titre="Flux entrants d'IDE" tag={`${fluxEnt.pts[0]?.annee}–${fluxEnt.last?.annee}`}>
              <GrapheMultiPays series={serieFlux} height={250} type="line" titre="rap-flux" showDots={false} />
            </Carte>
          )}
          <ARetenir>
            {stockEnt.last?.valeur != null && fluxEnt.last?.valeur != null ? (
              <>
                Le capital étranger accumulé au {PAYS} atteint <strong>{fmtVal(stockEnt.last.valeur)}</strong>{" "}
                en {stockEnt.last.annee}, quand le flux de la même année ne pèse que{" "}
                <strong>{fmtVal(fluxEnt.last.valeur)}</strong>. Un stock se construit sur des décennies ; un
                flux se juge sur une décision, et se retourne d&apos;une année à l&apos;autre. Les deux ne
                s&apos;interprètent pas de la même façon.
              </>
            ) : "Les séries de la CNUCED n'ont pas encore été importées pour ce périmètre."}
          </ARetenir>
        </section>

        {/* ── 2. Ce qui est annoncé ───────────────────────────────────────── */}
        <section style={{ marginTop: 52 }}>
          <TitreSection n="02" titre="Ce qui est annoncé"
            sous="Relevé de fDi Markets (Financial Times), projet par projet. Une annonce n'est pas un décaissement : elle dit une décision d'investir, que les flux de la CNUCED enregistreront plus tard, ou pas." />

          {fdi && (
            <>
              <div className="rap-kpis" style={{ marginBottom: 18 }}>
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

              {d3Pret && serieCapex[0].data.length > 0 && (
                <Carte titre="Investissement annoncé par année" tag={periodeFdi}>
                  <GrapheMultiPays series={serieCapex} height={250} type="line" titre="rap-capex" showDots />
                </Carte>
              )}

              {/* d3 arrive dans un module séparé : rendre un graphe avant lui
                  lève, et une page de rapport qui casse à l'ouverture ne se
                  rattrape pas. */}
              {d3Pret && (
              <div className="rap-duo" style={{ marginTop: 16 }}>
                <Carte titre="Pays d'origine" tag="nombre de projets">
                  <GrapheBarresH data={(fdi.tops.partenaires ?? []).slice(0, 8).map(r => ({ label: r.nom, valeur: r.nb }))}
                    couleur="var(--orange)" fmt={fmtNombre} exposant={1} />
                </Carte>
                <Carte titre="Secteurs visés" tag="nombre de projets">
                  <GrapheBarresH data={(fdi.tops.secteurs ?? []).slice(0, 8).map(r => ({ label: r.nom, valeur: r.nb }))}
                    couleur="var(--bleu)" fmt={fmtNombre} exposant={1} />
                </Carte>
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
                              {p.capex_estime && <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈ </span>}
                              {fmtVal(p.capex_musd)}
                            </td>
                            <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
                              {p.emplois_estime && <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈ </span>}
                              {fmtNombre(p.emplois)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                    Un <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈</span>{" "}signale une valeur
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
            </>
          )}
        </section>

        {/* ── 3. Lire les deux ensemble ───────────────────────────────────── */}
        <section style={{ marginTop: 52 }} className="rap-eviter-coupure">
          <TitreSection n="03" titre="Lire les deux ensemble"
            sous="Les deux sources ne mesurent pas la même chose, et l'écart entre elles n'est pas une erreur." />
          <div style={{ background: "var(--carte)", borderRadius: 14,
            border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "20px 22px" }}>
            <div className="rap-duo">
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.14em",
                  textTransform: "uppercase" as const, marginBottom: 8 }}>CNUCED · ce qui est entré</p>
                <p style={{ fontSize: 12.5, color: "var(--texte)", lineHeight: 1.75 }}>
                  Une mesure macroéconomique, tirée de la balance des paiements. Elle est exhaustive et
                  comparable entre pays, mais anonyme : elle ne dit ni quelle entreprise, ni quel secteur,
                  ni quel projet. Elle arrive tard — un décaissement se compte une fois fait.
                </p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.14em",
                  textTransform: "uppercase" as const, marginBottom: 8 }}>fDi Markets · ce qui est annoncé</p>
                <p style={{ fontSize: 12.5, color: "var(--texte)", lineHeight: 1.75 }}>
                  Un relevé projet par projet, nommé et daté, qui arrive tôt — dès l&apos;annonce. En
                  contrepartie il ne garantit rien : un projet annoncé peut être différé, redimensionné ou
                  abandonné, et ses montants sont souvent estimés.
                </p>
              </div>
            </div>
            <div style={{ height: 1, background: "var(--fond)", margin: "18px 0" }} />
            <p style={{ fontSize: 13, color: "var(--texte)", lineHeight: 1.8 }}>
              L&apos;une sert à <strong>rendre compte</strong>, l&apos;autre à <strong>agir</strong> : les
              annonces désignent les entreprises à suivre, les pays à démarcher et les secteurs qui bougent,
              des mois avant que les flux n&apos;en portent la trace. Un écart entre les deux séries ne
              signale donc pas une contradiction, mais un délai — et parfois une annonce qui ne s&apos;est
              pas concrétisée, ce qui est en soi une information.
            </p>
          </div>
        </section>

        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 34, lineHeight: 1.7 }}>
          Sources : CNUCED (World Investment Report) pour les flux et stocks ; fDi Markets, Financial Times,
          pour les projets annoncés. Rapport édité le {dateEdition} à partir des données chargées sur la
          plateforme à cette date. APIX S.A — Direction de la Promotion des Investissements et des
          Exportations.
        </p>
      </div>
    </main>
  );
}

const CEL = { fontSize: 12, color: "var(--texte)", padding: "10px 10px",
  borderBottom: "1px solid var(--bordure)" } as const;
