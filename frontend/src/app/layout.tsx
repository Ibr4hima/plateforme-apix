import Providers from "@/components/layout/Providers";
import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-google-sans",
  display: "swap",
  // next/font n'a pas les métriques de Google Sans : son repli automatique
  // échouait au build (« Failed to find font override values ») et le texte
  // sautait au chargement. Le repli est fourni à la main — « Google Sans
  // Fallback », un Arial redimensionné aux métriques mesurées, dans globals.css.
  adjustFontFallback: false,
  fallback: ["Google Sans Fallback", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "APIX — Plateforme des Investissements",
    template: "%s | APIX Sénégal",
  },
  description:
    "Plateforme numérique de promotion, d'attraction et de facilitation des investissements privés au Sénégal.",
  icons: {
    icon: "/favicon-apix.png",
    shortcut: "/favicon-apix.png",
    apple: "/favicon-apix.png",
  },
};

// La plateforme ne s'affiche qu'en clair, même sur un appareil réglé en sombre :
// le navigateur peint aussi ses contrôles natifs (calendrier, ascenseurs) en
// clair.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={googleSans.variable}>
      <head>
        {/* Les icônes Material Symbols sont AUTO-HÉBERGÉES : la police
            subsettée (nos 38 glyphes, 41 Ko) vit dans public/polices et sa
            @font-face dans globals.css. Aucune requête ne part vers Google —
            question de souveraineté autant que de latence. Pour AJOUTER une
            icône, régénérer le woff2 : l'URL css2 à interroger (avec le
            paramètre icon_names complété) est dans globals.css. */}
        <link rel="preload" href="/polices/material-symbols.woff2?v=2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* Zoom forcé (démo) : appliqué seulement si NEXT_PUBLIC_FORCE_ZOOM est défini, et uniquement sur grand écran */}
        {process.env.NEXT_PUBLIC_FORCE_ZOOM ? (
          <style>{`@media (min-width:1024px){html{zoom:${process.env.NEXT_PUBLIC_FORCE_ZOOM}}}`}</style>
        ) : null}
      </head>
      <body style={{ fontFamily: "var(--font-google-sans), sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
