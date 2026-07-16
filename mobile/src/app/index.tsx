// Accueil — grille des modules, dans le langage visuel du site.
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { T } from "@/theme";

const MODULES: { titre: string; sous: string; href: string; actif: boolean }[] = [
  { titre: "Accords & Traités",   sous: "Accords internationaux",       href: "/accords", actif: true },
  { titre: "Entreprises",         sous: "Entreprises installées",       href: "/",        actif: false },
  { titre: "Événements",          sous: "Agenda économique",            href: "/",        actif: false },
  { titre: "Zones",               sous: "Zones d'investissement",       href: "/",        actif: false },
  { titre: "IDE",                 sous: "Investissements étrangers",    href: "/",        actif: false },
  { titre: "Statistiques",        sous: "Commerce & macroéconomie",     href: "/",        actif: false },
];

export default function Accueil() {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.hero}>
        <Text style={s.surtitre}>PLATEFORME DE GESTION DES INVESTISSEMENTS</Text>
        <Text style={s.titre}>Intelligence{"\n"}Investissement{"\n"}Sénégal</Text>
      </View>
      <View style={s.grille}>
        {MODULES.map(m => (
          <Link key={m.titre} href={m.href as any} asChild disabled={!m.actif}>
            <Pressable style={({ pressed }) => [s.carte, pressed && s.cartePressee, !m.actif && s.carteInactive]}>
              <Text style={s.carteTitre}>{m.titre}</Text>
              <Text style={s.carteSous}>{m.actif ? m.sous : "Bientôt"}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingBottom: 40 },
  hero: { backgroundColor: T.bleu, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30 },
  surtitre: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 },
  titre: { color: "#fff", fontSize: 30, fontWeight: "800", lineHeight: 36, letterSpacing: -0.5 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 18 },
  carte: {
    width: "47.5%", backgroundColor: T.carte, borderRadius: T.rayonCarte,
    borderWidth: 1, borderColor: T.bordure, padding: 16, minHeight: 92,
  },
  cartePressee: { transform: [{ scale: 0.98 }], borderColor: "rgba(0,79,145,0.35)" },
  carteInactive: { opacity: 0.45 },
  carteTitre: { fontSize: 14.5, fontWeight: "800", color: T.encre },
  carteSous: { fontSize: 11, color: T.gris, marginTop: 5 },
});
