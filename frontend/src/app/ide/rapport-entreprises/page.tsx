"use client";

// Rapport sur les investisseurs — la page qu'on imprime et qu'on pose sur une
// table avant un comité de prospection.
//
// CE QU'IL DIT, ET QUE LE RAPPORT DES PROJETS NE DIT PAS. Les deux lisent le
// même relevé, mais pas la même unité : là-bas un PROJET, ici un INVESTISSEUR.
// La différence n'est pas de présentation, elle change les réponses.
// « Quarante-six pays d'origine » se lit pareil des deux côtés ; « les dix
// premiers investisseurs portent 4 % des projets » n'a de sens que lorsque la
// ligne est une entreprise — et c'est ce chiffre-là qui dit s'il faut démarcher
// quelques grands groupes ou ratisser large.
//
// TROIS QUESTIONS, DANS CET ORDRE :
//
//   1. QUI SONT-ILS ? Combien, d'où, à quelle échelle, depuis quand.
//   2. COMMENT SE RÉPARTISSENT-ILS ? Concentration, empreinte géographique,
//      renouvellement — ce qui dit quelle STRATÉGIE de démarchage a du sens.
//   3. QUE FAIT-ON DEMAIN ? Les listes nommées : qui est déjà ici, et surtout
//      qui ne l'est pas encore.
//
// Les deux partis pris des autres rapports valent ici aussi : aucun chiffre
// sans sa période, et la lecture de l'encadré final est CALCULÉE, jamais
// rédigée d'avance.

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useDonnees } from "@/lib/donnees";
import { API, ARetenir, CarteRapport as Carte, CarteTableauAnnees, CEL, ChiffreCle,
         ClassementRapport, dateDuJour, fmtNombre } from "../partage";

/** Le périmètre du relevé. Il qualifie le document comme « Sénégal » qualifie
    celui des projets annoncés : ce rapport porte sur les investisseurs
    présents EN AFRIQUE, quel que soit le pays qu'ils y ont choisi. */
const PERIMETRE = "Afrique";
const PAYS = "Sénégal";

type Invest = {
  nom: string; origine: string | null; iso: string | null;
  projets: number; pays: number; a0: number | null; a1: number | null;
  au_senegal?: boolean;
};
type Rapport = {
  kpis: {
    investisseurs: number; projets: number; origines: number;
    projets_par_investisseur: number | null;
    annees: [number | null, number | null];
    au_senegal: number; un_seul_projet: number; un_seul_pays: number;
  };
  concentration: Record<string, { projets: number; part: number | null }>;
  empreinte: { tranche: string; investisseurs: number; projets: number }[];
  actifs: Invest[];
  absents_senegal: Invest[];
  presents_senegal: Invest[];
  origines: { nom: string; iso: string | null; investisseurs: number;
              projets: number; au_senegal: number }[];
  secteurs: { nom: string; projets: number; investisseurs: number }[];
  activites: { nom: string; projets: number; investisseurs: number }[];
  nouveaux: { annee: number; investisseurs: number }[];
};

