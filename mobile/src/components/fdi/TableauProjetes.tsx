// Investissements projetés — le tableau de bord de l'onglet Investissements.
//
// TROIS QUESTIONS, TROIS CARTES, celles qu'on pose depuis Dakar :
//   1. Que reçoit le pays ?        — le montant annoncé, sa courbe.
//   2. Qui pense à lui ?           — les intentions qui le visent, et son rang
//                                    parmi les destinations africaines.
//   3. Qui y est déjà venu ?       — les groupes qui y ont annoncé un projet.
//
// CHAQUE CARTE TIENT EN TROIS GESTES DE LECTURE : un grand nombre, une ligne
// qui le situe, de quoi aller plus loin. Le pays se choisit une seule fois,
// en tête — les trois questions portent sur le même. Aucun paragraphe :
// ce qui demande une explication se lit dans la liste ou dans le rapport.
//
// QUATRE REQUÊTES LÉGÈRES, une par question, plutôt que trois rapports — et
// le préchargement de l'accueil les met en cache : l'onglet s'ouvre aussi
// hors ligne.
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import GrapheLignes from "@/components/GrapheLignes";
import Icone from "@/components/Icone";
import { Os } from "@/components/Squelette";
import { ChiffreAnime, Tapable } from "@/components/ui";
import { enPanne } from "@/lib/api";
import { creerStyles, useCouleur } from "@/lib/apparence";
import {
  CLE_INVESTISSEURS_AFRIQUE, CLE_SIGNAUX_AFRIQUE, type ReponseEntreprises, type ReponseProjets,
  type ReponseSignaux, accorder, chargerInvestisseursAfrique, chargerSignauxAfrique,
  chargerTableauInvestisseurs, chargerTableauProjets, chargerTableauSignaux, cleTableauInvestisseurs,
  cleTableauProjets, cleTableauSignaux, fmtEntier, fmtMontant, fmtPart, periodeEnClair,
} from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { ECHELLE, POLICE, T, TYPO } from "@/theme";
import { Drapeau } from "./AtomesFdi";

const MINUTE = 60 * 1000;

/** « 1ʳᵉ », « 23ᵉ » — le rang d'une destination, écrit comme on le lit. */
const rangEnClair = (n: number) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);

export default function TableauProjetes({ pays, onChoisirPays }: {
  pays: string; onChoisirPays: () => void;
}) {
  const router = useRouter();
  const projets = useQuery({ queryKey: cleTableauProjets(pays), queryFn: () => chargerTableauProjets(pays), staleTime: 10 * MINUTE });
  const signaux = useQuery({ queryKey: cleTableauSignaux(pays), queryFn: () => chargerTableauSignaux(pays), staleTime: 10 * MINUTE });
  const afrique = useQuery({ queryKey: CLE_SIGNAUX_AFRIQUE, queryFn: chargerSignauxAfrique, staleTime: 10 * MINUTE });
  const investisseurs = useQuery({ queryKey: cleTableauInvestisseurs(pays), queryFn: () => chargerTableauInvestisseurs(pays), staleTime: 10 * MINUTE });
  const tousInvest = useQuery({ queryKey: CLE_INVESTISSEURS_AFRIQUE, queryFn: chargerInvestisseursAfrique, staleTime: 10 * MINUTE });

  const ouvrirListe = (params: Record<string, string>) => {
    tick();
    router.push({ pathname: "/investissements-projetes", params } as any);
  };
  const ouvrirRapport = (vue: string, f: object) => {
    tick();
    router.push({ pathname: "/investissements-projetes/rapport", params: { vue, f: JSON.stringify(f) } } as any);
  };

  return (
    <View style={s.page}>
      {/* LE PAYS, UNE FOIS : les trois cartes en dépendent */}
      <Pressable onPress={() => { tick(); onChoisirPays(); }} style={s.pays} hitSlop={6}
        accessibilityRole="button" accessibilityLabel={`Pays : ${pays}. Changer`}>
        <Text style={s.paysNom} numberOfLines={1}>{pays}</Text>
        <Icone sf="chevron.down" materiel="expand_more" taille={24} couleur={T.bleu} />
      </Pressable>

      <CarteProjets q={projets} pays={pays}
        onListe={() => ouvrirListe({ vue: "projets", pays })}
        onRapport={() => ouvrirRapport("projets", { echelle: "pays", pays, region: null, sens: "destination" })} />
      <CarteSignaux q={signaux} afrique={afrique} pays={pays}
        onListe={() => ouvrirListe({ vue: "signaux", destination: pays })}
        onRapport={() => ouvrirRapport("signaux", {})} />
      <CarteInvestisseurs q={investisseurs} tous={tousInvest}
        onListe={() => ouvrirListe({ vue: "entreprises", destinations: pays })}
        onRapport={() => ouvrirRapport("entreprises", {})} />

      <Text style={s.source}>Source : fDi Markets (Financial Times)</Text>
    </View>
  );
}

