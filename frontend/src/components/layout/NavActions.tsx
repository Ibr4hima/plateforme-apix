"use client";

// Cluster « Recherche + Menu » réutilisable : dans la navbar de l'accueil comme
// dans l'en-tête des pages. Le menu est un hub complet (Modules en flyout,
// Tableau de bord, Fiche Pays, Code, Lexique, Admin…).

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { AUTH_ENFORCED, moduleAutorise, nomAffiche, ROLE_LABELS } from "@/lib/authGate";
import { modules, PROTECTED_SLUGS } from "@/components/layout/navData";

// ── Ligne de menu (icône bleue + titre) — lien OU action ───────────────────────
// Les rangées du menu, comme celles du panneau de compte d'e-Voting : l'icône en
// gris, le mot à l'encre, un voile neutre au survol.
const MENU_ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, textDecoration: "none", transition: "background 0.12s", width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-google-sans)" };
const onEnterRow = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "var(--fond-creux)"; };
const onLeaveRow = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = "transparent"; };
function MenuIcone({ icon, couleur = "var(--gris-fort)" }: { icon: string; couleur?: string }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: 19, color: couleur, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" }}>{icon}</span>
  );
}
function MenuLien({ href, onNav, icon, titre, action }: { href?: string; onNav: () => void; icon: string; titre: string; action?: () => void }) {
  const label = <span style={{ fontSize: 13, fontWeight: 500, color: "var(--encre)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</span>;
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

// ── Bouton circulaire (accueil / recherche / menu) ────────────────────────────
//
// Les commandes d'en-tête de saas-rh : des ronds blancs cerclés d'un filet,
// comme les blocs qu'ils surplombent. Ronds, comme tout bouton d'icône ; un
// bouton qui porte un mot prend les coins des contrôles. Au repos, l'icône est
// grise — elle ne porte aucune information tant qu'on ne la sollicite pas — et
// fonce à l'encre au survol ; le menu ouvert prend le bleu des positions.
// La classe `nav-cmd` porte ce comportement en CSS (voir STYLE_NAV_CMD) —
// l'icône est un enfant, un gestionnaire JS ne saurait pas la recolorer.
export const CLASSE_CMD = "nav-cmd";
export const STYLE_NAV_CMD = `
.nav-cmd { color: var(--gris-fort); }
.nav-cmd .material-symbols-outlined { color: inherit; }
.nav-cmd:hover, .nav-cmd:focus-visible { color: var(--encre); border-color: var(--bordure-forte) !important; }
.nav-cmd[data-actif="1"] {
  color: var(--bleu);
  border-color: rgb(var(--bleu-rgb) / 0.3) !important;
  background: var(--bleu-voile) !important;
}`;

function boutonStyle(taille: number): React.CSSProperties {
  // `border-box` : la bordure d'un pixel est COMPRISE dans la taille demandée.
  // Sans elle, un bouton de 30 en mesure 32, et c'est lui qui fixe la hauteur
  // de la bande — on ne peut pas la caler au pixel sur celle d'à côté si le
  // plus haut de ses éléments dépasse sa cote de deux pixels.
  return { display: "inline-flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box", width: taille, height: taille, borderRadius: "50%",
    border: "1px solid var(--filet-carte)", background: "var(--carte)",
    boxShadow: "var(--ombre-bouton-borde)", cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s, background-color 0.15s" };
}

export default function NavActions({ flouFond = false, flouTotal = false, home = false, taille = 36 }: {
  flouFond?: boolean; flouTotal?: boolean; home?: boolean;
  /** Le diamètre des trois boutons ronds.
   *
   *  IL EST DEMANDÉ PAR L'APPELANT parce que la hauteur de la bande qui les
   *  porte en dépend : ce sont les plus hauts de leurs voisins, et c'est donc
   *  eux qui la fixent. La barre de titre des pages les a un temps réduits à
   *  30 pour se caler sur la bande d'onglets du dessous ; elle est revenue à
   *  la taille pleine, comme les en-têtes de rapport. */
  taille?: number;
}) {
  const flou = flouFond || flouTotal;
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
    const bandeau = btnRef.current?.closest("section, header, [data-bandeau]")?.getBoundingClientRect();
    setPos({ top: r.bottom + 10, right: Math.max(8, window.innerWidth - r.right), voile: flouTotal ? 0 : (bandeau ? Math.max(0, bandeau.bottom) : r.bottom + 6) });
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

  // L'icône hérite du bouton (classe nav-cmd) : c'est lui qui change de ton.
  const cmd = CLASSE_CMD;

  return (
    // `line-height: 0` : le conteneur ne garde pas la demi-ligne de texte que
    // ses boutons en ligne lui laissaient. Elle ne se voyait pas tant que la
    // bande était haute ; elle la faisait dépasser d'un demi-pixel dès qu'on a
    // voulu la caler au pixel sur la bande d'onglets.
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, lineHeight: 0 }}>
      {/* Accueil */}
      {home && (
        <Link href="/" title="Accueil" aria-label="Accueil" className={cmd} style={{ ...boutonStyle(taille), textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: Math.round(taille * 0.5), fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>home</span>
        </Link>
      )}
      {/* Recherche globale (⌘K) */}
      <button onClick={() => window.dispatchEvent(new Event("apix:recherche"))} title="Rechercher (Ctrl+K)" aria-label="Rechercher"
        className={cmd} style={boutonStyle(taille)}>
        <span className="material-symbols-outlined" style={{ fontSize: Math.round(taille * 0.47), fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>search</span>
      </button>

      {/* Menu hub (ouverture au survol / au clic). En flou total, le voile
          recouvre le bouton : on n'attache pas la fermeture au mouseleave du
          conteneur (sinon clignotement) — fermeture au clic-voile / Échap. */}
      <div style={{ position: "relative" }} onMouseEnter={openUser} onMouseLeave={flouTotal ? undefined : closeUser}>
        <button ref={btnRef} onClick={() => { majPos(); userOpen ? fermer() : setUserOpen(true); }} title="Menu" aria-label="Menu"
          className={cmd} data-actif={userOpen ? "1" : undefined} style={boutonStyle(taille)}>
          <span className="material-symbols-outlined" style={{ fontSize: Math.round(taille * 0.56), fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>{userOpen ? "menu_open" : "menu"}</span>
        </button>
      </div>

      {/* Panneau du menu — via portal pour échapper à overflow/z-index du bandeau */}
      {mounted && userOpen && createPortal(
        <>
          <div onClick={fermer}
            style={{ position: "fixed", top: pos.voile, left: 0, right: 0, bottom: 0, zIndex: 1000, background: flou ? "rgb(var(--encre-rgb) / 0.16)" : "transparent", backdropFilter: flou ? "blur(4px)" : "none", WebkitBackdropFilter: flou ? "blur(4px)" : "none", animation: flou ? "apixFadeIn 0.18s ease" : "none" }} />
          <div className="apix-menu-pop" onMouseEnter={openUser} onMouseLeave={closeUser}
            style={{ position: "fixed", top: pos.top, right: pos.right, width: 280, background: "var(--carte)", border: "1px solid var(--filet-carte)", borderRadius: 8, padding: 6, boxShadow: "var(--ombre-2)", zIndex: 1001, transformOrigin: "top right" }}>

            {/* En-tête compte */}
            {session?.user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 10px", borderBottom: "1px solid var(--filet)", marginBottom: 4 }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgb(var(--bleu-rgb) / 0.09)", color: "var(--bleu)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, textTransform: "uppercase" }}>
                  {(afficheNom || session.user.email || "?").trim().charAt(0)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom !== session.user.email ? afficheNom : session.user.email}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--gris-fort)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}</p>
                </div>
              </div>
            ) : (
              <div style={{ padding: "6px 10px 8px", borderBottom: "1px solid var(--filet)", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Menu</span>
              </div>
            )}

            {/* Modules (sous-menu déployé à gauche au survol) */}
            <div style={{ position: "relative" }} onMouseEnter={openMods} onMouseLeave={closeMods}>
              <button style={{ ...MENU_ROW, background: menuModsOpen ? "var(--fond-creux)" : "transparent" }} onMouseEnter={onEnterRow} onMouseLeave={e => { if (!menuModsOpen) onLeaveRow(e); }}
                onClick={() => setMenuModsOpen(o => !o)}>
                <MenuIcone icon="dashboard" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--encre)", flex: 1 }}>Modules</span>
                <ChevronDown size={14} style={{ color: "var(--gris)", flexShrink: 0, transform: "rotate(90deg)" }} />
              </button>

              {menuModsOpen && (
                <>
                  {/* Pont invisible : comble l'espace entre la ligne et le flyout */}
                  <div onMouseEnter={openMods} style={{ position: "absolute", top: -8, right: "100%", width: 14, height: "calc(100% + 16px)" }} />
                <div className="apix-menu-fly" onMouseEnter={openMods} onMouseLeave={closeMods}
                  style={{ position: "absolute", top: -7, right: "calc(100% + 8px)", width: 258, background: "var(--carte)", border: "1px solid var(--filet-carte)", borderRadius: 8, padding: 6, boxShadow: "var(--ombre-2)", transformOrigin: "top right" }}>
                  <div style={{ padding: "6px 10px 8px", borderBottom: "1px solid var(--filet)", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Modules de données</span>
                  </div>
                  {modules.filter(m => visible(m.href)).map(m => (
                    <Link key={m.href} href={m.href} onClick={() => { setUserOpen(false); setMenuModsOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 7, textDecoration: "none", transition: "background 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--fond-creux)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 19, color: "var(--gris-fort)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20", lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center" }}>{m.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--encre)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
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

            <div style={{ borderTop: "1px solid var(--filet)", margin: "4px 4px" }} />

            {session?.user ? (
              <button onClick={() => signOut({ callbackUrl: "/" })}
                style={{ ...MENU_ROW }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-voile)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <MenuIcone icon="logout" couleur="var(--danger)" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--danger)" }}>Se déconnecter</span>
              </button>
            ) : (
              <Link href="/login" onClick={() => setUserOpen(false)} className="ds-bouton ds-bouton--primaire"
                style={{ display: "flex", width: "100%", margin: "2px 0" }}>
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
