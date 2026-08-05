// Zones d'investissement — le territoire d'abord.
//
// Deux lectures du même sujet, en segments : les ZONES (le catalogue — cartes
// au gabarit de la plateforme, une rangée Localisation | Superficie |
// Entreprises sous filet) et les PÔLES TERRITOIRES — le même gabarit que la
// vue régionale des Entreprises : la silhouette unie des régions du pôle en
// tuile pastel, la forme réelle du territoire à la place d'un chiffre.
//
// Les compteurs vivent dans les commandes (segments et chips de type), pas en
// ligne de texte : chercher « mbour » montre immédiatement dans quel type de
// zone les résultats se trouvent.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, ChipFiltre, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import EnTetePage from "@/components/EnTetePage";
import { SilhouettePole } from "@/components/SilhouetteRegion";
import PoleSheet, { splitLocalisation } from "@/components/PoleSheet";
import ZoneSheet from "@/components/ZoneSheet";
import { getJson } from "@/lib/api";
import { POLE_COULEURS, foncerPastel, normPole } from "@/lib/couleurs";
import { ZONE_TYPE_META, ZONE_TYPE_ORDER } from "@/lib/zoneTypes";
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
        {z.pole_nom ? <Text style={s.sousTitre} numberOfLines={1}>{z.pole_nom}</Text> : null}
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

  const pret = !isLoading && !isError;
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  const segments = [
    { cle: "zones",      label: "Zones d'investissement", compte: pret ? communes.length : undefined },
    { cle: "territoire", label: "Pôles territoires",      compte: pret && poles ? polesFiltres.length : undefined },
  ];

  // L'en-tête est ancré hors du défilement ; les chips suivent le contenu
  const entete = (
    <EnTetePage titre="Zones d'investissement"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: segments, valeur: vue, onChange: setVue }} />
  );

  const hero = (
    <>

      {vue === "zones" && (
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
          {ZONE_TYPE_ORDER.map(t => {
            const actif = type === t;
            // Chips au bleu de la maison — la teinte du type vit dans les cartes
            return (
              <ChipFiltre key={t} label={ZONE_TYPE_META[t].label} actif={actif}
                compte={pret ? parType[t] : null}
                onLayout={ev => { const { x, width: l } = ev.nativeEvent.layout; chipsPos.current[t] = { x, largeur: l }; }}
                onPress={() => {
                  setType(t);
                  // Centre la chip choisie : les voisines restent visibles des deux côtés
                  const p = chipsPos.current[t];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }} />
            );
          })}
        </ScrollView>
      )}
    </>
  );

  const vide = isLoading ? <SqueletteListe />
    : isError ? <EtatErreur onRetry={() => refetch()} />
    : <EtatVide texte={vue === "zones" ? "Aucune zone ne correspond." : "Aucun pôle ne correspond."} />;

  return (
    // L'en-tête est ancré hors du défilement
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {entete}
      {vue === "zones" ? (
        <ListeRapide
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
          style={{ backgroundColor: T.fond }}
          data={isLoading || isError ? [] : polesFiltres}
          keyExtractor={(p: any) => String(p.id)}
          renderItem={({ item: p, index }: any) => {
            const pastel = pastelPole(p.pole_territoire);
            const regions = splitLocalisation(p.localisation);
            const nbZones = (zones || []).filter((z: any) => z.pole_id === p.id).length;
            return (
              <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
                <Tapable onPress={() => setPoleSelec(p)} echelle={0.985} style={[s.carte, s.pole]}>
                  {/* La forme unie du pôle dans sa couleur, tuile assortie en
                      très clair — le même gabarit que la vue régionale des
                      Entreprises */}
                  <View style={[s.poleTuile, { backgroundColor: `${pastel}33` }]}>
                    <SilhouettePole noms={regions} taille={38} couleur={foncerPastel(pastel)} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.poleNom} numberOfLines={1}>{p.pole_territoire}</Text>
                    <Text style={s.poleSous} numberOfLines={1}>
                      {[`${nbZones} zone${nbZones > 1 ? "s" : ""}`, regions.join(", ")].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={T.grisClair} />
                </Tapable>
              </Apparition>
            );
          }}
          contentContainerStyle={{ paddingBottom: margeBas }}
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          refreshing={isRefetching} onRefresh={refetch}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={hero}
          ListEmptyComponent={vide}
        />
      )}
      {zoneSelec && <ZoneSheet zone={zoneSelec} onClose={() => setZoneSelec(null)} />}
      {poleSelec && <PoleSheet pole={poleSelec} zones={zones || []} onClose={() => setPoleSelec(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },

  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  faits: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 12 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

  pole: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 13, paddingVertical: 11 },
  poleTuile: { width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  poleNom: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2 },
  poleSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
});
