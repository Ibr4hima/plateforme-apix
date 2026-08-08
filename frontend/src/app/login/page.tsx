"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import BasculeApparence from "@/components/layout/BasculeApparence";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

// ── Page de connexion — carte unique centrée, plein écran sans défilement ─────
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
    // Vérification directe sur l'API : récupère le message précis du backend
    // (tentatives restantes, verrouillage temporaire…), que NextAuth masque.
    const check = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null)
    if (!check || !check.ok) {
      const data = check ? await check.json().catch(() => ({})) : {}
      setError(data.detail || "Connexion impossible. Vérifiez votre réseau et réessayez.")
      setLoading(false)
      return
    }
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
    <main style={{
      height: "100vh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(125% 95% at 50% -25%, var(--bleu-profond) 0%, var(--bleu-profond) 26%, var(--bleu-profond) 44%, var(--bleu-action) 58%, rgb(var(--bleu-rgb) / 0) 72%), radial-gradient(80% 55% at 50% 108%, rgb(var(--orange-rgb) / 0.16) 0%, rgb(var(--orange-rgb) / 0.07) 45%, transparent 72%), var(--champ)",
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
        .login-field .field-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:var(--gris);pointer-events:none;transition:color .18s}
        .login-field:focus-within .field-icon{color:var(--bleu)}
        .login-input{transition:border-color .18s,box-shadow .18s,background .18s}
        .login-input::placeholder{color:var(--gris)}
        .login-input:focus{outline:none;border-color:rgb(var(--bleu-rgb) / 0.45);box-shadow:0 0 0 3.5px rgb(var(--ombre-rgb) / 0.10);background:var(--carte)}
        .login-cta{transition:transform .18s,box-shadow .18s}
        .login-cta:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgb(var(--ombre-rgb) / .45)}
        .login-cta:active{transform:translateY(0) scale(0.995)}
        .login-cta:disabled{opacity:.65;transform:none;cursor:not-allowed}
        .login-cta .cta-arrow{transition:transform .18s;opacity:.85}
        .login-cta:hover .cta-arrow{transform:translateX(4px)}
        .login-error{animation:shake .35s ease}
        .login-eye{transition:background .15s,color .15s}
        .login-eye:hover{background:var(--fond-creux2);color:var(--texte)}
        .login-link{position:relative}
        .login-link::after{content:"";position:absolute;left:0;bottom:-1px;width:0;height:1.5px;background:var(--bleu-action);transition:width .2s}
        .login-link:hover::after{width:100%}
      `}</style>

      {/* Ces pages n'ont pas de barre de navigation : sans cette commande, on
          ne pourrait pas changer d'apparence avant de s'être connecté. Le fond
          y est bleu nuit dans les deux schémas, d'où l'icône blanche. */}
      <BasculeApparence
        couleur="rgba(255,255,255,0.85)"
        style={{
          position: "absolute", top: 20, right: 20, zIndex: 3,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.22)",
        }} />

      {/* Trame fine + halos dérivants, contenus dans la zone bleue */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", maskImage: "linear-gradient(180deg,rgb(var(--ombre-rgb) / 1) 0%,rgba(0,0,0,1) 42%,transparent 60%)", WebkitMaskImage: "linear-gradient(180deg,rgba(0,0,0,1) 0%,rgba(0,0,0,1) 42%,transparent 60%)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(100% 55% at 50% -8%,rgb(var(--ombre-rgb) / 0.9) 0%,transparent 78%)", WebkitMaskImage: "radial-gradient(100% 55% at 50% -8%,rgba(0,0,0,0.9) 0%,transparent 78%)" }} />
        <div style={{ position: "absolute", top: "-24%", left: "6%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)", animation: "drift 11s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "-16%", right: "2%", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgb(var(--bleu-rgb) / 0.45) 0%,transparent 62%)", animation: "driftInv 13s ease-in-out infinite alternate" }} />
      </div>

      {/* ── Contenu centré ── */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>

        {/* Marque */}
        <div className="login-brand" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <Link href="/" style={{ display: "flex" }}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={130} height={52}
              style={{ height: 44, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} priority />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
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
          <div className="login-card" style={{ width: "100%", maxWidth: 408, background: "var(--carte)", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--bleu-rgb) / 0.10)", boxShadow: "0 30px 70px rgb(var(--ombre-rgb) / 0.35), 0 4px 14px rgb(var(--ombre-rgb) / 0.12)", position: "relative" }}>
            <div style={{ height: 4, background: "linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu-action) 55%,var(--bleu-clair) 100%)", flexShrink: 0 }} />
            <div style={{ padding: "30px 34px 26px" }}>
              <h1 style={{ fontWeight: 800, fontSize: "1.5rem", color: "var(--encre)", letterSpacing: "-0.02em", margin: 0 }}>Connexion</h1>
              <p style={{ color: "var(--gris)", fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.55 }}>
                Accédez à votre espace avec votre compte <span style={{ color: "var(--texte)", fontWeight: 600 }}>@apix.sn</span>
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 7 }}>Adresse email</label>
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
                      style={{ width: "100%", height: 45, padding: "0 14px 0 42px", border: "1.5px solid var(--bordure-forte)", borderRadius: 12, fontSize: 14, color: "var(--encre)", background: "var(--carte-douce)", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase", marginBottom: 7 }}>Mot de passe</label>
                  <div className="login-field">
                    <Lock size={15} className="field-icon" />
                    <input
                      className="login-input"
                      type={showPwd ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ width: "100%", height: 45, padding: "0 44px 0 42px", border: "1.5px solid var(--bordure-forte)", borderRadius: 12, fontSize: 14, color: "var(--encre)", background: "var(--carte-douce)", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }}
                    />
                    <button type="button" className="login-eye" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris)" }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="login-error" style={{ background: "rgb(var(--danger-rgb) / 0.06)", border: "1px solid rgb(var(--danger-rgb) / 0.20)", color: "var(--danger)", fontSize: 12.5, fontWeight: 500, padding: "9px 13px", borderRadius: 10, textAlign: "center" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="login-cta"
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "none", cursor: "pointer", background: "var(--bleu-action)", color: "var(--sur-bleu)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.01em", boxShadow: "0 4px 18px rgb(var(--ombre-rgb) / 0.35)", fontFamily: "var(--font-google-sans)", marginTop: 3 }}>
                  {loading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", position: "relative", zIndex: 1 }}>
                      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Connexion…
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", position: "relative", zIndex: 1 }}>
                      Se connecter <ArrowRight size={15} className="cta-arrow" />
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Pied de carte */}
            <div style={{ padding: "13px 34px", borderTop: "1px solid var(--bordure)", background: "var(--carte-douce)", textAlign: "center", fontSize: 13, color: "var(--gris-fort)" }}>
              Pas encore de compte ?{" "}
              <Link href="/register" className="login-link" style={{ color: "var(--bleu)", fontWeight: 700, textDecoration: "none" }}>
                Créer un compte
              </Link>
            </div>
          </div>
        </div>

        {/* Mention d'accès */}
        <div className="login-after" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 20, maxWidth: 408 }}>
          <Lock size={12} style={{ color: "var(--gris)", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "var(--gris)", lineHeight: 1.5, textAlign: "center" }}>
            Accès réservé aux agents de l&apos;APIX disposant d&apos;un compte professionnel
          </span>
        </div>
      </div>

      {/* ── Pied de page ── */}
      <footer style={{ position: "relative", zIndex: 1, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--bordure)", background: "var(--carte)" }}>
        <span style={{ fontSize: 11.5, color: "var(--gris)" }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</span>
        <span style={{ fontSize: 11.5, color: "var(--gris)" }}>Plateforme à usage institutionnel</span>
      </footer>
    </main>
  )
}
