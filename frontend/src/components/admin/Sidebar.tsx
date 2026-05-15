"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, FileText, Building2,
  MapPin, Lightbulb, TrendingUp, Target, Globe, ChevronRight,
} from "lucide-react";

const MODULES = [
  { label: "Dashboard",     href: "/admin",              icon: LayoutDashboard, color: "#1a1a2e" },
  { label: "Événements",    href: "/admin/evenements",   icon: Calendar,        color: "#004f91" },
  { label: "Accords",       href: "/admin/accords",      icon: FileText,        color: "#7c3aed" },
  { label: "Entreprises",   href: "/admin/entreprises",  icon: Building2,       color: "#ca631f" },
  { label: "Zones",         href: "/admin/zones",        icon: MapPin,          color: "#059669" },
  { label: "Opportunités",  href: "/admin/opportunites", icon: Lightbulb,       color: "#d97706" },
  { label: "IDE",           href: "/admin/ide",          icon: TrendingUp,      color: "#dc2626" },
  { label: "Intentions",    href: "/admin/intentions",   icon: Target,          color: "#0891b2" },
  { label: "Prospects",     href: "/admin/prospects",    icon: Globe,           color: "#65a30d" },
  { label: "Géographie",     href: "/admin/geo",          icon: MapPin,          color: "#0891b2" },
  { label: "NAEMA",          href: "/admin/naema",          icon: LayoutDashboard, color: "#6b7280" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: "#1a1a2e",
      height: "100vh", position: "fixed", top: 0, left: 0,
      display: "flex", flexDirection: "column",
      zIndex: 40, overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{
        padding: "24px 20px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Image
          src="/logo_apix.png"
          alt="APIX"
          width={110}
          height={40}
          style={{ height: 40, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
        <div style={{
          marginTop: 10, fontSize: 10, fontWeight: 700,
          color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase",
        }}>
          Espace Administration
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em", textTransform: "uppercase", padding: "0 8px", marginBottom: 8 }}>
          Modules
        </p>
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = pathname === m.href ||
            (m.href !== "/admin" && pathname.startsWith(m.href));
          return (
            <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, marginBottom: 2,
                background: isActive ? "rgba(202,99,31,0.15)" : "transparent",
                border: isActive ? "1px solid rgba(202,99,31,0.25)" : "1px solid transparent",
                transition: "all 0.2s", cursor: "pointer",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: isActive ? `${m.color}30` : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={15} style={{ color: isActive ? m.color : "rgba(255,255,255,0.4)" }} />
                </div>
                <span style={{
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  flex: 1,
                }}>
                  {m.label}
                </span>
                {isActive && <ChevronRight size={13} style={{ color: "#ca631f" }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer sidebar */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: "rgba(255,255,255,0.3)",
            transition: "color 0.2s", cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
            ← Retour au site public
          </div>
        </Link>
      </div>
    </aside>
  );
}
