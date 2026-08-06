// Fiche événement — une lecture, pas un formulaire.
//
// L'ancienne fiche empilait des boîtes bordées à étiquette (DATE, LIEU,
// ORGANISATEUR…) : la mise en page d'un back-office. Celle-ci se lit de haut
// en bas comme une page :
//   1. l'identité — le nom en grand, puis une seule ligne de méta (statut
//      coloré · édition · rôle APIX) ;
//   2. l'essentiel — une carte unique : bloc date (la signature de l'app),
//      plage compacte, lieu, échéance orange ou « En ce moment » vert ;
//   3. le reste en sections plates — rangées clé-valeur, description,
//      thématiques en hiérarchie monochrome, invités en chips.
import { StyleSheet, Text, View } from "react-native";
import { Feuille } from "@/components/ui";
import Thematiques from "@/components/Thematiques";
import Icone from "@/components/Icone";
import { foncerPastel, useTeinte } from "@/lib/couleurs";
import { fmtDate } from "@/lib/format";
import { computeStatutEvenement } from "@/lib/statuts";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

export const ROLE_PASTEL: Record<string, string> = {
  "Organisateur":    "#B4DE9D",
  "Co-organisateur": "#9DDEC2",
  "Participant":     "#9DC3E6",
  "Partenaire":      "#9DD3DE",
  "Sponsor":         "#E6C79D",
  "Invité":          "#E6AC9D",
};
export const ST_EVENT: Record<string, { label: string; c: string; bg: string }> = {
  a_venir:  { label: "À venir",  c: "#004f91", bg: T.bleuVoile },
  en_cours: { label: "En cours", c: "#188038", bg: "rgba(24,128,56,0.08)" },
  termine:  { label: "Terminé",  c: T.texte, bg: T.filet },
};
export const ordinal = (n: number) => (n === 1 ? "1ère édition" : `${n}ème édition`);
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function statutEvenement(e: any) {
  return computeStatutEvenement(e) ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
}
export function dateEvenement(e: any): string | null {
  if (e.date_debut) {
    return e.date_debut === e.date_fin || !e.date_fin
      ? fmtDate(e.date_debut)
      : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`;
  }
  if (e.prochain_mois || e.prochain_annee) {
    return `${e.prochain_jour ? e.prochain_jour + " " : ""}${e.prochain_mois ? MOIS[(e.prochain_mois || 1) - 1] + " " : ""}${e.prochain_annee || ""}`.trim();
  }
  return null;
}

// « Dans 2 ans / 3 mois / 12 jours » — partagé avec la liste
export function dansCombienEvenement(e: any): string | null {
  const d = e.date_debut ? new Date(e.date_debut + "T00:00:00")
    : e.prochain_annee ? new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1) : null;
  if (!d) return null;
  const now = new Date();
  const jours = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (jours <= 0) return null;
  let mois = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Dans ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return `Dans ${jours} jour${jours > 1 ? "s" : ""}`;
}

// Plage en toutes lettres, sans répéter ce que les deux bornes partagent :
// « vendredi 20 novembre 2026 », « 20 → 22 novembre 2026 »,
// « 28 févr. → 3 mars 2026 », « 28 déc. 2026 → 3 janv. 2027 ».
function plageComplete(e: any): string | null {
  if (!e.date_debut) return dateEvenement(e);
  const deb = new Date(e.date_debut + "T00:00:00");
  const finBrute = e.date_fin && e.date_fin !== e.date_debut ? new Date(e.date_fin + "T00:00:00") : null;
  if (!finBrute) return deb.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fin = finBrute;
  const moisLong = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long" });
  const moisCourt = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" });
  if (deb.getFullYear() === fin.getFullYear() && deb.getMonth() === fin.getMonth())
    return `${deb.getDate()} → ${fin.getDate()} ${moisLong(fin)} ${fin.getFullYear()}`;
  if (deb.getFullYear() === fin.getFullYear())
    return `${deb.getDate()} ${moisCourt(deb)} → ${fin.getDate()} ${moisCourt(fin)} ${fin.getFullYear()}`;
  return `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`;
}

// ── Briques de la fiche ──────────────────────────────────────────────────────
function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Rangee({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return (
    <View style={s.rangee}>
      <Text style={s.rangeeLabel}>{label}</Text>
      <Text style={s.rangeeValeur} numberOfLines={2}>{valeur}</Text>
    </View>
  );
}

export default function EvenementSheet({ ev: e, onClose }: { ev: any; onClose: () => void }) {
  const teinte = useTeinte();
  const statut = statutEvenement(e);
  const st = statut ? ST_EVENT[statut] : null;
  const enCours = statut === "en_cours";
  const roleP = e.role_apix ? ROLE_PASTEL[e.role_apix] || "#C5BFBB" : null;
  const d = e.date_debut ? new Date(e.date_debut + "T00:00:00")
    : e.prochain_annee ? new Date(e.prochain_annee, (e.prochain_mois || 1) - 1, e.prochain_jour || 1) : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  const echeance = enCours ? "En ce moment" : dansCombienEvenement(e);

  const enListe = (v: any): string[] =>
    Array.isArray(v) ? v.filter(Boolean)
    : typeof v === "string" ? v.split(",").map(x => x.trim()).filter(Boolean)
    : [];
  const paysInvites = enListe(e.pays_invites_noms);
  const entreprisesInvitees = enListe(e.entreprises_invitees);

  const recurrence = e.frequence_valeur
    ? `Tous les ${e.frequence_valeur} ${e.frequence_type === "mois" ? "mois" : `an${e.frequence_valeur > 1 ? "s" : ""}`}`
    : null;

  return (
    <Feuille onClose={onClose} hauteur="78%" ecart={22}
      titre={<Text style={s.titre}>{e.nom_event}</Text>}
      sousEntete={
        // Une seule ligne de méta : statut coloré · édition · rôle APIX
        <Text style={s.meta} numberOfLines={1}>
          {st && <Text style={{ color: teinte(st.c), fontFamily: POLICE.gras }}>{enCours ? "En ce moment" : st.label}</Text>}
          {st && e.edition != null ? "   ·   " : ""}
          {e.edition != null ? ordinal(e.edition) : ""}
          {(st || e.edition != null) && roleP ? "   ·   " : ""}
          {roleP && <Text style={{ color: foncerPastel(roleP), fontFamily: POLICE.gras }}>{e.role_apix}</Text>}
        </Text>
      }>

      {/* ── L'essentiel : date, lieu, échéance — une seule carte ── */}
      <View style={s.essentiel}>
        <View style={[s.bloc, enCours && { backgroundColor: T.vert }, statut === "termine" && { backgroundColor: T.filet }]}>
          {d ? (
            <>
              <Text style={[s.blocJour, statut === "termine" && { color: T.gris }]}>{d.getDate()}</Text>
              <Text style={[s.blocMois, statut === "termine" && { color: T.gris }]}>
                {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()}
              </Text>
            </>
          ) : (
            <Icone sf="arrow.triangle.2.circlepath" materiel="autorenew" taille={18} couleur="#fff" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.essentielDate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {plageComplete(e) || "Date à confirmer"}
          </Text>
          {lieu ? <Text style={s.essentielLieu} numberOfLines={1}>{lieu}</Text> : null}
          {echeance && statut !== "termine" && (
            <Text style={[s.essentielEcheance, enCours && { color: T.vert }]}>{echeance}</Text>
          )}
        </View>
      </View>

      {/* ── Organisation ── */}
      {(e.organisateur || recurrence) && (
        <Section titre="Organisation">
          <View style={s.rangees}>
            <Rangee label="Organisateur" valeur={e.organisateur} />
            <Rangee label="Récurrence" valeur={recurrence} />
          </View>
        </Section>
      )}

      {/* ── Description ── */}
      {e.description ? (
        <Section titre="Description">
          <Text style={s.description}>{e.description}</Text>
        </Section>
      ) : null}

      {/* ── Thématiques : hiérarchie monochrome partagée */}
      {Object.keys(e.thematiques_tree || {}).length > 0 && (
        <Section titre="Thématiques">
          <Thematiques arbre={e.thematiques_tree} />
        </Section>
      )}

      {/* ── Invités ── */}
      {paysInvites.length > 0 && (
        <Section titre="Pays invités">
          <View style={s.chips}>
            {paysInvites.map(n => <View key={n} style={s.chip}><Text style={s.chipTexte}>{n}</Text></View>)}
          </View>
        </Section>
      )}
      {entreprisesInvitees.length > 0 && (
        <Section titre="Entreprises invitées">
          <View style={s.chips}>
            {entreprisesInvitees.map(n => <View key={n} style={s.chipVoile}><Text style={s.chipVoileTexte}>{n}</Text></View>)}
          </View>
        </Section>
      )}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7 },

  essentiel: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.blocFond, borderRadius: 18, padding: 14,
  },
  bloc: {
    width: 50, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuAction,
  },
  blocJour: { fontSize: 20, fontFamily: POLICE.gras, color: "#fff", lineHeight: 24, fontVariant: ["tabular-nums"] },
  blocMois: { fontSize: 9, fontFamily: POLICE.gras, color: "rgba(255,255,255,0.85)", letterSpacing: 1.1, marginTop: 1 },
  essentielDate: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  essentielLieu: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte },
  essentielEcheance: { fontSize: 11.5, fontFamily: POLICE.gras, color: T.orange, marginTop: 1 },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  rangees: { gap: 9 },
  rangee: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rangeeLabel: { width: 104, fontSize: 13, fontFamily: POLICE.normal, color: T.gris, lineHeight: 18 },
  rangeeValeur: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  description: { fontSize: 13.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { backgroundColor: T.filet, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
  chipVoile: { backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipVoileTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.bleu },
}));
