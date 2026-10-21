// Investissements projetés — le tableau de bord de l'onglet Investissements.
//
// TROIS QUESTIONS, TROIS CARTES, celles qu'on pose depuis Dakar :
//   1. Que reçoit le pays ?   — le montant annoncé, sa tendance, ses derniers
//                               projets ;
//   2. Qui pense à lui ?      — les intentions qui le visent, son rang parmi
//                               les destinations africaines, les dernières ;
//   3. Qui y est déjà venu ?  — les groupes qui y ont annoncé un projet, les
//                               derniers venus.
//
// LA GRAMMAIRE DES CARTES DE L'IDE, sans rien de plus : le grand nombre, une
// ligne qui le situe, la mini-tendance (MiniTendance — la courbe seule et ses
// deux années aux bornes : ni pic, ni curseur, ni graduations), puis les
// trois derniers venus — drapeau d'origine, nom, mois — et le lien vers la
// liste entière. Toucher une ligne ouvre sa fiche, comme dans la liste.
//
// PAS DE RAPPORT : ils vivent sur le site. Le pays se choisit une seule fois,
// en tête — les trois questions portent sur le même.
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { Os } from "@/components/Squelette";
import { ChiffreAnime, Tapable } from "@/components/ui";
import { enPanne } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import {
  CLE_INVESTISSEURS_AFRIQUE, CLE_RANGS_AFRIQUE, type Investisseur, type ProjetFdi,
  type RangSignaux, type ReponseEntreprises, type Signal, type TableauProjets, type TableauSignaux,
  accorder, chargerInvestisseursAfrique, chargerRangsAfrique, chargerTableauInvestisseurs,
  chargerTableauProjets, chargerTableauSignaux, cleTableauInvestisseurs, cleTableauProjets,
  cleTableauSignaux, fmtEntier, fmtMontant, fmtPart, moisEnClair, periodeEnClair,
} from "@/lib/fdi";
import { tick } from "@/lib/haptique";
import { ECHELLE, POLICE, T, TYPO } from "@/theme";
import { Drapeau } from "./AtomesFdi";
import { FicheInvestisseurSheet, FicheProjetFdi, FicheSignal } from "./FichesFdi";

const MINUTE = 60 * 1000;

/** « 1ʳᵉ », « 23ᵉ » — le rang d'une destination, écrit comme on le lit. */
const rangEnClair = (n: number) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);

/** La série annuelle, sans trou : une année sans annonce compte pour zéro —
    sinon la courbe relierait 2012 à 2016 comme deux années voisines. */
function serieAnnuelle<L extends { annee: number }>(lignes: L[], valeur: (l: L) => number | null) {
  if (!lignes.length) return [];
  const parAnnee = new Map(lignes.map(l => [l.annee, valeur(l) ?? 0]));
  const annees = lignes.map(l => l.annee);
  const points: { annee: number; valeur: number }[] = [];
  for (let a = Math.min(...annees); a <= Math.max(...annees); a++) points.push({ annee: a, valeur: parAnnee.get(a) ?? 0 });
  return points;
}

type Ouvert =
  | { type: "projet"; p: ProjetFdi }
  | { type: "signal"; s: Signal }
  | { type: "investisseur"; e: Investisseur };

export default function TableauProjetes({ pays, onChoisirPays }: {
  pays: string; onChoisirPays: () => void;
}) {
  const router = useRouter();
  // La liste s'ouvre dans la pile où l'on est : celle de l'onglet
  // Investissements, ou celle de l'Accueil quand on vient de lui (iOS)
  const depuisAccueil = useSegments().includes("(accueil)" as never);
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const projets = useQuery({ queryKey: cleTableauProjets(pays), queryFn: () => chargerTableauProjets(pays), staleTime: 10 * MINUTE });
  const signaux = useQuery({ queryKey: cleTableauSignaux(pays), queryFn: () => chargerTableauSignaux(pays), staleTime: 10 * MINUTE });
  const rangs = useQuery({ queryKey: CLE_RANGS_AFRIQUE, queryFn: chargerRangsAfrique, staleTime: 10 * MINUTE });
  const investisseurs = useQuery({ queryKey: cleTableauInvestisseurs(pays), queryFn: () => chargerTableauInvestisseurs(pays), staleTime: 10 * MINUTE });
  const totalAfrique = useQuery({ queryKey: CLE_INVESTISSEURS_AFRIQUE, queryFn: chargerInvestisseursAfrique, staleTime: 10 * MINUTE });

  const ouvrirListe = (params: Record<string, string>) => {
    tick();
    router.push({ pathname: depuisAccueil ? "/projetes" : "/investissements/projetes", params } as any);
  };

  return (
    <View style={s.page}>
      {/* LE PAYS, UNE FOIS : les trois cartes en dépendent */}
      <Pressable onPress={() => { tick(); onChoisirPays(); }} style={s.pays} hitSlop={6}
        accessibilityRole="button" accessibilityLabel={`Pays : ${pays}. Changer`}>
        <Text style={s.paysNom} numberOfLines={1}>{pays}</Text>
        <Icone sf="chevron.down" materiel="expand_more" taille={24} couleur={T.bleu} />
      </Pressable>

      <CarteProjets q={projets} onOuvrir={p => setOuvert({ type: "projet", p })}
        onListe={() => ouvrirListe({ vue: "projets", pays })} />
      <CarteSignaux q={signaux} rangs={rangs.data} pays={pays} onOuvrir={sg => setOuvert({ type: "signal", s: sg })}
        onListe={() => ouvrirListe({ vue: "signaux", destination: pays })} />
      <CarteInvestisseurs q={investisseurs} totalAfrique={totalAfrique.data ?? null}
        onOuvrir={e => setOuvert({ type: "investisseur", e })}
        onListe={() => ouvrirListe({ vue: "entreprises", destinations: pays })} />

      {ouvert?.type === "projet" && <FicheProjetFdi p={ouvert.p} onClose={() => setOuvert(null)} />}
      {ouvert?.type === "signal" && <FicheSignal s={ouvert.s} onClose={() => setOuvert(null)} />}
      {ouvert?.type === "investisseur" && <FicheInvestisseurSheet e={ouvert.e} onClose={() => setOuvert(null)} />}
    </View>
  );
}

