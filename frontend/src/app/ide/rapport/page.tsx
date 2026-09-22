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

import DrapeauPays from "@/components/shared/DrapeauPays";
import NavActions from "@/components/layout/NavActions";
import { useDonnees } from "@/lib/donnees";
import { useD3Pret } from "@/lib/d3lazy";
import { API, ARetenir, BoutonSuite, CarteRapport as Carte, CarteTableauAnnees, CEL,
         ChiffreCle, dateDuJour, ENT_RAP, EnteteTri, FENETRE_RAPPORT, fmtNombre, fmtVal,
         GrapheMultiPays, PastilleRang, SegmentRapport } from "../partage";

const PAYS = "Sénégal";

/** Les trois colonnes chiffrées des classements, et ce qu'on lit dans chacune.
    L'ordre de la liste EST l'ordre des colonnes : le montant d'abord, parce que
    c'est par lui que le tableau s'ouvre — un décideur demande d'abord où va
    l'argent, le nombre de projets vient qualifier ensuite. */
const COLS_CLASSEMENT = [
  { cle: "capex_musd", libelle: "Montant investi*" },
  { cle: "nb", libelle: "Projets" },
  { cle: "emplois", libelle: "Emplois créés*" },
] as const;
type CleTri = (typeof COLS_CLASSEMENT)[number]["cle"];

/** Les colonnes triables d'une ligne de PROJET. La période ferme la ligne :
    elle coupait les deux colonnes chiffrées, qui se lisent ensemble. */
const COLS_PROJET = [
  { cle: "capex_musd", libelle: "Montant" },
  { cle: "emplois", libelle: "Emplois" },
  { cle: "periode", libelle: "Période" },
] as const;
type CleProjet = (typeof COLS_PROJET)[number]["cle"];



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
  // LES PLUS GROS DU FILTRE ENTIER, et non de la page : `projets` est rangé du
  // plus récent au plus ancien et borné à trente lignes. Y chercher les plus
  // gros montants — ce que faisait cette page — rendait « les plus gros des
  // trente derniers » sous le titre « les plus gros ».
  plus_gros: Projet[];
  // Les trois zones ouest-africaines, et SEULEMENT celles dont le pays lu est
  // membre. Vide pour un pays d'ailleurs, et pour une région : voir la carte.
  zones_ouest: ZoneOuest[];
};
type LigneZone = { nom: string; iso: string | null;
                   projets: number; capex_musd: number | null; emplois: number | null };
type ZoneOuest = { code: string; nom: string; court: string; lignes: LigneZone[] };

/** Les trois colonnes triables du classement de zone. Les mêmes mesures que
    partout dans le rapport, nommées du point de vue du PAYS QUI REÇOIT : on ne
    lit plus ce qu'un investisseur engage, mais ce qu'un pays a capté. */
const COLS_ZONE = [
  { cle: "capex_musd", libelle: "Invest. reçus*" },
  { cle: "projets", libelle: "Projets" },
  { cle: "emplois", libelle: "Emplois créés*" },
] as const;
type CleZone = (typeof COLS_ZONE)[number]["cle"];

/** UN CLASSEMENT EN TABLEAU, trié par le lecteur.

    TROIS CARTES DU RAPPORT L'EMPLOIENT — pays d'origine, secteurs, activités —
    et c'est bien pour cela qu'il existe : trois copies d'un même tableau
    auraient fini par diverger d'un détail, et le lecteur l'aurait senti sans
    savoir le nommer.

    IL S'OUVRE SUR LE MONTANT, décroissant. C'est la première question d'un
    comité — où va l'argent —, et le nombre de projets, qui menait ces
    classements jusqu'ici, ne la posait pas : la France annonce 56 projets au
    Sénégal sans être celle qui y engage le plus.

    Chaque carte tient son propre tri et son propre dépliage : on compare un
    classement à un autre en les triant différemment, pas en les triant
    ensemble. */
