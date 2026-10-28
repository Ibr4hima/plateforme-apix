"use client";

// Barre latérale de l'espace d'administration — LA navigation de l'espace.
// Présente en permanence sur toutes les pages admin : la destination courante
// est toujours visible, et changer de module ne demande plus d'ouvrir un menu.
//
// ── À MÊME LE FOND, COMME DANS E-VOTING ──────────────────────────────────────
// Ni bandeau, ni colonne peinte : le menu s'écrit sur le fond de la page, comme
// le titre de l'écran. Seuls les blocs et les tableaux sont blancs — ce qui se
// lit — et la coquille, elle, se tait. En tête, le logo de l'APIX dans ses
// couleurs ; puis les pages, par familles ; au pied, le compte.
//
// Une rangée survolée prend un voile d'encre. La page ouverte prend le bleu
// pâle de la charte, le mot en bleu et son icône dans un rond plein : elle se
// repère de loin. L'orange ne sert qu'à SIGNER l'espace, d'un mot, à côté du
// logo.
//
// Repliable en rail d'icônes (état retenu d'une session à l'autre) pour rendre
// la largeur aux tableaux denses de l'administration. La bascule est une
// pastille posée SUR le bord droit, là où la main va quand on veut pousser ou
// tirer un panneau.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { AUTH_ENFORCED, nomAffiche, pageAdminAccessible, ROLE_LABELS } from "@/lib/authGate";
import { MODULES_ADMIN, IS_DEPLOYED } from "@/components/admin/navAdmin";

const LARGEUR = 264, RAIL = 72;
const CLE_ETAT = "apix.admin.nav.replie";

// Les pictogrammes de modules viennent de Material Symbols (police subsettée
// sur les glyphes de l'application). Les chevrons et le cadenas, eux, passent
// par lucide : hors du sous-ensemble, ils s'afficheraient en toutes lettres.
const Ico = ({ nom, taille = 17, rempli = 0 }: {
  nom: string; taille?: number; rempli?: number;
}) => (
  <span className="material-symbols-outlined" aria-hidden
    style={{ fontSize: taille, lineHeight: 1, fontVariationSettings: `'FILL' ${rempli}, 'wght' 400, 'GRAD' 0, 'opsz' 20` }}>{nom}</span>
);

