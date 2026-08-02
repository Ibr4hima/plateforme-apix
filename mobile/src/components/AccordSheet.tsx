// Fiche accord — la vie du traité, pas un formulaire.
//
// Un TBI se raconte en trois dates : signé, entré en vigueur, expiré. La
// fiche en fait sa pièce maîtresse — une frise à trois étapes dont l'étape
// courante porte la couleur du statut, avec l'échéance en pied (« Expire
// dans 3 ans » / « Expiré depuis 4 ans »). Au-dessus : l'identité — le
// partenaire d'abord (« Sénégal × France »), l'intitulé officiel en dessous,
// une ligne de méta (statut coloré · ancienneté · référence). En dessous :
// signataires en chips à drapeau, thématiques en hiérarchie monochrome
// partagée, commentaires en paragraphe.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Feuille } from "@/components/ui";
import Thematiques, { type ArbreThemes } from "@/components/Thematiques";
import { getJson } from "@/lib/api";
import { drapeauEmoji } from "@/lib/drapeaux";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { POLICE, T, TYPO } from "@/theme";

export const ST_PASTEL: Record<string, { label: string; p: string }> = {
  en_vigueur: { label: "En vigueur",           p: "#B4DE9D" },
  signe:      { label: "Signé non en vigueur", p: "#9DC3E6" },
  expire:     { label: "Expiré",               p: "#E6C79D" },
};
// Couleur franche du statut (méta, frise, points) — le pastel reste aux badges
export const ST_COULEUR: Record<string, string> = {
  en_vigueur: "#188038", signe: "#004f91", expire: "#b45309",
};

// « 8 ans », « 4 mois », « 12 jours »
export function dureeDepuis(dstr: string): string {
  const d = new Date(dstr.slice(0, 10) + "T00:00:00");
  const jours = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (jours < 31) return `${Math.max(jours, 1)} jour${jours > 1 ? "s" : ""}`;
  const mois = Math.floor(jours / 30.44);
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `${ans} an${ans > 1 ? "s" : ""}`;
}
// Même grandeur, tournée vers l'avenir — null si la date est passée
export function dureeJusqua(dstr: string): string | null {
  const d = new Date(dstr.slice(0, 10) + "T00:00:00");
  const jours = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (jours <= 0) return null;
  if (jours < 31) return `${jours} jour${jours > 1 ? "s" : ""}`;
  const mois = Math.round(jours / 30.44);
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `${ans} an${ans > 1 ? "s" : ""}`;
}

export function sousTitreStatut(a: any): string | null {
  const statut = computeStatutAccord(a);
  if (statut === "en_vigueur" && a.date_entree_vigueur) return `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`;
  if (statut === "signe" && a.date_signature) return `Signé il y a ${dureeDepuis(a.date_signature)}`;
  if (statut === "expire" && a.date_expiration) return `Expiré depuis ${dureeDepuis(a.date_expiration)}`;
  return a.reference || null;
}
// La seule ancienneté, sans le mot de statut (la méta les compose séparément)
function anciennete(a: any): string | null {
  const statut = computeStatutAccord(a);
  if (statut === "en_vigueur" && a.date_entree_vigueur) return `depuis ${dureeDepuis(a.date_entree_vigueur)}`;
  if (statut === "signe" && a.date_signature) return `il y a ${dureeDepuis(a.date_signature)}`;
  if (statut === "expire" && a.date_expiration) return `depuis ${dureeDepuis(a.date_expiration)}`;
  return null;
}

// ── Briques ──────────────────────────────────────────────────────────────────
function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// Une étape de la frise : point (plein quand l'étape est atteinte), label, date
function Etape({ label, date, couleur, atteinte, premiere }: {
  label: string; date?: string | null; couleur: string; atteinte: boolean; premiere?: boolean;
}) {
  return (
    <View style={s.etape}>
      {!premiere && <View style={[s.connecteur, atteinte && { backgroundColor: couleur }]} />}
      <View style={[s.point, atteinte ? { backgroundColor: couleur, borderColor: couleur } : { borderColor: T.grisClair }]} />
      <Text style={s.etapeLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.etapeDate, !date && { color: T.grisClair }]}>{date ? fmtDate(date) : "—"}</Text>
    </View>
  );
}

