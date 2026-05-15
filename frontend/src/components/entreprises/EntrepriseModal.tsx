"use client";

import { X, MapPin, Phone, Mail, Globe, Building2, Calendar, User, Briefcase } from "lucide-react";

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ color: "#ca631f" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function EntrepriseModal({ entreprise, onClose }: { entreprise: any; onClose: () => void }) {
  if (!entreprise) return null;

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
        background: "#FAFAF9", borderRadius: 24, width: "100%", maxWidth: 640,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid #C5BFBB",
      }}>
        <div style={{ height: 5, background: "linear-gradient(90deg, #ca631f, #e07a3a)", borderRadius: "24px 24px 0 0" }} />

        <div style={{ padding: "24px 28px 28px" }}>

          {/* Header — sans badge statut */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "rgba(202,99,31,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Building2 size={20} style={{ color: "#ca631f" }} />
              </div>
              <div>
                <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.25rem", color: "#1a1a2e", lineHeight: 1.2 }}>
                  {entreprise.nom}
                </h2>
                {entreprise.forme_juridique && (
                  <span style={{ fontSize: 12, color: "#9aa5b4" }}>{entreprise.forme_juridique}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "#E8E5E3", border: "none", cursor: "pointer",
              borderRadius: 10, padding: 8, marginLeft: 12, flexShrink: 0,
            }}>
              <X size={16} color="#4a5568" />
            </button>
          </div>

          {/* Classification NAEMA */}
          {(entreprise.secteur || entreprise.branche || entreprise.activite) && (
            <div style={{ background: "rgba(202,99,31,0.05)", border: "1px solid rgba(202,99,31,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#ca631f", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Classification NAEMA
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {entreprise.secteur && (
                  <span style={{ fontSize: 12, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "4px 12px", borderRadius: 999 }}>
                    {entreprise.secteur.nom}
                  </span>
                )}
                {entreprise.branche && (
                  <span style={{ fontSize: 12, color: "#4a5568", background: "#E8E5E3", padding: "4px 12px", borderRadius: 999 }}>
                    {entreprise.branche.nom}
                  </span>
                )}
                {entreprise.activite && (
                  <span style={{ fontSize: 12, color: "#4a5568", background: "#E8E5E3", padding: "4px 12px", borderRadius: 999 }}>
                    {entreprise.activite.nom}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Grille infos */}
          <div style={{
            background: "#F2F0EF", borderRadius: 16, padding: "16px 20px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20,
          }}>
            {entreprise.siege_pays && (
              <InfoItem icon={<Globe size={14} />} label="Siège social" value={entreprise.siege_pays} />
            )}
            {entreprise.region && (
              <InfoItem icon={<MapPin size={14} />} label="Région" value={entreprise.region} />
            )}
            {entreprise.departement && (
              <InfoItem icon={<MapPin size={14} />} label="Département" value={entreprise.departement} />
            )}
            {(entreprise.arrondissement || entreprise.commune) && (
              <InfoItem icon={<MapPin size={14} />} label="Arrondissement" value={entreprise.arrondissement || entreprise.commune} />
            )}
            {entreprise.telephone && (
              <InfoItem icon={<Phone size={14} />} label="Téléphone" value={entreprise.telephone} />
            )}
            {entreprise.mail && (
              <InfoItem icon={<Mail size={14} />} label="Email" value={entreprise.mail} />
            )}
            {entreprise.date_creation && (
              <InfoItem icon={<Calendar size={14} />} label="Date de création" value={fmtDate(entreprise.date_creation)} />
            )}
          </div>

          {/* Adresse */}
          {entreprise.adresse && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Adresse</p>
              <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>{entreprise.adresse}</p>
            </div>
          )}

          {/* Site web */}
          {entreprise.siteweb && (
            <div style={{ marginBottom: 20 }}>
              <a href={entreprise.siteweb} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: "#ca631f", fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}>
                <Globe size={14} /> {entreprise.siteweb.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}

          {/* Points focaux */}
          {entreprise.points_focaux?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Points focaux</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {entreprise.points_focaux.map((pf: any) => (
                  <div key={pf.id} style={{
                    background: "#fff", border: "1px solid #C5BFBB",
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(202,99,31,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <User size={16} style={{ color: "#ca631f" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{pf.prenom} {pf.nom}</span>
                        {pf.est_principal && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "2px 8px", borderRadius: 999 }}>Principal</span>
                        )}
                      </div>
                      {pf.poste && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9aa5b4", marginBottom: 4 }}>
                          <Briefcase size={11} /> {pf.poste}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {pf.telephone && (
                          <span style={{ fontSize: 12, color: "#4a5568", display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={11} style={{ color: "#ca631f" }} /> {pf.telephone}
                          </span>
                        )}
                        {pf.mail && (
                          <span style={{ fontSize: 12, color: "#4a5568", display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={11} style={{ color: "#ca631f" }} /> {pf.mail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
