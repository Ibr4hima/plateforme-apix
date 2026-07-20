// Fiche Pays — tout sur un seul écran : le hero porte les deux
// emplacements (Sénégal référence + pays choisi) et la recherche.
// Sans pays choisi (ou pendant une recherche) : liste des pays par
// continent. Pays choisi : la fiche s'affiche en place ; un tap sur la
// pilule du pays (ou une recherche) ramène à la liste, et choisir un
// autre pays remplace le précédent.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EtatCharge, EtatErreur, EtatVide } from "@/components/ui";
import FichePaysContenu from "@/components/FichePaysContenu";
import HeroModule from "@/components/HeroModule";
import TexteDefilant from "@/components/TexteDefilant";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

type Pays = { id: number; nom: string; code_iso3: string; code_iso2?: string | null; continent: string; region_geo: string | null };
type Section = { continent: string; zones: { zone: string; pays: Pays[] }[]; nb: number };

export default function FichePaysIndex() {
  const [q, setQ] = useState("");
  const [selec, setSelec] = useState<Pays | null>(null);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set(["Afrique"]));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stat-pays"], queryFn: () => getJson<Pays[]>("/statistiques/pays"),
  });
  const senId = useMemo(() => (data || []).find(p => p.code_iso3 === "SEN")?.id ?? null, [data]);

  const sections: Section[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtres = (data || []).filter(p => p.code_iso3 !== "SEN" && (!t || p.nom.toLowerCase().includes(t)));
    const parCont = new Map<string, Map<string, Pays[]>>();
    for (const p of filtres) {
      const c = p.continent || "Autre", z = p.region_geo || "Autre";
      if (!parCont.has(c)) parCont.set(c, new Map());
      const zones = parCont.get(c)!;
      if (!zones.has(z)) zones.set(z, []);
      zones.get(z)!.push(p);
    }
    return Array.from(parCont.entries())
      .map(([continent, zones]) => ({
        continent,
        zones: Array.from(zones.entries())
          .map(([zone, pays]) => ({ zone, pays: pays.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) }))
          .sort((a, b) => a.zone.localeCompare(b.zone, "fr")),
        nb: Array.from(zones.values()).reduce((n, l) => n + l.length, 0),
      }))
      .sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a.continent), ib = CONT_ORDER.indexOf(b.continent);
        if (ia === -1 && ib === -1) return a.continent.localeCompare(b.continent, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
  }, [data, q]);

  const recherche = q.trim().length > 0;
  // La fiche s'affiche quand un pays est choisi ; taper une recherche ramène à la liste
  const modeFiche = !!selec && !recherche && senId !== null;

  const choisir = (p: Pays) => { setSelec(p); setQ(""); };

  const hero = (
    <HeroModule titre="Fiche Pays"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}>
      {/* Les deux emplacements de la comparaison */}
      <View style={s.slots}>
        <View style={s.slotSen}>
          <Image source={{ uri: "https://flagcdn.com/w80/sn.png" }} style={s.drapeau} />
          <Text style={s.slotSenTexte}>Sénégal</Text>
          <View style={s.slotSenRef}><Text style={s.slotSenRefTexte}>Réf.</Text></View>
        </View>
        {selec ? (
          // Le tap retire le pays et ramène à la liste
          <Pressable onPress={() => { setSelec(null); setQ(""); }} style={({ pressed }) => [s.slotSen, pressed && { opacity: 0.75 }]}>
            {selec.code_iso2 ? <Image source={{ uri: `https://flagcdn.com/w80/${selec.code_iso2.toLowerCase()}.png` }} style={s.drapeau} /> : null}
            <TexteDefilant texte={selec.nom} style={s.slotSenTexte} />
          </Pressable>
        ) : (
          <View style={s.slotAjout}>
            <Ionicons name="add" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={s.slotAjoutTexte}>Ajouter un pays</Text>
          </View>
        )}
      </View>
    </HeroModule>
  );

  if (modeFiche) {
    return (
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        {hero}
        <FichePaysContenu senId={senId!} autreId={selec!.id} autreNom={selec!.nom} />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: T.fond }}
      data={isLoading || isError ? [] : sections}
      keyExtractor={c => c.continent}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.liste}
      ListHeaderComponent={
        <>
          {hero}
          {!isLoading && !isError && (
            <Text style={s.compte}>{sections.reduce((n, c) => n + c.nb, 0)} pays</Text>
          )}
        </>
      }
      renderItem={({ item: c }) => {
        const ouvert = recherche || ouverts.has(c.continent);
        return (
          <View style={s.rangee}>
            <Pressable onPress={() => setOuverts(prev => {
              const n = new Set(prev); n.has(c.continent) ? n.delete(c.continent) : n.add(c.continent); return n;
            })}
              style={({ pressed }) => [s.continent, pressed && { backgroundColor: T.bleuVoile }]}>
              <Text style={s.continentTexte}>{c.continent.toUpperCase()}</Text>
              <View style={s.continentDroite}>
                <Text style={s.continentCompte}>{c.nb}</Text>
                <Ionicons name={ouvert ? "chevron-down" : "chevron-forward"} size={13} color={T.bleu} />
              </View>
            </Pressable>
            {ouvert && (
              <View style={s.surface}>
                {c.zones.map((z, zi) => (
                  <View key={z.zone}>
                    <Text style={[s.zone, zi > 0 && { borderTopWidth: 1, borderTopColor: T.filet }]}>{z.zone.toUpperCase()}</Text>
                    {z.pays.map(p => (
                      <Pressable key={p.id} onPress={() => choisir(p)}
                        style={({ pressed }) => [s.pays, pressed && { backgroundColor: T.blocFond }]}>
                        <Text style={s.paysNom} numberOfLines={1}>{p.nom}</Text>
                        <Text style={s.paysIso}>{p.code_iso3}</Text>
                        <Ionicons name="chevron-forward" size={13} color={T.grisClair} />
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        isLoading ? <EtatCharge />
        : isError ? (
          <EtatErreur onRetry={() => refetch()} />
        ) : (
          <EtatVide texte="Aucun pays trouvé." />
        )
      }
    />
  );
}

const s = StyleSheet.create({
  liste: { paddingBottom: 40 },
  rangee: { paddingHorizontal: 16, marginBottom: 9 },
  slots: { flexDirection: "row", gap: 8, marginTop: 16 },
  slotSen: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 999, paddingVertical: 9.5, paddingHorizontal: 14,
  },
  drapeau: { width: 21, height: 15, borderRadius: 2.5, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)" },
  slotSenTexte: { fontSize: 13, fontFamily: POLICE.gras, color: T.bleu },
  slotSenRef: { backgroundColor: T.blocBord, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  slotSenRefTexte: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.4 },
  slotAjout: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderRadius: 999, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.45)",
    paddingVertical: 9.5, paddingHorizontal: 14,
  },
  slotAjoutTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.85)" },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  continent: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  continentTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.2 },
  continentDroite: { flexDirection: "row", alignItems: "center", gap: 7 },
  continentCompte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1.5, overflow: "hidden", fontVariant: ["tabular-nums"] },
  surface: { backgroundColor: T.carte, borderRadius: 16, borderWidth: 1, borderColor: T.bordure, marginTop: 8, overflow: "hidden" },
  zone: { fontSize: 9, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.1, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 3 },
  pays: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10.5 },
  paysNom: { flex: 1, fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre },
  paysIso: { fontSize: 10.5, fontFamily: POLICE.moyen, color: T.grisClair, letterSpacing: 0.5 },
});
