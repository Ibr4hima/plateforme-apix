import AdminChrome from "@/components/admin/AdminChrome";
import type { Metadata } from "next";

// Chaque module d'administration porte son titre (layout.tsx du segment) ; ce
// gabarit les suffixe. Le gabarit le plus proche l'emporte sur celui de la
// racine — d'où le rappel de la marque ici.
export const metadata: Metadata = {
  title: {
    default: "Administration",
    template: "%s · Administration | APIX Sénégal",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
