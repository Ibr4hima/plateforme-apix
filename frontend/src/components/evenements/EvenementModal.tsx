"use client";

import { X, Calendar, MapPin, Globe, Building2, Users, TrendingUp, ExternalLink, RefreshCw } from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

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
        <div style={{ height: 5, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: "24px 24px 0 0" }} />

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
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: "1.35rem", color: "#1a1a2e", lineHeight: 1.3,
              }}>
                {event.nom_event}
                {event.edition && <span style={{ fontSize: 14, fontWeight: 400, color: "#9aa5b4", marginLeft: 8 }}>{event.edition}</span>}
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
              value={event.est_virtuel ? "Événement virtuel" : [event.lieu_nom, event.ville, event.pays_nom].filter(Boolean).join(", ") || "—"} />
            {event.organisateur && (
              <InfoItem icon={<Building2 size={14} />} label="Organisateur" accent={accent} value={event.organisateur} />
            )}
            {event.role_apix && (
              <InfoItem icon={<TrendingUp size={14} />} label="Rôle APIX" accent={accent}
                value={event.role_apix.replace("_", " ")} />
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

          {/* Thématiques */}
          {event.thematiques && (
            <TagSection label="Thématiques" items={event.thematiques.split(",")} accent={accent} />
          )}
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
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: accent }}>{event.nombre_prospects_rencontres}</div>
                    <div style={{ fontSize: 12, color: "#4a5568" }}>Prospects rencontrés</div>
                  </div>
                )}
                {event.montant_intentions_usd && (
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: accent }}>
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
