import { redirect } from "next/navigation";

// « /admin » n'a pas d'écran à lui : il mène au premier module de
// l'administration, celui qu'ouvre « Page Admin » dans le menu.
//
// Il portait un ancien tableau d'accueil que plus aucun lien n'ouvrait, et
// qui avait cessé de suivre l'administration : deux de ses raccourcis (Zones,
// Intentions) menaient à des pages qui n'existent pas, et la plupart des
// modules y étaient encore annoncés « À venir ». Quiconque tapait l'adresse
// tombait sur un écran faux ; la barre latérale est la seule navigation de
// l'administration, et elle est à jour.
export default function AdminPage() {
  redirect("/admin/evenements");
}
