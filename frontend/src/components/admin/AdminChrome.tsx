"use client";

// Coquille de l'espace d'administration.
// Les pages refondues (bandeau bleu + menu, comme les pages publiques) occupent
// toute la largeur ; les pages encore au gabarit historique conservent la barre
// latérale le temps de leur refonte.

import { usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import LectureSeule from "@/components/admin/LectureSeule";
import { estPageRefondue } from "@/components/admin/navAdmin";

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const refondue = estPageRefondue(pathname || "");

  if (refondue) {
    return (
      <main style={{ minHeight: "100vh", background: "#F6F5F3" }}>
        <LectureSeule>{children}</LectureSeule>
      </main>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F6F5F3" }}>
      <Sidebar />
      <main style={{ flex: 1, minHeight: "100vh", overflow: "auto" }}>
        <LectureSeule>{children}</LectureSeule>
      </main>
    </div>
  );
}
