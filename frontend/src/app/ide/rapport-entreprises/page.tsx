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
// TROIS TEMPS :
//
//   1. QUATRE COMPTEURS. Combien d'investisseurs, d'où, à quelle cadence, et
//      combien sont déjà venus au Sénégal.
//   2. TROIS CLASSEMENTS — origines, secteurs, activités —, tous comptés en
//      INVESTISSEURS et non en projets.
//   3. LE CLASSEMENT NOMMÉ, avec une colonne qui dit pour chaque groupe s'il a
//      déjà annoncé un projet au Sénégal. Un « non » en regard d'un grand
//      nombre de projets désigne une cible de prospection.
//
// Les deux partis pris des autres rapports valent ici aussi : aucun chiffre
// sans sa période, et la lecture de l'encadré final est CALCULÉE, jamais
// rédigée d'avance.

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useDonnees } from "@/lib/donnees";
import { API, ARetenir, CarteRapport as Carte, CEL, ChiffreCle,
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
  actifs: Invest[];
  origines: { nom: string; iso: string | null; investisseurs: number;
              projets: number; au_senegal: number }[];
  secteurs: { nom: string; projets: number; investisseurs: number }[];
  sous_secteurs: { nom: string; parent: string; projets: number; investisseurs: number }[];
  activites: { nom: string; projets: number; investisseurs: number }[];
  senegal: { nom: string; origine: string | null; iso: string | null; projets: number }[];
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

            {/* ── Les classements, sur trois colonnes ─────────────────────────
                ILS SE COMPTENT EN INVESTISSEURS, non en projets : la question
                est « combien d'entreprises françaises investissent en Afrique »,
                pas « combien de projets français ». C'est ce qui les distingue
                des classements du rapport des projets annoncés, qui portent les
                mêmes intitulés et comptent autre chose.

                DEUX PAR DEUX DEPUIS QU'ILS SONT QUATRE. Sur trois colonnes, les
                libellés les plus longs — « Logiciels et services informatiques »,
                « Recherche et développement » — se coupaient à mi-mot ; la
                demi-page les laisse entiers, et le sous-secteur, qui traîne son
                secteur derrière lui, en avait plus besoin que les autres. */}
            <div className="rap-duo" style={{ marginTop: 44 }}>
              <ClassementRapport titre="Pays d'origine des investisseurs" colonne="Pays"
                libelleValeur="Invest." drapeaux max={10} accent="var(--bleu)"
                rows={(d.origines ?? []).map(o => ({ nom: o.nom, nb: o.investisseurs, iso: o.iso }))} />
              <ClassementRapport titre="Secteurs les plus investis" colonne="Secteur"
                libelleValeur="Invest." max={10} accent="var(--violet)"
                rows={(d.secteurs ?? []).map(s => ({ nom: s.nom, nb: s.investisseurs }))} />
              {/* LE SOUS-SECTEUR NE SE LIT PAS SEUL, et son secteur le suit
                  donc sur la ligne. « Other » vit sous vingt-quatre secteurs
                  chez fDi, « Software » sous plusieurs autres : sans le parent,
                  deux postes sans rapport porteraient le même nom, et l'on ne
                  saurait pas lequel on lit. Le compte lui-même est celui du
                  COUPLE, pas du seul libellé. */}
              <ClassementRapport titre="Sous-secteurs les plus investis" colonne="Sous-secteur · Secteur"
                libelleValeur="Invest." max={10} accent="var(--cyan)"
                rows={(d.sous_secteurs ?? []).map(x => ({ nom: `${x.nom} · ${x.parent}`, nb: x.investisseurs }))} />
              <ClassementRapport titre="Activités menées" colonne="Activité"
                libelleValeur="Invest." max={10} accent="var(--vert)"
                rows={(d.activites ?? []).map(a => ({ nom: a.nom, nb: a.investisseurs }))} />
            </div>

            {/* ── LE CLASSEMENT NOMMÉ ─────────────────────────────────────────
                UNE SEULE LISTE, ET UNE COLONNE QUI RÉPOND. Le document séparait
                les investisseurs déjà venus au Sénégal de ceux qui ne l'étaient
                pas, en deux tableaux : on lisait deux fois la même chose, et
                chercher un groupe précis demandait de savoir d'avance dans
                lequel il se trouvait. La colonne « Présent au Sénégal » le dit
                sur la ligne même. */}
            <TableauInvestisseurs titre="Classement des investisseurs"
              lignes={d.actifs} periode={periode} colonneSenegal />

            {/* ── LE MÊME CLASSEMENT, RAMENÉ AU SÉNÉGAL ───────────────────────
                LE COMPTE N'EST PAS CELUI DU TABLEAU PRÉCÉDENT, et c'est tout
                l'objet de celui-ci : il ne retient que les projets annoncés
                ICI. Orange en compte soixante-douze sur le continent et cinq au
                Sénégal — deux chiffres justes qui répondent à deux questions
                différentes, et qu'un seul tableau ferait confondre.

                PAR MAISON MÈRE, comme partout sur cet écran. « MicroCred
                Senegal » remonte sous MicroCred, et les trois enseignes de
                Dubai World — Dubai World, DP World, Jafza International — ne
                font qu'un investisseur de six projets au lieu de trois lignes
                de deux ou trois. C'est le groupe qu'on démarche, pas le bureau
                qui signe. */}
            <TableauInvestisseurs titre={`Classement des investisseurs au ${PAYS}`}
              lignes={(d.senegal ?? []).map(x => ({ ...x, pays: 0, a0: null, a1: null }))}
              periode={periode} colonnes={["Maison mère", "Origine", "Nb de projets"]} />

            <ARetenir>
              {d.kpis.investisseurs > 0 ? (
                <>
                  Sur {periode}, <strong>{fmtNombre(d.kpis.investisseurs)} investisseurs</strong> venus de{" "}
                  <strong>{d.kpis.origines} pays</strong> ont annoncé{" "}
                  <strong>{fmtNombre(d.kpis.projets)} projets</strong> en {PERIMETRE}, soit{" "}
                  <strong>{d.kpis.projets_par_investisseur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</strong>{" "}
                  projets par investisseur —{" "}
                  <strong>{pct(d.kpis.un_seul_projet, d.kpis.investisseurs)}</strong>{" "}
                  n&apos;en ont annoncé qu&apos;un seul.
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
function TableauInvestisseurs({ titre, aide, lignes, periode, colonneSenegal, colonnes }: {
  titre: string; aide?: string; lignes: Invest[]; periode: string;
  colonneSenegal?: boolean;
  /** Les intitulés, quand le tableau ne montre que le nom, l'origine et un
   *  nombre. Absents, ce sont les six colonnes du classement complet. */
  colonnes?: string[];
}) {
  if (!lignes?.length) return null;
  const court = colonnes != null;
  const entetes = colonnes ?? ["Investisseur", "Origine", "Projets", "Pays", "Période",
    ...(colonneSenegal ? [`Présent au ${PAYS}`] : [])];
  return (
    <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
      <Carte titre={titre} tag={periode}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                {/* LE RANG A SA COLONNE. Sans lui, « troisième du classement »
                    se comptait de l'œil, ligne à ligne — et se recomptait à
                    chaque fois qu'on revenait au tableau. */}
                <th style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris)",
                  letterSpacing: "0.1em", textTransform: "uppercase" as const,
                  textAlign: "left" as const, padding: "8px 10px", width: 34,
                  borderBottom: "1px solid var(--bordure)" }}>#</th>
                {entetes.map((t, i) => (
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
                  {/* Les trois premiers en pastille pleine, comme dans les
                      classements en liste : le podium se repère avant d'être lu. */}
                  <td style={{ ...CEL, padding: "8px 10px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
                      fontSize: 10, fontWeight: 800,
                      background: i < 3 ? "var(--bleu)" : "var(--bleu-voile)",
                      color: i < 3 ? "var(--sur-bleu)" : "var(--texte)" }}>{i + 1}</span>
                  </td>
                  <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={l.nom}>{l.nom}</td>
                  <td style={CEL}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <DrapeauPays iso={l.iso} nom={l.origine ?? "—"} taille={14} sansIso="rien" />
                      {l.origine ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...CEL, textAlign: "right" as const, fontWeight: 800, color: "var(--bleu)", fontVariantNumeric: "tabular-nums" }}>{fmtNombre(l.projets)}</td>
                  {!court && <>
                    <td style={{ ...CEL, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(l.pays)}</td>
                    <td style={{ ...CEL, textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>
                      {l.a0 === l.a1 ? l.a0 : `${l.a0} — ${l.a1}`}
                    </td>
                  </>}
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
        {aide && <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>{aide}</p>}
      </Carte>
    </div>
  );
}
