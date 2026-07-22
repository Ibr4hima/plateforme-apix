"use client";

// Assistant IA de la plateforme — lanceur (logo Claude) + panneau de chat,
// monté globalement (voir Providers.tsx) donc présent sur toutes les pages.
// Répond en streaming ; connaît le contexte de la page courante.
// Charte : orange APIX (#ca631f) en couleur principale.

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ORANGE = "#ca631f";
const ORANGE_FONCE = "#a34e15";
const DEGRADE = "linear-gradient(155deg,#8a4212 0%,#a85117 38%,#ca631f 72%,#e0803c 100%)";
const ENCRE = "#2b2018";

type Message = { role: "user" | "assistant"; content: string };

const ACCROCHES = [
  "Comment puis-je vous être utile ?",
  "Comment puis-je vous aider ?",
  "Dites-moi ce dont vous avez besoin.",
];

const salutation = () => {
  const h = new Date().getHours();
  return h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
};

// Rendu léger : gras **…**, listes « - », retours à la ligne conservés.
function formater(texte: string): React.ReactNode {
  return texte.split("\n").map((ligne, i) => {
    const puce = /^\s*[-•]\s+/.test(ligne);
    const contenu = ligne.replace(/^\s*[-•]\s+/, "");
    const morceaux = contenu.split(/(\*\*[^*]+\*\*)/g).map((m, j) =>
      m.startsWith("**") && m.endsWith("**") ? (
        <strong key={j} style={{ color: ENCRE }}>{m.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{m}</span>
      ),
    );
    return (
      <div key={i} style={puce ? { display: "flex", gap: 7, paddingLeft: 2 } : undefined}>
        {puce && <span style={{ color: ORANGE, flexShrink: 0, fontWeight: 700 }}>•</span>}
        <span>{morceaux}</span>
      </div>
    );
  });
}

export default function ChatWidget() {
  const [ouvert, setOuvert] = useState(false);
  const [sortie, setSortie] = useState(false); // animation de fermeture en cours
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [accueil, setAccueil] = useState({ titre: "Bonjour", accroche: ACCROCHES[0] });
  const zoneRef = useRef<HTMLDivElement>(null);
  const saisieRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function ouvrir() {
    // Accueil recalculé à chaque ouverture : Bonjour/Bonsoir + accroche au hasard
    setAccueil({
      titre: salutation(),
      accroche: ACCROCHES[Math.floor(Math.random() * ACCROCHES.length)],
    });
    setSortie(false);
    setOuvert(true);
  }

  function fermer() {
    abortRef.current?.abort();
    setSortie(true);
    window.setTimeout(() => { setOuvert(false); setSortie(false); }, 200);
  }

  // Ouverture via un éventuel event global (pattern apix:recherche).
  useEffect(() => {
    const h = () => ouvrir();
    window.addEventListener("apix:assistant", h);
    return () => window.removeEventListener("apix:assistant", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Échap ferme le panneau.
  useEffect(() => {
    if (!ouvert) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  // Focus sur la saisie à l'ouverture.
  useEffect(() => {
    if (ouvert && !sortie) window.setTimeout(() => saisieRef.current?.focus(), 220);
  }, [ouvert, sortie]);

  // Défilement automatique en bas à chaque nouveau fragment.
  useEffect(() => {
    if (zoneRef.current) zoneRef.current.scrollTop = zoneRef.current.scrollHeight;
  }, [messages, ouvert]);

  async function envoyer(texte?: string) {
    const question = (texte ?? saisie).trim();
    if (!question || enCours) return;
    setSaisie("");

    const historique = [...messages, { role: "user", content: question } as Message];
    setMessages([...historique, { role: "assistant", content: "" }]);
    setEnCours(true);

    const contexte_page =
      typeof document !== "undefined"
        ? `Page : ${document.title}\nURL : ${window.location.pathname}`
        : null;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          messages: historique.map((m) => ({ role: m.role, content: m.content })),
          contexte_page,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Erreur ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumule = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumule += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copie = [...prev];
          copie[copie.length - 1] = { role: "assistant", content: accumule };
          return copie;
        });
      }
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? ""
          : `⚠️ ${e instanceof Error ? e.message : "Une erreur est survenue."}`;
      if (msg) {
        setMessages((prev) => {
          const copie = [...prev];
          copie[copie.length - 1] = { role: "assistant", content: msg };
          return copie;
        });
      }
    } finally {
      setEnCours(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      <style>{`
        @keyframes apixChatIn {
          from { opacity: 0; transform: translateY(26px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes apixChatOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(22px) scale(0.95); }
        }
        @keyframes apixMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes apixAccueilIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes apixPulse { 0%,60%,100% { opacity: .25 } 30% { opacity: 1 } }
        @keyframes apixHalo {
          0%,100% { box-shadow: 0 0 0 0 rgba(202,99,31,0); }
          50%     { box-shadow: 0 0 0 7px rgba(202,99,31,0.08); }
        }
        .apix-chat-fil::-webkit-scrollbar { width: 5px; }
        .apix-chat-fil::-webkit-scrollbar-thumb { background: rgba(202,99,31,0.25); border-radius: 99px; }
        .apix-chat-fil::-webkit-scrollbar-track { background: transparent; }
        .apix-chat-saisie:focus {
          border-color: rgba(202,99,31,0.55) !important;
          box-shadow: 0 0 0 3px rgba(202,99,31,0.12);
        }
      `}</style>

      {/* Lanceur : le logo Claude posé directement (sans bulle) */}
      {!ouvert && (
        <button
          onClick={ouvrir}
          aria-label="Ouvrir l'assistant"
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            width: 52,
            height: 52,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.22))",
            transition: "transform 0.2s cubic-bezier(.34,1.56,.64,1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1) rotate(8deg)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) rotate(0deg)")}
        >
          <LogoClaude size={48} />
        </button>
      )}

      {/* Panneau */}
      {ouvert && (
        <div
          role="dialog"
          aria-label="Assistant IA"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: "min(410px, calc(100vw - 40px))",
            height: "min(600px, calc(100vh - 104px))",
            background: "#fff",
            borderRadius: 22,
            boxShadow: "0 24px 70px rgba(74,40,12,0.28), 0 4px 18px rgba(74,40,12,0.12)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid rgba(202,99,31,0.14)",
            animation: `${sortie ? "apixChatOut" : "apixChatIn"} 0.24s cubic-bezier(.32,.72,.28,1.05) both`,
            transformOrigin: "bottom right",
          }}
        >
          {/* En-tête */}
          <div
            style={{
              background: DEGRADE,
              color: "#fff",
              padding: "15px 16px",
              display: "flex",
              alignItems: "center",
              gap: 11,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
              }}
            >
              <LogoClaude size={23} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: "0.01em" }}>
                Assistant IA
              </div>
            </div>
            <button
              onClick={fermer}
              aria-label="Fermer (Échap)"
              title="Fermer (Échap)"
              style={{
                background: "rgba(255,255,255,0.16)",
                border: "none",
                color: "#fff",
                width: 30,
                height: 30,
                borderRadius: 9,
                cursor: "pointer",
                fontSize: 17,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.30)";
                e.currentTarget.style.transform = "rotate(90deg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.16)";
                e.currentTarget.style.transform = "rotate(0deg)";
              }}
            >
              ×
            </button>
          </div>

          {/* Fil de discussion */}
          <div
            ref={zoneRef}
            className="apix-chat-fil"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "linear-gradient(180deg,#fdfaf7 0%,#faf5f0 100%)",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  animation: "apixAccueilIn 0.5s cubic-bezier(.22,.9,.35,1) 0.12s both",
                }}
              >
                <div
                  style={{
                    width: 62,
                    height: 62,
                    margin: "0 auto 18px",
                    borderRadius: 20,
                    background: "linear-gradient(180deg, rgba(202,99,31,0.10), rgba(202,99,31,0.03))",
                    border: "1px solid rgba(202,99,31,0.16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "apixHalo 2.6s ease-in-out infinite",
                  }}
                >
                  <LogoClaude size={34} />
                </div>
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 700,
                    color: ENCRE,
                    letterSpacing: "-0.01em",
                    fontFamily: "var(--font-google-sans)",
                  }}
                >
                  {accueil.titre}
                </div>
                <div style={{ fontSize: 13.5, color: "#8a7563", marginTop: 6, lineHeight: 1.5 }}>
                  {accueil.accroche}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    animation: "apixMsgIn 0.25s ease-out both",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(180deg, rgba(202,99,31,0.12), rgba(202,99,31,0.05))",
                      color: ORANGE_FONCE,
                      padding: "10px 14px",
                      borderRadius: "16px 16px 5px 16px",
                      fontSize: 13.5,
                      fontWeight: 500,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      border: "1px solid rgba(202,99,31,0.20)",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    animation: "apixMsgIn 0.25s ease-out both",
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      color: "#3d3128",
                      padding: "11px 14px",
                      borderRadius: "16px 16px 16px 5px",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      border: "1px solid rgba(202,99,31,0.10)",
                      boxShadow: "0 2px 8px rgba(74,40,12,0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {m.content ? formater(m.content) : <Points />}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Saisie */}
          <div
            style={{
              borderTop: "1px solid rgba(202,99,31,0.10)",
              padding: 12,
              display: "flex",
              gap: 9,
              alignItems: "flex-end",
              background: "#fff",
            }}
          >
            <textarea
              ref={saisieRef}
              className="apix-chat-saisie"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer();
                }
              }}
              placeholder="Écrivez votre question…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                maxHeight: 110,
                border: "1px solid rgba(43,32,24,0.14)",
                borderRadius: 13,
                padding: "11px 13px",
                fontSize: 13.5,
                fontFamily: "inherit",
                outline: "none",
                lineHeight: 1.4,
                color: ENCRE,
                background: "#fdfbf9",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            <button
              onClick={() => envoyer()}
              disabled={enCours || !saisie.trim()}
              aria-label="Envoyer"
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                border: "none",
                background:
                  enCours || !saisie.trim()
                    ? "rgba(202,99,31,0.18)"
                    : `linear-gradient(150deg, ${ORANGE}, ${ORANGE_FONCE})`,
                color: "#fff",
                cursor: enCours || !saisie.trim() ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: enCours || !saisie.trim() ? "none" : "0 3px 10px rgba(202,99,31,0.32)",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                if (!enCours && saisie.trim()) e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 20,
                  color: enCours || !saisie.trim() ? "rgba(202,99,31,0.5)" : "#fff",
                  fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24",
                  lineHeight: 1,
                  transition: "color 0.18s",
                }}
              >
                send
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Logo Claude officiel (tracé de frontend/public/claude_icon.svg), teinté en
// orange APIX par défaut. `couleur` permet de surcharger la teinte.
const CLAUDE_PATH =
  "m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z";

export function LogoClaude({ size = 22, couleur = "#ca631f" }: { size?: number; couleur?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 -0.01 39.5 39.53" fill={couleur}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

function Points() {
  return (
    <span style={{ display: "inline-flex", gap: 4, padding: "3px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ORANGE,
            animation: "apixPulse 1s infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}
