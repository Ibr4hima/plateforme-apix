// La pile de l'onglet Recherche — la recherche dans toute la plateforme
// (pays, accords, événements, entreprises, zones). Sur iOS, la barre du
// système porte le titre ; sur Android, l'écran dessine son bandeau bleu.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileRecherche() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Recherche")} />
    </Stack>
  );
}
