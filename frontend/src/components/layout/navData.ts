// Données de navigation partagées entre la navbar et les bandeaux de page.

export const modules = [
  { label: "Investissements privés",        href: "/ide",          icon: "finance_mode",           color: "#ca631f" },
  { label: "Échanges commerciaux",          href: "/statistiques", icon: "currency_exchange",      color: "#004f91" },
  { label: "Prospects",                     href: "/prospects",    icon: "frame_inspect",          color: "#ca631f" },
  { label: "Entreprises installées",        href: "/entreprises",  icon: "enterprise",             color: "#004f91" },
  { label: "Zones d'investissement",        href: "/zones",        icon: "real_estate_agent",      color: "#ca631f" },
  { label: "Opportunités d'investissement", href: "/opportunites", icon: "bookmark_stacks",        color: "#004f91" },
  { label: "Accords & Traités",             href: "/accords",      icon: "signature",              color: "#ca631f" },
  { label: "Événements",                    href: "/evenements",   icon: "event",                  color: "#004f91" },
];

// Slugs des modules protégés (connexion requise quand AUTH_ENFORCED est actif)
export const PROTECTED_SLUGS: Record<string, string> = {
  "/ide": "ide", "/prospects": "prospects", "/opportunites": "opportunites",
  "/tableau-de-bord": "tableau-de-bord", "/statistiques": "statistiques",
};
