"use client";

// Assistant IA de la plateforme — bulle flottante + panneau de chat, monté
// globalement (voir Providers.tsx) donc présent sur toutes les pages. Répond en
// streaming ; connaît le contexte de la page courante pour « résume cette page ».
// Composant client pur (fetch + DOM), sans API Next spécifique.

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BLEU = "#004f91";
const DEGRADE = "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Résume cette page",
  "Top 5 des pays d'importation en 2025",
  "Quelle est la balance commerciale récente ?",
  "Explique le code des investissements",
];

// Rendu léger : gras **…**, listes « - », retours à la ligne conservés.
function formater(texte: string): React.ReactNode {
  return texte.split("\n").map((ligne, i) => {
    const puce = /^\s*[-•]\s+/.test(ligne);
    const contenu = ligne.replace(/^\s*[-•]\s+/, "");
    const morceaux = contenu.split(/(\*\*[^*]+\*\*)/g).map((m, j) =>
      m.startsWith("**") && m.endsWith("**") ? (
        <strong key={j}>{m.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{m}</span>
      ),
    );
    return (
      <div key={i} style={puce ? { display: "flex", gap: 6, paddingLeft: 2 } : undefined}>
        {puce && <span style={{ color: BLEU, flexShrink: 0 }}>•</span>}
        <span>{morceaux}</span>
      </div>
    );
  });
}

export default function ChatWidget() {
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Ouverture via l'entrée navbar (event window, comme apix:recherche).
  useEffect(() => {
    const ouvrir = () => setOuvert(true);
    window.addEventListener("apix:assistant", ouvrir);
    return () => window.removeEventListener("apix:assistant", ouvrir);
  }, []);

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

  function fermer() {
    abortRef.current?.abort();
    setOuvert(false);
  }

  return (
    <>
      {/* Lanceur : le logo Claude posé directement (sans bulle) */}
      {!ouvert && (
        <button
          onClick={() => setOuvert(true)}
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
            transition: "transform 0.18s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <LogoClaude size={48} />
        </button>
      )}

      {/* Panneau */}
      {ouvert && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: "min(400px, calc(100vw - 40px))",
            height: "min(620px, calc(100vh - 40px))",
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 20px 60px rgba(0,42,82,0.30)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid rgba(0,79,145,0.10)",
          }}
        >
          {/* En-tête */}
          <div
            style={{
              background: DEGRADE,
              color: "#fff",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <LogoClaude size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Assistant APIX</div>
              <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                Posez vos questions sur la plateforme
              </div>
            </div>
            <button
              onClick={fermer}
              aria-label="Fermer"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Fil de discussion */}
          <div
            ref={zoneRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#f7f9fc",
            }}
          >
            {messages.length === 0 && (
              <div style={{ margin: "auto 0", textAlign: "center", color: "#5b6b7d" }}>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                  Bonjour 👋 Je peux chercher dans les données de la plateforme —
                  commerce extérieur, IDE, accords, entreprises… ou résumer la
                  page que vous consultez.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => envoyer(s)}
                      style={{
                        textAlign: "left",
                        fontSize: 13,
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,79,145,0.16)",
                        background: "#fff",
                        color: BLEU,
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                  <div
                    style={{
                      background: BLEU,
                      color: "#fff",
                      padding: "9px 13px",
                      borderRadius: "14px 14px 4px 14px",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} style={{ alignSelf: "flex-start", maxWidth: "90%" }}>
                  <div
                    style={{
                      background: "#fff",
                      color: "#1a2733",
                      padding: "10px 13px",
                      borderRadius: "14px 14px 14px 4px",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      border: "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    {m.content ? (
                      formater(m.content)
                    ) : (
                      <Points />
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Saisie */}
          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.07)",
              padding: 10,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              background: "#fff",
            }}
          >
            <textarea
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
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13.5,
                fontFamily: "inherit",
                outline: "none",
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={() => envoyer()}
              disabled={enCours || !saisie.trim()}
              aria-label="Envoyer"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "none",
                background: enCours || !saisie.trim() ? "#c9d4e0" : BLEU,
                color: "#fff",
                cursor: enCours || !saisie.trim() ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconeEnvoi />
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

function IconeEnvoi() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-8-5 16-3-6-8-2z" fill="currentColor" />
    </svg>
  );
}

function Points() {
  return (
    <span style={{ display: "inline-flex", gap: 4, padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#9fb2c6",
            animation: "apixPulse 1s infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`@keyframes apixPulse{0%,60%,100%{opacity:.3}30%{opacity:1}}`}</style>
    </span>
  );
}
