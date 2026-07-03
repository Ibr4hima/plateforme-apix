"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

// ── Création de compte — même scène que la connexion ──────────────────────────
export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim().toLowerCase().endsWith("@apix.sn")) {
      setError("Seules les adresses @apix.sn sont autorisées.")
      return
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.detail || "Erreur lors de la création du compte.")
      setLoading(false)
      return
    }

    const login = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (login?.error) {
      router.push("/login")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <main style={{
      height: "100vh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(130% 100% at 50% -30%, #001f3d 0%, #00325c 28%, #004f91 52%, rgba(0,79,145,0) 70%), #F6F5F3",
      position: "relative", fontFamily: "var(--font-google-sans)",
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(0.99)}to{opacity:1;transform:none}}
        @keyframes drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(26px,14px,0)}}
        @keyframes driftInv{from{transform:translate3d(0,0,0)}to{transform:translate3d(-22px,-12px,0)}}
        @keyframes riseIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .login-brand{animation:riseIn 0.4s ease both}
        .login-card{animation:cardIn 0.45s 0.08s ease both}
        .login-after{animation:riseIn 0.5s 0.2s ease both}
        .login-input{transition:border-color .15s,box-shadow .15s,background .15s}
        .login-input::placeholder{color:#b8b2ad}
        .login-input:focus{outline:none;border-color:rgba(0,79,145,0.45);box-shadow:0 0 0 3px rgba(0,79,145,0.10);background:#fff}
        .login-cta{transition:transform .18s,box-shadow .18s}
        .login-cta:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,79,145,.45)}
        .login-cta:disabled{opacity:.65;transform:none;cursor:not-allowed}
        .login-cta .cta-arrow{transition:transform .18s;opacity:.85}
        .login-cta:hover .cta-arrow{transform:translateX(4px)}
      `}</style>

      {/* Trame fine + halos dérivants, contenus dans la zone bleue */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", maskImage: "linear-gradient(180deg,rgba(0,0,0,1) 0%,rgba(0,0,0,1) 42%,transparent 60%)", WebkitMaskImage: "linear-gradient(180deg,rgba(0,0,0,1) 0%,rgba(0,0,0,1) 42%,transparent 60%)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(100% 55% at 50% -8%,rgba(0,0,0,0.9) 0%,transparent 78%)", WebkitMaskImage: "radial-gradient(100% 55% at 50% -8%,rgba(0,0,0,0.9) 0%,transparent 78%)" }} />
        <div style={{ position: "absolute", top: "-24%", left: "6%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)", animation: "drift 11s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "-16%", right: "2%", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgba(26,106,176,0.45) 0%,transparent 62%)", animation: "driftInv 13s ease-in-out infinite alternate" }} />
      </div>

      {/* ── Contenu centré ── */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>

        {/* Marque */}
        <div className="login-brand" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <Link href="/" style={{ display: "flex" }}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={130} height={52}
              style={{ height: 40, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} priority />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 13 }}>
            <span style={{ width: 44, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.4))" }} />
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.16em", textTransform: "uppercase", textAlign: "center" }}>
              Plateforme de Gestion des Investissements et des Investisseurs
            </p>
            <span style={{ width: 44, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.4),transparent)" }} />
          </div>
        </div>

        {/* Carte */}
        <div className="login-card" style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,79,145,0.10)", boxShadow: "0 24px 64px rgba(0,25,50,0.30), 0 2px 8px rgba(0,25,50,0.10)" }}>
          <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
          <div style={{ padding: "26px 32px 24px" }}>
            <h1 style={{ fontWeight: 800, fontSize: "1.45rem", color: "#1a1a2e", letterSpacing: "-0.02em", margin: 0 }}>Créer un compte</h1>
            <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.55 }}>
              Réservé aux agents disposant d&apos;une adresse <span style={{ color: "#4a5568", fontWeight: 600 }}>@apix.sn</span>
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Adresse email</label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
                  <input
                    className="login-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Entrez votre adresse email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ width: "100%", padding: "11px 14px 11px 40px", border: "1.5px solid #E8E5E3", borderRadius: 11, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Mot de passe</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
                  <input
                    className="login-input"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ width: "100%", padding: "11px 42px 11px 40px", border: "1.5px solid #E8E5E3", borderRadius: 11, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4", transition: "background 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Confirmer le mot de passe</label>
                <div style={{ position: "relative" }}>
                  <ShieldCheck size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
                  <input
                    className="login-input"
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    style={{ width: "100%", padding: "11px 42px 11px 40px", border: "1.5px solid #E8E5E3", borderRadius: 11, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4", transition: "background 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", color: "#dc2626", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 10, textAlign: "center" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-cta"
                style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: "none", cursor: "pointer", background: "#004f91", color: "#fff", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.01em", boxShadow: "0 4px 18px rgba(0,79,145,0.35)", fontFamily: "var(--font-google-sans)", marginTop: 2 }}>
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Création…
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    Créer mon compte <ArrowRight size={15} className="cta-arrow" />
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Pied de carte */}
          <div style={{ padding: "12px 32px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", textAlign: "center", fontSize: 13, color: "#6b7280" }}>
            Déjà un compte ?{" "}
            <Link href="/login" style={{ color: "#004f91", fontWeight: 700, textDecoration: "none" }}>
              Se connecter
            </Link>
          </div>
        </div>

        {/* Mention d'accès */}
        <div className="login-after" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18, maxWidth: 400 }}>
          <Lock size={12} style={{ color: "#9aa5b4", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "#9aa5b4", lineHeight: 1.5, textAlign: "center" }}>
            Accès réservé aux agents de l&apos;APIX disposant d&apos;un compte professionnel
          </span>
        </div>
      </div>

      {/* ── Pied de page ── */}
      <footer style={{ position: "relative", zIndex: 1, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid #ECEAE7", background: "#fff" }}>
        <span style={{ fontSize: 11.5, color: "#9aa5b4" }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</span>
        <span style={{ fontSize: 11.5, color: "#9aa5b4" }}>Plateforme à usage institutionnel</span>
      </footer>
    </main>
  )
}
