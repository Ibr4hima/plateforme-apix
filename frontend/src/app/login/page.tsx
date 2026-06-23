"use client"

import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 p-8">
        {/* Logo APIX */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl font-bold tracking-tight text-gray-900">
            APIX
          </span>
          <span className="text-sm text-gray-500">
            Agence de Promotion des Investissements et Grands Travaux
          </span>
        </div>

        <div className="w-full border-t border-gray-100" />

        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-gray-600 text-center text-sm">
            Connectez-vous avec votre compte Microsoft @apix.sn
          </p>

          <button
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#0078d4] hover:bg-[#006cbf] text-white font-medium rounded-lg transition-colors"
          >
            {/* Icône Microsoft */}
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Se connecter avec Microsoft
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Accès réservé aux agents APIX disposant d&apos;un compte @apix.sn
        </p>
      </div>
    </div>
  )
}
