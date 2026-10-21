// La pile de l'onglet Investissements — les Investissements privés, et les
// Investissements projetés qu'ouvre leur tableau de bord. Sur iOS, la barre
// de navigation du système, en titre en ligne ; sur Android, l'écran dessine
// son propre bandeau et la barre du système reste cachée.
import { Stack } from "expo-router";
import { titreListeFdi } from "@/lib/fdi";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileInvestissements() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Investissements")} />
      {/* Le titre est celui de la section qui ouvre la liste (« Investissements
          annoncés »…), dès l'ouverture */}
      <Stack.Screen name="projetes"
        options={({ route }) => ecran(titreListeFdi((route.params as { vue?: string } | undefined)?.vue))} />
    </Stack>
  );
}
