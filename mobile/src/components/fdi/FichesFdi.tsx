// Les fiches des Investissements projetés — un projet, un signal, un
// investisseur — en feuilles, comme toutes les fiches de l'app.
//
// ELLES SONT CONSTRUITES COMME UNE PAGE, PAS COMME UN FORMULAIRE, et dans
// l'ordre des fiches du site : les chiffres qu'on vient chercher ouvrent, en
// grand ; le trajet de l'investissement suit sur une ligne ; le détail vient
// en rangées sous un intertitre ; la description ferme. Aucun encadré gris
// empilé — trois boîtes dans une boîte, et rien ne ressort.
//
// LA PAGE PUBLIQUE EST EN FRANÇAIS : seule la description française se lit
// ici. L'anglais de la source reste en base et sert la recherche ; tant qu'un
// projet n'a que lui, un tiret tient la place.
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import { Os } from "@/components/Squelette";
import { Feuille } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import {
  type Investisseur, type ProjetFdi, type Signal, type ValeurSignal,
  accorder, fmtEntier, moisEnClair, useFicheInvestisseur,
} from "@/lib/fdi";
import { ECHELLE, POLICE, T, TYPO } from "@/theme";
import { Montant, NoteEstimation, PaysDrapeau } from "./AtomesFdi";

/** Sur tablette, la fiche se plafonne à la largeur d'une page de lecture. */
export const LARGEUR_FICHE = 720;

// ── Briques de fiche ─────────────────────────────────────────────────────────

export function SectionFiche({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre} accessibilityRole="header">{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/** Une ligne de fiche : le libellé à gauche, la valeur à droite. Pas de damier
    — « Fabrication » d'un côté, « Commerce de détail de vêtements et
    d'accessoires vestimentaires » de l'autre : une grille étirerait tout à la
    taille du plus long. */
export function RangeeFiche({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.rangee}>
      <Text style={s.rangeeLabel}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof children === "string" || typeof children === "number"
          ? <Text style={s.rangeeValeur}>{children}</Text> : children}
      </View>
    </View>
  );
}

