"use client";

// Lexique de l'investissement — page pleine page dans le style du Code des
// investissements (bandeau dégradé, sommaire A-Z, recherche). Le contenu vient
// de src/lib/lexique.ts.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Search } from "lucide-react";
import { LEXIQUE } from "@/lib/lexique";

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LexiquePage() {
  const [q, setQ] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Termes filtrés (recherche), triés puis groupés par 1ʳᵉ lettre
  const { groupes, lettresPresentes } = useMemo(() => {
    const nq = norm(q.trim());
    const filtres = LEXIQUE
      .filter((t) => !nq || norm(t.terme).includes(nq) || norm(t.definition).includes(nq))
      .sort((a, b) => a.terme.localeCompare(b.terme, "fr"));
    const map = new Map<string, typeof filtres>();
    for (const t of filtres) {
      const L = norm(t.terme)[0]?.toUpperCase() || "#";
      const lettre = /[A-Z]/.test(L) ? L : "#";
      if (!map.has(lettre)) map.set(lettre, []);
      map.get(lettre)!.push(t);
    }
    return { groupes: [...map.entries()], lettresPresentes: new Set(map.keys()) };
  }, [q]);

  const total = groupes.reduce((s, [, arr]) => s + arr.length, 0);
  const goLettre = (L: string) => {
    const el = document.getElementById(`lettre-${L}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      <style>{`
        .lex-grille { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 760px) { .lex-grille { grid-template-columns: 1fr; } .lex-az { position: static !important; max-height: none !important; } }
        .lex-grille > * { min-width: 0; }
        .lex-az { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
        .lex-az::-webkit-scrollbar { width: 5px; }
        .lex-az::-webkit-scrollbar-thumb { background: #e4e0db; border-radius: 999px; }
      `}</style>

      {/* Bandeau */}
      <div style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "32px 40px 92px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
              <div style={{ width: 54, height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
                <Image src="/armoiries_senegal.svg" alt="Armoiries du Sénégal" width={54} height={66} style={{ height: 64, width: "auto", objectFit: "contain" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "2px 0 8px" }}>
                  APIX S.A
                </p>
                <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>Lexique de l&apos;investissement</h1>
              </div>
            </div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 18px 9px 12px", borderRadius: 999, background: "#fff", color: BLEU, fontSize: 12.5, fontWeight: 800, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={16} /> Accueil
            </Link>
          </div>

          {/* Recherche */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative", width: "min(300px, 100%)" }}>
              <Search size={14} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.6)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher un terme"
                style={{ width: "100%", background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "9px 14px 9px 38px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "rgba(255,255,255,0.20)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "rgba(255,255,255,0.13)"; }} />
            </div>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 80px" }}>
        <div className="lex-grille" style={{ marginTop: -52 }}>

          {/* Index A-Z — zone de défilement indépendante */}
          <aside className="ds-carte lex-az" style={{ position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)", padding: "14px 8px", alignSelf: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              {ALPHABET.map((L) => {
                const present = lettresPresentes.has(L);
                return (
                  <button key={L} onClick={() => present && goLettre(L)} disabled={!present}
                    style={{ width: 30, height: 26, borderRadius: 8, border: "none", background: "transparent", cursor: present ? "pointer" : "default",
                      fontSize: 12.5, fontWeight: 700, color: present ? BLEU : "#d7d3cf", fontFamily: "var(--font-google-sans)", transition: "background 0.12s" }}
                    onMouseEnter={(e) => { if (present) e.currentTarget.style.background = "#FBF8F5"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {L}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Termes */}
          <section ref={contentRef} className="ds-carte" style={{ padding: "36px 44px 48px", minHeight: 420 }}>
            {total === 0 ? (
              <p style={{ color: "#9aa5b4", fontSize: 14, textAlign: "center", marginTop: 60 }}>Aucun terme ne correspond à votre recherche.</p>
            ) : groupes.map(([lettre, termes]) => (
              <div key={lettre} id={`lettre-${lettre}`} style={{ scrollMarginTop: 20, marginBottom: 30 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 16px" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: ORANGE, lineHeight: 1, minWidth: 30 }}>{lettre}</span>
                  <div style={{ flex: 1, height: 1, background: "#EDEAE6" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {termes.map((t) => (
                    <div key={t.terme} style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "15px 18px" }}>
                      <div style={{ marginBottom: 7 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 700, color: ENCRE }}>{t.terme}</span>
                      </div>
                      <p style={{ fontSize: 13.5, color: "#4a5568", lineHeight: 1.7, margin: 0 }}>{t.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
