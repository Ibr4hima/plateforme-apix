"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; label: string; href: string; icon: string }
  | { type: "section"; label: string };

const MODULES: NavItem[] = [
  { type: "section", label: "Gestion des données" },
  { type: "link", label: "Événements",                     href: "/admin/evenements",         icon: "event"                 },
  { type: "link", label: "Accords & Traités",              href: "/admin/accords",            icon: "signature"             },
  { type: "link", label: "Entreprises",                    href: "/admin/entreprises",        icon: "enterprise"            },
  { type: "link", label: "Pôles & Zones d'investissement", href: "/admin/gestion-zones",      icon: "real_estate_agent"     },
  { type: "link", label: "Opportunités d'investissement",  href: "/admin/opportunites",       icon: "bookmark_stacks"       },
  { type: "link", label: "Intentions d'investissement",    href: "/admin/intentions",         icon: "universal_currency_alt"},
  { type: "link", label: "Prospects",                      href: "/admin/prospects",          icon: "frame_inspect"         },
  { type: "link", label: "Analyse de données",             href: "/admin/analyse",            icon: "show_chart"            },
  { type: "section", label: "Référentiels" },
  { type: "link", label: "Pays & Groupements",             href: "/admin/ref-pays",           icon: "public"                },
  { type: "link", label: "Découpage administratif",        href: "/admin/geo",                icon: "map"                   },
  { type: "link", label: "Classification NAEMA",           href: "/admin/naema",              icon: "account_tree"          },
  { type: "link", label: "Tableaux de correspondance",     href: "/admin/classifications",    icon: "table_chart"           },
  { type: "link", label: "Données IDE",                    href: "/admin/ide",                icon: "finance_mode"          },
  { type: "link", label: "Données BDEF",                   href: "/admin/bdef",               icon: "database"              },
  { type: "link", label: "Code des investissements",       href: "/admin/code-investissement",icon: "gavel"                 },
];

const W = 260;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .apix-sidebar::-webkit-scrollbar       { width: 5px; }
        .apix-sidebar::-webkit-scrollbar-track { background: transparent; }
        .apix-sidebar::-webkit-scrollbar-thumb { background: #E8E5E3; border-radius: 99px; }
        .apix-sidebar::-webkit-scrollbar-thumb:hover { background: #C5BFBB; }
        .apix-sidebar { scrollbar-color: #E8E5E3 transparent; scrollbar-width: thin; }
      `}</style>

      <aside className="apix-sidebar" style={{
        width: W, flexShrink: 0, background: "#fff", borderRight: "1px solid #E8E5E3",
        height: "100vh", position: "fixed", top: 0, left: 0,
        display: "flex", flexDirection: "column",
        zIndex: 40, overflowY: "auto", overflowX: "hidden",
      }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #F2F0EF", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Image src="/logo_apix.png" alt="APIX" width={90} height={32}
            style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Espace Administration
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "10px 10px 16px" }}>
          {MODULES.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={i} style={{ padding: i === 0 ? "6px 12px 6px" : "16px 12px 6px", fontSize: 10, fontWeight: 700, color: "#b3bcc9", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {item.label}
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 2 }}>
                <div
                  style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 11,
                    width: "100%", padding: "9px 12px", textAlign: "left",
                    borderRadius: 9, cursor: "pointer", transition: "all 0.15s",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color:      isActive ? "#004f91" : "#4a5568",
                    background:  isActive ? "rgba(0,79,145,0.08)" : "transparent",
                    fontFamily: "var(--font-google-sans)",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F5F4F3"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {isActive && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 999, background: "#004f91" }} />}
                  <span className="material-symbols-outlined" style={{ fontSize: 19, color: isActive ? "#004f91" : "#9aa5b4", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1, flexShrink: 0, transition: "color 0.15s" }}>{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #F2F0EF", textAlign: "center" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 11, color: "#9aa5b4", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#004f91")}
              onMouseLeave={e => (e.currentTarget.style.color = "#9aa5b4")}>
              ← Retour au site public
            </div>
          </Link>
        </div>
      </aside>

      {/* Spacer fixe */}
      <div style={{ width: W, flexShrink: 0 }} />
    </>
  );
}
