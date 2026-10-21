// Investissements privés — repensé sur la grammaire des Échanges
// commerciaux : le bandeau bleu d'EnTetePage, trois familles en chips bleues
// (Investissements Directs Étrangers · Investissements projetés ·
// Investissements nationaux), puis des SECTIONS vedettes empilées.
//
// L'onglet IDE se lit en trois sections — Flux & Stocks, Greenfield,
// Fusion & Acquisition — chacune une carte vedette à curseur d'années.
// L'analyse comparative a quitté l'app : un pays, une lecture au pouce.
//
// LES INVESTISSEMENTS PROJETÉS ONT LEUR PROPRE ONGLET, au même rang que les
// deux autres. L'IDE dit ce que la CNUCED mesure — l'argent ENTRÉ ; les
// projetés, ce que fDi Markets relève — les projets ANNONCÉS et les
// intentions. Les deux ne se contredisent pas : ils regardent deux moments de
// la même décision. L'onglet est un tableau de bord en trois sections, qui
// mène aux listes et aux fiches (components/fdi/TableauProjetes).
import { useScrollToTop } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView } from "react-native";
import EnTetePage from "@/components/EnTetePage";
import { ChipFiltre } from "@/components/ui";
import { tick } from "@/lib/haptique";
import IdeFluxStocksPanel from "@/components/IdeFluxStocksPanel";
import IdeFusionPanel from "@/components/IdeFusionPanel";
import IdeGreenfieldPanel from "@/components/IdeGreenfieldPanel";
import NationalPanel from "@/components/NationalPanel";
import DestinationSheet from "@/components/fdi/DestinationSheet";
import TableauProjetes from "@/components/fdi/TableauProjetes";
import SourceIdeSheet from "@/components/SourceIdeSheet";
import SourceNationalSheet, { SelNational } from "@/components/SourceNationalSheet";
import { getJson } from "@/lib/api";
import type { SourceIde } from "@/lib/ideSource";
import { CLE_DESTINATIONS, PAYS_REFERENCE, chargerDestinations } from "@/lib/fdi";
import { T } from "@/theme";
import { useCap, useMargeBas } from "@/lib/marges";
import { creerStyles } from "@/lib/apparence";

// Les trois familles — chips bleues, la teinte unique du module
const ONGLETS = [
  { cle: "ide",       label: "Investissements Directs Étrangers", couleur: "bleu" },
  { cle: "projetes",  label: "Investissements projetés",          couleur: "bleu" },
  { cle: "nationaux", label: "Investissements nationaux",         couleur: "bleu" },
] as const;

export default function IdeEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const cap = useCap();
  const [onglet, setOnglet] = useState("ide");
  const [sourceOuverte, setSourceOuverte] = useState(false);
  // Le pays lu par les Investissements projetés — le Sénégal par défaut
  const [paysFdi, setPaysFdi] = useState(PAYS_REFERENCE);
  const projetes = onglet === "projetes";
  // Les pays proposés : ceux dont le relevé fDi est complet. La liste n'est
  // demandée qu'une fois l'onglet ouvert
  const { data: destinations } = useQuery({
    queryKey: CLE_DESTINATIONS, queryFn: chargerDestinations, staleTime: 30 * 60 * 1000, enabled: projetes,
  });
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
    {/* L'en-tête est ANCRÉ hors du défilement : le retour et le sélecteur de
        vue restent sous le pouce, même au bas d'une page de trois sections.
        AUCUNE VUE AUTOUR DE LA LISTE : retoucher l'onglet remonte, sur iOS,
        la liste que le système trouve en suivant le premier enfant de
        l'écran — elle doit être là, comme sur l'Accueil. */}
      <EnTetePage titre="Investissements privés" titreCourt="Investissements" bouton={boutonHero} />
      <ScrollView ref={defilement} style={{ flex: 1, backgroundColor: T.fond }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[{ paddingBottom: margeBas }, cap]}>

      {/* Les trois familles en chips */}
      <ScrollView ref={ongletsRef} horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }} contentContainerStyle={s.ongletsRangee}>
        {ONGLETS.map(o => {
          const actif = onglet === o.cle;
          return (
            <ChipFiltre key={o.cle} label={o.label} actif={actif}
              onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; ongletsPos.current[o.cle] = { x, largeur: la }; }}
              onPress={() => {
                setOnglet(o.cle);
                const p = ongletsPos.current[o.cle];
                if (p) ongletsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
              }} />
          );
        })}
      </ScrollView>

      {onglet === "nationaux" ? (
        <NationalPanel sel={selNat} onOuvrirSource={() => setSourceOuverte(true)} />
      ) : projetes ? (
        <TableauProjetes pays={paysFdi} onChoisirPays={() => setSourceOuverte(true)} />
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
    ) : projetes ? (
      // Au tableau de bord, la maille est le PAYS : les trois questions —
      // ce qu'il reçoit, qui le vise, qui y est venu — se posent à un pays
      <DestinationSheet pays={destinations?.pays ?? []} regionsPermises={false}
        valeur={{ echelle: "pays", pays: paysFdi, region: null }}
        onChoisir={d => setPaysFdi(d.pays)} onClose={() => setSourceOuverte(false)} />
    ) : (
      <SourceIdeSheet pays={paysListe} groupements={groupements || []} secteurs={secteurs || []}
        source={source} onChoisir={setSource} onClose={() => setSourceOuverte(false)} />
    ))}
    </>
  );
}

const s = creerStyles(() => ({
  ongletsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
}));
