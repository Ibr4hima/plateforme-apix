// Fiche projet — éditoriale, comme les autres fiches : identité (titre en
// grand, une ligne de méta territoriale pôle · région · département), une
// rangée de faits Investissement | Début sous filets — les deux chiffres
// qu'on vient chercher — puis des sections plates : description, thématiques
// NAEMA, porteurs et points focaux (téléphones et emails TAPPABLES : le
// téléphone sait appeler), documents.
import { Linking, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import Symbole from "@/components/Symbole";
import TexteRiche from "@/components/TexteRiche";
import { Feuille, Tapable } from "@/components/ui";
import { API } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

const DEVISE_SYM: Record<string, string> = { XOF: "FCFA", USD: "$", EUR: "€", GBP: "£", CNY: "¥" };
const devSym = (code?: string, sym?: string) => sym || (code ? DEVISE_SYM[code] || code : "");

// Montant d'investissement : valeur unique ou intervalle (règle du site)
export function fmtInvest(p: any): string | null {
  const sym = devSym(p.devise_code, p.devise_symbole);
  if (!p.investissement_est_intervalle)
    return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
  if (!p.investissement_min) return null;
  const min = Number(p.investissement_min).toLocaleString("fr-FR");
  const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
  return `${min} — ${max} ${sym}`;
}

const ouvrirTel = (t: string) => Linking.openURL(`tel:${t.replace(/[^\d+]/g, "")}`).catch(() => {});
const ouvrirMail = (m: string) => Linking.openURL(`mailto:${m.trim()}`).catch(() => {});

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// Carte contact (porteur ou point focal) : nom + chips téléphone / mail
// tappables — partagée avec la fiche prospect
export function CarteContact({ nom, sous, telephones, mails }: { nom: string; sous?: string | null; telephones: string[]; mails: string[] }) {
  return (
    <View style={s.contact}>
      <View style={s.contactEntete}>
        <Text style={s.contactNom}>{nom}</Text>
        {sous ? <Text style={s.contactSous}>{sous}</Text> : null}
      </View>
      {(telephones.length > 0 || mails.length > 0) && (
        <View style={s.contactChips}>
          {telephones.map((t, i) => (
            <Tapable key={`t${i}`} echelle={0.95} onPress={() => ouvrirTel(t)}
              style={[s.contactChip, { backgroundColor: T.bleuVoile }]}>
              <Text style={[s.contactChipTexte, { color: T.bleu }]}>{fmtPhone(t.trim())}</Text>
            </Tapable>
          ))}
          {mails.map((m, i) => (
            <Tapable key={`m${i}`} echelle={0.95} onPress={() => ouvrirMail(m)}
              style={[s.contactChip, { backgroundColor: "rgba(24,128,56,0.07)" }]}>
              <Text style={[s.contactChipTexte, { color: T.vert }]}>{m.trim()}</Text>
            </Tapable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProjetSheet({ projet: p, onClose }: { projet: any; onClose: () => void }) {
  const invest = fmtInvest(p);
  const porteurs: any[] = Array.isArray(p.porteurs) ? p.porteurs : [];
  const focaux: any[] = Array.isArray(p.points_focaux) ? p.points_focaux : [];
  const fichiers: any[] = Array.isArray(p.fichiers) ? p.fichiers : [];
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];

  const meta = [p.pole_nom, p.region_nom, p.departement_nom, p.arrondissement_nom]
    .filter(Boolean).join("   ·   ");

  return (
    <Feuille onClose={onClose} ecart={22}
      titre={<Text style={s.titre}>{p.titre_projet}</Text>}
      sousEntete={meta ? <Text style={s.meta} numberOfLines={2}>{meta}</Text> : undefined}>

      {/* ── Les deux chiffres qu'on vient chercher ── */}
      {(invest || p.date_debut) ? (
        <View style={s.faits}>
          <View style={{ flex: 1.4, minWidth: 0 }}>
            <Text style={s.faitLabel}>INVESTISSEMENT</Text>
            <Text style={[s.faitVal, !invest && { color: T.grisClair }]} numberOfLines={1}>{invest || "—"}</Text>
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
        <Section titre={porteurs.length > 1 ? "Porteurs du projet" : "Porteur du projet"}>
          <View style={{ gap: 8 }}>
            {porteurs.map((por: any, i: number) => (
              <CarteContact key={i} nom={por.nom || "—"}
                telephones={(por.telephones || []).filter(Boolean)} mails={(por.mails || []).filter(Boolean)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Points focaux ── */}
      {focaux.length > 0 ? (
        <Section titre="Points focaux">
          <View style={{ gap: 8 }}>
            {focaux.map((pf: any, i: number) => (
              <CarteContact key={i} nom={[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}
                telephones={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"}>
          <View style={{ gap: 8 }}>
            {fichiers.map((f: any) => (
              <Tapable key={f.id} echelle={0.98} style={s.doc}
                onPress={() => Linking.openURL(`${API}/projets/${p.id}/fichiers/${f.id}/download`).catch(() => {})}>
                <Symbole nom="description" taille={16} couleur={T.bleu} />
                <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.fichier_nom}</Text>
              </Tapable>
            ))}
          </View>
        </Section>
      ) : null}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7, lineHeight: 18 },

  faits: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.bordure,
  },
  faitSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: T.bordure, marginHorizontal: 14 },
  faitLabel: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 1, color: T.gris, marginBottom: 3 },
  faitVal: { fontSize: 14, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },

  contact: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.carteBord, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  contactEntete: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  contactNom: { fontSize: 13, fontFamily: POLICE.gras, color: T.encre },
  contactSous: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris },
  contactChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  contactChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  contactChipTexte: { fontSize: 11, fontFamily: POLICE.demi },

  doc: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
}));
