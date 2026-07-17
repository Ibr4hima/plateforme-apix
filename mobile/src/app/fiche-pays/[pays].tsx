// Fiche Pays — réplique mobile de la fiche de comparaison du site :
// Sénégal × pays choisi. Chips drapeaux, contexte relationnel
// (appartenances communes, accords signés → fiche accord, entreprises
// installées au Sénégal → fiche entreprise), tableau d'indicateurs par
// catégorie (la plus grande valeur en vert, ou rouge pour les
// importations), échanges bilatéraux avec ventilation par ressource et
// balance commerciale.
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AccordSheet from "@/components/AccordSheet";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import HeroModule from "@/components/HeroModule";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { fmtUSD, fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

// Couleurs des deux colonnes : Sénégal en bleu, pays comparé en orange
const COL_SEN = T.bleu;
const COL_AUTRE = T.orange;
const VERT = T.vert;
const ROUGE = "#dc2626";

type Indicateur = { code: string; libelle: string; unite: string; categorie: string };

// Coloration comparative du site : la PLUS GRANDE valeur est mise en couleur —
// vert (favorable) ou rouge (importations). « Économie » est verte par défaut.
const COULEUR_MAX: Record<string, "vert" | "rouge"> = {
  population: "vert", superficie: "vert",
  exportations_marchandises: "vert", exportations_services: "vert",
  importations_marchandises: "rouge", importations_services: "rouge",
  __ide_entrant: "vert", __ide_sortant: "vert",
};
function couleurMaxPour(code: string, categorie?: string): "vert" | "rouge" | null {
  if (code in COULEUR_MAX) return COULEUR_MAX[code];
  if (categorie === "Économie") return "vert";
  return null;
}

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}

function Chip({ label, suffixe, onPress }: { label: string; suffixe?: string | null; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.chip, pressed && { backgroundColor: "rgba(0,79,145,0.07)", borderColor: "rgba(0,79,145,0.25)" }]}>
      <Text style={[s.chipTexte, onPress && { color: T.bleu }]} numberOfLines={1}>
        {label}{suffixe ? <Text style={s.chipSuffixe}>  · {suffixe}</Text> : null}
      </Text>
    </Pressable>
  );
}

function BlocContexte({ icone, titre, count, children }: { icone: string; titre: string; count: number; children: React.ReactNode }) {
  return (
    <View style={s.contexte}>
      <View style={s.contexteEntete}>
        <Symbole nom={icone} taille={14} couleur={T.bleu} />
        <Text style={s.contexteTitre} numberOfLines={2}>{titre.toUpperCase()}</Text>
        <View style={s.contexteCompte}><Text style={s.contexteCompteTexte}>{count}</Text></View>
      </View>
      <View style={s.chips}>{children}</View>
    </View>
  );
}

