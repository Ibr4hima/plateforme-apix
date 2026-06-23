"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import AuthShell, { authInputStyle, authButtonStyle, authLabelStyle } from "@/components/auth/AuthShell"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
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
    <AuthShell
      title="Créer un compte"
      subtitle="Réservé aux agents disposant d'une adresse @apix.sn"
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" style={{ color: "#ca631f", fontWeight: 700, textDecoration: "none" }}>
            Se connecter
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
            placeholder="8 caractères minimum"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authInputStyle}
          />
        </div>

        <div>
          <label style={authLabelStyle}>Confirmer le mot de passe</label>
          <input
            className="auth-input"
            type="password"
            required
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Création…
            </span>
          ) : (
            "Créer mon compte"
          )}
        </button>
      </form>
    </AuthShell>
  )
}
