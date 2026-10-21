// La pile de l'onglet Accueil — l'accueil et les modules qu'il ouvre
// (prospects, entreprises, zones, opportunités, accords, événements, fiche
// pays, lois). Ils s'empilent DANS l'onglet : la barre d'onglets reste
// visible, chacun a son retour, et retoucher « Accueil » ramène à la racine.
// Les Investissements privés et les Échanges commerciaux ont leur onglet :
// l'Accueil y bascule (lib/navigation, ouvrirModule). La recherche a le sien.
import { Stack } from "expo-router";
import { ecran, useOptionsPile } from "@/lib/navigation";

export default function PileAccueil() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      {/* L'accueil a son propre en-tête, façon « Aujourd'hui » */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="prospects" options={ecran("Prospects")} />
      <Stack.Screen name="entreprises" options={ecran("Entreprises installées")} />
      <Stack.Screen name="zones" options={ecran("Zones d'investissement")} />
      <Stack.Screen name="opportunites" options={ecran("Opportunités")} />
      <Stack.Screen name="accords" options={ecran("Accords & Traités")} />
      <Stack.Screen name="evenements" options={ecran("Événements")} />
      <Stack.Screen name="fiche-pays/index" options={ecran("Fiche Pays")} />
      <Stack.Screen name="code/index" options={ecran("Lois & Règlementations")} />
    </Stack>
  );
}
