// Zones d'investissement — le territoire d'abord.
//
// Deux lectures du même sujet, en segments : les ZONES (le catalogue — cartes
// au gabarit de la plateforme, une rangée Localisation | Superficie |
// Entreprises sous filet) et les PÔLES TERRITOIRES, où la carte du Sénégal
// prend tout son sens : les 14 régions colorées par pôle, TAPPABLES — le doigt
// touche un pôle, sa fiche s'ouvre. Chaque rangée de pôle porte sa propre
// mini-carte, le pôle allumé dans le pays en grisé.
//
// Les compteurs vivent dans les commandes (segments et chips de type), pas en
// ligne de texte : chercher « mbour » montre immédiatement dans quel type de
// zone les résultats se trouvent.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import CarteSenegal from "@/components/CarteSenegal";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import PoleSheet, { splitLocalisation } from "@/components/PoleSheet";
import ZoneSheet from "@/components/ZoneSheet";
import { getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { plier } from "@/lib/senegal";
import { ZONE_TYPE_META, ZONE_TYPE_ORDER } from "@/lib/zoneTypes";
import { tick } from "@/lib/haptique";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T } from "@/theme";

const pastelPole = (nom?: string | null) =>
  (nom && POLE_COULEURS[normPole(nom)]) || "#C5BFBB";

// ── La carte de zone ─────────────────────────────────────────────────────────
// Gabarit de la plateforme : contour fin, sans ombre. Le nom mène, le pôle en
// point pastel dessous, et la rangée basse aligne les trois faits qui
// comptent : où, quelle taille, combien d'entreprises.
function CarteZone({ z, onPress }: { z: any; onPress: () => void }) {
  const entreprises = (z.entreprises || []).length;
  const locStr = [z.departement_nom, z.region_nom].filter(Boolean).join(", ");
  return (
    <Tapable onPress={onPress} echelle={0.985} style={s.carte}>
      <View style={s.carteCorps}>
        <Text style={s.titre} numberOfLines={2}>{z.nom_zone}</Text>
        {z.pole_nom ? (
          <View style={s.sousLigne}>
            <View style={[s.point, { backgroundColor: foncerPastel(pastelPole(z.pole_nom)) }]} />
            <Text style={s.sousTitre} numberOfLines={1}>{z.pole_nom}</Text>
          </View>
        ) : null}
        <View style={s.faits}>
          <View style={{ flex: 1.5, minWidth: 0 }}>
            <Text style={s.faitLabel}>LOCALISATION</Text>
            <Text style={[s.faitVal, !locStr && { color: T.grisClair }]} numberOfLines={1}>{locStr || "—"}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>SUPERFICIE</Text>
            <Text style={[s.faitVal, !z.superficie && { color: T.grisClair }]} numberOfLines={1}>
              {z.superficie ? `${Number(z.superficie).toLocaleString("fr-FR")} ha` : "—"}
            </Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>ENTREPRISE{entreprises > 1 ? "S" : ""}</Text>
            <Text style={[s.faitVal, entreprises === 0 && { color: T.grisClair }]}>{entreprises}</Text>
          </View>
        </View>
      </View>
    </Tapable>
  );
}

