"use client";

// Entreprises — les investisseurs, vus depuis les projets annoncés.
//
// D'OÙ VIENNENT CES FICHES. Des SEULS projets annoncés. Les signaux
// d'investisseur parlent des mêmes entreprises, mais ils décrivent des
// INTENTIONS : les mêler ici ferait compter comme investissement ce qui n'est
// encore qu'une étude.
//
// LE GROUPEMENT SE FAIT SUR LE COUPLE (NOM, PAYS D'ORIGINE), et le second
// terme n'est pas décoratif : une même raison sociale peut désigner deux
// entités distinctes selon le pays d'où part l'investissement — les filiales
// nationales des grands groupes portent souvent le nom du groupe. Grouper sur
// le seul nom les confondrait, et l'écran annoncerait un investisseur unique
// là où il y en a deux.
//
// CE QUE LA CARTE COMPTE, ET CE QU'ELLE NE COMPTE PAS. Le nombre de projets et
// le nombre de PAYS DISTINCTS où l'entreprise a annoncé : deux nombres qui se
// vérifient ligne à ligne dans la vue Projets. Pas de montant total — il
// mêlerait des projets déclarés et des projets estimés par l'algorithme du
// Financial Times, et l'écran ne pourrait plus dire lequel il montre.
//
// CE QUE LA CARTE LAISSE À LA FICHE. Une entreprise n'investit pas partout dans
// la même chose : Huawei fait de la fabrication dans un pays, de la formation
// dans un autre, du commerce de détail dans un troisième. La carte ne peut pas
// porter ces listes sans cesser d'être parcourable ; la fiche les donne toutes.
//
// ELLE LES ÉNUMÈRE SANS LES COMPTER. Le nombre de projets par secteur ou par
// activité ferait doublon : le total est déjà en tête de fiche, et le répéter à
// chaque ligne fait lire un tableau là où il n'y a qu'une liste. Seuls les PAYS
// gardent leur compte — trente-neuf projets dans l'un contre un dans l'autre,
// ce n'est pas la même présence, et rien d'autre ne le dit.

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import FicheModal, { FicheAttente, FicheFait, FicheFaits, FichePuces, FicheRubrique } from "@/components/shared/FicheModal";
import { creerMagasinFiche, useFicheOuverte, type MagasinFiche } from "@/lib/magasinFiche";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { API, CARTE_CLIQUABLE, type ChoixSous, ETIQ, Facette, FacetteSecteurs,
         Filet, fmtNombre, Pagination, PaysFdi, survolCarte } from "./partage";

/** Ce que le lecteur peut restreindre — LES MÊMES FACETTES QUE LA VUE PROJETS,
    et de la même façon : sélection multiple, secteurs et sous-secteurs
    emboîtés, activités à côté.

    LE FILTRE PORTE SUR LES PROJETS, PUIS L'ON GROUPE. Une entreprise apparaît
    donc si l'un de ses projets répond, et ses comptes ne portent que sur ces
    projets-là : sous « Communications », « 12 projets » se lit « 12 projets de
    communications ». C'est la seule lecture qui se vérifie ligne à ligne dans
    la vue Projets.

    CE QUE COCHER DEUX SECTEURS VEUT DIRE, puisque le geste est maintenant
    possible : non pas les entreprises présentes dans LES DEUX, mais celles
    présentes dans L'UN OU L'AUTRE. Le OU porte sur les projets, et un projet
    n'a qu'un secteur — c'est le comportement de la vue Projets, où l'on coche
    deux secteurs pour en voir l'union. */
export type FiltresEntreprises = {
  origines: string[]; destinations: string[];
  secteurs: string[]; sousSecteurs: ChoixSous[]; activites: string[]; recherche: string;
};
export const FILTRES_ENTREPRISES_VIDES: FiltresEntreprises = {
  origines: [], destinations: [], secteurs: [], sousSecteurs: [], activites: [], recherche: "",
};

