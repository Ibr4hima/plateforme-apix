// Fiche prospect — réplique du modal ProspectVueModal de la plateforme,
// adaptée à l'app : pilules statut / siège, bascule Échanges ⇄ Infos pour
// les prospects en contact ou transformés. Infos : contact, activités
// spécialisées (NAEMA), points focaux. Échanges : frise du cycle courant
// (canal, interlocuteur, commentaire, fichiers), contraintes exprimées,
// cycles archivés repliables.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import { CarteContact } from "@/components/ProjetSheet";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { API } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { POLICE, T } from "@/theme";

export type OngletProspect = "cibles" | "historique" | "termines";

// ── Helpers du cycle de prospection (portés du site) ─────────────────────────

// Ancienneté relative : « Il y a 3 jours / 2 mois / 1 an », « Aujourd'hui »
export function ilYa(dstr: string | null): string | null {
  if (!dstr) return null;
  const d = new Date(dstr.slice(0, 10) + "T00:00:00"), now = new Date();
  const jours = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (jours < 0) return null;
  if (jours === 0) return "Aujourd'hui";
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) mois -= 1;
  const ans = Math.floor(mois / 12);
  if (ans >= 1) return `Il y a ${ans} an${ans > 1 ? "s" : ""}`;
  if (mois >= 1) return `Il y a ${mois} mois`;
  return `Il y a ${jours} jour${jours > 1 ? "s" : ""}`;
}

// Début du cycle de prospection courant : date du dernier re-contact
export function cycleCourantDebut(p: any): string | null {
  const dates = (p?.cycles || []).map((c: any) => c.recontacte_le).filter(Boolean).map((d: string) => d.slice(0, 10));
  return dates.length ? dates.sort().at(-1) ?? null : null;
}

// Statut du prospect (mêmes règles que le site)
export function badgeProspect(p: any): { label: string } | null {
  if (p?.issue === "installe") return { label: "Installation à venir" };
  if (p?.issue === "decline") return { label: "Décliné" };
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges || []).filter((e: any) => e.date_echange >= debut);
    if (!echangesCycle.length) return { label: "À recontacter" };
    dateDernierEchange = echangesCycle.map((e: any) => e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90) return { label: "En cours" };
  if (jours <= 120) return { label: "En attente" };
  return { label: "Inactif" };
}

// Pastels des statuts (mêmes teintes que les cards du site)
export const PROSPECT_PASTELS: Record<string, string> = {
  "En cours": "#B4DE9D", "En attente": "#D5D2CE", "Inactif": "#E6AC9D",
  "À recontacter": "#9DC3E6", "Installation à venir": "#B4DE9D", "Décliné": "#D5D2CE",
};

// Contraintes / échanges rattachés à un cycle donné (null = cycle courant)
export function contraintesDuCycle(p: any, cy: any): any[] {
  const nbCycles = (p?.cycles || []).length;
  return (p?.contraintes || []).filter((c: any) => cy ? (c.cycle_num === cy.cycle_num - 1) : (c.cycle_num === nbCycles));
}
export function echangesDuCycle(p: any, cy: any): any[] {
  const cyclesAsc = [...(p?.cycles || [])].sort((a: any, b: any) => (a.conclu_le || "").localeCompare(b.conclu_le || ""));
  const cycleDe = (iso: string) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return cyclesAsc.find((c: any) => c.conclu_le && t <= new Date(c.conclu_le).getTime()) || null;
  };
  return (p?.echanges || []).filter((e: any) => {
    const found = cycleDe(e.enregistre_le);
    return cy ? (found && found.id === cy.id) : !found;
  });
}