export default function AccordSheet({ accord: a, onClose }: { accord: any; onClose: () => void }) {
  const statut = computeStatutAccord(a);
  const couleur = statut ? ST_COULEUR[statut] : (T.gris as string);

  const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;
  // Le référentiel des parties porte les ISO2 → drapeaux emoji des chips
  const parties = useQuery({ queryKey: ["accords-parties"], queryFn: () => getJson<any>("/accords/parties-distinctes"), ...OPTS });
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS });
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS });
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS });

  const paysRef: any[] = parties.data?.pays || [];
  const signataires: any[] = (a.parties_pays_ids?.length && paysRef.length)
    ? a.parties_pays_ids.map((id: number) => paysRef.find((p: any) => p.id === id)).filter(Boolean)
    : (a.parties_signataires ? String(a.parties_signataires).split(", ").filter(Boolean).map((nom: string) => ({ nom })) : []);
  // Le Sénégal ouvre toujours la liste
  const ordonnes = [...signataires].sort((x: any, y: any) =>
    (x.nom === "Sénégal" ? -1 : y.nom === "Sénégal" ? 1 : x.nom.localeCompare(y.nom, "fr")));
  const partenaires = ordonnes.filter((p: any) => p.nom !== "Sénégal");

  // Identité : « Sénégal × France » quand le partenaire est unique, l'intitulé
  // officiel sinon — l'autre forme passe en légende
  const identite = partenaires.length === 1 ? `Sénégal × ${partenaires[0].nom}` : a.titre;
  const legende = partenaires.length === 1 && a.titre !== identite ? a.titre : null;

  // Thématiques : les ids à plat remontés en arbre pour la hiérarchie partagée
  const arbre: ArbreThemes = {};
  if (secteurs.data && branches.data && activites.data) {
    const secDe = (id: number) => secteurs.data!.find((x: any) => x.id === id);
    const braDe = (id: number) => branches.data!.find((x: any) => x.id === id);
    for (const sid of a.secteur_ids || []) {
      const sec = secDe(sid);
      if (sec) arbre[sec.nom] = arbre[sec.nom] || {};
    }
    for (const bid of a.branche_ids || []) {
      const bra = braDe(bid);
      const sec = bra && secDe(bra.secteur_id);
      if (bra && sec) { arbre[sec.nom] = arbre[sec.nom] || {}; arbre[sec.nom][bra.nom] = arbre[sec.nom][bra.nom] || []; }
    }
    for (const aid of a.activite_ids || []) {
      const act = activites.data.find((x: any) => x.id === aid);
      const bra = act && braDe(act.branche_id);
      const sec = bra && secDe(bra.secteur_id);
      if (act && bra && sec) {
        arbre[sec.nom] = arbre[sec.nom] || {};
        arbre[sec.nom][bra.nom] = arbre[sec.nom][bra.nom] || [];
        arbre[sec.nom][bra.nom].push(act.nom);
      }
    }
  }

  // Échéance en pied de frise
  const expireDans = a.date_expiration ? dureeJusqua(a.date_expiration) : null;
  const echeance = statut === "expire" && a.date_expiration
    ? { texte: `Expiré depuis ${dureeDepuis(a.date_expiration)}`, c: ST_COULEUR.expire }
    : expireDans
    ? { texte: `Expire dans ${expireDans}`, c: T.orange as string }
    : null;

  const duree = anciennete(a);

  return (
    <Feuille onClose={onClose} hauteur="78%" ecart={22}
      titre={<Text style={s.titre}>{identite}</Text>}
      sousEntete={
        <View>
          {legende ? <Text style={s.legende} numberOfLines={1}>{legende}</Text> : null}
          <Text style={s.meta} numberOfLines={1}>
            {statut && <Text style={{ color: couleur, fontFamily: POLICE.gras }}>{ST_PASTEL[statut].label}</Text>}
            {statut && duree ? ` ${duree}` : ""}
            {a.reference ? `   ·   ${a.reference}` : ""}
          </Text>
        </View>
      }>

      {/* ── La vie du traité : signature → vigueur → expiration ── */}
      <View style={s.frise}>
        <View style={s.etapes}>
          <Etape premiere label="Signature" date={a.date_signature} couleur={couleur} atteinte={!!a.date_signature} />
          <Etape label="En vigueur" date={a.date_entree_vigueur} couleur={couleur}
            atteinte={statut === "en_vigueur" || statut === "expire"} />
          <Etape label="Expiration" date={a.date_expiration} couleur={couleur} atteinte={statut === "expire"} />
        </View>
        {echeance && (
          <View style={s.echeanceLigne}>
            <Text style={[s.echeanceTexte, { color: echeance.c }]}>{echeance.texte}</Text>
          </View>
        )}
      </View>

      {/* ── Signataires ── */}
      {ordonnes.length > 0 && (
        <Section titre="Parties signataires">
          <View style={s.chips}>
            {ordonnes.map((p: any) => {
              const drapeau = drapeauEmoji(p.code_iso2);
              return (
                <View key={p.nom} style={s.chip}>
                  {drapeau ? <Text style={s.chipDrapeau}>{drapeau}</Text> : null}
                  <Text style={s.chipTexte}>{p.nom}</Text>
                </View>
              );
            })}
          </View>
        </Section>
      )}

      {/* ── Thématiques ── */}
      {Object.keys(arbre).length > 0 && (
        <Section titre="Thématiques">
          <Thematiques arbre={arbre} />
        </Section>
      )}

      {/* ── Commentaires ── */}
      {a.commentaires ? (
        <Section titre="Commentaires">
          <Text style={s.commentaires}>{a.commentaires}</Text>
        </Section>
      ) : null}
    </Feuille>
  );
}

const s = StyleSheet.create({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  legende: { fontSize: 12, fontFamily: POLICE.normal, color: T.gris, marginTop: 5 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 6 },

  frise: { backgroundColor: T.blocFond, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 10 },
  etapes: { flexDirection: "row" },
  etape: { flex: 1, alignItems: "center", gap: 5 },
  connecteur: {
    position: "absolute", top: 4.5, right: "50%", left: "-50%", height: 2,
    marginHorizontal: 14, borderRadius: 1, backgroundColor: T.grille, zIndex: -1,
  },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, backgroundColor: T.carte },
  etapeLabel: { fontSize: 8.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.9, marginTop: 3 },
  etapeDate: { fontSize: 12, fontFamily: POLICE.demi, color: T.encre, textAlign: "center", fontVariant: ["tabular-nums"] },
  echeanceLigne: { alignItems: "center", marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.blocBord },
  echeanceTexte: { fontSize: 12, fontFamily: POLICE.gras },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.filet, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipDrapeau: { fontSize: 13 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: T.texte },
  commentaires: { fontSize: 13.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
});
