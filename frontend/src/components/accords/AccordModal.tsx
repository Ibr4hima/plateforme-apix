"use client";

import { Building2, Calendar, Download, FileText, Globe, X } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  en_vigueur: { bg: "#dcfce7", text: "#15803d", label: "En vigueur" },
  expire:     { bg: "#f3f4f6", text: "#6b7280", label: "Expiré"     },
};

function fmtDate(s?: string) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ color: "#004f91" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ThematiquesBlock({ value }: { value: string }) {
  const items = value.split(",").map((t: string) => t.trim()).filter(Boolean);
  const secteurs  = items.filter(t => t.startsWith("sec:")).map(t => t.slice(4));
  const branches  = items.filter(t => t.startsWith("bra:")).map(t => t.slice(4));
  const activites = items.filter(t => t.startsWith("act:")).map(t => t.slice(4));
  const ancienFormat = items.every(t => !t.startsWith("sec:") && !t.startsWith("bra:") && !t.startsWith("act:"));

  if (ancienFormat) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((t, i) => (
          <span key={i} style={{ fontSize: 12, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(0,79,145,0.15)" }}>
            {t}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {secteurs.map((sec, i) => (
        <div key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ca631f" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ca631f" }}>{sec}</span>
          </div>
          {branches.length > 0 && (
            <div style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {branches.map((bra, j) => (
                <div key={j}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#004f91" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#004f91" }}>{bra}</span>
                  </div>
                  {activites.length > 0 && (
                    <div style={{ paddingLeft: 16, display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {activites.map((act, k) => (
                        <span key={k} style={{ fontSize: 11, color: "#059669", fontWeight: 600, background: "rgba(5,150,105,0.08)", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(5,150,105,0.2)" }}>
                          {act}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AccordModal({ accord, onClose }: { accord: any; onClose: () => void }) {
  const [fichiers, setFichiers] = useState<any[]>([]);

  useEffect(() => {
    if (!accord?.id) return;
    fetch(`${API_BASE}/accords/${accord.id}/fichiers`)
      .then(r => r.json())
      .then(setFichiers)
      .catch(() => setFichiers([]));
  }, [accord?.id]);

  if (!accord) return null;
  const statut = STATUT_CONFIG[accord.statut] || STATUT_CONFIG.en_vigueur;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)",
    }}>
      <div style={{
        position: "relative", background: "#FAFAF9",
        borderRadius: 24, width: "100%", maxWidth: 640,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid #C5BFBB",
      }}>
        <div style={{ height: 5, background: "linear-gradient(90deg, #004f91, #1a6ab0)", borderRadius: "24px 24px 0 0" }} />
        <div style={{ padding: "24px 28px 28px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "3px 12px", borderRadius: 999 }}>
                  Accord
                </span>
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
            <button onClick={onClose} style={{ background: "#E8E5E3", border: "none", cursor: "pointer", borderRadius: 10, padding: 8, marginLeft: 12, flexShrink: 0 }}>
              <X size={16} color="#4a5568" />
            </button>
          </div>

          {/* Grille infos */}
          <div style={{ background: "#F2F0EF", borderRadius: 16, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {accord.pays_signataires && (
              <InfoItem icon={<Globe size={14} />} label="Parties signataires" value={accord.pays_signataires} />
            )}
            {accord.date_signature && (
              <InfoItem icon={<Calendar size={14} />} label="Date de signature" value={fmtDate(accord.date_signature)} />
            )}
            {accord.date_entree_vigueur && (
              <InfoItem icon={<Calendar size={14} />} label="Entrée en vigueur" value={fmtDate(accord.date_entree_vigueur)} />
            )}
            {accord.date_expiration && (
              <InfoItem icon={<Calendar size={14} />} label="Date d'expiration" value={fmtDate(accord.date_expiration)} />
            )}
          </div>

          {/* Thématiques */}
          {accord.secteur_activite && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Thématiques
              </p>
              <ThematiquesBlock value={accord.secteur_activite} />
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

          {/* Documents */}
          {fichiers.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Document{fichiers.length > 1 ? "s" : ""} disponible{fichiers.length > 1 ? "s" : ""} ({fichiers.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fichiers.map((f: any) => (
                  <a
                    key={f.id}
                    href={`${API_BASE}/accords/${accord.id}/fichiers/${f.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(0,79,145,0.05)",
                      border: "1px solid rgba(0,79,145,0.15)",
                      borderRadius: 10, padding: "10px 14px",
                      textDecoration: "none", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,79,145,0.1)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                  >
                    <FileText size={16} style={{ color: "#004f91", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>
                      {f.titre || f.nom_fichier || "Document PDF"}
                    </span>
                    <Download size={14} style={{ color: "#004f91", flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
