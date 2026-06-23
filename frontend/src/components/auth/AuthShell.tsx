"use client"

import Image from "next/image"
import { ReactNode } from "react"

/**
 * Coquille visuelle des pages d'authentification (login / register).
 * Reprend l'identité de la page d'accueil : gradient bleu profond, halos,
 * grille subtile, accent orange, glassmorphism.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "var(--font-google-sans)",
        background: "#FAFAF9",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes authFadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes authPulse{0%,100%{opacity:.4}50%{opacity:.85}}
        .auth-brand{animation:authFadeUp .7s ease both}
        .auth-card{animation:authFadeUp .7s .15s ease both}
        .auth-input{transition:border-color .15s,box-shadow .15s,background .15s}
        .auth-input:focus{outline:none;border-color:#ca631f;box-shadow:0 0 0 3px rgba(202,99,31,.15);background:#fff}
        .auth-cta{transition:transform .2s,box-shadow .2s}
        .auth-cta:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(202,99,31,.45)}
        .auth-cta:disabled{opacity:.6;transform:none;box-shadow:0 4px 20px rgba(202,99,31,.3);cursor:not-allowed}
        @media (max-width:920px){.auth-brand-panel{display:none!important}}
      `}</style>

      {/* ── Panneau de marque (gauche) ─────────────────────────────────────── */}
      <section
        className="auth-brand-panel"
        style={{
          position: "relative",
          flex: "1 1 56%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
          overflow: "hidden",
        }}
      >
        {/* Déco fond */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              top: "-18%",
              right: "-8%",
              width: 520,
              height: 520,
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(255,255,255,0.06) 0%,transparent 65%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-22%",
              left: "-10%",
              width: 460,
              height: 460,
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(202,99,31,0.12) 0%,transparent 65%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.035,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="auth-brand" style={{ position: "relative", zIndex: 1 }}>
          <Image
            src="/logo_apix.png"
            alt="APIX Sénégal"
            width={120}
            height={52}
            style={{ height: 46, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            priority
          />
        </div>

        {/* Accroche */}
        <div className="auth-brand" style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(202,99,31,0.1)",
              border: "1px solid rgba(202,99,31,0.25)",
              borderRadius: 999,
              padding: "6px 14px",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ca631f",
                animation: "authPulse 2s infinite",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#D96D3B",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              Plateforme de Gestion des Investissements
            </span>
          </div>

          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(2.4rem,3.6vw,3.6rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: "#fff",
              margin: 0,
              maxWidth: 520,
            }}
          >
            Intelligence{" "}
            <span
              style={{
                background: "linear-gradient(135deg,#ca631f,#FFB0A1)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Investissement
            </span>{" "}
            Sénégal
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "1.05rem",
              maxWidth: 440,
              lineHeight: 1.75,
              marginTop: 22,
            }}
          >
            Plateforme de suivi, d'analyse et de gestion des investissements au
            Sénégal.
          </p>
        </div>

        {/* Badges de confiance */}
        <div
          className="auth-brand"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            { icon: "all_inclusive", label: "Plateforme souveraine" },
            { icon: "security", label: "Données sécurisées" },
            { icon: "show_chart", label: "Mise à jour continue" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                backdropFilter: "blur(12px)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 15,
                  color: "#ca631f",
                  fontVariationSettings:
                    "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                  lineHeight: 1,
                }}
              >
                {item.icon}
              </span>
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Zone formulaire (droite) ───────────────────────────────────────── */}
      <section
        style={{
          flex: "1 1 44%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
        }}
      >
        <div
          className="auth-card"
          style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 28 }}
        >
          {/* Logo (mobile uniquement, panneau de marque caché) */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <Image
              src="/logo_apix.png"
              alt="APIX"
              width={100}
              height={44}
              style={{ height: 40, width: "auto", objectFit: "contain" }}
            />
          </div>

          <div>
            <h2
              style={{
                fontWeight: 800,
                fontSize: "1.75rem",
                color: "#1a1a2e",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p style={{ color: "#9aa5b4", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              {subtitle}
            </p>
          </div>

          {children}

          {footer && (
            <div style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>
              {footer}
            </div>
          )}

          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#c5bfbb",
              lineHeight: 1.6,
              marginTop: 4,
            }}
          >
            Accès réservé aux agents APIX disposant d&apos;un compte @apix.sn
          </p>
        </div>
      </section>
    </main>
  )
}

// ── Styles partagés des champs / boutons ───────────────────────────────────
export const authInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  border: "1px solid #E2DDD9",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a1a2e",
  background: "#F6F4F2",
  fontFamily: "var(--font-google-sans)",
}

export const authButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(135deg,#ca631f,#e07b35)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: "0.01em",
  boxShadow: "0 4px 20px rgba(202,99,31,.35)",
}

export const authLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#4a5568",
  marginBottom: 6,
  display: "block",
}
