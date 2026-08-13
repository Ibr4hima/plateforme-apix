"use client";

// Fiche prospect + helpers du cycle de prospection — partagés entre la
// page Prospects et la recherche globale (⌘K), qui l'ouvre depuis n'importe
// quelle page. Bâtie sur la fiche modale commune (FicheModal).

import { ChevronDown, ChevronUp, Clock, FileText, Mail, MapPin, MessageCircle, MessageSquare, Phone, Send, User, Video } from "lucide-react";
import { useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { fmtPhone } from "@/lib/telephone";
import { badge_bleu, badge_gris, badge_rouge, badge_vert } from "@/lib/couleurs";
import FicheModal, { FicheArbreNaema, FicheBloc, FicheCarteNeutre, FicheContacts, FicheGrille, FicheLien, FicheSection, FicheValeur } from "@/components/shared/FicheModal";

import { API_BASE } from "@/lib/api";

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

export function badgeProspect(p: any) {
  if (p?.issue === "installe") return { label: "Installation à venir", color: "var(--vert)", bg: "rgb(var(--vert-rgb) / 0.08)" };
  if (p?.issue === "decline")  return { label: "Décliné",  color: "var(--gris-fort)", bg: "var(--fond)" };
  // Après un re-contact, seule l'activité du cycle courant compte (même logique que l'admin).
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label: "À recontacter", color: "var(--bleu)", bg: "rgb(var(--bleu-rgb) / 0.07)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90)  return { label: "En cours",   color: "var(--vert)", bg: "rgb(var(--vert-rgb) / 0.08)" };
  if (jours <= 120) return { label: "En attente", color: "var(--gris-fort)", bg: "var(--fond)" };
  return                   { label: "Inactif",    color: "var(--danger)", bg: "rgb(var(--danger-rgb) / 0.07)" };
}

// Jetons du design system par statut (fiche) — alignés sur les cards
const STATUT_BADGE: Record<string, React.CSSProperties> = {
  "En cours":             badge_vert,
  "À recontacter":        badge_bleu,
  "Installation à venir": badge_vert,
  "Inactif":              badge_rouge,
  "Décliné":              badge_gris,
  "En attente":           badge_gris,
};

// Début du cycle de prospection courant : date du dernier re-contact.
export function cycleCourantDebut(p:any): string|null {
  const dates = (p?.cycles||[]).map((c:any)=>c.recontacte_le).filter(Boolean).map((d:string)=>d.slice(0,10));
  return dates.length ? dates.sort().at(-1) : null;
}

// Contraintes rattachées à un cycle donné (null = cycle courant).
export function contraintesDuCycle(p:any, cy:any): any[] {
  const nbCycles = (p?.cycles || []).length;
  return (p?.contraintes || []).filter((c:any)=>{
    return cy ? (c.cycle_num === cy.cycle_num - 1) : (c.cycle_num === nbCycles);
  });
}
export function contraintesCycleCourant(p:any): any[] { return contraintesDuCycle(p, null); }

// Échanges rattachés à un cycle donné (null = cycle courant).
export function echangesDuCycle(p:any, cy:any): any[] {
  const cyclesAsc = [...(p?.cycles||[])].sort((a:any,b:any)=>(a.conclu_le||"").localeCompare(b.conclu_le||""));
  const cycleDe = (iso:string) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return cyclesAsc.find((c:any)=>c.conclu_le && t <= new Date(c.conclu_le).getTime()) || null;
  };
  return (p?.echanges||[]).filter((e:any)=>{
    const found = cycleDe(e.enregistre_le);
    return cy ? (found && found.id===cy.id) : !found;
  });
}

const PHONE_CANAUX = ["Appel téléphonique", "SMS", "WhatsApp", "Signal", "Telegram"];