// ── 1. Ce que le pays reçoit ─────────────────────────────────────────────────

function CarteProjets({ q, pays, onListe, onRapport }: {
  q: UseQueryResult<ReponseProjets>; pays: string; onListe: () => void; onRapport: () => void;
}) {
  const bleu = useCouleur(T.bleu) as unknown as string;
  const d = q.data;
  const k = d?.kpis;
  return (
    <Carte etiquette="Investissements annoncés">
      {!d || !k ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : k.projets === 0 ? (
        <Text style={s.vide}>Aucun projet relevé pour ce pays.</Text>
      ) : (
        <>
          <ChiffreAnime texte={fmtMontant(k.capex_musd)} style={[s.nombre, { color: bleu }]} />
          <Text style={s.situation}>
            {[`${fmtEntier(k.projets)} ${accorder(k.projets, "projet")}`,
              k.emplois ? `${fmtEntier(k.emplois)} emplois` : null,
              periodeEnClair(k.annees)].filter(Boolean).join(" · ")}
          </Text>
          <View style={s.graphe}>
            <GrapheLignes hauteur={130} fmt={fmtMontant} epure
              series={[{ nom: "Investissements annoncés", couleur: bleu,
                data: d.par_annee.map(a => ({ annee: a.annee, valeur: a.capex_musd })) }]} />
          </View>
          <Liens couleur={bleu} liens={[
            { texte: `Voir les ${fmtEntier(k.projets)} ${accorder(k.projets, "projet")}`, onPress: onListe },
            { texte: "Rapport", detail: pays, onPress: onRapport },
          ]} />
        </>
      )}
    </Carte>
  );
}

// ── 2. Les intentions qui le visent ──────────────────────────────────────────

function CarteSignaux({ q, afrique, pays, onListe, onRapport }: {
  q: UseQueryResult<ReponseSignaux>; afrique: UseQueryResult<ReponseSignaux>; pays: string;
  onListe: () => void; onRapport: () => void;
}) {
  const orange = useCouleur(T.orange) as unknown as string;
  const d = q.data;
  // Le rang parmi les destinations africaines : le Sénégal y est toujours,
  // épinglé par le serveur ; un autre pays n'y figure que dans les dix
  // premiers — sinon on se tait plutôt que d'inventer un rang
  const place = afrique.data?.tops.destinations?.find(x => x.nom === pays);
  const serie = (d?.par_annee ?? []).map(a => ({ annee: a.annee, valeur: a.nb }));
  return (
    <Carte etiquette="Signaux d'investissement">
      {!d ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : (
        <>
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtEntier(d.kpis.signaux)} style={[s.nombre, { color: orange }]} />
            <Text style={s.unite}>{d.kpis.signaux > 1 ? "intentions" : "intention"}</Text>
          </View>
          <Text style={s.situation}>
            {[place?.rang ? `${rangEnClair(place.rang)} destination africaine` : null,
              periodeEnClair(d.kpis.annees)].filter(Boolean).join(" · ") || "Destination africaine"}
          </Text>
          {serie.length > 1 && (
            <View style={s.graphe}>
              <GrapheLignes hauteur={96} fmt={fmtEntier} epure
                series={[{ nom: "Signaux", couleur: orange, data: serie }]} />
            </View>
          )}
          <Liens couleur={orange} liens={[
            { texte: d.kpis.signaux > 1 ? `Voir les ${fmtEntier(d.kpis.signaux)} signaux` : "Voir le signal", onPress: onListe },
            { texte: "Rapport", detail: "Afrique", onPress: onRapport },
          ]} />
        </>
      )}
    </Carte>
  );
}

// ── 3. Les groupes déjà venus ────────────────────────────────────────────────