// ── 1. Ce que le pays reçoit ─────────────────────────────────────────────────

function CarteProjets({ q, onOuvrir, onListe }: {
  q: UseQueryResult<TableauProjets>; onOuvrir: (p: ProjetFdi) => void; onListe: () => void;
}) {
  const d = q.data;
  return (
    <Carte etiquette="Investissements annoncés">
      {!d ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : d.kpis.projets === 0 ? (
        <Text style={s.vide}>Aucun projet relevé pour ce pays.</Text>
      ) : (
        <>
          <ChiffreAnime texte={fmtMontant(d.kpis.capex_musd)} style={[s.nombre, { color: T.bleu }]} />
          <Text style={s.situation}>
            {[`${fmtEntier(d.kpis.projets)} ${accorder(d.kpis.projets, "projet")}`,
              d.kpis.emplois ? `${fmtEntier(d.kpis.emplois)} emplois` : null,
              periodeEnClair(d.kpis.annees)].filter(Boolean).join(" · ")}
          </Text>
          <Tendance points={serieAnnuelle(d.par_annee, a => a.capex_musd)} couleur={T.bleu as string} />
          <Derniers lignes={d.projets.map(p => ({
            cle: String(p.id), iso: p.partenaire_iso, nom: p.entreprise ?? "—",
            date: moisEnClair(p.periode), onPress: () => onOuvrir(p),
          }))} />
          <Lien couleur={T.bleu as string} onPress={onListe}
            texte={`Voir les ${fmtEntier(d.kpis.projets)} ${accorder(d.kpis.projets, "projet")}`} />
        </>
      )}
    </Carte>
  );
}

// ── 2. Les intentions qui le visent ──────────────────────────────────────────

function CarteSignaux({ q, rangs, pays, onOuvrir, onListe }: {
  q: UseQueryResult<TableauSignaux>; rangs: RangSignaux[] | undefined; pays: string;
  onOuvrir: (sg: Signal) => void; onListe: () => void;
}) {
  const d = q.data;
  // Le rang parmi les destinations africaines : le Sénégal y est toujours,
  // épinglé par le serveur ; un autre pays n'y figure que dans les dix
  // premiers — sinon on se tait plutôt que d'inventer un rang
  const place = rangs?.find(x => x.nom === pays);
  return (
    <Carte etiquette="Signaux d'investissement">
      {!d ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : d.kpis.signaux === 0 ? (
        <Text style={s.vide}>Aucune intention relevée pour ce pays.</Text>
      ) : (
        <>
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtEntier(d.kpis.signaux)} style={[s.nombre, { color: T.orange }]} />
            <Text style={s.unite}>{d.kpis.signaux > 1 ? "intentions" : "intention"}</Text>
          </View>
          <Text style={s.situation}>
            {[place?.rang ? `${rangEnClair(place.rang)} destination africaine` : null,
              periodeEnClair(d.kpis.annees)].filter(Boolean).join(" · ") || "Destination africaine"}
          </Text>
          <Tendance points={serieAnnuelle(d.par_annee, a => a.nb)} couleur={T.orange as string} />
          <Derniers lignes={d.signaux.map(sg => ({
            cle: String(sg.id), iso: sg.origine_iso, nom: sg.entreprise ?? "—",
            date: moisEnClair(sg.periode), onPress: () => onOuvrir(sg),
          }))} />
          <Lien couleur={T.orange as string} onPress={onListe}
            texte={d.kpis.signaux > 1 ? `Voir les ${fmtEntier(d.kpis.signaux)} signaux` : "Voir le signal"} />
        </>
      )}
    </Carte>
  );
}

