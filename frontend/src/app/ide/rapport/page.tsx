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
import { API, CarteTableauAnnees, fmtNombre, fmtVal, GrapheMultiPays } from "../partage";

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

  const aujourdhui = new Date();
  const dateEdition = `${aujourdhui.getDate()} ${MOIS_FR[aujourdhui.getMonth()]} ${aujourdhui.getFullYear()}`;
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
              {d3Pret && serieCapex[0].data.length > 0 && (
                <Carte titre="Investissement annoncé par année" tag={periodeFdi}>
                  <GrapheMultiPays series={serieCapex} height={250} type="line" titre="rap-capex" showDots />
                </Carte>
              )}

              {/* Les DÉNOMBREMENTS en tableau annuel, comme sur la page : une
                  barre par année n'ajoute rien à un nombre, et le tableau donne
                  en plus l'écart à l'année précédente. */}
              <div className="rap-duo" style={{ marginTop: 16 }}>
                <CarteTableauAnnees titre="Projets annoncés"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <CarteTableauAnnees titre="Emplois annoncés" accent="var(--violet)"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.emplois }))} />
              </div>

              {/* Les quatre classements de la page, dans le même ordre : d'où
                  vient l'argent, dans quoi il va, ce que l'entreprise vient
                  faire, et qui bouge le plus. d3 arrive dans un module séparé —
                  rendre un graphe avant lui lève, et une page de rapport qui
                  casse à l'ouverture ne se rattrape pas. */}
              {d3Pret && (
              <div className="rap-duo" style={{ marginTop: 16 }}>
                {([
                  { cle: "partenaires" as const, titre: "Origine des projets", couleur: "var(--orange)" },
                  { cle: "secteurs" as const, titre: "Secteurs les plus visés", couleur: "var(--bleu)" },
                  { cle: "activites" as const, titre: "Nature des implantations", couleur: "var(--vert)" },
                  { cle: "entreprises" as const, titre: "Entreprises les plus actives", couleur: "var(--violet)" },
                ]).map(c => {
                  const rows = (fdi.tops[c.cle] ?? []).slice(0, 8).map(r => ({ label: r.nom, valeur: r.nb }));
                  if (rows.length === 0) return null;
                  return (
                    <Carte key={c.cle} titre={c.titre} tag="nombre de projets">
                      <GrapheBarresH data={rows} couleur={c.couleur} fmt={fmtNombre} exposant={1} />
                    </Carte>
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

const CEL = { fontSize: 12, color: "var(--texte)", padding: "10px 10px",
  borderBottom: "1px solid var(--bordure)" } as const;
