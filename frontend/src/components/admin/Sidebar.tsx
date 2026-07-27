"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AUTH_ENFORCED, pageAdminAccessible } from "@/lib/authGate";
import { MODULES_ADMIN as MODULES, IS_DEPLOYED } from "@/components/admin/navAdmin";

const W = 260;

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  // Pages non accessibles pour ce profil (Admin : pas d'Utilisateurs & accès,
  // d'Analyse ni de référentiels ; Admin+ : seulement ses pages cochées).
  const verrouillePour = (href: string) => !pageAdminAccessible(session, href.replace("/admin/", ""));

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
          <div style={{ marginTop: 10, fontSize: 9, fontWeight: 700, color: "#ca631f", letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Espace Administration
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "0 12px 20px" }}>
          {/* Bouton vers le site public */}
          <Link href="/"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", borderRadius: 10, background: "rgba(202,99,31,0.10)", border: "1px solid rgba(202,99,31,0.35)", color: "#ca631f", fontSize: 12.5, fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "0.01em" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(202,99,31,0.20)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(202,99,31,0.10)"; }}>
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

            // Entrées temporairement indisponibles (démo déployée) ou pages non
            // autorisées pour ce profil Admin+ : non cliquables, grisées.
            const nonAutorise = verrouillePour(item.href);
            if ((item.disabled && IS_DEPLOYED) || nonAutorise) {
              return (
                <div key={item.href} title={nonAutorise ? "Accès non autorisé pour votre profil" : "Indisponible"}
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
