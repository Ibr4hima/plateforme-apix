"use client";

// Lexique de l'investissement — page pleine page dans le style du Code des
// investissements (bandeau dégradé, recherche + index A-Z en pilules). Les
// termes sont stockés en base, édités depuis /admin/lexique et servis par
// l'API GET /lexique.

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Terme } from "@/lib/lexique";
import { Skeleton } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import BandeauDocument, { RechercheBandeau } from "@/components/shared/BandeauDocument";

import { API_BASE as API } from "@/lib/api";
const BLEU = "var(--bleu)", ORANGE = "var(--orange)", ENCRE = "var(--encre)";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LexiquePage() {
  const [q, setQ] = useState("");
  const [termes, setTermes] = useState<Terme[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);

  // En cas d'échec, état d'erreur avec relance plutôt qu'un « aucun terme »
  // trompeur.
  const charger = useCallback(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/lexique`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setTermes(Array.isArray(d) ? d : []))
      .catch(() => setErreur(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Termes filtrés (recherche), triés puis groupés par 1ʳᵉ lettre
  const { groupes, lettresPresentes } = useMemo(() => {
    const nq = norm(q.trim());
    const filtres = termes
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
  }, [q, termes]);

  const total = groupes.reduce((s, [, arr]) => s + arr.length, 0);
  const goLettre = (L: string) => {
    const el = document.getElementById(`lettre-${L}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, var(--champ))", minHeight: "100vh" }}>
      {/* Bandeau */}
      <BandeauDocument surtitre="APIX S.A — DIPE" titre={<>Lexique de l&apos;investissement</>}
        sousTitre={loading ? "Chargement…" : erreur ? "—" : `${termes.length} terme${termes.length > 1 ? "s" : ""} technique${termes.length > 1 ? "s" : ""} expliqué${termes.length > 1 ? "s" : ""}`}
        outils={<>
          <RechercheBandeau q={q} setQ={setQ} ariaLabel="Rechercher un terme" />
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 4, flex: 1, minWidth: 0, justifyContent: "space-between" }}>
            {ALPHABET.map((L) => {
              const present = lettresPresentes.has(L);
              return (
                <button key={L} onClick={() => present && goLettre(L)} disabled={!present}
                  aria-label={`Aller à ${L}`}
                  style={{ width: 27, height: 27, borderRadius: 999, border: "1px solid", cursor: present ? "pointer" : "default",
                    fontSize: 11.5, fontWeight: 800, fontFamily: "var(--font-google-sans)",
                    background: present ? "rgba(255,255,255,0.13)" : "transparent",
                    borderColor: present ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
                    color: present ? "var(--sur-bleu)" : "rgba(255,255,255,0.28)",
                    transition: "background 0.14s, border-color 0.14s", flexShrink: 0 }}
                  onMouseEnter={(e) => { if (present) { e.currentTarget.style.background = "var(--carte)"; e.currentTarget.style.color = BLEU; } }}
                  onMouseLeave={(e) => { if (present) { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.color = "var(--sur-bleu)"; } }}>
                  {L}
                </button>
              );
            })}
          </div>
        </>} />

      {/* Corps — pleine largeur */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 80px" }}>
        <section className="ds-carte" style={{ marginTop: -52, padding: "36px 44px 48px", minHeight: 420 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 12, padding: "15px 18px" }}>
                  <Skeleton w={`${30 + (i * 13) % 30}%`} h={14} r={6} style={{ marginBottom: 10 }} />
                  <Skeleton w="92%" h={10} r={5} style={{ marginBottom: 7 }} />
                  <Skeleton w="80%" h={10} r={5} />
                </div>
              ))}
            </div>
          ) : erreur ? (
            <ErreurChargement onRetry={charger} />
          ) : total === 0 ? (
            <p style={{ color: "var(--gris)", fontSize: 14, textAlign: "center", marginTop: 60 }}>
              {termes.length === 0 ? "Aucun terme n'est encore publié." : "Aucun terme ne correspond à votre recherche."}
            </p>
          ) : groupes.map(([lettre, arr]) => (
            <div key={lettre} id={`lettre-${lettre}`} style={{ scrollMarginTop: 20, marginBottom: 30 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 16px" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: ORANGE, lineHeight: 1, minWidth: 30 }}>{lettre}</span>
                <div style={{ flex: 1, height: 1, background: "var(--fond-creux2)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {arr.map((t) => (
                  <div key={t.id} style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 12, padding: "15px 18px" }}>
                    <div style={{ marginBottom: 7 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: ENCRE }}>{t.terme}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--texte)", lineHeight: 1.7, margin: 0 }}>{t.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
