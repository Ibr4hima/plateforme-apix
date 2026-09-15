"use client";

// Barre latérale de l'espace d'administration — LA navigation de l'espace.
// Présente en permanence sur toutes les pages admin : la destination courante
// est toujours visible, et changer de module ne demande plus d'ouvrir un menu.
//
// ── POURQUOI UN BLEU PROFOND, ET PLUS UN FOND BLANC ──────────────────────────
// Une barre de navigation permanente n'est pas du contenu : c'est la COQUILLE
// de l'application. Rendue en blanc, elle avait le même poids visuel que les
// tableaux qu'elle borde — deux surfaces claires côte à côte, séparées par un
// simple filet, et l'œil devait chercher où finissait l'une et commençait
// l'autre. Un aplat profond la sort du plan du contenu : le regard sait
// d'emblée ce qui est « où je suis » et ce qui est « ce que je lis ».
//
// C'est aussi le bleu de la page publique — la coquille de la plateforme est
// bleue des deux côtés — et l'orange ne sert plus qu'à SIGNER l'administration :
// le cartouche « Admin », le liseré de la page courante, l'avatar du compte.
// Une couleur qui distingue un espace n'a pas à en peindre tout le fond.
//
// LES TEINTES SONT PRISES AUX JETONS `--bleu-profond` / `--bleu-nuit`, qui
// s'assombrissent encore en thème sombre au lieu de s'éclaircir. La barre reste
// donc une surface foncée dans les deux thèmes, ce qu'une coquille doit être ;
// le blanc des libellés (`--sur-bleu`) tient dans les deux cas.
//
// Repliable en rail d'icônes (état retenu d'une session à l'autre) pour rendre
// la largeur aux tableaux denses de l'administration. La bascule est passée du
// pied — où elle se cherchait — à une pastille posée SUR le bord droit, là où
// la main va quand on veut pousser ou tirer un panneau.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { AUTH_ENFORCED, nomAffiche, pageAdminAccessible, ROLE_LABELS } from "@/lib/authGate";
import { MODULES_ADMIN, IS_DEPLOYED } from "@/components/admin/navAdmin";

const LARGEUR = 264, RAIL = 74;
const CLE_ETAT = "apix.admin.nav.replie";

