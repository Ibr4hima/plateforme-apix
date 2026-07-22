"use client";

// Cluster « Recherche + Menu » réutilisable : dans la navbar (fond clair) ou
// dans un bandeau bleu de page (onDark). Le menu est un hub complet
// (Modules en flyout, Tableau de bord, Fiche Pays, Code, Lexique, Admin…).

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { AUTH_ENFORCED, moduleAutorise, nomAffiche, ROLE_LABELS } from "@/lib/authGate";
import { modules, PROTECTED_SLUGS } from "@/components/layout/navData";

// ── Ligne de menu (icône bleue + titre) — lien OU action ───────────────────────
const MENU_ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "6px 9px", borderRadius: 11, textDecoration: "none", transition: "background 0.12s", width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-google-sans)" };
const onEnterRow = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; };
const onLeaveRow = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "transparent"; };
function MenuIcone({ icon }: { icon: string }) {
  return (
    <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(0,79,145,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#004f91", fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>{icon}</span>
    </span>
  );
}
function MenuLien({ href, onNav, icon, titre, action }: { href?: string; onNav: () => void; icon: string; titre: string; action?: () => void }) {
  const label = <span style={{ fontSize: 13, fontWeight: 600, color: "#101a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</span>;
  if (action) {
    return (
      <button style={MENU_ROW} onMouseEnter={onEnterRow} onMouseLeave={onLeaveRow} onClick={() => { action(); onNav(); }}>
        <MenuIcone icon={icon} />{label}
      </button>
    );
  }
  return (
    <Link href={href!} onClick={onNav} style={MENU_ROW} onMouseEnter={onEnterRow} onMouseLeave={onLeaveRow}>
      <MenuIcone icon={icon} />{label}
    </Link>
  );
}

// ── Bouton circulaire (recherche / menu) ──────────────────────────────────────
function boutonStyle(onDark: boolean, actif: boolean): React.CSSProperties {
  if (onDark) {
    return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "1px solid", borderColor: actif ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.30)", background: actif ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.10)", cursor: "pointer", transition: "all 0.18s" };
  }
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: "1px solid", borderColor: actif ? "rgba(0,79,145,0.28)" : "rgba(0,79,145,0.18)", background: actif ? "rgba(0,79,145,0.07)" : "transparent", cursor: "pointer", transition: "all 0.18s" };
}