type Entreprise = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number;
};
type Reponse = {
  entreprises: Entreprise[]; page: number; pages: number; total: number;
};
type Compte = { nom: string; nb: number };
type SousCompte = Compte & { secteur: string };
type Perimetre = {
  secteurs: Compte[]; sous_secteurs: SousCompte[]; activites: Compte[];
  origines: Compte[]; destinations: Compte[];
};
type Fiche = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number; annees: [number | null, number | null];
  filiales: Compte[];
  destinations: Compte[]; secteurs: Compte[]; sous_secteurs: Compte[];
  activites: Compte[];
};

const PAR_PAGE = 30;

/** L'adresse de la fiche d'un investisseur. LA CLEF EST LE COUPLE (NOM, PAYS
    D'ORIGINE) — celui du groupement : sans le pays, deux entités homonymes
    venues de deux pays seraient fondues en une. Partagée par le préchargement
    au survol et par l'hôte de la fiche : la clé de cache étant l'URL, la fiche
    demandée au survol est celle qui s'ouvre. */
const urlFiche = (e: Entreprise) => {
  const p = new URLSearchParams({ nom: e.nom });
  if (e.origine) p.set("origine", e.origine);
  return `${API}/fdi/public/entreprises/fiche?${p}`;
};

/** Le périmètre du relevé dont ces entreprises sont tirées. Il qualifie la page
    comme « Projets reçus » qualifie celle des projets. */
const PERIMETRE = "Afrique";

/** L'adresse du périmètre. Elle est construite ici et employée par LES DEUX
    composants — la colonne de filtres et la liste : la clé de cache étant
    l'URL, ils partagent le même téléchargement sans se connaître.

    CE QUE LA HIÉRARCHIE SECTORIELLE TRANSMET, et qui vaut d'être dit : les
    secteurs retenus EN ENTIER d'un côté, les sous-secteurs retenus de l'autre.
    Un secteur où l'on est descendu sort de la première liste — sinon le OU de
    la requête le ramènerait tout entier, et la précision serait sans effet.
    C'est la règle de la vue Projets, mot pour mot. */
function urlPerimetre(f: FiltresEntreprises, recherche: string): string {
  const p = new URLSearchParams();
  const precises = new Set(f.sousSecteurs.map(s => s.secteur));
  const entiers = f.secteurs.filter(s => !precises.has(s));
  if (entiers.length) p.set("secteurs", entiers.join("|"));
  if (f.sousSecteurs.length) p.set("sous_secteurs", f.sousSecteurs.map(s => s.nom).join("|"));
  if (f.activites.length) p.set("activites", f.activites.join("|"));
  if (f.origines.length) p.set("origines", f.origines.join("|"));
  if (f.destinations.length) p.set("destinations", f.destinations.join("|"));
  if (recherche.trim()) p.set("recherche", recherche.trim());
  return `${API}/fdi/public/entreprises/perimetre?${p}`;
}

/** La colonne de filtres, montée dans la barre latérale de la page — celle des
    projets et des signaux, la même. Mettre ces filtres dans le contenu aurait
    laissé une colonne vide à gauche et poussé les cartes vers le bas.

    LE COMPTE EST UN NOMBRE D'ENTREPRISES, pas de projets : la question posée
    ici est « combien d'investisseurs dans ce secteur », et un nombre de projets
    à côté d'une liste d'entreprises se lirait pour l'autre. */
