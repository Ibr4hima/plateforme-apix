"use client";

// L'accueil — l'identité de la plateforme, et le résumé de toutes ses pages.
//
// Il se lit comme l'accueil de l'app (mobile/src/app/(onglets)/(accueil)) :
// la date du jour en petites capitales, puis « Invest in Senegal », Senegal
// dans le dégradé de la marque. À côté, la situation du Sénégal en un
// chiffre (la vedette). Dessous, ce qui arrive et ce qui vient d'être annoncé
// (À la une), puis chaque module avec son chiffre du moment (Explorer).
//
// Tout s'écrit sur le fond de la page, comme les autres écrans : ni bandeau
// ni aplat — les blocs blancs, les mots bleus, l'orange pour « Senegal ».

import Navbar from "@/components/layout/Navbar";
import Vedette from "@/components/accueil/Vedette";
import ALaUne from "@/components/accueil/ALaUne";
import Explorer from "@/components/accueil/Explorer";
import { premierDuMois } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

/** La date du jour, en toutes lettres — « MERCREDI 28 OCTOBRE 2026 ». Lue
    côté navigateur seulement : la page est rendue d'avance sur le serveur,
    et une date figée au rendu y resterait fausse le lendemain. Le serveur
    n'en écrit rien ; le navigateur la pose à l'hydratation. */
const dateDuJour = () => premierDuMois(new Date().toLocaleDateString("fr-FR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric" }));
const sAbonner = () => () => {};
function useDateDuJour() {
  return useSyncExternalStore(sAbonner, dateDuJour, () => null);
}

export default function HomePage() {
  const date = useDateDuJour();

  return (
    <main style={{ minHeight: "100vh", background: "var(--fond)", overflowX: "hidden", fontFamily: "var(--font-google-sans)" }}>
      <Navbar />

      {/* ── En-tête : Invest in Senegal, et la situation en un chiffre ── */}
      <section className="acc-cadre" style={{ paddingTop: 64 + 64, paddingBottom: 64 }}>
        <div className="acc-hero">
          <div className="acc-entree">
            <p className="acc-date">{date ?? " "}</p>
            <h1 className="acc-titre">Invest in<br /><span className="acc-senegal">Senegal</span></h1>
            <p className="acc-chapo">
              La plateforme de l&apos;APIX pour suivre, analyser et piloter l&apos;investissement
              au Sénégal : flux d&apos;IDE, projets annoncés, commerce extérieur,
              entreprises, zones et accords, réunis en un seul endroit.
            </p>
            <div className="acc-boutons">
              <Link href="/tableau-de-bord" className="ds-bouton ds-bouton--primaire ds-bouton--grand" style={{ gap: 8 }}>
                <span className="material-symbols-outlined" aria-hidden
                  style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>analytics</span>
                Tableau de bord <ChevronRight size={15} />
              </Link>
              <Link href="/ide" className="ds-bouton ds-bouton--secondaire ds-bouton--grand" style={{ gap: 8 }}>
                <span className="material-symbols-outlined" aria-hidden
                  style={{ fontSize: 18, color: "var(--bleu)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>finance_mode</span>
                Investissements privés
              </Link>
            </div>
          </div>
          <Vedette />
        </div>
      </section>

      <ALaUne />
      <Explorer />

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      {/* Une seule ligne : l'identité de la DIPE à gauche — le logo de l'APIX,
          un filet, son nom et celui de l'agence —, les droits à droite. */}
      <footer style={{ borderTop: "1px solid var(--bordure)", background: "var(--carte)" }}>
        <div className="acc-cadre" style={{ paddingTop: 28, paddingBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* 120 × 68 : les proportions de l'image (595 × 337), et la même
                source que les autres logos de la plateforme. */}
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={120} height={68} style={{ height: 40, width: "auto", objectFit: "contain" }} />
            <div style={{ width: 1, height: 36, background: "var(--fond-creux2)" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--encre)" }}>DIPE — Direction de l&apos;Intelligence et des Perspectives Économiques</div>
              <div style={{ fontSize: 12, color: "var(--gris-fort)", marginTop: 2 }}>Agence Nationale pour la Promotion des Investissements et des Grands Travaux</div>
            </div>
          </div>
          <p style={{ color: "var(--gris-fort)", fontSize: 12 }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</p>
        </div>
      </footer>
    </main>
  );
}
