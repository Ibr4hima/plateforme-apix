import type { Metadata } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-google-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "APIX — Plateforme des Investissements",
    template: "%s | APIX Sénégal",
  },
  description:
    "Plateforme numérique de promotion, d'attraction et de facilitation des investissements privés au Sénégal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={googleSans.variable}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=payments,frame_inspect,real_estate_agent,universal_currency_alt,enterprise,bookmark_stacks,signature,event" />
      </head>
      <body style={{ fontFamily: "var(--font-google-sans), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
