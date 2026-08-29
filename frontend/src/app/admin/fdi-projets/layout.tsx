// Le titre d'onglet du navigateur. La page est un composant client : elle ne
// peut pas exporter de métadonnées elle-même, c'est le rôle de ce layout
// serveur — qui ne rend rien d'autre que ses enfants.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "fDi Markets" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
