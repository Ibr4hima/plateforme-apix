"use client";

// Modal vue prospect + helpers du cycle de prospection — partagés entre la
// page Prospects et la recherche globale (⌘K), qui l'ouvre depuis n'importe
// quelle page.

import { Building2, ChevronDown, ChevronUp, Clock, FileText, Globe, Mail, MapPin, MessageCircle, MessageSquare, Phone, Send, User, Video, X } from "lucide-react";
import { useState } from "react";
import { useNaema } from "@/lib/referentiels";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
  if (p?.issue === "installe") return { label: "Installation à venir", color: "#188038", bg: "rgba(24,128,56,0.08)" };
  if (p?.issue === "decline")  return { label: "Décliné",  color: "#6b7280", bg: "#F2F0EF" };
  // Après un re-contact, seule l'activité du cycle courant compte (même logique que l'admin).
  const debut = cycleCourantDebut(p);
  let dateDernierEchange = p?.date_dernier_echange;
  if (debut) {
    const echangesCycle = (p?.echanges||[]).filter((e:any)=>e.date_echange >= debut);
    if (!echangesCycle.length) return { label: "À recontacter", color: "#004f91", bg: "rgba(0,79,145,0.07)" };
    dateDernierEchange = echangesCycle.map((e:any)=>e.date_echange).sort().at(-1);
  }
  if (!dateDernierEchange) return null;
  const jours = Math.floor((Date.now() - new Date(dateDernierEchange).getTime()) / 86400000);
  if (jours <= 90)  return { label: "En cours",   color: "#188038", bg: "rgba(24,128,56,0.08)" };
  if (jours <= 120) return { label: "En attente", color: "#6b7280", bg: "#F2F0EF" };
  return                   { label: "Inactif",    color: "#dc2626", bg: "rgba(220,38,38,0.07)" };
}

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


