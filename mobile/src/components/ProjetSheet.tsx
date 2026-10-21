// Fiche projet — éditoriale, comme les autres fiches : identité (titre en
// grand, une ligne de méta territoriale pôle · région · département), une
// rangée de faits Investissement | Début sous filets — les deux chiffres
// qu'on vient chercher — puis des sections plates : description, thématiques
// NAEMA, porteurs et points focaux (téléphones et emails TAPPABLES : le
// téléphone sait appeler), documents.
import { Linking, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import TexteRiche from "@/components/TexteRiche";
import { Bloc, EnTeteSection, Groupe, GroupeDocuments, Ligne, LigneValeur } from "@/components/ListeIOS";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import { API } from "@/lib/api";
import { fmtDateLong, fmtIntervalleDevise, fmtMontantDevise } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { coin, FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

const DEVISE_SYM: Record<string, string> = { XOF: "FCFA", USD: "$", EUR: "€", GBP: "£", CNY: "¥" };
const devSym = (code?: string, sym?: string) => sym || (code ? DEVISE_SYM[code] || code : "");

// Montant d'investissement : valeur unique ou intervalle, à l'échelle de sa
// devise — « 45 Md FCFA », « 200 — 600 M FCFA ». Écrit en entier
// (« 200 000 000 — 600 000 000 FCFA »), il ne tenait pas dans sa case et se
// coupait au milieu du second montant.
export function fmtInvest(p: any): string | null {
  const sym = devSym(p.devise_code, p.devise_symbole);
  if (!p.investissement_est_intervalle)
    return p.investissement ? fmtMontantDevise(Number(p.investissement), sym) : null;
  if (!p.investissement_min) return null;
  return fmtIntervalleDevise(Number(p.investissement_min), p.investissement_max ? Number(p.investissement_max) : null, sym);
}

const ouvrirTel = (t: string) => Linking.openURL(`tel:${t.replace(/[^\d+]/g, "")}`).catch(() => {});
const ouvrirMail = (m: string) => Linking.openURL(`mailto:${m.trim()}`).catch(() => {});

// La fiche se lit en listes groupées, sur iOS comme sur Android (ListeIOS) :
// les deux chiffres dans un bloc blanc, la description et les thématiques
// dans le leur, un groupe par personne (CarteContact), les documents en
// liste.

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

// Carte contact (porteur ou point focal) — partagée avec la fiche prospect.
// Un groupe par personne, comme une fiche Contacts : le nom, puis chaque
// numéro et chaque adresse sur sa ligne, d'un toucher
export function CarteContact({ nom, sous, telephones, mails }: { nom: string; sous?: string | null; telephones: string[]; mails: string[] }) {
  return (
    <Groupe>
      <Ligne gras label={nom} legende={sous || undefined} />
      {telephones.map((t, i) => (
        <LigneValeur key={`t${i}`} label="Téléphone" valeur={fmtPhone(t.trim())} onPress={() => ouvrirTel(t)} />
      ))}
      {mails.map((m, i) => (
        <LigneValeur key={`m${i}`} label="E-mail" valeur={m.trim()} onPress={() => ouvrirMail(m)} />
      ))}
    </Groupe>
  );
}

export default function ProjetSheet({ projet: p, onClose }: { projet: any; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
  const invest = fmtInvest(p);
  const porteurs: any[] = Array.isArray(p.porteurs) ? p.porteurs : [];
  const focaux: any[] = Array.isArray(p.points_focaux) ? p.points_focaux : [];
  const fichiers: any[] = Array.isArray(p.fichiers) ? p.fichiers : [];
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];

  const meta = [p.pole_nom, p.region_nom, p.departement_nom, p.arrondissement_nom]
    .filter(Boolean).join(" · ");

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={p.titre_projet}
      sousEntete={meta ? <Text style={s.meta} numberOfLines={2}>{meta}</Text> : undefined}>

      {/* ── Les deux chiffres qu'on vient chercher ── */}
      {(invest || p.date_debut) ? (
        <View style={s.faits}>
          <View style={{ flex: 1.4, minWidth: 0 }}>
            <Text style={s.faitLabel}>INVESTISSEMENT</Text>
            <Text style={[s.faitVal, !invest && { color: T.grisClair }]} numberOfLines={1}
              adjustsFontSizeToFit minimumFontScale={0.8}>{invest || "—"}</Text>
          </View>
          <View style={s.faitSep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.faitLabel}>DÉBUT</Text>
            <Text style={[s.faitVal, !p.date_debut && { color: T.grisClair }]} numberOfLines={1}>
              {p.date_debut ? fmtDateLong(p.date_debut) : "—"}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Description ── */}
      {p.description ? (
        <Section titre="Description">
          <TexteRiche html={p.description} couleur={T.texte as any} fontSize={13} lineHeight={21} />
        </Section>
      ) : null}

      {/* ── Thématiques du projet — hiérarchie NAEMA partagée ── */}
      {(secIds.length > 0 || braIds.length > 0) ? (
        <Section titre="Thématiques du projet">
          <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
        </Section>
      ) : null}

      {/* ── Porteurs — les personnes, avec leurs actions ── */}
      {porteurs.length > 0 ? (
        <Section titre={porteurs.length > 1 ? "Porteurs du projet" : "Porteur du projet"} liste>
          <View style={{ gap: 12 }}>
            {porteurs.map((por: any, i: number) => (
              <CarteContact key={i} nom={por.nom || "—"}
                telephones={(por.telephones || []).filter(Boolean)} mails={(por.mails || []).filter(Boolean)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Points focaux ── */}
      {focaux.length > 0 ? (
        <Section titre="Points focaux" liste>
          <View style={{ gap: 12 }}>
            {focaux.map((pf: any, i: number) => (
              <CarteContact key={i} nom={[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}
                telephones={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"} liste>
          <GroupeDocuments fichiers={fichiers}
            ouvrir={f => ouvrirDoc(`${API}/projets/${p.id}/fichiers/${f.id}/download`, f.titre || f.nom)} />
        </Section>
      ) : null}
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7, lineHeight: 18 },

  // Les chiffres dans un bloc blanc du groupe
  faits: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord, borderRadius: coin(16), borderCurve: "continuous", paddingVertical: 14, paddingHorizontal: 16,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 14 },
  faitLabel: { fontSize: 8.5, ...FONTE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 14, ...FONTE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
}));