export function FiltresEntreprisesPanneau({ filtres, onChange }: {
  filtres: FiltresEntreprises; onChange: (f: FiltresEntreprises) => void;
}) {
  const recherche = useDebounced(filtres.recherche, 300);
  const per = useDonnees<Perimetre>(urlPerimetre(filtres, recherche), { garder: true }).data;
  if (!per) return null;

  return (
    <>
      <Filet />
      {/* ── LE PAYS D'ORIGINE, EN PREMIER ────────────────────────────────
          IL NE QUALIFIE PAS LA MÊME CHOSE QUE LES TROIS AUTRES. Secteur,
          sous-secteur et activité décrivent des PROJETS : l'entreprise
          apparaît parce que l'un des siens répond, et ses comptes se
          réduisent alors à ces projets-là. L'origine, elle, fait partie de
          la clef qui définit la ligne — cocher « France » ne retient pas les
          entreprises ayant un projet français, il retient les entreprises
          FRANÇAISES, avec tous leurs projets.

          C'est donc le filtre qui dit QUI l'on regarde, quand les suivants
          disent CE QU'ILS FONT. Il ouvre la colonne pour cette raison, et
          non par ordre d'importance : on choisit d'abord une population,
          puis on la restreint.

          Il porte un champ de recherche, seul de la colonne : cent
          quarante-quatre pays rangés par nombre d'investisseurs se parcourent
          mal quand on en cherche un précis. C'est celui de la vue Signaux, au
          pixel et au libellé près — les deux vues se filtrent depuis la même
          colonne, à deux clics l'une de l'autre. */}
      <Facette titre="Pays d'origine" options={per.origines} filtrable="Rechercher un pays…"
        choix={filtres.origines}
        setChoix={v => onChange({ ...filtres, origines: v })} />
      {/* ── OÙ ILS VONT ──────────────────────────────────────────────────
          LA DESTINATION NE QUALIFIE PAS L'INVESTISSEUR, MAIS SON PROJET.
          C'est la différence avec la facette du dessus, et elle change ce
          que la carte affiche ensuite : cocher « Nigeria » ne retient pas
          les entreprises nigérianes — c'est l'origine qui le dirait — mais
          celles qui ont annoncé AU Nigeria, avec leurs seuls projets
          nigérians en regard. « Orange · 12 projets » s'y lit « douze
          projets au Nigeria ».

          Elle se comporte donc comme le secteur et l'activité, et se place
          après l'origine comme dans la vue Signaux : d'où part
          l'investissement, où il arrive, puis ce qu'il y fait.

          À CHOIX MULTIPLE, contrairement à celle des signaux : toute cette
          colonne l'est, et pouvoir comparer deux marchés voisins — Sénégal
          et Côte d'Ivoire — est précisément ce qu'on demande d'un filtre de
          destination. */}
      <Facette titre="Destination" options={per.destinations} filtrable="Rechercher un pays…"
        choix={filtres.destinations}
        setChoix={v => onChange({ ...filtres, destinations: v })} />
      {/* EXACTEMENT LES FILTRES DE LA VUE PROJETS — mêmes composants, même
          emboîtement, même sélection multiple. Les deux vues sont voisines dans
          le même écran ; deux façons de poser les mêmes facettes donneraient
          l'impression de deux produits.

          Décocher un secteur emporte les sous-secteurs qu'on y avait précisés,
          et le composant s'en charge en une seule écriture : nos deux listes
          tiennent dans le même objet de filtres, et deux appels successifs
          calculés sur la même valeur d'avant se seraient écrasés. */}
      <FacetteSecteurs titre="Secteurs économiques"
        secteurs={per.secteurs} sousSecteurs={per.sous_secteurs}
        choixSec={filtres.secteurs} choixSous={filtres.sousSecteurs}
        onChange={(secteurs, sousSecteurs) => onChange({ ...filtres, secteurs, sousSecteurs })} />
      {/* L'activité dit ce que l'entreprise vient FAIRE — usine, siège,
          logistique — indépendamment de son secteur. Les deux se croisent :
          un équipementier télécom qui ouvre un centre de R&D n'est pas le même
          prospect que le même équipementier qui ouvre un entrepôt.

          LE MÊME INTITULÉ QUE DANS LES DEUX AUTRES VUES, désormais. On disait
          « Activité menée » ici et « Activité prévue » là-bas, pour distinguer
          ce qu'une entreprise a déjà fait de ce qu'un projet annonce. La
          distinction était juste, mais elle portait sur la LIGNE qu'on lit, non
          sur la facette : les trois vues cochent la même nomenclature, et trois
          noms pour une seule liste de valeurs se remarquent davantage. Le titre
          nomme donc la nomenclature ; le reste de l'écran dit ce qu'on lit. */}
      <Facette titre="Activités économiques" options={per.activites}
        choix={filtres.activites}
        setChoix={v => onChange({ ...filtres, activites: v })} />
    </>
  );
}