/** Une part, écrite comme on la lit à voix haute. */
const pct = (n: number, total: number) =>
  total > 0 ? `${(n / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—";

export default function RapportEntreprises() {
  // Le rapport porte sur ce que le lecteur regardait — ses facettes comprises —
  // et le lien de retour le ramène EXACTEMENT à son écran. C'est l'onglet qui
  // écrit cet état dans son URL ; on ne fait que le transporter.
  const [retour, setRetour] = useState("?section=projetes&vue=entreprises");
  const [filtres, setFiltres] = useState("");
  useEffect(() => {
    const brut = new URLSearchParams(window.location.search).get("retour");
    if (!brut) return;
    setRetour(brut.startsWith("?") ? brut : `?${brut}`);
    // SEULES LES FACETTES DE LA VUE ENTREPRISES SONT TRANSMISES. L'URL de
    // l'onglet porte aussi son état d'affichage — la vue ouverte, le pays
    // épinglé — qui ne veut rien dire pour le service et ferait un filtre
    // fantôme s'il le recevait.
    const p = new URLSearchParams(brut);
    const g = new URLSearchParams();
    for (const c of ["secteurs", "sous_secteurs", "activites", "origines", "recherche"]) {
      const v = p.get(c);
      if (v) g.set(c, v);
    }
    setFiltres(g.toString());
  }, []);

  const q = useDonnees<Rapport>(
    `${API}/fdi/public/entreprises/rapport${filtres ? `?${filtres}` : ""}`, { garder: true });
  const d = q.data;

  const dateEdition = dateDuJour();
  const periode = d?.kpis?.annees?.[0] != null
    ? `${d.kpis.annees[0]} — ${d.kpis.annees[1]}` : "";

  // La tranche d'empreinte la plus peuplée, pour la phrase finale.
  const tranchePrincipale = useMemo(() => {
    if (!d?.empreinte?.length) return null;
    return [...d.empreinte].sort((a, b) => b.investisseurs - a.investisseurs)[0];
  }, [d]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--champ)", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        .rap-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        .rap-duo  { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 980px) { .rap-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .rap-duo { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .rap-kpis { grid-template-columns: 1fr; } }
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
                Investisseurs — {PERIMETRE}
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
        {d && (
          <>
            {/* ── 1. QUI SONT-ILS ────────────────────────────────────────────
                LES QUATRE COMPTEURS COMPTENT DES ENTREPRISES, pas des projets —
                sauf le deuxième, qui donne le volume qu'elles portent. Le
                troisième est le rapport des deux : il dit si un investisseur
                revient ou s'il passe une fois. */}
            <div className="rap-kpis" style={{ marginTop: -46, position: "relative" as const, zIndex: 2 }}>
              <ChiffreCle label="Investisseurs" valeur={fmtNombre(d.kpis.investisseurs)} annee={periode}
                note={`${fmtNombre(d.kpis.origines)} pays d'origine`} />
              <ChiffreCle label="Projets annoncés" valeur={fmtNombre(d.kpis.projets)} annee={periode}
                note="portés par ces investisseurs" />
              <ChiffreCle label="Projets par investisseur"
                valeur={d.kpis.projets_par_investisseur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) ?? "—"}
                annee={periode}
                note={`${pct(d.kpis.un_seul_projet, d.kpis.investisseurs)} n'en ont annoncé qu'un`} />
              <ChiffreCle label={`Déjà au ${PAYS}`} valeur={fmtNombre(d.kpis.au_senegal)} annee={periode}
                note={`soit ${pct(d.kpis.au_senegal, d.kpis.investisseurs)} des investisseurs du relevé`} />
            </div>

            {/* ── 2. COMMENT SE RÉPARTISSENT-ILS ─────────────────────────────── */}
            <div className="rap-duo" style={{ marginTop: 44 }}>
              {/* LA QUESTION STRATÉGIQUE DU DOCUMENT. Si les dix premiers
                  investisseurs portaient la moitié des projets, on démarcherait
                  dix entreprises. Le tableau dit ce qu'il en est vraiment, et
                  la dernière ligne — tout le reste — est celle qui décide. */}
              <Carte titre="Concentration des annonces" tag={periode}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                  <thead>
                    <tr>
                      {["Investisseurs", "Projets portés", "Part du total"].map((t, i) => (
                        <th key={t} style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                          letterSpacing: "0.1em", textTransform: "uppercase" as const,
                          textAlign: i === 0 ? "left" as const : "right" as const, padding: "8px 10px",
                          borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" as const }}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["10", "50", "100"].map(p => {
                      const c = d.concentration[p];
                      if (!c) return null;
                      return (
                        <tr key={p}>
                          <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>Les {p} premiers</td>
                          <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(c.projets)}</td>
                          <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 800, color: "var(--bleu)", fontVariantNumeric: "tabular-nums" }}>
                            {c.part != null ? `${c.part.toLocaleString("fr-FR")} %` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const c = d.concentration["100"];
                      if (!c) return null;
                      const reste = d.kpis.projets - c.projets;
                      return (
                        <tr>
                          <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>
                            Les {fmtNombre(Math.max(0, d.kpis.investisseurs - 100))} autres
                          </td>
                          <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(reste)}</td>
                          <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 800, color: "var(--bleu)", fontVariantNumeric: "tabular-nums" }}>
                            {pct(reste, d.kpis.projets)}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
                <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                  Plus la part des premiers est faible, moins une liste courte suffit :
                  le volume vient alors du nombre d&apos;investisseurs, non de quelques habitués.
                </p>
              </Carte>

              {/* COMBIEN DE PAYS CHACUN A-T-IL TOUCHÉS. Un investisseur présent
                  dans un seul pays africain est un prospect d'EXTENSION — il a
                  franchi le pas du continent, il lui reste à choisir le suivant.
                  Un panafricain à vingt pays se démarche autrement. Les deux
                  populations ne se comptent nulle part ailleurs. */}
              <Carte titre="Empreinte africaine des investisseurs" tag={periode}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                  <thead>
                    <tr>
                      {["Pays d'implantation", "Investisseurs", "Part", "Projets"].map((t, i) => (
                        <th key={t} style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                          letterSpacing: "0.1em", textTransform: "uppercase" as const,
                          textAlign: i === 0 ? "left" as const : "right" as const, padding: "8px 10px",
                          borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" as const }}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.empreinte.map(e => (
                      <tr key={e.tranche}>
                        <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>
                          {e.tranche === "1" ? "Un seul pays" : `${e.tranche} pays`}
                        </td>
                        <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(e.investisseurs)}</td>
                        <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 800, color: "var(--bleu)", fontVariantNumeric: "tabular-nums" }}>
                          {pct(e.investisseurs, d.kpis.investisseurs)}
                        </td>
                        <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(e.projets)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
                  Un investisseur d&apos;un seul pays a déjà franchi le pas du continent :
                  il lui reste à choisir le suivant.
                </p>
              </Carte>
            </div>

            {/* ── Les classements, deux par deux ──────────────────────────────
                LES ORIGINES SE COMPTENT EN INVESTISSEURS, non en projets : la
                question est « combien d'entreprises françaises investissent en
                Afrique », pas « combien de projets français ». Secteurs et
                activités portent les deux comptes, et c'est leur RAPPORT qui
                informe — un secteur à 2 251 projets pour 626 investisseurs est
                tenu par des habitués qui reviennent ; le même volume réparti sur
                2 000 entreprises serait un marché ouvert. */}
            <div className="rap-duo" style={{ marginTop: 16 }}>
              <ClassementRapport titre="Pays d'origine des investisseurs" colonne="Pays"
                libelleValeur="Invest." drapeaux max={10} accent="var(--bleu)"
                rows={(d.origines ?? []).map(o => ({ nom: o.nom, nb: o.investisseurs, iso: o.iso }))} />
              <ClassementRapport titre="Secteurs les plus investis" colonne="Secteur"
                libelleValeur="Invest." max={10} accent="var(--violet)"
                rows={(d.secteurs ?? []).map(s => ({ nom: s.nom, nb: s.investisseurs }))} />
            </div>
            <div className="rap-duo" style={{ marginTop: 16 }}>
              <ClassementRapport titre="Activités menées" colonne="Activité"
                libelleValeur="Invest." max={10} accent="var(--vert)"
                rows={(d.activites ?? []).map(a => ({ nom: a.nom, nb: a.investisseurs }))} />
              {/* LE RENOUVELLEMENT. Chaque investisseur est compté à l'année de
                  son PREMIER projet du périmètre : un relevé qui n'accueillerait
                  plus de noms neufs serait un marché fermé. */}
              <CarteTableauAnnees titre="Nouveaux investisseurs par année" accent="var(--orange)"
                libelleValeur="Nouv."
                rows={(d.nouveaux ?? []).map(n => ({ annee: n.annee, valeur: n.investisseurs }))} />
            </div>

            {/* ── 3. QUE FAIT-ON DEMAIN ─────────────────────────────────────── */}
            <TableauInvestisseurs titre={`Cibles de prospection — absents du ${PAYS}`}
              aide={`Des groupes qui investissent en Afrique, à répétition, et dont aucun projet annoncé ne cite le ${PAYS}. C'est une liste de démarchage, pas un palmarès.`}
              lignes={d.absents_senegal} periode={periode} />

            <TableauInvestisseurs titre={`Déjà présents au ${PAYS}`}
              aide={`Les investisseurs dont au moins un projet annoncé cite le ${PAYS}. Ceux-là se fidélisent plutôt qu'ils ne se démarchent : une extension coûte moins cher à obtenir qu'une première implantation.`}
              lignes={d.presents_senegal} periode={periode} />

            <TableauInvestisseurs titre="Les plus actifs du relevé"
              aide="Tous périmètres confondus, ceux qui ont annoncé le plus de projets en Afrique — qu'ils soient venus ici ou non."
              lignes={d.actifs} periode={periode} colonneSenegal />

            <ARetenir>
              {d.kpis.investisseurs > 0 ? (
                <>
                  Sur {periode}, <strong>{fmtNombre(d.kpis.investisseurs)} investisseurs</strong> venus de{" "}
                  <strong>{d.kpis.origines} pays</strong> ont annoncé{" "}
                  <strong>{fmtNombre(d.kpis.projets)} projets</strong> en {PERIMETRE}, soit{" "}
                  <strong>{d.kpis.projets_par_investisseur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</strong>{" "}
                  projets par investisseur.
                  {d.concentration["10"]?.part != null && (
                    <> Le relevé est <strong>peu concentré</strong> : les dix premiers n&apos;en portent que{" "}
                      <strong>{d.concentration["10"].part.toLocaleString("fr-FR")} %</strong>
                      {d.concentration["100"]?.part != null && (
                        <>, et les cent premiers <strong>{d.concentration["100"].part.toLocaleString("fr-FR")} %</strong></>
                      )} — aucune liste courte ne couvre ce marché.</>
                  )}
                  {tranchePrincipale && (
                    <> <strong>{pct(tranchePrincipale.investisseurs, d.kpis.investisseurs)}</strong>{" "}
                      d&apos;entre eux n&apos;ont investi que dans{" "}
                      {tranchePrincipale.tranche === "1" ? "un seul pays africain" : `${tranchePrincipale.tranche} pays africains`}.</>
                  )}
                  {" "}Enfin, <strong>{fmtNombre(d.kpis.au_senegal)}</strong> ont déjà annoncé un projet au {PAYS} —{" "}
                  <strong>{pct(d.kpis.au_senegal, d.kpis.investisseurs)}</strong> du relevé : les{" "}
                  <strong>{fmtNombre(d.kpis.investisseurs - d.kpis.au_senegal)}</strong>{" "}autres n&apos;y sont jamais venus.
                </>
              ) : "Aucun investisseur ne correspond à ce périmètre."}
            </ARetenir>
          </>
        )}
      </div>
    </main>
  );
}

