// Explorer — l'index des modules, en UNE surface épurée.
//
// Les noms complets de la plateforme (Investissements privés, Échanges
// commerciaux, Zones d'investissement…) ne tiennent pas en demi-tuiles :
// l'index devient une liste — carré bleu plein à glyphe blanc, nom complet,
// sous-titre, chevron — rangées à filets hairline dans une seule carte à
// coins continus. Simple, dense, scannable d'un pouce.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import { Apparition, Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { ESPACE, MODULES, PLUS, POLICE, T } from "@/theme";

function Surface({ items, ouvrir }: { items: readonly any[]; ouvrir: (href: string) => void }) {
  return (
    <View style={s.surface}>
      {items.map((m, i) => (
        <View key={m.cle}>
          {i > 0 && <View style={s.separateur} />}
          <Tapable onPress={() => ouvrir(m.href)} echelle={0.98} style={s.ligne}>
            <View style={s.pastille}>
              <Icone sf={m.sf} materiel={m.icone} taille={17} couleur="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titre} numberOfLines={1}>{m.titre}</Text>
              <Text style={s.sous} numberOfLines={1}>{m.sous}</Text>
            </View>
            <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
          </Tapable>
        </View>
      ))}
    </View>
  );
}

export default function Explorer() {
  const router = useRouter();
  const ouvrir = (href: string) => { tick(); router.push(href as any); };

  return (
    <View style={s.bloc}>
      <Text style={s.titreSection}>Explorer</Text>
      <Apparition index={2}>
        {/* Les modules, puis — détachées — les deux entrées transverses
            (Fiche Pays, Lois) : des documents, pas des espaces */}
        <Surface items={MODULES} ouvrir={ouvrir} />
        <View style={{ height: 12 }} />
        <Surface items={PLUS} ouvrir={ouvrir} />
      </Apparition>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: ESPACE.l, paddingHorizontal: ESPACE.m },
  // Titres de section affirmés — la hiérarchie se voit avant de se lire
  titreSection: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3, marginBottom: ESPACE.s + 2 },
  surface: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    overflow: "hidden", borderWidth: 1, borderColor: T.carteBord,
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  // Carré bleu plein, icône blanche — la couleur qui ancre chaque rangée
  pastille: {
    width: 34, height: 34, borderRadius: 10.5, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center", backgroundColor: T.bleuAction,
  },
  titre: { fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  sous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1.5 },
  separateur: { height: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginLeft: 60 },
});
