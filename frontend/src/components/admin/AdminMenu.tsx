"use client";

// Cluster d'actions du bandeau bleu de l'administration : bouton « page
// publique » + menu. Le menu remplace l'ancienne barre latérale : il porte
// toute la navigation de l'espace d'administration (Gestion des données,
// Référentiels), le compte connecté et la déconnexion.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { AUTH_ENFORCED, nomAffiche, pageAdminAccessible, ROLE_LABELS } from "@/lib/authGate";
import { MODULES_ADMIN, IS_DEPLOYED } from "@/components/admin/navAdmin";

// Bouton circulaire sur fond bleu (même gabarit que la navbar publique)
function boutonStyle(actif: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 36, height: 36, borderRadius: "50%", border: "1px solid",
    borderColor: actif ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.30)",
    background: actif ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.10)",
    cursor: "pointer", transition: "all 0.18s",
  };
}
const Ico = ({ nom, taille = 20, couleur = "#fff", rempli = 0 }: { nom: string; taille?: number; couleur?: string; rempli?: number }) => (
  <span className="material-symbols-outlined" style={{ fontSize: taille, color: couleur, fontVariationSettings: `'FILL' ${rempli}, 'wght' 500, 'GRAD' 0, 'opsz' 24`, lineHeight: 1, flexShrink: 0 }}>{nom}</span>
);

export default function AdminMenu() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0, voile: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const fermerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const majPos = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Le voile ne floute que ce qui est sous le bandeau bleu
    const bandeau = btnRef.current?.closest("section, header, [data-bandeau]")?.getBoundingClientRect();
    setPos({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right), voile: bandeau ? Math.max(0, bandeau.bottom) : r.bottom + 6 });
  };
  const ouvrir = () => { if (fermerTimer.current) clearTimeout(fermerTimer.current); majPos(); setOpen(true); };
  const fermerDiffere = () => { fermerTimer.current = setTimeout(() => setOpen(false), 180); };
  const fermer = () => { if (fermerTimer.current) clearTimeout(fermerTimer.current); setOpen(false); };

  // Suit le défilement / redimensionnement, ferme à Échap
  useEffect(() => {
    if (!open) return;
    const h = () => majPos();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const afficheNom = nomAffiche(session?.user?.prenom, session?.user?.nom, session?.user?.email);
  const verrouille = (href: string) => !pageAdminAccessible(session, href.replace("/admin/", ""));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {/* Page publique */}
      <Link href="/" title="Page publique" aria-label="Page publique"
        style={{ ...boutonStyle(false), textDecoration: "none" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.20)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)"; }}>
        <Ico nom="home_app_logo" taille={18} />
      </Link>

      {/* Menu d'administration (ouverture au survol ou au clic) */}
      <div style={{ position: "relative" }} onMouseEnter={ouvrir} onMouseLeave={fermerDiffere}>
        <button ref={btnRef} onClick={() => { majPos(); open ? fermer() : setOpen(true); }} title="Menu" aria-label="Menu" style={boutonStyle(open)}>
          <Ico nom={open ? "menu_open" : "menu"} />
        </button>
      </div>

      {/* Panneau — via portal pour échapper à l'overflow du bandeau */}
      {mounted && open && createPortal(
        <>
          <div onClick={fermer}
            style={{ position: "fixed", top: pos.voile, left: 0, right: 0, bottom: 0, zIndex: 1000, background: "rgba(16,26,46,0.16)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: "apixFadeIn 0.18s ease" }} />
          <div className="apix-menu-pop" onMouseEnter={ouvrir} onMouseLeave={fermerDiffere}
            style={{ position: "fixed", top: pos.top, right: pos.right, width: 300, maxHeight: "min(84vh, 860px)", display: "flex", flexDirection: "column", background: "#fff", border: "1px solid rgba(16,26,46,0.08)", borderRadius: 16, padding: 7, boxShadow: "0 24px 64px rgba(16,26,46,0.22), 0 4px 12px rgba(16,26,46,0.10)", zIndex: 1001, transformOrigin: "top right" }}>

            {/* En-tête compte */}
            {session?.user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 9px 9px", borderBottom: "1px solid #F2F0EF", marginBottom: 4, flexShrink: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#004f91,#1a6ab0)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, textTransform: "uppercase" }}>
                  {(afficheNom || session.user.email || "?").trim().charAt(0)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#101a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom !== session.user.email ? afficheNom : session.user.email}</p>
                  <span style={{ display: "inline-flex", marginTop: 3, fontSize: 9, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.10)", padding: "1px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: "4px 9px 7px", borderBottom: "1px solid #F2F0EF", marginBottom: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", letterSpacing: "0.14em", textTransform: "uppercase" }}>Espace administration</span>
              </div>
            )}

            {/* Navigation d'administration (remplace la barre latérale) */}
            <div style={{ overflowY: "auto", flex: 1, margin: "0 -3px", padding: "0 3px" }}>
              {MODULES_ADMIN.map((item, i) => {
                if (item.type === "section") {
                  return (
                    <div key={`s${i}`} style={{ display: "flex", alignItems: "center", gap: 7, padding: i === 0 ? "3px 9px 6px" : "12px 9px 6px" }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{item.label}</span>
                      <span style={{ flex: 1, height: 1, background: "#F2F0EF" }} />
                    </div>
                  );
                }
                const actif = pathname === item.href || pathname.startsWith(item.href + "/");
                const nonAutorise = verrouille(item.href);
                const bloque = (item.disabled && IS_DEPLOYED) || nonAutorise;
                if (bloque) {
                  return (
                    <div key={item.href} title={nonAutorise ? "Accès non autorisé pour votre profil" : "Indisponible"}
                      style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 10px", borderRadius: 10, opacity: 0.38, cursor: "not-allowed", userSelect: "none" }}>
                      <Ico nom={item.icon} taille={19} couleur="#9aa5b4" />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#9aa5b4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                    </div>
                  );
                }
                return (
                  <Link key={item.href} href={item.href} onClick={fermer}
                    style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "7px 10px", borderRadius: 10, textDecoration: "none", background: actif ? "rgba(0,79,145,0.08)" : "transparent", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!actif) e.currentTarget.style.background = "rgba(0,79,145,0.06)"; }}
                    onMouseLeave={e => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
                    {actif && <span style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: 999, background: "#ca631f" }} />}
                    <Ico nom={item.icon} taille={19} couleur="#004f91" rempli={actif ? 1 : 0} />
                    <span style={{ fontSize: 12.5, fontWeight: actif ? 700 : 500, color: "#101a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #F2F0EF", margin: "5px 4px 0", flexShrink: 0 }} />
            <Link href="/" onClick={fermer}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 10, textDecoration: "none", transition: "background 0.12s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <Ico nom="public" taille={19} couleur="#004f91" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#101a2e" }}>Page publique</span>
            </Link>
            {(session?.user || AUTH_ENFORCED) && (
              <button onClick={() => signOut({ callbackUrl: "/" })}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "background 0.12s", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <Ico nom="logout" taille={19} couleur="#dc2626" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#dc2626" }}>Se déconnecter</span>
              </button>
            )}
          </div>
        </>,
        document.body
      )}

      <style>{`
        .apix-menu-pop { animation: apixMenuPop 0.16s cubic-bezier(0.16,1,0.3,1); }
        @keyframes apixMenuPop { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes apixFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
