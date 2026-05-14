"use client";

import { FileText, Calendar, Globe, Building2, Download } from "lucide-react";

const STATUT_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  en_vigueur:         { bg: "#dcfce7", text: "#15803d", label: "En vigueur"         },
  signe_non_ratifie:  { bg: "#dbeafe", text: "#1d4ed8", label: "Signé non ratifié"  },
  expire:             { bg: "#f3f4f6", text: "#6b7280", label: "Expiré"             },
  suspendu:           { bg: "#fee2e2", text: "#dc2626", label: "Suspendu"           },
  negocie:            { bg: "#fef9c3", text: "#a16207", label: "En négociation"     },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccordCard({ accord, onClick }: { accord: any; onClick: () => void }) {
  const statut = STATUT_CONFIG[accord.statut] || STATUT_CONFIG.en_vigueur;

  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.85)",
      border: "1px solid #C5BFBB",
      borderLeft: "4px solid #004f91",
      borderRadius: 16, padding: "20px",
      cursor: "pointer", transition: "all 0.25s",
      display: "flex", flexDirection: "column", gap: 12,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,0.09)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#004f91",
          background: "rgba(0,79,145,0.1)", padding: "3px 10px",
          borderRadius: 999, letterSpacing: "0.04em",
        }}>
          {accord.type_accord || "Accord"}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: statut.bg, color: statut.text,
          padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap",
        }}>
          {statut.label}
        </span>
      </div>

      {/* Titre */}
      <div>
        <h3 style={{
          fontFamily: "var(--font-google-sans)", fontWeight: 700,
          fontSize: 15, color: "#1a1a2e", lineHeight: 1.35, marginBottom: 4,
        }}>
          {accord.titre}
        </h3>
        {accord.reference && (
          <span style={{ fontSize: 11, color: "#9aa5b4" }}>Réf. {accord.reference}</span>
        )}
      </div>

      {/* Infos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {accord.pays_signataires && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Globe size={13} style={{ color: "#004f91", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {accord.pays_signataires}
            </span>
          </div>
        )}
        {accord.date_signature && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Calendar size={13} style={{ color: "#004f91", flexShrink: 0 }} />
            Signé le {fmtDate(accord.date_signature)}
          </div>
        )}
        {accord.secteur_activite && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Building2 size={13} style={{ color: "#004f91", flexShrink: 0 }} />
            {accord.secteur_activite}
            {accord.branche_activite && ` — ${accord.branche_activite}`}
          </div>
        )}
      </div>

      {/* Tags domaines */}
      {accord.domaines_couverts && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {accord.domaines_couverts.split(",").slice(0, 3).map((d: string, i: number) => (
            <span key={i} style={{
              fontSize: 11, color: "#4a5568",
              background: "#E8E5E3", padding: "2px 8px", borderRadius: 999,
            }}>
              {d.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 12, color: "#004f91", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <FileText size={12} /> Voir les détails
        </span>
        {accord.fichier_nom && (
          <span style={{ fontSize: 11, color: "#9aa5b4", display: "flex", alignItems: "center", gap: 3 }}>
            <Download size={11} /> PDF disponible
          </span>
        )}
      </div>
    </div>
  );
}
