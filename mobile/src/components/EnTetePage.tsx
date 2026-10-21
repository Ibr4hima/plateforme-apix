// En-tête de page — LA BARRE DU SYSTÈME, sur iOS comme sur Android.
//
// Ce composant DÉCRIT la barre au navigateur (Stack.Screen), qui la fait
// dessiner par le système : la barre de navigation d'UIKit sur iOS, la barre
// d'application de Material (Toolbar) sur Android. Le titre en ligne, centré,
// à la même taille sur tous les écrans ; le retour du système (chevron et
// balayage depuis le bord sur iOS, flèche et geste retour sur Android) ; à
// droite, à l'opposé du retour, la loupe et le bouton des filtres. Il ne
// dessine lui-même que ce qui vit SOUS la barre :
//
//   ┌ barre du système ─────────────────────────────────┐
//   │ [‹]            Titre centré          [🔍] [≡]     │
//   └───────────────────────────────────────────────────┘
//   (le champ de recherche, s'il est ouvert)
//   (les segments, puis le contenu libre de l'écran)
//
// Chaque système garde ses gestes : sur iOS les boutons s'estompent au
// toucher et la barre d'iOS 26 les pose dans sa capsule de verre ; sur
// Android ils ondulent dans leur cercle de 40 dp, l'icône Material en 24 dp —
// le bouton icône de Material 3. Le champ de recherche et les segments
// prennent la forme de leur système (ListeIOS : la capsule d'iOS 26 ou la
// barre de recherche de Material 3, la capsule de Podcasts ou les boutons
// segmentés de Material 3). Les titres restent en Google Sans.
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Reanime, { FadeIn, FadeOut } from "react-native-reanimated";
import Icone, { type NomsIcone } from "@/components/Icone";
import { ChampRecherche, SegmentsCapsule } from "@/components/ListeIOS";
import { creerStyles } from "@/lib/apparence";
import { useCap } from "@/lib/marges";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";

export type SegmentOption = { cle: string; label: string; compte?: number };

type ProprietesEnTete = {
  titre: string;
  /** Le titre de la barre quand le titre complet n'y tiendrait pas —
      « Opportunités » pour « Opportunités d'investissement ». */
  titreCourt?: string;
  /** `toujours` : le champ est là d'emblée, sans loupe — l'écran est une
      liste qu'on vient parcourir (les listes des Investissements projetés). */
  recherche?: { valeur: string; onChange: (v: string) => void; placeholder?: string; toujours?: boolean };
  bouton?: { icone: string; onPress: () => void; badge?: number };
  segments?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void };
  children?: React.ReactNode;
};

export default function EnTetePage({ titre, titreCourt, recherche, bouton, segments, children }: ProprietesEnTete) {
  const cap = useCap();
  // LA RECHERCHE NE S'AFFICHE QU'À LA DEMANDE : une loupe dans la barre, à
  // l'opposé du retour ; la toucher déplie le champ sous la barre, clavier
  // ouvert, et son X le replie en vidant la recherche. Une recherche déjà
  // saisie (retour sur l'écran) le garde ouvert.
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
        {/* Le filtre : le symbole seul au repos, un disque PLEIN quand un
            filtre est appliqué (iOS), le compte en pastille. Ce qui est filtré
            ne s'affiche pas dans la page : il se lit dans la feuille des
            filtres. */}
        {avecBouton && (
          <BoutonBarre sf={badge ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease"}
            materiel="filter_list" label={badge ? `Filtres, ${badge} actif${badge > 1 ? "s" : ""}` : "Filtres"} badge={badge}
            onPress={() => rappels.current.bouton?.()} taille={IOS && badge ? 22 : undefined} />
        )}
      </View>
    ) : undefined,
  }), [titre, titreCourt, avecRecherche, avecBouton, badge, basculerRecherche]);

  return (
    <>
      <Stack.Screen options={options} />

      {/* Toujours là : le champ seul, sous la barre, son texte d'invite
          visible ; son X l'efface */}
      {recherche && toujours && (
        <View style={[s.recherche, cap]}>
          <ChampRecherche valeur={recherche.valeur} onChange={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"} style={{ flex: 1 }} />
        </View>
      )}

      {recherche && !toujours && rechercheOuverte && (
        <Reanime.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}
          style={[s.recherche, cap]}>
          {/* Le X referme la recherche, et vide la saisie */}
          <ChampRecherche valeur={recherche.valeur} onChange={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"} autoFocus onFermer={basculerRecherche} style={{ flex: 1 }} />
        </Reanime.View>
      )}

      {/* Les segments, sous la barre — sans compteurs */}
      {segments && (
        <View style={[s.segments, cap]}>
          <SegmentsCapsule options={segments.options} valeur={segments.valeur} onChange={segments.onChange} />
        </View>
      )}

      {children ? <View style={[s.sousBarre, cap]}>{children}</View> : null}
    </>
  );
}

/** Un bouton de la barre. iOS : un SF Symbol à l'encre, centré dans un carré
    de 36 pt, qui s'estompe au toucher — sur iOS 26, la barre pose les boutons
    voisins dans une même capsule de verre. Android : le bouton icône de
    Material 3 — l'icône en 24 dp, une ondulation circulaire de 40 dp, une
    cible de 48 dp. */
function BoutonBarre({ sf, materiel, onPress, badge, label, taille }: NomsIcone & {
  onPress: () => void; badge?: number; label: string; taille?: number;
}) {
  const pastille = badge ? (
    <View style={[s.badge, !IOS && s.badgeAndroid]}><Text style={s.badgeTexte}>{badge}</Text></View>
  ) : null;
  if (IOS) return (
    <Pressable onPress={() => onPress()} hitSlop={6} accessibilityRole="button"
      accessibilityLabel={label} style={({ pressed }) => [s.boutonIOS, pressed && { opacity: 0.35 }]}>
      {/* À l'encre, comme le chevron de retour : la barre ne porte qu'une couleur */}
      <Icone sf={sf} materiel={materiel} taille={taille ?? 18} couleur={T.encre} poids="medium" />
      {pastille}
    </Pressable>
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 20 }} style={s.boutonAndroid}>
      <Icone sf={sf} materiel={materiel} taille={24} couleur={T.encre} />
      {pastille}
    </Pressable>
  );
}

const s = creerStyles(() => ({
  // Sous la barre : le champ de recherche, les segments et le contenu libre,
  // aux marges du système
  recherche: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  segments: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  sousBarre: { paddingHorizontal: 16, paddingBottom: 8 },
  boutonsBarre: { flexDirection: "row", alignItems: "center" },
  boutonIOS: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  boutonAndroid: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  // Le compte posé sur l'épaule du symbole, détouré de la couleur de la barre
  badge: {
    position: "absolute", top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3.5,
    backgroundColor: T.rouge, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: T.fond,
  },
  // Android : la pastille de Material 3 sur l'épaule de l'icône de 24 dp
  badgeAndroid: { top: 8, right: 7 },
  badgeTexte: { fontSize: 9.5, lineHeight: 12, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },
}));
