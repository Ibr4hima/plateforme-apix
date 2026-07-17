// Fiche Pays — contenu de la comparaison Sénégal × pays, pensé pour
// l'app (pas une copie du site) : repères de la relation en tuiles,
// indicateurs en « duels » à double barre bleu / orange, relations
// (organisations, accords, entreprises) en listes tapables, échanges
// bilatéraux et balance commerciale.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import AccordSheet from "@/components/AccordSheet";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { fmtUSD, fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

const COL_SEN = T.bleu;
const COL_AUTRE = "#d97a2e";

type Indicateur = { code: string; libelle: string; unite: string; categorie: string };

export default function FichePaysContenu({ senId, autreId, autreNom }: { senId: number; autreId: number; autreNom: string }) {
  const [accordOuvert, setAccordOuvert] = useState<any>(null);
  const [entOuverte, setEntOuverte] = useState<any>(null);
  const [toutesEnts, setToutesEnts] = useState(false);

  const ids = `${senId},${autreId}`;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fiche-pays", senId, autreId],
    queryFn: () => getJson<any>(`/statistiques/comparaison?pays=${ids}`),
  });
  const { data: ideFlux } = useQuery({
    queryKey: ["fiche-pays-ide", senId, autreId],
    queryFn: () => getJson<any>(`/statistiques/ide_flux?pays=${ids}`).catch(() => ({})),
  });
  const { data: bilat } = useQuery({
    queryKey: ["fiche-pays-bilat", senId, autreId],
    queryFn: () => getJson<any>(`/statistiques/commerce/bilateral?pays_a=${senId}&pays_b=${autreId}`).catch(() => null),
  });
  const { data: entSiege } = useQuery({
    queryKey: ["fiche-pays-siege", autreId],
    queryFn: () => getJson<any>(`/statistiques/entreprises-siege?pays_id=${autreId}`).catch(() => null),
  });

  if (isLoading) return <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>;
  if (isError) return (
    <View style={s.centre}>
      <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
      <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
    </View>
  );

  const cols = data?.pays || [];
  const colAutre = cols.find((c: any) => c.id === autreId);

  // Indicateurs macro + flux d'IDE (CNUCED), groupés par catégorie
  const inds: Indicateur[] = [
    ...(data?.indicateurs || []),
    { code: "__ide_entrant", libelle: "Flux d'IDE entrants", unite: "USD", categorie: "Investissements directs étrangers" },
    { code: "__ide_sortant", libelle: "Flux d'IDE sortants", unite: "USD", categorie: "Investissements directs étrangers" },
  ];
  const cats: string[] = [];
  const parCat: Record<string, Indicateur[]> = {};
  inds.forEach(ind => { const c = ind.categorie || "Autres"; if (!parCat[c]) { parCat[c] = []; cats.push(c); } parCat[c].push(ind); });
  const getCell = (cid: number, code: string): { valeur: number | null; annee?: number } | null => {
    if (code === "__ide_entrant") return ideFlux?.[String(cid)]?.entrant || null;
    if (code === "__ide_sortant") return ideFlux?.[String(cid)]?.sortant || null;
    return data?.valeurs?.[String(cid)]?.[code] || null;
  };

  const ouvrirEntreprise = async (id: number) => {
    try { setEntOuverte(await getJson(`/entreprises/${id}`)); } catch {}
  };

  const grps = bilat?.groupements_communs || [];
  const accs = bilat?.accords || [];
  const ents = entSiege?.entreprises || [];
  const entsVisibles = toutesEnts ? ents : ents.slice(0, 6);

  // ── Repères de la relation ──
  const reperes = [
    { icone: "signature",       valeur: accs.length,           label: accs.length > 1 ? "Accords signés" : "Accord signé" },
    { icone: "enterprise",      valeur: entSiege?.total ?? 0,  label: "Entreprises au Sénégal" },
    { icone: "account_balance", valeur: grps.length,           label: "Organisations communes" },
  ];

  // ── Duel d'un indicateur : deux barres proportionnelles (échelle racine) ──
  const Duel = ({ ind }: { ind: Indicateur }) => {
    const cSen = senId ? getCell(senId, ind.code) : null;
    const cAutre = getCell(autreId, ind.code);
    const a = cSen?.valeur, b = cAutre?.valeur;
    const ra = a != null && a > 0 ? Math.sqrt(a) : 0;
    const rb = b != null && b > 0 ? Math.sqrt(b) : 0;
    const tot = ra + rb;
    const pa = tot > 0 ? ra / tot : 0.5;
    return (
      <View style={s.duel}>
        <View style={s.duelEntete}>
          <Text style={s.duelLibelle} numberOfLines={1}>{ind.libelle}</Text>
          <Text style={s.duelUnite}>{ind.unite}</Text>
        </View>
        <View style={s.duelValeurs}>
          <Text style={[s.duelVal, { color: a != null ? COL_SEN : T.grisClair }]} numberOfLines={1}>
            {fmtUnite(a, ind.unite)}{cSen?.annee ? <Text style={s.duelAnnee}>  {cSen.annee}</Text> : null}
          </Text>
          <Text style={[s.duelVal, { color: b != null ? COL_AUTRE : T.grisClair, textAlign: "right" }]} numberOfLines={1}>
            {cAutre?.annee ? <Text style={s.duelAnnee}>{cAutre.annee}  </Text> : null}{fmtUnite(b, ind.unite)}
          </Text>
        </View>
        <View style={s.duelPiste}>
          <View style={{ flex: Math.max(pa, 0.02), backgroundColor: ra > 0 ? COL_SEN : T.filet, borderRadius: 99 }} />
          <View style={{ flex: Math.max(1 - pa, 0.02), backgroundColor: rb > 0 ? COL_AUTRE : T.filet, borderRadius: 99 }} />
        </View>
      </View>
    );
  };

  // ── Sens d'échange (Sénégal → X ou X → Sénégal) ──
  const BlocDir = ({ de, vers, couleur, val, res, dep }: any) => {
    const maxR = res?.length ? res[0].valeur : 1;
    return (
      <View style={s.dir}>
        <View style={s.dirEntete}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.dirSens}>
              <View style={[s.dirPoint, { backgroundColor: couleur }]} />
              <Text style={[s.dirDe, { color: couleur }]} numberOfLines={1}>{de}</Text>
              <Symbole nom="arrow_right_alt" taille={16} couleur={T.grisClair} />
              <Text style={s.dirVers} numberOfLines={1}>{vers}</Text>
            </View>
            {dep != null && dep > 0 && (
              <Text style={s.dirDep}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % des importations de {vers}</Text>
            )}
          </View>
          <Text style={[s.dirTotal, { color: couleur }]}>{fmtUSD(val)}</Text>
        </View>
        {res?.length > 0 && (
          <View style={s.dirRes}>
            {res.map((r: any) => {
              const pct = val > 0 ? r.valeur / val * 100 : 0;
              return (
                <View key={r.ressource}>
                  <View style={s.resLigne}>
                    <Text style={s.resNom} numberOfLines={1}>{r.ressource}</Text>
                    <Text style={s.resVal}>{fmtUSD(r.valeur)} <Text style={{ color: T.grisClair }}>· {pct.toFixed(0)} %</Text></Text>
                  </View>
                  <View style={s.resBarFond}>
                    <View style={[s.resBar, { width: `${Math.max(4, Math.sqrt(r.valeur / maxR) * 100)}%`, backgroundColor: couleur }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const ab = bilat?.a_vers_b || 0, ba = bilat?.b_vers_a || 0;
  const diff = ab - ba;

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {/* Repères de la relation */}
      <View style={s.reperes}>
        {reperes.map(r => (
          <View key={r.icone} style={s.repere}>
            <Symbole nom={r.icone} taille={17} couleur={T.bleu} />
            <Text style={s.repereValeur}>{r.valeur}</Text>
            <Text style={s.repereLabel} numberOfLines={2}>{r.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Organisations communes */}
      {grps.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={s.secTitle}>ORGANISATIONS COMMUNES</Text>
          <View style={s.chips}>
            {grps.map((g: any) => (
              <View key={g.code || g.nom} style={s.chip}><Text style={s.chipTexte}>{g.code || g.nom}</Text></View>
            ))}
          </View>
        </View>
      )}

      {/* Accords signés */}
      {accs.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={s.secTitle}>{accs.length > 1 ? "ACCORDS SIGNÉS" : "ACCORD SIGNÉ"}</Text>
          <View style={s.surface}>
            {accs.map((ac: any, i: number) => (
              <Pressable key={i} onPress={() => setAccordOuvert(ac)}
                style={({ pressed }) => [s.rangeeItem, i > 0 && s.rangeeBord, pressed && { backgroundColor: "rgba(0,79,145,0.04)" }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemTitre} numberOfLines={2}>{ac.titre}</Text>
                  {ac.date_signature ? <Text style={s.itemSous}>Signé en {ac.date_signature.slice(0, 4)}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Entreprises installées au Sénégal */}
      {ents.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={s.secTitle}>{`ENTREPRISES AU SÉNÉGAL · SIÈGE ${autreNom.toUpperCase()}`}</Text>
          <View style={s.surface}>
            {entsVisibles.map((e: any, i: number) => (
              <Pressable key={e.id} onPress={() => ouvrirEntreprise(e.id)}
                style={({ pressed }) => [s.rangeeItem, i > 0 && s.rangeeBord, pressed && { backgroundColor: "rgba(0,79,145,0.04)" }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemTitre} numberOfLines={1}>{e.nom}</Text>
                  {(e.region || e.forme_juridique) ? <Text style={s.itemSous} numberOfLines={1}>{[e.forme_juridique, e.region].filter(Boolean).join(" · ")}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
              </Pressable>
            ))}
            {ents.length > 6 && (
              <Pressable onPress={() => setToutesEnts(v => !v)} style={[s.rangeeItem, s.rangeeBord, { justifyContent: "center" }]}>
                <Text style={s.voirTout}>{toutesEnts ? "Réduire" : `Afficher les ${ents.length - 6} autres`}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Indicateurs en duels */}
      <View style={{ marginTop: 24 }}>
        <Text style={s.secTitle}>INDICATEURS</Text>
        {/* Légende des deux couleurs */}
        <View style={s.legendeCouleurs}>
          <View style={s.legendeItem}><View style={[s.legendePoint, { backgroundColor: COL_SEN }]} /><Text style={s.legendeTexte}>Sénégal</Text></View>
          <View style={s.legendeItem}><View style={[s.legendePoint, { backgroundColor: COL_AUTRE }]} /><Text style={s.legendeTexte}>{colAutre?.nom || autreNom}</Text></View>
        </View>
        {cats.map(cat => (
          <Fragment key={cat}>
            <Text style={s.categorie}>{cat.toUpperCase()}</Text>
            <View style={[s.surface, { paddingVertical: 4 }]}>
              {parCat[cat].map((ind, i) => (
                <View key={ind.code} style={i > 0 ? { borderTopWidth: 1, borderTopColor: T.filet } : undefined}>
                  <Duel ind={ind} />
                </View>
              ))}
            </View>
          </Fragment>
        ))}
      </View>

      {/* Échanges bilatéraux */}
      {bilat && (ab > 0 || ba > 0) && (
        <View style={{ marginTop: 24 }}>
          <Text style={s.secTitle}>{`ÉCHANGES BILATÉRAUX${bilat.annee_min ? ` · ${bilat.annee_min}–${bilat.annee_max}` : ""}`}</Text>
          <View style={{ gap: 8 }}>
            <BlocDir de="Sénégal" vers={autreNom} couleur={COL_SEN} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
            <BlocDir de={autreNom} vers="Sénégal" couleur={COL_AUTRE} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
          </View>
          {/* Balance commerciale */}
          <View style={s.balance}>
            <View style={s.balanceIcone}><Symbole nom="balance" taille={19} couleur={T.bleu} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.balanceTitre}>BALANCE COMMERCIALE</Text>
              <Text style={s.balanceTexte}>
                {diff === 0
                  ? <>Échanges <Text style={{ fontFamily: POLICE.gras, color: T.encre }}>équilibrés</Text> entre le Sénégal et {autreNom}.</>
                  : <>Excédentaire en faveur {diff >= 0 ? "du " : "de "}<Text style={{ fontFamily: POLICE.gras, color: diff >= 0 ? COL_SEN : COL_AUTRE }}>{diff >= 0 ? "Sénégal" : autreNom}</Text>.</>}
              </Text>
            </View>
            {diff !== 0 && (
              <Text style={[s.balanceVal, { color: diff >= 0 ? COL_SEN : COL_AUTRE }]}>+{fmtUSD(Math.abs(diff))}</Text>
            )}
          </View>
        </View>
      )}

      <Text style={s.note}>Dernière année disponible pour chaque indicateur · sources : plateforme APIX & CNUCED</Text>

      {accordOuvert && <AccordSheet accord={accordOuvert} onClose={() => setAccordOuvert(null)} />}
      {entOuverte && <EntrepriseSheet entreprise={entOuverte} onClose={() => setEntOuverte(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 48, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  reperes: { flexDirection: "row", gap: 8, marginTop: 16 },
  repere: {
    flex: 1, alignItems: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingVertical: 14, paddingHorizontal: 8,
    shadowColor: "#001e3c", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  repereValeur: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"], lineHeight: 25 },
  repereLabel: { fontSize: 8, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8, textAlign: "center", lineHeight: 11 },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.4, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#fff", borderWidth: 1, borderColor: T.bordure, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
  surface: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, overflow: "hidden" },
  rangeeItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11.5 },
  rangeeBord: { borderTopWidth: 1, borderTopColor: T.filet },
  itemTitre: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 17 },
  itemSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  voirTout: { fontSize: 12, fontFamily: POLICE.demi, color: T.bleu },
  legendeCouleurs: { flexDirection: "row", gap: 16, marginBottom: 2 },
  legendeItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendePoint: { width: 8, height: 8, borderRadius: 4 },
  legendeTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
  categorie: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  duel: { paddingHorizontal: 16, paddingVertical: 11 },
  duelEntete: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  duelLibelle: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  duelUnite: { fontSize: 9.5, fontFamily: POLICE.normal, color: T.gris },
  duelValeurs: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 7, marginBottom: 6 },
  duelVal: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  duelAnnee: { fontSize: 9, fontFamily: POLICE.normal, color: T.grisClair },
  duelPiste: { flexDirection: "row", gap: 3, height: 6 },
  dir: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure, overflow: "hidden" },
  dirEntete: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  dirSens: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  dirPoint: { width: 7, height: 7, borderRadius: 4 },
  dirDe: { fontSize: 13, fontFamily: POLICE.gras, flexShrink: 1 },
  dirVers: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, flexShrink: 1 },
  dirDep: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 3, marginLeft: 14 },
  dirTotal: { fontSize: 15, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  dirRes: { paddingHorizontal: 16, paddingBottom: 13, gap: 11, borderTopWidth: 1, borderTopColor: "#F4F2F0", paddingTop: 12 },
  resLigne: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  resNom: { flex: 1, fontSize: 11.5, fontFamily: POLICE.normal, color: T.texte },
  resVal: { fontSize: 11.5, fontFamily: POLICE.gras, color: "#2d3540", fontVariant: ["tabular-nums"] },
  resBarFond: { height: 6, backgroundColor: "#F0EEEC", borderRadius: 99, overflow: "hidden" },
  resBar: { height: "100%", borderRadius: 99 },
  balance: {
    flexDirection: "row", alignItems: "center", gap: 13, marginTop: 12,
    backgroundColor: "rgba(0,79,145,0.06)", borderWidth: 1, borderColor: "rgba(0,79,145,0.20)",
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  balanceIcone: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(0,79,145,0.12)", alignItems: "center", justifyContent: "center" },
  balanceTitre: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.3, marginBottom: 3 },
  balanceTexte: { fontSize: 12, fontFamily: POLICE.normal, color: T.texte, lineHeight: 17 },
  balanceVal: { fontSize: 16, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  note: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, lineHeight: 16, marginTop: 20, textAlign: "center" },
});