/** Une liste nommée d'investisseurs — le cœur actionnable du document.
 *
 *  POURQUOI UN TABLEAU ET NON UN CLASSEMENT EN BARRES. Ces listes ne se lisent
 *  pas par rang : on y cherche des NOMS à démarcher, et chaque ligne doit dire
 *  d'où vient le groupe, combien il a annoncé, sur combien de pays et depuis
 *  quand. Cinq colonnes qu'aucune barre ne porte. */
function TableauInvestisseurs({ titre, aide, lignes, periode, colonneSenegal }: {
  titre: string; aide: string; lignes: Invest[]; periode: string; colonneSenegal?: boolean;
}) {
  if (!lignes?.length) return null;
  const colonnes = ["Investisseur", "Origine", "Projets", "Pays", "Période",
    ...(colonneSenegal ? ["Sénégal"] : [])];
  return (
    <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
      <Carte titre={titre} tag={periode}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                {colonnes.map((t, i) => (
                  <th key={t} style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                    letterSpacing: "0.1em", textTransform: "uppercase" as const,
                    textAlign: i >= 2 ? "right" as const : "left" as const, padding: "8px 10px",
                    borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" as const }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={`${l.nom}-${l.origine ?? ""}-${i}`}>
                  <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={l.nom}>{l.nom}</td>
                  <td style={CEL}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <DrapeauPays iso={l.iso} nom={l.origine ?? "—"} taille={14} sansIso="rien" />
                      {l.origine ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 800, color: "var(--bleu)", fontVariantNumeric: "tabular-nums" }}>{fmtNombre(l.projets)}</td>
                  <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(l.pays)}</td>
                  <td style={{ ...CEL, textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>
                    {l.a0 === l.a1 ? l.a0 : `${l.a0} — ${l.a1}`}
                  </td>
                  {colonneSenegal && (
                    <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 700,
                      color: l.au_senegal ? "var(--vert)" : "var(--gris)" }}>
                      {l.au_senegal ? "Oui" : "Non"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>{aide}</p>
      </Carte>
    </div>
  );
}
