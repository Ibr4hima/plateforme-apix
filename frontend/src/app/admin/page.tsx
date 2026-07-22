"use client";

import { useEffect, useState } from "react";
import { Calendar, FileText, Building2, TrendingUp, Target, Globe, MapPin, Lightbulb, ArrowRight } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

const MODULES = [
  { label: "Événements",   href: "/admin/evenements",   icon: Calendar,   color: "#004f91", apiKey: "evenements" },
  { label: "Accords",      href: "/admin/accords",      icon: FileText,   color: "#7c3aed", apiKey: "accords"    },
  { label: "Entreprises",  href: "/admin/entreprises",  icon: Building2,  color: "#ca631f", apiKey: "entreprises"},
  { label: "Zones",        href: "/admin/zones",        icon: MapPin,     color: "#059669", apiKey: null         },
  { label: "Opportunités", href: "/admin/opportunites", icon: Lightbulb,  color: "#d97706", apiKey: null         },
  { label: "IDE",          href: "/admin/ide",          icon: TrendingUp, color: "#dc2626", apiKey: null         },
  { label: "Intentions",   href: "/admin/intentions",   icon: Target,     color: "#0891b2", apiKey: null         },
  { label: "Prospects",    href: "/admin/prospects",    icon: Globe,      color: "#65a30d", apiKey: null         },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Charger les totaux disponibles
    Promise.all([
      api.evenements.liste("per_page=1").then(r => ({ evenements: r.total })).catch(() => ({ evenements: 0 })),
      api.accords.liste("per_page=1").then(r => ({ accords: r.total })).catch(() => ({ accords: 0 })),
      api.entreprises.liste("per_page=1").then(r => ({ entreprises: r.total })).catch(() => ({ entreprises: 0 })),
    ]).then(results => {
      const merged = Object.assign({}, ...results);
      setCounts(merged);
    });
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div style={{ padding: "40px 40px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 13, color: "#9aa5b4", marginBottom: 6 }}>
          {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 style={{
          fontFamily: "var(--font-google-sans)", fontWeight: 800,
          fontSize: "2rem", color: "#1a1a2e", marginBottom: 6,
        }}>
          {greeting} 👋
        </h1>
        <p style={{ color: "#4a5568", fontSize: 15 }}>
          Bienvenue dans l'espace d'administration de la plateforme APIX.
        </p>
      </div>

      {/* Stats rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
        {[
          { label: "Événements",  value: counts.evenements  ?? "—", color: "#004f91", icon: Calendar  },
          { label: "Accords",     value: counts.accords     ?? "—", color: "#7c3aed", icon: FileText  },
          { label: "Entreprises", value: counts.entreprises ?? "—", color: "#ca631f", icon: Building2 },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{
              background: "#fff", border: "1px solid #C5BFBB",
              borderRadius: 16, padding: "20px 24px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: s.color + "15",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: s.color }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "#9aa5b4" }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grille modules */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "#1a1a2e", marginBottom: 16 }}>
          Accès rapide aux modules
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {MODULES.map((m) => {
            const Icon = m.icon;
            const count = m.apiKey ? counts[m.apiKey] : null;
            return (
              <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#fff", border: "1px solid #C5BFBB",
                  borderRadius: 14, padding: "18px 20px",
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "all 0.2s", cursor: "pointer",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--ombre-2)";
                  e.currentTarget.style.borderColor = m.color;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#C5BFBB";
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: m.color + "15",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: m.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{m.label}</div>
                    {count !== null && (
                      <div style={{ fontSize: 11, color: "#9aa5b4" }}>{count} enregistrement{count > 1 ? "s" : ""}</div>
                    )}
                    {count === null && (
                      <div style={{ fontSize: 11, color: "#C5BFBB" }}>À venir</div>
                    )}
                  </div>
                  <ArrowRight size={14} style={{ color: "#C5BFBB" }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
