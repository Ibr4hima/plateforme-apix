"use client";

import { Building2, Calendar, Download, ExternalLink, FileText, Globe, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  en_vigueur:        { bg: "#dcfce7", text: "#15803d", label: "En vigueur"        },
  signe_non_ratifie: { bg: "#dbeafe", text: "#1d4ed8", label: "Signé non ratifié" },
  expire:            { bg: "#f3f4f6", text: "#6b7280", label: "Expiré"            },
  suspendu:          { bg: "#fee2e2", text: "#dc2626", label: "Suspendu"          },
  negocie:           { bg: "#fef9c3", text: "#a16207", label: "En négociation"    },
};

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ color: "#004f91" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function AccordModal({ accord, onClose }: { accord: any; onClose: () => void }) {
  if (!accord) return null;
  const statut = STATUT_CONFIG[accord.statut] || STATUT_CONFIG.en_vigueur;
  const fichierUrl = API_BASE + "/accords/" + accord.id + "/fichier";

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)",
      }}
    >
      <div style={{
        position: "relative", background: "#FAFAF9",
        borderRadius: 24, width: "100%", maxWidth: 640,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        border: "1px solid #C5BFBB",
      }}>
        <div style={{ height: 5, background: "linear-gradient(90deg, #004f91, #1a6ab0)", borderRadius: "24px 24px 0 0" }} />

        <div style={{ padding: "24px 28px 28px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {accord.type_accord && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "3px 12px", borderRadius: 999 }}>
                    {accord.type_accord}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, background: statut.bg, color: statut.text, padding: "3px 12px", borderRadius: 999 }}>
                  {statut.label}
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.25rem", color: "#1a1a2e", lineHeight: 1.3 }}>
                {accord.titre}
              </h2>
              {accord.reference && (
                <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>Réf. {accord.reference}</p>
              )}
            </div>
            <button onClick={onClose} style={{
              background: "#E8E5E3", border: "none", cursor: "pointer",
              borderRadius: 10, padding: 8, marginLeft: 12, flexShrink: 0,
            }}>
              <X size={16} color="#4a5568" />
            </button>
          </div>

          {/* Grille infos */}
          <div style={{
            background: "#F2F0EF", borderRadius: 16, padding: "16px 20px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20,
          }}>
            {accord.pays_signataires && (
              <InfoItem icon={<Globe size={14} />} label="Pays signataires" value={accord.pays_signataires} />
            )}
            {accord.organisation_partenaire && (
              <InfoItem icon={<Building2 size={14} />} label="Organisation" value={accord.organisation_partenaire} />
            )}
            {accord.date_signature && (
              <InfoItem icon={<Calendar size={14} />} label="Date de signature" value={fmtDate(accord.date_signature)} />
            )}
            {accord.date_ratification && (
              <InfoItem icon={<Calendar size={14} />} label="Date de ratification" value={fmtDate(accord.date_ratification)} />
            )}
            {accord.date_entree_vigueur && (
              <InfoItem icon={<Calendar size={14} />} label="Entrée en vigueur" value={fmtDate(accord.date_entree_vigueur)} />
            )}
            {accord.date_expiration && (
              <InfoItem icon={<Calendar size={14} />} label="Date d'expiration" value={fmtDate(accord.date_expiration)} />
            )}
            {accord.secteur_activite && (
              <InfoItem icon={<FileText size={14} />} label="Secteur" value={accord.secteur_activite} />
            )}
            {accord.branche_activite && (
              <InfoItem icon={<FileText size={14} />} label="Branche" value={accord.branche_activite} />
            )}
          </div>

          {/* Domaines */}
          {accord.domaines_couverts && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Domaines couverts
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {accord.domaines_couverts.split(",").map((d: string, i: number) => (
                  <span key={i} style={{
                    fontSize: 12, color: "#004f91", background: "rgba(0,79,145,0.08)",
                    padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(0,79,145,0.15)",
                  }}>
                    {d.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Commentaires */}
          {accord.commentaires && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Résumé / Commentaires
              </p>
              <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7 }}>{accord.commentaires}</p>
            </div>
          )}

          {/* Avantages */}
          {accord.avantages_principaux && (
            <div style={{ background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Avantages principaux
              </p>
              <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.7 }}>{accord.avantages_principaux}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {accord.fichier_nom && (
              <a
                href={fichierUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "linear-gradient(135deg, #004f91, #003a6e)",
                  color: "#fff", fontWeight: 600, fontSize: 13,
                  padding: "10px 20px", borderRadius: 12, textDecoration: "none",
                }}
              >
                <Download size={14} /> Télécharger le PDF
              </a>
            )}
            {accord.lien_texte_officiel && (
              <a
                href={accord.lien_texte_officiel}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,0.9)", color: "#1a1a2e",
                  fontWeight: 600, fontSize: 13, padding: "10px 20px",
                  borderRadius: 12, textDecoration: "none", border: "1px solid #C5BFBB",
                }}
              >
                <ExternalLink size={14} /> Texte officiel
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