export default function FichePays() {
  const { pays: paysParam } = useLocalSearchParams<{ pays: string }>();
  const autreId = Number(paysParam);
  const [accordOuvert, setAccordOuvert] = useState<any>(null);
  const [entOuverte, setEntOuverte] = useState<any>(null);

  const { data: tousPays } = useQuery({
    queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays"),
  });
  const senId = useMemo(() => (tousPays || []).find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [tousPays]);
  const ids = senId ? [senId, autreId] : null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fiche-pays", senId, autreId], enabled: !!ids,
    queryFn: () => getJson<any>(`/statistiques/comparaison?pays=${ids!.join(",")}`),
  });
  const { data: ideFlux } = useQuery({
    queryKey: ["fiche-pays-ide", senId, autreId], enabled: !!ids,
    queryFn: () => getJson<any>(`/statistiques/ide_flux?pays=${ids!.join(",")}`).catch(() => ({})),
  });
  const { data: bilat } = useQuery({
    queryKey: ["fiche-pays-bilat", senId, autreId], enabled: !!ids,
    queryFn: () => getJson<any>(`/statistiques/commerce/bilateral?pays_a=${senId}&pays_b=${autreId}`).catch(() => null),
  });
  const { data: entSiege } = useQuery({
    queryKey: ["fiche-pays-siege", autreId],
    queryFn: () => getJson<any>(`/statistiques/entreprises-siege?pays_id=${autreId}`).catch(() => null),
  });

  const cols = data?.pays || [];
  const colSen = cols.find((c: any) => c.id === senId);
  const colAutre = cols.find((c: any) => c.id === autreId);
  const autreNom = colAutre?.nom || (tousPays || []).find((p: any) => p.id === autreId)?.nom || "";

  // Indicateurs macro + flux d'IDE (source CNUCED), groupés par catégorie
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

  const PaysPill = ({ c, couleur }: { c: any; couleur: string }) => (
    <View style={[s.paysPill, { backgroundColor: `${couleur}12`, borderColor: `${couleur}2E` }]}>
      {c?.code_iso2 ? <Image source={{ uri: `https://flagcdn.com/w80/${String(c.code_iso2).toLowerCase()}.png` }} style={s.paysDrapeau} /> : null}
      <Text style={[s.paysPillTexte, { color: couleur }]}>{c?.nom}</Text>
      {c?.code_iso3 ? <Text style={s.paysPillIso}>· {c.code_iso3}</Text> : null}
    </View>
  );

  // Bloc directionnel des échanges bilatéraux (réplique du site)
  const BlocDir = ({ de, vers, couleur, val, res, dep }: any) => {
    const maxR = res?.length ? res[0].valeur : 1;
    return (
      <View style={s.dir}>
        <View style={[s.dirEntete, !res?.length && { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.dirSens}>
              <Text style={[s.dirDe, { color: couleur }]} numberOfLines={1}>{de}</Text>
              <Symbole nom="arrow_right_alt" taille={16} couleur={T.grisClair} />
              <Text style={s.dirVers} numberOfLines={1}>{vers}</Text>
            </View>
            {dep != null && dep > 0 && (
              <Text style={s.dirDep}>soit <Text style={{ fontFamily: POLICE.gras, color: T.texte }}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</Text> des importations de {vers}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.dirTotal, { color: couleur }]}>{fmtUSD(val)}</Text>
            <Text style={s.dirTotalLabel}>TOTAL EXPORTÉ</Text>
          </View>
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

  const chargement = !data && (isLoading || !ids);

  return (
    <>
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }}>
        <HeroModule titre={autreNom || "Fiche Pays"} sousTitre="Fiche Pays · comparaison avec le Sénégal" />

        {chargement ? (
          <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
        ) : isError ? (
          <View style={s.centre}>
            <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
            <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Les deux pays comparés */}
            <View style={s.paysPills}>
              <PaysPill c={colSen} couleur={COL_SEN} />
              <PaysPill c={colAutre} couleur={COL_AUTRE} />
            </View>

            {/* Contexte relationnel */}
            {grps.length > 0 && (
              <BlocContexte icone="account_balance" titre="Appartenances communes" count={grps.length}>
                {grps.map((g: any) => <Chip key={g.code || g.nom} label={g.code || g.nom} />)}
              </BlocContexte>
            )}
            {accs.length > 0 && (
              <BlocContexte icone="signature" titre={accs.length > 1 ? "Accords signés" : "Accord signé"} count={accs.length}>
                {accs.map((ac: any, i: number) => (
                  <Chip key={i} label={ac.titre} suffixe={ac.date_signature ? ac.date_signature.slice(0, 4) : null}
                    onPress={ac.id ? () => setAccordOuvert(ac) : undefined} />
                ))}
              </BlocContexte>
            )}
            {ents.length > 0 && (
              <BlocContexte icone="enterprise" titre={`Entreprises installées au Sénégal · siège ${autreNom}`} count={entSiege.total}>
                {ents.map((e: any) => (
                  <Chip key={e.id} label={e.nom} suffixe={e.region} onPress={() => ouvrirEntreprise(e.id)} />
                ))}
              </BlocContexte>
            )}

            {/* Tableau comparatif par catégorie */}
            <View style={s.tableau}>
              <View style={s.tableauEntete}>
                <Text style={[s.thIndic, { flex: 1.25 }]}>INDICATEUR</Text>
                <Text style={[s.thPays, { color: COL_SEN }]} numberOfLines={1}>Sénégal</Text>
                <Text style={[s.thPays, { color: COL_AUTRE }]} numberOfLines={1}>{autreNom}</Text>
              </View>
              {cats.map(cat => (
                <Fragment key={cat}>
                  <Text style={s.categorie}>{cat.toUpperCase()}</Text>
                  {parCat[cat].map(ind => {
                    const teinte = couleurMaxPour(ind.code, ind.categorie);
                    let maxVal: number | null = null;
                    if (teinte && cols.length >= 2) {
                      const vals = cols.map((c: any) => getCell(c.id, ind.code)?.valeur).filter((x: any) => x !== null && x !== undefined) as number[];
                      if (vals.length >= 2 && Math.max(...vals) !== Math.min(...vals)) maxVal = Math.max(...vals);
                    }
                    return (
                      <View key={ind.code} style={s.ligne}>
                        <View style={{ flex: 1.25, minWidth: 0 }}>
                          <Text style={s.indicLibelle}>{ind.libelle}</Text>
                          <Text style={s.indicUnite}>{ind.unite}</Text>
                        </View>
                        {[senId, autreId].map(cid => {
                          const cell = cid ? getCell(cid, ind.code) : null;
                          const v = cell?.valeur;
                          const estMax = maxVal !== null && v === maxVal;
                          const couleur = v === null || v === undefined ? T.grisClair
                            : estMax ? (teinte === "rouge" ? ROUGE : VERT)
                            : T.encre;
                          return (
                            <View key={String(cid)} style={s.cellule}>
                              <Text style={[s.celluleVal, { color: couleur }, estMax && { fontFamily: POLICE.gras }]} numberOfLines={1} adjustsFontSizeToFit>
                                {fmtUnite(v, ind.unite)}
                              </Text>
                              {cell?.annee ? <Text style={s.celluleAnnee}>{cell.annee}</Text> : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </Fragment>
              ))}
            </View>

            {/* Échanges bilatéraux */}
            {bilat && (bilat.a_vers_b > 0 || bilat.b_vers_a > 0) && (() => {
              const ab = bilat.a_vers_b || 0, ba = bilat.b_vers_a || 0;
              const diff = ab - ba;
              const gagnant = diff >= 0 ? "Sénégal" : autreNom;
              const perdant = diff >= 0 ? autreNom : "Sénégal";
              const periode = bilat.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";
              return (
                <View style={{ marginTop: 24 }}>
                  <SecTitle>{`Échanges bilatéraux${periode ? ` · ${periode}` : ""}`}</SecTitle>
                  <View style={{ gap: 8 }}>
                    <BlocDir de="Sénégal" vers={autreNom} couleur={COL_SEN} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
                    <BlocDir de={autreNom} vers="Sénégal" couleur={COL_AUTRE} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
                  </View>
                  <View style={s.balance}>
                    <View style={s.balanceIcone}><Symbole nom="balance" taille={19} couleur={T.bleu} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.balanceTitre}>BALANCE COMMERCIALE</Text>
                      <Text style={s.balanceTexte}>
                        {diff === 0
                          ? <>Échanges <Text style={{ fontFamily: POLICE.gras, color: T.encre }}>équilibrés</Text> entre le Sénégal et {autreNom}.</>
                          : <>Excédentaire en faveur de <Text style={{ fontFamily: POLICE.gras, color: diff >= 0 ? COL_SEN : COL_AUTRE }}>{gagnant}</Text>, déficitaire pour {perdant}.</>}
                      </Text>
                    </View>
                    {diff !== 0 && (
                      <Text style={[s.balanceVal, { color: diff >= 0 ? COL_SEN : COL_AUTRE }]}>+{fmtUSD(Math.abs(diff))}</Text>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Légende */}
            <Text style={s.legende}>
              Dernière année disponible · la valeur la plus élevée est en <Text style={{ color: VERT, fontFamily: POLICE.gras }}>vert</Text> (ou en <Text style={{ color: ROUGE, fontFamily: POLICE.gras }}>rouge</Text> pour les importations)
            </Text>
          </View>
        )}
      </ScrollView>
      {accordOuvert && <AccordSheet accord={accordOuvert} onClose={() => setAccordOuvert(null)} />}
      {entOuverte && <EntrepriseSheet entreprise={entOuverte} onClose={() => setEntOuverte(null)} />}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 48, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  paysPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, marginBottom: 4 },
  paysPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 5.5 },
  paysDrapeau: { width: 20, height: 14, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)" },
  paysPillTexte: { fontSize: 12, fontFamily: POLICE.gras },
  paysPillIso: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  contexte: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 16, paddingVertical: 13, marginTop: 10,
  },
  contexteEntete: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  contexteTitre: { flex: 1, fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1 },
  contexteCompte: { backgroundColor: "rgba(0,79,145,0.10)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1.5 },
  contexteCompteTexte: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#F5F4F3", borderWidth: 1, borderColor: "#E8E5E2", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5, maxWidth: "100%" },
  chipTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.texte },
  chipSuffixe: { fontFamily: POLICE.normal, color: T.gris },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.4, marginBottom: 10 },
  tableau: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, marginTop: 14,
  },
  tableauEntete: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: T.bordure },
  thIndic: { fontSize: 9, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1 },
  thPays: { flex: 1, fontSize: 12, fontFamily: POLICE.gras, textAlign: "right" },
  categorie: { fontSize: 10, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.1, paddingTop: 15, paddingBottom: 4 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9.5, borderBottomWidth: 1, borderBottomColor: "#F5F4F3" },
  indicLibelle: { fontSize: 12, fontFamily: POLICE.demi, color: T.encre, lineHeight: 16 },
  indicUnite: { fontSize: 10, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  cellule: { flex: 1, alignItems: "flex-end" },
  celluleVal: { fontSize: 12.5, fontFamily: POLICE.demi, fontVariant: ["tabular-nums"] },
  celluleAnnee: { fontSize: 9, fontFamily: POLICE.normal, color: T.grisClair, marginTop: 1 },
  dir: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: T.bordure, overflow: "hidden" },
  dirEntete: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F4F2F0",
  },
  dirSens: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dirDe: { fontSize: 13, fontFamily: POLICE.gras, flexShrink: 1 },
  dirVers: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, flexShrink: 1 },
  dirDep: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 3 },
  dirTotal: { fontSize: 15, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  dirTotalLabel: { fontSize: 8, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1, marginTop: 3 },
  dirRes: { paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  resLigne: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 },
  resNom: { flex: 1, fontSize: 11.5, fontFamily: POLICE.normal, color: T.texte },
  resVal: { fontSize: 11.5, fontFamily: POLICE.gras, color: "#2d3540", fontVariant: ["tabular-nums"] },
  resBarFond: { height: 6, backgroundColor: "#F0EEEC", borderRadius: 99, overflow: "hidden" },
  resBar: { height: "100%", borderRadius: 99 },
  balance: {
    flexDirection: "row", alignItems: "center", gap: 13, marginTop: 12,
    backgroundColor: "rgba(0,79,145,0.06)", borderWidth: 1, borderColor: "rgba(0,79,145,0.20)",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  balanceIcone: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(0,79,145,0.12)", alignItems: "center", justifyContent: "center" },
  balanceTitre: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.3, marginBottom: 3 },
  balanceTexte: { fontSize: 12, fontFamily: POLICE.normal, color: T.texte, lineHeight: 17 },
  balanceVal: { fontSize: 16, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  legende: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, lineHeight: 16, marginTop: 18, textAlign: "center" },
});