export default function VueEntreprisesPubliques({ filtres, onChange }: {
  filtres: FiltresEntreprises; onChange: (f: FiltresEntreprises) => void;
}) {
  const [page, setPage] = useState(1);
  // L'entreprise dont la fiche est ouverte. Elle vit dans un petit magasin
  // (lib/magasinFiche) : seul l'hôte de la fiche s'y abonne, et l'ouvrir ou la
  // fermer ne réaffiche pas la vue et ses trente cartes. La fiche est montée
  // hors de la grille : une modale enfant d'une carte hériterait de son
  // curseur et de son clic.
  const [ficheEntreprise] = useState(() => creerMagasinFiche<Entreprise>());
  // La fiche se demande dès le survol de la carte : au clic, elle est presque
  // toujours déjà là, et s'ouvre complète.
  const queryClient = useQueryClient();
  const precharger = useCallback((e: Entreprise) => { queryClient.prefetchQuery(requeteDonnees(urlFiche(e))); }, [queryClient]);
  const recherche = useDebounced(filtres.recherche, 300);

  // Un changement de filtre ramène au premier écran : rester en page 12 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  // L'URL du périmètre porte déjà toute la sélection, réduite à sa forme
  // envoyée : elle fait donc une clef exacte, et une facette cochée puis
  // décochée n'y laisse aucune trace qui remettrait la page à un.
  const clef = urlPerimetre(filtres, recherche);
  const [vue, setVue] = useState(clef);
  if (clef !== vue) { setVue(clef); setPage(1); }

  const url = useMemo(() => {
    const p = new URLSearchParams(urlPerimetre(filtres, recherche).split("?")[1]);
    p.set("page", String(page));
    p.set("par_page", String(PAR_PAGE));
    return `${API}/fdi/public/entreprises?${p}`;
  }, [filtres, recherche, page]);

  const q = useDonnees<Reponse>(url, { garder: true });
  if (q.isError) return <ErreurChargement onRetry={() => q.refetch()} />;
  if (!q.data) return <SkeletonChartGrid />;
  const d = q.data;

  return (
    <div>
      {/* Le même en-tête que les deux autres vues, jetons compris. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const,
        marginBottom: 20 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%",
          background: "var(--bleu-action)", flexShrink: 0 }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.1 }}>
          Entreprises
        </h2>
        <Jeton>{PERIMETRE}</Jeton>
        <Jeton>{fmtNombre(d.total)} investisseurs</Jeton>
        <div style={{ marginLeft: "auto", position: "relative" as const, minWidth: 200,
          flex: "0 1 300px" }}>
          <Search size={13} style={{ position: "absolute" as const, left: 12, top: "50%",
            transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={filtres.recherche}
            onChange={e => onChange({ ...filtres, recherche: e.target.value })}
            placeholder="Rechercher"
            className="ds-champ" style={{ height: 36, padding: "0 10px 0 34px", fontSize: 12.5 }} />
        </div>
      </div>

      {d.entreprises.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "70px 0" }}>
          Aucune entreprise ne correspond à cette recherche.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {d.entreprises.map(e => (
            <CarteEntreprise key={`${e.nom}|${e.origine ?? ""}`} e={e}
              onOuvrir={() => ficheEntreprise.ouvrir(e)} onSurvol={() => precharger(e)} />
          ))}
        </div>
      )}

      <HoteFicheEntreprise magasin={ficheEntreprise} />

      <Pagination courante={d.page} pages={d.pages} onPage={setPage} nom="entreprise" />
    </div>
  );
}

/** Le jeton de qualification de l'en-tête — celui des deux autres vues. */
const Jeton = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px",
    borderRadius: 5, background: "var(--fond)", border: "1px solid var(--bordure-forte)",
    fontSize: 9, fontWeight: 700, color: "var(--gris)", textTransform: "uppercase" as const,
    letterSpacing: "0.05em", flexShrink: 0 }}>{children}</span>
);

