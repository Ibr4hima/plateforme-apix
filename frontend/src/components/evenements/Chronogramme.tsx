"use client";

import { useEffect, useRef, useState } from "react";

const TC: Record<string, string> = {
  forum: "#004f91", salon: "#ca631f", conference: "#7c3aed",
  mission_prospection: "#059669", roadshow: "#dc2626",
  b2b: "#d97706", webinaire: "#0891b2", visite_terrain: "#65a30d", autre: "#888",
};
const TL: Record<string, string> = {
  forum: "Forum", salon: "Salon", conference: "Conférence",
  mission_prospection: "Mission", roadshow: "Roadshow",
  b2b: "B2B", webinaire: "Webinaire", visite_terrain: "Terrain", autre: "Autre",
};
const MOIS_S = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const PX_PER_DAY = 6;
const PADDING = 80;

function daysInYear(y: number) {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
}
function dayOf(s: string, y: number) {
  const d = new Date(s);
  const st = new Date(y, 0, 1);
  return Math.max(0, Math.floor((d.getTime() - st.getTime()) / 86400000));
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateS(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function EventModal({ event, onClose }: { event: any; onClose: () => void }) {
  const color = TC[event.type_evenement] || "#888";
  const singleDay = event.date_debut === event.date_fin;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)", display: "flex",
        alignItems: "center", justifyContent: "center",
        zIndex: 999, padding: 20,
      }}
    >
      <div style={{
        background: "#FAFAF9", borderRadius: 16,
        border: "1px solid #C5BFBB", width: "100%", maxWidth: 460,
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ height: 4, background: color }} />
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <span style={{
                fontSize: 11, fontWeight: 700, color,
                background: `${color}18`, padding: "3px 10px",
                borderRadius: 999, display: "inline-block", marginBottom: 8,
              }}>
                {TL[event.type_evenement] || event.type_evenement}
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.3, fontFamily: "var(--font-display)" }}>
                {event.nom_event}
              </h3>
              {event.edition && (
                <span style={{ fontSize: 12, color: "#9aa5b4" }}>{event.edition}</span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: "#E8E5E3", border: "none", cursor: "pointer",
              borderRadius: 8, padding: "6px 8px", marginLeft: 12, flexShrink: 0,
            }}>
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4a5568" }}>
            <span style={{ color }}>📅</span>
            {singleDay ? fmtDate(event.date_debut) : `${fmtDate(event.date_debut)} — ${fmtDate(event.date_fin)}`}
          </div>
          {(event.ville || event.pays_nom) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4a5568" }}>
              <span style={{ color }}>📍</span>
              {[event.ville, event.pays_nom].filter(Boolean).join(", ")}
            </div>
          )}
          {event.organisateur && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4a5568" }}>
              <span style={{ color }}>🏢</span>
              {event.organisateur}
            </div>
          )}
          {event.description && (
            <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.65, marginTop: 4 }}>
              {event.description}
            </p>
          )}
          {event.thematiques && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Thématiques
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {event.thematiques.split(",").map((t: string, i: number) => (
                  <span key={i} style={{
                    fontSize: 11, color, background: `${color}12`,
                    padding: "3px 10px", borderRadius: 999,
                    border: `1px solid ${color}25`,
                  }}>
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {event.pays_invites && (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Pays invités
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {event.pays_invites.split(",").map((t: string, i: number) => (
                  <span key={i} style={{ fontSize: 11, color: "#4a5568", background: "#E8E5E3", padding: "3px 8px", borderRadius: 999 }}>
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
          {event.lien_site_officiel && (
            <a href={event.lien_site_officiel} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 12, background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              color: "#fff", fontWeight: 600, fontSize: 13,
              padding: "10px 20px", borderRadius: 12, textDecoration: "none",
            }}>
              Voir le site officiel →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Chronogramme({
  data,
  annee,
  typeFilter,
  onAnneChange,
  onTypeChange,
}: {
  data: Record<string, any[]>;
  annee: number;
  typeFilter: string;
  onAnneChange: (a: number) => void;
  onTypeChange: (t: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Aplatir les événements depuis data (groupé par mois)
  const allEvents: any[] = Object.values(data).flat();
  const filtered = allEvents.filter(e =>
    !typeFilter || e.type_evenement === typeFilter
  );
  const sorted = [...filtered].sort((a, b) => a.date_debut.localeCompare(b.date_debut));

  const days = daysInYear(annee);
  const totalW = days * PX_PER_DAY + PADDING * 2;

  // Drag to scroll
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      isDragging.current = true;
      startX.current = e.pageX - el.offsetLeft;
      scrollStart.current = el.scrollLeft;
      el.style.cursor = "grabbing";
    };
    const onUp = () => { isDragging.current = false; el.style.cursor = "grab"; };
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollStart.current - (x - startX.current);
    };
    el.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      el.removeEventListener("mousemove", onMove);
    };
  }, []);

  // Scroll vers aujourd'hui
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const today = new Date();
    if (today.getFullYear() === annee) {
      const td = dayOf(today.toISOString().slice(0, 10), annee);
      const tx = PADDING + td * PX_PER_DAY;
      setTimeout(() => { el.scrollLeft = Math.max(0, tx - 200); }, 100);
    } else {
      el.scrollLeft = 0;
    }
  }, [annee, data]);

  // Aujourd'hui
  const today = new Date();
  const todayPx = today.getFullYear() === annee
    ? PADDING + dayOf(today.toISOString().slice(0, 10), annee) * PX_PER_DAY
    : null;

  // Légende
  const types = [...new Set(sorted.map(e => e.type_evenement))];

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
            Frise chronologique
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", color: "#1a1a2e" }}>
            Calendrier {annee}
          </h2>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>
            Glissez la frise · Survolez ou cliquez pour les détails
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={annee}
            onChange={e => onAnneChange(parseInt(e.target.value))}
            style={{
              fontSize: 13, padding: "8px 12px", borderRadius: 10,
              border: "1px solid #C5BFBB", background: "#fff",
              color: "#1a1a2e", cursor: "pointer",
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => onTypeChange(e.target.value)}
            style={{
              fontSize: 13, padding: "8px 12px", borderRadius: 10,
              border: "1px solid #C5BFBB", background: "#fff",
              color: "#1a1a2e", cursor: "pointer",
            }}
          >
            <option value="">Tous les types</option>
            {Object.entries(TL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Frise */}
      <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 16, border: "1px solid #C5BFBB", background: "rgba(255,255,255,0.8)" }}>
        <div
          ref={scrollRef}
          style={{ overflowX: "auto", overflowY: "visible", cursor: "grab", padding: "90px 0 70px", scrollbarWidth: "none" }}
        >
          <div style={{ position: "relative", width: totalW, height: 200 }}>

            {/* Axe */}
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "#C5BFBB", transform: "translateY(-50%)" }} />
            <div style={{
              position: "absolute", top: "50%", right: 0,
              width: 0, height: 0,
              borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
              borderLeft: "8px solid #C5BFBB", transform: "translateY(-50%)",
            }} />

            {/* Ticks mois */}
            {Array.from({ length: 12 }, (_, m) => {
              const d = new Date(annee, m, 1);
              const day = dayOf(d.toISOString().slice(0, 10), annee);
              const x = PADDING + day * PX_PER_DAY;
              return (
                <div key={m} style={{ position: "absolute", left: x, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 1, height: 16, background: "#B8B1AC" }} />
                  <div style={{ fontSize: 10, color: "#9aa5b4", marginTop: 6, whiteSpace: "nowrap" }}>{MOIS_S[m]}</div>
                </div>
              );
            })}

            {/* Ligne aujourd'hui */}
            {todayPx !== null && (
              <div style={{ position: "absolute", left: todayPx, top: "calc(50% - 32px)", width: 2, height: 64, background: "#e24b4a", zIndex: 5 }}>
                <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#e24b4a", whiteSpace: "nowrap", fontWeight: 600 }}>
                  Auj.
                </div>
                <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#e24b4a" }} />
              </div>
            )}

            {/* Marqueurs événements */}
            {sorted.map((e, i) => {
              const d0 = dayOf(e.date_debut, annee);
              const x = PADDING + d0 * PX_PER_DAY;
              const isTop = i % 2 === 0;
              const color = TC[e.type_evenement] || "#888";
              const singleDay = e.date_debut === e.date_fin;
              const isHovered = hoveredId === e.id;
              const tags = e.thematiques ? e.thematiques.split(",").slice(0, 2) : [];

              return (
                <div
                  key={e.id}
                  style={{
                    position: "absolute", left: x, top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex", flexDirection: isTop ? "column-reverse" : "column",
                    alignItems: "center", cursor: "pointer", zIndex: isHovered ? 20 : 5,
                  }}
                  onMouseEnter={() => setHoveredId(e.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedEvent(e)}
                >
                  {/* Dot */}
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: color, border: "2.5px solid #fff",
                    boxShadow: `0 0 0 3px ${color}30`,
                    transform: isHovered ? "scale(1.5)" : "scale(1)",
                    transition: "transform 0.2s",
                    flexShrink: 0, zIndex: 2,
                  }} />

                  {/* Connecteur */}
                  <div style={{ width: 2, height: 52, background: "#C5BFBB", flexShrink: 0 }} />

                  {/* Card preview */}
                  <div style={{
                    position: "absolute",
                    ...(isTop ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
                    left: "50%",
                    transform: `translateX(-50%) translateY(${isHovered ? 0 : isTop ? 6 : -6}px)`,
                    opacity: isHovered ? 1 : 0,
                    pointerEvents: isHovered ? "auto" : "none",
                    transition: "opacity 0.2s, transform 0.2s",
                    width: 190,
                    background: "#fff",
                    border: "1px solid #C5BFBB",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 30,
                  }}>
                    <div style={{ height: 3, background: color }} />
                    <div style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: "2px 8px", borderRadius: 999, display: "inline-block", marginBottom: 6 }}>
                        {TL[e.type_evenement] || e.type_evenement}
                      </span>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.35, marginBottom: 5 }}>
                        {e.nom_event.length > 38 ? e.nom_event.slice(0, 38) + "…" : e.nom_event}
                      </div>
                      <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 2 }}>
                        📅 {singleDay ? fmtDateS(e.date_debut) : `${fmtDateS(e.date_debut)} → ${fmtDateS(e.date_fin)}`}
                      </div>
                      {e.ville && <div style={{ fontSize: 11, color, marginBottom: 6 }}>📍 {e.ville}</div>}
                      {tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                          {tags.map((t: string, ti: number) => (
                            <span key={ti} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "#E8E5E3", color: "#4a5568" }}>
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      <button style={{
                        width: "100%", fontSize: 11, padding: "6px",
                        borderRadius: 8, border: `1px solid ${color}40`,
                        background: `${color}10`, color, cursor: "pointer", fontWeight: 600,
                      }}>
                        Voir les détails →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Légende */}
      {types.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, padding: "0 4px" }}>
          {types.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#4a5568" }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: TC[t] || "#888" }} />
              {TL[t] || t}
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9aa5b4" }}>
            <div style={{ width: 20, height: 2, background: "#e24b4a" }} />
            Aujourd'hui
          </div>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#9aa5b4", fontSize: 14 }}>
          Aucun événement pour {annee}{typeFilter ? ` — ${TL[typeFilter]}` : ""}
        </div>
      )}

      {/* Modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
