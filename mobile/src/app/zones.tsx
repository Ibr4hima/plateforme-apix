// Zones d'investissement — adaptation fidèle de la page web : vues
// Zones d'investissement / Pôles territoires dans le hero, chips de type
// colorées (noms complets ZES / ZAI / ZFI), cards du site
// (nom, superficie, badge pôle pastel, rangée Localisation | Entreprises),
// pôles territoires en cards pastel (fiche pôle au tap).
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide } from "@/components/ui";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import PoleSheet, { splitLocalisation } from "@/components/PoleSheet";
import ZoneSheet from "@/components/ZoneSheet";
import { getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { ZONE_TYPE_META, ZONE_TYPE_ORDER, zoneTypeMeta } from "@/lib/zoneTypes";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const VUES = [
  { cle: "zones",      label: "Zones d'investissement" },
  { cle: "territoire", label: "Pôles territoires" },
] as const;

function CarteZone({ z, onPress }: { z: any; onPress: () => void }) {
  const tc = zoneTypeMeta(z.type_zone).color;
  const entreprises = (z.entreprises || []).length;
  const cPole = (z.pole_nom && POLE_COULEURS[normPole(z.pole_nom)]) || "#C5BFBB";
  const locStr = [z.departement_nom, z.region_nom].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.99 }], borderColor: z.pole_nom ? cPole : `${tc}55` }]}>
      <View style={s.ligneTitre}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titre} numberOfLines={2}>{z.nom_zone}</Text>
          <View style={s.sousLigne}>
            <Text style={[s.typeAcronyme, { color: tc }]}>{z.type_zone}</Text>
            {z.superficie ? <Text style={s.sousTitre}>· {Number(z.superficie).toLocaleString("fr-FR")} ha</Text> : null}
          </View>
        </View>
        {z.pole_nom && (
          <View style={[s.badge, { backgroundColor: `${cPole}40`, borderColor: `${cPole}90` }]}>
            <Text style={[s.badgeTexte, { color: foncerPastel(cPole) }]} numberOfLines={1}>{z.pole_nom}</Text>
          </View>
        )}
      </View>
      <View style={s.bas}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.basLabel}>LOCALISATION</Text>
          <Text style={[s.basVal, { color: locStr ? T.encre : T.grisClair }]} numberOfLines={1}>{locStr || "—"}</Text>
        </View>
        <View style={s.basSep} />
        <View style={{ flex: 1 }}>
          <Text style={s.basLabel}>ENTREPRISE{entreprises > 1 ? "S" : ""}</Text>
          <Text style={[s.basVal, { color: entreprises > 0 ? T.encre : T.grisClair }]}>{entreprises}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Zones() {
  const [q, setQ] = useState("");
  const [vue, setVue] = useState("zones");
  const [type, setType] = useState("ZES");
  const [zoneSelec, setZoneSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();
  useEffect(() => { defilY.setValue(0); }, [vue, defilY]);
  const [poleSelec, setPoleSelec] = useState<any>(null);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  const { data: zones, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["zones-types"], queryFn: () => getJson<any[]>("/zones-types"),
  });
  const { data: poles } = useQuery({
    queryKey: ["zones-poles"], queryFn: () => getJson<any[]>("/zones-types/poles"),
  });

  const filtres = useMemo(() => {
    let liste = (zones || []).filter((z: any) => z.type_zone === type);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((z: any) =>
        (z.nom_zone || "").toLowerCase().includes(t) ||
        (z.region_nom || "").toLowerCase().includes(t) ||
        (z.departement_nom || "").toLowerCase().includes(t) ||
        (z.pole_nom || "").toLowerCase().includes(t));
    }
    return liste;
  }, [zones, q, type]);

  const polesFiltres = useMemo(() => {
    let liste = poles || [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((p: any) =>
        (p.pole_territoire || "").toLowerCase().includes(t) ||
        (p.localisation || "").toLowerCase().includes(t));
    }
    return [...liste].sort((a: any, b: any) => (a.pole_territoire || "").localeCompare(b.pole_territoire || "", "fr"));
  }, [poles, q]);

  const hero = (
    <>
      <HeroModule titre="Zones d'investissement"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: VUES, valeur: vue, onChange: setVue }} />
      {vue === "zones" && (
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
          {ZONE_TYPE_ORDER.map(t => {
            const actif = type === t;
            const couleur = ZONE_TYPE_META[t].color;
            return (
              <Pressable key={t}
                onLayout={ev => { const { x, width } = ev.nativeEvent.layout; chipsPos.current[t] = { x, largeur: width }; }}
                onPress={() => {
                  tick();
                  setType(t);
                  // Centre la chip choisie : les voisines restent visibles des deux côtés
                  const p = chipsPos.current[t];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }}
                style={[s.chipFiltre, actif && { backgroundColor: `${couleur}14`, borderColor: `${couleur}66` }]}>
                <Text style={[s.chipFiltreTexte, { color: couleur }, actif && { fontFamily: POLICE.gras }]}>{ZONE_TYPE_META[t].label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!isLoading && !isError && (
        <Text style={s.compte}>
          {vue === "zones"
            ? `${filtres.length} zone${filtres.length > 1 ? "s" : ""}`
            : `${polesFiltres.length} pôle${polesFiltres.length > 1 ? "s" : ""} territoire${polesFiltres.length > 1 ? "s" : ""}`}
        </Text>
      )}
    </>
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? (
      <EtatErreur onRetry={() => refetch()} />
    ) : (
      <EtatVide texte={vue === "zones" ? "Aucune zone ne correspond." : "Aucun pôle ne correspond."} />
    );

  return (
    <>
      {vue === "zones" ? (
        <ListeRapide
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : filtres}
          keyExtractor={(z: any) => String(z.id)}
          renderItem={({ item, index }: any) => <Apparition index={index} style={s.rangee}><CarteZone z={item} onPress={() => setZoneSelec(item)} /></Apparition>}
          contentContainerStyle={s.liste}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      ) : (
        <ListeRapide
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : polesFiltres}
          keyExtractor={(p: any) => String(p.id)}
          renderItem={({ item: p }: any) => {
            const couleur = POLE_COULEURS[normPole(p.pole_territoire)] || "#C5BFBB";
            const nbZones = (zones || []).filter((z: any) => z.pole_id === p.id).length;
            const regions = splitLocalisation(p.localisation);
            return (
              <View style={s.rangee}>
                <Pressable onPress={() => setPoleSelec(p)}
                  style={({ pressed }) => [s.pole, pressed && { transform: [{ scale: 0.99 }], borderColor: couleur }]}>
                  <View style={[s.poleTuile, { backgroundColor: `${couleur}40`, borderColor: `${couleur}90` }]}>
                    <Text style={[s.poleCompte, { color: foncerPastel(couleur) }]}>{nbZones}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.poleNom} numberOfLines={1}>{p.pole_territoire}</Text>
                    <Text style={s.poleSous} numberOfLines={1}>
                      {regions.length ? regions.join(" · ") : `${nbZones} zone${nbZones > 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={T.grisClair} />
                </Pressable>
              </View>
            );
          }}
          contentContainerStyle={s.liste}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      )}
      <BarreHero titre="Zones d'investissement" defilY={defilY} />
      {zoneSelec && <ZoneSheet zone={zoneSelec} onClose={() => setZoneSelec(null)} />}
      {poleSelec && <PoleSheet pole={poleSelec} zones={zones || []} onClose={() => setPoleSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 11 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  carte: {
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 13,
  },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, lineHeight: 20, letterSpacing: -0.2 },
  sousLigne: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  typeAcronyme: { fontSize: 10.5, fontFamily: POLICE.gras, letterSpacing: 0.4 },
  sousTitre: { fontSize: 11, fontFamily: POLICE.moyen, color: T.gris },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3, flexShrink: 1, maxWidth: 150 },
  badgeTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  bas: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: T.filet, paddingTop: 12 },
  basSep: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  basLabel: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  basVal: { fontSize: 12.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  pole: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingVertical: 13,
  },
  poleTuile: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  poleCompte: { fontSize: 17, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  poleNom: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre },
  poleSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
});
