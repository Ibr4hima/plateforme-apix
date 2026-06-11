"use client";

import { ChevronLeft, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

const MIN_W     = 64;
const MAX_W     = 420;
const DEFAULT_W = 240;

export default function Sidebar() {
  const pathname   = usePathname();
  const [width,    setWidth]    = useState(DEFAULT_W);
  const [expanded, setExpanded] = useState(true);
  const isResizing  = useRef(false);
  const startX      = useRef(0);
  const startWidth  = useRef(DEFAULT_W);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current  = true;
    startX.current      = e.clientX;
    startWidth.current  = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startWidth.current + e.clientX - startX.current));
      setWidth(newW);
      setExpanded(newW > MIN_W + 20);
    };
    const onUp = () => {
      if (!isResizing.current) return;
      isResizing.current             = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const W = expanded ? width : MIN_W;

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
        transition: isResizing.current ? "none" : "width 0.18s cubic-bezier(.4,0,.2,1)",
      }}>

        {/* Logo + toggle */}
        <div style={{ padding: expanded ? "20px 16px 16px" : "20px 10px 16px", borderBottom: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {expanded && (
            <div style={{ overflow: "hidden", flexShrink: 0, minWidth: 0 }}>
              <Image src="/logo_apix.png" alt="APIX" width={90} height={32}
                style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Espace Administration
              </div>
            </div>
          )}
          <button
            onClick={() => { setExpanded(e => !e); if (expanded) setWidth(DEFAULT_W); }}
            style={{ background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", borderRadius: 8, padding: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.22)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
          >
            {expanded ? <ChevronLeft size={15} color="#fff" /> : <Menu size={15} color="#fff" />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: expanded ? "12px 10px" : "12px 8px" }}>
          {MODULES.map((item, i) => {
            if (item.type === "separator") {
              return <div key={i} style={{ margin: "8px 4px", borderTop: "1px solid rgba(255,255,255,0.12)" }} />;
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", display: "block", marginBottom: 4 }}>
                <div
                  title={!expanded ? item.label : undefined}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: expanded ? "flex-start" : "center",
                    width: "100%", padding: expanded ? "8px 14px" : "8px 0",
                    borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
                    fontSize: 12.5, fontWeight: isActive ? 700 : 400,
                    color:      isActive ? "#fff" : "rgba(255,255,255,0.55)",
                    background: isActive ? "rgba(255,255,255,0.2)"  : "rgba(255,255,255,0.06)",
                    outline:    isActive ? "1.5px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.12)",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; } }}
                >
                  {expanded ? item.label : item.label.charAt(0)}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {expanded && (
          <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
                ← Retour au site public
              </div>
            </Link>
          </div>
        )}

        {/* Bord redimensionnable */}
        <div
          onMouseDown={onMouseDown}
          style={{ position: "absolute", top: 0, right: 0, width: 5, height: "100%", cursor: "col-resize", zIndex: 10 }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(202,99,31,0.4)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        />
      </aside>

      {/* Spacer dynamique */}
      <div style={{ width: W, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.18s cubic-bezier(.4,0,.2,1)" }} />
    </>
  );
}
