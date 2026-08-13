"use client";

// Barre latérale de l'espace d'administration — LA navigation de l'espace.
// Présente en permanence sur toutes les pages admin : la destination courante
// est toujours visible, et changer de module ne demande plus d'ouvrir un menu.
//
// Parti pris visuel : fond clair et accent orange. L'orange signe l'espace
// d'administration (les bandeaux de page le sont aussi), le fond blanc et le
// filet #E8E5E3 reprennent la coquille des panneaux latéraux publics
// (PanneauFiltres) : les deux espaces se ressemblent, la couleur les distingue.
//
// Repliable en rail d'icônes (état retenu d'une session à l'autre) pour rendre
// la largeur aux tableaux denses de l'administration.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { AUTH_ENFORCED, nomAffiche, pageAdminAccessible, ROLE_LABELS } from "@/lib/authGate";
import { MODULES_ADMIN, IS_DEPLOYED } from "@/components/admin/navAdmin";

// Encre pour les libellés actifs, aplat pour le logo et le liseré : deux
// emplois qui ne se traduisent pas pareil la nuit.
const ORANGE = "var(--orange)";
const ORANGE_APLAT = "var(--orange-action)";
const LARGEUR = 254, RAIL = 68;
const CLE_ETAT = "apix.admin.nav.replie";