function CarteInvestisseurs({ q, tous, onListe, onRapport }: {
  q: UseQueryResult<ReponseEntreprises>; tous: UseQueryResult<ReponseEntreprises>;
  onListe: () => void; onRapport: () => void;
}) {
  const vert = useCouleur(T.vert) as unknown as string;
  const d = q.data;
  const total = tous.data?.total ?? null;
  return (
    <Carte etiquette="Investisseurs présents">
      {!d ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : (
        <>
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtEntier(d.total)} style={[s.nombre, { color: vert }]} />
            <Text style={s.unite}>{d.total > 1 ? "groupes" : "groupe"}</Text>
          </View>
          {total != null && (
            <Text style={s.situation}>{fmtPart(d.total, total)} des investisseurs présents en Afrique</Text>
          )}
          {/* Les plus présents, au nombre de projets annoncés DANS le pays */}
          {d.entreprises.length > 0 && (
            <View style={s.top}>
              {d.entreprises.slice(0, 3).map(e => (
                <View key={`${e.nom}|${e.origine ?? ""}`} style={s.topLigne}>
                  <Drapeau iso={e.origine_iso} taille={14} />
                  <Text style={s.topNom} numberOfLines={1}>{e.nom}</Text>
                  <Text style={s.topValeur}>{fmtEntier(e.projets)} {accorder(e.projets, "projet")}</Text>
                </View>
              ))}
            </View>
          )}
          <Liens couleur={vert} liens={[
            { texte: d.total > 1 ? `Voir les ${fmtEntier(d.total)} investisseurs` : "Voir l'investisseur", onPress: onListe },
            { texte: "Rapport", detail: "Afrique", onPress: onRapport },
          ]} />
        </>
      )}
    </Carte>
  );
}

// ── Briques ──────────────────────────────────────────────────────────────────

function Carte({ etiquette, children }: { etiquette: string; children: React.ReactNode }) {
  return (
    <View style={s.carte}>
      <Text style={s.etiquette} accessibilityRole="header">{etiquette.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/** Les suites possibles, en rangées de liste : la première dans la couleur de
    la carte, la seconde à l'encre. Pas de bouton plein — la carte porte déjà
    son grand nombre, deux aplats de plus la feraient crier. */
function Liens({ couleur, liens }: {
  couleur: string; liens: { texte: string; detail?: string; onPress: () => void }[];
}) {
  return (
    <View style={s.liens}>
      {liens.map((l, i) => (
        <Tapable key={l.texte} onPress={l.onPress} echelle={0.99} style={s.lien}
          accessibilityRole="button" accessibilityLabel={l.detail ? `${l.texte} ${l.detail}` : l.texte}>
          <Text style={[s.lienTexte, i === 0 && { color: couleur, fontFamily: POLICE.gras }]} numberOfLines={1}
            maxFontSizeMultiplier={ECHELLE.texte}>{l.texte}</Text>
          {l.detail ? <Text style={s.lienDetail} numberOfLines={1}>{l.detail}</Text> : <View style={{ flex: 1 }} />}
          <Icone sf="chevron.right" materiel="chevron_right" taille={18} couleur={T.grisClair} />
        </Tapable>
      ))}
    </View>
  );
}

function Attente() {
  return (
    <View style={{ gap: 10, marginTop: 6, marginBottom: 14 }}>
      <Os style={{ height: 36, width: "50%", borderRadius: 8 }} />
      <Os style={{ height: 11, width: "64%" }} />
      <Os style={{ height: 96, width: "100%", borderRadius: 12 }} />
    </View>
  );
}

function Indispo({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable onPress={onRetry} style={{ paddingVertical: 12 }} accessibilityRole="button">
      <Text style={s.vide}>Données indisponibles. Toucher pour réessayer.</Text>
    </Pressable>
  );
}

const s = creerStyles(() => ({
  page: { paddingHorizontal: 16, paddingTop: 22, gap: 14 },
  pays: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingHorizontal: 4, marginBottom: 2 },
  paysNom: { fontSize: 27, lineHeight: 33, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.6 },

  // La carte vedette des investissements réalisés, à l'arrondi près
  carte: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 18, paddingTop: 17, paddingBottom: 4,
  },
  etiquette: { ...TYPO.micro, color: T.gris },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  unite: { fontSize: 15, fontFamily: POLICE.demi, color: T.gris },
  situation: { fontSize: 13, lineHeight: 19, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  graphe: { marginTop: 8, marginHorizontal: -4 },
  vide: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, paddingVertical: 14 },

  top: { marginTop: 14, gap: 10 },
  topLigne: { flexDirection: "row", alignItems: "center", gap: 9 },
  topNom: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: POLICE.demi, color: T.encre },
  topValeur: { fontSize: 13, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  liens: { marginTop: 12 },
  lien: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  lienTexte: { flexShrink: 1, fontSize: 15, fontFamily: POLICE.demi, color: T.encre },
  lienDetail: { flex: 1, textAlign: "right", fontSize: 13, fontFamily: POLICE.normal, color: T.gris },

  source: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 6 },
}));
