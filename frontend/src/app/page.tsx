"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Image from "next/image";
import {
  ArrowRight, TrendingUp, Building2, Globe,
  MapPin, Handshake, Calendar, Target, ChevronRight,
} from "lucide-react";
import Link from "next/link";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let start = 0;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 2000, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setCount(Math.floor(e * target));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      observer.disconnect();
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count.toLocaleString("fr-FR")}{suffix}</span>;
}

const stats = [
  { label: "Milliards USD d'IDE attirés",       value: 3,    suffix: "+ Md$" },
  { label: "Entreprises étrangères installées",  value: 1240, suffix: "+"    },
  { label: "Pays investisseurs partenaires",     value: 67,   suffix: ""     },
  { label: "Projets en cours de réalisation",    value: 184,  suffix: ""     },
];

const modules = [
  { icon: TrendingUp, label: "IDE",          desc: "Flux d'investissements directs entrants et sortants", href: "/ide",          accent: "#ca631f" },
  { icon: Target,     label: "Intentions",   desc: "Projets d'investissement à court et moyen terme",     href: "/intentions",   accent: "#004f91" },
  { icon: Globe,      label: "Prospects",    desc: "Portefeuille d'entreprises internationales ciblées",  href: "/prospects",    accent: "#ca631f" },
  { icon: Building2,  label: "Entreprises",  desc: "Cartographie des entreprises formalisées",            href: "/entreprises",  accent: "#004f91" },
  { icon: MapPin,     label: "Zones",        desc: "ZES, ZAI et pôles territoriaux",                      href: "/zones",        accent: "#ca631f" },
  { icon: ArrowRight, label: "Opportunités", desc: "Potentialités sectorielles à promouvoir",             href: "/opportunites", accent: "#004f91" },
  { icon: Handshake,  label: "Accords",      desc: "Traités bilatéraux et accords de coopération",        href: "/accords",      accent: "#ca631f" },
  { icon: Calendar,   label: "Événements",   desc: "Forums, salons et missions de prospection",           href: "/evenements",   accent: "#004f91" },
];

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF", overflowX: "hidden" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "96px 24px 48px",
        position: "relative", background: "#F2F0EF",
      }}>
        {/* Déco fond subtile */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "15%", right: "8%",
            width: 560, height: 560, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(202,99,31,0.07) 0%, transparent 65%)",
          }} />
          <div style={{
            position: "absolute", bottom: "15%", left: "5%",
            width: 440, height: 440, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,79,145,0.06) 0%, transparent 65%)",
          }} />
          <div style={{
            position: "absolute", inset: 0, opacity: 0.025,
            backgroundImage: "linear-gradient(#C5BFBB 1px, transparent 1px), linear-gradient(90deg, #C5BFBB 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>

        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative" }}>

          {/* Titre */}
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "clamp(2.6rem, 6vw, 4.75rem)",
            lineHeight: 1.04, letterSpacing: "-0.03em",
            color: "#1a1a2e", marginBottom: 24,
          }}>
            La Destination{" "}
            <span style={{
              background: "linear-gradient(135deg, #ca631f, #e8935a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Sénégal
            </span>
            <br />pour les Investisseurs
          </h1>

          <p style={{
            color: "#4a5568", fontSize: "1.15rem",
            maxWidth: 560, margin: "0 auto 40px",
            lineHeight: 1.75,
          }}>
            Données en temps réel sur les flux d'investissements, les opportunités
            sectorielles et le tissu économique du Sénégal.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link href="/opportunites" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #ca631f, #a84e18)",
              color: "#fff", fontWeight: 600, fontSize: 15,
              padding: "14px 28px", borderRadius: 14, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(202,99,31,0.32)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(202,99,31,0.42)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(202,99,31,0.32)";
            }}>
              Explorer les opportunités <ArrowRight size={17} />
            </Link>

            <Link href="/ide" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(12px)",
              color: "#1a1a2e", fontWeight: 600, fontSize: 15,
              padding: "14px 28px", borderRadius: 14, textDecoration: "none",
              border: "1px solid #C5BFBB",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)";
            }}>
              Tableau de bord IDE
              <ChevronRight size={17} style={{ color: "#9aa5b4" }} />
            </Link>
          </div>

          {/* Scroll indicator */}
          <div style={{
            marginTop: 72, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8, opacity: 0.3,
          }}>
            <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9aa5b4" }}>Défiler</span>
            <div style={{ width: 1, height: 44, background: "linear-gradient(to bottom, #ca631f, transparent)" }} />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: "56px 24px", background: "#E8E5E3" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(12px)",
              border: "1px solid #C5BFBB",
              borderRadius: 16, padding: "28px 24px", textAlign: "center",
              transition: "all 0.3s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.09)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: "2.25rem", color: "#ca631f", marginBottom: 8,
              }}>
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ color: "#9aa5b4", fontSize: 13, lineHeight: 1.45 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODULES ── */}
      <section style={{ padding: "80px 24px", background: "#F2F0EF" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Header */}
          <div style={{
            display: "flex", flexWrap: "wrap",
            justifyContent: "space-between", alignItems: "flex-end",
            gap: 24, marginBottom: 48,
          }}>
            <div>
              <p style={{
                color: "#ca631f", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10,
              }}>
                Modules de données
              </p>
              <h2 style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                color: "#1a1a2e", lineHeight: 1.15,
              }}>
                Une vue complète<br />de l'investissement
              </h2>
            </div>
            <p style={{ color: "#4a5568", maxWidth: 340, lineHeight: 1.65, fontSize: 15 }}>
              8 modules interconnectés pour couvrir l'intégralité du cycle de vie
              d'un investissement au Sénégal.
            </p>
          </div>

          {/* Grille */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}>
            {modules.map((m, i) => {
              const Icon = m.icon;
              return (
                <Link key={i} href={m.href} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "rgba(255,255,255,0.75)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid #C5BFBB",
                    borderRadius: 16, padding: "24px",
                    display: "flex", flexDirection: "column", gap: 16,
                    height: "100%", transition: "all 0.25s", cursor: "pointer",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.09)";
                    e.currentTarget.style.borderColor = m.accent;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "#C5BFBB";
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `${m.accent}14`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={19} style={{ color: m.accent }} />
                    </div>
                    <div>
                      <h3 style={{
                        fontFamily: "var(--font-display)", fontWeight: 700,
                        fontSize: 16, color: "#1a1a2e", marginBottom: 6,
                      }}>{m.label}</h3>
                      <p style={{ color: "#9aa5b4", fontSize: 13, lineHeight: 1.55 }}>{m.desc}</p>
                    </div>
                    <div style={{
                      marginTop: "auto", display: "flex", alignItems: "center",
                      gap: 4, fontSize: 12, color: m.accent, fontWeight: 600,
                    }}>
                      Explorer <ChevronRight size={13} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: "48px 24px 80px", background: "#E8E5E3" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(20px)",
            border: "1px solid #C5BFBB",
            borderRadius: 24,
            padding: "clamp(40px, 6vw, 64px)",
            textAlign: "center",
            position: "relative", overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
          }}>
            <div style={{
              position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
              width: 400, height: 200,
              background: "radial-gradient(ellipse, rgba(202,99,31,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <p style={{
              color: "#ca631f", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14,
            }}>
              Espace Investisseur
            </p>
            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              color: "#1a1a2e", marginBottom: 14, lineHeight: 1.2,
            }}>
              Vous avez un projet<br />d'investissement ?
            </h2>
            <p style={{
              color: "#4a5568", maxWidth: 460,
              margin: "0 auto 32px", lineHeight: 1.65,
            }}>
              Créez votre espace personnalisé, déposez vos intentions d'investissement
              et suivez l'avancement de vos projets avec les équipes APIX.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              <Link href="/register" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "linear-gradient(135deg, #ca631f, #a84e18)",
                color: "#fff", fontWeight: 600, fontSize: 15,
                padding: "14px 28px", borderRadius: 14, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(202,99,31,0.28)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(202,99,31,0.4)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(202,99,31,0.28)";
              }}>
                Créer mon espace <ArrowRight size={17} />
              </Link>
              <Link href="/contact" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.9)",
                color: "#1a1a2e", fontWeight: 600, fontSize: 15,
                padding: "14px 28px", borderRadius: 14, textDecoration: "none",
                border: "1px solid #C5BFBB",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}>
                Contacter l'APIX
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid #C5BFBB",
        padding: "32px 24px",
        background: "#E8E5E3",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <Image
            src="/logo_apix.png"
            alt="APIX Sénégal"
            width={100}
            height={36}
            style={{ height: 36, width: "auto", objectFit: "contain" }}
          />
          <p style={{ color: "#9aa5b4", fontSize: 12, textAlign: "center" }}>
            Agence Nationale chargée de la Promotion de l'Investissement et des Grands Travaux
          </p>
          <p style={{ color: "#9aa5b4", fontSize: 12 }}>© {new Date().getFullYear()} — DIPE</p>
        </div>
      </footer>
    </main>
  );
}
