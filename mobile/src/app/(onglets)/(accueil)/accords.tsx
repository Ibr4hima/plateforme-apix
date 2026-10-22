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
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ListeRapide } from "@/components/ListeRapide";
import { SqueletteListe } from "@/components/Squelette";
import { Apparition, EtatErreur, EtatVide, Tapable, EtatHorsLigne } from "@/components/ui";
import { useRafraichir } from "@/lib/rafraichir";
import AccordSheet, { sousTitreStatut } from "@/components/AccordSheet";
import EnTetePage from "@/components/EnTetePage";
import { enAttente, enPanne, fetchTous, getJson, horsLigne } from "@/lib/api";
import { fmtDate, plier } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { DEFILEMENT, useMargeBas, useCap } from "@/lib/marges";
import { coin, FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";


// Le statut d'un accord, segment compris : sans date de signature passée
// (aucune date, ou une signature encore à venir), il n'en a pas — il vit dans
// son propre segment au lieu de n'apparaître nulle part
const statutDe = (a: any) => computeStatutAccord(a) ?? "sans_statut";

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
    <Tapable onPress={onPress} style={[s.carte, expire && { backgroundColor: T.carteDouce }]}>
      <View style={s.carteCorps}>
        <Text style={[s.titre, expire && { color: T.texte }]}>{titre}</Text>
        {sousTitreStatut(a) ? (
          <TexteDefilant style={s.sousTitre}>{sousTitreStatut(a)}</TexteDefilant>
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
  const margeBas = useMargeBas({ sousOnglets: true });
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("en_vigueur");
  const [selec, setSelec] = useState<any>(null);


  const requete = useQuery({
    queryKey: ["accords"], queryFn: () => fetchTous("/accords"),
  });
  const { data, isError, refetch } = requete;
  const { tire, rafraichir } = useRafraichir(refetch);
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
    // Accents et casse repliés : « senegal » trouve « Sénégal »
    const t = plier(q);
    if (t) {
      liste = liste.filter((a: any) =>
        plier(a.titre).includes(t) || plier(a.reference).includes(t) ||
        partenairesDe(a).some((p: any) => plier(p.nom).includes(t)));
    }
    return liste;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, paysRef]);

  const parStatut = useMemo(() => {
    const n: Record<string, number> = { en_vigueur: 0, signe: 0, expire: 0, sans_statut: 0 };
    for (const a of communs) n[statutDe(a)]++;
    return n;
  }, [communs]);

  // Le segment n'existe que s'il a des accords — sur toute la liste, pas
  // seulement sur la recherche : les segments ne bougent pas à la frappe.
  // « Non datés » s'il n'y a que des accords sans date, « Autres » si l'un
  // d'eux a une signature prévue
  const sansStatut = useMemo(() => (data || []).filter((a: any) =>
    (a.type_accord || "tbi") === "tbi" && computeStatutAccord(a) == null), [data]);
  const libelleSansStatut = sansStatut.some((a: any) => a.date_signature) ? "Autres" : "Non datés";
  // Le segment disparu (la liste a changé) : retour aux traités en vigueur
  useEffect(() => {
    if (statut === "sans_statut" && !sansStatut.length) setStatut("en_vigueur");
  }, [statut, sansStatut.length]);

  const filtres = useMemo(() => {
    const liste = communs.filter((a: any) => statutDe(a) === statut);
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

  const cap = useCap();

  const pret = data !== undefined;
  // Pas de « Tous » : mêler en vigueur, signés et expirés ne répond à aucune
  // question — on ouvre sur les traités actifs
  const segments = [
    { cle: "en_vigueur", label: "En vigueur", compte: pret ? parStatut.en_vigueur : undefined },
    { cle: "signe",      label: "Signés",     compte: pret ? parStatut.signe : undefined },
    { cle: "expire",     label: "Expirés",    compte: pret ? parStatut.expire : undefined },
    ...(sansStatut.length
      ? [{ cle: "sans_statut", label: libelleSansStatut, compte: pret ? parStatut.sans_statut : undefined }]
      : []),
  ];

  // La recherche ne trouve rien dans ce segment mais trouve dans un autre :
  // l'état vide le dit et y mène — les segments ne portent pas de compteurs
  const ailleurs = q.trim() ? segments.find(sg => sg.cle !== statut && (sg.compte ?? 0) > 0) : undefined;
  const VIDE: Record<string, string> = {
    en_vigueur: "Aucun accord en vigueur ne correspond.",
    signe: "Aucun accord signé ne correspond.",
    expire: "Aucun accord expiré ne correspond.",
    sans_statut: "Aucun accord ne correspond.",
  };

  // L'en-tête est ANCRÉ hors du défilement — retour, recherche et segments
  // restent sous le pouce ; les chips, elles, suivent le contenu
  const entete = (
    <EnTetePage titre="Accords & Traités"
      recherche={{ valeur: q, onChange: setQ, placeholder: "Rechercher" }}
      segments={{ options: segments, valeur: statut, onChange: setStatut }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.fond }}>
      {entete}
      <ListeRapide {...DEFILEMENT}
        style={{ backgroundColor: T.fond }}
        data={filtres}
        keyExtractor={(a: any) => String(a.id)}
        renderItem={({ item, index }: any) => (
          <Apparition index={Math.min(index, 8)} style={[s.rangee, cap]}>
            <CarteAccord a={item} partenaires={partenairesDe(item)} onPress={() => setSelec(item)} />
          </Apparition>
        )}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: margeBas }}
        refreshing={tire}
        onRefresh={rafraichir}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          horsLigne(requete) ? <EtatHorsLigne />
          : enAttente(requete) ? <SqueletteListe />
          : enPanne({ isError, data }) ? <EtatErreur onRetry={() => refetch()} />
          : <EtatVide texte={VIDE[statut] || "Aucun accord ne correspond."}
              action={ailleurs ? {
                label: `Voir ${ailleurs.compte} résultat${(ailleurs.compte ?? 0) > 1 ? "s" : ""} dans ${ailleurs.label}`,
                onPress: () => setStatut(ailleurs.cle),
              } : undefined} />
        }
      />
      {selec && <AccordSheet accord={selec} onClose={() => setSelec(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  rangee: { paddingHorizontal: 16, marginBottom: 10 },

  carte: {
    backgroundColor: T.carte, borderRadius: coin(18),
    borderWidth: 1, borderColor: T.carteBord,
  },
  carteCorps: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 3 },
  titre: { fontSize: 15.5, ...FONTE.demi, color: T.encre, letterSpacing: -0.2, lineHeight: 20 },
  sousTitre: { fontSize: 12, ...FONTE.normal, color: T.gris },
  dates: { flexDirection: "row", alignItems: "center", marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  dateSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 16 },
  dateLabel: { fontSize: 8.5, ...FONTE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  dateVal: { fontSize: 12.5, ...FONTE.demi, color: T.encre, fontVariant: ["tabular-nums"] },

}));