function TableauClassement({ titre, colonne, rows, tag, drapeaux = false }: {
  titre: string; colonne: string; rows: Rang[]; tag?: string; drapeaux?: boolean;
}) {
  const [triCol, setTriCol] = useState<CleTri>("capex_musd");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [tout, setTout] = useState(false);

  // Cliquer la colonne active RETOURNE le tri ; cliquer une autre colonne s'y
  // pose en décroissant. Repartir de l'ordre croissant sur une colonne qu'on
  // vient de choisir montrerait d'abord les plus petites valeurs, ce que
  // personne ne demande d'un classement.
  const trierPar = (c: CleTri) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const lignes = useMemo(() => {
    const l = [...rows];
    // LES VALEURS MANQUANTES RESTENT EN QUEUE DANS LES DEUX SENS. Une ligne
    // dont le relevé ne dit pas le capital n'est pas « la plus petite » : on ne
    // sait pas. La remonter en tête d'un tri croissant en ferait une réponse.
    l.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
      if (x == null) return 1;
      if (y == null) return -1;
      if (x !== y) return triSens === "desc" ? y - x : x - y;
      return a.nom.localeCompare(b.nom, "fr");
    });
    return l;
  }, [rows, triCol, triSens]);

  if (!lignes.length) return null;
  const reste = lignes.length - FENETRE_RAPPORT;

  return (
    <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
      <Carte titre={titre} tag={tag}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                <th style={{ ...ENT_RAP, textAlign: "left" as const }}>{colonne}</th>
                {COLS_CLASSEMENT.map(c => (
                  <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                    actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {(tout ? lignes : lignes.slice(0, FENETRE_RAPPORT)).map((r, i) => (
                <tr key={r.nom}>
                  {/* LE RANG SUIT LE TRI : il dit la place dans le classement
                      qu'on a sous les yeux, non une place absolue qui
                      contredirait l'ordre des lignes. */}
                  <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                  <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }} title={r.nom}>
                    {/* LE DRAPEAU, pour les pays seulement : un pays se
                        reconnaît à son drapeau avant d'être lu. Il reste nul
                        quand la ligne n'a pas été rapprochée du référentiel —
                        le drapeau disparaît alors, le nom reste. */}
                    {drapeaux ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <DrapeauPays iso={r.iso ?? null} nom={r.nom} taille={15} sansIso="rien" />
                        {r.nom}
                      </span>
                    ) : r.nom}
                  </td>
                  {/* LA COLONNE QUI TRIE PORTE LA COULEUR ET LE GRAS, sans quoi
                      l'œil serait attiré par une colonne qui ne commande plus
                      rien. */}
                  {COLS_CLASSEMENT.map(c => (
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
        {/* AU-DELÀ DES DIX. Le service rend ces trois classements ENTIERS — le
            tableau se retrie, et trier dix lignes choisies sur un autre critère
            aurait fait disparaître la onzième sans que rien ne le dise. Il
            s'ouvre tout de même sur les dix premières : c'est un classement, et
            sa queue n'intéresse qu'après coup.

            LE BOUTON DES SÉRIES ANNUELLES, AU PIXEL PRÈS — d'autres cartes de
            cette même page en portent un, même pilule, même « Réduire » au
            retour. Il dit combien de lignes il reste, pour qu'on sache ce qu'on
            déplie, et ne s'imprime pas : sur papier, plus rien ne se clique. */}
        <BoutonSuite reste={reste} tout={tout} onBasculer={() => setTout(v => !v)} />
        {/* L'ASTÉRISQUE PORTE L'AVERTISSEMENT, ET UNE LIGNE SUFFIT. Ces deux
            colonnes sont des SOMMES : elles ne peuvent pas porter le « ≈ »
            ligne à ligne du tableau des projets, puisque chacune mêle des
            projets déclarés et des projets estimés sans qu'on puisse dire
            lesquels. « Comprend » et non « sont » : tout n'y est pas estimé, et
            écrire le contraire discréditerait des chiffres en partie
            déclarés. */}
        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
          * Comprend des valeurs estimées par l&apos;algorithme du Financial Times,
          non déclarées par l&apos;entreprise.
        </p>
      </Carte>
    </div>
  );
}

/** LES PLUS GROS INVESTISSEMENTS — le même tableau que les classements, mais
    ses lignes sont des PROJETS et non des agrégats.

    SA POPULATION EST DÉFINIE PAR LE MONTANT : le service rend les cinquante
    plus gros investissements du filtre, et c'est ce que la carte nomme. La
    retrier par emplois ou par date répond à « parmi les plus gros, lesquels
    emploient le plus, lesquels sont récents » — une question, non un
    classement des emplois du relevé entier.

    LA PÉRIODE FERME LA LIGNE. Elle était au milieu, entre le secteur et le
    montant, et coupait les deux colonnes qui se lisent ensemble ; elle se trie
    comme les deux autres — « AAAA-MM » se compare comme un nombre. */
function TableauPlusGros({ rows, tag }: { rows: Projet[]; tag?: string }) {
  const [triCol, setTriCol] = useState<CleProjet>("capex_musd");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");
  const [tout, setTout] = useState(false);

  const trierPar = (c: CleProjet) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const lignes = useMemo(() => {
    const l = [...rows];
    l.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      // Les valeurs manquantes en queue dans les deux sens : un projet dont on
      // ignore le nombre d'emplois n'en crée pas zéro, on ne sait pas.
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      // La période se compare comme un texte — « 2024-12 » et « 2008-01 » se
      // rangent d'eux-mêmes —, les deux autres comme des nombres.
      const d = typeof x === "string" || typeof y === "string"
        ? String(x).localeCompare(String(y))
        : (x as number) - (y as number);
      return triSens === "desc" ? -d : d;
    });
    return l;
  }, [rows, triCol, triSens]);

  if (!lignes.length) return null;
  const reste = lignes.length - FENETRE_RAPPORT;

  return (
    <div style={{ marginTop: 16 }} className="rap-eviter-coupure">
      <Carte titre="Les plus gros investissements" tag={tag}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                {["Entreprise", "Origine", "Secteur"].map(t => (
                  <th key={t} style={{ ...ENT_RAP, textAlign: "left" as const }}>{t}</th>
                ))}
                {COLS_PROJET.map(c => (
                  <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                    actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {(tout ? lignes : lignes.slice(0, FENETRE_RAPPORT)).map((p, i) => {
                const chiffre = (cle: CleProjet) => ({ ...CEL, textAlign: "right" as const,
                  whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" as const,
                  fontWeight: triCol === cle ? 800 : undefined,
                  color: triCol === cle ? "var(--vert)" : undefined });
                return (
                  <tr key={p.id}>
                    <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                    <td style={{ ...CEL, fontWeight: 600, color: "var(--encre)" }}>{p.entreprise ?? "—"}</td>
                    <td style={CEL}>{p.partenaire ?? "—"}</td>
                    <td style={CEL}>{p.secteur ?? "—"}</td>
                    {/* LE « ≈ » RESTE LIGNE À LIGNE. Ici les valeurs ne sont
                        pas des sommes : chaque montant est déclaré ou estimé,
                        et on peut donc le dire pour chacun. */}
                    <td style={chiffre("capex_musd")}>
                      {p.capex_estime && <span style={{ fontWeight: 800 }}>≈ </span>}
                      {fmtVal(p.capex_musd)}
                    </td>
                    <td style={chiffre("emplois")}>
                      {p.emplois_estime && <span style={{ fontWeight: 800 }}>≈ </span>}
                      {fmtNombre(p.emplois)}
                    </td>
                    <td style={chiffre("periode")}>{p.periode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <BoutonSuite reste={reste} tout={tout} onBasculer={() => setTout(v => !v)} />
      </Carte>
    </div>
  );
}

/** LE CLASSEMENT OUEST-AFRICAIN — où se situe le pays lu parmi les siens.

    IL N'APPARAÎT PAS TOUJOURS, et c'est voulu : la question n'a de sens que
    pour un pays qui a des « siens » ici. Le service ne rend de zones que pour
    un membre d'au moins une des trois, et seulement celles dont il est membre
    — le Ghana n'a pas d'onglet UEMOA. Un rapport sur l'Afrique du Sud, ou sur
    une région entière, n'a pas cette section du tout.

    LA ZONE EST RENDUE EN ENTIER — seize pays au plus. Le tableau se retrie
    comme les autres du rapport, et une liste coupée aux dix premiers par
    montant puis retriée par emplois aurait numéroté « premier » une ligne
    première de dix sur seize. Tout montrer supprime la question, et le pays lu
    est de toute façon à l'écran, quel que soit son rang.

    LE PAYS LU EST MIS EN ÉVIDENCE COMME AU BILAN DES SIGNAUX : fond voilé,
    filet tout autour, coins arrondis, ombre portée — la ligne se DÉTACHE au
    lieu d'être seulement teintée. Le bleu remplace l'orange de là-bas, mais le
    dessin est le même : les deux rapports posent la même question, « où se
    situe le Sénégal », et doivent y répondre de la même façon.

    LE CADRE SE DESSINE CELLULE PAR CELLULE. Un tableau à bordures fusionnées
    n'encadre pas une ligne : le filet se pose donc en haut et en bas de chaque
    cellule, à gauche de la première et à droite de la dernière, et les coins
    s'arrondissent aux deux extrémités. */
function ClassementOuest({ zones, pays, tag }: {
  zones: ZoneOuest[]; pays: string; tag?: string;
}) {
  const [i, setI] = useState(0);
  const [triCol, setTriCol] = useState<CleZone>("capex_musd");
  const [triSens, setTriSens] = useState<"asc" | "desc">("desc");

  const trierPar = (c: CleZone) => {
    if (c === triCol) setTriSens(s => (s === "desc" ? "asc" : "desc"));
    else { setTriCol(c); setTriSens("desc"); }
  };

  const z = zones?.[Math.min(i, (zones?.length ?? 1) - 1)];
  const lignes = useMemo(() => {
    const l = [...(z?.lignes ?? [])];
    l.sort((a, b) => {
      const x = a[triCol], y = b[triCol];
      if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
      if (x == null) return 1;
      if (y == null) return -1;
      if (x !== y) return triSens === "desc" ? y - x : x - y;
      return a.nom.localeCompare(b.nom, "fr");
    });
    return l;
  }, [z, triCol, triSens]);

  if (!zones?.length || !z) return null;

  return (
    <section style={{ marginTop: 44 }} className="rap-eviter-coupure">
      {/* LE TITRE ET LA BASCULE SUR UNE MÊME LIGNE, comme au bilan des
          signaux : la bascule appartient visiblement au titre — donc à la
          section — au lieu de flotter au-dessus du tableau. */}
      <div style={{ display: "flex", alignItems: "center", gap: 16,
        flexWrap: "wrap" as const, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--encre)",
          letterSpacing: "-0.015em", margin: 0 }}>
          Classement ouest-africain des projets reçus
        </h2>
        {zones.length > 1 && (
          <span className="rap-sans-impression">
            <SegmentRapport valeur={String(i)} onChange={v => setI(Number(v))}
              options={zones.map((o, k) => ({ v: String(k), l: o.court, titre: o.nom }))} />
          </span>
        )}
      </div>
      {/* À L'IMPRESSION, LA BASCULE DISPARAÎT ET LA ZONE RESTE : une feuille de
          papier ne se clique pas, et un classement sans zone nommée ne voudrait
          rien dire. */}
      <p style={{ display: "none", fontSize: 12, fontWeight: 700, color: "var(--encre)",
        marginBottom: 10 }} className="rap-zone-impression">Zone : {z.nom}</p>

      <Carte titre={z.nom} tag={tag}>
        <div style={{ overflowX: "auto" as const }}>
          {/* BORDURES SÉPARÉES, ESPACEMENT NUL. Un tableau à bordures
              fusionnées ne peut pas encadrer une seule ligne — les filets
              voisins mangent le cadre et les coins ne s'arrondissent pas. La
              séparation n'écarte rien tant que `border-spacing` reste à zéro :
              le tableau se dessine exactement comme avant, à ceci près que la
              ligne épinglée peut porter son propre cadre. */}
          <table style={{ width: "100%", borderCollapse: "separate" as const,
            borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...ENT_RAP, width: 34, textAlign: "left" as const }}>#</th>
                <th style={{ ...ENT_RAP, textAlign: "left" as const }}>Pays</th>
                {COLS_ZONE.map(c => (
                  <EnteteTri key={c.cle} libelle={c.libelle} sens={triSens}
                    actif={triCol === c.cle} onClick={() => trierPar(c.cle)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, k) => {
                const ici = l.nom === pays;
                // Le cadre de la ligne épinglée, posé cellule par cellule.
                const encadre = (place: "debut" | "milieu" | "fin"): React.CSSProperties =>
                  !ici ? {} : {
                    background: "rgb(var(--bleu-rgb) / 0.07)",
                    borderTop: "1px solid rgb(var(--bleu-rgb) / 0.30)",
                    borderBottom: "1px solid rgb(var(--bleu-rgb) / 0.30)",
                    ...(place === "debut" ? {
                      borderLeft: "1px solid rgb(var(--bleu-rgb) / 0.30)",
                      borderTopLeftRadius: 8, borderBottomLeftRadius: 8 } : {}),
                    ...(place === "fin" ? {
                      borderRight: "1px solid rgb(var(--bleu-rgb) / 0.30)",
                      borderTopRightRadius: 8, borderBottomRightRadius: 8 } : {}),
                  };
                const cel = (cle: CleZone, place: "milieu" | "fin" = "milieu") => ({
                  ...CEL, textAlign: "right" as const,
                  fontVariantNumeric: "tabular-nums" as const,
                  fontWeight: ici || triCol === cle ? 800 as const : undefined,
                  color: ici ? "var(--bleu)" : triCol === cle ? "var(--vert)" : undefined,
                  ...encadre(place) });
                return (
                  <tr key={l.nom}>
                    {/* LE RANG SUIT LE TRI, comme dans tous les tableaux du
                        rapport : il dit la place dans le classement qu'on a
                        sous les yeux. C'est parce que la zone est rendue en
                        entier qu'il reste vrai d'un tri à l'autre. */}
                    <td style={{ ...CEL, padding: "8px 10px", ...encadre("debut") }}>
                      <span style={{ display: "inline-flex", alignItems: "center",
                        justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px",
                        borderRadius: 10, fontSize: 10, fontWeight: 800,
                        background: ici || k < 3 ? "var(--bleu)" : "var(--bleu-voile)",
                        color: ici || k < 3 ? "var(--sur-bleu)" : "var(--texte)" }}>
                        {k + 1}
                      </span>
                    </td>
                    <td style={{ ...CEL, fontWeight: ici ? 800 : 600,
                      color: ici ? "var(--bleu)" : "var(--encre)", ...encadre("milieu") }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <DrapeauPays iso={l.iso} nom={l.nom} taille={15} sansIso="rien" />
                        {l.nom}
                      </span>
                    </td>
                    <td style={cel("capex_musd")}>{fmtVal(l.capex_musd)}</td>
                    <td style={cel("projets")}>{fmtNombre(l.projets)}</td>
                    <td style={cel("emplois", "fin")}>{fmtNombre(l.emplois)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--gris)", marginTop: 12, lineHeight: 1.6 }}>
          * Comprend des valeurs estimées par l&apos;algorithme du Financial Times,
          non déclarées par l&apos;entreprise.
        </p>
      </Carte>
    </section>
  );
}

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
          /* La bascule des zones disparaît à l'impression ; la zone lue prend
             sa place, sans quoi un classement sans zone nommée ne voudrait
             rien dire sur le papier. */
          .rap-zone-impression { display: block !important; }
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
              {/* ── LA COURBE D'ABORD ──────────────────────────────────────────
                  ELLE NE RÉPÈTE PAS LES TABLEAUX, ELLE EN DIT AUTRE CHOSE : la
                  courbe donne la FORME — les creux, les paliers, le pic —, les
                  tableaux donnent les VALEURS. Elle ouvre la section parce
                  qu'on regarde la forme avant de lire les nombres : le pic de
                  2019 se voit d'un coup d'œil, et les trois tableaux qui
                  suivent disent ensuite de combien.

                  SON TITRE PORTE L'ÉVOLUTION, celui du tableau la mesure —
                  « Investissements annoncés ». Deux cartes nommées à
                  l'identique dans une même page auraient fait croire à un
                  doublon. */}
              {d3Pret && serieCapex[0].data.length > 0 && (
                <div>
                  <Carte titre="Évolution des investissements annoncés par année" tag={periodeFdi}>
                    <GrapheMultiPays series={serieCapex} height={250} type="line" titre="rap-capex" showDots />
                  </Carte>
                </div>
              )}

              {/* ── PUIS LES TROIS SÉRIES ANNUELLES, CHIFFRÉES ─────────────────
                  LE CHIFFRE APRÈS LA FORME. Les quatre compteurs du haut de
                  page donnent un total par mesure, la courbe en donne le
                  profil ; la question qui vient ensuite est « combien par
                  année », et c'est un tableau qui y répond — avec, en plus, le
                  millésime précédent et l'écart, que nulle courbe ne donne à
                  lire sans qu'on la survole.

                  LES TROIS MESURES SONT CELLES DES COMPTEURS, dans le même
                  ordre : l'argent annoncé, les projets qui le portent, les
                  emplois qu'ils promettent. Chacune garde sa teinte d'un bout à
                  l'autre du rapport.

                  L'INVESTISSEMENT S'ÉCRIT EN MONTANTS, non en nombres bruts.
                  Le tableau reçoit `fmtVal` — celui des compteurs du haut — et
                  ses colonnes chiffrées s'élargissent en conséquence : « 1,2 Md
                  $ » ne tient pas dans la place d'un nombre de projets. */}
              <div className="rap-trio" style={{ marginTop: 16 }}>
                <CarteTableauAnnees titre="Investissements annoncés"
                  libelleValeur="Montant" fmt={fmtVal} largeurValeur={58} largeurEcart={62} barre={false}
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.capex_musd }))} />
                <CarteTableauAnnees titre="Projets annoncés" accent="var(--orange)"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.nb }))} />
                <CarteTableauAnnees titre="Emplois annoncés" accent="var(--vert)"
                  rows={fdi.par_annee.map(a => ({ annee: a.annee, valeur: a.emplois }))} />
              </div>

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

                  « NATURE DES IMPLANTATIONS » EST DEVENU « CLASSEMENT DES
                  ACTIVITÉS MENÉES ». Le classement lit la colonne des ACTIVITÉS — ce que
                  l'entreprise vient faire sur place : fabriquer, vendre,
                  distribuer. « Nature des implantations » nommait une autre
                  colonne du relevé, celle des TYPES de projet, qui n'est pas
                  affichée ici. */}
              <ClassementOuest zones={fdi.zones_ouest ?? []} pays={pays} tag={periodeFdi} />

              {/* ── TROIS CLASSEMENTS, UN SEUL TABLEAU ──────────────────────────
                  LE GRAPHE NE PORTAIT QU'UN NOMBRE. Origines, secteurs et
                  activités se rangeaient par nombre de projets, et c'est tout
                  ce qu'on en tirait. Or le relevé sait dire, pour chacun, ce
                  qu'il pèse en ARGENT et en EMPLOIS — et les trois ne disent
                  pas la même chose : un pays peut mener le classement des
                  projets et peser peu en capital, ou l'inverse. La France
                  annonce 56 projets au Sénégal ; ce n'est pas elle qui y
                  engage le plus.

                  LES TROIS PARTAGENT DONC LE MÊME TABLEAU, dans le dessin des
                  « plus gros projets annoncés » juste en dessous : quatre
                  tableaux voisins dans une même page doivent se lire de la
                  même façon, et trois copies d'un même code auraient fini par
                  diverger d'un détail. */}
              <TableauClassement titre="Pays d'origine des projets" colonne="Pays" drapeaux
                tag={periodeFdi} rows={fdi.tops.partenaires ?? []} />
              <TableauClassement titre="Classement des sect. d'activité des projets"
                colonne="Secteur" tag={periodeFdi} rows={fdi.tops.secteurs ?? []} />
              <TableauClassement titre="Classement des activités menées"
                colonne="Activité" tag={periodeFdi} rows={fdi.tops.activites ?? []} />

              <TableauPlusGros rows={fdi.plus_gros ?? []} tag={periodeFdi} />

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


