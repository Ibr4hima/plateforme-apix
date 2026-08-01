"use client";

// Coquille de l'espace d'administration : barre latérale de navigation à
// gauche, contenu de la page à droite. Toutes les pages admin la partagent —
// la navigation ne dépend plus de l'avancement de la refonte de chaque page.

import Sidebar from "@/components/admin/Sidebar";
import LectureSeule from "@/components/admin/LectureSeule";

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", minHeight: "100vh", background: "#F6F5F3" }}>
      <Sidebar />
      {/* minWidth:0 — sans quoi une grille ou un tableau large pousserait la
          colonne au-delà de la fenêtre au lieu de défiler dans son cadre. */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <LectureSeule>{children}</LectureSeule>
      </main>
    </div>
  );
}
