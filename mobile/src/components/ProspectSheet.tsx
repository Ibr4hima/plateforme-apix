// Fiche prospect — éditoriale, comme les autres fiches : identité (nom en
// grand, méta « statut · siège » avec le statut dans sa teinte), une rangée
// d'actions Appeler · Email · Site web (l'atout du téléphone), puis la
// bascule Échanges ⇄ Infos pour les prospects en contact ou transformés.
// Infos : coordonnées en rangées clé-valeur TAPPABLES, activités NAEMA,
// points focaux. Échanges : frise du cycle courant (canal, interlocuteur,
// commentaire, fichiers), contraintes exprimées, cycles archivés repliables.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Bloc, EnTeteSection, Groupe, LigneValeur, SegmentsCapsule, TuilesActions } from "@/components/ListeIOS";
import { ouvrirLien, ouvrirMail, proposer } from "@/lib/liens";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille, Ondulable } from "@/components/ui";
import { CarteContact } from "@/components/ProjetSheet";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { API } from "@/lib/api";
import { useTeinte } from "@/lib/couleurs";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone, ouvrirTel } from "@/lib/telephone";
import { coin, FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

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

// Les statuts en BADGE de la maison — fond blanc, liseré et texte teintés,
// la couleur portant le sens : vert ce qui avance, bleu ce qui attend une
// action, rouge ce qui décroche, gris ce qui s'est arrêté.
export const PROSPECT_COULEURS: Record<string, string> = {
  "En cours": "#188038", "Installation à venir": "#188038",
  "À recontacter": "#004f91", "En attente": "#004f91",
  "Inactif": "#c0392b", "Décliné": "#6b7280",
};
export const couleurProspect = (label?: string | null) =>
  (label && PROSPECT_COULEURS[label]) || "#6b7280";

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
// L'icône de chaque canal, dans le dessin de chaque système (SF Symbols,
// Material) — sans logos de marque, qu'aucun des deux ne dessine
const CANAL_ICONES: Record<string, NomsIcone> = {
  "Mail": { sf: "envelope", materiel: "mail" },
  "Appel téléphonique": { sf: "phone", materiel: "call" },
  "SMS": { sf: "message", materiel: "sms" },
  "WhatsApp": { sf: "bubble.left", materiel: "chat" },
  "Signal": { sf: "ellipsis.bubble", materiel: "chat_bubble" },
  "Telegram": { sf: "paperplane", materiel: "send" },
  "Visioconférence": { sf: "video", materiel: "videocam" },
  "Réunion physique": { sf: "mappin.and.ellipse", materiel: "location_on" },
  "LinkedIn": { sf: "link", materiel: "link" },
  "Courrier postal": { sf: "envelope.open", materiel: "local_post_office" },
};
const CANAL_DEFAUT: NomsIcone = { sf: "bubble.left", materiel: "chat_bubble" };

// La fiche prend la grammaire de la fiche Contacts, sur iOS comme sur
// Android (ListeIOS) : tuiles d'action, coordonnées en lignes groupées, la
// bascule Échanges ⇄ Infos en segments du système, les échanges et les
// cycles en blocs blancs posés sur le fond des groupes.

function SecTitle({ children }: { children: string }) {
  return <EnTeteSection titre={children} />;
}

// Rangée clé-valeur, tappable quand la valeur agit (tel:, mailto:, https:)
function Rangee({ label, valeur, onPress }: { label: string; valeur?: string | null; onPress?: () => void }) {
  if (!valeur) return null;
  return <LigneValeur label={label} valeur={valeur} onPress={onPress} />;
}


export default function ProspectSheet({ prospect: p, onglet, onClose }: { prospect: any; onglet: OngletProspect; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
  const teinte = useTeinte();
  // En contact / transformés : bascule Échanges ⇄ Infos investisseur
  const [vue, setVue] = useState<"echanges" | "infos">(onglet === "cibles" ? "infos" : "echanges");
  const [cyclesOuverts, setCyclesOuverts] = useState<Set<number>>(new Set());
  const basculerCycle = (id: number) => setCyclesOuverts(prev => {
    const st = new Set(prev); st.has(id) ? st.delete(id) : st.add(id); return st;
  });

  const badge = badgeProspect(p);
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
                <Icone {...(CANAL_ICONES[e.canal] || CANAL_DEFAUT)} taille={11} couleur={T.texte} />
                <TexteDefilant style={s.canalChipTexte}>{e.canal}{canalCoord(e.canal, e.canal_contact) ? ` · ${canalCoord(e.canal, e.canal_contact)}` : ""}</TexteDefilant>
              </View>
            ) : null}
            {(e.interlocuteur || e.contact_par) ? (
              <TexteDefilant style={s.echangeQui}>{[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}</TexteDefilant>
            ) : null}
          </View>
        ) : null}
        {e.commentaire ? (
          <View style={s.echangeCommentaire}><Text style={s.echangeCommentaireTexte}>{htmlEnTexte(e.commentaire)}</Text></View>
        ) : null}
        {e.fichiers?.length > 0 ? (
          <View style={s.fichiers}>
            {e.fichiers.map((f: any) => (
              <Ondulable key={f.id} onPress={() => ouvrirDoc(`${API}/prospects/echanges/${e.id}/fichiers/${f.id}/download`, f.titre || f.nom)}
                style={({ pressed }) => [s.fichierChip, pressed && { opacity: 0.5 }]}>
                <Icone sf="doc.text" materiel="description" taille={11} couleur={T.bleu} />
                <TexteDefilant style={s.fichierChipTexte}>{f.titre}</TexteDefilant>
              </Ondulable>
            ))}
          </View>
        ) : null}
        <View style={s.echangePied}>
          <Icone sf="clock" materiel="schedule" taille={11} couleur={T.grisClair} />
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
        <Ondulable onPress={() => basculerCycle(id)}
          style={({ pressed }) => [s.cycleEntete, (ouvert || pressed) && { backgroundColor: T.carteDouce }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.cycleLigne}>
              <Text style={s.cycleNum}>CYCLE {num}</Text>
              <Text style={[s.cycleIssue, { color: inst ? T.vert : T.texte }]}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</Text>
            </View>
            {concluLe ? <Text style={s.cycleDate}>Conclu le {fmtDateLong(concluLe.slice(0, 10))}</Text> : null}
          </View>
          <Icone sf={ouvert ? "chevron.up" : "chevron.down"} materiel={ouvert ? "expand_less" : "expand_more"}
            taille={14} couleur={T.grisClair} poids="semibold" />
        </Ondulable>
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

  // Le site s'ouvre dans Safari intégré à l'app sur iOS (voir ouvrirLien)
  const lien = (url: string) => ouvrirLien(url);

  const meta = [
    onglet !== "cibles" && badge ? badge.label : null,
    p.siege_nom || null,
  ].filter(Boolean);

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={p.nom}
      sousEntete={
        <>
          {meta.length > 0 && (
            <Text style={s.meta}>
              {onglet !== "cibles" && badge ? (
                <Text style={{ color: teinte(couleurProspect(badge.label)), ...FONTE.gras }}>{badge.label}</Text>
              ) : null}
              {onglet !== "cibles" && badge && p.siege_nom ? "   ·   " : ""}
              {p.siege_nom || ""}
            </Text>
          )}

          {/* Bascule Échanges ⇄ Infos (hors ciblés) */}
          {onglet !== "cibles" && (
            <View style={{ marginTop: 14 }}>
              <SegmentsCapsule compact valeur={vue} onChange={v => setVue(v as "echanges" | "infos")}
                options={[{ cle: "echanges", label: "Échanges" }, { cle: "infos", label: "Infos investisseur" }]} />
            </View>
          )}
        </>
      }>
          {/* ── Infos investisseur ── */}
          {vue === "infos" && (
            <>
              {/* Agir : appeler, écrire, visiter — l'atout du téléphone */}
              <TuilesActions actions={[
                tels.length > 0 && { sf: "phone", materiel: "call", label: "Appeler",
                  onPress: () => proposer("Appeler", tels.map(fmtPhone), i => ouvrirTel(tels[i])) },
                mails.length > 0 && { sf: "envelope", materiel: "mail", label: "E-mail",
                  onPress: () => proposer("Écrire à", mails, i => ouvrirMail(mails[i])) },
                !!p.siteweb && { sf: "safari", materiel: "language", label: "Site web", onPress: () => lien(p.siteweb) },
              ]} />

              {(tels.length > 0 || mails.length > 0 || p.siteweb || p.linkedin) ? (
                <View>
                  <SecTitle>Contact</SecTitle>
                  <Groupe>
                    {tels.map((t, i) => (
                      <Rangee key={`t${i}`} label={i === 0 ? (tels.length > 1 ? "Téléphones" : "Téléphone") : ""}
                        valeur={fmtPhone(t)} onPress={() => ouvrirTel(t)} />
                    ))}
                    {mails.map((m, i) => (
                      <Rangee key={`m${i}`} label={i === 0 ? (mails.length > 1 ? "E-mails" : "E-mail") : ""}
                        valeur={m} onPress={() => ouvrirMail(m)} />
                    ))}
                    <Rangee label="Site web" valeur={p.siteweb} onPress={p.siteweb ? () => lien(p.siteweb) : undefined} />
                    <Rangee label="LinkedIn" valeur={p.linkedin} onPress={p.linkedin ? () => lien(p.linkedin) : undefined} />
                  </Groupe>
                </View>
              ) : null}

              {(secIds.length > 0 || braIds.length > 0 || actIds.length > 0) ? (
                <View>
                  <SecTitle>Activités spécialisées</SecTitle>
                  <Bloc><ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} /></Bloc>
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
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7 },

  sousTitreGris: { fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 1, marginBottom: 8 },
  frise: { position: "relative" },
  friseRail: { position: "absolute", left: 4, top: 10, bottom: 10, width: 2, borderRadius: 2, backgroundColor: T.bordureDouce },
  echangeRangee: { paddingLeft: 18, position: "relative" },
  echangePoint: {
    position: "absolute", left: 0, top: 15, width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.bleu, borderWidth: 2, borderColor: "rgba(122,138,164,0.26)",
  },
  // Chaque échange est un bloc blanc posé sur le fond gris
  echange: { backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord, borderRadius: coin(16), borderCurve: "continuous", paddingHorizontal: 15, paddingVertical: 13 },
  echangeDate: { fontSize: 13, ...FONTE.gras, color: T.encre },
  echangeMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 },
  canalChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.filet, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5, maxWidth: "100%",
  },
  canalChipTexte: { fontSize: 10.5, ...FONTE.gras, color: T.texte, flexShrink: 1 },
  echangeQui: { fontSize: 11, ...FONTE.normal, color: T.gris },
  echangeCommentaire: { backgroundColor: T.fond, borderRadius: coin(12), paddingHorizontal: 13, paddingVertical: 10, marginTop: 10 },
  echangeCommentaireTexte: { fontSize: 12, ...FONTE.normal, color: T.texte, lineHeight: 19 },
  fichiers: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  fichierChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.bleuVoile, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4,
  },
  fichierChipTexte: { fontSize: 11, ...FONTE.demi, color: T.bleu, flexShrink: 1 },
  echangePied: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: T.filet },
  echangePiedTexte: { flex: 1, fontSize: 10.5, ...FONTE.normal, color: T.gris },
  contrainte: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  contraintePoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.bleu, marginTop: 6 },
  contrainteTexte: { flex: 1, fontSize: 12, ...FONTE.normal, color: T.texte, lineHeight: 18 },
  cycle: { backgroundColor: T.carte, borderWidth: StyleSheet.hairlineWidth, borderColor: T.carteBord, borderRadius: coin(16), borderCurve: "continuous", overflow: "hidden" },
  cycleEntete: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 12 },
  cycleLigne: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  cycleNum: { fontSize: 10, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  cycleIssue: { fontSize: 11, ...FONTE.gras },
  cycleDate: { fontSize: 11, ...FONTE.normal, color: T.gris, marginTop: 3 },
  cycleCorps: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.voileFort,
    paddingHorizontal: 15, paddingVertical: 14, gap: 14,
  },
  cycleCommentaire: { fontSize: 12.5, ...FONTE.normal, color: T.texte, lineHeight: 20, fontStyle: "italic" },
  videTexte: { fontSize: 12.5, ...FONTE.normal, color: T.gris, textAlign: "center", marginTop: 12 },
}));