// Les pictogrammes de modules viennent de Material Symbols (police subsettée
// sur les glyphes de l'application). Les chevrons et le cadenas, eux, passent
// par lucide : hors du sous-ensemble, ils s'afficheraient en toutes lettres.
const Ico = ({ nom, taille = 19, couleur = "var(--gris-fort)", rempli = 0 }: {
  nom: string; taille?: number; couleur?: string; rempli?: number;
}) => (
  <span className="material-symbols-outlined" aria-hidden
    style={{ fontSize: taille, color: couleur, lineHeight: 1, flexShrink: 0, width: 22, textAlign: "center",
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
    <aside className="nav-admin" aria-label="Navigation de l'administration"
      style={{ width: L, flexShrink: 0, height: "100vh", position: "sticky", top: 0, zIndex: 40,
        background: "var(--carte)", borderRight: "1px solid var(--bordure-forte)", display: "flex", flexDirection: "column",
        transition: "width 0.22s cubic-bezier(0.16,1,0.3,1)", fontFamily: "var(--font-google-sans)" }}>

      <style>{`
        .nav-admin ::-webkit-scrollbar { width: 5px; }
        .nav-admin ::-webkit-scrollbar-track { background: transparent; }
        .nav-admin ::-webkit-scrollbar-thumb { background: var(--fond-creux2); border-radius: 99px; }
        .nav-admin ::-webkit-scrollbar-thumb:hover { background: var(--fond-creux2); }
        .nav-lien { position: relative; display: flex; align-items: center; gap: 11px; padding: 8px 10px;
          border-radius: 10px; text-decoration: none; border: none; background: transparent; width: 100%;
          cursor: pointer; text-align: left; font-family: inherit; color: var(--texte);
          transition: background 0.13s, color 0.13s; }
        .nav-lien:hover { background: var(--champ); color: var(--encre); }
        .nav-lien:focus-visible { outline: 2px solid rgb(var(--orange-rgb) / 0.55); outline-offset: 1px; }
        .nav-lien.actif { background: rgb(var(--orange-rgb) / 0.09); color: ${ORANGE}; }
        .nav-lien.bloque { opacity: 0.4; cursor: not-allowed; }
        .nav-lien.bloque:hover { background: transparent; color: var(--texte); }
        .nav-lien.rouge:hover { background: rgb(var(--danger-rgb) / 0.06); }
        .nav-txt { font-size: var(--t-125); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>

      {/* ── En-tête : identité de l'espace ── */}
      <div style={{ padding: replie ? "16px 8px 12px" : "18px 16px 14px", borderBottom: "1px solid var(--bordure)",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, justifyContent: replie ? "center" : undefined }}>
        {replie ? (
          <span title="Espace d'administration" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `linear-gradient(135deg,${ORANGE_APLAT},var(--orange-fonce))`, color: "var(--sur-bleu)", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "var(--t-13)", fontWeight: 800 }}>A</span>
        ) : (
          <>
            <Image className="logo-apix" src="/logo_apix.png" alt="APIX" width={78} height={26}
              style={{ height: 26, width: "auto", objectFit: "contain", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--t-85)", fontWeight: 800, color: ORANGE, letterSpacing: "0.16em",
              textTransform: "uppercase", background: "rgb(var(--orange-rgb) / 0.10)", padding: "3px 7px",
              borderRadius: 999, whiteSpace: "nowrap" }}>Admin</span>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: replie ? "10px 10px 14px" : "10px 12px 14px" }}>
        {MODULES_ADMIN.map((item, i) => {
          if (item.type === "section") {
            // En rail, les intertitres deviennent un simple filet de respiration
            if (replie) return <div key={`s${i}`} style={{ height: 1, background: "var(--fond)", margin: i === 0 ? "2px 6px 8px" : "12px 6px 8px" }} />;
            return (
              <div key={`s${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: i === 0 ? "2px 10px 7px" : "18px 10px 7px" }}>
                <span style={{ fontSize: "var(--t-9)", fontWeight: 800, color: "var(--gris)", letterSpacing: "0.15em",
                  textTransform: "uppercase", whiteSpace: "nowrap" }}>{item.label}</span>
                <span style={{ flex: 1, height: 1, background: "var(--fond)" }} />
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
                style={{ marginBottom: 2, justifyContent: replie ? "center" : undefined, userSelect: "none" }}>
                <Ico nom={item.icon} couleur="var(--gris)" />
                {!replie && <span className="nav-txt" style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>}
                {!replie && <Lock size={12} style={{ color: "var(--gris)", flexShrink: 0 }} />}
              </div>
            );
          }

          return (
            // title systématique : deux libellés dépassent la largeur dépliée
            // (« Pôles & Zones d'investissement »), l'infobulle les restitue.
            <Link key={item.href} href={item.href} className={`nav-lien${actif ? " actif" : ""}`}
              title={item.label} aria-current={actif ? "page" : undefined}
              style={{ marginBottom: 2, justifyContent: replie ? "center" : undefined }}>
              {actif && <span aria-hidden style={{ position: "absolute", left: replie ? 2 : -4, top: "50%",
                transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 999, background: ORANGE_APLAT }} />}
              <Ico nom={item.icon} couleur={actif ? ORANGE : "var(--gris-fort)"} rempli={actif ? 1 : 0} />
              {!replie && <span className="nav-txt" style={{ fontWeight: actif ? 700 : 500 }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Pied : compte, retour au site, déconnexion ── */}
      <div style={{ borderTop: "1px solid var(--bordure)", padding: replie ? "8px 10px 10px" : "8px 12px 10px", flexShrink: 0 }}>
        {session?.user && (
          <div title={afficheNom}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: replie ? "6px 0" : "6px 8px 10px",
              justifyContent: replie ? "center" : undefined }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, textTransform: "uppercase",
              background: `linear-gradient(135deg,${ORANGE_APLAT},var(--orange-fonce))`, color: "var(--sur-bleu)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: "var(--t-125)", fontWeight: 800 }}>
              {(afficheNom || session.user.email || "?").trim().charAt(0)}
            </span>
            {!replie && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "var(--t-12)", fontWeight: 700, color: "var(--encre)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{afficheNom}</p>
                <span style={{ display: "inline-flex", marginTop: 2, fontSize: "var(--t-85)", fontWeight: 800, color: ORANGE,
                  background: "rgb(var(--orange-rgb) / 0.10)", padding: "1px 6px", borderRadius: 999,
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {ROLE_LABELS[session.user.role || ""] || session.user.role || "—"}
                </span>
              </div>
            )}
          </div>
        )}

        <Link href="/" className="nav-lien" title={replie ? "Page publique" : undefined}
          style={{ justifyContent: replie ? "center" : undefined }}>
          <Ico nom="public" couleur="var(--bleu)" />
          {!replie && <span className="nav-txt" style={{ fontWeight: 600 }}>Page publique</span>}
        </Link>

        {(session?.user || AUTH_ENFORCED) && (
          <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-lien rouge"
            title={replie ? "Se déconnecter" : undefined} style={{ justifyContent: replie ? "center" : undefined }}>
            <Ico nom="logout" couleur="var(--danger)" />
            {!replie && <span className="nav-txt" style={{ fontWeight: 600, color: "var(--danger)" }}>Se déconnecter</span>}
          </button>
        )}

        <button onClick={basculer} className="nav-lien" aria-expanded={!replie}
          title={replie ? "Déplier le menu" : "Replier le menu"}
          style={{ marginTop: 2, justifyContent: replie ? "center" : undefined }}>
          <span style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            {replie ? <ChevronRight size={16} style={{ color: "var(--gris)" }} /> : <ChevronLeft size={16} style={{ color: "var(--gris)" }} />}
          </span>
          {!replie && <span className="nav-txt" style={{ fontWeight: 600, color: "var(--gris)" }}>Replier</span>}
        </button>
      </div>
    </aside>
  );
}