/** Une entreprise, en tuile — le gabarit des cartes de la plateforme : la
    qualification en haut, le nom en grand, le pied en deux colonnes séparées
    d'un filet.

    Ici le pays d'origine tient la ligne du haut : il fait partie de l'identité
    de la fiche, puisque c'est lui qui, avec le nom, la distingue d'une autre. */
function CarteEntreprise({ e, onOuvrir, onSurvol }: { e: Entreprise; onOuvrir: () => void; onSurvol: () => void }) {
  // Une carte d'entreprise ne porte pas d'étiquette : rien ne la qualifie d'une
  // couleur, elle garde donc le bleu de la plateforme.
  const survol = survolCarte("bleu");
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOuvrir(); } }}
      onFocus={onSurvol}
      style={CARTE_CLIQUABLE}
      onMouseEnter={ev => { onSurvol(); survol.onMouseEnter(ev); }} onMouseLeave={survol.onMouseLeave}>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <DrapeauPays iso={e.origine_iso} nom={e.origine ?? ""} taille={14} sansIso="rien" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gris)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.origine ?? "Origine inconnue"}
        </span>
      </div>

      <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--encre)", lineHeight: 1.25,
        letterSpacing: "-0.01em", margin: 0 }}>{e.nom}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14,
        paddingTop: 13, borderTop: "1px solid var(--bordure)" }}>
        <Compte n={e.projets} mot="projet" etiquette="Projets annoncés" />
        <Compte n={e.pays} mot="pays" etiquette="Pays d'implantation" filet />
      </div>
    </article>
  );
}

/** Un compte : le nombre en grand, son unité petite à côté. « pays » est
    invariable — l'écrire au pluriel serait une faute que la Présidence lira. */
function Compte({ n, mot, etiquette, filet }: {
  n: number; mot: string; etiquette: string; filet?: boolean;
}) {
  return (
    <div style={{ minWidth: 0, ...(filet
      ? { paddingLeft: 14, borderLeft: "1px solid var(--bordure)" } : {}) }}>
      <span style={{ ...ETIQ, display: "block", marginBottom: 4 }}>{etiquette}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--encre)",
        letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
        {fmtNombre(n)}
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--gris)" }}>
          {" "}{mot}{n > 1 && !mot.endsWith("s") ? "s" : ""}
        </span>
      </span>
    </div>
  );
}

/** L'hôte de la fiche : le seul composant abonné au magasin. Il demande la
    fiche et ne l'ouvre que COMPLÈTE — ou au plus tard après 0,4 s : elle est
    presque toujours déjà là, demandée au survol de la carte. Passé ce délai,
    elle s'ouvre sur les nombres de la carte, et ce qui manque arrive à sa
    place, en fondu. Elle ne change donc plus de taille sous les yeux du
    lecteur, comme quand elle s'ouvrait sur « Chargement… ». */
function HoteFicheEntreprise({ magasin }: { magasin: MagasinFiche<Entreprise> }) {
  const e = useFicheOuverte(magasin);
  const q = useDonnees<Fiche>(e ? urlFiche(e) : null);
  const prete = useOuvertureFiche(e ? `${e.nom}|${e.origine ?? ""}` : null, !!q.data);
  if (!e || !prete) return null;
  return <FicheEntreprise e={e} f={q.data ?? null} onClose={magasin.fermer} />;
}

/** La fiche d'un investisseur — le dessin commun des fiches (FicheModal) : tout
    ce que les projets annoncés en disent.

    ELLE N'EST PAS FILTRÉE. La colonne de gauche restreint la LISTE des
    entreprises ; une fois la fiche ouverte, elle dit l'entreprise ENTIÈRE. Y
    appliquer le filtre ferait varier « 54 projets » selon ce qui est coché à
    gauche, et deux lecteurs verraient deux fiches sous le même titre.

    Les faits ouvrent sur les deux nombres de la carte — le lecteur reconnaît
    où il a cliqué — et la période. Viennent ensuite les noms sous lesquels le
    groupe a signé, les pays où il est allé et combien de fois — trente-neuf
    projets dans l'un contre un dans l'autre, ce n'est pas la même présence —,
    puis ce qu'il y a investi et ce qu'il y est venu faire, énumérés sans être
    comptés : le total est déjà en tête. */