const PHONE_CANAUX = ["Appel téléphonique", "SMS", "WhatsApp", "Signal", "Telegram"];
const CANAL_ICONES: Record<string, string> = {
  "Mail": "mail-outline", "Appel téléphonique": "call-outline", "SMS": "chatbox-outline",
  "WhatsApp": "logo-whatsapp", "Signal": "chatbubble-ellipses-outline", "Telegram": "paper-plane-outline",
  "Visioconférence": "videocam-outline", "Réunion physique": "location-outline",
  "LinkedIn": "logo-linkedin", "Courrier postal": "send-outline",
};

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}
function Bloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.bloc}>
      <Text style={s.blocLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export default function ProspectSheet({ prospect: p, onglet, onClose }: { prospect: any; onglet: OngletProspect; onClose: () => void }) {
  // En contact / transformés : bascule Échanges ⇄ Infos investisseur
  const [vue, setVue] = useState<"echanges" | "infos">(onglet === "cibles" ? "infos" : "echanges");
  const [cyclesOuverts, setCyclesOuverts] = useState<Set<number>>(new Set());
  const basculerCycle = (id: number) => setCyclesOuverts(prev => {
    const st = new Set(prev); st.has(id) ? st.delete(id) : st.add(id); return st;
  });

  const badge = badgeProspect(p);
  const pastel = badge ? PROSPECT_PASTELS[badge.label] || "#C5BFBB" : null;
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];
  const tels: string[] = (p.telephones || []).filter(Boolean);
  const mails: string[] = (p.mails || []).filter(Boolean);
  const focaux: any[] = Array.isArray(p.points_focaux) ? p.points_focaux : [];

  const echsCourant = echangesDuCycle(p, null);
  const contrCourant = contraintesDuCycle(p, null);
  const cyclesTries = [...(p.cycles || [])].sort((a: any, b: any) => b.cycle_num - a.cycle_num);

  const canalCoord = (canal: string, contact: string) =>
    !contact ? "" : PHONE_CANAUX.includes(canal) ? fmtPhone(contact) : contact;

  // Carte d'échange sur la frise
  const CarteEchange = ({ e }: { e: any }) => (
    <View style={s.echangeRangee}>
      <View style={s.echangePoint} />
      <View style={s.echange}>
        <Text style={s.echangeDate}>{fmtDateLong(e.date_echange)}</Text>
        {(e.canal || e.interlocuteur || e.contact_par) ? (
          <View style={s.echangeMeta}>
            {e.canal ? (
              <View style={s.canalChip}>
                <Ionicons name={(CANAL_ICONES[e.canal] || "chatbox-outline") as any} size={11} color={T.texte} />
                <Text style={s.canalChipTexte} numberOfLines={1}>{e.canal}{canalCoord(e.canal, e.canal_contact) ? ` · ${canalCoord(e.canal, e.canal_contact)}` : ""}</Text>
              </View>
            ) : null}
            {(e.interlocuteur || e.contact_par) ? (
              <Text style={s.echangeQui} numberOfLines={1}>{[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}</Text>
            ) : null}
          </View>
        ) : null}
        {e.commentaire ? (
          <View style={s.echangeCommentaire}><Text style={s.echangeCommentaireTexte}>{htmlEnTexte(e.commentaire)}</Text></View>
        ) : null}
        {e.fichiers?.length > 0 ? (
          <View style={s.fichiers}>
            {e.fichiers.map((f: any) => (
              <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`)}
                style={({ pressed }) => [s.fichierChip, pressed && { backgroundColor: T.bleuVoile }]}>
                <Ionicons name="document-text-outline" size={11} color={T.bleu} />
                <Text style={s.fichierChipTexte} numberOfLines={1}>{f.titre}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={s.echangePied}>
          <Ionicons name="time-outline" size={11} color={T.grisClair} />
          <Text style={s.echangePiedTexte}>
            Enregistré le {fmtDateLong((e.enregistre_le || "").slice(0, 10))} · {e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}
          </Text>
        </View>
      </View>
    </View>
  );

  const Frise = ({ echanges }: { echanges: any[] }) => (
    <View style={s.frise}>
      <View style={s.friseRail} />
      <View style={{ gap: 10 }}>
        {[...echanges].sort((a: any, b: any) => a.date_echange.localeCompare(b.date_echange)).map((e: any) => <CarteEchange key={e.id} e={e} />)}
      </View>
    </View>
  );

  const Contraintes = ({ items }: { items: any[] }) => (
    <View style={{ gap: 6 }}>
      {items.map((c: any) => (
        <View key={c.id} style={s.contrainte}>
          <View style={s.contraintePoint} />
          <Text style={s.contrainteTexte}>{htmlEnTexte(c.description || "")}</Text>
        </View>
      ))}
    </View>
  );

  // Cycle repliable (archivé ou courant figé)
  const CycleBloc = ({ id, num, issue, concluLe, commentaire, echanges, contraintes }: any) => {
    const inst = issue === "installe";
    const ouvert = cyclesOuverts.has(id);
    return (
      <View style={s.cycle}>
        <Pressable onPress={() => basculerCycle(id)}
          style={({ pressed }) => [s.cycleEntete, (ouvert || pressed) && { backgroundColor: T.carteDouce }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.cycleLigne}>
              <Text style={s.cycleNum}>CYCLE {num}</Text>
              <Text style={[s.cycleIssue, { color: inst ? T.vert : T.texte }]}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</Text>
            </View>
            {concluLe ? <Text style={s.cycleDate}>Conclu le {fmtDateLong(concluLe.slice(0, 10))}</Text> : null}
          </View>
          <Ionicons name={ouvert ? "chevron-up" : "chevron-down"} size={14} color={T.grisClair} />
        </Pressable>
        {ouvert && (
          <View style={s.cycleCorps}>
            {commentaire ? <Text style={s.cycleCommentaire}>{htmlEnTexte(commentaire)}</Text> : null}
            {echanges.length > 0 && (
              <View>
                <Text style={s.sousTitreGris}>HISTORIQUE</Text>
                <Frise echanges={echanges} />
              </View>
            )}
            {contraintes.length > 0 && (
              <View>
                <Text style={[s.sousTitreGris, { color: T.bleu }]}>{contraintes.length === 1 ? "CONTRAINTE EXPRIMÉE" : "CONTRAINTES EXPRIMÉES"}</Text>
                <Contraintes items={contraintes} />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const lien = (url: string) => Linking.openURL(url.startsWith("http") ? url : `https://${url}`);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.titre}>{p.nom}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <View style={s.pilules}>
          {onglet !== "cibles" && badge && pastel ? (
            <View style={[s.pilule, { backgroundColor: `${pastel}40`, borderWidth: 1, borderColor: `${pastel}90` }]}>
              <Text style={[s.piluleTexte, { color: "#3d4450" }]}>{badge.label}</Text>
            </View>
          ) : null}
          {p.siege_nom ? <View style={[s.pilule, { backgroundColor: T.bleuVoile }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{p.siege_nom}</Text></View> : null}
        </View>

        {/* Bascule Échanges ⇄ Infos (hors ciblés) */}
        {onglet !== "cibles" && (
          <View style={s.bascule}>
            {([["echanges", "Échanges"], ["infos", "Infos investisseur"]] as const).map(([cle, label]) => (
              <Pressable key={cle} onPress={() => setVue(cle)} style={[s.basculeBouton, vue === cle && s.basculeActif]}>
                <Text style={[s.basculeTexte, vue === cle && s.basculeTexteActif]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* ── Infos investisseur ── */}
          {vue === "infos" && (
            <>
              {(tels.length > 0 || mails.length > 0 || p.siteweb || p.linkedin) ? (
                <View>
                  <SecTitle>Contact</SecTitle>
                  <View style={s.grille}>
                    {tels.length > 0 ? (
                      <Bloc label={tels.length > 1 ? "Téléphones" : "Téléphone"}>
                        {tels.map((t, i) => <Text key={i} style={s.blocValeur}>{fmtPhone(t)}</Text>)}
                      </Bloc>
                    ) : null}
                    {mails.length > 0 ? (
                      <Bloc label={mails.length > 1 ? "Emails" : "Email"}>
                        {mails.map((m, i) => <Text key={i} style={s.blocValeur}>{m}</Text>)}
                      </Bloc>
                    ) : null}
                    {p.siteweb ? (
                      <Pressable style={{ width: "100%" }} onPress={() => lien(p.siteweb)}>
                        <Bloc label="Site web"><Text style={[s.blocValeur, { color: T.bleu }]}>{p.siteweb}</Text></Bloc>
                      </Pressable>
                    ) : null}
                    {p.linkedin ? (
                      <Pressable style={{ width: "100%" }} onPress={() => lien(p.linkedin)}>
                        <Bloc label="LinkedIn"><Text style={[s.blocValeur, { color: T.bleu }]}>{p.linkedin}</Text></Bloc>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {(secIds.length > 0 || braIds.length > 0 || actIds.length > 0) ? (
                <View>
                  <SecTitle>Activités spécialisées</SecTitle>
                  <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
                </View>
              ) : null}

              {focaux.length > 0 ? (
                <View>
                  <SecTitle>Points focaux</SecTitle>
                  <View style={{ gap: 8 }}>
                    {focaux.map((pf: any, i: number) => (
                      <CarteContact key={i} nom={[pf.prenom, pf.nom].filter(Boolean).join(" ")}
                        sous={pf.est_principal ? "Principal" : undefined}
                        telephones={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* ── Échanges ── */}
          {vue === "echanges" && (
            <>
              {(onglet === "historique" && (echsCourant.length > 0 || contrCourant.length > 0)) ? (
                <View>
                  <SecTitle>{`Compte rendu des échanges (${echsCourant.length})`}</SecTitle>
                  {echsCourant.length > 0 && <Frise echanges={echsCourant} />}
                  {contrCourant.length > 0 && (
                    <View style={{ marginTop: echsCourant.length ? 16 : 0 }}>
                      <Text style={[s.sousTitreGris, { color: T.bleu }]}>{contrCourant.length === 1 ? "CONTRAINTE EXPRIMÉE" : "CONTRAINTES EXPRIMÉES"}</Text>
                      <Contraintes items={contrCourant} />
                    </View>
                  )}
                </View>
              ) : null}
              {/* Transformés : le cycle conclu figé en tête */}
              {onglet === "termines" && p.issue ? (
                <CycleBloc id={-1} num={(p.cycles?.length || 0) + 1} issue={p.issue} concluLe={p.issue_conclu_le}
                  commentaire={p.issue_commentaire} echanges={echsCourant} contraintes={contrCourant} />
              ) : null}
              {cyclesTries.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {cyclesTries.map((cy: any) => (
                    <CycleBloc key={cy.id} id={cy.id} num={cy.cycle_num} issue={cy.issue} concluLe={cy.conclu_le}
                      commentaire={cy.issue_commentaire} echanges={echangesDuCycle(p, cy)} contraintes={contraintesDuCycle(p, cy)} />
                  ))}
                </View>
              ) : null}
              {onglet === "historique" && echsCourant.length === 0 && contrCourant.length === 0 && cyclesTries.length === 0 ? (
                <Text style={s.videTexte}>Aucun échange enregistré.</Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "84%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { flex: 1, fontSize: 19, fontFamily: POLICE.gras, color: T.encre, lineHeight: 25, letterSpacing: -0.3 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  bascule: {
    flexDirection: "row", marginTop: 12, padding: 3.5, gap: 4,
    backgroundColor: T.filet, borderRadius: 999,
  },
  basculeBouton: { flex: 1, alignItems: "center", paddingVertical: 7.5, borderRadius: 999 },
  basculeActif: { backgroundColor: T.carte, shadowColor: "#001e3c", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  basculeTexte: { fontSize: 12, fontFamily: POLICE.demi, color: T.gris },
  basculeTexteActif: { color: T.bleu },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  sousTitreGris: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, marginBottom: 8 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloc: {
    backgroundColor: T.blocFond, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexGrow: 1, flexBasis: "45%",
  },
  blocLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1, marginBottom: 4 },
  blocValeur: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  frise: { position: "relative" },
  friseRail: { position: "absolute", left: 4, top: 10, bottom: 10, width: 2, borderRadius: 2, backgroundColor: T.bordureDouce },
  echangeRangee: { paddingLeft: 18, position: "relative" },
  echangePoint: {
    position: "absolute", left: 0, top: 15, width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.bleu, borderWidth: 2, borderColor: T.carte,
  },
  echange: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  echangeDate: { fontSize: 13, fontFamily: POLICE.gras, color: T.encre },
  echangeMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 },
  canalChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.filet, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5, maxWidth: "100%",
  },
  canalChipTexte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.texte, flexShrink: 1 },
  echangeQui: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris },
  echangeCommentaire: { backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, marginTop: 10 },
  echangeCommentaireTexte: { fontSize: 12, fontFamily: POLICE.normal, color: T.texte, lineHeight: 19 },
  fichiers: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  fichierChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4,
  },
  fichierChipTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.bleu, flexShrink: 1 },
  echangePied: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: T.filet },
  echangePiedTexte: { flex: 1, fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris },
  contrainte: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  contraintePoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.bleu, marginTop: 6 },
  contrainteTexte: { flex: 1, fontSize: 12, fontFamily: POLICE.normal, color: T.texte, lineHeight: 18 },
  cycle: { borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, overflow: "hidden" },
  cycleEntete: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 12 },
  cycleLigne: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  cycleNum: { fontSize: 10, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  cycleIssue: { fontSize: 11, fontFamily: POLICE.gras },
  cycleDate: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 3 },
  cycleCorps: { borderTopWidth: 1, borderTopColor: T.bordureDouce, paddingHorizontal: 15, paddingVertical: 14, gap: 14 },
  cycleCommentaire: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 20, fontStyle: "italic" },
  videTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", marginTop: 12 },
});
