// En-tête de page — CHAQUE SYSTÈME LE SIEN.
//
// SUR iOS : la barre de navigation DU SYSTÈME, fixe en haut de l'écran. Le
// titre en ligne, centré, à la même taille sur tous les écrans ; le chevron
// de retour et le balayage depuis le bord ; à droite, à l'opposé du retour,
// la loupe (le champ de recherche d'iOS 26, une capsule et son X rond, se
// déplie sous la barre quand on la touche) et le bouton des filtres, en SF Symbols — sur iOS 26, la barre les
// pose dans sa capsule de verre. Les segments sont la capsule de Podcasts,
// posée juste sous la barre, sans compteurs. Ce composant DÉCRIT la barre
// au navigateur (Stack.Screen), qui la fait dessiner par UIKit ; il ne
// dessine lui-même que le champ et la capsule. Les titres restent en
// Google Sans, la police de l'app sur les deux systèmes.
//
// SUR ANDROID : le gabarit de l'accueil, un BANDEAU BLEU qui part du haut de
// l'écran (barre d'état comprise) et englobe les commandes et le titre ; la
// page reprend en clair juste dessous.
//
//   ┌ bandeau bleu ─────────────────────────────────────┐
//   │ [←]            Titre centré        [🔍] [≡ …]     │
//   │ (champ de recherche, s'il est ouvert)             │
//   └───────────────────────────────────────────────────┘
//   [segments à compteurs]
//
// Le titre tient la barre de navigation, entre les deux flancs de boutons :
// les flancs sont forcés à la même largeur pour que le centre soit optique,
// et le titre se réduit jusqu'à 62 % plutôt que de rogner.
//
// Les boutons sont en verre dépoli (BoutonVerre). La recherche ne monopolise
// plus une barre : la loupe ouvre le champ à la demande, la croix le referme.
// La barre d'état passe en blanc tant que la page a le focus — le bandeau est
// bleu jusqu'en haut.
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Reanime, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { ChampRecherche, SegmentsCapsule } from "@/components/ListeIOS";
import { BoutonVerre, Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { creerStyles, useCouleur, useSombre, useStyleBarreParDefaut } from "@/lib/apparence";
import { useCap } from "@/lib/marges";
import { IOS } from "@/lib/plateforme";
import { DEGRADE_HERO, ECHELLE, POLICE, T } from "@/theme";

export type SegmentOption = { cle: string; label: string; compte?: number };

type ProprietesEnTete = {
  titre: string;
  /** Le titre de la barre iOS quand le titre complet n'y tiendrait pas —
      « Opportunités » pour « Opportunités d'investissement ». */
  titreCourt?: string;
  retour?: boolean;
  /** `toujours` : le champ est là d'emblée, sans loupe — l'écran est une
      liste qu'on vient parcourir (les listes des Investissements projetés). */
  recherche?: { valeur: string; onChange: (v: string) => void; placeholder?: string; toujours?: boolean };
  bouton?: { icone: string; onPress: () => void; badge?: number };
  segments?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void };
  children?: React.ReactNode;
};

export default function EnTetePage(props: ProprietesEnTete) {
  return IOS ? <EnTeteIOS {...props} /> : <EnTeteAndroid {...props} />;
}

// ── iOS : la barre du système ────────────────────────────────────────────────

