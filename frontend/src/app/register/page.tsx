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
  const [pending, setPending] = useState(false)

  // Règles de robustesse, reflétées en direct (le backend revalide et vérifie
  // aussi les mots de passe compromis via Have I Been Pwned)
  const localEmail = email.split("@")[0]?.toLowerCase() || ""
  const regles = [
    { l: "12 caractères minimum",  ok: password.length >= 12 },
    { l: "Une majuscule",          ok: /[A-Z]/.test(password) },
    { l: "Une minuscule",          ok: /[a-z]/.test(password) },
    { l: "Un chiffre",             ok: /\d/.test(password) },
    { l: "Un caractère spécial",   ok: /[^A-Za-z0-9]/.test(password) },
    { l: "Différent de votre email", ok: (() => {
        if (!localEmail) return true
        const pw = password.toLowerCase()
        if (localEmail.length < 3) return true
        if (localEmail.length < 4) return !pw.includes(localEmail)
        for (let i = 0; i <= localEmail.length - 4; i++) if (pw.includes(localEmail.slice(i, i + 4))) return false
        return true
      })() },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim().toLowerCase().endsWith("@apix.sn")) {
      setError("Seules les adresses @apix.sn sont autorisées.")
      return
    }
    if (regles.some(r => !r.ok)) {
      setError("Le mot de passe ne respecte pas encore toutes les règles.")
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

    const data = await res.json().catch(() => ({}))
    if (data.pending) {
      // Compte créé mais inactif : un administrateur doit le valider
      setPending(true)
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
      background: "radial-gradient(125% 95% at 50% -25%, #001a33 0%, #002b52 26%, #003c70 44%, #004f91 58%, rgba(0,79,145,0) 72%), radial-gradient(80% 55% at 50% 108%, rgba(202,99,31,0.16) 0%, rgba(202,99,31,0.07) 45%, transparent 72%), #F6F5F3",
      position: "relative", fontFamily: "var(--font-google-sans)",
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(14px) scale(0.985)}to{opacity:1;transform:none}}
        @keyframes drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(26px,14px,0)}}
        @keyframes driftInv{from{transform:translate3d(0,0,0)}to{transform:translate3d(-22px,-12px,0)}}
        @keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        .login-brand{animation:riseIn 0.45s ease both}
        .login-card{animation:cardIn 0.5s 0.08s ease both}
        .login-after{animation:riseIn 0.55s 0.22s ease both}
        .login-field{position:relative}
        .login-field .field-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:#9aa5b4;pointer-events:none;transition:color .18s}
        .login-field:focus-within .field-icon{color:#004f91}
        .login-input{transition:border-color .18s,box-shadow .18s,background .18s}
        .login-input::placeholder{color:#b8b2ad}
        .login-input:focus{outline:none;border-color:rgba(0,79,145,0.45);box-shadow:0 0 0 3.5px rgba(0,79,145,0.10);background:#fff}
        .login-cta{transition:transform .18s,box-shadow .18s}
        .login-cta:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,79,145,.45)}
        .login-cta:active{transform:translateY(0) scale(0.995)}
        .login-cta:disabled{opacity:.65;transform:none;cursor:not-allowed}
        .login-cta .cta-arrow{transition:transform .18s;opacity:.85}
        .login-cta:hover .cta-arrow{transform:translateX(4px)}
        .login-error{animation:shake .35s ease}
        .login-eye{transition:background .15s,color .15s}
        .login-eye:hover{background:#ECEAE8;color:#4a5568}
        .login-link{position:relative}
        .login-link::after{content:"";position:absolute;left:0;bottom:-1px;width:0;height:1.5px;background:#004f91;transition:width .2s}
        .login-link:hover::after{width:100%}
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
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.72)", letterSpacing: "0.16em", textTransform: "uppercase", textAlign: "center" }}>
              Plateforme de Gestion des Investissements et des Investisseurs
            </p>
            <span style={{ width: 44, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.4),transparent)" }} />
          </div>
        </div>

        {/* Halo doux derrière la carte : la détache du dôme */}
        <div style={{ position: "relative", width: "100%", maxWidth: 408, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", width: 540, height: 280, borderRadius: "50%", background: "radial-gradient(closest-side,rgba(255,255,255,0.13),transparent)", pointerEvents: "none" }} />

          {/* Carte */}
          <div className="login-card" style={{ width: "100%", maxWidth: 408, background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(0,79,145,0.10)", boxShadow: "0 30px 70px rgba(0,20,45,0.35), 0 4px 14px rgba(0,20,45,0.12)", position: "relative" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg,#003a6e 0%,#004f91 55%,#1a6ab0 100%)", flexShrink: 0 }} />
            {pending ? (
            <div style={{ padding: "30px 34px 28px", textAlign: "center" }}>
              <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(24,128,56,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <ShieldCheck size={22} style={{ color: "#188038" }} />
              </span>
              <h1 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#1a1a2e", letterSpacing: "-0.02em", margin: 0 }}>Compte créé</h1>
              <p style={{ color: "#4a5568", fontSize: 13.5, marginTop: 10, lineHeight: 1.65 }}>
                Votre compte <span style={{ fontWeight: 700, color: "#004f91" }}>{email}</span>{" "}
                est en attente de validation par un administrateur. Vous pourrez vous connecter dès qu&apos;il aura été activé.
              </p>
              <Link href="/login" className="login-cta"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 20, height: 44, padding: "0 26px", borderRadius: 12, background: "#004f91", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 18px rgba(0,79,145,0.35)" }}>
                Retour à la connexion <ArrowRight size={15} className="cta-arrow" />
              </Link>
            </div>
            ) : (
            <div style={{ padding: "26px 34px 24px" }}>
              <h1 style={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a1a2e", letterSpacing: "-0.02em", margin: 0 }}>Créer un compte</h1>
              <p style={{ color: "#9aa5b4", fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.55 }}>
                Réservé aux agents disposant d&apos;une adresse <span style={{ color: "#4a5568", fontWeight: 600 }}>@apix.sn</span>
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Adresse email</label>
                  <div className="login-field">
                    <Mail size={15} className="field-icon" />
                    <input
                      className="login-input"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="Entrez votre adresse email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{ width: "100%", height: 43, padding: "0 14px 0 42px", border: "1.5px solid #E8E5E3", borderRadius: 12, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Mot de passe</label>
                  <div className="login-field">
                    <Lock size={15} className="field-icon" />
                    <input
                      className="login-input"
                      type={showPwd ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="12 caractères minimum"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ width: "100%", height: 43, padding: "0 44px 0 42px", border: "1.5px solid #E8E5E3", borderRadius: 12, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                    <button type="button" className="login-eye" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4" }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {password && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", margin: "-4px 2px 0" }}>
                    {regles.map(r => (
                      <span key={r.l} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: r.ok ? "#188038" : "#9aa5b4", transition: "color 0.15s" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.ok ? "rgba(24,128,56,0.12)" : "#F0EEEC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, lineHeight: 1, flexShrink: 0 }}>{r.ok ? "✓" : ""}</span>
                        {r.l}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 6 }}>Confirmer le mot de passe</label>
                  <div className="login-field">
                    <ShieldCheck size={15} className="field-icon" />
                    <input
                      className="login-input"
                      type={showConfirm ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      style={{ width: "100%", height: 43, padding: "0 44px 0 42px", border: "1.5px solid #E8E5E3", borderRadius: 12, fontSize: 14, color: "#1a1a2e", background: "#F8F7F6", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                    <button type="button" className="login-eye" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4" }}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="login-error" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", color: "#dc2626", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 10, textAlign: "center" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="login-cta"
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "none", cursor: "pointer", background: "#004f91", color: "#fff", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.01em", boxShadow: "0 4px 18px rgba(0,79,145,0.35)", fontFamily: "var(--font-google-sans)", marginTop: 2 }}>
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
            )}

            {/* Pied de carte */}
            <div style={{ padding: "12px 34px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", textAlign: "center", fontSize: 13, color: "#6b7280" }}>
              Déjà un compte ?{" "}
              <Link href="/login" className="login-link" style={{ color: "#004f91", fontWeight: 700, textDecoration: "none" }}>
                Se connecter
              </Link>
            </div>
          </div>
        </div>

        {/* Mention d'accès */}
        <div className="login-after" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18, maxWidth: 408 }}>
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
