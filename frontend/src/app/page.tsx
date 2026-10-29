"use client";

// L'accueil — l'identité de la plateforme, et le résumé de toutes ses pages.
//
// Il se lit comme l'accueil de l'app (mobile/src/app/(onglets)/(accueil)) :
// la date du jour en petites capitales, puis « Invest in Senegal » sur une
// ligne — Senegal dans le dégradé de la marque — et, sur le même axe, les
// deux entrées principales. Dessous, côte à côte et à la même hauteur : la
// situation du Sénégal en un chiffre (la vedette), et la colonne du moment
// — le prochain événement, puis les derniers signaux d'investissement.
// Puis, sous la vedette et à sa largeur, les investissements directs
// étrangers (deux chiffres et le classement de l'Afrique occidentale), et les
// investissements annoncés (derniers projets, pays d'origine).
//
// Tout s'écrit sur le fond de la page, comme les autres écrans : ni bandeau
// ni aplat — les blocs blancs, les mots bleus, l'orange pour « Senegal », et
// le seul bloc de couleur est celui de l'agenda.

import Navbar from "@/components/layout/Navbar";
import Vedette from "@/components/accueil/Vedette";
import ProchainEvenement from "@/components/accueil/ProchainEvenement";
import DerniersSignaux from "@/components/accueil/Signaux";
import Ide from "@/components/accueil/Ide";
import Annonces from "@/components/accueil/Annonces";
import { premierDuMois } from "@/lib/format";
import { ChevronRight } from "lucide-react";
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

const ICONE: React.CSSProperties = { fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 };

export default function HomePage() {
  const date = useDateDuJour();

  return (
    <main style={{ minHeight: "100vh", background: "var(--fond)", overflowX: "hidden", fontFamily: "var(--font-google-sans)" }}>
      <Navbar />

      {/* ── En-tête : le titre et ses deux entrées sur un même axe, puis la
           vedette et l'agenda côte à côte ── */}
      <section className="acc-cadre acc-tete">
        <p className="acc-date">{date ?? " "}</p>
        <div className="acc-titre-ligne">
          <h1 className="acc-titre">Invest in <span className="acc-senegal">Senegal</span></h1>
          <div className="acc-boutons">
            <Link href="/tableau-de-bord" className="ds-bouton ds-bouton--primaire ds-bouton--grand" style={{ gap: 8 }}>
              <span className="material-symbols-outlined" aria-hidden style={ICONE}>analytics</span>
              Tableau de bord <ChevronRight size={15} />
            </Link>
            <Link href="/ide" className="ds-bouton ds-bouton--secondaire ds-bouton--grand" style={{ gap: 8 }}>
              <span className="material-symbols-outlined" aria-hidden style={{ ...ICONE, color: "var(--bleu)" }}>finance_mode</span>
              Investissements privés
            </Link>
          </div>
        </div>
        <div className="acc-briefing">
          <Vedette />
          <div className="acc-colonne">
            <ProchainEvenement />
            <DerniersSignaux />
          </div>
        </div>
      </section>

      <Ide />
      <Annonces />

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      {/* Une seule ligne basse : la DIPE et son agence à gauche, les droits à
          droite — sans logo, la barre de navigation porte déjà celui de
          l'APIX. */}
      <footer style={{ borderTop: "1px solid var(--bordure)", background: "var(--carte)" }}>
        <div className="acc-cadre" style={{ paddingTop: 16, paddingBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px 40px" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--encre)" }}>DIPE — Direction de l&apos;Intelligence et des Perspectives Économiques</div>
            <div style={{ fontSize: 12, color: "var(--gris-fort)", marginTop: 2 }}>Agence Nationale pour la Promotion des Investissements et des Grands Travaux</div>
          </div>
          <p style={{ color: "var(--gris-fort)", fontSize: 12 }}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</p>
        </div>
      </footer>
    </main>
  );
}
