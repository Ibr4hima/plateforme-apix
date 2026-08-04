// Investissements privés — repensé sur la grammaire des Échanges
// commerciaux : le bandeau bleu d'EnTetePage, deux familles en chips bleues
// (Investissements Directs Étrangers · Investissements nationaux), puis des
// SECTIONS vedettes empilées.
//
// L'onglet IDE se lit en trois sections — Flux & Stocks, Greenfield,
// Fusion & Acquisition — chacune une carte vedette à curseur d'années.
// L'analyse comparative a quitté l'app : un pays, une lecture au pouce.
import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useRef } from "react";
import EnTetePage from "@/components/EnTetePage";
import IdeFluxStocksPanel from "@/components/IdeFluxStocksPanel";
import NationalPanel from "@/components/NationalPanel";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";
import { useMargeBas } from "@/lib/marges";

// Les deux familles — chips bleues, la teinte unique du module
const ONGLETS = [
  { cle: "ide",       label: "Investissements Directs Étrangers", couleur: "#004f91" },
  { cle: "nationaux", label: "Investissements nationaux",         couleur: "#004f91" },
] as const;

export default function IdeEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const [onglet, setOnglet] = useState("ide");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [nbFiltresNat, setNbFiltresNat] = useState(0);
  const ongletsRef = useRef<ScrollView>(null);
  const ongletsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  // Le bouton filtres ne sert que les Investissements nationaux
  const boutonHero = onglet === "nationaux"
    ? { icone: "filter_list", onPress: () => { tick(); setFiltresOuverts(true); }, badge: nbFiltresNat || undefined }
    : undefined;

  return (
    <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }}>
      <EnTetePage titre="Investissements privés" bouton={boutonHero} />

      {/* Les deux familles en chips */}
      <ScrollView ref={ongletsRef} horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={s.ongletsRangee}>
        {ONGLETS.map(o => {
          const actif = onglet === o.cle;
          return (
            <Pressable key={o.cle}
              onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; ongletsPos.current[o.cle] = { x, largeur: la }; }}
              onPress={() => {
                tick();
                setOnglet(o.cle);
                const p = ongletsPos.current[o.cle];
                if (p) ongletsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
              }}
              style={[s.chipLentille, actif && { backgroundColor: `${o.couleur}14`, borderColor: `${o.couleur}66` }]}>
              <Text style={[s.chipLentilleTexte, { color: o.couleur }, actif && { fontFamily: POLICE.gras }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {onglet === "nationaux" ? (
        <NationalPanel
          filtresOuverts={filtresOuverts && onglet === "nationaux"}
          onFermerFiltres={() => setFiltresOuverts(false)}
          onOuvrirFiltres={() => setFiltresOuverts(true)}
          onNbFiltres={setNbFiltresNat} />
      ) : (
        <>
          {/* ── Section 1 : Flux & Stocks ── */}
          <IdeFluxStocksPanel />

          {/* Les sections Greenfield et Fusion & Acquisition arrivent ici */}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ongletsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipLentille: {
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipLentilleTexte: { fontSize: 12.5, fontFamily: POLICE.demi },
});
