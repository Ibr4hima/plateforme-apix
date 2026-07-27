// Navigation de l'espace d'administration — source unique partagée par le menu
// du bandeau bleu (AdminMenu) et l'ancienne barre latérale.

export type NavItemAdmin =
  | { type: "link"; label: string; href: string; icon: string; disabled?: boolean }
  | { type: "section"; label: string };

export const MODULES_ADMIN: NavItemAdmin[] = [
  { type: "section", label: "Gestion des données" },
  { type: "link", label: "Utilisateurs & accès",            href: "/admin/utilisateurs",       icon: "security",           disabled: true },
  { type: "link", label: "Événements",                      href: "/admin/evenements",         icon: "event"                             },
  { type: "link", label: "Accords & Traités",               href: "/admin/accords",            icon: "signature"                         },
  { type: "link", label: "Entreprises",                     href: "/admin/entreprises",        icon: "enterprise"                        },
  { type: "link", label: "Pôles & Zones d'investissement",  href: "/admin/gestion-zones",      icon: "real_estate_agent"                 },
  { type: "link", label: "Opportunités d'investissement",   href: "/admin/opportunites",       icon: "bookmark_stacks"                   },
  { type: "link", label: "Prospects",                       href: "/admin/prospects",          icon: "frame_inspect"                     },
  { type: "link", label: "Analyse de données",              href: "/admin/analyse",            icon: "show_chart",         disabled: true },
  { type: "section", label: "Référentiels" },
  { type: "link", label: "Données Statistiques",            href: "/admin/statistiques",       icon: "public"                            },
  { type: "link", label: "Pays & Groupements",              href: "/admin/ref-pays",           icon: "public",             disabled: true },
  { type: "link", label: "Découpage administratif",         href: "/admin/geo",                icon: "map",                disabled: true },
  { type: "link", label: "Classification NAEMA",            href: "/admin/naema",              icon: "account_tree",       disabled: true },
  { type: "link", label: "Tableaux de correspondance",      href: "/admin/classifications",    icon: "table_chart",        disabled: true },
  { type: "link", label: "Données IDE",                     href: "/admin/ide",                icon: "finance_mode"                      },
  { type: "link", label: "Données BDEF",                    href: "/admin/bdef",               icon: "database",           disabled: true },
  { type: "link", label: "Commerce extérieur",              href: "/admin/commerce-exterieur", icon: "anchor"                            },
  { type: "link", label: "Code des investissements",        href: "/admin/code-investissement",icon: "gavel"                             },
  { type: "link", label: "Lexique",                         href: "/admin/lexique",            icon: "language"                          },
];

// Les entrées « disabled » ne sont bloquées que sur le site DÉPLOYÉ (démo),
// jamais en local (où l'API pointe vers localhost).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const IS_DEPLOYED = !!API_URL && !API_URL.includes("localhost") && !API_URL.includes("127.0.0.1");

// Pages d'administration déjà passées au nouveau gabarit (bandeau bleu + menu) :
// elles n'affichent plus la barre latérale héritée.
export const PAGES_REFONDUES = ["/admin/evenements", "/admin/accords", "/admin/entreprises", "/admin/gestion-zones", "/admin/opportunites"];
export const estPageRefondue = (pathname: string) =>
  PAGES_REFONDUES.some(p => pathname === p || pathname.startsWith(p + "/"));
