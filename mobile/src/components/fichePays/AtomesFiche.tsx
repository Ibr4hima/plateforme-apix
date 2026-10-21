// Les briques de la Fiche Pays — le bandeau des rubriques, la ligne « Afficher
// la suite », et ce que les sections se passent (le pays, la part).
//
// LA FICHE SE DÉCOUPE COMME CELLE DU SITE (frontend/src/app/fiche-pays) :
// trois grandes sections, chacune sous son étiquette — celle des sections des
// Investissements privés (SeparateurSection) —, et dans chacune des
// RUBRIQUES : l'icône dans son carré voilé, le titre en capitales bleues, le
// compte dans sa pastille, un filet jusqu'au bord. Toute la page se lit de
// la même façon, de l'IDE aux signaux.
import { Pressable, StyleSheet, Text, View } from "react-native";
import Icone, { type NomsIcone } from "@/components/Icone";
import { creerStyles } from "@/lib/apparence";
import { ECHELLE, POLICE, T } from "@/theme";

/** Un pays de la fiche : ce que la liste de la plateforme en dit. */
export type PaysFiche = {
  id: number; nom: string; code_iso3: string; code_iso2?: string | null;
  continent?: string | null; region_geo?: string | null;
};

/** Une part, à une décimale : « 33,5 % ». */
export const pct1 = (v: number): string =>
  `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** Le bandeau d'une rubrique. Le site écrit un résumé à droite du titre ; un
    téléphone s'en passe — le compte suffit, le détail est dessous. */
export function Rubrique({ sf, materiel, titre, compte }: NomsIcone & { titre: string; compte?: number }) {
  return (
    <View style={s.rubrique} accessibilityRole="header">
      <View style={s.icone}>
        <Icone sf={sf} materiel={materiel} taille={12.5} couleur={T.bleu} poids="semibold" />
      </View>
      <Text style={s.titre} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{titre.toUpperCase()}</Text>
      {/* Le compte : la pastille des listes des Investissements projetés —
          blanche, le nombre en bleu */}
      {compte != null ? (
        <View style={s.compte}>
          <Text style={s.compteTexte} maxFontSizeMultiplier={ECHELLE.compact}>{compte.toLocaleString("fr-FR")}</Text>
        </View>
      ) : null}
      <View style={s.filet} />
    </View>
  );
}

/** La dernière ligne d'un groupe qu'on ne montre pas en entier : « Afficher
    les 12 autres », puis « Réduire ». */
export function Suite({ reste, tout, onPress }: { reste: number; tout: boolean; onPress: () => void }) {
  if (reste <= 0) return null;
  const texte = tout ? "Réduire" : reste > 1 ? `Afficher les ${reste} autres` : "Afficher le dernier";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: tout }}
      style={({ pressed }) => [s.suite, pressed && s.enfoncee]}>
      <View style={s.suiteFilet} />
      <Text style={s.suiteTexte} maxFontSizeMultiplier={ECHELLE.texte}>{texte}</Text>
      <Icone sf={tout ? "chevron.up" : "chevron.down"} materiel={tout ? "expand_less" : "expand_more"}
        taille={12} couleur={T.bleu} poids="semibold" />
    </Pressable>
  );
}

const s = creerStyles(() => ({
  rubrique: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  icone: {
    width: 24, height: 24, borderRadius: 7, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center", backgroundColor: T.bleuVoile,
  },
  titre: { flexShrink: 1, fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  compte: {
    backgroundColor: T.carte, borderRadius: 999, borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
    paddingHorizontal: 8, paddingVertical: 2,
    shadowColor: "#0B1220", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  compteTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  filet: { flex: 1, minWidth: 16, height: StyleSheet.hairlineWidth, backgroundColor: T.voileFort, marginLeft: 3 },

  suite: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  suiteFilet: { position: "absolute", top: 0, left: 16, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: T.voileFort },
  suiteTexte: { fontSize: 14.5, fontFamily: POLICE.moyen, color: T.bleu },
  enfoncee: { backgroundColor: T.voileFort },
}));