/** Des valeurs ÉNUMÉRÉES, en jetons — une liste de noms, pas un tableau. */
export function Jetons({ valeurs }: { valeurs: string[] }) {
  return (
    <View style={s.jetons}>
      {valeurs.map(v => (
        <View key={v} style={s.jeton}>
          <Text style={s.jetonTexte} maxFontSizeMultiplier={ECHELLE.texte}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/** Les chiffres d'ouverture : deux ou trois valeurs en grand, côte à côte,
    séparées d'un filet. Sans cadre — ils sont le sujet de la fiche. */
function Chiffres({ items }: { items: { label: string; contenu: React.ReactNode }[] }) {
  return (
    <View style={s.chiffres}>
      {items.map((it, i) => (
        <View key={it.label} style={s.chiffreBloc}>
          {i > 0 && <View style={s.chiffreSep} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.chiffreLabel} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{it.label}</Text>
            {it.contenu}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Le trajet de l'investissement : d'où il part, où il arrive. */
function Trajet({ de, vers }: { de: React.ReactNode; vers: React.ReactNode }) {
  return (
    <View style={s.trajet}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>{de}</View>
      <Icone sf="arrow.right" materiel="arrow_forward" taille={17} couleur={T.grisClair} />
      <View style={{ flex: 1, minWidth: 0 }}>{vers}</View>
    </View>
  );
}

/** La description, quand il y en a une. Absente, la section ne s'affiche pas :
    un intertitre suivi d'un tiret occupe la place d'une vraie section et
    n'apprend rien. */
function Description({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <SectionFiche titre="Description">
      <View style={s.description}>
        <Text style={s.descriptionTexte}>{texte}</Text>
      </View>
    </SectionFiche>
  );
}

const grand = (v: number | null, estime: boolean | null, unite: string) =>
  <Montant v={v} estime={estime} unite={unite} taille={23} />;

// ── La fiche d'un projet ─────────────────────────────────────────────────────

export function FicheProjetFdi({ p, onClose }: { p: ProjetFdi; onClose: () => void }) {
  const estime = !!(p.capex_estime || p.emplois_estime);
  return (
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE}
      titre={<Text style={s.titre}>{p.entreprise ?? "Projet"}</Text>}
      sousEntete={
        <View style={s.meta}>
          <Text style={s.metaTexte}>Annoncé en {moisEnClair(p.periode).toLowerCase()}</Text>
        </View>
      }>
      <Chiffres items={[
        { label: "Investissement annoncé", contenu: grand(p.capex_musd, p.capex_estime, "M$") },
        { label: "Emplois annoncés", contenu: grand(p.emplois, p.emplois_estime, "postes") },
      ]} />

      <Trajet
        de={<PaysDrapeau iso={p.partenaire_iso} nom={p.partenaire} taille={17} style={s.trajetNom} lignes={2} />}
        vers={<PaysDrapeau iso={p.pays_iso} nom={p.pays} taille={17} style={s.trajetNom} lignes={2} />} />

      {/* Le type de projet, en clair parmi les détails — pas en pastille */}
      <SectionFiche titre="Détails du projet">
        <View style={s.rangees}>
          <RangeeFiche label="Type de projet">{p.type_projet ?? "—"}</RangeeFiche>
          <RangeeFiche label="Secteur">{p.secteur ?? "—"}</RangeeFiche>
          <RangeeFiche label="Sous-secteur">{p.sous_secteur ?? "—"}</RangeeFiche>
          <RangeeFiche label="Activité prévue">{p.activite ?? "—"}</RangeeFiche>
        </View>
      </SectionFiche>

      <Description texte={p.description_fr} />
      {estime && <NoteEstimation />}
    </Feuille>
  );
}

// ── La fiche d'un signal ─────────────────────────────────────────────────────

const enListe = (v: ValeurSignal[]) => v.length === 0 ? "—" : v.map(x => x.libelle).join(" · ");

export function FicheSignal({ s: sg, onClose }: { s: Signal; onClose: () => void }) {
  const definitions = sg.natures.filter(n => n.definition);
  const estime = !!(sg.capex_estime || sg.funding_estime);
  return (
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE}
      titre={<Text style={s.titre}>{sg.entreprise ?? "Signal"}</Text>}
      sousEntete={
        <View style={s.meta}>
          <Text style={s.metaTexte}>Repéré en {moisEnClair(sg.periode).toLowerCase()}</Text>
        </View>
      }>
      {/* Les deux montants ne s'additionnent pas : des fonds levés mesurent ce
          qu'une entreprise a réuni, un investissement prévu ce qu'elle
          annonce dépenser. Souvent absents à ce stade — le tiret le dit. */}
      <Chiffres items={[
        { label: "Fonds levés", contenu: grand(sg.funding_musd, sg.funding_estime, "M$") },
        { label: "Investissement prévu", contenu: grand(sg.capex_musd, sg.capex_estime, "M$") },
      ]} />

      {/* L'arrivée peut être MULTIPLE et mêler pays et régions : toutes sont
          montrées, aucune n'est résumée — en clair, comme le départ, et non
          en jetons qui feraient de chaque destination une étiquette. */}
      <Trajet
        de={<PaysDrapeau iso={sg.origine_iso} nom={sg.origine} taille={17} style={s.trajetNom} lignes={2} />}
        vers={<Text style={[s.trajetNom, !sg.destinations.length && { color: T.grisClair }]}>
          {sg.destinations.length ? sg.destinations.map(d => d.libelle ?? "—").join(" · ") : "—"}
        </Text>} />

      {/* CE QUE LE STADE VEUT DIRE : « Stratégie d'investissement » ne se
          devine pas. Le texte est celui de fDi, tiré du référentiel ; absent,
          le cadre ne s'affiche pas du tout. Le stade y est nommé en gras :
          aucune pastille ne le dit plus au-dessus. */}
      {definitions.length > 0 && (
        <View style={s.definition}>
          {definitions.map(n => (
            <Text key={n.id} style={s.definitionTexte}>
              <Text style={s.definitionNom}>{n.court ?? n.libelle} — </Text>
              {n.definition}
            </Text>
          ))}
        </View>
      )}

      <SectionFiche titre="Détails du signal">
        <View style={s.rangees}>
          <RangeeFiche label="Repéré en">{moisEnClair(sg.periode)}</RangeeFiche>
          <RangeeFiche label="Stade">{enListe(sg.natures)}</RangeeFiche>
          <RangeeFiche label="Secteur">{enListe(sg.secteurs)}</RangeeFiche>
          <RangeeFiche label="Activité prévue">{enListe(sg.activites)}</RangeeFiche>
        </View>
      </SectionFiche>

      <Description texte={sg.description_fr} />
      {estime && <NoteEstimation />}
    </Feuille>
  );
}

// ── La fiche d'un investisseur ───────────────────────────────────────────────
// ELLE SE DEMANDE : la carte ne porte que deux nombres, et ce qui fait
// l'intérêt de la fiche — où le groupe est allé, dans quoi, pour y faire quoi —
// suppose de regrouper TOUS ses projets. Elle n'est pas filtrée : elle dit
// l'investisseur entier, quelle que soit la sélection de la liste.

export function FicheInvestisseurSheet({ e, onClose }: { e: Investisseur; onClose: () => void }) {
  const q = useFicheInvestisseur(e.nom, e.origine);
  const f = q.data;
  return (
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE}
      titre={<Text style={s.titre}>{e.nom}</Text>}
      sousEntete={
        // Le pays d'origine et la période tiennent la ligne de méta : deux
        // nombres seulement en tête, la largeur d'un téléphone n'en porte pas
        // trois sans couper leurs intitulés
        <View style={s.meta}>
          <PaysDrapeau iso={e.origine_iso} nom={e.origine ?? "Origine inconnue"} style={s.metaTexte} />
          {f && f.annees[0] != null && (
            <Text style={s.metaTexte}>
              · {f.annees[0] === f.annees[1] ? `en ${f.annees[0]}` : `de ${f.annees[0]} à ${f.annees[1]}`}
            </Text>
          )}
        </View>
      }>
      <Chiffres items={[
        { label: "Projets annoncés", contenu: <Text style={s.grandNombre}>{fmtEntier(f ? f.projets : e.projets)}</Text> },
        { label: "Pays d'implantation", contenu: <Text style={s.grandNombre}>{fmtEntier(f ? f.pays : e.pays)}</Text> },
      ]} />

      {!f ? (
        q.isError ? (
          <Text style={s.indispo}>La fiche n'a pas pu être chargée.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Os style={{ height: 10, width: "35%" }} />
            <Os style={{ height: 26, width: "88%", borderRadius: 13 }} />
            <Os style={{ height: 10, width: "42%", marginTop: 12 }} />
            <Os style={{ height: 14, width: "100%" }} />
            <Os style={{ height: 14, width: "100%" }} />
          </View>
        )
      ) : (
        <>
          {/* SOUS QUELS NOMS LE GROUPE A SIGNÉ : la contrepartie du
              regroupement par maison mère — sans cette section, le nom de la
              filiale ne se lirait plus nulle part. Les projets menés en propre
              n'y figurent pas, d'où une somme souvent inférieure au total. */}
          {f.filiales.length > 0 && (
            <SectionFiche titre={f.filiales.length > 1 ? "Filiales" : "Filiale"}>
              <Jetons valeurs={f.filiales.map(x => x.nom)} />
            </SectionFiche>
          )}
          {/* OÙ, ET COMBIEN DE FOIS : trente-neuf projets dans un pays et un
              dans un autre, ce n'est pas la même présence. */}
          {f.destinations.length > 0 && (
            <SectionFiche titre="Pays d'implantation">
              <View style={s.rangees}>
                {f.destinations.map(d => (
                  <RangeeFiche key={d.nom} label={d.nom}>
                    <Text style={[s.rangeeValeur, { color: T.gris, textAlign: "right" }]}>
                      {fmtEntier(d.nb)} {accorder(d.nb, "projet")}
                    </Text>
                  </RangeeFiche>
                ))}
              </View>
            </SectionFiche>
          )}
          {f.secteurs.length > 0 && (
            <SectionFiche titre={f.secteurs.length > 1 ? "Secteurs d'investissement" : "Secteur d'investissement"}>
              <Jetons valeurs={f.secteurs.map(x => x.nom)} />
            </SectionFiche>
          )}
          {f.sous_secteurs.length > 0 && (
            <SectionFiche titre={f.sous_secteurs.length > 1 ? "Sous-secteurs" : "Sous-secteur"}>
              <Jetons valeurs={f.sous_secteurs.map(x => x.nom)} />
            </SectionFiche>
          )}
          {/* « MENÉES », non « prévues » : celles de projets déjà annoncés. */}
          {f.activites.length > 0 && (
            <SectionFiche titre={f.activites.length > 1 ? "Activités menées" : "Activité menée"}>
              <Jetons valeurs={f.activites.map(x => x.nom)} />
            </SectionFiche>
          )}
        </>
      )}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 9 },
  metaTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris },

  chiffres: {
    flexDirection: "row", alignItems: "stretch",
    paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.bordure,
  },
  chiffreBloc: { flex: 1, minWidth: 0, flexDirection: "row" },
  chiffreSep: { width: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginHorizontal: 14 },
  chiffreLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 5, textTransform: "uppercase" },
  grandNombre: { fontSize: 23, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"], letterSpacing: -0.4 },

  trajet: { flexDirection: "row", alignItems: "center", gap: 12 },
  trajetNom: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre },

  definition: {
    backgroundColor: T.blocFond, borderRadius: 14, borderCurve: "continuous",
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  definitionTexte: { fontSize: 13, lineHeight: 20, fontFamily: POLICE.normal, color: T.texte },
  definitionNom: { fontFamily: POLICE.gras, color: T.encre },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  rangees: { gap: 9 },
  rangee: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rangeeLabel: { width: 112, fontSize: 13, fontFamily: POLICE.normal, color: T.gris, lineHeight: 18 },
  rangeeValeur: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },

  jetons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  jeton: {
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.carteBord,
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5,
  },
  jetonTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.texte },

  // Un filet ALPHA, jamais un jeton dynamique : une bordure ne suit pas le
  // changement d'apparence (voir theme.ts)
  description: { borderLeftWidth: 2, borderLeftColor: T.blocBord, paddingLeft: 13 },
  descriptionTexte: { fontSize: 13.5, lineHeight: 22, fontFamily: POLICE.normal, color: T.texte },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris },
}));
