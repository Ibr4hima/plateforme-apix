// Fiche Pays — le contenu de la comparaison Sénégal × pays, dans la grammaire
// de l'app : une CARTE VEDETTE de la relation (les échanges cumulés en grand,
// la balance en toutes lettres, puis Accords | Entreprises | Organisations
// sous filets — les trois chiffres qu'on vient chercher), les relations en
// listes plates tapables, les indicateurs en « duels » à double barre
// bleu / orange, et le détail des échanges par sens — sans liseré, contour
// fin, le gabarit de la plateforme.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, Tapable } from "@/components/ui";
import AccordSheet from "@/components/AccordSheet";
import EntrepriseSheet from "@/components/EntrepriseSheet";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { fmtUSD, fmtUnite } from "@/lib/format";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

// Lu au rendu (voir PoleSheet) : sur Android un jeton fige a l'import.
const COL_SEN_ = () => T.bleu;
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

  if (isLoading) return <SqueletteDonnees />;
  if (isError) return <EtatErreur onRetry={() => refetch()} />;

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

  const ab = bilat?.a_vers_b || 0, ba = bilat?.b_vers_a || 0;
  const diff = ab - ba;
  const totalEchanges = ab + ba;

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
          <TexteDefilant style={s.duelLibelle} texte={ind.libelle} />
          <Text style={s.duelUnite}>{ind.unite}</Text>
        </View>
        <View style={s.duelValeurs}>
          <Text style={[s.duelVal, { color: a != null ? COL_SEN_() : T.grisClair }]} numberOfLines={1}>
            {fmtUnite(a, ind.unite)}{cSen?.annee ? <Text style={s.duelAnnee}>  {cSen.annee}</Text> : null}
          </Text>
          <Text style={[s.duelVal, { color: b != null ? COL_AUTRE : T.grisClair, textAlign: "right" }]} numberOfLines={1}>
            {cAutre?.annee ? <Text style={s.duelAnnee}>{cAutre.annee}  </Text> : null}{fmtUnite(b, ind.unite)}
          </Text>
        </View>
        <View style={s.duelPiste}>
          <View style={{ flex: Math.max(pa, 0.02), backgroundColor: ra > 0 ? COL_SEN_() : T.filet, borderRadius: 99 }} />
          <View style={{ flex: Math.max(1 - pa, 0.02), backgroundColor: rb > 0 ? COL_AUTRE : T.filet, borderRadius: 99 }} />
        </View>
      </View>
    );
  };

  // ── Un sens d'échange (Sénégal → X ou X → Sénégal) — contour fin, sans liseré ──
  const BlocDir = ({ de, vers, couleur, val, res, dep }: any) => {
    const maxR = res?.length ? res[0].valeur : 1;
    return (
      <View style={s.dir}>
        <View style={s.dirEntete}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <View style={s.dirSens}>
              <Text style={[s.dirDe, { color: couleur }]} numberOfLines={1}>{de}</Text>
              <Symbole nom="arrow_right_alt" taille={17} couleur={T.grisClair} />
              <Text style={s.dirVers} numberOfLines={1}>{vers}</Text>
            </View>
            {dep != null && dep > 0 && (
              <View style={[s.dirDepChip, { backgroundColor: `${couleur}0D` }]}>
                <Text style={[s.dirDepTexte, { color: couleur }]}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % des importations de {vers}</Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            <Text style={[s.dirTotal, { color: couleur }]}>{fmtUSD(val)}</Text>
            <Text style={s.dirTotalLabel}>EXPORTÉ</Text>
          </View>
        </View>
        {res?.length > 0 && (
          <View style={s.dirRes}>
            {res.map((r: any) => {
              const pct = val > 0 ? r.valeur / val * 100 : 0;
              return (
                <View key={r.ressource}>
                  <View style={s.resLigne}>
                    <TexteDefilant style={s.resNom} texte={r.ressource} />
                    <Text style={s.resVal}>{fmtUSD(r.valeur)} <Text style={s.resPct}>· {pct.toFixed(0)} %</Text></Text>
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

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {/* ── La vedette de la relation : les échanges en grand, la balance en
          toutes lettres, les trois chiffres sous filets ── */}
      <View style={s.vedette}>
        <Text style={s.etiquette} numberOfLines={1}>
          ÉCHANGES BILATÉRAUX{bilat?.annee_min ? ` · ${bilat.annee_min} — ${bilat.annee_max}` : ""}
        </Text>
        {totalEchanges > 0 ? (
          <>
            <ChiffreAnime texte={fmtUSD(totalEchanges)} style={s.nombre} />
            <Text style={s.balancePhrase}>
              {diff === 0
                ? <>Échanges <Text style={{ fontFamily: POLICE.gras, color: T.encre }}>équilibrés</Text> sur la période.</>
                : <>Balance excédentaire en faveur {diff >= 0 ? "du " : "de "}
                    <Text style={{ fontFamily: POLICE.gras, color: diff >= 0 ? COL_SEN_() : COL_AUTRE }}>{diff >= 0 ? "Sénégal" : autreNom}</Text>
                    <Text style={{ fontFamily: POLICE.gras, color: diff >= 0 ? COL_SEN_() : COL_AUTRE }}>  +{fmtUSD(Math.abs(diff))}</Text>
                  </>}
            </Text>
          </>
        ) : (
          <Text style={s.balancePhrase}>Aucun échange enregistré entre les deux pays.</Text>
        )}
        <View style={s.faits}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>ACCORD{accs.length > 1 ? "S" : ""}</Text>
            <Text style={[s.faitVal, accs.length === 0 && { color: T.grisClair }]}>{accs.length}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1.5, minWidth: 0 }}>
            <Text style={s.faitLabel}>ENTREPRISES AU SÉNÉGAL</Text>
            <Text style={[s.faitVal, !(entSiege?.total) && { color: T.grisClair }]}>{entSiege?.total ?? 0}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1.2, minWidth: 0 }}>
            <Text style={s.faitLabel}>ORGANISATIONS</Text>
            <Text style={[s.faitVal, grps.length === 0 && { color: T.grisClair }]}>{grps.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Organisations communes ── */}
      {grps.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={s.secTitle}>ORGANISATIONS COMMUNES</Text>
          <View style={s.chips}>
            {grps.map((g: any) => (
              <View key={g.code || g.nom} style={s.chip}><Text style={s.chipTexte}>{g.code || g.nom}</Text></View>
            ))}
          </View>
        </View>
      )}

      {/* ── Accords signés — chaque ligne ouvre la fiche ── */}
      {accs.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={s.secTitle}>{accs.length > 1 ? "ACCORDS SIGNÉS" : "ACCORD SIGNÉ"}</Text>
          <View style={s.surface}>
            {accs.map((ac: any, i: number) => (
              <Tapable key={i} onPress={() => setAccordOuvert(ac)} echelle={0.99}
                style={[s.rangeeItem, i > 0 && s.rangeeBord]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemTitre} numberOfLines={2}>{ac.titre}</Text>
                  {ac.date_signature ? <Text style={s.itemSous}>Signé en {ac.date_signature.slice(0, 4)}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
              </Tapable>
            ))}
          </View>
        </View>
      )}

      {/* ── Entreprises installées au Sénégal ── */}
      {ents.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={s.secTitle}>ENTREPRISES AU SÉNÉGAL</Text>
          <View style={s.surface}>
            {entsVisibles.map((e: any, i: number) => (
              <Tapable key={e.id} onPress={() => ouvrirEntreprise(e.id)} echelle={0.99}
                style={[s.rangeeItem, i > 0 && s.rangeeBord]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TexteDefilant style={s.itemTitre} texte={e.nom} />
                  {(e.region || e.forme_juridique) ? <Text style={s.itemSous} numberOfLines={1}>{[e.forme_juridique, e.region].filter(Boolean).join(" · ")}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={T.grisClair} />
              </Tapable>
            ))}
            {ents.length > 6 && (
              <Tapable onPress={() => setToutesEnts(v => !v)} style={[s.rangeeItem, s.rangeeBord, { justifyContent: "center" }]}>
                <Text style={s.voirTout}>{toutesEnts ? "Réduire" : `Afficher les ${ents.length - 6} autres`}</Text>
              </Tapable>
            )}
          </View>
        </View>
      )}

      {/* ── Indicateurs en duels ── */}
      <View style={{ marginTop: 22 }}>
        {/* Titre + légende des deux couleurs sur la même ligne */}
        <View style={s.indicEntete}>
          <Text style={[s.secTitle, { marginBottom: 0 }]}>INDICATEURS</Text>
          <View style={s.legendeCouleurs}>
            <View style={s.legendeItem}><View style={[s.legendePoint, { backgroundColor: COL_SEN_() }]} /><Text style={s.legendeTexte}>Sénégal</Text></View>
            <View style={s.legendeItem}><View style={[s.legendePoint, { backgroundColor: COL_AUTRE }]} /><TexteDefilant style={s.legendeTexte} texte={colAutre?.nom || autreNom} /></View>
          </View>
        </View>
        {cats.map(cat => (
          <Fragment key={cat}>
            <Text style={s.categorie}>{cat.toUpperCase()}</Text>
            <View style={[s.surface, { paddingVertical: 4 }]}>
              {parCat[cat].map((ind, i) => (
                <View key={ind.code} style={i > 0 ? s.rangeeBord : undefined}>
                  <Duel ind={ind} />
                </View>
              ))}
            </View>
          </Fragment>
        ))}
      </View>

      {/* ── Le détail des échanges, par sens ── */}
      {bilat && (ab > 0 || ba > 0) && (
        <View style={{ marginTop: 22 }}>
          <Text style={s.secTitle}>{`DÉTAIL DES ÉCHANGES${bilat.annee_min ? ` · ${bilat.annee_min}–${bilat.annee_max}` : ""}`}</Text>
          <View style={{ gap: 8 }}>
            <BlocDir de="Sénégal" vers={autreNom} couleur={COL_SEN_()} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
            <BlocDir de={autreNom} vers="Sénégal" couleur={COL_AUTRE} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
          </View>
        </View>
      )}

      <Text style={s.note}>Dernière année disponible pour chaque indicateur · sources : plateforme APIX & CNUCED</Text>

      {accordOuvert && <AccordSheet accord={accordOuvert} onClose={() => setAccordOuvert(null)} />}
      {entOuverte && <EntrepriseSheet entreprise={entOuverte} onClose={() => setEntOuverte(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  // La vedette — le gabarit des cartes vedettes de l'app
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, marginTop: 14, overflow: "hidden",
  },
  etiquette: { ...TYPO.micro, color: T.gris },
  nombre: { fontSize: 34, lineHeight: 40, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.8, marginTop: 8, fontVariant: ["tabular-nums"] },
  balancePhrase: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 18, marginTop: 4 },
  faits: {
    flexDirection: "row", alignItems: "center", marginTop: 12,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 12 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },

  secTitle: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: T.carte, borderWidth: 1, borderColor: T.carteBord, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },

  surface: { backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord, overflow: "hidden" },
  rangeeItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11.5 },
  rangeeBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  itemTitre: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 17 },
  itemSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  voirTout: { fontSize: 12, fontFamily: POLICE.demi, color: T.bleu },

  indicEntete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  legendeCouleurs: { flexDirection: "row", gap: 14, flexShrink: 1 },
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

  dir: { backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord, overflow: "hidden" },
  dirEntete: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dirSens: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  dirDe: { fontSize: 13.5, fontFamily: POLICE.gras, flexShrink: 1, letterSpacing: -0.2 },
  dirVers: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.encre, flexShrink: 1, letterSpacing: -0.2 },
  dirDepChip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dirDepTexte: { fontSize: 10, fontFamily: POLICE.demi },
  dirTotal: { fontSize: 15.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"], letterSpacing: -0.2 },
  dirTotalLabel: { fontSize: 7.5, fontFamily: POLICE.gras, color: T.grisClair, letterSpacing: 1.2 },
  dirRes: { paddingHorizontal: 16, paddingBottom: 14, gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure, paddingTop: 12 },
  resLigne: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  resNom: { flex: 1, fontSize: 11.5, fontFamily: POLICE.moyen, color: T.texte },
  resVal: { fontSize: 11.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  resPct: { fontFamily: POLICE.normal, color: T.grisClair },
  resBarFond: { height: 5, backgroundColor: T.grille, borderRadius: 99, overflow: "hidden" },
  resBar: { height: "100%", borderRadius: 99 },

  note: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, lineHeight: 16, marginTop: 20, textAlign: "center" },
}));
