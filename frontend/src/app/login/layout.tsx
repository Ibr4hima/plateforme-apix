// Le titre d'onglet du navigateur. Les pages de ce module sont des composants
// client : elles ne peuvent pas exporter de métadonnées elles-mêmes, c'est le
// rôle de ce layout serveur — qui ne rend rien d'autre que ses enfants.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connexion" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
