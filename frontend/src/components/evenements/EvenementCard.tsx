"use client";

import { Calendar, MapPin, Building2, Globe, ExternalLink } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  salon:               "Salon",
  forum:               "Forum",
  conference:          "Conférence",
  mission_prospection: "Mission",
  roadshow:            "Roadshow",
  b2b:                 "B2B",
  webinaire:           "Webinaire",
  visite_terrain:      "Visite terrain",
  autre:               "Autre",
};

const TYPE_COLORS: Record<string, string> = {
  salon:               "#ca631f",
  forum:               "#004f91",
  conference:          "#7c3aed",
  mission_prospection: "#059669",
  roadshow:            "#dc2626",
  b2b:                 "#d97706",
  webinaire:           "#0891b2",
  visite_terrain:      "#65a30d",
  autre:               "#6b7280",
};

function getStatut(dateDebut: string, dateFin: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d0    = new Date(dateDebut); d0.setHours(0,0,0,0);
  const d1    = new Date(dateFin);   d1.setHours(0,0,0,0);
  if (d0 > today)  return { bg: "#dbeafe", text: "#1d4ed8", label: "À venir"  };
  if (d1 >= today) return { bg: "#dcfce7", text: "#15803d", label: "En cours" };
  return               { bg: "#f3f4f6", text: "#6b7280", label: "Terminé"  };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function EvenementCard({ event, onClick }: { event: any; onClick: () => void }) {
  const accentColor = TYPE_COLORS[event.type_evenement] || "#ca631f";
  const statut      = getStatut(event.date_debut, event.date_fin);
  const isSameDay   = event.date_debut === event.date_fin;

  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.85)",
      border: "1px solid #C5BFBB",
      borderRadius: 16, padding: "20px",
      cursor: "pointer", transition: "all 0.25s",
      display: "flex", flexDirection: "column", gap: 12,
      borderLeft: `4px solid ${accentColor}`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,0.1)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: accentColor,
          background: `${accentColor}15`, padding: "3px 10px",
          borderRadius: 999, letterSpacing: "0.05em",
        }}>
          {TYPE_LABELS[event.type_evenement] || event.type_evenement}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: statut.bg, color: statut.text,
          padding: "3px 10px", borderRadius: 999,
        }}>
          {statut.label}
        </span>
      </div>

      {/* Titre */}
      <div>
        <h3 style={{
          fontFamily: "var(--font-google-sans)", fontWeight: 700,
          fontSize: 15, color: "#1a1a2e", lineHeight: 1.35,
          marginBottom: event.edition ? 4 : 0,
        }}>
          {event.nom_event}
        </h3>
        {event.edition && (
          <span style={{ fontSize: 12, color: "#9aa5b4" }}>{event.edition}</span>
        )}
      </div>

      {/* Infos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#4a5568", fontSize: 13 }}>
          <Calendar size={13} style={{ color: accentColor, flexShrink: 0 }} />
          {isSameDay ? formatDate(event.date_debut) : `${formatDate(event.date_debut)} → ${formatDate(event.date_fin)}`}
        </div>
        {(event.ville || event.pays_nom) && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#4a5568", fontSize: 13 }}>
            {event.est_virtuel
              ? <Globe size={13} style={{ color: accentColor }} />
              : <MapPin size={13} style={{ color: accentColor }} />
            }
            {event.est_virtuel ? "Virtuel" : [event.ville, event.pays_nom].filter(Boolean).join(", ")}
          </div>
        )}
        {event.organisateur && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#4a5568", fontSize: 13 }}>
            <Building2 size={13} style={{ color: accentColor, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {event.organisateur}
            </span>
          </div>
        )}
      </div>

      {/* Thématiques */}
      {event.thematiques && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {event.thematiques.split(",").slice(0, 3).map((t: string, i: number) => (
            <span key={i} style={{
              fontSize: 11, color: "#4a5568",
              background: "#E8E5E3", padding: "2px 8px", borderRadius: 999,
            }}>
              {t.trim()}
            </span>
          ))}
        </div>
      )}

      {event.lien_site_officiel && (
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: accentColor, fontWeight: 600 }}>
          Voir le site <ExternalLink size={11} />
        </div>
      )}
    </div>
  );
}
