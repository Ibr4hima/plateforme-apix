"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; label: string; href: string }
  | { type: "separator"; label?: string };

const MODULES: NavItem[] = [
  { type: "link", label: "Événements",                     href: "/admin/evenements"          },
  { type: "link", label: "Accords & Traités",              href: "/admin/accords"             },
  { type: "link", label: "Entreprises",                    href: "/admin/entreprises"         },
  { type: "link", label: "Pôles & Zones d'investissement", href: "/admin/gestion-zones"       },
  { type: "link", label: "Opportunités d'investissement",  href: "/admin/opportunites"        },
  { type: "link", label: "Intentions d'investissement",    href: "/admin/intentions"          },
  { type: "link", label: "Prospects",                      href: "/admin/prospects"           },
  { type: "link", label: "Analyse de données",             href: "/admin/analyse"             },
  { type: "separator" },
  { type: "link", label: "Pays & Groupements",             href: "/admin/ref-pays"            },
  { type: "link", label: "Découpage administratif",        href: "/admin/geo"                 },
  { type: "link", label: "Classification NAEMA",           href: "/admin/naema"               },
  { type: "link", label: "Tableaux de correspondance",     href: "/admin/classifications"     },
  { type: "link", label: "Données IDE",                    href: "/admin/ide"                 },
  { type: "link", label: "Données BDEF",                   href: "/admin/bdef"                },
  { type: "link", label: "Code des investissements",       href: "/admin/code-investissement" },
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
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {MODULES.map((item, i) => {
            if (item.type === "separator") {
              return <div key={i} style={{ margin: "8px 4px", borderTop: "1px solid #F2F0EF" }} />;
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 2 }}>
                <div
                  style={{
                    display: "flex", alignItems: "center",
                    width: "100%", padding: "8px 12px", textAlign: "left",
                    borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color:      isActive ? "#004f91" : "#4a5568",
                    background:  isActive ? "rgba(0,79,145,0.08)" : "transparent",
                    fontFamily: "var(--font-google-sans)",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
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
