// Les textes que l'on PARTAGE depuis l'app (menu contextuel, iOS) : un objet
// dit en quelques lignes, lisible tel quel dans Messages, Mail ou WhatsApp,
// et qui porte sa source — un chiffre transmis sans elle ne vaut rien.
import {
  accorder, fmtEntier, fmtMontant, moisEnClair, periodeEnClair,
  type Investisseur, type ProjetFdi, type Signal,
} from "@/lib/fdi";

/** Les lignes présentes, une par ligne. */
export const lignes = (...l: (string | null | undefined | false)[]): string =>
  l.filter(Boolean).join("\n");

const approx = (estime: boolean | null | undefined) => (estime ? "≈ " : "");
const SOURCE_FDI = "Source : fDi Markets · APIX";

/** Un projet annoncé : l'entreprise, le trajet, le mois, les chiffres. */
export function partageProjetFdi(p: ProjetFdi, sensSource: boolean): string {
  // `pays` est le pays lu, `partenaire` celui d'en face
  const origine = sensSource ? p.pays : p.partenaire;
  const destination = sensSource ? p.partenaire : p.pays;
  const trajet = origine && destination ? `${origine} → ${destination}` : origine ?? destination;
  const chiffres = [
    p.capex_musd != null ? `Montant : ${approx(p.capex_estime)}${fmtMontant(p.capex_musd)}` : null,
    p.emplois != null ? `Emplois : ${approx(p.emplois_estime)}${fmtEntier(p.emplois)}` : null,
  ].filter(Boolean).join(" · ");
  return lignes(
    p.entreprise ?? "Projet d'investissement",
    [trajet, moisEnClair(p.periode)].filter(Boolean).join(" · "),
    p.secteur, chiffres, SOURCE_FDI,
  );
}

/** Un signal : l'entreprise, son stade, d'où part l'intention et où elle va. */
export function partageSignal(s: Signal): string {
  const destinations = s.destinations.map(d => d.libelle).filter(Boolean).join(", ");
  const stade = s.natures[0]?.libelle;
  return lignes(
    s.entreprise ?? "Signal d'investissement",
    [stade, moisEnClair(s.periode)].filter(Boolean).join(" · "),
    s.origine && destinations ? `${s.origine} → ${destinations}` : s.origine ?? (destinations || null),
    SOURCE_FDI,
  );
}

/** Un investisseur : son nom, son pays, ses projets et leur période. */
export function partageInvestisseur(e: Investisseur): string {
  return lignes(
    e.nom,
    [e.origine, `${fmtEntier(e.projets)} ${accorder(e.projets, "projet")}`, periodeEnClair(e.annees)].filter(Boolean).join(" · "),
    SOURCE_FDI,
  );
}
