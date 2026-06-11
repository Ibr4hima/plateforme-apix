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
  { type: "link", label: "Code des investissements",       href: "/admin/code-investissement" },
];

const W = 260;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .apix-sidebar::-webkit-scrollbar       { width: 4px; }
        .apix-sidebar::-webkit-scrollbar-track { background: transparent; }
        .apix-sidebar::-webkit-scrollbar-thumb { background: #ca631f; border-radius: 99px; }
        .apix-sidebar { scrollbar-color: #ca631f transparent; scrollbar-width: thin; }
      `}</style>

      <aside className="apix-sidebar" style={{
        width: W, flexShrink: 0, background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
        height: "100vh", position: "fixed", top: 0, left: 0,
        display: "flex", flexDirection: "column",
        zIndex: 40, overflowY: "auto", overflowX: "hidden",
      }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Image src="/logo_apix.png" alt="APIX" width={90} height={32}
            style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Espace Administration
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {MODULES.map((item, i) => {
            if (item.type === "separator") {
              return <div key={i} style={{ margin: "8px 4px", borderTop: "1px solid rgba(255,255,255,0.12)" }} />;
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 4 }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", padding: "8px 14px", textAlign: "center",
                    borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
                    fontSize: 12.5, fontWeight: isActive ? 700 : 400,
                    color:      isActive ? "#fff" : "rgba(255,255,255,0.55)",
                    background: isActive ? "rgba(255,255,255,0.2)"  : "rgba(255,255,255,0.06)",
                    outline:    isActive ? "1.5px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.12)",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; } }}
                >
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.12)", textAlign: "center" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
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