export function canalIcon(canal: string): any {
  switch (canal) {
    case "Mail":               return Mail;
    case "Appel téléphonique": return Phone;
    case "SMS":                return MessageSquare;
    case "WhatsApp":           return MessageCircle;
    case "Signal":             return MessageCircle;
    case "Telegram":           return Send;
    case "Visioconférence":    return Video;
    case "Réunion physique":   return MapPin;
    case "LinkedIn":           return User;
    case "Courrier postal":    return Send;
    default:                   return MessageSquare;
  }
}

export function canalContactDisplay(canal: string, contact: string): string {
  if (!contact) return "";
  if (PHONE_CANAUX.includes(canal)) return fmtPhone(contact);
  return contact;
}

// ── Fiche prospect ────────────────────────────────────────────────────────────
export default function ProspectVueModal({ p, onglet, onClose }: { p: any; onglet: "cibles" | "historique" | "termines"; onClose: () => void }) {
  const [openCycles, setOpenCycles] = useState<Set<number>>(new Set());
  const toggleCycle = (id:number) => setOpenCycles(prev=>{ const st=new Set(prev); st.has(id)?st.delete(id):st.add(id); return st; });

  // Référentiels NAEMA servis par le cache partagé
  const { secteurs, branches, activites } = useNaema();

  const badge = badgeProspect(p);
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const tels = (p.telephones || []).filter(Boolean);
  const mails = (p.mails || []).filter(Boolean);

  // Carte d'échange (lecture seule), même design que l'admin
  const EchangeCard = ({ e }: { e: any }) => (
    <div style={{ paddingLeft: 22, position: "relative" as const }}>
      <div style={{ position: "absolute" as const, left: 1, top: 16, width: 9, height: 9, borderRadius: "50%", background: "var(--bleu-action)", border: "2px solid var(--carte)", boxShadow: "0 0 0 1px rgb(var(--ombre-rgb) / 0.27)" }}/>
      <FicheCarteNeutre style={{ padding: "13px 15px" }}>
        <div style={{ fontSize: "var(--t-13)", fontWeight: 800, color: "var(--encre)" }}>
          {new Date(e.date_echange).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
        {(e.canal || e.interlocuteur || e.contact_par) && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 6, marginTop: 8 }}>
            {e.canal && (() => { const CIcon = canalIcon(e.canal); const coord = canalContactDisplay(e.canal, e.canal_contact); return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--t-105)", fontWeight: 700, color: "var(--texte)", background: "var(--champ)", padding: "3px 10px", borderRadius: 999 }}>
                <CIcon size={11} style={{ flexShrink: 0 }}/>{e.canal}{coord ? ` · ${coord}` : ""}
              </span>
            ); })()}
            {(e.interlocuteur || e.contact_par) && (
              <span style={{ fontSize: "var(--t-11)", color: "var(--gris)", fontWeight: 500 }}>
                {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        )}
        {e.commentaire && (
          <div style={{ background: "var(--carte)", border: "1px solid var(--bordure)", borderRadius: 10, padding: "10px 13px", marginTop: 10 }}>
            <div data-rte className="cr-rte" style={{ fontSize: "var(--t-12)", color: "var(--texte)", lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: e.commentaire }}/>
          </div>
        )}
        {e.fichiers?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 8 }}>
            {e.fichiers.map((f: any) => (
              <a key={f.id}
                href={`${API_BASE}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...badge_bleu, textDecoration: "none" }}>
                <FileText size={11} style={{ flexShrink: 0 }}/>{f.titre}
              </a>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--t-105)", color: "var(--gris)", marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--bordure)" }}>
          <Clock size={11} style={{ flexShrink: 0 }}/>
          <span>Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}</span>
        </div>
      </FicheCarteNeutre>
    </div>
  );

  // Timeline d'une liste d'échanges
  const Timeline = ({ echanges }: { echanges: any[] }) => (
    <div style={{ position: "relative" as const }}>
      <div style={{ position: "absolute" as const, left: 5, top: 10, bottom: 10, width: 2, background: "var(--fond-creux)", borderRadius: 2 }}/>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
        {[...echanges].sort((a: any, b: any) => a.date_echange.localeCompare(b.date_echange)).map((e: any) => <EchangeCard key={e.id} e={e}/>)}
      </div>
    </div>
  );

  // Contraintes (puces bleues alignées)
  const Contraintes = ({ items }: { items: any[] }) => (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
      {items.map((c: any) => (
        <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--t-12)", color: "var(--texte)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--bleu-action)", flexShrink: 0, marginTop: 6 }}/>
          <span style={{ lineHeight: 1.5 }}>{c.description.replace(/<[^>]+>/g, "").trim()}</span>
        </div>
      ))}
    </div>
  );

  // Bloc cycle repliable (archivé ou courant figé)
  const CycleBloc = ({ id, num, issue, concluLe, commentaire, echanges, contraintes }: any) => {
    const inst = issue === "installe";
    const col = inst ? "var(--vert)" : "var(--gris-fort)";
    const isOpen = openCycles.has(id);
    return (
      <div style={{ border: "1px solid var(--bordure)", borderRadius: 12, overflow: "hidden" as const }}>
        <button onClick={() => toggleCycle(id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: isOpen ? "var(--carte-douce)" : "var(--carte)", border: "none", cursor: "pointer", textAlign: "left" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--gris)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Cycle {num}</span>
            <span style={{ fontSize: "var(--t-11)", fontWeight: 700, color: col }}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</span>
            {concluLe && <span style={{ fontSize: "var(--t-11)", color: "var(--gris)" }}>· Conclu le {new Date(concluLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>}
          </div>
          {isOpen ? <ChevronUp size={14} style={{ color: "var(--gris)", flexShrink: 0 }}/> : <ChevronDown size={14} style={{ color: "var(--gris)", flexShrink: 0 }}/>}
        </button>
        {isOpen && (
          <div style={{ borderTop: "1px solid var(--bordure)", padding: "16px 16px", background: "var(--carte)", display: "flex", flexDirection: "column" as const, gap: 14 }}>
            {commentaire && (
              <div data-rte style={{ fontSize: "var(--t-13)", color: "var(--texte)", lineHeight: 1.7, fontStyle: "italic" }}
                dangerouslySetInnerHTML={{ __html: commentaire }}/>
            )}
            {echanges.length > 0 && (
              <div>
                <p style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--gris)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>Historique</p>
                <Timeline echanges={echanges}/>
              </div>
            )}
            {contraintes.length > 0 && (
              <div>
                <p style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--bleu)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  {contraintes.length === 1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                </p>
                <Contraintes items={contraintes}/>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const echsCourant = echangesDuCycle(p, null);
  const contrCourant = contraintesCycleCourant(p);
  const cyclesTries = [...(p.cycles || [])].sort((a: any, b: any) => b.cycle_num - a.cycle_num);

  return (
    <FicheModal titre={p.nom} onClose={onClose} zIndex={500} maxWidth={720}
      badges={<>
        {onglet !== "cibles" && badge && <span style={STATUT_BADGE[badge.label] || badge_gris}>{badge.label}</span>}
        {p.siege_nom && <span style={badge_bleu}>{p.siege_nom}</span>}
      </>}>
      <style>{`.cr-rte, .cr-rte *{font-size:var(--t-12) !important; line-height:1.6 !important;}`}</style>

      {/* ── Onglet ciblés : fiche ── */}
      {onglet === "cibles" && <>

      {/* Contact */}
      {(tels.length > 0 || mails.length > 0 || p.siteweb || p.linkedin) && (
        <FicheSection titre="Contact">
          <FicheGrille>
            {tels.length > 0 && (
              <FicheBloc label={tels.length > 1 ? "Téléphones" : "Téléphone"}>
                {tels.map((t: string, i: number) => <FicheValeur key={i}>{fmtPhone(t)}</FicheValeur>)}
              </FicheBloc>
            )}
            {mails.length > 0 && (
              <FicheBloc label={mails.length > 1 ? "Emails" : "Email"}>
                {mails.map((m: string, i: number) => (
                  <p key={i} style={{ fontSize: "var(--t-125)", fontWeight: 600, color: "var(--encre)", wordBreak: "break-all" }}>{m}</p>
                ))}
              </FicheBloc>
            )}
            {p.siteweb && <FicheBloc label="Site web"><FicheLien href={p.siteweb}>{p.siteweb}</FicheLien></FicheBloc>}
            {p.linkedin && <FicheBloc label="LinkedIn"><FicheLien href={p.linkedin}>{p.linkedin}</FicheLien></FicheBloc>}
          </FicheGrille>
        </FicheSection>
      )}

      {/* Activités spécialisées */}
      {hasNaema && secteurs.length > 0 && (
        <FicheSection titre="Activités spécialisées">
          <FicheArbreNaema secteurs={secteurs} branches={branches} activites={activites} secIds={secIds} braIds={braIds} actIds={actIds} />
        </FicheSection>
      )}

      {/* Points focaux */}
      {p.points_focaux?.length > 0 && (
        <FicheSection titre="Points focaux">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {p.points_focaux.map((pf: any, i: number) => (
              <FicheCarteNeutre key={i} style={{ padding: "11px 14px", fontSize: "var(--t-12)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--encre)" }}>{[pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                  {pf.est_principal && <span style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--orange)", background: "rgb(var(--orange-rgb) / 0.08)", borderRadius: 999, padding: "2px 8px" }}>Principal</span>}
                </div>
                <FicheContacts tels={(pf.telephones || []).filter(Boolean)} mails={(pf.mails || []).filter(Boolean)} />
              </FicheCarteNeutre>
            ))}
          </div>
        </FicheSection>
      )}

      </>}

      {/* ── Onglet en contact : compte rendu des échanges ── */}
      {onglet === "historique" && <>
        {(echsCourant.length > 0 || contrCourant.length > 0) && (
          <FicheSection titre="Compte rendu des échanges" count={echsCourant.length}>
            {echsCourant.length > 0 && <Timeline echanges={echsCourant}/>}
            {contrCourant.length > 0 && (
              <div style={{ marginTop: echsCourant.length ? 18 : 0, paddingTop: echsCourant.length ? 16 : 0, borderTop: echsCourant.length ? "1px solid var(--bordure)" : "none" }}>
                <p style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--bleu)", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  {contrCourant.length === 1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                </p>
                <Contraintes items={contrCourant}/>
              </div>
            )}
          </FicheSection>
        )}
        {cyclesTries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {cyclesTries.map((cy: any) => (
              <CycleBloc key={cy.id} id={cy.id} num={cy.cycle_num} issue={cy.issue} concluLe={cy.conclu_le}
                commentaire={cy.issue_commentaire} echanges={echangesDuCycle(p, cy)} contraintes={contraintesDuCycle(p, cy)}/>
            ))}
          </div>
        )}
      </>}

      {/* ── Onglet transformés : cycles ── */}
      {onglet === "termines" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {p.issue && (
            <CycleBloc id={-1} num={(p.cycles?.length || 0) + 1} issue={p.issue} concluLe={p.issue_conclu_le}
              commentaire={p.issue_commentaire} echanges={echsCourant} contraintes={contrCourant}/>
          )}
          {cyclesTries.map((cy: any) => (
            <CycleBloc key={cy.id} id={cy.id} num={cy.cycle_num} issue={cy.issue} concluLe={cy.conclu_le}
              commentaire={cy.issue_commentaire} echanges={echangesDuCycle(p, cy)} contraintes={contraintesDuCycle(p, cy)}/>
          ))}
        </div>
      )}
    </FicheModal>
  );
}
