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
import { Bloc, EnTeteSection, Groupe, Ligne, LigneValeur } from "@/components/ListeIOS";
import { Os } from "@/components/Squelette";
import { Feuille } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import {
  type Investisseur, type ProjetFdi, type Signal, type ValeurSignal,
  accorder, fmtEntier, moisEnClair, useFicheInvestisseur,
} from "@/lib/fdi";
import { coin, ECHELLE, FONTE, T } from "@/theme";
import { Montant, PaysDrapeau } from "./AtomesFdi";
import TexteDefilant from "@/components/TexteDefilant";

/** Sur tablette, la fiche se plafonne à la largeur d'une page de lecture. */
export const LARGEUR_FICHE = 720;

// ── Briques de fiche ─────────────────────────────────────────────────────────

// La page se lit en LISTES GROUPÉES, comme une fiche Contacts ou un lieu de
// Plans — sur iOS comme sur Android (ListeIOS) : le fond gris de la feuille,
// les chiffres, le trajet et la description dans des blocs blancs arrondis,
// les détails en lignes séparées d'un filet fin. L'ordre de lecture ne
// change pas.

export function SectionFiche({ titre, children }: { titre: string; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{children}</View>;
}

/** Une ligne de fiche — la LigneValeur du système. Pas de damier :
    « Fabrication » d'un côté, « Commerce de détail de vêtements et
    d'accessoires vestimentaires » de l'autre, une grille étirerait tout à la
    taille du plus long. */
export function RangeeFiche({ label, children }: { label: string; children: React.ReactNode }) {
  return typeof children === "string" || typeof children === "number"
    ? <LigneValeur label={label} valeur={String(children)} />
    : <LigneValeur label={label}>{children}</LigneValeur>;
}

/** Des valeurs ÉNUMÉRÉES — filiales, secteurs, activités — en liste à puces :
    des noms qui se lisent l'un sous l'autre. En badges, ils avaient l'air de
    filtres à toucher, et un intitulé long (« Édition et diffusion sur Internet
    et moteurs de recherche ») se cassait dans sa pastille. */
function Puces({ valeurs }: { valeurs: string[] }) {
  const liste = (
    <View style={s.puces}>
      {valeurs.map(v => (
        <View key={v} style={s.puce}>
          <View style={s.puceRond} />
          <Text style={s.puceTexte} maxFontSizeMultiplier={ECHELLE.texte}>{v}</Text>
        </View>
      ))}
    </View>
  );
  return <Bloc>{liste}</Bloc>;
}

/** Les chiffres d'ouverture : deux ou trois valeurs en grand, côte à côte,
    séparées d'un filet, dans leur bloc blanc en tête de la fiche. */
function Chiffres({ items }: { items: { label: string; contenu: React.ReactNode }[] }) {
  return (
    <Bloc style={s.chiffres}>
      {items.map((it, i) => (
        <View key={it.label} style={s.chiffreBloc}>
          {i > 0 && <View style={s.chiffreSep} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <TexteDefilant style={s.chiffreLabel} maxFontSizeMultiplier={ECHELLE.compact}>{it.label}</TexteDefilant>
            {it.contenu}
          </View>
        </View>
      ))}
    </Bloc>
  );
}

/** Le trajet de l'investissement : d'où il part, où il arrive. */
function Trajet({ de, vers }: { de: React.ReactNode; vers: React.ReactNode }) {
  const ligne = (
    <View style={s.trajet}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>{de}</View>
      <Icone sf="arrow.right" materiel="arrow_forward" taille={17} couleur={T.grisClair} />
      <View style={{ flex: 1, minWidth: 0 }}>{vers}</View>
    </View>
  );
  return <Bloc>{ligne}</Bloc>;
}

/** La description, quand il y en a une. Absente, la section ne s'affiche pas :
    un intertitre suivi d'un tiret occupe la place d'une vraie section et
    n'apprend rien. */
function Description({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return (
    <SectionFiche titre="Description">
      <Bloc><Text style={s.descriptionTexte}>{texte}</Text></Bloc>
    </SectionFiche>
  );
}

const grand = (v: number | null, estime: boolean | null, unite: string) =>
  <Montant v={v} estime={estime} unite={unite} taille={23} />;

// ── La fiche d'un projet ─────────────────────────────────────────────────────

export function FicheProjetFdi({ p, onClose }: { p: ProjetFdi; onClose: () => void }) {
  return (
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE} fondGroupe
      titre={p.entreprise ?? "Projet"}
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
        <Groupe>
          <RangeeFiche label="Type de projet">{p.type_projet ?? "—"}</RangeeFiche>
          <RangeeFiche label="Secteur">{p.secteur ?? "—"}</RangeeFiche>
          <RangeeFiche label="Sous-secteur">{p.sous_secteur ?? "—"}</RangeeFiche>
          <RangeeFiche label="Activité prévue">{p.activite ?? "—"}</RangeeFiche>
        </Groupe>
      </SectionFiche>

      <Description texte={p.description_fr} />
    </Feuille>
  );
}

// ── La fiche d'un signal ─────────────────────────────────────────────────────

const enListe = (v: ValeurSignal[]) => v.length === 0 ? "—" : v.map(x => x.libelle).join(" · ");

export function FicheSignal({ s: sg, onClose }: { s: Signal; onClose: () => void }) {
  const definitions = sg.natures.filter(n => n.definition);
  return (
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE} fondGroupe
      titre={sg.entreprise ?? "Signal"}
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
        <Groupe>
          <RangeeFiche label="Repéré en">{moisEnClair(sg.periode)}</RangeeFiche>
          <RangeeFiche label="Stade">{enListe(sg.natures)}</RangeeFiche>
          <RangeeFiche label="Secteur">{enListe(sg.secteurs)}</RangeeFiche>
          <RangeeFiche label="Activité prévue">{enListe(sg.activites)}</RangeeFiche>
        </Groupe>
      </SectionFiche>

      <Description texte={sg.description_fr} />
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
    <Feuille onClose={onClose} ecart={22} largeurMax={LARGEUR_FICHE} fondGroupe
      titre={e.nom}
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
              <Puces valeurs={f.filiales.map(x => x.nom)} />
            </SectionFiche>
          )}
          {/* OÙ, ET COMBIEN DE FOIS : trente-neuf projets dans un pays et un
              dans un autre, ce n'est pas la même présence. */}
          {f.destinations.length > 0 && (
            <SectionFiche titre="Pays d'implantation">
              {/* Une liste, le nombre de projets en détail gris */}
              <Groupe>
                {f.destinations.map(d => (
                  <Ligne key={d.nom} label={d.nom} detail={`${fmtEntier(d.nb)} ${accorder(d.nb, "projet")}`} />
                ))}
              </Groupe>
            </SectionFiche>
          )}
          {f.secteurs.length > 0 && (
            <SectionFiche titre={f.secteurs.length > 1 ? "Secteurs d'investissement" : "Secteur d'investissement"}>
              <Puces valeurs={f.secteurs.map(x => x.nom)} />
            </SectionFiche>
          )}
          {f.sous_secteurs.length > 0 && (
            <SectionFiche titre={f.sous_secteurs.length > 1 ? "Sous-secteurs" : "Sous-secteur"}>
              <Puces valeurs={f.sous_secteurs.map(x => x.nom)} />
            </SectionFiche>
          )}
          {/* « MENÉES », non « prévues » : celles de projets déjà annoncés. */}
          {f.activites.length > 0 && (
            <SectionFiche titre={f.activites.length > 1 ? "Activités menées" : "Activité menée"}>
              <Puces valeurs={f.activites.map(x => x.nom)} />
            </SectionFiche>
          )}
        </>
      )}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 9 },
  metaTexte: { fontSize: 12.5, ...FONTE.demi, color: T.gris },

  chiffres: { flexDirection: "row", alignItems: "stretch" },
  chiffreBloc: { flex: 1, minWidth: 0, flexDirection: "row" },
  chiffreSep: { width: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginHorizontal: 14 },
  chiffreLabel: { fontSize: 8.5, ...FONTE.gras, letterSpacing: 1, color: T.gris, marginBottom: 5, textTransform: "uppercase" },
  grandNombre: { fontSize: 23, ...FONTE.gras, color: T.encre, fontVariant: ["tabular-nums"], letterSpacing: -0.4 },

  trajet: { flexDirection: "row", alignItems: "center", gap: 12 },
  trajetNom: { fontSize: 14, ...FONTE.gras, color: T.encre },

  // La définition se pose comme un bloc blanc du groupe
  definition: {
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    borderRadius: coin(16), borderCurve: "continuous", paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  definitionTexte: { fontSize: 13, lineHeight: 20, ...FONTE.normal, color: T.texte },
  definitionNom: { ...FONTE.gras, color: T.encre },

  // Les puces au corps des lignes de liste de chaque système : 15 pt sur iOS,
  // 16 sp sur Android
  puces: { gap: IOS ? 10 : 8 },
  puce: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  // Le point, centré sur la première ligne du texte
  puceRond: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.bleu, marginTop: IOS ? 7.5 : 9.5 },
  puceTexte: { flex: 1, fontSize: IOS ? 15 : 16, lineHeight: IOS ? 20 : 24, ...FONTE.normal, color: T.encre },

  descriptionTexte: { fontSize: 13.5, lineHeight: 22, ...FONTE.normal, color: T.texte },
  indispo: { fontSize: 12.5, ...FONTE.normal, color: T.gris },
}));