// ── 3. Les groupes déjà venus ────────────────────────────────────────────────

function CarteInvestisseurs({ q, totalAfrique, onOuvrir, onListe }: {
  q: UseQueryResult<ReponseEntreprises>; totalAfrique: number | null;
  onOuvrir: (e: Investisseur) => void; onListe: () => void;
}) {
  const d = q.data;
  return (
    <Carte etiquette="Investisseurs présents">
      {!d ? (
        enPanne(q) ? <Indispo onRetry={() => q.refetch()} /> : <Attente />
      ) : d.total === 0 ? (
        <Text style={s.vide}>Aucun investisseur relevé pour ce pays.</Text>
      ) : (
        <>
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtEntier(d.total)} style={[s.nombre, { color: T.vert }]} />
            <Text style={s.unite}>{d.total > 1 ? "groupes" : "groupe"}</Text>
          </View>
          {totalAfrique != null && (
            <Text style={s.situation}>{fmtPart(d.total, totalAfrique)} des investisseurs présents en Afrique</Text>
          )}
          {/* Les derniers venus : les groupes dont la dernière annonce dans
              le pays est la plus récente */}
          <Derniers lignes={d.entreprises.map(e => ({
            cle: `${e.nom}|${e.origine ?? ""}`, iso: e.origine_iso, nom: e.nom,
            date: e.dernier ? moisEnClair(e.dernier) : periodeEnClair(e.annees),
            onPress: () => onOuvrir(e),
          }))} />
          <Lien couleur={T.vert as string} onPress={onListe}
            texte={d.total > 1 ? `Voir les ${fmtEntier(d.total)} investisseurs` : "Voir l'investisseur"} />
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

/** La mini-tendance des cartes de l'IDE : la courbe seule, et ses deux années
    aux bornes. La hauteur est réservée avant la mesure — la carte ne saute
    pas quand la courbe arrive. */
function Tendance({ points, couleur }: { points: { annee: number; valeur: number }[]; couleur: string }) {
  const [largeur, setLargeur] = useState(0);
  if (points.length < 2) return null;
  return (
    <>
      <View style={s.tendance} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        {largeur > 0 && <MiniTendance valeurs={points.map(p => p.valeur)} largeur={largeur} couleur={couleur} />}
      </View>
      <View style={s.bornes}>
        <Text style={s.borne}>{points[0].annee}</Text>
        <Text style={s.borne}>{points[points.length - 1].annee}</Text>
      </View>
    </>
  );
}

/** Les trois derniers venus : drapeau d'origine, nom, mois. La place du
    drapeau est gardée même sans drapeau — les noms restent alignés. */
function Derniers({ lignes }: {
  lignes: { cle: string; iso: string | null; nom: string; date: string | null; onPress: () => void }[];
}) {
  if (!lignes.length) return null;
  return (
    <View style={s.derniers}>
      {lignes.map(l => (
        <Tapable key={l.cle} onPress={() => { tick(); l.onPress(); }} echelle={0.99} style={s.dernier}
          accessibilityRole="button" accessibilityLabel={[l.nom, l.date].filter(Boolean).join(", ")}>
          <View style={s.drapeau}><Drapeau iso={l.iso} taille={15} /></View>
          <Text style={s.dernierNom} numberOfLines={1}>{l.nom}</Text>
          {l.date ? <Text style={s.dernierDate} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{l.date}</Text> : null}
        </Tapable>
      ))}
    </View>
  );
}

/** La suite : la liste entière, dans la couleur de la carte. */
function Lien({ texte, couleur, onPress }: { texte: string; couleur: string; onPress: () => void }) {
  return (
    <Tapable onPress={onPress} echelle={0.99} style={s.lien} accessibilityRole="button" accessibilityLabel={texte}>
      <Text style={[s.lienTexte, { color: couleur }]} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.texte}>{texte}</Text>
      <Icone sf="chevron.right" materiel="chevron_right" taille={18} couleur={T.grisClair} />
    </Tapable>
  );
}

function Attente() {
  return (
    <View style={{ gap: 10, marginTop: 6, marginBottom: 14 }}>
      <Os style={{ height: 36, width: "50%", borderRadius: 8 }} />
      <Os style={{ height: 11, width: "64%" }} />
      <Os style={{ height: 56, width: "100%", borderRadius: 12 }} />
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
  vide: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, paddingVertical: 14 },

  // La mini-tendance et ses bornes — les mesures des cartes de l'IDE
  tendance: { marginTop: 10, height: 56 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  derniers: { marginTop: 14 },
  dernier: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  drapeau: { width: 20, alignItems: "center" },
  dernierNom: { flex: 1, minWidth: 0, fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre },
  dernierDate: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, fontVariant: ["tabular-nums"] },

  lien: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  lienTexte: { flexShrink: 1, fontSize: 15, fontFamily: POLICE.gras },

}));