function FicheEntreprise({ e, f, onClose }: { e: Entreprise; f: Fiche | null; onClose: () => void }) {
  const periode = !f || f.annees[0] == null ? null
    : f.annees[0] === f.annees[1] ? `${f.annees[0]}` : `${f.annees[0]}–${f.annees[1]}`;
  const projets = f ? f.projets : e.projets;
  const pays = f ? f.pays : e.pays;
  const noms = (v: Compte[]) => v.map(x => x.nom);
  return (
    <FicheModal titre={e.nom} onClose={onClose} maxWidth={680}
      surtitre={<span className="fiche-surtitre-texte">Investisseur</span>}
      meta={<>
        <span><PaysFdi nom={e.origine} iso={e.origine_iso} /></span>
        <span>Source : fDi Markets</span>
      </>}>

      <FicheFaits>
        <FicheFait libelle="Projets annoncés">{fmtNombre(projets)} projet{projets > 1 ? "s" : ""}</FicheFait>
        {/* « pays » est invariable */}
        <FicheFait libelle="Pays d'implantation">{fmtNombre(pays)} pays</FicheFait>
        <FicheFait libelle="Période" attente={!f} vide={!periode}>{periode ?? "Non renseignée"}</FicheFait>
      </FicheFaits>

      {!f ? (
        <FicheRubrique titre="Pays d'implantation"><FicheAttente lignes={4} /></FicheRubrique>
      ) : (
        <>
          {/* SOUS QUELS NOMS LE GROUPE A SIGNÉ — la première question d'une
              fiche de groupe. Les projets signés par le groupe lui-même n'y
              figurent pas : la somme des filiales est souvent inférieure au
              total, la différence étant ce qu'il a mené en propre. */}
          {f.filiales.length > 0 && (
            <FicheRubrique titre={f.filiales.length > 1 ? "Filiales" : "Filiale"}
              compte={f.filiales.length > 1 ? f.filiales.length : undefined} arrivee>
              <FichePuces items={noms(f.filiales)} />
            </FicheRubrique>
          )}
          {f.destinations.length > 0 && (
            <FicheRubrique titre="Pays d'implantation" compte={f.destinations.length > 1 ? f.destinations.length : undefined} arrivee>
              <table className="fiche-tableau">
                <thead><tr><th>Pays</th><th>Projets annoncés</th></tr></thead>
                <tbody>
                  {f.destinations.map(d => (
                    <tr key={d.nom}><td>{d.nom}</td><td>{fmtNombre(d.nb)}</td></tr>
                  ))}
                </tbody>
              </table>
            </FicheRubrique>
          )}
          {f.secteurs.length > 0 && (
            <FicheRubrique titre={f.secteurs.length > 1 ? "Secteurs d'investissement" : "Secteur d'investissement"} arrivee>
              <FichePuces items={noms(f.secteurs)} />
            </FicheRubrique>
          )}
          {f.sous_secteurs.length > 0 && (
            <FicheRubrique titre={f.sous_secteurs.length > 1 ? "Sous-secteurs" : "Sous-secteur"} arrivee>
              <FichePuces items={noms(f.sous_secteurs)} />
            </FicheRubrique>
          )}
          {/* « MENÉES », non « prévues » : ces activités sont celles des
              projets déjà annoncés, pas d'une intention. */}
          {f.activites.length > 0 && (
            <FicheRubrique titre={f.activites.length > 1 ? "Activités menées" : "Activité menée"} arrivee>
              <FichePuces items={noms(f.activites)} />
            </FicheRubrique>
          )}
        </>
      )}
    </FicheModal>
  );
}
