"use client"

import Image from "next/image"
import { ReactNode } from "react"
import { Lock } from "lucide-react"

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
        background: "#F6F5F3",
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
        .auth-input::placeholder{color:#b8b2ad}
        .auth-input:focus{outline:none;border-color:#ca631f;box-shadow:0 0 0 3px rgba(202,99,31,.15);background:#fff}
        .auth-cta{transition:transform .2s,box-shadow .2s,filter .2s}
        .auth-cta:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(202,99,31,.45);filter:brightness(1.03)}
        .auth-cta:disabled{opacity:.65;transform:none;box-shadow:0 4px 20px rgba(202,99,31,.3);cursor:not-allowed}
        .auth-mobile-logo{display:none}
        @media (max-width:920px){
          .auth-brand-panel{display:none!important}
          .auth-mobile-logo{display:flex!important}
        }
      `}</style>

      {/* ── Panneau de marque (gauche) ─────────────────────────────────────── */}
      <section
        className="auth-brand-panel"
        style={{
          position: "relative",
          flex: "1 1 64%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "52px 72px 96px",
          background: "#004f91",
          overflow: "hidden",
        }}
      >
        {/* Déco fond */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)", WebkitMaskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)" }} />
          <div style={{ position: "absolute", top: "-25%", right: "-10%", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)" }} />
          <div style={{ position: "absolute", bottom: "-30%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(26,106,176,0.5) 0%,transparent 65%)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 1, background: "linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.28) 50%,transparent 100%)" }} />
        </div>

        {/* Contenu groupé */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Identité DIPE */}
        <div className="auth-brand" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <Image
            src="/logo_apix.png"
            alt="APIX Sénégal"
            width={120}
            height={56}
            style={{
              height: 48,
              width: "auto",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              flexShrink: 0,
            }}
            priority
          />
          <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>DIPE — Direction de l&apos;Intelligence et des Perspectives Économiques</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.4 }}>Agence Nationale pour la Promotion des Investissements et des Grands Travaux</div>
          </div>
        </div>

        {/* Accroche */}
        <div
          className="auth-brand"
          style={{
            position: "relative",
            zIndex: 1,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(202,99,31,0.08)", border: "1.5px solid rgba(202,99,31,0.45)", borderRadius: 999, padding: "8px 17px", marginBottom: 28 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ca631f", animation: "authPulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Plateforme de Gestion des Investissements et des Investisseurs</span>
          </div>

          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(3rem,4.5vw,4.6rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: 0,
            }}
          >
            Intelligence<br />
            <span
              style={{
                background: "linear-gradient(135deg,#E8823C 0%,#FFC08A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Investissement
            </span>
            <br />Sénégal
          </h1>

          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.95rem", lineHeight: 1.75, margin: "22px 0 0", maxWidth: 460 }}>
            KPIs, visualisations et analyses en temps réel des tendances d&apos;investissement dans tout le territoire national
          </p>
        </div>

        {/* Badges de confiance */}
        <div className="auth-brand" style={{ display: "flex", gap: 12 }}>
          {[
            { icon: "all_inclusive", label: "Plateforme souveraine" },
            { icon: "security",      label: "Données sécurisées" },
            { icon: "show_chart",    label: "Mise à jour continue" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        </div>{/* fin contenu groupé */}

        {/* Footer */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "16px 72px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>© 2026 APIX S.A</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Plateforme à usage institutionnel</span>
        </div>
      </section>

      {/* ── Zone formulaire (droite) ───────────────────────────────────────── */}
      <section
        style={{
          flex: "1 1 46%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
        }}
      >
        <div
          className="auth-card"
          style={{
            width: "100%",
            maxWidth: 384,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Logo mobile (panneau de marque masqué) */}
          <div
            className="auth-mobile-logo"
            style={{ justifyContent: "center", marginBottom: 32 }}
          >
            <Image
              src="/logo_apix.png"
              alt="APIX"
              width={120}
              height={52}
              style={{ height: 46, width: "auto", objectFit: "contain" }}
            />
          </div>

          {/* En-tête */}
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontWeight: 800,
                fontSize: "1.9rem",
                color: "#1a1a2e",
                letterSpacing: "-0.025em",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                color: "#9aa5b4",
                fontSize: 14.5,
                marginTop: 10,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </p>
          </div>

          {/* Formulaire */}
          {children}

          {/* Lien secondaire */}
          {footer && (
            <div
              style={{
                textAlign: "center",
                fontSize: 14,
                color: "#6b7280",
                marginTop: 24,
              }}
            >
              {footer}
            </div>
          )}

          {/* Mention d'accès */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: "1px solid #EFEBE8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <Lock size={13} style={{ color: "#c5bfbb", flexShrink: 0 }} />
            <span
              style={{
                fontSize: 11.5,
                color: "#b0a9a3",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              Accès réservé aux agents de l&apos;APIX disposant d&apos;un compte
              professionnel
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

// ── Styles partagés des champs / boutons ───────────────────────────────────
export const authInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  border: "1.5px solid #E5E0DC",
  borderRadius: 12,
  fontSize: 14.5,
  color: "#1a1a2e",
  background: "#fff",
  fontFamily: "var(--font-google-sans)",
}

export const authButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  background: "#ca631f",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: "0.01em",
  boxShadow: "0 4px 20px rgba(202,99,31,.35)",
}

export const authLabelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "#4a5568",
  marginBottom: 7,
  display: "block",
}
