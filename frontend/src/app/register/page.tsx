"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react"

import { API_BASE as API_URL } from "@/lib/api"

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
    // Le modèle d'e-Voting : la page sur le fond clair, le logo dans ses
    // couleurs, une carte blanche posée par son filet, et une seule action.
    <main style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      background: "var(--fond)", fontFamily: "var(--font-google-sans)",
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        .login-field{position:relative}
        .login-field .field-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--gris-fort);pointer-events:none;transition:color .15s}
        .login-field:focus-within .field-icon{color:var(--bleu)}
        .login-input{transition:border-color .15s,box-shadow .15s}
        .login-input::placeholder{color:var(--gris)}
        .login-input:focus{outline:none;border-color:var(--bleu);box-shadow:0 0 0 3px rgb(var(--bleu-rgb) / 0.14)}
        .login-cta{transition:background-color .15s ease-out,box-shadow .15s ease-out}
        .login-cta:hover{background:var(--bleu-nuit) !important}
        .login-cta:active{background:var(--bleu-profond) !important;box-shadow:var(--ombre-bouton-enfonce) !important}
        .login-cta:focus-visible{outline:none;box-shadow:0 0 0 3px rgb(var(--bleu-rgb) / 0.28),var(--ombre-bouton) !important}
        .login-cta:disabled{opacity:.65;pointer-events:none}
        .login-error{animation:shake .35s ease}
        .login-eye{transition:background .15s,color .15s}
        .login-eye:hover{background:var(--fond-creux);color:var(--encre)}
        .login-link{text-underline-offset:3px}
        .login-link:hover{text-decoration:underline}
      `}</style>

      {/* ── Contenu centré ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>

        {/* Marque : le logo, puis la plateforme en petites capitales bleues entre deux filets */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "flex" }}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={130} height={52}
              style={{ height: 44, width: "auto", objectFit: "contain" }} priority />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
            <span style={{ width: 44, height: 1, background: "linear-gradient(90deg,transparent,rgb(var(--bleu-rgb) / 0.3))" }} />
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.16em", textTransform: "uppercase", textAlign: "center" }}>
              Plateforme de Gestion des Investissements et des Investisseurs
            </p>
            <span style={{ width: 44, height: 1, background: "linear-gradient(90deg,rgb(var(--bleu-rgb) / 0.3),transparent)" }} />
          </div>
        </div>

        {/* Carte */}
        <div style={{ width: "100%", maxWidth: 432, background: "var(--carte)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--filet-carte)", boxShadow: "var(--ombre-1)" }}>
            {pending ? (
            <div style={{ padding: "30px 34px 28px", textAlign: "center" }}>
              <span style={{ width: 46, height: 46, borderRadius: "50%", background: "rgb(var(--vert-rgb) / 0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <ShieldCheck size={22} style={{ color: "var(--vert)" }} />
              </span>
              <h1 style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--encre)", letterSpacing: "-0.02em", margin: 0 }}>Compte créé</h1>
              <p style={{ color: "var(--texte)", fontSize: 13.5, marginTop: 10, lineHeight: 1.65 }}>
                Votre compte <span style={{ fontWeight: 700, color: "var(--bleu)" }}>{email}</span>{" "}
                est en attente de validation par un administrateur. Vous pourrez vous connecter dès qu&apos;il aura été activé.
              </p>
              <Link href="/login" className="login-cta"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 20, height: 44, padding: "0 24px", borderRadius: 8, background: "var(--bleu-action)", color: "var(--sur-bleu)", fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: "var(--ombre-bouton)" }}>
                Retour à la connexion
              </Link>
            </div>
            ) : (
            <div style={{ padding: "26px 34px 24px" }}>
              <h1 style={{ fontWeight: 800, fontSize: 24, color: "var(--encre)", letterSpacing: "-0.02em", margin: 0, textAlign: "center" }}>Créer un compte</h1>
              <p style={{ color: "var(--gris-fort)", fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.55, textAlign: "center" }}>
                Réservé aux agents disposant d&apos;une adresse <span style={{ color: "var(--encre)", fontWeight: 600 }}>@apix.sn</span>
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 6 }}>Adresse email</label>
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
                      style={{ width: "100%", height: 44, padding: "0 14px 0 40px", border: "1px solid var(--bordure-forte)", borderRadius: 8, fontSize: 14, color: "var(--encre)", background: "var(--carte)", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 6 }}>Mot de passe</label>
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
                      style={{ width: "100%", height: 44, padding: "0 44px 0 40px", border: "1px solid var(--bordure-forte)", borderRadius: 8, fontSize: 14, color: "var(--encre)", background: "var(--carte)", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                    <button type="button" className="login-eye" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris-fort)" }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {password && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", margin: "-4px 2px 0" }}>
                    {regles.map(r => (
                      <span key={r.l} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: r.ok ? "var(--vert)" : "var(--gris)", transition: "color 0.15s" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.ok ? "rgb(var(--vert-rgb) / 0.12)" : "var(--fond-creux)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, lineHeight: 1, flexShrink: 0 }}>{r.ok ? "✓" : ""}</span>
                        {r.l}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 6 }}>Confirmer le mot de passe</label>
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
                      style={{ width: "100%", height: 44, padding: "0 44px 0 40px", border: "1px solid var(--bordure-forte)", borderRadius: 8, fontSize: 14, color: "var(--encre)", background: "var(--carte)", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                    <button type="button" className="login-eye" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris-fort)" }}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="login-error" style={{ background: "rgb(var(--danger-rgb) / 0.06)", border: "1px solid rgb(var(--danger-rgb) / 0.20)", color: "var(--danger)", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 8, textAlign: "center" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="login-cta"
                  style={{ width: "100%", height: 46, borderRadius: 8, border: "1px solid transparent", cursor: "pointer", background: "var(--bleu-action)", color: "var(--sur-bleu)", fontWeight: 600, fontSize: 14.5, letterSpacing: "0.01em", boxShadow: "var(--ombre-bouton)", fontFamily: "var(--font-google-sans)", marginTop: 2 }}>
                  {loading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Création…
                    </span>
                  ) : (
                    "Créer mon compte"
                  )}
                </button>
              </form>
            </div>
            )}

            {/* Pied de carte */}
            <div style={{ padding: "13px 32px", borderTop: "1px solid var(--filet)", background: "var(--carte-douce)", textAlign: "center", fontSize: 13, color: "var(--gris-fort)" }}>
              Déjà un compte ?{" "}
              <Link href="/login" className="login-link" style={{ color: "var(--bleu)", fontWeight: 700, textDecoration: "none" }}>
                Se connecter
              </Link>
            </div>
        </div>

        {/* Mention d'accès */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 20, maxWidth: 432 }}>
          <Lock size={12} style={{ color: "var(--gris-fort)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--gris-fort)", lineHeight: 1.5, textAlign: "center" }}>
            Accès réservé aux agents de l&apos;APIX disposant d&apos;un compte professionnel
          </span>
        </div>
      </div>

      {/* ── Pied de page ── */}
      <footer style={{ padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--bordure)", background: "var(--carte)" }}>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>Plateforme à usage institutionnel</span>
      </footer>
    </main>
  )
}
