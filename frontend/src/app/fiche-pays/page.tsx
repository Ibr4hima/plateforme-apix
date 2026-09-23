"use client";

// Fiche Pays — page complète au format du rapport d'analyse : bandeau
// exécutif avec les deux sélecteurs de pays intégrés (on change les pays
// sans quitter la page), indicateurs comparés, contexte relationnel et
// échanges bilatéraux. Remplace l'ancienne fiche en modal.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, FileText, Landmark, Map as MapIcon, Scale, Ship, TrendingUp,
         Users } from "lucide-react";
import NavActions from "@/components/layout/NavActions";
import { SkeletonKPIs, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import AccordVueModal from "@/components/shared/AccordVueModal";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import { fmtUnite as fmt, fmtUSD } from "@/lib/format";
import { drapeauEmoji } from "@/lib/drapeaux";
import { fond_bleu, badge_bleu, badgeSurvol } from "@/lib/couleurs";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { carteCliquable } from "@/components/shared/PanneauFiltres";

import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";

const BLEU = "var(--bleu)", ORANGE = "var(--orange)", ENCRE = "var(--encre)";
const COULEURS = [BLEU, ORANGE];
const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

type Pays = { id: number; nom: string; code_iso3: string; code_iso2?: string | null; continent: string; region_geo: string | null };
type Indicateur = { code: string; libelle: string; unite: string; categorie: string };

// ── LES QUATRE LIGNES DE L'IDE ──────────────────────────────────────────────
// Flux et stock, entrant et sortant. Elles ne viennent pas du référentiel des
// indicateurs mais de la CNUCED, par un service à part : on les déclare donc
// ici, avec la catégorie qui les regroupe.
const CAT_IDE = "Investissements directs étrangers";
const IDE_LIGNES: Indicateur[] = [
  { code: "__ide_flux_entrant",  libelle: "Flux entrants",  unite: "USD", categorie: CAT_IDE },
  { code: "__ide_flux_sortant",  libelle: "Flux sortants",  unite: "USD", categorie: CAT_IDE },
  { code: "__ide_stock_entrant", libelle: "Stock entrant",  unite: "USD", categorie: CAT_IDE },
  { code: "__ide_stock_sortant", libelle: "Stock sortant",  unite: "USD", categorie: CAT_IDE },
];

// Ce que chaque ligne IDE veut dire, en une phrase : « flux » et « stock » ne se
// devinent pas, et la différence décide de la lecture — l'un est une année,
// l'autre une histoire.
const AIDE_IDE: Record<string, string> = {
  __ide_flux_entrant:  "Investissements étrangers reçus dans l'année",
  __ide_flux_sortant:  "Investissements réalisés à l'étranger dans l'année",
  __ide_stock_entrant: "Cumul des investissements étrangers détenus dans le pays",
  __ide_stock_sortant: "Cumul des investissements détenus à l'étranger",
};

// L'icône de chaque rubrique : un repère, pas une décoration. Une catégorie
// inconnue n'en a pas, et la rubrique reste lisible sans.
const ICONES_CAT: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  [CAT_IDE]: TrendingUp,
  "Démographie": Users,
  "Géographie": MapIcon,
  "Économie": Landmark,
  "Commerce extérieur": Ship,
};

/** Un rapport de grandeur écrit comme on le dit : « ×21 », « ×2,4 ». */
const fmtRatio = (r: number) =>
  `×${r >= 10 ? Math.round(r).toLocaleString("fr-FR") : r.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`;

type Cellule = { valeur: number | null; annee?: number } | null;

