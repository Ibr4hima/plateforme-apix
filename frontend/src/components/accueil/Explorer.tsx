"use client";

// Explorer la plateforme — le résumé de toutes les pages. Chaque module a sa
// carte : son nom et son chiffre du moment, lu dans les mêmes sources que la
// page elle-même. Les cartes se rangent en trois
// familles : investir, commercer, s'informer.
//
// LES PROSPECTS N'ONT PAS DE CHIFFRE. Le portefeuille est confidentiel :
// l'accueil n'en dit pas même le nombre, il en montre seulement l'entrée.
//
// Les modules protégés suivent la règle du menu : visibles sans session (la
// page demandera la connexion), masqués à une session qui n'y a pas droit.

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { ArrowUpRight, Lock } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import { fmtMFCFA } from "@/lib/format";
import { moduleAutorise } from "@/lib/authGate";
import { PROTECTED_SLUGS } from "@/components/layout/navData";
import { Skeleton } from "@/components/shared/Skeleton";
import { tableau, useCommerceExterieur } from "@/components/accueil/Vedette";
import { URL_PROJETS_SENEGAL, type ReponseProjets } from "@/components/accueil/Annonces";

type Chiffre = { valeur: string | null; legende: string; chargement: boolean };
type Module = {
  cle: string; titre: string; icone: string;
  href?: string; action?: () => void;
  chiffre: Chiffre | "confidentiel";
};

const nb = (v: unknown) => (typeof v === "number" && isFinite(v) ? v.toLocaleString("fr-FR") : null);
type Paginee = { total?: number } | unknown[];
type Chapitre = { articles?: unknown[]; sections?: { articles?: unknown[] }[] };
/** Le total d'une collection paginée ({ data, total }) ou d'une liste. */
const total = (v: Paginee | undefined): number | null =>
  v == null ? null : Array.isArray(v) ? v.length : typeof v.total === "number" ? v.total : null;

function CarteModule({ m }: { m: Module }) {
  const contenu = (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span className="acc-module-icone">
          <span className="material-symbols-outlined" aria-hidden
            style={{ fontSize: 20, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight: 1 }}>{m.icone}</span>
        </span>
        <ArrowUpRight size={16} className="acc-fleche" />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 750, color: "var(--encre)", margin: "16px 0 0", letterSpacing: "-0.01em" }}>{m.titre}</h3>
      <div className="acc-module-pied">
        {m.chiffre === "confidentiel" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--gris-fort)" }}>
            <Lock size={13} /> Données confidentielles
          </span>
        ) : m.chiffre.chargement ? (
          <Skeleton w={120} h={22} r={5} />
        ) : (
          // Le chiffre, puis sa légende dessous : la même forme sur toutes
          // les cartes, et les chiffres d'une rangée tombent au même niveau
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="acc-module-chiffre">{m.chiffre.valeur ?? "—"}</span>
            <span style={{ fontSize: 12.5, color: "var(--gris-fort)" }}>{m.chiffre.legende}</span>
          </span>
        )}
      </div>
    </>
  );
  return m.href
    ? <Link href={m.href} className="acc-module">{contenu}</Link>
    : <button onClick={m.action} className="acc-module" style={{ textAlign: "left" }}>{contenu}</button>;
}

