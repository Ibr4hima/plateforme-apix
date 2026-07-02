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

// Les entrées « disabled » ne sont bloquées que sur le site DÉPLOYÉ (démo),
// jamais en local (où l'API pointe vers localhost).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const IS_DEPLOYED = !!API_URL && !API_URL.includes("localhost") && !API_URL.includes("127.0.0.1");

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
        background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",
        height: "100vh", position: "fixed", top: 0, left: 0,
        display: "flex", flexDirection: "column",
        zIndex: 40, overflowY: "auto", overflowX: "hidden",
        boxShadow: "1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.06)",
      }}>

        {/* Logo */}
        <div style={{ padding: "24px 16px 18px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Image src="/logo_apix.png" alt="APIX" width={90} height={32}
            style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ marginTop: 10, fontSize: 9, fontWeight: 700, color: "#e0813f", letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Espace Administration
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "0 12px 20px" }}>
          {/* Bouton vers le site public */}
          <Link href="/"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", borderRadius: 10, background: "rgba(202,99,31,0.14)", border: "1px solid rgba(224,129,63,0.45)", color: "#e0813f", fontSize: 12.5, fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "0.01em" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(202,99,31,0.26)"; e.currentTarget.style.borderColor = "rgba(224,129,63,0.7)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(202,99,31,0.14)"; e.currentTarget.style.borderColor = "rgba(224,129,63,0.45)"; }}>
            Page publique
          </Link>
          <div style={{ margin: "14px -12px 4px", borderTop: "1px solid rgba(255,255,255,0.1)" }} />
          {MODULES.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: i === 0 ? "10px 12px 8px" : "22px 12px 8px" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.38)", letterSpacing: "0.16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{item.label}</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
              );
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            // Entrées temporairement indisponibles (uniquement sur la démo déployée) :
            // non cliquables, grisées.
            if (item.disabled && IS_DEPLOYED) {
              return (
                <div key={item.href} title="Indisponible"
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    width: "100%", padding: "8px 12px", marginBottom: 2, borderRadius: 10,
                    cursor: "not-allowed", opacity: 0.35,
                    fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                    fontFamily: "var(--font-google-sans)", userSelect: "none",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </div>
              );
            }
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 2 }}>
                <div
                  style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 11,
                    width: "100%", padding: "8px 12px 8px 15px", textAlign: "left",
                    borderRadius: 10, cursor: "pointer", transition: "background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color:      isActive ? "#fff" : "rgba(255,255,255,0.66)",
                    background:  isActive ? "rgba(255,255,255,0.14)" : "transparent",
                    boxShadow:   isActive ? "inset 0 0 0 1px rgba(255,255,255,0.16), 0 4px 14px rgba(0,20,45,0.18)" : "none",
                    fontFamily: "var(--font-google-sans)",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "translateX(2px)"; (e.currentTarget.querySelector(".ms-ico") as HTMLElement).style.color = "#fff"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.66)"; e.currentTarget.style.transform = "none"; (e.currentTarget.querySelector(".ms-ico") as HTMLElement).style.color = "rgba(255,255,255,0.5)"; } }}
                >
                  {isActive && <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 3, height: 17, borderRadius: 999, background: "#ca631f" }} />}
                  <span className="material-symbols-outlined ms-ico" style={{ fontSize: 18, color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`, lineHeight: 1, flexShrink: 0, transition: "color 0.15s" }}>{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Spacer fixe */}
      <div style={{ width: W, flexShrink: 0 }} />
    </>
  );
}