// Les pictogrammes de modules viennent de Material Symbols (police subsettée
// sur les glyphes de l'application). Les chevrons et le cadenas, eux, passent
// par lucide : hors du sous-ensemble, ils s'afficheraient en toutes lettres.
const Ico = ({ nom, taille = 19, rempli = 0 }: {
  nom: string; taille?: number; rempli?: number;
}) => (
  <span className="material-symbols-outlined" aria-hidden
    style={{ fontSize: taille, lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center",
      fontVariationSettings: `'FILL' ${rempli}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>{nom}</span>
);

export default function Sidebar() {
  const pathname = usePathname() || "";
  const { data: session } = useSession();
  const [replie, setReplie] = useState(false);
  // L'état est lu après le montage : le rendu serveur et le premier rendu
  // client restent identiques (pas d'écart d'hydratation).
  useEffect(() => { setReplie(localStorage.getItem(CLE_ETAT) === "1"); }, []);
  const basculer = () => setReplie(r => { localStorage.setItem(CLE_ETAT, r ? "0" : "1"); return !r; });

  const afficheNom = nomAffiche(session?.user?.prenom, session?.user?.nom, session?.user?.email);
  // Pages hors du périmètre du profil connecté (Admin : lecture seule sur un
  // sous-ensemble ; Admin+ : uniquement ses modules cochés).
  const verrouillee = (href: string) => !pageAdminAccessible(session, href.replace("/admin/", ""));

  const L = replie ? RAIL : LARGEUR;

  return (
    <aside className={`nav-admin${replie ? " rail" : ""}`} aria-label="Navigation de l'administration"
      style={{ width: L, flexShrink: 0, height: "100vh", position: "sticky", top: 0, zIndex: 40,
        display: "flex", flexDirection: "column", fontFamily: "var(--font-google-sans)" }}>

      <style>{`
        .nav-admin {
          /* Le dégradé descend au lieu de traverser : la barre est haute et
             étroite, un dégradé oblique y aurait viré au milieu d'un libellé.
             La lueur haute n'est pas un ornement — elle donne à l'en-tête le
             rang d'en-tête, sans avoir à y poser un filet de plus. */
          background:
            radial-gradient(130% 34% at 50% 0%, rgb(255 255 255 / 0.07), transparent 72%),
            /* CE VOILE N'EST PAS DE L'ORNEMENT. En thème sombre, le fond du
               contenu est lui-même un bleu-noir très proche de celui-ci : sans
               ce demi-point de clair, les deux plans se touchaient sans qu'on
               voie lequel portait l'autre. En thème clair il ne se remarque
               pas — le contraste y est déjà entier. */
            linear-gradient(0deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.035)),
            linear-gradient(180deg, var(--bleu-profond) 0%, var(--bleu-nuit) 55%, var(--bleu-profond) 100%);
          border-right: 1px solid rgb(255 255 255 / 0.10);
          box-shadow: 4px 0 24px rgb(0 0 0 / 0.10);
          transition: width 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* Le logo est encré sombre : sur une coquille foncée il faut le blanchir
           dans LES DEUX thèmes, là où la règle globale ne le fait qu'en sombre. */
        .nav-admin .logo-apix { filter: brightness(0) invert(1); }

        .nav-admin ::-webkit-scrollbar { width: 5px; }
        .nav-admin ::-webkit-scrollbar-track { background: transparent; }
        .nav-admin ::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.16); border-radius: 99px; }
        .nav-admin ::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.28); }

        .nav-lien { position: relative; display: flex; align-items: center; gap: 12px;
          padding: 9px 11px; border-radius: 10px; text-decoration: none; border: none;
          background: transparent; width: 100%; cursor: pointer; text-align: left;
          font-family: inherit; color: rgb(255 255 255 / 0.74);
          transition: background 0.14s, color 0.14s; }
        .nav-lien .material-symbols-outlined { color: rgb(255 255 255 / 0.56); transition: color 0.14s; }
        .nav-lien:hover { background: rgb(255 255 255 / 0.08); color: var(--sur-bleu); }
        .nav-lien:hover .material-symbols-outlined { color: var(--sur-bleu); }
        .nav-lien:focus-visible { outline: 2px solid rgb(255 255 255 / 0.65); outline-offset: 1px; }

        /* LA PAGE COURANTE EST UNE PASTILLE CLAIRE, pas un aplat orange. Sur
           fond profond, c'est le CONTRASTE qui désigne, et l'orange se réserve
           au liseré : il signe l'espace sans avoir à repeindre la ligne. */
        .nav-lien.actif { background: rgb(255 255 255 / 0.13); color: var(--sur-bleu);
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.10); }
        .nav-lien.actif .material-symbols-outlined { color: var(--sur-bleu); }

        .nav-lien.bloque { opacity: 0.34; cursor: not-allowed; }
        .nav-lien.bloque:hover { background: transparent; color: rgb(255 255 255 / 0.74); }
        .nav-lien.bloque:hover .material-symbols-outlined { color: rgb(255 255 255 / 0.56); }
        .nav-lien.sortie:hover { background: rgb(255 255 255 / 0.10); }
        .nav-txt { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* La bascule est posée SUR le bord droit, à cheval sur la barre et le
           contenu : c'est le geste qu'on cherche pour élargir un panneau, et il
           n'a plus à être lu dans une liste de liens. */
        .nav-bascule { position: absolute; top: 78px; right: -13px; width: 26px; height: 26px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: var(--carte); border: 1px solid var(--bordure-forte); cursor: pointer;
          color: var(--gris-fort); box-shadow: 0 2px 8px rgb(0 0 0 / 0.16); padding: 0;
          transition: color 0.14s, border-color 0.14s, transform 0.14s; z-index: 2; }
        .nav-bascule:hover { color: var(--orange); border-color: rgb(var(--orange-rgb) / 0.55);
          transform: scale(1.08); }
        .nav-bascule:focus-visible { outline: 2px solid rgb(var(--orange-rgb) / 0.6); outline-offset: 2px; }
      `}</style>

      {/* ── En-tête : l'identité de l'espace ── */}
      <div style={{ padding: replie ? "18px 8px 16px" : "20px 18px 16px",
        borderBottom: "1px solid rgb(255 255 255 / 0.09)", display: "flex", alignItems: "center",
        gap: 10, flexShrink: 0, justifyContent: replie ? "center" : undefined }}>
        {replie ? (
          <span title="Espace d'administration"
            style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "rgb(255 255 255 / 0.12)", border: "1px solid rgb(255 255 255 / 0.18)",
              color: "var(--sur-bleu)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13.5, fontWeight: 800 }}>A</span>
        ) : (
          <>
            <Image className="logo-apix" src="/logo_apix.png" alt="APIX" width={78} height={26}
              style={{ height: 26, width: "auto", objectFit: "contain", flexShrink: 0 }} />
            {/* L'ORANGE NE SERT PLUS QU'ICI, ou presque : il dit « espace
                d'administration » d'un mot, au lieu de teinter toute la barre. */}
            <span style={{ fontSize: 8.5, fontWeight: 800, color: "var(--sur-bleu)",
              letterSpacing: "0.16em", textTransform: "uppercase",
              background: "rgb(var(--orange-rgb) / 0.92)", padding: "3px 8px",
              borderRadius: 999, whiteSpace: "nowrap" }}>Admin</span>
          </>
        )}
      </div>

      <button onClick={basculer} className="nav-bascule" aria-expanded={!replie}
        aria-label={replie ? "Déplier le menu" : "Replier le menu"}
        title={replie ? "Déplier le menu" : "Replier le menu"}>
        {replie ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: replie ? "12px 12px 16px" : "12px 14px 16px" }}>
        {MODULES_ADMIN.map((item, i) => {
          if (item.type === "section") {
            // En rail, l'intertitre n'a pas la place de s'écrire : il devient le
            // filet de respiration qui sépare les deux familles de modules.
            if (replie) {
              return <div key={`s${i}`} style={{ height: 1, background: "rgb(255 255 255 / 0.12)",
                margin: i === 0 ? "2px 6px 10px" : "14px 6px 10px" }} />;
            }
            return (
              <div key={`s${i}`} style={{ display: "flex", alignItems: "center", gap: 9,
                padding: i === 0 ? "2px 11px 8px" : "20px 11px 8px" }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: "rgb(255 255 255 / 0.42)",
                  letterSpacing: "0.17em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
                <span style={{ flex: 1, height: 1, background: "rgb(255 255 255 / 0.10)" }} />
              </div>
            );
          }

          const actif = pathname === item.href || pathname.startsWith(item.href + "/");
          const nonAutorise = verrouillee(item.href);
          const bloque = (item.disabled && IS_DEPLOYED) || nonAutorise;

          if (bloque) {
            return (
              <div key={item.href} className="nav-lien bloque"
                title={nonAutorise ? "Accès non autorisé pour votre profil" : "Indisponible"}
                style={{ marginBottom: 3, justifyContent: replie ? "center" : undefined, userSelect: "none" }}>
                <Ico nom={item.icon} />
                {!replie && <span className="nav-txt" style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>}
                {!replie && <Lock size={12} style={{ color: "rgb(255 255 255 / 0.5)", flexShrink: 0 }} />}
              </div>
            );
          }

          return (
            // title systématique : deux libellés dépassent la largeur dépliée
            // (« Pôles & Zones d'investissement »), l'infobulle les restitue.
            <Link key={item.href} href={item.href} className={`nav-lien${actif ? " actif" : ""}`}
              title={item.label} aria-current={actif ? "page" : undefined}
              style={{ marginBottom: 3, justifyContent: replie ? "center" : undefined }}>
              {actif && (
                <span aria-hidden style={{ position: "absolute", left: 4, top: "50%",
                  transform: "translateY(-50%)", width: 3, height: 17, borderRadius: 999,
                  background: "rgb(var(--orange-rgb) / 1)" }} />
              )}
              <Ico nom={item.icon} rempli={actif ? 1 : 0} />
              {!replie && <span className="nav-txt" style={{ fontWeight: actif ? 700 : 500 }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Pied : compte, retour au site, déconnexion ── */}
      <div style={{ borderTop: "1px solid rgb(255 255 255 / 0.09)",
        padding: replie ? "10px 12px 12px" : "10px 14px 12px", flexShrink: 0 }}>
        {session?.user && (
          <div title={afficheNom}
            style={{ display: "flex", alignItems: "center", gap: 11,
              padding: replie ? "6px 0 10px" : "6px 9px 12px",
              justifyContent: replie ? "center" : undefined }}>
            <span style={{ width: 31, height: 31, borderRadius: "50%", flexShrink: 0,
              textTransform: "uppercase", color: "var(--sur-bleu)",
              background: "linear-gradient(135deg, var(--orange-action), var(--orange-fonce))",
              boxShadow: "0 0 0 1px rgb(255 255 255 / 0.16)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800 }}>
              {(afficheNom || session.user.email || "?").trim().charAt(0)}
            </span>
            {!replie && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--sur-bleu)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom}</p>
                <span style={{ display: "inline-flex", marginTop: 3, fontSize: 8.5, fontWeight: 800,
                  color: "rgb(255 255 255 / 0.72)", background: "rgb(255 255 255 / 0.12)",
                  padding: "2px 7px", borderRadius: 999, textTransform: "uppercase",
                  letterSpacing: "0.08em" }}>
                  {ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}
                </span>
              </div>
            )}
          </div>
        )}

        <Link href="/" className="nav-lien" title="Page publique"
          style={{ justifyContent: replie ? "center" : undefined }}>
          <Ico nom="public" />
          {!replie && <span className="nav-txt" style={{ fontWeight: 600 }}>Page publique</span>}
        </Link>

        {(session?.user || AUTH_ENFORCED) && (
          // La déconnexion ne se peint plus en rouge : sur fond profond, le
          // rouge de danger passe pour une alerte en cours plutôt que pour une
          // action possible. Elle garde sa place en dernier, ce qui suffit.
          <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-lien sortie"
            title="Se déconnecter" style={{ justifyContent: replie ? "center" : undefined }}>
            <Ico nom="logout" />
            {!replie && <span className="nav-txt" style={{ fontWeight: 600 }}>Se déconnecter</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
