// Accords & Traités — le partenaire d'abord.
//
// Chaque carte répétait « TBI Sénégal – … » : l'identité réelle d'un traité
// bilatéral, c'est le pays partenaire. La ligne le met en tête — drapeau en
// bloc de gauche (l'ancre visuelle, comme le bloc date des événements), nom
// du partenaire en titre, ancienneté en sous-titre, statut en point coloré à
// droite (le mot vit déjà dans le sous-titre, et les segments filtrent).
//
// Tri : les actifs d'abord par échéance d'expiration croissante (ceux qui
// tombent bientôt en tête), sans-expiration ensuite, puis les expirés du plus
// récent au plus ancien — l'ordre d'un portefeuille, pas d'une archive.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, ChipFiltre, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import AccordSheet, { sousTitreStatut } from "@/components/AccordSheet";
import EnTetePage from "@/components/EnTetePage";
import Symbole from "@/components/Symbole";
import { fetchTous, getJson } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { useMargeBas } from "@/lib/marges";
import { POLICE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

const TYPES = [
  { cle: "tbi",   label: "Traités Bilatéraux" },
  { cle: "inter", label: "Traités Internationaux" },
] as const;

// ── La carte d'accord ────────────────────────────────────────────────────────
// Le gabarit carte de la plateforme : contour fin (T.carteBord), sans ombre.
// Le titre mène (le partenaire quand il est connu), l'ancienneté suit — elle
// porte le mot du statut — et la rangée basse ne garde que les deux dates qui
// comptent : signature et expiration. Toutes les cartes ont la même hauteur.
function CarteAccord({ a, partenaires, onPress }: {
  a: any; partenaires: { nom: string; code_iso2?: string }[]; onPress: () => void;
}) {
  const statut = computeStatutAccord(a);
  const expire = statut === "expire";
  // Le partenaire donne le titre quand il est connu — sinon l'intitulé officiel
  const titre = partenaires.length === 1 ? partenaires[0].nom
    : partenaires.length > 1 ? partenaires.map(p => p.nom).join(", ")
    : a.titre;
  const echeance = a.date_expiration
    ? { label: "EXPIRATION", val: fmtDate(a.date_expiration) }
    : { label: "EXPIRATION", val: "Non définie" };

  return (
    <Tapable onPress={onPress} echelle={0.985} style={[s.carte, expire && { backgroundColor: T.carteDouce }]}>
      <View style={s.carteCorps}>
        <Text style={[s.titre, expire && { color: T.texte }]} numberOfLines={2}>{titre}</Text>
        {sousTitreStatut(a) ? (
          <TexteDefilant style={s.sousTitre} texte={sousTitreStatut(a) as string} />
        ) : null}
        <View style={s.dates}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.dateLabel}>SIGNATURE</Text>
            <Text style={[s.dateVal, !a.date_signature && { color: T.grisClair }]} numberOfLines={1}>
              {a.date_signature ? fmtDate(a.date_signature) : "—"}
            </Text>
          </View>
          <View style={s.dateSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.dateLabel}>{echeance.label}</Text>
            <Text style={[s.dateVal, !a.date_expiration && { color: T.grisClair }]} numberOfLines={1}>
              {echeance.val}
            </Text>
          </View>
        </View>
      </View>
    </Tapable>
  );
}