// ── Filtre latéral générique ──────────────────────────────────────────────────

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

  const SecTitle = ({ children, count }: { children: string; count?: number }) => (
    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#004f91", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 10 }}>
      {children}{typeof count === "number" ? <span style={{ color: "#C5BFBB", fontWeight: 700, marginLeft: 7 }}>{count}</span> : null}
    </p>
  );
  const Bloc = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
    <div style={{ background: "rgba(0,79,145,0.04)", border: "1px solid rgba(0,79,145,0.10)", borderRadius: 10, padding: "9px 12px", minWidth: 0, gridColumn: full ? "1/-1" : undefined }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase" as const, marginBottom: 3 }}>{label}</p>
      {children}
    </div>
  );

  // Carte d'échange (lecture seule), même design que l'admin
  const EchangeCard = ({ e }: { e: any }) => (
    <div style={{ paddingLeft: 22, position: "relative" as const }}>
      <div style={{ position: "absolute" as const, left: 1, top: 16, width: 9, height: 9, borderRadius: "50%", background: "#004f91", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,79,145,0.27)" }}/>
      <div style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "13px 15px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e" }}>
          {new Date(e.date_echange).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
        {(e.canal || e.interlocuteur || e.contact_par) && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 6, marginTop: 8 }}>
            {e.canal && (() => { const CIcon = canalIcon(e.canal); const coord = canalContactDisplay(e.canal, e.canal_contact); return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "#4a5568", background: "#F5F4F3", padding: "3px 10px", borderRadius: 999 }}>
                <CIcon size={11} style={{ flexShrink: 0 }}/>{e.canal}{coord ? ` · ${coord}` : ""}
              </span>
            ); })()}
            {(e.interlocuteur || e.contact_par) && (
              <span style={{ fontSize: 11, color: "#98a1ad", fontWeight: 500 }}>
                {[e.interlocuteur, e.contact_par].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        )}
        {e.commentaire && (
          <div style={{ background: "#fff", border: "1px solid #F0EEEC", borderRadius: 10, padding: "10px 13px", marginTop: 10 }}>
            <div data-rte className="cr-rte" style={{ fontSize: 12, color: "#5b6472", lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: e.commentaire }}/>
          </div>
        )}
        {e.fichiers?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 8 }}>
            {e.fichiers.map((f: any) => (
              <a key={f.id}
                href={`${API_BASE}/prospects/echanges/${e.id}/fichiers/${f.id}/download`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 999, background: "rgba(0,79,145,0.06)", textDecoration: "none", fontSize: 11, color: "#004f91", fontWeight: 600 }}>
                <FileText size={11} style={{ flexShrink: 0 }}/>{f.titre}
              </a>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#98a1ad", marginTop: 10, paddingTop: 9, borderTop: "1px solid #F2F0EF" }}>
          <Clock size={11} style={{ flexShrink: 0 }}/>
          <span>Enregistré le {new Date(e.enregistre_le).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {e.retard_jours ? `saisi ${e.retard_jours} j après` : "saisi le jour même"}</span>
        </div>
      </div>
    </div>
  );

  // Timeline d'une liste d'échanges
  const Timeline = ({ echanges }: { echanges: any[] }) => (
    <div style={{ position: "relative" as const }}>
      <div style={{ position: "absolute" as const, left: 5, top: 10, bottom: 10, width: 2, background: "#F0EEEC", borderRadius: 2 }}/>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
        {[...echanges].sort((a: any, b: any) => a.date_echange.localeCompare(b.date_echange)).map((e: any) => <EchangeCard key={e.id} e={e}/>)}
      </div>
    </div>
  );

  // Contraintes (puces bleues alignées)
  const Contraintes = ({ items }: { items: any[] }) => (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
      {items.map((c: any) => (
        <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#5b6472" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#004f91", flexShrink: 0, marginTop: 6 }}/>
          <span style={{ lineHeight: 1.5 }}>{c.description.replace(/<[^>]+>/g, "").trim()}</span>
        </div>
      ))}
    </div>
  );

  // Bloc cycle repliable (archivé ou courant figé)
  const CycleBloc = ({ id, num, issue, concluLe, commentaire, echanges, contraintes }: any) => {
    const inst = issue === "installe";
    const col = inst ? "#188038" : "#6b7280";
    const isOpen = openCycles.has(id);
    return (
      <div style={{ border: "1px solid #F0EEEC", borderRadius: 12, overflow: "hidden" as const }}>
        <button onClick={() => toggleCycle(id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: isOpen ? "#FAFAF9" : "#fff", border: "none", cursor: "pointer", textAlign: "left" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#98a1ad", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Cycle {num}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>— {inst ? "Installation au Sénégal" : "Possibilité écartée"}</span>
            {concluLe && <span style={{ fontSize: 11, color: "#98a1ad" }}>· Conclu le {new Date(concluLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>}
          </div>
          {isOpen ? <ChevronUp size={14} style={{ color: "#98a1ad", flexShrink: 0 }}/> : <ChevronDown size={14} style={{ color: "#98a1ad", flexShrink: 0 }}/>}
        </button>
        {isOpen && (
          <div style={{ borderTop: "1px solid #F0EEEC", padding: "16px 16px", background: "#fff", display: "flex", flexDirection: "column" as const, gap: 14 }}>
            {commentaire && (
              <div data-rte style={{ fontSize: 13, color: "#5b6472", lineHeight: 1.7, fontStyle: "italic" }}
                dangerouslySetInnerHTML={{ __html: commentaire }}/>
            )}
            {echanges.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#98a1ad", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>Historique</p>
                <Timeline echanges={echanges}/>
              </div>
            )}
            {contraintes.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}\n.cr-rte, .cr-rte *{font-size:12px !important; line-height:1.6 !important;}`}</style>
      <div onClick={ev => ev.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }}/>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", lineHeight: 1.3 }}>{p.nom}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 8 }}>
              {onglet !== "cibles" && badge && (
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: badge.color, background: badge.bg, padding: "3px 10px", borderRadius: 999 }}>{badge.label}</span>
              )}
              {p.siege_nom && (
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999 }}>{p.siege_nom}</span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "#F5F4F3", border: "none", cursor: "pointer", borderRadius: 99, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={ev => (ev.currentTarget.style.background = "#ECEAE8")}
            onMouseLeave={ev => (ev.currentTarget.style.background = "#F5F4F3")}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: "22px 28px", overflowY: "auto" as const, flex: 1, display: "flex", flexDirection: "column" as const, gap: 22 }}>

          {/* ── Onglet ciblés : fiche ── */}
          {onglet === "cibles" && <>

          {/* Contact */}
          {(tels.length > 0 || mails.length > 0 || p.siteweb || p.linkedin) && (
            <section>
              <SecTitle>Contact</SecTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {tels.length > 0 && (
                  <Bloc label={tels.length > 1 ? "Téléphones" : "Téléphone"}>
                    {tels.map((t: string, i: number) => <p key={i} style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e" }}>{fmtPhone(t)}</p>)}
                  </Bloc>
                )}
                {mails.length > 0 && (
                  <Bloc label={mails.length > 1 ? "Emails" : "Email"}>
                    {mails.map((m: string, i: number) => <p key={i} style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e", wordBreak: "break-all" as const }}>{m}</p>)}
                  </Bloc>
                )}
                {p.siteweb && (
                  <Bloc label="Site web"><a href={p.siteweb.startsWith("http") ? p.siteweb : `https://${p.siteweb}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "#004f91", textDecoration: "none", wordBreak: "break-all" as const }}>{p.siteweb}</a></Bloc>
                )}
                {p.linkedin && (
                  <Bloc label="LinkedIn"><a href={p.linkedin.startsWith("http") ? p.linkedin : `https://${p.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "#004f91", textDecoration: "none", wordBreak: "break-all" as const }}>{p.linkedin}</a></Bloc>
                )}
              </div>
            </section>
          )}

          {/* Activités spécialisées */}
          {hasNaema && secteurs.length > 0 && (
            <section>
              <SecTitle>Activités spécialisées</SecTitle>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {secIds.map((secId: number) => {
                  const sec = secteurs.find((sx: any) => sx.id === secId); if (!sec) return null;
                  const brasDuSec = branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: brasDuSec.length ? 5 : 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#004f91", flexShrink: 0 }}/>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#004f91" }}>{sec.nom}</span>
                      </div>
                      {brasDuSec.length > 0 && (
                        <div style={{ paddingLeft: 20, borderLeft: "2px solid rgba(0,79,145,0.15)", display: "flex", flexDirection: "column" as const, gap: 5 }}>
                          {brasDuSec.map((bra: any) => {
                            const actsDeBra = activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id));
                            return (
                              <div key={bra.id}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: actsDeBra.length ? 4 : 0 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ca631f", flexShrink: 0 }}/>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "#ca631f" }}>{bra.nom}</span>
                                </div>
                                {actsDeBra.length > 0 && (
                                  <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column" as const, gap: 3 }}>
                                    {actsDeBra.map((act: any) => (
                                      <div key={act.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#188038", flexShrink: 0 }}/>
                                        <span style={{ fontSize: 11, color: "#188038", fontWeight: 500 }}>{act.nom}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Points focaux */}
          {p.points_focaux?.length > 0 && (
            <section>
              <SecTitle>Points focaux</SecTitle>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {p.points_focaux.map((pf: any, i: number) => {
                  const pfTels = (pf.telephones || []).filter(Boolean);
                  const pfMails = (pf.mails || []).filter(Boolean);
                  return (
                    <div key={i} style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "11px 14px", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                        <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{[pf.prenom, pf.nom].filter(Boolean).join(" ")}</span>
                        {pf.est_principal && <span style={{ fontSize: 10, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.08)", borderRadius: 999, padding: "2px 8px" }}>Principal</span>}
                      </div>
                      {(pfTels.length > 0 || pfMails.length > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 7 }}>
                          {pfTels.map((t: string, ti: number) => (
                            <span key={`t${ti}`} style={{ fontSize: 11, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999 }}>{fmtPhone(t)}</span>
                          ))}
                          {pfMails.map((m: string, mi: number) => (
                            <span key={`m${mi}`} style={{ fontSize: 11, fontWeight: 600, color: "#188038", background: "rgba(24,128,56,0.07)", padding: "3px 10px", borderRadius: 999 }}>{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          </>}

          {/* ── Onglet en contact : compte rendu des échanges ── */}
          {onglet === "historique" && <>
            {(echsCourant.length > 0 || contrCourant.length > 0) && (
              <section>
                <SecTitle count={echsCourant.length}>Compte rendu des échanges</SecTitle>
                {echsCourant.length > 0 && <Timeline echanges={echsCourant}/>}
                {contrCourant.length > 0 && (
                  <div style={{ marginTop: echsCourant.length ? 18 : 0, paddingTop: echsCourant.length ? 16 : 0, borderTop: echsCourant.length ? "1px solid #F2F0EF" : "none" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                      {contrCourant.length === 1 ? "Contrainte exprimée" : "Contraintes exprimées"}
                    </p>
                    <Contraintes items={contrCourant}/>
                  </div>
                )}
              </section>
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

        </div>

        {/* Pied */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
