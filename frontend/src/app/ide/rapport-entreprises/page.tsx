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

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import NavActions from "@/components/layout/NavActions";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useDonnees } from "@/lib/donnees";
import { API, ARetenir, BoutonSuite, CarteRapport as Carte, CEL, ChiffreCle,
         dateDuJour, ENT_RAP, EnteteTri, FENETRE_RAPPORT,
         fmtNombre, fmtVal, PastilleRang } from "../partage";

/** Le périmètre du relevé. Il qualifie le document comme « Sénégal » qualifie
    celui des projets annoncés : ce rapport porte sur les investisseurs
    présents EN AFRIQUE, quel que soit le pays qu'ils y ont choisi. */
const PERIMETRE = "Afrique";
const PAYS = "Sénégal";

type Invest = {
  nom: string; origine: string | null; iso: string | null;
  projets: number; capex: number | null; pays: number;
  a0: number | null; a1: number | null;
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
              projets: number; capex: number | null; au_senegal: number }[];
  secteurs: { nom: string; projets: number; investisseurs: number;
              capex: number | null }[];
  sous_secteurs: { nom: string; parent: string; projets: number;
                   investisseurs: number; capex: number | null }[];
  activites: { nom: string; projets: number; investisseurs: number;
               capex: number | null }[];
  // Le montant est celui des SEULS projets sénégalais, comme le compte : la
  // somme africaine d'un groupe n'a rien à faire dans un classement qui demande
  // ce qu'il a engagé ici.
  senegal: { nom: string; origine: string | null; iso: string | null;
             projets: number; capex: number | null }[];
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
    // LES CLEFS DE L'ONGLET SONT PRÉFIXÉES « e_ », celles du service ne le sont
    // pas : la vue Entreprises partage son adresse avec les vues Projets et
    // Signaux, où « secteurs » et « activites » voudraient dire autre chose. On
    // traduit donc ici, une clef pour une.
    const p = new URLSearchParams(brut);
    const g = new URLSearchParams();
    for (const [source, cible] of [
      ["e_ori", "origines"], ["e_dest", "destinations"],
      ["e_sec", "secteurs"], ["e_act", "activites"],
      ["e_q", "recherche"],
    ]) {
      const v = p.get(source);
      if (v) g.set(cible, v);
    }
    // LE SOUS-SECTEUR VOYAGE ACCOMPAGNÉ DE SON SECTEUR — « Secteur::Sous » —
    // parce que deux secteurs peuvent porter un sous-secteur de même nom. Le
    // service, lui, n'attend que le nom : un secteur où l'on est descendu ne
    // part donc pas en entier, sinon le OU de la requête le ramènerait tout.
    const sous = (p.get("e_ssec") ?? "").split("|").filter(Boolean)
      .map(v => v.split("::")).filter(([a, b]) => a && b);
    if (sous.length) {
      g.set("sous_secteurs", sous.map(([, nom]) => nom).join("|"));
      const precises = new Set(sous.map(([secteur]) => secteur));
      const entiers = (p.get("e_sec") ?? "").split("|")
        .filter(s => s && !precises.has(s));
      if (entiers.length) g.set("secteurs", entiers.join("|")); else g.delete("secteurs");
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
        .rap-trio { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1080px) { .rap-trio { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 720px) { .rap-trio { grid-template-columns: 1fr; } }
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
                note={`${pct(d.kpis.un_seul_projet, d.kpis.investisseurs)} n'ont annoncé qu'un seul projet`} />
              <ChiffreCle label="Projets annoncés" valeur={fmtNombre(d.kpis.projets)} annee={periode}
                note={d.kpis.projets_par_investisseur != null
                  ? `${d.kpis.projets_par_investisseur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} par investisseur`
                  : null} />
              <ChiffreCle label="Pays d'origine" valeur={fmtNombre(d.kpis.origines)} annee={periode}
                note={d.origines?.[0]
                  ? `${d.origines[0].nom} en tête, ${fmtNombre(d.origines[0].investisseurs)} investisseurs`
                  : null} />
              {/* LA PART, ET NON LE NOMBRE. « 200 » ne dit rien sans son
                  dénominateur : c'est 200 sur 7 245, et c'est la fraction —
                  2,8 % — qui porte le constat. Le nombre passe en note, où il
                  sert de vérification plutôt que de titre. */}
              <ChiffreCle label={`Part du ${PAYS}`}
                valeur={pct(d.kpis.au_senegal, d.kpis.investisseurs)} annee={periode}
                note={`${fmtNombre(d.kpis.au_senegal)} investisseurs sur ${fmtNombre(d.kpis.investisseurs)}`} />
            </div>

            {/* ── Les classements, sur trois colonnes ─────────────────────────
                ILS SE COMPTENT EN INVESTISSEURS, non en projets : la question
                est « combien d'entreprises françaises investissent en Afrique »,
                pas « combien de projets français ». C'est ce qui les distingue
                des classements du rapport des projets annoncés, qui portent les
                mêmes intitulés et comptent autre chose.

                DEUX EN HAUT, LE SOUS-SECTEUR SUR TOUTE LA LARGEUR EN DESSOUS.

                « SECTEURS LES PLUS INVESTIS » EST RETIRÉ, et le sous-secteur le
                remplace avantageusement : il dit la même chose en plus fin, et
                il porte son secteur dans sa seconde colonne — « Services
                financiers » s'y lit deux fois, « Logiciels et services
                informatiques » aussi. Le classement des secteurs seuls était
                donc contenu dans celui-ci, en moins précis. */}
            {/* PLEINE LARGEUR, ET NON PLUS CÔTE À CÔTE. Deux tableaux de cinq
                colonnes dans une demi-page se seraient lus à l'horizontale, au
                défilement ; ils s'empilent, comme les tableaux du rapport des
                projets. */}
            <div style={{ marginTop: 44 }}>
              <TableauAgrege titre="Pays d'origine des investisseurs" colonne="Pays" drapeaux
                colonneInvestisseurs periode={periode}
                lignes={(d.origines ?? []).map(o => ({ nom: o.nom, iso: o.iso,
                  capex: o.capex, projets: o.projets, investisseurs: o.investisseurs }))} />
            </div>
            <TableauAgrege titre="Classement des Activités menées" colonne="Activité"
              periode={periode}
              lignes={(d.activites ?? []).map(a => ({ nom: a.nom, capex: a.capex,
                projets: a.projets }))} />

            {/* ── LE SOUS-SECTEUR, SUR TOUTE LA LARGEUR ET EN DEUX COLONNES ───
                IL NE SE LIT PAS SEUL. « Other » vit sous vingt-quatre secteurs
                chez fDi, et d'autres libellés sous plusieurs : sans le parent,
                deux postes sans rapport porteraient le même nom et l'on ne
                saurait pas lequel on lit. Le compte lui-même porte sur le
                COUPLE (sous-secteur, secteur), pas sur le seul libellé.

                MAIS LES DEUX NE SE COLLENT PAS. Écrits à la suite, ils font une
                phrase où l'œil doit retrouver la coupure à chaque ligne, et la
                colonne se tronque au plus long des deux. Séparés, ils
                s'alignent : on lit les sous-secteurs d'un côté, leurs secteurs
                de l'autre, et les répétitions du second — trois lignes sous
                « Services financiers » — sautent aux yeux. C'est ce qui vaut la
                pleine largeur à cette carte. */}
            {/* LE SECTEUR AU-DESSUS DE SON SOUS-SECTEUR, et les deux : le
                total d'un secteur ne s'additionne pas de tête à partir des
                sous-secteurs visibles, puisque les plus petits restent sous la
                ligne de flottaison. « Énergies renouvelables » pèse ce qu'il
                pèse, quel que soit le nombre de ses lignes affichées en
                dessous. */}
            <TableauAgrege titre="Secteurs les plus investis" colonne="Secteur"
              periode={periode}
              lignes={(d.secteurs ?? []).map(x => ({ nom: x.nom, capex: x.capex,
                projets: x.projets }))} />
            <TableauAgrege titre="Sous-secteurs les plus investis"
              colonne="Sous-secteur" colonneDetail="Secteur" periode={periode}
              lignes={(d.sous_secteurs ?? []).map(x => ({ nom: x.nom, detail: x.parent,
                capex: x.capex, projets: x.projets }))} />

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
              periode={periode} colonnes={["Maison mère", "Origine"]} />

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

/** Une ligne de classement agrégé — un pays d'origine, un sous-secteur, une
    activité. Les trois comptent les mêmes choses, dans des colonnes qui ne
    valent pas toutes pour les trois. */
type LigneAgregee = {
  nom: string; detail?: string | null; iso?: string | null;
  capex: number | null; projets: number; investisseurs?: number;
};

/** UN CLASSEMENT AGRÉGÉ EN TABLEAU, trié par le lecteur.

    TROIS CARTES DU DOCUMENT L'EMPLOIENT — pays d'origine, activités menées,
    sous-secteurs. Elles étaient des listes à barres, qui ne portent qu'UN
    nombre : on y lisait le nombre d'investisseurs, et rien de ce qu'ils
    engagent. Or un sous-secteur à trois cents projets menés par des
    entreprises qui investissent peu ne dit pas la même chose qu'un
    sous-secteur à dix projets pesant des milliards.

    IL S'OUVRE SUR LE MONTANT INVESTI, décroissant, et le service borne la
    liste sur ce même critère : retrier à l'écran ne fait donc disparaître
    aucune ligne du classement qu'on croyait lire. */
function TableauAgrege({ titre, colonne, colonneDetail, lignes, periode, drapeaux = false,
                         colonneInvestisseurs = false }: {
  titre: string; colonne: string; colonneDetail?: string;
  lignes: LigneAgregee[]; periode: string; drapeaux?: boolean;
  colonneInvestisseurs?: boolean;
}) {
  const colonnes = useMemo(() => [
    { cle: "capex" as const, libelle: "Montant investi*" },
    ...(colonneInvestisseurs ? [{ cle: "investisseurs" as const, libelle: "Investisseurs" }] : []),
    { cle: "projets" as const, libelle: "Projets" },
  ], [colonneInvestisseurs]);
  type Cle = (typeof colonnes)[number]["cle"];

  const [triCol, setTriCol] = useState<Cle>("capex");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [tout, setTout] = useState(false);

  const trierPar = (c: Cle) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const rangees = useMemo(() => {
    const l = [...(lignes ?? [])];
    // Une ligne dont la source ne dit pas le montant n'engage pas zéro : on ne
    // sait pas, et elle reste en queue dans les deux sens.
    l.sort((a, b) => {
      const x = a[triCol] ?? null, y = b[triCol] ?? null;
      if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
      if (x == null) return 1;
      if (y == null) return -1;
      if (x !== y) return triSens === "desc" ? y - x : x - y;
      return a.nom.localeCompare(b.nom, "fr");
    });
    return l;
  }, [lignes, triCol, triSens]);

  if (!lignes?.length) return null;
  const reste = rangees.length - FENETRE_RAPPORT;

  return (
    <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
      <Carte titre={titre} tag={periode}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                <th style={{ ...ENT_RAP, textAlign: "left" as const }}>{colonne}</th>
                {colonneDetail && (
                  <th style={{ ...ENT_RAP, textAlign: "left" as const }}>{colonneDetail}</th>
                )}
                {colonnes.map(c => (
                  <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                    actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {(tout ? rangees : rangees.slice(0, FENETRE_RAPPORT)).map((l, i) => {
                const chiffre = (cle: Cle) => ({ ...CEL, textAlign: "right" as const,
                  whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const,
                  fontWeight: triCol === cle ? 800 : undefined,
                  color: triCol === cle ? "var(--bleu)" : undefined });
                return (
                  <tr key={`${l.nom}-${l.detail ?? ""}`}>
                    <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                    <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={l.nom}>
                      {/* LE DRAPEAU, pour les pays seulement : un pays se
                          reconnaît à son drapeau avant d'être lu. */}
                      {drapeaux ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <DrapeauPays iso={l.iso ?? null} nom={l.nom} taille={14} sansIso="rien" />
                          {l.nom}
                        </span>
                      ) : l.nom}
                    </td>
                    {colonneDetail && <td style={CEL}>{l.detail ?? "—"}</td>}
                    {colonnes.map(c => (
                      <td key={c.cle} style={chiffre(c.cle)}>
                        {c.cle === "capex" ? fmtVal(l.capex) : fmtNombre(l[c.cle] ?? null)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <BoutonSuite reste={reste} tout={tout} onBasculer={() => setTout(v => !v)} />
        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
          * Comprend des valeurs estimées par l&apos;algorithme du Financial Times,
          non déclarées par l&apos;entreprise.
        </p>
      </Carte>
    </div>
  );
}

/** Les deux colonnes triables d'un classement d'investisseurs. Le montant
    d'abord : c'est par lui que le tableau s'ouvre, et le nombre de projets vient
    qualifier ensuite — un groupe qui annonce souvent n'engage pas forcément
    beaucoup. */
const COLS_INVEST = [
  { cle: "capex", libelle: "Montant investi*" },
  { cle: "projets", libelle: "Projets" },
  // LE NOMBRE DE PAYS EST UNE RÉPONSE À PART ENTIÈRE : il dit si un groupe
  // essaime sur le continent ou concentre ses annonces sur un marché, et c'est
  // un profil de prospect différent à montant égal.
  { cle: "pays", libelle: "Pays" },
] as const;
type CleInvest = (typeof COLS_INVEST)[number]["cle"];

/** Une liste nommée d'investisseurs — le cœur actionnable du document.

    POURQUOI UN TABLEAU ET NON UN CLASSEMENT EN BARRES. Ces listes ne se lisent
    pas par rang : on y cherche des NOMS à démarcher, et chaque ligne doit dire
    d'où vient le groupe, ce qu'il engage, combien il a annoncé, sur combien de
    pays et depuis quand. Cinq colonnes qu'aucune barre ne porte.

    ELLES S'OUVRENT SUR LE MONTANT INVESTI, décroissant. Le nombre de projets
    menait ces classements, et il répond à une autre question : celle de la
    fréquence, non celle de l'engagement. Un groupe qui annonce vingt petites
    implantations remontait devant celui qui engage un milliard en une fois —
    or c'est le second qu'un comité veut voir en tête.

    LES DEUX COLONNES SE TRIENT, parce qu'aucune ne résume l'autre, et le
    service borne la liste sur le MONTANT : retrier ces vingt lignes par
    projets répond à « parmi les vingt qui engagent le plus, lesquels
    reviennent le plus souvent », une question. L'inverse — borner sur les
    projets puis retrier par montant — aurait fait disparaître en silence des
    investisseurs plus gros mais moins bavards. */
function TableauInvestisseurs({ titre, aide, lignes, periode, colonneSenegal, colonnes }: {
  titre: string; aide?: string; lignes: Invest[]; periode: string;
  colonneSenegal?: boolean;
  /** Les intitulés des colonnes NOMMÉES, quand le tableau ne montre que le nom
   *  et l'origine. Les colonnes chiffrées, elles, sont toujours les mêmes. */
  colonnes?: string[];
}) {
  const [triCol, setTriCol] = useState<CleInvest>("capex");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [tout, setTout] = useState(false);

  const trierPar = (c: CleInvest) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const rangees = useMemo(() => {
    const l = [...(lignes ?? [])];
    // Un investisseur dont la source ne dit pas le montant n'engage pas zéro :
    // on ne sait pas, et il reste en queue dans les deux sens.
    l.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
      if (x == null) return 1;
      if (y == null) return -1;
      if (x !== y) return triSens === "desc" ? y - x : x - y;
      return a.nom.localeCompare(b.nom, "fr");
    });
    return l;
  }, [lignes, triCol, triSens]);

  if (!lignes?.length) return null;
  const court = colonnes != null;
  const nommees = colonnes ?? ["Investisseur", "Origine"];
  const reste = rangees.length - FENETRE_RAPPORT;

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
                <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                {nommees.map(t => (
                  <th key={t} style={{ ...ENT_RAP, textAlign: "left" as const }}>{t}</th>
                ))}
                {COLS_INVEST.filter(c => !court || c.cle !== "pays").map(c => (
                  <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                    actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                ))}
                {!court && (
                  <th style={{ ...ENT_RAP, textAlign: "right" as const }}>Période</th>
                )}
                {colonneSenegal && (
                  <th style={{ ...ENT_RAP, textAlign: "right" as const }}>Présent au {PAYS}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(tout ? rangees : rangees.slice(0, FENETRE_RAPPORT)).map((l, i) => {
                // LA COLONNE QUI TRIE PORTE LA COULEUR ET LE GRAS, sans quoi
                // l'œil resterait sur une colonne qui ne commande plus rien.
                const chiffre = (cle: CleInvest) => ({ ...CEL, textAlign: "right" as const,
                  whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const,
                  fontWeight: triCol === cle ? 800 : undefined,
                  color: triCol === cle ? "var(--bleu)" : undefined });
                return (
                  <tr key={`${l.nom}-${l.origine ?? ""}-${i}`}>
                    {/* LE RANG SUIT LE TRI : il dit la place dans le classement
                        qu'on a sous les yeux. */}
                    <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                    <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={l.nom}>{l.nom}</td>
                    <td style={CEL}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <DrapeauPays iso={l.iso} nom={l.origine ?? "—"} taille={14} sansIso="rien" />
                        {l.origine ?? "—"}
                      </span>
                    </td>
                    <td style={chiffre("capex")}>{fmtVal(l.capex)}</td>
                    <td style={chiffre("projets")}>{fmtNombre(l.projets)}</td>
                    {!court && <>
                      <td style={chiffre("pays")}>{fmtNombre(l.pays)}</td>
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
                );
              })}
            </tbody>
          </table>
        </div>
        <BoutonSuite reste={reste} tout={tout} onBasculer={() => setTout(v => !v)} />
        {/* L'ASTÉRISQUE PORTE L'AVERTISSEMENT. La colonne est une SOMME : elle
            mêle des montants déclarés et des montants estimés sans qu'on puisse
            dire lesquels, et « comprend » plutôt que « sont » est la seule
            formule exacte. */}
        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
          {aide ? <>{aide}<br /></> : null}
          * Comprend des valeurs estimées par l&apos;algorithme du Financial Times,
          non déclarées par l&apos;entreprise.
        </p>
      </Carte>
    </div>
  );
}
