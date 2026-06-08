"use client";

import { X, Calendar, MapPin, Globe, Building2, Users, TrendingUp, ExternalLink, RefreshCw } from "lucide-react";

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const ROLE_APIX_LABELS: Record<string, string> = {
  organisateur:    "Organisateur",
  co_organisateur: "Co-organisateur",
  participant:     "Participant",
  sponsor:         "Sponsor",
  invite:          "Invité",
};

const TYPE_COLORS: Record<string, string> = {
  salon: "#ca631f", forum: "#004f91", conference: "#7c3aed",
  mission_prospection: "#059669", roadshow: "#dc2626",
  b2b: "#d97706", webinaire: "#0891b2", visite_terrain: "#65a30d", autre: "#6b7280",
};

export default function EvenementModal({ event, onClose }: { event: any; onClose: () => void }) {
  if (!event) return null;
  const accent   = TYPE_COLORS[event.type_evenement] || "#ca631f";
  const isSameDay = event.date_debut === event.date_fin;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
      }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "#FAFAF9",
        borderRadius: 24, width: "100%", maxWidth: 620,
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        border: "1px solid #C5BFBB",
      }}>
        {/* Bande colorée haut */}
        <div style={{ height: 5, background: "linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)" }} />

        <div style={{ padding: "28px 32px 32px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: accent,
                background: `${accent}15`, padding: "3px 12px",
                borderRadius: 999, display: "inline-block", marginBottom: 10,
              }}>
                {event.type_evenement?.replace("_", " ").toUpperCase()}
              </span>
              <h2 style={{
                fontFamily: "var(--font-google-sans)", fontWeight: 800,
                fontSize: "1.35rem", color: "#1a1a2e", lineHeight: 1.3,
              }}>
                {event.nom_event}
                {event.edition && (
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#9aa5b4", marginLeft: 8 }}>
                    {event.edition === 1 ? "1ère édition" : `${event.edition}ème édition`}
                  </span>
                )}
              </h2>
            </div>
            <button onClick={onClose} style={{
              background: "#E8E5E3", border: "none", cursor: "pointer",
              borderRadius: 10, padding: 8, marginLeft: 12, flexShrink: 0,
            }}>
              <X size={16} color="#4a5568" />
            </button>
          </div>

          {/* Infos principales */}
          <div style={{
            background: "#F2F0EF", borderRadius: 16, padding: "16px 20px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20,
          }}>
            <InfoItem icon={<Calendar size={14} />} label="Dates" accent={accent}
              value={isSameDay ? formatDate(event.date_debut) : `${formatDate(event.date_debut)} — ${formatDate(event.date_fin)}`} />
            <InfoItem icon={event.est_virtuel ? <Globe size={14} /> : <MapPin size={14} />}
              label="Lieu" accent={accent}
              value={event.est_virtuel ? "Événement virtuel" : [event.ville, event.pays_hote_nom].filter(Boolean).join(", ") || "—"} />
            {event.organisateur && (
              <InfoItem icon={<Building2 size={14} />} label="Organisateur" accent={accent} value={event.organisateur} />
            )}
            {event.role_apix && (
              <InfoItem icon={<TrendingUp size={14} />} label="Rôle APIX" accent={accent}
                value={ROLE_APIX_LABELS[event.role_apix] || event.role_apix} />
            )}
            {event.est_recurrent && event.frequence && (
              <InfoItem icon={<RefreshCw size={14} />} label="Récurrence" accent={accent} value={event.frequence} />
            )}
            {event.nombre_participants && (
              <InfoItem icon={<Users size={14} />} label="Participants" accent={accent}
                value={event.nombre_participants.toLocaleString("fr-FR")} />
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Description</p>
              <p style={{ color: "#4a5568", fontSize: 14, lineHeight: 1.7 }}>{event.description}</p>
            </div>
          )}

          {/* Thématiques organisées */}
          {event.thematiques_naema && (() => {
            const items = event.thematiques_naema.split(",").map((t: string) => t.trim()).filter(Boolean);
            const secteurs = items.filter((t: string) => t.startsWith("sec:")).map((t: string) => t.slice(4));
            const branches = items.filter((t: string) => t.startsWith("bra:")).map((t: string) => t.slice(4));
            const activites = items.filter((t: string) => t.startsWith("act:")).map((t: string) => t.slice(4));
            // Fallback ancien format sans préfixe
            const ancienFormat = items.every((t: string) => !t.startsWith("sec:") && !t.startsWith("bra:") && !t.startsWith("act:"));
            if (ancienFormat) {
              return <TagSection label="Thématiques" items={items} accent={accent} />;
            }
            return (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Thématiques</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {secteurs.map((sec: string, i: number) => (
                    <div key={i}>
                      {/* Secteur */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ca631f", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#ca631f" }}>{sec}</span>
                      </div>
                      {/* Branches liées */}
                      {branches.length > 0 && (
                        <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                          {branches.map((bra: string, j: number) => (
                            <div key={j}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#004f91" }}>{bra}</span>
                              </div>
                              {/* Activités liées à cette branche */}
                              {activites.length > 0 && (
                                <div style={{ paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {activites.map((act: string, k: number) => (
                                    <span key={k} style={{
                                      fontSize: 11, color: "#059669", fontWeight: 600,
                                      background: "rgba(5,150,105,0.08)", padding: "2px 8px",
                                      borderRadius: 999, border: "1px solid rgba(5,150,105,0.2)",
                                    }}>
                                      {act}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Activités sans branche */}
                      {branches.length === 0 && activites.length > 0 && (
                        <div style={{ paddingLeft: 18, display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {activites.map((act: string, k: number) => (
                            <span key={k} style={{
                              fontSize: 11, color: "#059669", fontWeight: 600,
                              background: "rgba(5,150,105,0.08)", padding: "2px 8px",
                              borderRadius: 999, border: "1px solid rgba(5,150,105,0.2)",
                            }}>
                              {act}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Branches sans secteur */}
                  {secteurs.length === 0 && branches.length > 0 && (
                    <TagSection label="" items={branches} accent="#004f91" />
                  )}
                </div>
              </div>
            );
          })()}
          {event.pays_invites && (
            <TagSection label="Pays invités" items={event.pays_invites.split(",")} accent={accent} />
          )}
          {event.entreprises_invitees && (
            <TagSection label="Entreprises invitées" items={event.entreprises_invitees.split(",")} accent={accent} />
          )}

          {/* Résultats */}
          {(event.montant_intentions_usd || event.nombre_prospects_rencontres) && (
            <div style={{ background: `${accent}08`, border: `1px solid ${accent}22`, borderRadius: 12, padding: "14px 18px", marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Résultats</p>
              <div style={{ display: "flex", gap: 20 }}>
                {event.nombre_prospects_rencontres && (
                  <div>
                    <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: 22, color: accent }}>{event.nombre_prospects_rencontres}</div>
                    <div style={{ fontSize: 12, color: "#4a5568" }}>Prospects rencontrés</div>
                  </div>
                )}
                {event.montant_intentions_usd && (
                  <div>
                    <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: 22, color: accent }}>
                      {(event.montant_intentions_usd / 1_000_000).toFixed(0)} M$
                    </div>
                    <div style={{ fontSize: 12, color: "#4a5568" }}>Intentions générées</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lien externe */}
          {event.lien_site_officiel && (
            <a href={event.lien_site_officiel} target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20,
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                color: "#fff", fontWeight: 600, fontSize: 14,
                padding: "11px 22px", borderRadius: 12, textDecoration: "none",
              }}>
              Voir le site officiel <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, accent }: any) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function TagSection({ label, items, accent }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((t: string, i: number) => (
          <span key={i} style={{
            fontSize: 12, color: accent, fontWeight: 600,
            background: `${accent}12`, padding: "4px 12px", borderRadius: 999,
            border: `1px solid ${accent}25`,
          }}>
            {t.trim()}
          </span>
        ))}
      </div>
    </div>
  );
}