/** LE TABLEAU COMPARATIF — deux pays, ligne à ligne.

    IL NE DONNAIT QUE DEUX NOMBRES PAR LIGNE, et c'était au lecteur de faire la
    comparaison : 18,2 M hab. contre 68,4 M hab., 1,6 Md $ contre 43 Md $. Or la
    question qu'on pose à une fiche comparative n'est pas « combien », c'est
    « combien de fois plus ». Chaque ligne porte donc trois lectures :

      · LES DEUX VALEURS, chacune dans la teinte de son pays — bleu à gauche,
        orange à droite, comme les sélecteurs du bandeau ;
      · UNE BARRE EN PAPILLON qui part du centre vers chaque pays : la plus
        longue est celle du plus grand, et l'écart se voit avant de se lire ;
      · LE RAPPORT, « ×21 », dans la teinte de celui qui mène.

    LA BARRE ET LE RAPPORT NE S'AFFICHENT QUE LÀ OÙ ILS ONT UN SENS. Un rapport
    entre deux taux de croissance ne veut rien dire — on lit alors l'écart en
    POINTS. Un flux d'IDE négatif (un désinvestissement) ne se range pas sur une
    barre de longueur : la ligne garde ses deux valeurs et rien d'autre. La
    règle est tirée des valeurs elles-mêmes, pas d'une liste d'indicateurs : un
    indicateur ajouté demain la suit sans qu'on y touche.

    LE VERT ET LE ROUGE DISPARAISSENT. L'ancienne version colorait en vert la
    plus grande population et en ROUGE les plus fortes importations — un
    jugement de valeur que le tableau n'a pas à porter : importer n'est pas une
    faute, et un comité lit d'abord qui est devant. La teinte dit maintenant QUI,
    pas si c'est bien. */
