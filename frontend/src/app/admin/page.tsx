"use client";

import { useEffect, useState } from "react";
import { Calendar, FileText, Building2, TrendingUp, Target, Globe, MapPin, Lightbulb, ArrowRight } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { voile } from "@/lib/couleurs";

const MODULES = [
  { label: "Événements",   href: "/admin/evenements",   icon: Calendar,   color: "var(--bleu)", apiKey: "evenements" },
  { label: "Accords",      href: "/admin/accords",      icon: FileText,   color: "var(--violet)", apiKey: "accords"    },
  { label: "Entreprises",  href: "/admin/entreprises",  icon: Building2,  color: "var(--orange)", apiKey: "entreprises"},
  { label: "Zones",        href: "/admin/zones",        icon: MapPin,     color: "var(--vert)", apiKey: null         },
  { label: "Opportunités", href: "/admin/opportunites", icon: Lightbulb,  color: "var(--orange)", apiKey: null         },
  { label: "IDE",          href: "/admin/ide",          icon: TrendingUp, color: "var(--danger)", apiKey: null         },
  { label: "Intentions",   href: "/admin/intentions",   icon: Target,     color: "var(--cyan)", apiKey: null         },
  { label: "Prospects",    href: "/admin/prospects",    icon: Globe,      color: "var(--alerte)", apiKey: null         },
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
        <p style={{ fontSize: 13, color: "var(--gris)", marginBottom: 6 }}>
          {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 style={{
          fontFamily: "var(--font-google-sans)", fontWeight: 800,
          fontSize: "2rem", color: "var(--encre)", marginBottom: 6,
        }}>
          {greeting} 👋
        </h1>
        <p style={{ color: "var(--texte)", fontSize: 15 }}>
          Bienvenue dans l'espace d'administration de la plateforme APIX.
        </p>
      </div>

      {/* Stats rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
        {[
          { label: "Événements",  value: counts.evenements  ?? "—", color: "var(--bleu)", icon: Calendar  },
          { label: "Accords",     value: counts.accords     ?? "—", color: "var(--violet)", icon: FileText  },
          { label: "Entreprises", value: counts.entreprises ?? "—", color: "var(--orange)", icon: Building2 },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{
              background: "var(--carte)", border: "1px solid var(--bordure-forte)",
              borderRadius: 16, padding: "20px 24px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: voile(s.color, 8),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "1.75rem", color: s.color }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "var(--gris)" }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grille modules */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 700, fontSize: "1.1rem", color: "var(--encre)", marginBottom: 16 }}>
          Accès rapide aux modules
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {MODULES.map((m) => {
            const Icon = m.icon;
            const count = m.apiKey ? counts[m.apiKey] : null;
            return (
              <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "var(--carte)", border: "1px solid var(--bordure-forte)",
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
                  e.currentTarget.style.borderColor = "var(--bordure-forte)";
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: voile(m.color, 8),
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: m.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--encre)" }}>{m.label}</div>
                    {count !== null && (
                      <div style={{ fontSize: 11, color: "var(--gris)" }}>{count} enregistrement{count > 1 ? "s" : ""}</div>
                    )}
                    {count === null && (
                      <div style={{ fontSize: 11, color: "var(--gris)" }}>À venir</div>
                    )}
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--gris)" }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
