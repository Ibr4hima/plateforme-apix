// Le titre d'onglet du navigateur. La page est un composant client : elle ne
// peut pas exporter de métadonnées elle-même.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapport · Investissement direct étranger" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
