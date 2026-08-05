// En-tête de page — le gabarit de l'accueil : un BANDEAU BLEU qui part du
// haut de l'écran (barre d'état comprise) et englobe les commandes et le
// titre ; la page reprend en clair juste dessous.
//
//   ┌ bandeau bleu ─────────────────────────────────────┐
//   │ [← retour]                  [🔍 recherche] [≡ …]  │
//   │ Titre en grand                                    │
//   │ (champ de recherche, s'il est ouvert)             │
//   └───────────────────────────────────────────────────┘
//   [segments à compteurs]
//
// Les boutons sont en verre dépoli (BoutonVerre). La recherche ne monopolise
// plus une barre : la loupe ouvre le champ à la demande, la croix le referme.
// La barre d'état passe en blanc tant que la page a le focus — le bandeau est
// bleu jusqu'en haut.
import { useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone from "@/components/Icone";
import { BoutonVerre, Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

export type SegmentOption = { cle: string; label: string; compte?: number };

export default function EnTetePage({ titre, retour = true, recherche, bouton, segments, children }: {
  titre: string;
  retour?: boolean;
  recherche?: { valeur: string; onChange: (v: string) => void; placeholder?: string };
  bouton?: { icone: string; onPress: () => void; badge?: number };
  segments?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void };
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  // Bandeau bleu jusqu'en haut : barre d'état blanche tant que la page a le focus
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle("dark");
  }, []));

  const basculerRecherche = () => {
    if (rechercheOuverte) recherche?.onChange("");
    setRechercheOuverte(v => !v);
  };

  return (
    <View>
      {/* ── Le bandeau bleu : du haut de l'écran jusque sous le titre ── */}
      <View style={[s.bandeau, { paddingTop: insets.top + 8 }]}>
        {/* Halo discret, l'écho de l'accueil */}
        <View style={s.halo} />
      {/* Rangée de commandes : retour à gauche, actions à droite */}
      <View style={s.commandes}>
        {retour ? (
          // Depuis un onglet ouvert directement, il n'y a pas d'historique :
          // le retour ramène alors à l'accueil plutôt que de ne rien faire
          <BoutonVerre onPress={() => (router.canGoBack() ? router.back() : router.navigate("/" as any))}
            taille={40} accessibilityLabel="Retour">
            <Icone sf="chevron.left" materiel="arrow_back" taille={17} couleur={T.bleu} poids="semibold" />
          </BoutonVerre>
        ) : <View />}
        <View style={s.actions}>
          {recherche && (
            <BoutonVerre onPress={basculerRecherche} taille={40}
              accessibilityLabel={rechercheOuverte ? "Fermer la recherche" : "Rechercher"}>
              <Icone sf={rechercheOuverte ? "xmark" : "magnifyingglass"}
                materiel={rechercheOuverte ? "close" : "search"} taille={17} couleur={T.bleu} poids="semibold" />
            </BoutonVerre>
          )}
          {bouton && (
            <View>
              <BoutonVerre onPress={bouton.onPress} taille={40} accessibilityLabel="Filtres">
                <Icone sf="line.3.horizontal.decrease" materiel={bouton.icone} taille={17} couleur={T.bleu} poids="semibold" />
              </BoutonVerre>
              {bouton.badge ? (
                <View style={s.badge}><Text style={s.badgeTexte}>{bouton.badge}</Text></View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* Le titre en grand, comme l'accueil */}
      <Text style={s.titre} numberOfLines={1} adjustsFontSizeToFit>{titre}</Text>

      {/* Champ de recherche à la demande */}
      {recherche && rechercheOuverte && (
        <View style={s.champ}>
          <Icone sf="magnifyingglass" materiel="search" taille={15} couleur={T.gris} />
          <TextInput
            value={recherche.valeur} onChangeText={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher"}
            placeholderTextColor={T.grisClair as any}
            autoFocus autoCorrect={false} clearButtonMode="while-editing"
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

const s = StyleSheet.create({
  bandeau: {
    paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: T.heroFond, overflow: "hidden",
  },
  halo: {
    position: "absolute", top: -150, right: -100, width: 300, height: 300,
    borderRadius: 150, backgroundColor: "rgba(255,255,255,0.06)",
  },
  sousBandeau: { marginHorizontal: 20 },
  commandes: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: T.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeTexte: { fontSize: 10, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },
  titre: {
    fontSize: 28, lineHeight: 34, fontFamily: POLICE.gras, color: "#fff",
    letterSpacing: -0.7, marginTop: 12,
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
});