const STYLE = `
.nav-admin { transition: width 0.24s cubic-bezier(0.16, 1, 0.3, 1); }

/* La rangée : l'icône tient dans une case ronde de 24 px — sur la page
   ouverte, elle passe dans un rond plein sans décaler le mot. */
.nav-lien { position: relative; display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; border-radius: 7px; text-decoration: none; border: none;
  background: transparent; width: 100%; cursor: pointer; text-align: left;
  font-family: inherit; font-size: 13px; font-weight: 500; color: var(--encre);
  transition: background-color 0.15s, color 0.15s; }
.nav-ico { flex: none; width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: 50%; color: var(--gris-fort); transition: color 0.15s; }
.nav-lien:hover { background: rgb(var(--encre-rgb) / 0.05); }
.nav-lien:hover .nav-ico { color: var(--encre); }
.nav-lien:focus-visible { outline: 2px solid rgb(var(--bleu-rgb) / 0.4); outline-offset: -2px; }
.nav-lien.actif { background: var(--bleu-voile); color: var(--bleu); font-weight: 600; }
.nav-lien.actif .nav-ico { background: var(--bleu-action); color: var(--sur-bleu); }

.nav-lien.bloque { opacity: 0.45; cursor: not-allowed; }
.nav-lien.bloque:hover { background: transparent; }
.nav-lien.bloque:hover .nav-ico { color: var(--gris-fort); }
.nav-txt { min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.nav-bascule { position: absolute; top: 25px; right: -13px; width: 26px; height: 26px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: var(--carte); border: 1px solid var(--bordure-forte); cursor: pointer;
  color: var(--gris-fort); box-shadow: var(--ombre-bouton-borde); padding: 0;
  transition: color 0.15s, border-color 0.15s; z-index: 2; }
.nav-bascule:hover { color: var(--encre); border-color: var(--gris); }
.nav-bascule:focus-visible { outline: 2px solid rgb(var(--bleu-rgb) / 0.4); outline-offset: 2px; }
`;

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
  const centre = replie ? "center" : undefined;

  return (
    <aside className={`nav-admin${replie ? " rail" : ""}`} aria-label="Navigation de l'administration"
      style={{ width: L, flexShrink: 0, height: "100vh", position: "sticky", top: 0, zIndex: 40,
        display: "flex", flexDirection: "column", fontFamily: "var(--font-google-sans)" }}>
      <style>{STYLE}</style>

      {/* ── En-tête : l'identité de l'espace, à la hauteur du titre de l'écran ── */}
      <div style={{ height: 76, flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
        padding: replie ? 0 : "0 12px 0 24px", justifyContent: centre }}>
        {replie ? (
          <Image src="/favicon-apix.png" alt="APIX" width={30} height={30} style={{ objectFit: "contain" }} />
        ) : (
          <>
            <Image src="/logo_apix.png" alt="APIX" width={120} height={40}
              style={{ height: 40, width: "auto", objectFit: "contain", flexShrink: 0 }} />
            {/* L'orange signe l'espace d'un mot : un badge, le mot en orange et
                le liseré de la même couleur. */}
            <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px",
              fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--orange-fonce)", background: "var(--carte)",
              border: "1px solid rgb(var(--orange-rgb) / 0.45)", borderRadius: 999, whiteSpace: "nowrap" }}>Admin</span>
          </>
        )}
      </div>

      <button onClick={basculer} className="nav-bascule" aria-expanded={!replie}
        aria-label={replie ? "Déplier le menu" : "Replier le menu"}
        title={replie ? "Déplier le menu" : "Replier le menu"}>
        {replie ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 12px 12px" }}>
        {MODULES_ADMIN.map((item, i) => {
          if (item.type === "section") {
            // En rail, l'intertitre n'a pas la place de s'écrire : il devient le
            // filet qui sépare les deux familles de modules.
            if (replie) {
              return <div key={`s${i}`} style={{ height: 1, background: "var(--bordure)",
                margin: i === 0 ? "2px 8px 8px" : "14px 8px 8px" }} />;
            }
            return (
              <p key={`s${i}`} style={{ margin: 0, padding: i === 0 ? "2px 10px 6px" : "18px 10px 6px",
                fontSize: 10, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.12em",
                textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {item.label}
              </p>
            );
          }

          const actif = pathname === item.href || pathname.startsWith(item.href + "/");
          const nonAutorise = verrouillee(item.href);
          const bloque = (item.disabled && IS_DEPLOYED) || nonAutorise;

          if (bloque) {
            return (
              <div key={item.href} className="nav-lien bloque"
                title={nonAutorise ? "Accès non autorisé pour votre profil" : "Indisponible"}
                style={{ marginBottom: 1, justifyContent: centre, userSelect: "none" }}>
                <span className="nav-ico"><Ico nom={item.icon} /></span>
                {!replie && <span className="nav-txt">{item.label}</span>}
                {!replie && <Lock size={12} style={{ color: "var(--gris)", flexShrink: 0 }} />}
              </div>
            );
          }

          return (
            // title systématique : deux libellés dépassent la largeur dépliée
            // (« Pôles & Zones d'investissement »), l'infobulle les restitue.
            <Link key={item.href} href={item.href} className={`nav-lien${actif ? " actif" : ""}`}
              title={item.label} aria-current={actif ? "page" : undefined}
              style={{ marginBottom: 1, justifyContent: centre }}>
              <span className="nav-ico"><Ico nom={item.icon} rempli={actif ? 1 : 0} /></span>
              {!replie && <span className="nav-txt">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Pied : compte, retour au site, déconnexion ── */}
      <div style={{ borderTop: "1px solid var(--bordure)", padding: "10px 12px 12px", flexShrink: 0 }}>
        {session?.user && (
          <div title={afficheNom}
            style={{ display: "flex", alignItems: "center", gap: 10,
              padding: replie ? "4px 0 10px" : "4px 8px 10px", justifyContent: centre }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              textTransform: "uppercase", color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.09)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>
              {(afficheNom || session.user.email || "?").trim().charAt(0)}
            </span>
            {!replie && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--encre)", lineHeight: 1.25,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--gris-fort)", lineHeight: 1.25,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}
                </p>
              </div>
            )}
          </div>
        )}

        <Link href="/" className="nav-lien" title="Page publique" style={{ justifyContent: centre }}>
          <span className="nav-ico"><Ico nom="public" /></span>
          {!replie && <span className="nav-txt">Page publique</span>}
        </Link>

        {(session?.user || AUTH_ENFORCED) && (
          <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-lien"
            title="Se déconnecter" style={{ justifyContent: centre }}>
            <span className="nav-ico"><Ico nom="logout" /></span>
            {!replie && <span className="nav-txt">Se déconnecter</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