function TableauComparatif({ cols, cats, parCat, getCell }: {
  cols: any[]; cats: string[]; parCat: Record<string, Indicateur[]>;
  getCell: (cid: number, code: string) => Cellule;
}) {
  const [a, b] = cols;
  if (!a) return null;
  const teinte = (i: number) => COULEURS[i % 2];

  return (
    <div className="fp-comparatif">
      {/* LA LIGNE SE DÉCRIT PAR ZONES NOMMÉES, et non par numéros de colonne :
          c'est ce qui lui permet de se replier sur deux étages en petit écran
          sans toucher au balisage. Sur un téléphone, cinq colonnes côte à côte
          réclamaient 487 px pour 286 disponibles ; le libellé monte alors au-
          dessus, les deux valeurs et l'écart se partagent la largeur, et la
          barre — qui ne tiendrait plus lisiblement — s'efface. */}
      <style>{`
        .fp-ligne { display: grid; align-items: center; column-gap: 18px;
          grid-template-columns: minmax(170px, 1.25fr) minmax(96px, 0.75fr) minmax(150px, 1fr) minmax(96px, 0.75fr) 64px;
          grid-template-areas: "lib a barre b ecart"; }
        .fp-lib { grid-area: lib; } .fp-a { grid-area: a; } .fp-barre { grid-area: barre; display: flex; }
        .fp-b { grid-area: b; } .fp-ratio { grid-area: ecart; display: flex; }
        @media (max-width: 860px) {
          .fp-ligne { column-gap: 12px; row-gap: 4px;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
            grid-template-areas: "lib lib lib" "a b ecart"; }
          .fp-barre { display: none; }
          .fp-entete .fp-lib { display: none; }
          .fp-entete { grid-template-areas: "a b ecart"; }
        }
      `}</style>

      {/* EN-TÊTE : les deux pays sur les colonnes de leurs valeurs, chacun dans
          sa teinte — la même que ses barres et que son sélecteur. */}
      <div className="fp-ligne fp-entete" style={{ padding: "0 12px 12px", borderBottom: "2px solid var(--bleu-voile)" }}>
        <span className="fp-lib" style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)",
          textTransform: "uppercase", letterSpacing: "0.08em" }}>Indicateur</span>
        {[a, b].map((c, i) => c && (
          <span key={c.id} className={i === 0 ? "fp-a" : "fp-b"} style={{ display: "inline-flex",
            alignItems: "center", gap: 7, justifyContent: i === 0 ? "flex-end" : "flex-start",
            fontSize: 12.5, fontWeight: 800, color: teinte(i), minWidth: 0 }}>
            <Drapeau iso={c.code_iso2} nom={c.nom} taille={15} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom}</span>
          </span>
        ))}
        <span className="fp-ratio" style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)",
          textTransform: "uppercase", letterSpacing: "0.08em", justifyContent: "flex-end" }}>Écart</span>
      </div>

      {cats.map(cat => {
        const Icone = ICONES_CAT[cat];
        return (
          <section key={cat} style={{ marginTop: 18 }}>
            {/* LA RUBRIQUE A SON PROPRE BANDEAU, et non plus une ligne de
                tableau déguisée en titre : l'icône la repère, le filet la
                sépare de la précédente. */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px 8px" }}>
              {Icone && (
                <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 7,
                  alignItems: "center", justifyContent: "center", background: "var(--bleu-voile)",
                  color: "var(--bleu)", flexShrink: 0 }}>
                  <Icone size={13} strokeWidth={2.2} />
                </span>
              )}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--bleu)",
                letterSpacing: "0.12em", textTransform: "uppercase" }}>{cat}</span>
              <span style={{ flex: 1, height: 1, background: "var(--filet)", marginLeft: 6 }} />
            </div>

            {parCat[cat].map((ind, ri) => {
              const ca = getCell(a.id, ind.code), cb = b ? getCell(b.id, ind.code) : null;
              const va = ca?.valeur ?? null, vb = cb?.valeur ?? null;
              const deux = va !== null && vb !== null;
              const taux = ind.unite === "%";
              // Une barre de LONGUEUR suppose deux grandeurs positives d'une
              // même nature : ni un taux, ni une valeur négative.
              const comparable = deux && !taux && va >= 0 && vb >= 0 && (va > 0 || vb > 0);
              const max = comparable ? Math.max(va, vb) : 0;
              const mene = deux && va !== vb ? (va > vb ? 0 : 1) : null;
              // Le rapport, quand il se calcule : deux valeurs strictement
              // positives. Sous 5 % d'écart, on dit « ≈ » plutôt que « ×1 ».
              let ecart: string | null = null;
              if (comparable && va > 0 && vb > 0) {
                const r = Math.max(va, vb) / Math.min(va, vb);
                ecart = r < 1.05 ? "≈" : fmtRatio(r);
              } else if (taux && deux) {
                const d = Math.abs(va - vb);
                ecart = d < 0.05 ? "≈" : `${d.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt`;
              }
              const valeur = (v: number | null, c: Cellule, i: number) => (
                <span className={i === 0 ? "fp-a" : "fp-b"} style={{ display: "flex", flexDirection: "column",
                  alignItems: i === 0 ? "flex-end" : "flex-start", minWidth: 0 }}>
                  <span className="ds-donnee" style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums",
                    fontWeight: mene === i ? 800 : 600,
                    color: v === null ? "var(--gris)" : mene === i ? teinte(i) : ENCRE }}>
                    {fmt(v, ind.unite, ind.code)}
                  </span>
                  {c?.annee && <span style={{ fontSize: 9.5, color: "var(--gris)",
                    fontVariantNumeric: "tabular-nums" }}>{c.annee}</span>}
                </span>
              );
              return (
                <div key={ind.code} className="fp-ligne" style={{ padding: "9px 12px",
                  borderRadius: 9, background: ri % 2 ? "rgb(var(--encre-rgb) / 0.022)" : "transparent" }}>
                  <span className="fp-lib" style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 650, color: ENCRE }}>{ind.libelle}</span>
                    {/* LE SOUS-TITRE N'EST PLUS L'UNITÉ : la valeur la porte
                        déjà — « 31 Md $ », « 18 M hab. » —, et « USD » écrit
                        sous le libellé ne faisait que la répéter. Il ne reste
                        que là où il apprend quelque chose : la définition des
                        quatre lignes de l'IDE, que leur nom ne suffit pas à
                        distinguer. */}
                    {AIDE_IDE[ind.code] && (
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--gris)", lineHeight: 1.4 }}>
                        {AIDE_IDE[ind.code]}
                      </span>
                    )}
                  </span>
                  {valeur(va, ca, 0)}
                  {/* LE PAPILLON : deux barres qui partent du centre, chacune
                      mesurée au plus grand des deux. Rien quand la ligne ne
                      s'y prête pas — la place reste, pour que les colonnes ne
                      bougent pas d'une ligne à l'autre. */}
                  <span className="fp-barre" style={{ alignItems: "center", gap: 3, height: 10 }}>
                    {comparable && [va, vb].map((v, i) => (
                      <span key={i} style={{ flex: 1, height: 8, display: "flex",
                        justifyContent: i === 0 ? "flex-end" : "flex-start",
                        background: "rgb(var(--encre-rgb) / 0.05)",
                        borderRadius: i === 0 ? "999px 2px 2px 999px" : "2px 999px 999px 2px" }}>
                        <span style={{ width: `${Math.max(v / max * 100, v > 0 ? 2 : 0)}%`, height: "100%",
                          background: teinte(i), opacity: mene === i ? 1 : 0.45,
                          borderRadius: i === 0 ? "999px 2px 2px 999px" : "2px 999px 999px 2px",
                          transition: "width .5s ease" }} />
                      </span>
                    ))}
                  </span>
                  {valeur(vb, cb, 1)}
                  <span className="fp-ratio" style={{ justifyContent: "flex-end" }}>
                    {ecart && (
                      <span title={mene !== null
                          ? `${[a, b][mene].nom} ${taux ? "devance de" : "mène d'un facteur"} ${ecart}` : "Valeurs quasi égales"}
                        style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                          padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
                          color: mene === null || ecart === "≈" ? "var(--gris-fort)" : teinte(mene),
                          background: mene === null || ecart === "≈" ? "var(--fond)"
                            : `color-mix(in srgb, ${teinte(mene)} 12%, transparent)` }}>
                        {ecart}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];