function EnTeteIOS({ titre, titreCourt, recherche, bouton, segments, children }: ProprietesEnTete) {
  const cap = useCap();
  // LA RECHERCHE NE S'AFFICHE QU'À LA DEMANDE : une loupe dans la barre, à
  // l'opposé du retour ; la toucher déplie le champ sous la barre, clavier
  // ouvert, et « Annuler » le replie en vidant la recherche. Une recherche
  // déjà saisie (retour sur l'écran) le garde ouvert.
  const toujours = !!recherche?.toujours;
  const [rechercheOuverte, setRechercheOuverte] = useState(!!recherche?.valeur || toujours);

  // LES OPTIONS DE LA BARRE NE CHANGENT QUE SI CE QU'ELLE MONTRE CHANGE.
  // expo-router repasse les options au navigateur à chaque nouvel objet ; les
  // rappels de l'écran (souvent des fonctions recréées à chaque rendu) sont
  // donc lus dans une référence, et l'objet ne dépend que du visible.
  const rappels = useRef({ recherche: recherche?.onChange, bouton: bouton?.onPress });
  rappels.current = { recherche: recherche?.onChange, bouton: bouton?.onPress };
  // La loupe n'a de raison d'être que si le champ se replie
  const avecRecherche = !!recherche && !toujours;
  const avecBouton = !!bouton;
  const badge = bouton?.badge;
  const basculerRecherche = useCallback(() => setRechercheOuverte(ouverte => {
    if (ouverte) rappels.current.recherche?.("");
    return !ouverte;
  }), []);
  const options = useMemo(() => ({
    title: titreCourt ?? titre,
    headerRight: avecRecherche || avecBouton ? () => (
      <View style={s.boutonsBarre}>
        {avecRecherche && (
          <BoutonBarre sf="magnifyingglass" materiel="search" label="Rechercher" onPress={basculerRecherche} />
        )}
        {/* Le filtre : le symbole seul au repos — la barre d'iOS 26 le pose
            déjà dans un cercle de verre —, un disque PLEIN quand un filtre est
            appliqué, le compte en pastille. Ce qui est filtré ne s'affiche pas
            dans la page : il se lit dans la feuille des filtres. */}
        {avecBouton && (
          <BoutonBarre sf={badge ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease"}
            materiel="tune" label={badge ? `Filtres, ${badge} actif${badge > 1 ? "s" : ""}` : "Filtres"} badge={badge}
            onPress={() => rappels.current.bouton?.()} taille={badge ? 22 : 18} />
        )}
      </View>
    ) : undefined,
  }), [titre, titreCourt, avecRecherche, avecBouton, badge, basculerRecherche]);

  return (
    <>
      <Stack.Screen options={options} />

      {/* Toujours là : le champ seul, sous la barre, son texte d'invite
          visible ; la croix du champ l'efface */}
      {recherche && toujours && (
        <View style={[s.rechercheIOS, cap]}>
          <ChampRecherche valeur={recherche.valeur} onChange={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"} style={{ flex: 1 }} />
        </View>
      )}

      {recherche && !toujours && rechercheOuverte && (
        <Reanime.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}
          style={[s.rechercheIOS, cap]}>
          {/* Le X rond d'iOS 26 referme la recherche, et vide la saisie */}
          <ChampRecherche valeur={recherche.valeur} onChange={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"} autoFocus onFermer={basculerRecherche} style={{ flex: 1 }} />
        </Reanime.View>
      )}

      {/* Les segments d'iOS 26, sous la barre — sans compteurs */}
      {segments && (
        <View style={[s.segmentsIOS, cap]}>
          <SegmentsCapsule options={segments.options} valeur={segments.valeur} onChange={segments.onChange} />
        </View>
      )}

      {children ? <View style={[s.sousBarreIOS, cap]}>{children}</View> : null}
    </>
  );
}

/** Un bouton de barre iOS : un SF Symbol à la teinte de l'app, centré dans un
    carré de 36 pt — sur iOS 26, la barre pose les boutons voisins dans une
    même capsule de verre. */
function BoutonBarre({ sf, materiel, onPress, badge, label, taille = 18 }: NomsIcone & {
  onPress: () => void; badge?: number; label: string; taille?: number;
}) {
  return (
    <Pressable onPress={() => { tick(); onPress(); }} hitSlop={6} accessibilityRole="button"
      accessibilityLabel={label} style={({ pressed }) => [s.boutonBarre, pressed && { opacity: 0.35 }]}>
      <Icone sf={sf} materiel={materiel} taille={taille} couleur={T.bleu} poids="medium" />
      {badge ? (
        <View style={s.badgeIOS}><Text style={s.badgeTexteIOS}>{badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

// ── Android : le bandeau bleu ────────────────────────────────────────────────

function EnTeteAndroid({ titre, retour = true, recherche, bouton, segments, children }: ProprietesEnTete) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sombre = useSombre();
  const toujours = !!recherche?.toujours;
  const [rechercheOuverte, setRechercheOuverte] = useState(toujours);

  // Bandeau bleu jusqu'en haut : barre d'état blanche tant que la page a le
  // focus, puis retour au style ordinaire — qui suit l'apparence du système
  const styleParDefaut = useStyleBarreParDefaut();
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle(styleParDefaut);
  }, [styleParDefaut]));

  const basculerRecherche = () => {
    if (rechercheOuverte) recherche?.onChange("");
    setRechercheOuverte(v => !v);
  };

  // Le titre est CENTRÉ entre les deux boutons : pour qu'il le soit
  // optiquement, les deux flancs doivent peser pareil, même quand l'un est
  // vide. On mesure le plus large et on impose sa largeur aux deux.
  const nbActions = (recherche && !toujours ? 1 : 0) + (bouton ? 1 : 0);
  const largeurFlanc = Math.max(retour ? 40 : 0, nbActions * 40 + Math.max(0, nbActions - 1) * 8);

  return (
    <View>
      {/* ── Le bandeau bleu : du haut de l'écran jusque sous le titre ── */}
      <View style={[s.bandeau, { paddingTop: insets.top + 8 }]}>
        {/* La matière du bandeau — la même que le hero de l'accueil */}
        <LinearGradient colors={[...(sombre ? DEGRADE_HERO.sombre : DEGRADE_HERO.clair)]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          pointerEvents="none" style={StyleSheet.absoluteFill} />
        {/* La lumière du bandeau — un dégradé en diagonale, qui s'éteint de
            lui-même au lieu de se couper sur la bordure */}
        <LinearGradient
          colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]}
          locations={[0, 0.45, 1]}
          // Coordonnées toutes dans [0,1] : un départ hors du cadre (y négatif)
          // n'est pas interprété pareil par CAGradientLayer et par le shader
          // d'Android — le bandeau y perdait sa parité entre les deux
          start={{ x: 1, y: 0 }} end={{ x: 0.15, y: 1 }}
          pointerEvents="none" style={StyleSheet.absoluteFill} />

      {/* Une seule rangée : retour à gauche, TITRE au centre, actions à droite */}
      <View style={s.commandes}>
        <View style={[s.flanc, { width: largeurFlanc }]}>
          {retour ? (
            // Depuis un onglet ouvert directement, il n'y a pas d'historique :
            // le retour ramène alors à l'accueil plutôt que de ne rien faire
            <BoutonVerre onPress={() => (router.canGoBack() ? router.back() : router.navigate("/" as any))}
              taille={40} accessibilityLabel="Retour">
              <Icone sf="chevron.left" materiel="arrow_back" taille={17} couleur={T.encreHero} poids="semibold" />
            </BoutonVerre>
          ) : null}
        </View>

        {/* Le titre se réduit jusqu'à 62 % pour tenir entre les deux flancs —
            « Opportunités d'investissement » passe sans rogner ni revenir à
            la ligne */}
        <Text style={s.titre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}
          maxFontSizeMultiplier={ECHELLE.chiffre} accessibilityRole="header">
          {titre}
        </Text>

        <View style={[s.flanc, s.flancDroit, { width: largeurFlanc }]}>
          {recherche && !toujours && (
            <BoutonVerre onPress={basculerRecherche} taille={40}
              accessibilityLabel={rechercheOuverte ? "Fermer la recherche" : "Rechercher"}>
              <Icone sf={rechercheOuverte ? "xmark" : "magnifyingglass"}
                materiel={rechercheOuverte ? "close" : "search"} taille={17} couleur={T.encreHero} poids="semibold" />
            </BoutonVerre>
          )}
          {bouton && (
            <View>
              <BoutonVerre onPress={bouton.onPress} taille={40} accessibilityLabel="Filtres">
                <Icone sf="line.3.horizontal.decrease" materiel={bouton.icone} taille={17} couleur={T.encreHero} poids="semibold" />
              </BoutonVerre>
              {bouton.badge ? (
                <View style={s.badge}><Text style={s.badgeTexte}>{bouton.badge}</Text></View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* Champ de recherche à la demande */}
      {recherche && rechercheOuverte && (
        <View style={s.champ}>
          <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
          <TextInput
            value={recherche.valeur} onChangeText={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"}
            placeholderTextColor={T.grisClair as any}
            autoFocus={!toujours} autoCorrect={false} clearButtonMode="while-editing"
            style={s.champTexte} />
        </View>
      )}

      </View>

      {/* Segments clairs à compteurs — la page a repris son fond clair */}
      {segments && (
        <View style={[s.segments, s.sousBandeau]}>
          {segments.options.map(o => {
            const actif = segments.valeur === o.cle;
            return (
              <Tapable key={o.cle} onPress={() => { tick(); segments.onChange(o.cle); }} echelle={0.97}
                surbrillance={false} style={[s.segment, actif && s.segmentActif]}>
                <Text style={[s.segmentTexte, actif && s.segmentTexteActif]} numberOfLines={1}>{o.label}</Text>
                {o.compte != null && (
                  <View style={[s.compte, actif && s.compteActif]}>
                    <Text style={[s.compteTexte, actif && s.compteTexteActif]}>{o.compte}</Text>
                  </View>
                )}
              </Tapable>
            );
          })}
        </View>
      )}

      {children ? <View style={s.sousBandeau}>{children}</View> : null}
    </View>
  );
}

const s = creerStyles(() => ({
  // iOS : le champ de recherche et les segments sous la barre, aux marges du système
  rechercheIOS: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  segmentsIOS: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  sousBarreIOS: { paddingHorizontal: 16, paddingBottom: 8 },
  boutonsBarre: { flexDirection: "row", alignItems: "center" },
  boutonBarre: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  // Le compte posé sur l'épaule du symbole, détouré de la couleur de la barre
  badgeIOS: {
    position: "absolute", top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3.5,
    backgroundColor: T.rouge, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: T.fond,
  },
  badgeTexteIOS: { fontSize: 9.5, lineHeight: 12, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },

  // Mêmes coins bas que le bandeau de l'accueil : 18 pt, franc mais posé
  bandeau: {
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: T.heroFond, overflow: "hidden",
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderCurve: "continuous",
  },
  sousBandeau: { marginHorizontal: 20 },
  commandes: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Les deux flancs pèsent la même largeur : le titre tombe au centre optique
  flanc: { flexDirection: "row", alignItems: "center", gap: 8 },
  flancDroit: { justifyContent: "flex-end" },
  badge: {
    position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: T.rouge, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeTexte: { fontSize: 10, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },
  // Titre de navigation : centré entre les boutons, il s'ajuste à la place
  titre: {
    flex: 1, minWidth: 0, textAlign: "center",
    fontSize: 22, lineHeight: 28, fontFamily: POLICE.gras, color: "#fff",
    letterSpacing: -0.5,
  },
  champ: {
    flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12,
    backgroundColor: T.carte, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 999, paddingHorizontal: 15, height: 40,
  },
  champTexte: { flex: 1, fontSize: 14.5, fontFamily: POLICE.moyen, color: T.encre },
  segments: {
    flexDirection: "row", marginTop: 12, padding: 3.5, gap: 4,
    backgroundColor: T.voile, borderRadius: 999,
  },
  segment: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8.5, borderRadius: 999,
  },
  segmentActif: {
    backgroundColor: T.carte,
    shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris },
  segmentTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
  compte: { backgroundColor: T.voile, borderRadius: 999, minWidth: 21, paddingHorizontal: 6, paddingVertical: 1.5, alignItems: "center" },
  compteActif: { backgroundColor: T.bleuVoile },
  compteTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, fontVariant: ["tabular-nums"] },
  compteTexteActif: { color: T.bleu },
}));
