// La pile de l'onglet Accueil — l'accueil et tous les modules qu'il ouvre
// (prospects, entreprises, zones, opportunités, accords, événements, fiche
// pays, lois, recherche ; sur iOS, aussi les Investissements privés et les
// Échanges commerciaux). Ils s'empilent DANS l'onglet : la barre d'onglets
// reste visible, chacun a son retour, et retoucher « Accueil » ramène à la
// racine.
import { Stack } from "expo-router";
import { titreListeFdi } from "@/lib/fdi";
import { ecran, useOptionsPile } from "@/lib/navigation";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";

export default function PileAccueil() {
  return (
    <Stack screenOptions={useOptionsPile()}>
      {/* L'accueil a son propre en-tête, façon « Aujourd'hui » */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* iOS : les deux modules d'onglet ouverts depuis l'accueil s'empilent
          ici, avec leur retour (voir lib/navigation, routeDepuisAccueil) */}
      <Stack.Screen name="ide" options={ecran("Investissements")} />
      <Stack.Screen name="economie" options={ecran("Économie")} />
      {/* Le titre est celui de la section qui ouvre la liste (« Investissements
          annoncés »…), dès l'ouverture */}
      <Stack.Screen name="projetes"
        options={({ route }) => ecran(titreListeFdi((route.params as { vue?: string } | undefined)?.vue))} />
      <Stack.Screen name="prospects" options={ecran("Prospects")} />
      <Stack.Screen name="entreprises" options={ecran("Entreprises installées")} />
      <Stack.Screen name="zones" options={ecran("Zones d'investissement")} />
      <Stack.Screen name="opportunites" options={ecran("Opportunités")} />
      <Stack.Screen name="accords" options={ecran("Accords & Traités")} />
      <Stack.Screen name="evenements" options={ecran("Événements")} />
      <Stack.Screen name="fiche-pays/index" options={ecran("Fiche Pays")} />
      <Stack.Screen name="code/index" options={ecran("Lois & Règlementations")} />
      {/* Le chapitre pose son propre titre (voir l'écran) */}
      <Stack.Screen name="code/[chapitre]" options={ecran("")} />
      {/* iOS : la recherche s'empile, avec son retour ; Android : en modale */}
      <Stack.Screen name="recherche" options={IOS
        ? ecran("Recherche")
        : { headerShown: true, title: "Recherche", presentation: "modal", headerStyle: { backgroundColor: T.carte as unknown as string },
            headerTintColor: T.encre as unknown as string, headerTitleStyle: { fontFamily: POLICE.gras, color: T.encre as unknown as string } }} />
    </Stack>
  );
}
