"use client";

import { MapPin, Phone, Mail, Globe, Building2, ChevronRight } from "lucide-react";

export default function EntrepriseCard({ entreprise, onClick }: { entreprise: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.85)",
        border: "1px solid #C5BFBB",
        borderLeft: "4px solid #ca631f",
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
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(202,99,31,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Building2 size={17} style={{ color: "#ca631f" }} />
          </div>
          <div>
            <h3 style={{
              fontFamily: "var(--font-google-sans)", fontWeight: 700,
              fontSize: 15, color: "#1a1a2e", lineHeight: 1.3,
            }}>
              {entreprise.nom}
            </h3>
            {entreprise.forme_juridique && (
              <span style={{ fontSize: 11, color: "#9aa5b4" }}>{entreprise.forme_juridique}</span>
            )}
          </div>
        </div>

      </div>

      {/* Secteur / Branche */}
      {(entreprise.secteur || entreprise.branche) && (
        <div style={{
          background: "rgba(202,99,31,0.05)", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, color: "#4a5568",
        }}>
          {entreprise.secteur?.nom}
          {entreprise.branche && <span style={{ color: "#9aa5b4" }}> › {entreprise.branche.nom}</span>}
          {entreprise.activite && <span style={{ color: "#9aa5b4" }}> › {entreprise.activite.nom}</span>}
        </div>
      )}

      {/* Localisation + contact */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {(entreprise.commune || entreprise.region) && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <MapPin size={13} style={{ color: "#ca631f", flexShrink: 0 }} />
            {[entreprise.commune, entreprise.departement, entreprise.region].filter(Boolean).join(", ")}
          </div>
        )}
        {entreprise.telephone && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Phone size={13} style={{ color: "#ca631f", flexShrink: 0 }} />
            {entreprise.telephone}
          </div>
        )}
        {entreprise.mail && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Mail size={13} style={{ color: "#ca631f", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entreprise.mail}
            </span>
          </div>
        )}
        {entreprise.siteweb && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#ca631f" }}>
            <Globe size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entreprise.siteweb.replace(/^https?:\/\//, "")}
            </span>
          </div>
        )}
      </div>

      {/* Points focaux */}
      {entreprise.points_focaux?.length > 0 && (
        <div style={{ borderTop: "1px solid #E8E5E3", paddingTop: 10, fontSize: 12, color: "#9aa5b4" }}>
          {entreprise.points_focaux.length} point{entreprise.points_focaux.length > 1 ? "s" : ""} focal{entreprise.points_focaux.length > 1 ? "aux" : ""}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#ca631f", fontWeight: 600 }}>
        Voir les détails <ChevronRight size={13} />
      </div>
    </div>
  );
}
