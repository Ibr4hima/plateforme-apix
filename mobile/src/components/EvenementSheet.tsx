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
import { Bloc, EnTeteSection, Groupe, LigneValeur } from "@/components/ListeIOS";
import { API } from "@/lib/api";
import DocumentsFiche from "@/components/DocumentsFiche";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import TexteRiche from "@/components/TexteRiche";
import Thematiques from "@/components/Thematiques";
import Icone from "@/components/Icone";
import { useEncrePastel } from "@/lib/couleurs";
import { fmtDate, premierDuMois } from "@/lib/format";
import { dansCombienEvenement, dateEnLettres, dateEvenementDe, ordinal, statutEvenement, tuileDate } from "@/lib/evenements";
import { coin, ECHELLE, FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

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
// Plage en toutes lettres, sans répéter ce que les deux bornes partagent :
// « vendredi 20 novembre 2026 », « 20 → 22 novembre 2026 »,
// « 28 févr. → 3 mars 2026 », « 28 déc. 2026 → 3 janv. 2027 ».
function plageComplete(e: any): string | null {
  if (!e.date_debut) {
    const de = dateEvenementDe(e);
    return de ? dateEnLettres(de) : null;
  }
  const deb = new Date(e.date_debut + "T00:00:00");
  const finBrute = e.date_fin && e.date_fin !== e.date_debut ? new Date(e.date_fin + "T00:00:00") : null;
  if (!finBrute) return premierDuMois(deb.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const fin = finBrute;
  const moisLong = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long" });
  const moisCourt = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" });
  // « 1er → 3 mars » : le premier jour garde son ordinal, même seul
  const jour = (d: Date) => (d.getDate() === 1 ? "1er" : String(d.getDate()));
  if (deb.getFullYear() === fin.getFullYear() && deb.getMonth() === fin.getMonth())
    return `${jour(deb)} → ${jour(fin)} ${moisLong(fin)} ${fin.getFullYear()}`;
  if (deb.getFullYear() === fin.getFullYear())
    return `${jour(deb)} ${moisCourt(deb)} → ${jour(fin)} ${moisCourt(fin)} ${fin.getFullYear()}`;
  return `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`;
}

// ── Briques de la fiche ──────────────────────────────────────────────────────
// La fiche se lit en listes groupées, sur iOS comme sur Android (ListeIOS) :
// l'essentiel (date, lieu, échéance) dans un bloc blanc, l'organisation en
// lignes séparées d'un filet, la description, les thématiques et les invités
// chacun dans son bloc.

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

function Rangee({ label, valeur }: { label: string; valeur?: string | null }) {
  if (!valeur) return null;
  return <LigneValeur label={label} valeur={valeur} />;
}

export default function EvenementSheet({ ev: e, onClose }: { ev: any; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
  const encrePastel = useEncrePastel();
  const statut = statutEvenement(e);
  const enCours = statut === "en_cours";
  const roleP = e.role_apix ? ROLE_PASTEL[e.role_apix] || "#C5BFBB" : null;
  const de = dateEvenementDe(e);
  const tuile = de ? tuileDate(de) : null;
  const lieu = [e.ville, e.pays_hote_nom].filter(Boolean).join(", ");
  const echeance = enCours ? "En ce moment" : dansCombienEvenement(e);

  const enListe = (v: any): string[] =>
    Array.isArray(v) ? v.filter(Boolean)
    : typeof v === "string" ? v.split(",").map(x => x.trim()).filter(Boolean)
    : [];
  const paysInvites = enListe(e.pays_invites_noms);
  const entreprisesInvitees = enListe(e.entreprises_invitees);

  // « Tous les ans », « Tous les 2 ans », « Tous les 6 mois »
  const unite = e.frequence_type === "mois" ? "mois" : "ans";
  const recurrence = e.frequence_valeur
    ? (e.frequence_valeur === 1 ? `Tous les ${unite}` : `Tous les ${e.frequence_valeur} ${unite}`)
    : null;

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={e.nom_event}
      sousEntete={(e.edition != null || roleP) ? (
        // La ligne de méta — édition · rôle APIX —, repliée s'il le faut.
        // Le statut (à venir, en cours, terminé) n'y est pas : la date et
        // l'échéance, juste dessous, le disent déjà
        <Text style={s.meta}>
          {e.edition != null ? ordinal(e.edition) : ""}
          {e.edition != null && roleP ? "   ·   " : ""}
          {roleP && <Text style={{ color: encrePastel(roleP), ...FONTE.gras }}>{e.role_apix}</Text>}
        </Text>
      ) : undefined}>

      {/* ── L'essentiel : date, lieu, échéance — une seule carte ── */}
      <View style={s.essentiel}>
        <View style={[s.bloc, enCours && { backgroundColor: T.vertAction }, statut === "termine" && { backgroundColor: T.filet }]}>
          {tuile ? (
            <>
              <Text style={[s.blocJour, tuile.textuel && s.blocJourTextuel, statut === "termine" && { color: T.gris }]}
                numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={ECHELLE.chiffre}>{tuile.haut}</Text>
              {tuile.bas ? (
                <Text style={[s.blocMois, statut === "termine" && { color: T.gris }]} maxFontSizeMultiplier={ECHELLE.compact}>{tuile.bas}</Text>
              ) : null}
            </>
          ) : (
            <Icone sf="arrow.triangle.2.circlepath" materiel="autorenew" taille={18} couleur="#fff" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.essentielDate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {plageComplete(e) || "Date à confirmer"}
          </Text>
          {lieu ? <TexteDefilant style={s.essentielLieu}>{lieu}</TexteDefilant> : null}
          {echeance && statut !== "termine" && (
            <Text style={[s.essentielEcheance, enCours && { color: T.vert }]}>{echeance}</Text>
          )}
        </View>
      </View>

      {/* ── Organisation ── */}
      {(e.organisateur || recurrence) && (
        <Section titre="Organisation" liste>
          <Groupe>
            <Rangee label="Organisateur" valeur={e.organisateur} />
            <Rangee label="Récurrence" valeur={recurrence} />
          </Groupe>
        </Section>
      )}

      {/* ── Description — saisie en texte riche sur le site (paragraphes,
          listes) : elle se lit mise en forme, comme sur la plateforme ── */}
      {e.description ? (
        <Section titre="Description">
          <TexteRiche html={e.description} couleur={T.texte as any} fontSize={13.5} lineHeight={21} />
        </Section>
      ) : null}

      {/* ── Thématiques : hiérarchie monochrome partagée */}
      {Object.keys(e.thematiques_tree || {}).length > 0 && (
        <Section titre="Thématiques">
          <Thematiques arbre={e.thematiques_tree} />
        </Section>
      )}

      {/* ── Invités — pays et entreprises dans les mêmes pastilles neutres :
          deux listes de la même nature, un seul dessin ── */}
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
            {entreprisesInvitees.map(n => <View key={n} style={s.chip}><Text style={s.chipTexte}>{n}</Text></View>)}
          </View>
        </Section>
      )}
      {/* ── Documents — ceux de la fiche du site ── */}
      <DocumentsFiche fichiers={Array.isArray(e.fichiers) ? e.fichiers : []} urlDe={f => `${API}/evenements/${e.id}/fichiers/${f.id}/download`} ouvrir={ouvrirDoc} />
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7 },

  // L'essentiel est un bloc blanc du groupe
  essentiel: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.carte, borderRadius: coin(16), padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord,
  },
  bloc: {
    width: 50, height: 56, borderRadius: coin(14), alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuAction,
  },
  blocJour: { fontSize: 20, ...FONTE.gras, color: "#fff", lineHeight: 24, fontVariant: ["tabular-nums"] },
  blocJourTextuel: { fontSize: 15, lineHeight: 19, letterSpacing: 0.4 },
  blocMois: { fontSize: 9, ...FONTE.gras, color: "rgba(255,255,255,0.85)", letterSpacing: 1.1, marginTop: 1 },
  essentielDate: { fontSize: 15, ...FONTE.demi, color: T.encre, letterSpacing: -0.2 },
  essentielLieu: { fontSize: 12.5, ...FONTE.normal, color: T.texte },
  essentielEcheance: { fontSize: 11.5, ...FONTE.gras, color: T.bleu, marginTop: 1 },


  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { backgroundColor: T.voile, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, ...FONTE.demi, color: T.texte },
}));
