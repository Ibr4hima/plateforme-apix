"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"

// ── Page de connexion — carte centrale sur scène bleue APIX ───────────────────
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError("Email ou mot de passe incorrect.")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#004f91", position: "relative", overflow: "hidden", fontFamily: "var(--font-google-sans)" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(14px) scale(0.985)}to{opacity:1;transform:none}}
        @keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .login-card{animation:cardIn 0.45s ease both}
        .login-tag{animation:riseIn 0.4s ease both}
        .login-chips{animation:riseIn 0.5s 0.15s ease both}
        .login-input{transition:border-color .15s,box-shadow .15s,background .15s}
        .login-input::placeholder{color:#b8b2ad}
        .login-input:focus{outline:none;border-color:rgba(0,79,145,0.45);box-shadow:0 0 0 3px rgba(0,79,145,0.10);background:#fff}
        .login-cta{transition:transform .18s,box-shadow .18s,filter .18s}
        .login-cta:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(202,99,31,.45)}
        .login-cta:disabled{opacity:.65;transform:none;cursor:not-allowed}
      `}</style>

      {/* ── Décor de scène ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0.9) 0%,transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0.9) 0%,transparent 75%)" }} />
        <div style={{ position: "absolute", top: "-35%", right: "-12%", width: 780, height: 780, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: "-40%", left: "-14%", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgba(26,106,176,0.55) 0%,transparent 65%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "8%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(202,99,31,0.10) 0%,transparent 65%)", filter: "blur(14px)" }} />
      </div>

      {/* ── Identité en tête ── */}
      <header style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, padding: "26px 44px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Image src="/logo_apix.png" alt="APIX Sénégal" width={110} height={44}
            style={{ height: 36, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} priority />
        </Link>
        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.22)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>DIPE — Direction de l&apos;Intelligence et des Perspectives Économiques</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Agence Nationale pour la Promotion des Investissements et des Grands Travaux</div>
        </div>
      </header>

      {/* ── Carte centrale ── */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px 40px" }}>

        {/* Pilule plateforme */}
        <div className="login-tag" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "7px 16px", marginBottom: 22 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Plateforme de Gestion des Investissements et des Investisseurs</span>
        </div>

        {/* Carte */}
        <div className="login-card" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,20,45,0.45)", display: "flex", flexDirection: "column" }}>
          {/* Liseré accent */}
          <div style={{ height: 4, background: "linear-gradient(90deg,#9c4a15 0%,#ca631f 55%,#e07a2e 100%)", flexShrink: 0 }} />

          <div style={{ padding: "32px 36px 28px" }}>
            <h1 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#1a1a2e", letterSpacing: "-0.02em", margin: 0 }}>Connexion</h1>
            <p style={{ color: "#9aa5b4", fontSize: 13.5, marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
              Accédez à votre espace avec votre compte <span style={{ color: "#4a5568", fontWeight: 600 }}>@apix.sn</span>
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 26 }}>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 7 }}>Adresse email</label>
                <input
                  className="login-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="prenom.nom@apix.sn"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "13px 15px", border: "1.5px solid #E8E5E3", borderRadius: 12, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 7 }}>Mot de passe</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="login-input"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ width: "100%", padding: "13px 44px 13px 15px", border: "1.5px solid #E8E5E3", borderRadius: 12, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4", transition: "background 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", color: "#dc2626", fontSize: 13, fontWeight: 500, padding: "10px 14px", borderRadius: 10, textAlign: "center" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-cta"
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", background: "#ca631f", color: "#fff", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.01em", boxShadow: "0 4px 18px rgba(202,99,31,0.35)", fontFamily: "var(--font-google-sans)", marginTop: 4 }}>
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Connexion…
                  </span>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>

            <div style={{ textAlign: "center", fontSize: 13.5, color: "#6b7280", marginTop: 22 }}>
              Pas encore de compte ?{" "}
              <Link href="/register" style={{ color: "#ca631f", fontWeight: 700, textDecoration: "none" }}>
                Créer un compte
              </Link>
            </div>
          </div>

          {/* Pied de carte */}
          <div style={{ padding: "13px 36px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Lock size={12} style={{ color: "#C5BFBB", flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: "#9aa5b4", lineHeight: 1.5, textAlign: "center" }}>
              Accès réservé aux agents de l&apos;APIX disposant d&apos;un compte professionnel
            </span>
          </div>
        </div>

        {/* Badges de confiance */}
        <div className="login-chips" style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: "all_inclusive", label: "Plateforme souveraine" },
            { icon: "security",      label: "Données sécurisées" },
            { icon: "show_chart",    label: "Mise à jour continue" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, whiteSpace: "nowrap" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pied de page ── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.10)", padding: "15px 44px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Plateforme à usage institutionnel</span>
      </footer>
    </main>
  )
}