export default function Zones() {
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [vue, setVue] = useState("zones");
  const [type, setType] = useState("ZES");
  const [zoneSelec, setZoneSelec] = useState<any>(null);
  const [poleSelec, setPoleSelec] = useState<any>(null);
  const { defilY, onScroll } = useHeroDefilant();
  useEffect(() => { defilY.setValue(0); }, [vue, defilY]);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  const { data: zones, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["zones-types"], queryFn: () => getJson<any[]>("/zones-types"),
  });
  const { data: poles } = useQuery({
    queryKey: ["zones-poles"], queryFn: () => getJson<any[]>("/zones-types/poles"),
  });

  // Base commune : la recherche, avant le filtre de type — les compteurs des
  // chips se calculent dessus
  const communes = useMemo(() => {
    let liste = zones || [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((z: any) =>
        (z.nom_zone || "").toLowerCase().includes(t) ||
        (z.region_nom || "").toLowerCase().includes(t) ||
        (z.departement_nom || "").toLowerCase().includes(t) ||
        (z.pole_nom || "").toLowerCase().includes(t));
    }
    return liste;
  }, [zones, q]);

  const parType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of ZONE_TYPE_ORDER) m[t] = 0;
    for (const z of communes) if (m[z.type_zone] != null) m[z.type_zone]++;
    return m;
  }, [communes]);

  const filtres = useMemo(() =>
    communes.filter((z: any) => z.type_zone === type)
      .sort((a: any, b: any) => (a.nom_zone || "").localeCompare(b.nom_zone || "", "fr")),
  [communes, type]);

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

  // région (repliée) → pôle : la clé de la carte tappable et des mini-cartes
  const poleParRegion = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of poles || []) for (const r of splitLocalisation(p.localisation)) m.set(plier(r), p);
    return m;
  }, [poles]);

  const pret = !isLoading && !isError;
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;
  const largeurListe = Math.min(width, 680);
  const largeurCarte = largeurListe - 32 - 32; // rangée 16×2, carte blanche 16×2

  const segments = [
    { cle: "zones",      label: "Zones",             compte: pret ? communes.length : undefined },
    { cle: "territoire", label: "Pôles territoires", compte: pret && poles ? polesFiltres.length : undefined },
  ];

  const hero = (
    <>
      <HeroModule retour titre="Zones d'investissement"
        recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
        segments={{ options: segments, valeur: vue, onChange: setVue }} />

      {vue === "zones" && (
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
          {ZONE_TYPE_ORDER.map(t => {
            const actif = type === t;
            const couleur = ZONE_TYPE_META[t].color;
            return (
              <Pressable key={t}
                onLayout={ev => { const { x, width: l } = ev.nativeEvent.layout; chipsPos.current[t] = { x, largeur: l }; }}
                onPress={() => {
                  tick();
                  setType(t);
                  // Centre la chip choisie : les voisines restent visibles des deux côtés
                  const p = chipsPos.current[t];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }}
                style={[s.chipFiltre, actif && { backgroundColor: `${couleur}14`, borderColor: `${couleur}66` }]}>
                <Text style={[s.chipFiltreTexte, { color: couleur }, actif && { fontFamily: POLICE.gras }]}>{ZONE_TYPE_META[t].label}</Text>
                {pret && (
                  <View style={[s.chipCompte, actif && { backgroundColor: `${couleur}18` }]}>
                    <Text style={[s.chipCompteTexte, { color: couleur }]}>{parType[t]}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* La carte nationale : les 8 pôles en couleurs, chaque région tappable */}
      {vue === "territoire" && pret && (poles || []).length > 0 && (
        <View style={[s.rangee, cap, { marginTop: 14 }]}>
          <View style={s.carteMap}>
            <CarteSenegal largeur={largeurCarte}
              couleurPour={nom => {
                const p = poleParRegion.get(plier(nom));
                return p ? pastelPole(p.pole_territoire) : (T.filet as string);
              }}
              onRegion={nom => {
                const p = poleParRegion.get(plier(nom));
                if (p) { tick(); setPoleSelec(p); }
              }} />
            <Text style={s.carteLegende}>Touchez un pôle pour ouvrir sa fiche</Text>
          </View>
        </View>
      )}
    </>
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? <EtatErreur onRetry={() => refetch()} />
    : <EtatVide texte={vue === "zones" ? "Aucune zone ne correspond." : "Aucun pôle ne correspond."} />;

  return (
    <>
      {vue === "zones" ? (
        <ListeRapide
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : filtres}
          keyExtractor={(z: any) => String(z.id)}
          renderItem={({ item, index }: any) => (
            <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
              <CarteZone z={item} onPress={() => setZoneSelec(item)} />
            </Apparition>
          )}
          contentContainerStyle={{ paddingBottom: margeBas }}
          ListHeaderComponentStyle={{ marginBottom: 14 }}
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
          renderItem={({ item: p, index }: any) => {
            const pastel = pastelPole(p.pole_territoire);
            const regionsPole = new Set(splitLocalisation(p.localisation).map(plier));
            const nbZones = (zones || []).filter((z: any) => z.pole_id === p.id).length;
            const regions = splitLocalisation(p.localisation);
            return (
              <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
                <Tapable onPress={() => setPoleSelec(p)} echelle={0.985} style={[s.carte, s.pole]}>
                  {/* Le pôle allumé dans le pays : on sait immédiatement OÙ */}
                  <CarteSenegal largeur={58} epaisseur={0.8}
                    couleurPour={nom => regionsPole.has(plier(nom)) ? pastel : "rgba(16,26,46,0.05)"} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.poleNom} numberOfLines={1}>{p.pole_territoire}</Text>
                    <Text style={s.poleSous} numberOfLines={2}>
                      {regions.length ? regions.join(" · ") : "—"}
                    </Text>
                  </View>
                  <View style={s.poleDroite}>
                    <Text style={[s.poleCompte, nbZones === 0 && { color: T.grisClair }]}>{nbZones}</Text>
                    <Text style={s.poleCompteLabel}>ZONE{nbZones > 1 ? "S" : ""}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={T.grisClair} />
                </Tapable>
              </Apparition>
            );
          }}
          contentContainerStyle={{ paddingBottom: margeBas }}
          ListHeaderComponentStyle={{ marginBottom: 4 }}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      )}
      <BarreHero retour titre="Zones d'investissement" defilY={defilY} />
      {zoneSelec && <ZoneSheet zone={zoneSelec} onClose={() => setZoneSelec(null)} />}
      {poleSelec && <PoleSheet pole={poleSelec} zones={zones || []} onClose={() => setPoleSelec(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi },
  chipCompte: { backgroundColor: T.fond, borderRadius: 999, minWidth: 21, paddingHorizontal: 6, paddingVertical: 1.5, alignItems: "center" },
  chipCompteTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sousLigne: { flexDirection: "row", alignItems: "center", gap: 6 },
  point: { width: 7, height: 7, borderRadius: 4 },
  sousTitre: { flex: 1, fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  faits: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 12 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

  carteMap: { backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord, padding: 16, paddingBottom: 12 },
  carteLegende: { fontSize: 11, fontFamily: POLICE.normal, color: T.grisClair, textAlign: "center", marginTop: 10 },

  pole: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 15, paddingVertical: 12 },
  poleNom: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2 },
  poleSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2, lineHeight: 15 },
  poleDroite: { alignItems: "center", minWidth: 34 },
  poleCompte: { fontSize: 16, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  poleCompteLabel: { fontSize: 7.5, fontFamily: POLICE.gras, letterSpacing: 0.8, color: T.gris, marginTop: 1 },
});
