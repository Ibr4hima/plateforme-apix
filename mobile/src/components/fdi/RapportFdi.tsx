// Les briques des rapports — chiffres clés, évolution par année, classements.
//
// LE RAPPORT DU SITE EST UNE PAGE QU'ON IMPRIME ; CELUI-CI SE LIT AU POUCE.
// Le contenu est le même — mêmes compteurs, mêmes séries, mêmes classements,
// même lecture « à retenir » calculée —, la forme change :
//   · un tableau à cinq colonnes ne tient pas sur un téléphone. Chaque ligne
//     de classement montre en grand la valeur de la colonne qui trie, et les
//     autres en dessous, en petit. Le TRI se choisit dans une bascule au-dessus
//     de la liste, là où le site le place dans l'en-tête des colonnes ;
//   · la courbe et les trois tableaux annuels du site deviennent une seule
//     carte : la mesure se choisit, la courbe se lit au doigt, les années se
//     lisent dessous, la plus récente d'abord ;
//   · dix lignes d'abord, la suite à la demande.
//
// LES RÈGLES DE FOND NE BOUGENT PAS. Aucun chiffre sans sa période. Les
// valeurs manquantes restent en queue dans tous les tris — on ne sait pas,
// ce n'est pas zéro. Une somme qui mêle déclaré et estimé porte l'astérisque.
// Le Sénégal est toujours situé, même hors du haut d'un classement.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import GrapheLignes from "@/components/GrapheLignes";
import Icone from "@/components/Icone";
import { ChiffreAnime, Tapable } from "@/components/ui";
import { creerStyles, useCouleur } from "@/lib/apparence";
import { fmtEntier } from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { ECHELLE, POLICE, T, TYPO } from "@/theme";
import { Drapeau } from "./AtomesFdi";
import { Segments } from "./FiltresFdi";

/** Dix lignes d'abord : un classement se lit par le haut. */
export const FENETRE = 10;

// ── La carte de section ──────────────────────────────────────────────────────

export function CarteRapport({ titre, tag, accent, droite, children }: {
  titre: string; tag?: string | null; accent?: string; droite?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={s.carte}>
      <View style={s.carteEntete}>
        <Text style={[s.carteTitre, accent ? { color: accent } : null]} accessibilityRole="header">
          {titre.toUpperCase()}
        </Text>
        {tag ? <View style={s.tag}><Text style={s.tagTexte} maxFontSizeMultiplier={ECHELLE.compact}>{tag}</Text></View> : null}
        {droite ? <View style={{ marginLeft: "auto" }}>{droite}</View> : null}
      </View>
      {children}
    </View>
  );
}

/** Le bouton qui déplie la suite d'une liste — il dit combien il en reste. */
function BoutonSuite({ reste, tout, onPress }: { reste: number; tout: boolean; onPress: () => void }) {
  if (reste <= 0 && !tout) return null;
  return (
    <Tapable onPress={() => { tick(); onPress(); }} echelle={0.98} style={s.suite}
      accessibilityRole="button">
      <Text style={s.suiteTexte}>{tout ? "Réduire" : `Afficher la suite (${fmtEntier(reste)})`}</Text>
      <Icone sf={tout ? "chevron.up" : "chevron.down"} materiel={tout ? "expand_less" : "expand_more"}
        taille={15} couleur={T.bleu} />
    </Tapable>
  );
}

/** La pastille de rang : pleine pour le podium, voilée ensuite. */
function Rang({ n, marque }: { n: number; marque?: boolean }) {
  const podium = marque || n <= 3;
  return (
    <View style={[s.rang, podium && s.rangPodium]}>
      <Text style={[s.rangTexte, podium && s.rangTextePodium]} maxFontSizeMultiplier={ECHELLE.compact}>{n}</Text>
    </View>
  );
}

// ── Les chiffres clés ────────────────────────────────────────────────────────

export type Kpi = { label: string; valeur: string; note?: string | null };