// Le composant partagé rend le globe pour les lignes sans code ISO ; ici on
// n'affiche rien du tout (sansIso="rien"), une fiche pays sans drapeau se
// passant d'ornement.
const Drapeau = ({ iso, nom, taille = 17 }: { iso?: string | null; nom: string; taille?: number }) => (
  <DrapeauPays iso={iso} nom={nom} taille={taille} sansIso="rien" />
);

// Sélecteur de pays du bandeau (verre dépoli sur fond sombre)
function SelectPays({ valeur, pays, exclure, onChange }: {
  valeur: number | null; pays: Pays[]; exclure: number | null; onChange: (id: number) => void;
}) {
  const parContinent = useMemo(() => {
    const g: Record<string, Pays[]> = {};
    pays.forEach(p => { (g[p.continent || "Autre"] ||= []).push(p); });
    Object.values(g).forEach(l => l.sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    return g;
  }, [pays]);
  return (
    <select value={valeur ?? ""} onChange={e => onChange(Number(e.target.value))}
      style={{ appearance: "none", padding: "8px 34px 8px 16px", borderRadius: 999, cursor: "pointer",
        background: `rgba(255,255,255,0.12) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23ffffff' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 14px center`,
        border: "1px solid rgba(255,255,255,0.28)", color: "var(--sur-bleu)", fontSize: 13, fontWeight: 700,
        fontFamily: "var(--font-google-sans)", outline: "none", maxWidth: 240, textOverflow: "ellipsis" }}>
      {[...Object.keys(parContinent)].sort((a, b) => {
        const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
        if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
      }).map(cont => (
        <optgroup key={cont} label={cont} style={{ color: "var(--encre)" }}>
          {parContinent[cont].map(p => {
            const emoji = drapeauEmoji(p.code_iso2);
            return (
              <option key={p.id} value={p.id} disabled={p.id === exclure} style={{ color: "var(--encre)" }}>
                {emoji ? `${emoji}  ${p.nom}` : p.nom}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

function ContenuFichePays() {
  const params = useSearchParams();
  const [ids, setIds] = useState<[number, number] | null>(null);
  const [accordOuvert, setAccordOuvert] = useState<any>(null);
  const [entOuverte, setEntOuverte] = useState<any>(null);

  // Toute la fiche vient du cache React Query, clé = le duo de pays : revenir
  // sur une comparaison déjà vue raffiche sans squelette. `garder` maintient le
  // tableau pendant qu'un nouveau duo charge.
  const qPays = useDonnees<Pays[]>(`${API}/statistiques/pays`);
  const pays = useMemo(() => qPays.data ?? [], [qPays.data]);
  const errPays = qPays.isError;

  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);
  useEffect(() => {
    if (!pays.length || ids) return;
    const brut = (params.get("pays") || "").split(",").map(Number).filter(n => pays.some(p => p.id === n));
    if (brut.length >= 2 && brut[0] !== brut[1]) { setIds([brut[0], brut[1]]); return; }
    const sen = pays.find(p => p.code_iso3 === "SEN")?.id ?? pays[0].id;
    const autre = brut.length === 1 && brut[0] !== sen ? brut[0] : (pays.find(p => p.id !== sen)?.id ?? sen);
    setIds([sen, autre]);
  }, [pays, ids, params]);

  // L'URL suit la sélection — F5 et lien partagé rouvrent le même duo.
  useEffect(() => {
    if (ids) window.history.replaceState(null, "", `/fiche-pays?pays=${ids.join(",")}`);
  }, [ids]);

  const qData = useDonnees<any>(ids ? `${API}/statistiques/comparaison?pays=${ids.join(",")}` : null, { garder: true });
  const data = ids ? qData.data ?? null : null;
  const errData = qData.isError;
  const qIdeFlux = useDonnees<any>(ids ? `${API}/statistiques/ide_flux?pays=${ids.join(",")}` : null, { garder: true });
  const ideFlux = ids ? (qIdeFlux.data ?? (qIdeFlux.isError ? {} : null)) : null;
  // LE STOCK À CÔTÉ DU FLUX. Le service savait le rendre depuis toujours
  // (`?indicateur=stock`), rien ne le demandait. Or les deux ne disent pas la
  // même chose : le flux est ce qui est entré CETTE ANNÉE — il peut être
  // négatif, et varie du simple au décuple d'un millésime à l'autre —, le
  // stock est tout ce qui a été accumulé. Comparer deux pays sur le seul flux,
  // c'est comparer deux années ; sur le stock, deux histoires.
  const qIdeStock = useDonnees<any>(ids ? `${API}/statistiques/ide_flux?pays=${ids.join(",")}&indicateur=stock` : null, { garder: true });
  const ideStock = ids ? (qIdeStock.data ?? (qIdeStock.isError ? {} : null)) : null;
  const qBilat = useDonnees<any>(ids ? `${API}/statistiques/commerce/bilateral?pays_a=${ids[0]}&pays_b=${ids[1]}` : null, { garder: true });
  const bilat = ids ? qBilat.data ?? null : null;
  const autreId = ids && senId !== null && ids.includes(senId) ? ids.find(i => i !== senId) ?? null : null;
  const qEntSiege = useDonnees<any>(autreId != null ? `${API}/statistiques/entreprises-siege?pays_id=${autreId}` : null, { garder: true });
  const entSiege = autreId != null ? qEntSiege.data ?? null : null;

  const ouvrirEntreprise = (id: number) => {
    fetch(`${API}/entreprises/${id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setEntOuverte).catch(() => {});
  };

  const cols = data?.pays || [];
  // L'IDE OUVRE LE TABLEAU. C'est la matière de la plateforme — une agence de
  // promotion des investissements compare d'abord ce que deux pays attirent —,
  // et il fermait la liste, sous la superficie et la balance des services.
  const inds: Indicateur[] = [
    ...IDE_LIGNES,
    ...(data?.indicateurs || []),
  ];
  const cats: string[] = [];
  const parCat: Record<string, Indicateur[]> = {};
  inds.forEach(ind => { const c = ind.categorie || "Autres"; if (!parCat[c]) { parCat[c] = []; cats.push(c); } parCat[c].push(ind); });
  const getCell = (cid: number, code: string): { valeur: number | null; annee?: number } | null => {
    const k = String(cid);
    if (code === "__ide_flux_entrant")  return ideFlux?.[k]?.entrant || null;
    if (code === "__ide_flux_sortant")  return ideFlux?.[k]?.sortant || null;
    if (code === "__ide_stock_entrant") return ideStock?.[k]?.entrant || null;
    if (code === "__ide_stock_sortant") return ideStock?.[k]?.sortant || null;
    return data?.valeurs?.[k]?.[code] || null;
  };

  const nomDe = (id: number | null) => pays.find(p => p.id === id)?.nom ?? "";
  const grps = bilat?.groupements_communs || [];
  const accs = bilat?.accords || [];
  const ents = (autreId !== null && entSiege?.entreprises) || [];
  const totalBilat = (bilat?.a_vers_b || 0) + (bilat?.b_vers_a || 0);
  const periodeBilat = bilat?.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";

  const kpis = [
    { l: "Appartenances communes", txt: bilat ? String(grps.length) : "—", note: "organisations et groupements" },
    { l: "Accords signés", txt: bilat ? String(accs.length) : "—", note: "entre les deux pays" },
    { l: "Entreprises installées", txt: entSiege ? String(entSiege.total ?? ents.length) : autreId === null ? "—" : "…",
      note: autreId !== null ? `siège ${nomDe(autreId)} · au Sénégal` : "réservé aux fiches incluant le Sénégal" },
    { l: "Échanges bilatéraux", txt: bilat && totalBilat > 0 ? fmtUSD(totalBilat) : "—", note: periodeBilat ? `cumul ${periodeBilat}` : "cumul des flux connus" },
  ];

  // Élément listé : badge cliquable (ouvre le détail) ou simple badge
  type Item = { label: string; suffixe?: string | null; title?: string; onClick?: () => void };
  // Bloc de contexte au même habillage que la Balance commerciale : fond bleu
  // voilé, icône dans un carré arrondi, titre en capitales avec le compte
  // badgé à côté, éléments listés en badges assortis au fond.
  const BlocContexte = ({ Icone, titre, count, items }: { Icone: any; titre: string; count: number; items: Item[] }) => (
    <div className="ds-carte" style={{ ...fond_bleu, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: "rgb(var(--bleu-rgb) / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone size={19} color={BLEU} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
          <span style={{ ...TITRE_SEC, margin: 0, fontSize: 9.5 }}>{titre}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: BLEU, background: "rgb(var(--bleu-rgb) / 0.14)", padding: "1px 8px", borderRadius: 999 }}>{count}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((it, i) => (
            <span key={i} title={it.title || it.label} {...(it.onClick ? carteCliquable(it.onClick) : {})}
              style={{ ...badge_bleu, cursor: it.onClick ? "pointer" : "default", transition: "background 0.15s, border-color 0.15s" }}
              onMouseEnter={ev => { if (it.onClick) { const s = badgeSurvol("bleu"); ev.currentTarget.style.background = s.background; ev.currentTarget.style.borderColor = s.borderColor; } }}
              onMouseLeave={ev => { if (it.onClick) { ev.currentTarget.style.background = badge_bleu.background as string; ev.currentTarget.style.border = badge_bleu.border as string; } }}>
              {it.label}{it.suffixe ? <span style={{ color: "var(--gris)", fontWeight: 500 }}>· {it.suffixe}</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const a = cols[0], b = cols[1];

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, var(--champ))", minHeight: "100vh" }}>
      {/* ── Bandeau exécutif : titre + sélecteurs de pays ── */}
      <div data-bandeau style={{ background: "var(--degrade-hero)", color: "var(--sur-bleu)", padding: "34px 40px 88px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: "0 0 10px" }}>
                Fiche Pays
              </p>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                {ids ? `${nomDe(ids[0])} × ${nomDe(ids[1])}` : "Fiche Pays"}
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "10px 0 0", fontWeight: 500 }}>
                Analyse comparative · Indicateurs économiques · Échanges bilatéraux
              </p>
              {/* Sélecteurs : changer les deux pays sans quitter la page */}
              {ids && pays.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  {[0, 1].map(pos => (
                    <span key={pos} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: pos === 0 ? "var(--bleu-action)" : "var(--orange-action)", flexShrink: 0 }} />
                      <SelectPays valeur={ids[pos]} pays={pays} exclure={ids[1 - pos]}
                        onChange={id => setIds(prev => {
                          if (!prev) return prev;
                          const n: [number, number] = [...prev] as [number, number];
                          n[pos] = id; return n;
                        })} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="no-print" style={{ flexShrink: 0 }}>
              <NavActions onDark home flouTotal />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px 70px" }}>
        {/* ── KPIs relationnels chevauchant le bandeau ── */}
        {errPays && !ids ? (
          <div className="ds-carte" style={{ marginTop: -52 }}>
            <ErreurChargement onRetry={() => qPays.refetch()} />
          </div>
        ) : !ids ? (
          <div style={{ marginTop: -52 }}><SkeletonKPIs n={4} /></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: -52 }}>
            {kpis.map(k => (
              <div key={k.l} className="ds-carte" style={{ padding: "18px 20px", boxShadow: "var(--ombre-2)" }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: "0 0 10px" }}>{k.l}</p>
                <p className="ds-donnee" style={{ fontSize: "1.65rem", fontWeight: 800, color: ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" }}>{k.txt}</p>
                <div style={{ marginTop: 8, minHeight: 15 }}>
                  <span style={{ fontSize: 10, color: "var(--gris)" }}>{k.note}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Contexte relationnel ── */}
        {(grps.length > 0 || accs.length > 0 || ents.length > 0) && (
          <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
            {grps.length > 0 && (
              <BlocContexte Icone={Landmark} titre="Appartenances communes" count={grps.length}
                items={grps.map((g: any) => ({ label: g.code || g.nom, title: g.nom }))} />
            )}
            {accs.length > 0 && (
              <BlocContexte Icone={FileText} titre={accs.length > 1 ? "Accords signés" : "Accord signé"} count={accs.length}
                items={accs.map((ac: any) => ({ label: ac.titre, suffixe: ac.date_signature ? ac.date_signature.slice(0, 4) : null, title: ac.reference || ac.titre, onClick: ac.id ? () => setAccordOuvert(ac) : undefined }))} />
            )}
            {ents.length > 0 && (
              <BlocContexte Icone={Building2} titre={`Entreprises installées au Sénégal · siège ${nomDe(autreId)}`} count={entSiege.total}
                items={ents.map((e: any) => ({ label: e.nom, title: [e.nom, e.forme_juridique, e.region ? `Région : ${e.region}` : null, e.secteurs?.length ? e.secteurs.join(", ") : null].filter(Boolean).join(" · "), onClick: () => ouvrirEntreprise(e.id) }))} />
            )}
          </div>
        )}

        {/* ── Indicateurs comparés (absent tant que la liste des pays est en échec) ── */}
        {!(errPays && !ids) && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "22px 26px 14px" }}>
            <p style={TITRE_SEC}>Indicateurs comparés</p>
            {!data ? (
              errData ? <ErreurChargement compact onRetry={() => qData.refetch()} /> : <SkeletonRows n={10} h={34} />
            ) : (
              <TableauComparatif cols={cols} cats={cats} parCat={parCat} getCell={getCell} />
            )}
          </div>
        )}

        {/* ── Échanges bilatéraux ── */}
        {cols.length === 2 && bilat && (bilat.a_vers_b > 0 || bilat.b_vers_a > 0) && (() => {
          const ab = bilat.a_vers_b || 0, ba = bilat.b_vers_a || 0;
          const diff = ab - ba;
          const gagnant = diff >= 0 ? a : b, perdant = diff >= 0 ? b : a;
          const BlocDir = ({ de, vers, col, val, res, dep }: any) => {
            const maxR = res && res.length ? res[0].valeur : 1;
            const hasRes = res && res.length > 0;
            return (
              <div className="ds-carte" style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "15px 20px", borderBottom: hasRes ? "1px solid var(--filet)" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: ENCRE }}>
                      <span style={{ fontWeight: 800, color: col }}>{de}</span>
                      <ArrowRight size={13} style={{ color: "var(--gris)", flexShrink: 0 }} />
                      <span>{vers}</span>
                    </span>
                    {dep != null && dep > 0 && <span style={{ fontSize: 11, color: "var(--gris)", marginTop: 3, display: "block" }}>soit <strong style={{ color: "var(--gris-fort)" }}>{(dep * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong> des importations de {vers}</span>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="ds-donnee" style={{ fontSize: 15, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(val)}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>Total exporté</div>
                  </div>
                </div>
                {hasRes && (
                  <div style={{ padding: "14px 20px", display: "grid", gap: 12 }}>
                    {res.map((r: any) => {
                      const pct = val > 0 ? r.valeur / val * 100 : 0;
                      return (
                        <div key={r.ressource}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                            <span style={{ fontSize: 11.5, color: "var(--texte)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={r.ressource}>{r.ressource}</span>
                            <span className="ds-donnee" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--encre)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtUSD(r.valeur)} <span style={{ color: "var(--gris)", fontWeight: 600 }}>· {pct.toFixed(0)} %</span></span>
                          </div>
                          <div style={{ height: 7, background: "var(--bleu-voile)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.max(4, Math.sqrt(r.valeur / maxR) * 100)}%`, background: col, borderRadius: 99 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };
          return (
            <div style={{ marginTop: 18 }}>
              <p style={TITRE_SEC}>Échanges bilatéraux{periodeBilat ? <span style={{ color: "var(--gris)", letterSpacing: "0.06em" }}> · {periodeBilat}</span> : ""}</p>
              <div style={{ display: "grid", gap: 12 }}>
                <BlocDir de={a.nom} vers={b.nom} col={BLEU} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
                <BlocDir de={b.nom} vers={a.nom} col={ORANGE} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
              </div>
              <div className="ds-carte" style={{ marginTop: 12, padding: "16px 20px", background: "linear-gradient(180deg,rgb(var(--bleu-rgb) / 0.06),rgb(var(--bleu-rgb) / 0.02))", border: "1px solid rgb(var(--bleu-rgb) / 0.16)", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: "rgb(var(--bleu-rgb) / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Scale size={19} color={BLEU} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...TITRE_SEC, margin: "0 0 3px", fontSize: 9.5 }}>Balance commerciale</div>
                  <div style={{ fontSize: 12.5, color: "var(--texte)", lineHeight: 1.45 }}>
                    {diff === 0
                      ? <>Échanges <strong style={{ color: ENCRE }}>équilibrés</strong> entre {a.nom} et {b.nom}.</>
                      : <>Excédentaire en faveur de <strong style={{ color: diff >= 0 ? BLEU : ORANGE }}>{gagnant.nom}</strong>, déficitaire pour {perdant.nom}.</>}
                  </div>
                </div>
                {diff !== 0 && (
                  <span className="ds-donnee" style={{ fontSize: 17, fontWeight: 800, color: diff >= 0 ? BLEU : ORANGE, fontVariantNumeric: "tabular-nums", flexShrink: 0, whiteSpace: "nowrap" }}>
                    +{fmtUSD(Math.abs(diff))}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Pied méthodologique ── */}
        <div style={{ marginTop: 22, padding: "14px 4px 0", borderTop: "1px solid var(--bleu-voile)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 10.5, color: "var(--gris)", margin: 0, lineHeight: 1.6, maxWidth: 760 }}>
            APIX S.A — DIPE, Direction de l&apos;Intelligence et des Perspectives Économiques.
          </p>
          <p style={{ fontSize: 10.5, color: "var(--gris)", margin: 0, whiteSpace: "nowrap" }}>
            Mise à jour le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Détails ouverts depuis les chips */}
      {accordOuvert && <AccordVueModal accord={accordOuvert} onClose={() => setAccordOuvert(null)} zIndex={800} />}
      {entOuverte && <EntreprisePublicModal entreprise={entOuverte} onClose={() => setEntOuverte(null)} zIndex={800} />}
    </div>
  );
}

export default function FichePaysPage() {
  return (
    <Suspense fallback={null}>
      <ContenuFichePays />
    </Suspense>
  );
}