export default function Explorer() {
  const { data: session } = useSession();
  const visible = (href?: string) => {
    const slug = href ? PROTECTED_SLUGS[href] : undefined;
    return !slug || !session || moduleAutorise(session, slug);
  };

  // Les comptes : une seule requête, celle du tableau de bord
  const qStats = useDonnees<Partial<Record<string, number>>>(`${API}/dashboard/stats`);
  const s = qStats.data ?? {};
  const stats = (cle: string, legende: string): Chiffre => ({ valeur: nb(s[cle]), legende, chargement: qStats.isPending });

  const qFdi = useDonnees<ReponseProjets>(URL_PROJETS_SENEGAL);
  const qProjets = useDonnees<Paginee>(`${API}/projets?page=1&per_page=1`);
  const qPotentialites = useDonnees<Paginee>(`${API}/opportunites/potentialites?page=1&per_page=1`);
  const commerce = useCommerceExterieur();
  const qPays = useDonnees<unknown[]>(`${API}/statistiques/pays`);
  const qLexique = useDonnees<unknown[]>(`${API}/lexique`);
  const qCode = useDonnees<Chapitre[]>(`${API}/code-investissement`);

  const nbArticles = useMemo(() => {
    const chapitres = tableau<Chapitre>(qCode.data);
    if (!chapitres.length) return null;
    return chapitres.reduce((n, c) => n + tableau(c.articles).length
      + tableau<{ articles?: unknown[] }>(c.sections).reduce((k, x) => k + tableau(x.articles).length, 0), 0);
  }, [qCode.data]);
  const exportsDernier = commerce.exports.at(-1) ?? null;
  const nbPotentialites = total(qPotentialites.data);

  const MODULES: Record<string, Module> = {
    ide: { cle: "ide", titre: "Investissements privés", icone: "finance_mode", href: "/ide",
      chiffre: { valeur: nb(qFdi.data?.kpis?.projets), chargement: qFdi.isPending,
        legende: `projets annoncés${qFdi.data?.kpis?.annees?.[0] ? ` depuis ${qFdi.data.kpis.annees[0]}` : ""}` } },
    opportunites: { cle: "opportunites", titre: "Opportunités d'investissement", icone: "bookmark_stacks", href: "/opportunites",
      chiffre: { valeur: nb(total(qProjets.data)), chargement: qProjets.isPending,
        legende: `projets à financer${nbPotentialites != null ? ` · ${nbPotentialites.toLocaleString("fr-FR")} potentialités` : ""}` } },
    zones: { cle: "zones", titre: "Zones d'investissement", icone: "real_estate_agent", href: "/zones",
      chiffre: stats("zones_total", s.poles_total ? `zones · ${s.poles_total} pôles territoriaux` : "zones") },
    entreprises: { cle: "entreprises", titre: "Entreprises installées", icone: "enterprise", href: "/entreprises",
      chiffre: stats("entreprises_total", "entreprises recensées") },

    echanges: { cle: "echanges", titre: "Échanges commerciaux", icone: "currency_exchange", href: "/statistiques",
      chiffre: { valeur: exportsDernier ? fmtMFCFA(exportsDernier.valeur) : null, chargement: commerce.chargement,
        legende: exportsDernier ? `d'exportations en ${exportsDernier.annee}` : "d'exportations" } },
    fiche: { cle: "fiche", titre: "Fiche Pays", icone: "flag",
      action: () => window.dispatchEvent(new Event("apix:fiche-pays-picker")),
      chiffre: { valeur: nb(tableau(qPays.data).length || null), legende: "pays à comparer", chargement: qPays.isPending } },
    accords: { cle: "accords", titre: "Accords & Traités", icone: "signature", href: "/accords",
      chiffre: stats("accords_vigueur", s.accords_total != null ? `en vigueur sur ${s.accords_total}` : "en vigueur") },
    prospects: { cle: "prospects", titre: "Prospects", icone: "frame_inspect", href: "/prospects",
      chiffre: "confidentiel" },

    evenements: { cle: "evenements", titre: "Événements", icone: "event", href: "/evenements",
      chiffre: stats("evenements_a_venir", s.evenements_total != null ? `à venir sur ${s.evenements_total}` : "à venir") },
    tableau: { cle: "tableau", titre: "Tableau de bord", icone: "analytics", href: "/tableau-de-bord",
      chiffre: { valeur: "6", legende: "rubriques sur une page", chargement: false } },
    lois: { cle: "lois", titre: "Lois & Règlementations", icone: "gavel", href: "/code-investissements",
      chiffre: { valeur: nb(nbArticles), legende: "articles du Code", chargement: qCode.isPending } },
    lexique: { cle: "lexique", titre: "Lexique", icone: "language", href: "/lexique",
      chiffre: { valeur: nb(tableau(qLexique.data).length || null), legende: "termes définis", chargement: qLexique.isPending } },
  };

  const FAMILLES: { titre: string; modules: string[] }[] = [
    { titre: "Investir au Sénégal", modules: ["ide", "opportunites", "zones", "entreprises"] },
    { titre: "Commerce et partenariats", modules: ["echanges", "fiche", "accords", "prospects"] },
    { titre: "Agenda et références", modules: ["evenements", "tableau", "lois", "lexique"] },
  ];

  return (
    <section className="acc-cadre acc-section" style={{ paddingBottom: 72 }}>
      <div className="acc-section-tete">
        <h2 className="acc-h2">Explorer la plateforme</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {FAMILLES.map(f => {
          const mods = f.modules.map(c => MODULES[c]).filter(m => visible(m.href));
          if (!mods.length) return null;
          return (
            <div key={f.titre}>
              <p className="acc-famille">{f.titre}</p>
              <div className="acc-modules">
                {mods.map(m => <CarteModule key={m.cle} m={m} />)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
