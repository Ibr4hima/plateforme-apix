"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Building2 } from "lucide-react";
import { SkeletonCards } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { useListePaginee, useTemoinDeFin } from "@/lib/listePaginee";
import { useDebounced } from "@/lib/useDebounced";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { fmtPhone } from "@/lib/telephone";
import { badge_bleu, badge_vert, badge_rouge, badge_gris } from "@/lib/couleurs";
import { SideFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrlId } from "@/lib/ficheUrl";
import ProspectVueModal, { ilYa } from "@/components/shared/ProspectVueModal";

import { API_BASE } from "@/lib/api";

// ── Statuts : un seul mapping jeton + couleur, partagé par les cartes et le
// filtre. Trois copies vivaient dans ce fichier, dont deux recréées à chaque
// carte rendue.
const STATUT_BADGE: Record<string, React.CSSProperties> = {
  "En cours":             badge_vert,
  "À recontacter":        badge_bleu,
  "Installation à venir": badge_vert,
  "Inactif":              badge_rouge,
  "Décliné":              badge_gris,
  "En attente":           badge_gris,
};
const STATUT_COULEUR: Record<string, string> = {
  "En cours": "var(--vert)", "À recontacter": "var(--bleu)", "Installation à venir": "var(--vert)",
  "Inactif": "var(--danger)", "Décliné": "var(--gris)", "En attente": "var(--gris)",
};

type Onglet = "cibles" | "historique" | "termines";

/** Une carte telle que la renvoie /prospects/cartes : ses seuls champs. */
type CartePr = {
  id: number; nom: string; siege_nom: string | null; telephone: string | null; created_at: string | null;
  date_dernier_echange: string | null; issue: string | null; issue_conclu_le: string | null; statut: string | null;
};
type Facettes = {
  compteurs: Record<Onglet, number>;
  pays: { id: number; nom: string }[];
  secteurs: { id: number; nom: string }[];
};

/** Les identifiants des libellés cochés, dans l'ordre des options. */
const identifiants = (choisis: string[], options: { id: number; nom: string }[] = []) =>
  options.filter(o => choisis.includes(o.nom)).map(o => o.id);

// ── Carte prospect ────────────────────────────────────────────────────────────

