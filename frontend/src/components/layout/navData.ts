// Données de navigation partagées entre la navbar et les bandeaux de page.

export const modules = [
  { label: "Investissements privés",        href: "/ide",          icon: "finance_mode",           color: "var(--orange)" },
  { label: "Échanges commerciaux",          href: "/statistiques", icon: "currency_exchange",      color: "var(--bleu)" },
  { label: "Prospects",                     href: "/prospects",    icon: "frame_inspect",          color: "var(--orange)" },
  { label: "Entreprises installées",        href: "/entreprises",  icon: "enterprise",             color: "var(--bleu)" },
  { label: "Zones d'investissement",        href: "/zones",        icon: "real_estate_agent",      color: "var(--orange)" },
  { label: "Opportunités d'investissement", href: "/opportunites", icon: "bookmark_stacks",        color: "var(--bleu)" },
  { label: "Accords & Traités",             href: "/accords",      icon: "signature",              color: "var(--orange)" },
  { label: "Événements",                    href: "/evenements",   icon: "event",                  color: "var(--bleu)" },
];

// Slugs des modules protégés (connexion requise quand AUTH_ENFORCED est actif)
export const PROTECTED_SLUGS: Record<string, string> = {
  "/ide": "ide", "/prospects": "prospects", "/opportunites": "opportunites",
  "/tableau-de-bord": "tableau-de-bord", "/statistiques": "statistiques",
};