export default function Accords() {
  const margeBas = useMargeBas();
  const { width } = useWindowDimensions();
  const [onglet, setOnglet] = useState("tbi");
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("en_vigueur");
  const [selec, setSelec] = useState<any>(null);


  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["accords"], queryFn: () => fetchTous("/accords"),
  });
  // Le référentiel des parties porte les ISO2 (drapeaux) — même cache que la fiche
  const parties = useQuery({
    queryKey: ["accords-parties"], queryFn: () => getJson<any>("/accords/parties-distinctes"),
    staleTime: Infinity, gcTime: 24 * 3600 * 1000,
  });
  const paysRef: any[] = parties.data?.pays || [];
  const partenairesDe = (a: any) => (a.parties_pays_ids || [])
    .map((id: number) => paysRef.find((p: any) => p.id === id))
    .filter((p: any) => p && p.nom !== "Sénégal");

  // La recherche seule, avant le segment de statut : les compteurs des
  // segments se calculent sur cette base
  const communs = useMemo(() => {
    let liste = (data || []).filter((a: any) => (a.type_accord || "tbi") === "tbi");
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      liste = liste.filter((a: any) =>
        (a.titre || "").toLowerCase().includes(t) ||
        (a.reference || "").toLowerCase().includes(t) ||
        partenairesDe(a).some((p: any) => p.nom.toLowerCase().includes(t)));
    }
    return liste;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, paysRef]);

  const parStatut = useMemo(() => ({
    en_vigueur: communs.filter((a: any) => computeStatutAccord(a) === "en_vigueur").length,
    signe: communs.filter((a: any) => computeStatutAccord(a) === "signe").length,
    expire: communs.filter((a: any) => computeStatutAccord(a) === "expire").length,
  }), [communs]);

  const filtres = useMemo(() => {
    const liste = communs.filter((a: any) => computeStatutAccord(a) === statut);
    // Actifs par échéance croissante (sans-expiration à la fin), expirés
    // ensuite du plus récemment expiré au plus ancien
    return [...liste].sort((a: any, b: any) => {
      const ea = computeStatutAccord(a) === "expire", eb = computeStatutAccord(b) === "expire";
      if (ea !== eb) return ea ? 1 : -1;
      if (ea && eb) return (b.date_expiration || "").localeCompare(a.date_expiration || "");
      if (!a.date_expiration && !b.date_expiration) return 0;
      if (!a.date_expiration) return 1;
      if (!b.date_expiration) return -1;
      return a.date_expiration.localeCompare(b.date_expiration);
    });
  }, [communs, statut]);

  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  const pret = !isLoading && !isError;
  // Pas de « Tous » : mêler en vigueur, signés et expirés ne répond à aucune
  // question — on ouvre sur les traités actifs
  const segments = [
    { cle: "en_vigueur", label: "En vigueur", compte: pret ? parStatut.en_vigueur : undefined },
    { cle: "signe",      label: "Signés",     compte: pret ? parStatut.signe : undefined },
    { cle: "expire",     label: "Expirés",    compte: pret ? parStatut.expire : undefined },
  ];

  // L'en-tête est ANCRÉ hors du défilement — retour, recherche et segments
  // restent sous le pouce ; les chips, elles, suivent le contenu
  const entete = (
    <EnTetePage titre="Accords & Traités"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: segments, valeur: statut, onChange: setStatut }} />
  );

  const hero = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
        {TYPES.map(o => {
          const actif = onglet === o.cle;
          return (
            <ChipFiltre key={o.cle} label={o.label} actif={actif} onPress={() => setOnglet(o.cle)} />
          );
        })}
      </ScrollView>
    </>
  );

  if (onglet === "inter") {
    return (
      <View style={{ flex: 1, backgroundColor: T.fond }}>
        {entete}
        {hero}
        <View style={s.centre}>
          <View style={s.bientotPastille}><Symbole nom="signature" taille={26} couleur={T.bleu} /></View>
          <Text style={s.bientotTitre}>Traités Internationaux</Text>
          <Text style={s.bientotTexte}>Cette section arrive prochainement.{"\n"}Les traités bilatéraux d'investissement restent disponibles.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {entete}
      <ListeRapide
        style={{ backgroundColor: T.fond }}
        data={isLoading || isError ? [] : filtres}
        keyExtractor={(a: any) => String(a.id)}
        renderItem={({ item, index }: any) => (
          <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
            <CarteAccord a={item} partenaires={partenairesDe(item)} onPress={() => setSelec(item)} />
          </Apparition>
        )}
        contentContainerStyle={{ paddingBottom: margeBas }}
        ListHeaderComponentStyle={{ marginBottom: 14 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={hero}
        ListEmptyComponent={
          isLoading ? <SqueletteListe />
          : isError ? <EtatErreur onRetry={() => refetch()} />
          : <EtatVide texte="Aucun accord ne correspond." />
        }
      />
      {selec && <AccordSheet accord={selec} onClose={() => setSelec(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  rangee: { paddingHorizontal: 16, marginBottom: 10 },
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },

  carte: {
    backgroundColor: T.carte, borderRadius: 18,
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  titre: { fontSize: 15.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sousTitre: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  dates: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  dateSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  dateLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  dateVal: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: T.bleuVoile, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
}));