function CarteProspect({ p, onglet, onOpen, onOpenInfos, onSurvol }: { p: CartePr; onglet: Onglet; onOpen?: () => void; onOpenInfos?: () => void; onSurvol?: () => void }) {
  // Le statut est calculé par le serveur, avec la règle de badgeProspect
  const badge = p.statut ? { label: p.statut } : null;
  const tel = p.telephone || "";
  // Second bloc libellé, contextuel selon l'onglet
  const info2 = onglet === "cibles"
    ? { label: "Téléphone", value: tel ? fmtPhone(tel) : null }
    : onglet === "historique"
    ? { label: "Dernier échange", value: p.date_dernier_echange ? fmtDate(p.date_dernier_echange) : null }
    : (p.issue === "installe"
        ? { label: "Accord conclu", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : p.issue === "decline"
        ? { label: "Décliné le", value: p.issue_conclu_le ? fmtDate(p.issue_conclu_le.slice(0, 10)) : null }
        : { label: "Conclusion", value: null });

  const badgeStatut = badge ? (STATUT_BADGE[badge.label] || badge_gris) : null;

  return (
    <div {...(onOpen ? carteCliquable(onOpen, `Ouvrir la fiche : ${p.nom}`) : {})}
      style={{ background: "var(--carte)", border: "1px solid var(--filet-carte)", borderRadius: 8, cursor: onOpen ? "pointer" : "default", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "var(--ombre-1)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}
      onMouseEnter={e => { onSurvol?.(); e.currentTarget.style.boxShadow = "var(--ombre-survol)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "var(--filet-carte-survol)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--ombre-1)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--filet-carte)"; }}>

      <div style={{ padding: "18px 20px 16px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 13 }}>
        {/* Dénomination + siège | badge de statut à droite */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--encre)", lineHeight: 1.35, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
            {(() => {
              const rel = onglet === "cibles" && p.created_at ? (() => {
                    const r = ilYa(p.created_at);
                    if (!r) return null;
                    return r === "Aujourd'hui" ? "Ciblé aujourd'hui" : `Ciblé depuis ${r.replace("Il y a ", "")}`;
                  })()
                : onglet === "historique" ? ilYa(p.date_dernier_echange)
                : onglet === "termines" && p.issue_conclu_le ? (() => {
                    const r = ilYa(p.issue_conclu_le);
                    if (!r) return null;
                    const suffixe = r === "Aujourd'hui" ? "aujourd'hui" : r.replace("Il y a", "il y a");
                    return `${p.issue === "decline" ? "Décliné" : "Conclu"} ${suffixe}`;
                  })()
                : null;
              const sousTitre = rel ?? p.siege_nom;
              return sousTitre && <div style={{ fontSize: 11, fontWeight: 500, color: "var(--gris)", marginTop: 3 }}>{sousTitre}</div>;
            })()}
          </div>
          {onglet !== "cibles" && badge && badgeStatut && (
            <span style={{ ...badgeStatut, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Infos en rangée épurée */}
        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--bordure)", paddingTop: 13, marginTop: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>Pays</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: p.siege_nom ? "var(--encre)" : "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.siege_nom || "—"}</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--fond)", margin: "0 18px" }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "var(--gris)", textTransform: "uppercase" as const, marginBottom: 4 }}>{info2.label}</p>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: info2.value ? "var(--encre)" : "var(--gris)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>{info2.value || "—"}</p>
          </div>
        </div>
      </div>

      {/* Actions (deux cibles de clic distinctes : la barre reste nécessaire) */}
      {(onglet === "historique" || onglet === "termines") && (
        <div style={{ display: "flex", borderTop: "1px solid var(--bordure)" }}>
          <div role="button" tabIndex={0}
            onKeyDown={ev => { ev.stopPropagation(); if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpenInfos?.(); } }}
            onClick={ev => { ev.stopPropagation(); onOpenInfos?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "var(--bleu)", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Infos investisseur
          </div>
          <div style={{ width: 1, background: "var(--fond)" }}/>
          <div role="button" tabIndex={0}
            onKeyDown={ev => { ev.stopPropagation(); if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen?.(); } }}
            onClick={ev => { ev.stopPropagation(); onOpen?.(); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", fontSize: 11.5, color: "var(--bleu)", fontWeight: 600, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
            Voir les échanges
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal fiche prospect (lecture seule) ──────────────────────────────────────

// ── Page principale ───────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const [onglet, setOnglet] = useEtatUrl<Onglet>("onglet", "cibles", ["cibles","historique","termines"]);

  // Filtres
  const [recherche,   setRecherche]   = useState("");
  const [paysSel,     setPaysSel]     = useState<string[]>([]);
  const [secteursSel, setSecteursSel] = useState<string[]>([]);
  const [statutSel,   setStatutSel]   = useState<string[]>([]);
  // La recherche part un quart de seconde après la dernière touche
  const rechercheEnvoyee = useDebounced(recherche.trim(), 250);

  // Statuts filtrables selon l'onglet (issus de badgeProspect) :
  // « en contact » → progression du cycle ; « transformés » → issue finale.
  const statutOpts = onglet === "historique"
    ? ["En cours", "À recontacter", "Inactif"]
    : onglet === "termines"
    ? ["Installation à venir", "Décliné"]
    : [];
  // Le jeu de statuts change d'un onglet à l'autre : on repart à zéro au switch.
  useEffect(() => { setStatutSel([]); }, [onglet]);

  // Ce que la page affiche hors des cartes : le nombre de prospects de chaque
  // onglet, et les pays et secteurs proposés aux filtres. Une requête, gardée
  // en cache le temps de la session.
  const qFacettes = useDonnees<Facettes>(`${API_BASE}/prospects/facettes`);
  const facettes = qFacettes.data;
  const paysOpts    = useMemo(() => (facettes?.pays ?? []).map(o => o.nom), [facettes]);
  const secteurOpts = useMemo(() => (facettes?.secteurs ?? []).map(o => o.nom), [facettes]);

  // Les cartes de l'onglet, trente par trente, filtres et recherche appliqués
  // par le serveur. Les pays et secteurs sont envoyés par identifiant : tant
  // que les options ne sont pas arrivées, rien n'est encore coché.
  const url = useMemo(() => {
    const p = new URLSearchParams({ onglet, par_page: "30" });
    if (rechercheEnvoyee) p.set("q", rechercheEnvoyee);
    const pays = identifiants(paysSel, facettes?.pays);
    const secteurs = identifiants(secteursSel, facettes?.secteurs);
    if (pays.length) p.set("pays", pays.join(","));
    if (secteurs.length) p.set("secteurs", secteurs.join(","));
    if (statutSel.length) p.set("statuts", statutSel.join(","));
    return `${API_BASE}/prospects/cartes?${p}`;
  }, [onglet, rechercheEnvoyee, paysSel, secteursSel, statutSel, facettes]);
  const liste = useListePaginee<CartePr>(url);
  const cartes = liste.elements;

  // Le panneau qui défile porte le témoin de bas de liste ; un autre onglet
  // ou un autre filtre repart du haut de la liste
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null);
  useEffect(() => { panneau?.scrollTo({ top: 0 }); }, [url, panneau]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;
  const temoin = useTemoinDeFin(() => { if (!isFetchingNextPage) fetchNextPage(); }, !!hasNextPage, panneau);

  // La fiche : chargée à l'ouverture (et dès le survol de sa carte), elle
  // seule porte les échanges, points focaux, contraintes et cycles
  const queryClient = useQueryClient();
  const urlFiche = (id: number | string) => `${API_BASE}/prospects/${id}`;
  const [selId, setSelId] = useState<string | null>(null);
  const [selecInfos, setSelecInfos] = useState(false);
  const qFiche = useDonnees<any>(selId != null ? urlFiche(selId) : null);
  const ouvrir = (id: number | string, infos: boolean) => { setSelecInfos(infos); setSelId(String(id)); };
  const prechargerFiche = (id: number) => { queryClient.prefetchQuery(requeteDonnees(urlFiche(id))); };
  // Ouverture directe depuis une adresse « ?fiche=<id> »
  useFicheUrlId(id => ouvrir(id, false));

  const togglePays    = (v: string) => setPaysSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleSecteur = (v: string) => setSecteursSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleStatut  = (v: string) => setStatutSel(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = !!recherche || paysSel.length > 0 || secteursSel.length > 0 || statutSel.length > 0;
  const reinit = () => { setRecherche(""); setPaysSel([]); setSecteursSel([]); setStatutSel([]); };
  const nbFiltres = (recherche ? 1 : 0) + paysSel.length + secteursSel.length + statutSel.length;
  const compteurs = facettes?.compteurs;

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* ── Hero ── */}
      <BarreTitre titre="Prospects" compact actions={<NavActions home flouFond/>}>
        <BarreTitreSegment options={[
          { v:"cibles",     l:"Investisseurs ciblés", count: compteurs?.cibles },
          { v:"historique", l: (compteurs?.historique ?? 0) === 1 ? "Investisseur en contact" : "Investisseurs en contact", count: compteurs?.historique },
          { v:"termines",   l: (compteurs?.termines ?? 0) === 1 ? "Investisseur transformé" : "Investisseurs transformés", count: compteurs?.termines },
        ]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* ── Corps : sidebar + grille ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
          recherche={recherche} setRecherche={setRecherche}>
              <div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} />
              {statutOpts.length > 0 && <><SideFilter label="Statut" color="var(--bleu)" colorOf={v => STATUT_COULEUR[v] || "var(--bleu)"} items={statutOpts} selected={statutSel} onToggle={toggleStatut} /><div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} /></>}
              {paysOpts.length > 0 && <SideFilter label="Pays / Siège" color="var(--bleu)" items={paysOpts} selected={paysSel} onToggle={togglePays} listMaxHeight={180} />}
              {secteurOpts.length > 0 && <><div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} /><SideFilter label="Secteur" color="var(--bleu)" items={secteurOpts} selected={secteursSel} onToggle={toggleSecteur} listMaxHeight={180} /></>}
        </PanneauFiltres>

        {/* Grille */}
        <div ref={setPanneau} style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "36px 40px 80px" }}>
          {liste.isPending ? (
            <SkeletonCards n={9} cols={3} height={200} />
          ) : liste.isError && !cartes.length ? (
            <ErreurChargement onRetry={() => liste.refetch()} />
          ) : cartes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--gris)" }}>
              <Building2 size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucun prospect trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
              {hasFilter && <BoutonEffacerFiltres onClick={reinit}/>}
            </div>
          ) : (
            <>
            {/* Pendant qu'un nouveau filtre charge, les cartes du précédent restent, estompées */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14,
              opacity: liste.isPlaceholderData ? 0.55 : 1, transition: "opacity 0.15s" }}>
              {cartes.map(p => <CarteProspect key={p.id} p={p} onglet={onglet} onSurvol={() => prechargerFiche(p.id)}
                onOpen={() => ouvrir(p.id, false)} onOpenInfos={() => ouvrir(p.id, true)} />)}
            </div>
            {/* La suite arrive au fil du défilement */}
            {hasNextPage && <div ref={temoin} style={{ height: 1 }} />}
            {isFetchingNextPage && <div style={{ marginTop: 14 }}><SkeletonCards n={3} cols={3} height={200} /></div>}
            {liste.isError && cartes.length > 0 && !isFetchingNextPage && (
              <div style={{ marginTop: 14 }}><ErreurChargement onRetry={() => fetchNextPage()} /></div>
            )}
            </>
          )}
        </div>
      </div>

      {selId != null && qFiche.data && <ProspectVueModal p={qFiche.data} onglet={selecInfos ? "cibles" : onglet} onClose={() => setSelId(null)} />}
    </main>
  );
}
