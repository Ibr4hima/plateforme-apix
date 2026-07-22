import Providers from "@/components/layout/Providers";
import type { Metadata } from "next";
import { Google_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-google-sans",
  display: "swap",
});

// Police d'affichage (titres) — serif institutionnel/premium, distinct du corps
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  style: ["normal"],
  variable: "--font-fraunces",
  display: "swap",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${googleSans.variable} ${fraunces.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=account_tree,admin_panel_settings,all_inclusive,analytics,anchor,bookmark_stacks,close,currency_exchange,dashboard,database,enterprise,event,finance_mode,flag,frame_inspect,gavel,home_app_logo,language,location_on,logout,map,menu,menu_open,payments,picture_as_pdf,public,real_estate_agent,search,security,send,show_chart,signature,sort,table_chart,universal_currency_alt" />
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
