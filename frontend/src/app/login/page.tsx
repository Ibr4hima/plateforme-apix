"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import AuthShell, { authInputStyle, authButtonStyle, authLabelStyle } from "@/components/auth/AuthShell"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace avec votre compte @apix.sn"
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/register" style={{ color: "#ca631f", fontWeight: 700, textDecoration: "none" }}>
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={authLabelStyle}>Adresse email</label>
          <input
            className="auth-input"
            type="email"
            required
            placeholder="prenom.nom@apix.sn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authInputStyle}
          />
        </div>

        <div>
          <label style={authLabelStyle}>Mot de passe</label>
          <input
            className="auth-input"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authInputStyle}
          />
        </div>

        {error && (
          <div
            style={{
              background: "rgba(220,38,38,0.07)",
              border: "1px solid rgba(220,38,38,0.2)",
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 500,
              padding: "10px 14px",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-cta" style={authButtonStyle}>
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Connexion…
            </span>
          ) : (
            "Se connecter"
          )}
        </button>
      </form>
    </AuthShell>
  )
}
