// Investissements privés — repensé sur la grammaire des Échanges
// commerciaux : le bandeau bleu d'EnTetePage, deux familles en chips bleues
// (Investissements Directs Étrangers · Investissements nationaux), puis des
// SECTIONS vedettes empilées.
//
// L'onglet IDE se lit en trois sections — Flux & Stocks, Greenfield,
// Fusion & Acquisition — chacune une carte vedette à curseur d'années.
// L'analyse comparative a quitté l'app : un pays, une lecture au pouce.
import { useScrollToTop } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import EnTetePage from "@/components/EnTetePage";
import IdeFluxStocksPanel from "@/components/IdeFluxStocksPanel";
import IdeFusionPanel from "@/components/IdeFusionPanel";
import IdeGreenfieldPanel from "@/components/IdeGreenfieldPanel";
import NationalPanel from "@/components/NationalPanel";
import SourceIdeSheet from "@/components/SourceIdeSheet";
import SourceNationalSheet, { SelNational } from "@/components/SourceNationalSheet";
import { getJson } from "@/lib/api";
import type { SourceIde } from "@/lib/ideSource";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";
import { useCap, useMargeBas } from "@/lib/marges";
import { useCouleur } from "@/lib/apparence";

// Les deux familles — chips bleues, la teinte unique du module
const ONGLETS = [
  { cle: "ide",       label: "Investissements Directs Étrangers", couleur: "bleu" },
  { cle: "nationaux", label: "Investissements nationaux",         couleur: "bleu" },
] as const;

export default function IdeEcran() {
  // La teinte des chips suit l'apparence : un bleu figé disparaîtrait la nuit
  const bleuChip = useCouleur(T.bleu) as string;
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const [onglet, setOnglet] = useState("ide");
  const [sourceOuverte, setSourceOuverte] = useState(false);
  const ongletsRef = useRef<ScrollView>(null);
  // Retoucher l'onglet déjà actif remonte la page en haut
  const defilement = useRef<ScrollView>(null);
  useScrollToTop(defilement);
  const ongletsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  // Les trois référentiels de la VUE : pays, zones du monde, secteurs
  const { data: paysDispo } = useQuery({
    queryKey: ["ide-pays"], queryFn: () => getJson<any[]>("/ide/cnuced/pays-disponibles"), staleTime: Infinity,
  });
  const { data: groupements } = useQuery({
    queryKey: ["ide-groupements"], queryFn: () => getJson<any[]>("/ide/monde/groupements"), staleTime: Infinity,
  });
  const { data: secteurs } = useQuery({
    queryKey: ["ide-secteurs"], queryFn: () => getJson<any[]>("/ide/secteurs"), staleTime: Infinity,
  });
  const paysListe = useMemo(() => (paysDispo || []).map((p: any, i: number) => ({
    id: i, nom: p.nom, code_iso3: p.code_iso3, continent: p.continent, region_geo: p.region_geo,
  })), [paysDispo]);

  // Le référentiel de la cascade BDEF — les Investissements nationaux
  const { data: refsBdef } = useQuery({
    queryKey: ["bdef-secteurs"], queryFn: () => getJson<any>("/bdef/secteurs"), staleTime: Infinity,
  });

  // La source de lecture — un pays par défaut, le Sénégal
  const [source, setSource] = useState<SourceIde>({ type: "pays", nom: "Sénégal" });
  // La vue des Investissements nationaux — le global des secteurs par défaut
  const [selNat, setSelNat] = useState<SelNational>({ niveau: "global", cible_id: null, libelle: "Global des secteurs" });
  // Flux & Stocks n'existe pas en vue Secteurs (règle du site)
  const secteurVue = source.type === "secteur";

  // Le bouton de l'en-tête ouvre le sélecteur de vue, dans les deux familles
  const boutonHero = { icone: "more_horiz", onPress: () => { tick(); setSourceOuverte(true); } };

  return (
    <>
    <ScrollView ref={defilement} style={{ backgroundColor: T.fond }} contentContainerStyle={[{ paddingBottom: margeBas }, cap]}>
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
              style={[s.chipLentille, actif && { backgroundColor: `${bleuChip}14`, borderColor: `${bleuChip}66` }]}>
              <Text style={[s.chipLentilleTexte, { color: bleuChip }, actif && { fontFamily: POLICE.gras }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {onglet === "nationaux" ? (
        <NationalPanel sel={selNat} onOuvrirSource={() => setSourceOuverte(true)} />
      ) : (
        <>
          {/* ── Section 1 : Flux & Stocks (pas en vue Secteurs) ── */}
          {!secteurVue && (
            <IdeFluxStocksPanel source={source} onOuvrirSource={() => setSourceOuverte(true)} />
          )}

          {/* ── Section 2 : Greenfield ── */}
          <IdeGreenfieldPanel source={source} onOuvrirSource={() => setSourceOuverte(true)} />

          {/* ── Section 3 : Fusion & Acquisition ── */}
          <IdeFusionPanel source={source} onOuvrirSource={() => setSourceOuverte(true)} />
        </>
      )}
    </ScrollView>

    {sourceOuverte && (onglet === "nationaux" ? (
      <SourceNationalSheet refs={refsBdef} sel={selNat}
        onChoisir={setSelNat} onClose={() => setSourceOuverte(false)} />
    ) : (
      <SourceIdeSheet pays={paysListe} groupements={groupements || []} secteurs={secteurs || []}
        source={source} onChoisir={setSource} onClose={() => setSourceOuverte(false)} />
    ))}
    </>
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
