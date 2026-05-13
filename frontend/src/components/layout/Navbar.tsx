"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";

const modules = [
  { label: "IDE",          href: "/ide",          desc: "Investissements Directs Étrangers" },
  { label: "Intentions",   href: "/intentions",   desc: "Intentions d'investissement" },
  { label: "Prospects",    href: "/prospects",    desc: "Prospects internationaux" },
  { label: "Entreprises",  href: "/entreprises",  desc: "Entreprises installées" },
  { label: "Zones",        href: "/zones",        desc: "Zones d'investissement" },
  { label: "Opportunités", href: "/opportunites", desc: "Opportunités sectorielles" },
  { label: "Accords",      href: "/accords",      desc: "Accords et traités" },
  { label: "Événements",   href: "/evenements",   desc: "Événements de promotion" },
];

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      transition: "all 0.4s ease",
      padding: scrolled ? "10px 0" : "18px 0",
      background: scrolled ? "rgba(242,240,239,0.94)" : "rgba(242,240,239,0.7)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: scrolled ? "1px solid #C5BFBB" : "1px solid transparent",
      boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.06)" : "none",
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <Image
            src="/logo_apix.png"
            alt="APIX Sénégal"
            width={120}
            height={44}
            style={{ height: 44, width: "auto", objectFit: "contain" }}
            priority
          />
        </Link>

        {/* Nav desktop */}
        <nav style={{ display: "flex", alignItems: "center", gap: 32 }}>

          {/* Dropdown Modules */}
          <div style={{ position: "relative" }}
            onMouseEnter={() => setModulesOpen(true)}
            onMouseLeave={() => setModulesOpen(false)}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              color: "#4a5568", background: "none", border: "none",
              cursor: "pointer", fontSize: 14, fontWeight: 500,
              fontFamily: "var(--font-body)", transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
              Modules
              <ChevronDown size={14} style={{
                transition: "transform 0.2s",
                transform: modulesOpen ? "rotate(180deg)" : "rotate(0)",
              }} />
            </button>

            {modulesOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 14px)",
                left: "50%", transform: "translateX(-50%)",
                width: 480,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(20px)",
                border: "1px solid #C5BFBB",
                borderRadius: 16, padding: 16,
                boxShadow: "0 16px 48px rgba(0,0,0,0.1)",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
              }}>
                {modules.map((m) => (
                  <Link key={m.href} href={m.href} style={{
                    display: "flex", flexDirection: "column",
                    padding: "10px 14px", borderRadius: 10,
                    textDecoration: "none", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#DEDAD7")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ color: "#9aa5b4", fontSize: 11, marginTop: 2 }}>{m.desc}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {[
            { label: "Carte",        href: "/carte"        },
            { label: "Opportunités", href: "/opportunites" },
            { label: "À propos",     href: "/about"        },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              color: "#4a5568", textDecoration: "none",
              fontSize: 14, fontWeight: 500, transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" style={{
            fontSize: 14, color: "#4a5568", textDecoration: "none",
            padding: "8px 16px", borderRadius: 10, transition: "color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4a5568")}>
            Connexion
          </Link>
          <Link href="/register" style={{
            fontSize: 14, fontWeight: 600, color: "#fff",
            background: "linear-gradient(135deg, #ca631f, #a84e18)",
            padding: "10px 20px", borderRadius: 12, textDecoration: "none",
            boxShadow: "0 4px 14px rgba(202,99,31,0.28)",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.04)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(202,99,31,0.4)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(202,99,31,0.28)";
          }}>
            Espace Investisseur
          </Link>
        </div>

        {/* Burger mobile */}
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          display: "none",
          background: "none", border: "none", cursor: "pointer",
          color: "#1a1a2e", padding: 8,
        }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div style={{
          margin: "8px 16px 0",
          background: "rgba(255,255,255,0.97)",
          border: "1px solid #C5BFBB",
          borderRadius: 16, padding: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        }}>
          {modules.map((m) => (
            <Link key={m.href} href={m.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block", padding: "10px 14px",
                color: "#4a5568", textDecoration: "none",
                fontSize: 14, borderRadius: 10,
              }}>
              {m.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid #C5BFBB", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/login" style={{ textAlign: "center", color: "#4a5568", textDecoration: "none", fontSize: 14, padding: "8px 0" }}>
              Connexion
            </Link>
            <Link href="/register" style={{
              textAlign: "center", fontSize: 14, fontWeight: 600, color: "#fff",
              background: "linear-gradient(135deg, #ca631f, #a84e18)",
              padding: "12px", borderRadius: 12, textDecoration: "none",
            }}>
              Espace Investisseur
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