export default function NavActions({ onDark = false, flouFond = false }: { onDark?: boolean; flouFond?: boolean }) {
  const { data: session } = useSession();
  const [userOpen, setUserOpen] = useState(false);
  const [menuModsOpen, setMenuModsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; voile: number }>({ top: 0, right: 0, voile: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const userTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const visible = (href: string) => {
    const slug = PROTECTED_SLUGS[href];
    if (!slug) return true;
    if (!session) return true;
    return moduleAutorise(session, slug);
  };
  const isAdminRole = !AUTH_ENFORCED || ["admin", "admin_plus", "dev"].includes(session?.user?.role || "");
  const afficheNom = nomAffiche(session?.user?.prenom, session?.user?.nom, session?.user?.email);

  const majPos = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Bas du bandeau (section/header) : le voile ne floute que ce qui est en dessous
    const bandeau = btnRef.current?.closest("section, header")?.getBoundingClientRect();
    setPos({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right), voile: bandeau ? Math.max(0, bandeau.bottom) : r.bottom + 6 });
  };
  // Ouverture au survol ; fermeture quand on quitte le menu (grâce courte), au
  // clic-extérieur (voile) ou à Échap.
  const openUser  = () => { if (userTimeoutRef.current) clearTimeout(userTimeoutRef.current); majPos(); setUserOpen(true); };
  const closeUser = () => { userTimeoutRef.current = setTimeout(() => { setUserOpen(false); setMenuModsOpen(false); }, 180); };
  const fermer    = () => { if (userTimeoutRef.current) clearTimeout(userTimeoutRef.current); setUserOpen(false); setMenuModsOpen(false); };
  const openMods  = () => { if (modsTimeoutRef.current) clearTimeout(modsTimeoutRef.current); setMenuModsOpen(true); };
  const closeMods = () => { modsTimeoutRef.current = setTimeout(() => setMenuModsOpen(false), 150); };

  // Repositionne le panneau au défilement/redimensionnement, ferme à Échap
  useEffect(() => {
    if (!userOpen) return;
    const h = () => majPos();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); window.removeEventListener("keydown", onKey); };
  }, [userOpen]);

  const icoColor = onDark ? "#fff" : "#004f91";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {/* Recherche globale (⌘K) */}
      <button onClick={() => window.dispatchEvent(new Event("apix:recherche"))} title="Rechercher (Ctrl+K)" aria-label="Rechercher"
        style={boutonStyle(onDark, false)}
        onMouseEnter={e => { e.currentTarget.style.background = onDark ? "rgba(255,255,255,0.20)" : "rgba(0,79,145,0.07)"; e.currentTarget.style.borderColor = onDark ? "rgba(255,255,255,0.55)" : "rgba(0,79,145,0.28)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = onDark ? "rgba(255,255,255,0.10)" : "transparent"; e.currentTarget.style.borderColor = onDark ? "rgba(255,255,255,0.30)" : "rgba(0,79,145,0.18)"; }}>
        <span className="material-symbols-outlined" style={{ fontSize: 17, color: icoColor, fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>search</span>
      </button>

      {/* Menu hub (ouverture au survol / au clic) */}
      <div style={{ position: "relative" }} onMouseEnter={openUser} onMouseLeave={closeUser}>
        <button ref={btnRef} onClick={() => { majPos(); userOpen ? fermer() : setUserOpen(true); }} title="Menu" aria-label="Menu" style={boutonStyle(onDark, userOpen)}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: icoColor, fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>{userOpen ? "menu_open" : "menu"}</span>
        </button>
      </div>

      {/* Panneau du menu — via portal pour échapper à overflow/z-index du bandeau */}
      {mounted && userOpen && createPortal(
        <>
          <div onClick={fermer}
            style={{ position: "fixed", top: pos.voile, left: 0, right: 0, bottom: 0, zIndex: 1000, background: flouFond ? "rgba(16,26,46,0.16)" : "transparent", backdropFilter: flouFond ? "blur(4px)" : "none", WebkitBackdropFilter: flouFond ? "blur(4px)" : "none", animation: flouFond ? "apixFadeIn 0.18s ease" : "none" }} />
          <div className="apix-menu-pop" onMouseEnter={openUser} onMouseLeave={closeUser}
            style={{ position: "fixed", top: pos.top, right: pos.right, width: 280, background: "#fff", border: "1px solid rgba(16,26,46,0.08)", borderRadius: 16, padding: 7, boxShadow: "0 24px 64px rgba(16,26,46,0.22), 0 4px 12px rgba(16,26,46,0.10)", zIndex: 1001, transformOrigin: "top right" }}>

            {/* En-tête compte */}
            {session?.user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 9px 9px", borderBottom: "1px solid #F2F0EF", marginBottom: 4 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#004f91,#1a6ab0)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, textTransform: "uppercase" }}>
                  {(afficheNom || session.user.email || "?").trim().charAt(0)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#101a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom !== session.user.email ? afficheNom : session.user.email}</p>
                  <span style={{ display: "inline-flex", marginTop: 3, fontSize: 9, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "1px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: "4px 9px 7px", borderBottom: "1px solid #F2F0EF", marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", letterSpacing: "0.14em", textTransform: "uppercase" }}>Menu</span>
              </div>
            )}

            {/* Modules (sous-menu déployé à gauche au survol) */}
            <div style={{ position: "relative" }} onMouseEnter={openMods} onMouseLeave={closeMods}>
              <button style={{ ...MENU_ROW, background: menuModsOpen ? "rgba(0,79,145,0.07)" : "transparent" }} onMouseEnter={onEnterRow} onMouseLeave={e => { if (!menuModsOpen) onLeaveRow(e); }}
                onClick={() => setMenuModsOpen(o => !o)}>
                <MenuIcone icon="dashboard" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#101a2e", flex: 1 }}>Modules</span>
                <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0, transform: "rotate(90deg)" }} />
              </button>

              {menuModsOpen && (
                <>
                  {/* Pont invisible : comble l'espace entre la ligne et le flyout */}
                  <div onMouseEnter={openMods} style={{ position: "absolute", top: -8, right: "100%", width: 14, height: "calc(100% + 16px)" }} />
                <div className="apix-menu-fly" onMouseEnter={openMods} onMouseLeave={closeMods}
                  style={{ position: "absolute", top: -7, right: "calc(100% + 8px)", width: 258, background: "#fff", border: "1px solid rgba(16,26,46,0.08)", borderRadius: 16, padding: 7, boxShadow: "0 24px 64px rgba(16,26,46,0.16), 0 4px 12px rgba(16,26,46,0.06)", transformOrigin: "top right" }}>
                  <div style={{ padding: "4px 9px 7px", borderBottom: "1px solid #F2F0EF", marginBottom: 4 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", letterSpacing: "0.14em", textTransform: "uppercase" }}>Modules de données</span>
                  </div>
                  {modules.filter(m => visible(m.href)).map(m => (
                    <Link key={m.href} href={m.href} onClick={() => { setUserOpen(false); setMenuModsOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 10px", borderRadius: 10, textDecoration: "none", transition: "background 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 19, color: "#004f91", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" }}>{m.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#101a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
                    </Link>
                  ))}
                </div>
                </>
              )}
            </div>

            {/* Liens */}
            {visible("/tableau-de-bord") && (
              <MenuLien href="/tableau-de-bord" onNav={() => setUserOpen(false)} icon="analytics" titre="Tableau de bord" />
            )}
            <MenuLien action={() => window.dispatchEvent(new Event("apix:fiche-pays-picker"))} onNav={() => setUserOpen(false)} icon="flag" titre="Fiche Pays" />
            <MenuLien href="/code-investissements" onNav={() => setUserOpen(false)} icon="gavel" titre="Code des investissements" />
            <MenuLien href="/lexique" onNav={() => setUserOpen(false)} icon="language" titre="Lexique" />
            {isAdminRole && (
              <MenuLien href="/admin/evenements" onNav={() => setUserOpen(false)} icon="admin_panel_settings" titre="Page Admin" />
            )}

            <div style={{ borderTop: "1px solid #F2F0EF", margin: "5px 4px" }} />

            {session?.user ? (
              <button onClick={() => signOut({ callbackUrl: "/" })}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "6px 9px", borderRadius: 11, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "background 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(220,38,38,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#dc2626", fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20", lineHeight: 1 }}>logout</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>Se déconnecter</span>
              </button>
            ) : (
              <Link href="/login" onClick={() => setUserOpen(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", background: "#ca631f", textAlign: "center", textDecoration: "none", fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#b3551a"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#ca631f"; }}>
                Connexion
              </Link>
            )}
          </div>
        </>,
        document.body
      )}

      <style>{`
        .apix-menu-pop { animation: apixMenuPop 0.16s cubic-bezier(0.16,1,0.3,1); }
        @keyframes apixMenuPop { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .apix-menu-fly { animation: apixMenuFly 0.16s cubic-bezier(0.16,1,0.3,1); }
        @keyframes apixMenuFly { from { opacity: 0; transform: translateX(8px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes apixFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