export function Kpis({ items, colonnes }: { items: Kpi[]; colonnes: number }) {
  // Deux par rangée au téléphone, quatre sur tablette
  const parRangee = colonnes > 1 ? 4 : 2;
  const rangees: Kpi[][] = [];
  for (let i = 0; i < items.length; i += parRangee) rangees.push(items.slice(i, i + parRangee));
  return (
    <View style={{ gap: 10 }}>
      {rangees.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          {r.map(k => (
            <View key={k.label} style={s.kpi}>
              <Text style={s.kpiLabel} numberOfLines={2} maxFontSizeMultiplier={ECHELLE.compact}>{k.label.toUpperCase()}</Text>
              <ChiffreAnime texte={k.valeur} style={s.kpiValeur} />
              {k.note ? <Text style={s.kpiNote} numberOfLines={3}>{k.note}</Text> : null}
            </View>
          ))}
          {/* Une rangée incomplète garde la largeur de ses cartes */}
          {r.length < parRangee && Array.from({ length: parRangee - r.length }, (_, j) => <View key={`v${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

// ── L'évolution par année ────────────────────────────────────────────────────

export type Mesure = {
  cle: string; label: string; couleur: string;
  fmt: (v: number | null) => string;
  points: { annee: number; valeur: number | null }[];
};

/** La FORME d'abord, les VALEURS ensuite : la courbe montre les creux, les
    paliers et le pic d'un coup d'œil ; les années, dessous, disent de combien
    — avec l'écart à l'année précédente, que nulle courbe ne donne sans qu'on
    la parcoure. L'année en cours est signalée : incomplète, elle ne se compare
    pas à une année pleine. */
export function CarteAnnees({ titre, tag, mesures }: { titre: string; tag?: string | null; mesures: Mesure[] }) {
  const [cle, setCle] = useState(mesures[0]?.cle);
  const [tout, setTout] = useState(false);
  const m = mesures.find(x => x.cle === cle) ?? mesures[0];
  const valides = useMemo(() => (m?.points ?? [])
    .filter((p): p is { annee: number; valeur: number } => p.valeur != null)
    .sort((a, b) => a.annee - b.annee), [m]);
  if (!m || !valides.length) return null;

  const enCours = new Date().getFullYear();
  const nonNulles = valides.filter(p => p.valeur !== 0);
  const max = Math.max(...nonNulles.map(p => p.valeur));
  // Le pic n'existe que s'il se distingue : une valeur STRICTEMENT supérieure
  const pic = nonNulles.filter(p => p.valeur === max).length === 1 && nonNulles.length > 1
    ? nonNulles.find(p => p.valeur === max)!.annee : null;
  const recentes = [...nonNulles].reverse();
  const visibles = tout ? recentes : recentes.slice(0, 8);
  const precedent = (annee: number) => {
    const i = valides.findIndex(p => p.annee === annee);
    return i <= 0 ? null : valides[i - 1].valeur;
  };

  return (
    <CarteRapport titre={titre} tag={tag}>
      {mesures.length > 1 && (
        <Segments valeur={m.cle} onChange={c => { setCle(c); setTout(false); }}
          options={mesures.map(x => ({ cle: x.cle, label: x.label }))} />
      )}
      <View style={{ marginTop: mesures.length > 1 ? 6 : 0 }}>
        <GrapheLignes series={[{ nom: m.label, couleur: m.couleur, data: valides }]} hauteur={176} fmt={m.fmt} epure />
      </View>
      <View style={s.annees}>
        {visibles.map((p, i) => {
          const prec = precedent(p.annee);
          const ecart = prec == null ? null : p.valeur - prec;
          return (
            <View key={p.annee} style={[s.anneeLigne, i > 0 && s.anneeBord]}>
              <Text style={s.annee}>{p.annee}</Text>
              {p.annee === pic && <View style={s.pic}><Text style={s.picTexte}>Pic</Text></View>}
              {p.annee === enCours && <View style={s.enCours}><Text style={s.enCoursTexte}>en cours</Text></View>}
              <View style={{ flex: 1 }} />
              <Text style={s.anneeValeur}>{m.fmt(p.valeur)}</Text>
              <Text style={[s.ecart, { color: ecart == null || ecart === 0 ? T.gris : ecart > 0 ? T.vert : "#dc2626" }]}
                maxFontSizeMultiplier={ECHELLE.compact}>
                {ecart == null ? "—" : ecart === 0 ? "=" : `${ecart > 0 ? "+" : "−"}${m.fmt(Math.abs(ecart))}`}
              </Text>
            </View>
          );
        })}
      </View>
      <BoutonSuite reste={recentes.length - visibles.length} tout={tout} onPress={() => setTout(v => !v)} />
    </CarteRapport>
  );
}

// ── Un classement trié par le lecteur ────────────────────────────────────────

/** Une colonne de classement : son nom dans la bascule de tri, l'écriture de
    sa valeur quand elle trie (à droite, en grand), et sa phrase quand une
    autre trie (dessous, en petit : « 56 projets »). */
export type Colonne = {
  cle: string; label: string;
  fmt: (v: number | null) => string;
  phrase: (v: number | null) => string;
};
export type LigneClassee = {
  nom: string; iso?: string | null; detail?: string | null;
  valeurs: Record<string, number | null>;
  /** Une marque de fin de ligne (« Présent au Sénégal »). */
  marque?: string | null;
};

/** UN CLASSEMENT TRIÉ PAR LE LECTEUR, sur une liste COMPLÈTE : le tri porte
    sur toutes les lignes, et aucune ne peut disparaître d'un retri. Il s'ouvre
    sur la première colonne — le montant, quand il y en a un : c'est la
    première question d'un comité, où va l'argent. */
export function ClassementTrie({ titre, tag, colonnes, lignes, drapeaux, note, accent }: {
  titre: string; tag?: string | null; colonnes: Colonne[]; lignes: LigneClassee[];
  drapeaux?: boolean; note?: string; accent?: string;
}) {
  const [cle, setCle] = useState(colonnes[0].cle);
  const [tout, setTout] = useState(false);
  const triees = useMemo(() => [...lignes].sort((a, b) => {
    const x = a.valeurs[cle], y = b.valeurs[cle];
    if (x == null && y == null) return a.nom.localeCompare(b.nom, "fr");
    if (x == null) return 1;
    if (y == null) return -1;
    return y !== x ? y - x : a.nom.localeCompare(b.nom, "fr");
  }), [lignes, cle]);
  if (!lignes.length) return null;
  const visibles = tout ? triees : triees.slice(0, FENETRE);
  const col = colonnes.find(c => c.cle === cle)!;
  const autres = colonnes.filter(c => c.cle !== cle);

  return (
    <CarteRapport titre={titre} tag={tag} accent={accent}>
      {colonnes.length > 1 && (
        <Segments valeur={cle} onChange={c => { setCle(c); }}
          options={colonnes.map(c => ({ cle: c.cle, label: c.label }))} />
      )}
      <View>
        {visibles.map((l, i) => (
          <LigneRang key={`${l.nom}|${l.detail ?? ""}`} rang={i + 1} premiere={i === 0}
            nom={l.nom} iso={drapeaux ? l.iso : undefined} marque={l.marque}
            sous={[l.detail, ...autres.map(c => c.phrase(l.valeurs[c.cle]))].filter(Boolean).join(" · ")}
            valeur={col.fmt(l.valeurs[cle])} />
        ))}
      </View>
      <BoutonSuite reste={triees.length - visibles.length} tout={tout} onPress={() => setTout(v => !v)} />
      {note ? <Text style={s.uniteNote}>{note}</Text> : null}
    </CarteRapport>
  );
}

/** Une ligne de classement : rang, nom (et drapeau), la valeur qui trie à
    droite, le reste en petit dessous. */
export function LigneRang({ rang, premiere, nom, iso, sous, valeur, marque, surligne }: {
  rang: number; premiere: boolean; nom: string; iso?: string | null;
  sous?: string; valeur: string; marque?: string | null; surligne?: boolean;
}) {
  return (
    <View style={[s.ligne, !premiere && s.ligneBord, surligne && s.ligneSurlignee]}>
      <Rang n={rang} marque={surligne} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.ligneNomRangee}>
          {iso !== undefined && <Drapeau iso={iso} taille={14} />}
          <Text style={[s.ligneNom, surligne && { color: T.bleu, fontFamily: POLICE.gras }]} numberOfLines={2}>{nom}</Text>
        </View>
        {sous ? <Text style={s.ligneSous} numberOfLines={2}>{sous}</Text> : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[s.ligneValeur, surligne && { color: T.bleu }]} maxFontSizeMultiplier={ECHELLE.chiffre}>{valeur}</Text>
        {marque ? <Text style={s.marque} maxFontSizeMultiplier={ECHELLE.compact}>{marque}</Text> : null}
      </View>
    </View>
  );
}

// ── Un classement compté, à barres — celui des signaux ───────────────────────

export type RangCompte = { nom: string; nb: number; rang?: number; iso?: string | null };

/** Rang, nom, nombre, et une barre mesurée au PREMIER du classement : un
    signal porte plusieurs secteurs et plusieurs destinations, la somme des
    lignes dépasse donc le total, et une part n'aurait pas de sens. La barre
    dit un rapport de grandeur, ce qui est vrai.

    L'ÉPINGLÉ — le Sénégal — EST TOUJOURS LÀ. Dans le haut, il est souligné ;
    venu du fond, il prend la dernière place après un « ⋮ » et garde son rang
    réel : « absent du haut » et « quatorzième sur seize » ne s'équivalent pas. */
export function ClassementCompte({ titre, tag, lignes, accent, drapeaux, epingle, max = 10 }: {
  titre: string; tag?: string | null; lignes: RangCompte[]; accent: string;
  drapeaux?: boolean; epingle?: string; max?: number;
}) {
  const teinte = useCouleur(accent) as unknown as string;
  const dansHaut = epingle != null && lignes.slice(0, max).some(r => r.nom === epingle);
  const horsHaut = epingle != null && !dansHaut ? lignes.find(r => r.nom === epingle) : undefined;
  const haut = lignes.slice(0, horsHaut ? max - 1 : max);
  const affichees = horsHaut ? [...haut, horsHaut] : haut;
  if (!affichees.length) return null;
  const sommet = Math.max(1e-9, ...haut.map(r => r.nb));
  return (
    <CarteRapport titre={titre} tag={tag} accent={teinte}>
      <View>
        {affichees.map((r, i) => {
          const rang = r.rang ?? i + 1;
          const precedent = i > 0 ? (affichees[i - 1].rang ?? i) : 0;
          const saut = rang > precedent + 1;
          const ici = epingle != null && r.nom === epingle;
          return (
            <View key={`${r.nom}-${rang}`}>
              {saut && <Text style={s.saut}>⋮</Text>}
              <View style={[s.compteLigne, ici && s.ligneSurlignee]}>
                <Rang n={rang} marque={ici} />
                <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                  <View style={s.ligneNomRangee}>
                    {drapeaux && <Drapeau iso={r.iso} taille={14} />}
                    <Text style={[s.ligneNom, ici && { color: T.bleu, fontFamily: POLICE.gras }]} numberOfLines={1}>{r.nom}</Text>
                    <Text style={[s.compteNb, ici && { color: T.bleu }]}>{fmtEntier(r.nb)}</Text>
                  </View>
                  <View style={s.barreFond}>
                    <View style={[s.barre, { width: `${Math.max(3, (r.nb / sommet) * 100)}%`, backgroundColor: teinte },
                      !ici && rang > 3 && { opacity: 0.55 }]} />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </CarteRapport>
  );
}

// ── Une bascule de zones ─────────────────────────────────────────────────────

/** Les trois lectures de l'Afrique de l'Ouest — géographie, union économique,
    union monétaire — sous une bascule : c'est l'ÉCART entre elles qui
    intéresse, et un écart se voit en changeant de zone sur place. */
export function BasculeZones<Z extends { code: string; court: string }>({ zones, valeur, onChange }: {
  zones: Z[]; valeur: number; onChange: (i: number) => void;
}) {
  if (zones.length < 2) return null;
  return (
    <Segments valeur={String(valeur)} onChange={c => onChange(Number(c))}
      options={zones.map((z, i) => ({ cle: String(i), label: z.court }))} />
  );
}

// ── À retenir ────────────────────────────────────────────────────────────────

/** La lecture écrite. Elle est CALCULÉE à partir des données affichées, jamais
    rédigée d'avance : si les données changent, la phrase change. */
export function ARetenir({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.retenir}>
      <Text style={s.retenirTitre}>À RETENIR</Text>
      <Text style={s.retenirTexte}>{children}</Text>
    </View>
  );
}

export const Gras = ({ children }: { children: React.ReactNode }) =>
  <Text style={{ fontFamily: POLICE.gras, color: T.encre }}>{children}</Text>;

const s = creerStyles(() => ({
  carte: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    borderWidth: 1, borderColor: T.carteBord, padding: 16, gap: 12,
  },
  carteEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  // Le titre de section de l'app (Fiche pays), sans variante
  carteTitre: { ...TYPO.micro, color: T.bleu, flexShrink: 1 },
  tag: { backgroundColor: T.bleuVoile, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.3 },

  // Les cartes de chiffres clés de l'app : arrondi 18, chiffre en bleu, et
  // DEUX LIGNES RÉSERVÉES À L'ÉTIQUETTE — « Investissement annoncé » passe à
  // la ligne, « Projets annoncés » non ; sans cette réserve, les chiffres
  // d'une même rangée ne seraient plus alignés
  kpi: {
    flex: 1, minWidth: 0, backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    borderWidth: 1, borderColor: T.carteBord, paddingHorizontal: 15, paddingVertical: 13, gap: 4,
  },
  kpiLabel: { fontSize: 9, lineHeight: 12, minHeight: 24, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1 },
  kpiValeur: { fontSize: 23, lineHeight: 29, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  kpiNote: { fontSize: 11, lineHeight: 15, fontFamily: POLICE.normal, color: T.gris },

  annees: { marginTop: 2 },
  anneeLigne: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8.5 },
  anneeBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  annee: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.gris, fontVariant: ["tabular-nums"] },
  anneeValeur: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  ecart: { width: 82, textAlign: "right", fontSize: 11.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  pic: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 },
  picTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu },
  enCours: { backgroundColor: T.voile, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 },
  enCoursTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris },

  // Pas de rayon sur une ligne ordinaire : un filet posé sur un coin arrondi
  // se courbe à ses deux bouts. Seule la ligne mise en évidence s'arrondit.
  ligne: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, paddingHorizontal: 4 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneSurlignee: { backgroundColor: T.bleuVoile, borderTopColor: "transparent", borderRadius: 10 },
  ligneNomRangee: { flexDirection: "row", alignItems: "center", gap: 6 },
  ligneNom: { flexShrink: 1, fontSize: 13.5, lineHeight: 18, fontFamily: POLICE.demi, color: T.encre },
  ligneSous: { fontSize: 11.5, lineHeight: 16, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  ligneValeur: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  marque: { fontSize: 10, fontFamily: POLICE.gras, color: T.vert },

  rang: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: T.bleuVoile },
  rangPodium: { backgroundColor: T.bleuAction },
  rangTexte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  rangTextePodium: { color: "#fff" },

  compteLigne: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 7, paddingHorizontal: 4 },
  compteNb: { marginLeft: "auto", fontSize: 13, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"], paddingLeft: 8 },
  barreFond: { height: 5, borderRadius: 3, backgroundColor: T.voile, overflow: "hidden" },
  barre: { height: 5, borderRadius: 3 },
  saut: { fontSize: 14, lineHeight: 14, fontFamily: POLICE.gras, color: T.grisClair, paddingLeft: 11 },
  uniteNote: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris },

  suite: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: T.bleuVoile,
  },
  suiteTexte: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.bleu },

  retenir: {
    backgroundColor: T.blocFond, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, gap: 8,
  },
  retenirTitre: { ...TYPO.micro, color: T.bleu },
  retenirTexte: { fontSize: 14, lineHeight: 22, fontFamily: POLICE.normal, color: T.texte },
}));
