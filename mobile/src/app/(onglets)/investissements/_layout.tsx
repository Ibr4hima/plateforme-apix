// La pile de l'onglet Investissements — les Investissements privés, et les
// Investissements projetés qu'ouvre leur tableau de bord. Sur iOS, la barre
// de navigation du système, en titre en ligne ; sur Android, l'écran dessine
// son propre bandeau et la barre du système reste cachée.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileInvestissements() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      <Stack.Screen name="index" options={ecran("Investissements")} />
      <Stack.Screen name="projetes" options={ecran("Investissements projetés")} />
    </Stack>
  );
}
