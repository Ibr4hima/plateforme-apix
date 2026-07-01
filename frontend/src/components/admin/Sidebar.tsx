"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; label: string; href: string; icon: string; disabled?: boolean }
  | { type: "section"; label: string };

const MODULES: NavItem[] = [
  { type: "section", label: "Gestion des données" },
  { type: "link", label: "Événements",                     href: "/admin/evenements",         icon: "event"                 },
  { type: "link", label: "Accords & Traités",              href: "/admin/accords",            icon: "signature"             },
  { type: "link", label: "Entreprises",                    href: "/admin/entreprises",        icon: "enterprise"            },
  { type: "link", label: "Pôles & Zones d'investissement", href: "/admin/gestion-zones",      icon: "real_estate_agent"     },
  { type: "link", label: "Opportunités d'investissement",  href: "/admin/opportunites",       icon: "bookmark_stacks"       },
  { type: "link", label: "Intentions d'investissement",    href: "/admin/intentions",         icon: "universal_currency_alt", disabled: true },
  { type: "link", label: "Prospects",                      href: "/admin/prospects",          icon: "frame_inspect"         },
  { type: "link", label: "Analyse de données",             href: "/admin/analyse",            icon: "show_chart",             disabled: true },
  { type: "section", label: "Référentiels" },
  { type: "link", label: "Pays & Groupements",             href: "/admin/ref-pays",           icon: "public",                 disabled: true },
  { type: "link", label: "Découpage administratif",        href: "/admin/geo",                icon: "map",                    disabled: true },
  { type: "link", label: "Classification NAEMA",           href: "/admin/naema",              icon: "account_tree",           disabled: true },
  { type: "link", label: "Tableaux de correspondance",     href: "/admin/classifications",    icon: "table_chart",            disabled: true },
  { type: "link", label: "Données IDE",                    href: "/admin/ide",                icon: "finance_mode",           disabled: true },
  { type: "link", label: "Données BDEF",                   href: "/admin/bdef",               icon: "database",               disabled: true },
  { type: "link", label: "Code des investissements",       href: "/admin/code-investissement",icon: "gavel",                  disabled: true },
];

const W = 260;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .apix-sidebar::-webkit-scrollbar       { width: 5px; }
        .apix-sidebar::-webkit-scrollbar-track { background: transparent; }
        .apix-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 99px; }
        .apix-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
        .apix-sidebar { scrollbar-color: rgba(255,255,255,0.22) transparent; scrollbar-width: thin; }
      `}</style>

      <aside className="apix-sidebar" style={{
        width: W, flexShrink: 0,
        background: "linear-gradient(180deg,#01315d 0%,#013f74 40%,#004f91 100%)",
        height: "100vh", position: "fixed", top: 0, left: 0,
        display: "flex", flexDirection: "column",
        zIndex: 40, overflowY: "auto", overflowX: "hidden",
        boxShadow: "1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.06)",
      }}>

        {/* Logo */}
        <div style={{ padding: "22px 16px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Image src="/logo_apix.png" alt="APIX" width={90} height={32}
            style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ marginTop: 9, fontSize: 9, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Espace Administration
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "10px 12px 16px" }}>
          {MODULES.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={i} style={{ padding: i === 0 ? "6px 12px 7px" : "18px 12px 7px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.42)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {item.label}
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            // Entrées temporairement indisponibles : non cliquables, grisées.
            if (item.disabled) {
              return (
                <div key={item.href} title="Bientôt disponible"
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    width: "100%", padding: "9px 13px", marginBottom: 3, borderRadius: 10,
                    cursor: "not-allowed", opacity: 0.4,
                    fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-google-sans)", userSelect: "none",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 19, color: "rgba(255,255,255,0.45)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "1px 6px", flexShrink: 0 }}>Bientôt</span>
                </div>
              );
            }
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 3 }}>
                <div
                  style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 11,
                    width: "100%", padding: "9px 13px", textAlign: "left",
                    borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color:      isActive ? "#fff" : "rgba(255,255,255,0.66)",
                    background:  isActive ? "rgba(255,255,255,0.13)" : "transparent",
                    boxShadow:   isActive ? "inset 0 0 0 1px rgba(255,255,255,0.1)" : "none",
                    fontFamily: "var(--font-google-sans)",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; (e.currentTarget.querySelector(".ms-ico") as HTMLElement).style.color = "rgba(255,255,255,0.92)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.66)"; (e.currentTarget.querySelector(".ms-ico") as HTMLElement).style.color = "rgba(255,255,255,0.5)"; } }}
                >
                  {isActive && <span style={{ position: "absolute", left: -12, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 999, background: "#ca631f" }} />}
                  <span className="material-symbols-outlined ms-ico" style={{ fontSize: 19, color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1, flexShrink: 0, transition: "color 0.15s" }}>{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
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
