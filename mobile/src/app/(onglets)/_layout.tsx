// Barre d'onglets native — Accueil · Investissements privés · Flux
// commerciaux. L'onglet actif est posé sur un beau cadre bleu voilé
// arrondi (icône + libellé), les autres restent en gris discret.
import { Tabs, usePathname } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Symbole from "@/components/Symbole";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

// Hauteur du contenu de la barre (cadre + libellé), hors marge système. La
// hauteur totale s'obtient en y ajoutant l'inset du bas : react-navigation
// applique `paddingBottom: insets.bottom` au conteneur, mais notre
// `tabBarStyle` passe APRÈS le style par défaut et en écrasait la hauteur.
// Figée à 88, la barre gardait la même taille avec ou sans indicateur
// d'accueil : trop haute sur iPhone SE et sur Android à navigation par
// boutons, trop serrée là où l'indicateur mange 34 pt.
const HAUTEUR_CONTENU = 60;

const ONGLETS = [
  { nom: "index",           chemin: "/",                titre: "Accueil",                icone: "home" },
  { nom: "investissements", chemin: "/investissements", titre: "Investissements privés", icone: "finance_mode" },
  { nom: "flux",            chemin: "/flux",            titre: "Flux commerciaux",       icone: "currency_exchange" },
] as const;

// Bouton d'onglet maison : cadre arrondi autour de l'icône ET du libellé.
// Un tabBarButton personnalisé remplace celui de react-navigation, qui
// portait le rôle et l'état de sélection : on les repose ici, sans quoi
// VoiceOver et TalkBack annoncent trois boutons anonymes au lieu d'onglets.
function BoutonOnglet({ actif, icone, titre, onPress }: {
  actif: boolean; icone: string; titre: string; onPress?: (e: any) => void;
}) {
  return (
    <Pressable onPress={e => { if (!actif) tick(); onPress?.(e); }} style={s.zone}
      accessibilityRole="tab" accessibilityLabel={titre} accessibilityState={{ selected: actif }}>
      <View style={[s.cadre, actif && s.cadreActif]}>
        <Symbole nom={icone} taille={22} couleur={actif ? T.bleu : T.gris} />
        {/* Le libellé tient sur une ligne dans un cadre de hauteur fixe :
            on borne son agrandissement pour qu'une police système très
            grande ne le rogne pas en plein milieu. */}
        <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {titre}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OngletsLayout() {
  // L'onglet actif se lit dans la route elle-même — fiable quelle que soit
  // la façon dont la barre transmet (ou non) l'état de sélection au bouton
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.carte,
          borderTopWidth: Platform.OS === "ios" ? StyleSheet.hairlineWidth : 1,
          borderTopColor: T.bordure,
          height: HAUTEUR_CONTENU + insets.bottom,
        },
        sceneStyle: { backgroundColor: T.fond },
      }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom}
          options={{
            title: o.titre,
            tabBarButton: props => (
              <BoutonOnglet
                actif={o.chemin === "/" ? chemin === "/" : chemin.startsWith(o.chemin)}
                icone={o.icone} titre={o.titre}
                onPress={props.onPress} />
            ),
          }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  // Le cadre fait ~51 pt : centré dans les 60 pt de contenu, il reste 4 pt de
  // part et d'autre. Le décalage vers le bas d'avant supposait les 88 pt figés.
  zone: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 4 },
  cadre: {
    alignItems: "center", justifyContent: "center", gap: 3,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17,
    borderWidth: 1, borderColor: "transparent", minWidth: 92,
  },
  cadreActif: {
    backgroundColor: T.bleuVoile,
    borderColor: T.blocBord,
  },
  libelle: { fontSize: 9.5, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: T.bleu, fontFamily: POLICE.gras },
});
