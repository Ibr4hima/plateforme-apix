"use client";

import Navbar from "@/components/layout/Navbar";
import { Building2, ChevronDown, ChevronUp, Clock, FileText, Globe, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Phone, Search, Send, SlidersHorizontal, User, Video, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { parsePhoneNumber } from "libphonenumber-js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, j] = d.split("-").map(Number);
  return new Date(y, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function badgeProspect(p: any) {
  if (p?.issue === "installe") return { label: "Installation à venir", color: "#188038", bg: "rgba(24,128,56,0.08)" };
  if (p?.issue === "decline")  return { label: "Décliné",  color: "#6b7280", bg: "#F2F0EF" };
  if (!p?.date_dernier_echange) return null;
  const jours = Math.floor((Date.now() - new Date(p.date_dernier_echange).getTime()) / 86400000);
  if (jours <= 30) return { label: "En cours",   color: "#188038", bg: "rgba(24,128,56,0.08)" };
  if (jours <= 60) return { label: "En attente", color: "#ca631f", bg: "rgba(202,99,31,0.08)" };
  return                  { label: "Inactif",    color: "#dc2626", bg: "rgba(220,38,38,0.07)" };
}

// Début du cycle de prospection courant : date du dernier re-contact.
function cycleCourantDebut(p:any): string|null {
  const dates = (p?.cycles||[]).map((c:any)=>c.recontacte_le).filter(Boolean).map((d:string)=>d.slice(0,10));
  return dates.length ? dates.sort().at(-1) : null;
}

// Contraintes rattachées à un cycle donné (null = cycle courant).
function contraintesDuCycle(p:any, cy:any): any[] {
  const nbCycles = (p?.cycles || []).length;
  return (p?.contraintes || []).filter((c:any)=>{
    return cy ? (c.cycle_num === cy.cycle_num - 1) : (c.cycle_num === nbCycles);
  });
}
function contraintesCycleCourant(p:any): any[] { return contraintesDuCycle(p, null); }

// Échanges rattachés à un cycle donné (null = cycle courant).
function echangesDuCycle(p:any, cy:any): any[] {
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

function canalIcon(canal: string): any {
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

function canalContactDisplay(canal: string, contact: string): string {
  if (!contact) return "";
  if (PHONE_CANAUX.includes(canal)) return fmtPhone(contact);
  return contact;
}

function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw).formatInternational(); } catch { return raw; }
}

// ── Filtre latéral générique ──────────────────────────────────────────────────

function SideFilter({ label, items, selected, onToggle, color }: {
  label: string; items: string[]; selected: string[]; onToggle: (v: string) => void; color: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: open ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{label}</span>
          {selected.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "18", padding: "1px 6px", borderRadius: 999 }}>{selected.length}</span>}
        </div>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#F5F4F3", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {open ? <ChevronUp size={11} style={{ color: "#4a5568" }} /> : <ChevronDown size={11} style={{ color: "#4a5568" }} />}
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, maxHeight: 180, overflowY: "auto" as const }}>
          {items.map(item => {
            const sel = selected.includes(item);
            return (
              <button key={item} onClick={() => onToggle(item)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left" as const }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? color : "#C5BFBB"}`, background: sel ? color : "transparent", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400 }}>{item}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Carte prospect ────────────────────────────────────────────────────────────

function CarteProspect({ p, onglet, onOpen }: { p: any; onglet: "cibles" | "historique" | "termines"; onOpen?: () => void }) {
  const badge = badgeProspect(p);
  const tel = p.telephones?.[0] || p.points_focaux?.[0]?.telephones?.[0] || "";
  const mail = p.mails?.[0] || p.points_focaux?.[0]?.mails?.[0] || "";
  const nbActs = (p.activite_ids || []).length;
  // Second bloc libellé, contextuel selon l'onglet
  const info2 = onglet === "cibles"
    ? { label: "Téléphone", value: tel ? fmtPhone(tel) : null }
    : onglet === "historique"
    ? { label: "Dernier échange", value: p.date_dernier_echange ? fmtDate(p.date_dernier_echange) : null }
    : (p.issue === "installe"
        ? { label: "Accord conclu", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : p.issue === "decline"
        ? { label: "Décliné le", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : { label: "Conclusion", value: null });

  return (
    <div onClick={onOpen}
      style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, cursor: onOpen ? "pointer" : "default", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>

      <div style={{ padding: "14px 16px 14px", flex: 1 }}>
        {/* Statut / email + siège */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {onglet === "cibles" ? (
            mail ? (
              <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }}>{mail}</span>
            ) : <span />
          ) : badge ? (
            <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: badge.color, background: badge.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" as const }}>{badge.label}</span>
          ) : <span />}
          {p.siege_nom && <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.07)", padding: "3px 10px", borderRadius: 999, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "45%", flexShrink: 0 }}>{p.siege_nom}</span>}
        </div>

        {/* Dénomination */}
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>

        {/* Infos libellées */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <div style={{ background: "rgba(0,79,145,0.04)", border: "1px solid rgba(0,79,145,0.10)", borderRadius: 10, padding: "8px 11px", minWidth: 0 }}>
            {onglet === "cibles" ? <>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase" as const, marginBottom: 3 }}>Activités spécialisées</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: nbActs > 0 ? "#1a1a2e" : "#9aa5b4" }}>{nbActs || "—"}</p>
            </> : <>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase" as const, marginBottom: 3 }}>Email</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: mail ? "#1a1a2e" : "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{mail || "—"}</p>
            </>}
          </div>
          <div style={{ background: "rgba(0,79,145,0.04)", border: "1px solid rgba(0,79,145,0.10)", borderRadius: 10, padding: "8px 11px", minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase" as const, marginBottom: 3 }}>{info2.label}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: info2.value ? "#1a1a2e" : "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{info2.value || "—"}</p>
          </div>
        </div>
      </div>

      {/* Nb échanges */}
      {p.echanges?.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #F2F0EF", padding: "10px 0", fontSize: 11.5, color: "#9aa5b4", fontWeight: 600 }}>
          {p.echanges.length} échange{p.echanges.length > 1 ? "s" : ""} enregistré{p.echanges.length > 1 ? "s" : ""}
        </div>
      )}

      {/* Action */}
      {onOpen && !(p.echanges?.length > 0) && (
        <div style={{ display: "flex", borderTop: "1px solid #F2F0EF" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "#004f91", fontWeight: 600, transition: "background 0.15s" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgba(0,79,145,0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Voir la fiche →
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal fiche prospect (lecture seule) ──────────────────────────────────────

function ProspectPublicVue({ p, onglet, onClose }: { p: any; onglet: "cibles" | "historique" | "termines"; onClose: () => void }) {
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);
  const [openCycles, setOpenCycles] = useState<Set<number>>(new Set());
  const toggleCycle = (id:number) => setOpenCycles(prev=>{ const st=new Set(prev); st.has(id)?st.delete(id):st.add(id); return st; });

  useEffect(() => {
    if (onglet !== "cibles") return;
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
    ]).then(([s, b, a]) => { setSecteurs(s || []); setBranches(b || []); setActivites(a || []); }).catch(() => {});
  }, [p.id, onglet]);

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
      <div onClick={ev => ev.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
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

// ── Page principale ───────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const [onglet, setOnglet] = useState<"cibles" | "historique" | "termines">("cibles");

  // Données
  const [cibles,    setCibles]    = useState<any[]>([]);
  const [enContact, setEnContact] = useState<any[]>([]);
  const [termines,  setTermines]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selec,     setSelec]     = useState<any>(null);

  // Filtres
  const [recherche,   setRecherche]   = useState("");
  const [paysOpts,    setPaysOpts]    = useState<string[]>([]);
  const [paysSel,     setPaysSel]     = useState<string[]>([]);
  const [secteurOpts, setSecteurOpts] = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);

  // Sidebar
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(480, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [rCibles, rContact, rTermines] = await Promise.all([
        fetch(`${API_BASE}/prospects?conclu=false&contactes=false&per_page=100`).then(r => r.json()),
        fetch(`${API_BASE}/prospects?conclu=false&contactes=true&per_page=100`).then(r => r.json()),
        fetch(`${API_BASE}/prospects?conclu=true&per_page=100`).then(r => r.json()),
      ]);
      const c = rCibles.data   || [];
      const e = rContact.data  || [];
      const t = rTermines.data || [];
      setCibles(c);
      setEnContact(e);
      setTermines(t);

      const tous = [...c, ...e, ...t];
      const pays = [...new Set(tous.map((p: any) => p.siege_nom).filter(Boolean))] as string[];
      const secs = [...new Set(tous.flatMap((p: any) => p.secteur_noms || []).filter(Boolean))] as string[];
      setPaysOpts(pays.sort());
      setSecteurOpts(secs.sort());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Filtrage
  const filtrer = (liste: any[]) => liste.filter(p => {
    if (recherche) {
      const q = recherche.toLowerCase();
      if (!p.nom?.toLowerCase().includes(q)) return false;
    }
    if (paysSel.length > 0 && !paysSel.includes(p.siege_nom || "")) return false;
    if (secteursSel.length > 0 && !secteursSel.some((s: string) => (p.secteur_noms || []).includes(s))) return false;
    return true;
  });

  const togglePays    = (v: string) => setPaysSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur = (v: string) => setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = !!recherche || paysSel.length > 0 || secteursSel.length > 0;
  const reinit = () => { setRecherche(""); setPaysSel([]); setSecteursSel([]); };
  const nbFiltres = (recherche ? 1 : 0) + paysSel.length + secteursSel.length;

  const listeCourante = filtrer(onglet === "cibles" ? cibles : onglet === "historique" ? enContact : termines);
  const total = cibles.length + enContact.length + termines.length;

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ padding: "100px 40px 40px", background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", position: "relative" as const, overflow: "hidden" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" as const, zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(202,99,31,0.1)", border: "1px solid rgba(202,99,31,0.25)", borderRadius: 999, padding: "6px 14px", marginBottom: 17 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#D96D3B", letterSpacing: "0.15em", textTransform: "uppercase" }}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(2.2rem,4vw,3.2rem)", color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>Prospects</h1>
          {total > 0 && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 999 }}>
            {total} prospect{total > 1 ? "s" : ""}
          </span>}
        </div>
      </section>

      {/* ── Onglets sticky ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E5E3", position: "sticky" as const, top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 40px", display: "flex", gap: 0 }}>
          {([
            { key: "cibles",     label: "Investisseurs ciblés",   count: cibles.length    },
            { key: "historique", label: enContact.length > 1 ? "Investisseurs en contact" : "Investisseur en contact", count: enContact.length },
            { key: "termines",   label: termines.length  > 1 ? "Investisseurs transformés" : "Investisseur transformé", count: termines.length  },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              style={{ padding: "16px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", fontSize: 13, fontWeight: 600, color: onglet === t.key ? "#004f91" : "#9aa5b4", borderBottom: `2px solid ${onglet === t.key ? "#004f91" : "transparent"}`, transition: "all 0.15s" }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: onglet === t.key ? "#004f91" : "#9aa5b4", background: onglet === t.key ? "rgba(0,79,145,0.1)" : "#F2F0EF", padding: "1px 7px", borderRadius: 999 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Corps : sidebar + grille ── */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* Sidebar */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 64px)", overflowY: "auto" as const, position: "sticky" as const, top: 64, display: "flex", flexDirection: "column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute" as const, right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.3)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
                {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen && hasFilter && <button onClick={reinit} title="Tout réinitialiser"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#dc2626", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen && (
            <div style={{ padding: "16px", overflowY: "auto" as const, flex: 1 }}>
              {/* Recherche */}
              <div style={{ position: "relative" as const, marginBottom: 18 }}>
                <Search size={13} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
                <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
                  style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
                {recherche && <button onClick={() => setRecherche("")} style={{ position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
              </div>
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
              {paysOpts.length > 0 && <SideFilter label="Pays / Siège" color="#004f91" items={paysOpts} selected={paysSel} onToggle={togglePays} />}
              {secteurOpts.length > 0 && <><div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} /><SideFilter label="Secteur" color="#004f91" items={secteurOpts} selected={secteursSel} onToggle={toggleSecteur} /></>}
            </div>
          )}
        </aside>

        {/* Grille */}
        <div style={{ flex: 1, minWidth: 0, padding: "36px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
            </div>
          ) : listeCourante.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <Building2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun prospect trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
              {hasFilter && <button onClick={reinit} style={{ marginTop: 16, padding: "8px 18px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Effacer les filtres</button>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
              {listeCourante.map(p => <CarteProspect key={p.id} p={p} onglet={onglet} onOpen={() => setSelec(p)} />)}
            </div>
          )}
        </div>
      </div>

      {selec && <ProspectPublicVue p={selec} onglet={onglet} onClose={() => setSelec(null)} />}
    </main>
  );
}
