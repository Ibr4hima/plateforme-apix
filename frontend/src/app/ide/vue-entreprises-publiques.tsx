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
// porter ces listes sans cesser d'être parcourable ; la fiche les donne toutes,
// AVEC LEUR COMPTE — « Fabrication » sans dire combien de fois laisserait croire
// à une activité principale là où il s'agit peut-être d'un projet isolé.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import DrapeauPays from "@/components/shared/DrapeauPays";
import FicheModal from "@/components/shared/FicheModal";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { useDonnees } from "@/lib/donnees";
import { API, boutonPage, ETIQ, FacetteSecteurs, FacetteUnique, Filet, fmtNombre,
         LigneFiche, TitreFiche } from "./partage";

/** Ce que le lecteur peut restreindre.

    CHAQUE FACETTE N'ADMET QU'UN CHOIX, et les trois se combinent par un ET —
    « Communications » puis « Équipements de communication » se lit comme un
    affinement. La vue Projets, elle, offre une sélection multiple et emboîtée
    et les combine par un OU : ce n'est pas une incohérence, c'est le geste qui
    diffère.

    LE FILTRE PORTE SUR LES PROJETS, PUIS L'ON GROUPE. Une entreprise apparaît
    donc si l'un de ses projets répond, et ses comptes ne portent que sur ces
    projets-là : sous « Communications », « 12 projets » se lit « 12 projets de
    communications ». C'est la seule lecture qui se vérifie ligne à ligne dans
    la vue Projets. */
export type FiltresEntreprises = {
  secteur: string; sousSecteur: string; activite: string; recherche: string;
};
export const FILTRES_ENTREPRISES_VIDES: FiltresEntreprises = {
  secteur: "", sousSecteur: "", activite: "", recherche: "",
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
};
type Fiche = {
  nom: string; origine: string | null; origine_iso: string | null;
  projets: number; pays: number; annees: [number | null, number | null];
  destinations: Compte[]; secteurs: Compte[]; sous_secteurs: Compte[];
  activites: Compte[]; types: Compte[];
};

const PAR_PAGE = 24;

/** Le périmètre du relevé dont ces entreprises sont tirées. Il qualifie la page
    comme « Projets reçus » qualifie celle des projets. */
const PERIMETRE = "Afrique";

/** L'adresse du périmètre. Elle est construite ici et employée par LES DEUX
    composants — la colonne de filtres et la liste : la clé de cache étant
    l'URL, ils partagent le même téléchargement sans se connaître. */
function urlPerimetre(f: FiltresEntreprises, recherche: string): string {
  const p = new URLSearchParams();
  if (f.secteur) p.set("secteurs", f.secteur);
  if (f.sousSecteur) p.set("sous_secteurs", f.sousSecteur);
  if (f.activite) p.set("activites", f.activite);
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
      {/* LE MÊME EMBOÎTEMENT QUE LA VUE PROJETS, et pas deux listes à plat :
          cocher un secteur ouvre ses sous-secteurs en dessous, et en cocher un
          précise la sélection À L'INTÉRIEUR de ce secteur. Les deux vues sont
          voisines dans le même écran ; deux façons de poser le même couple
          donneraient l'impression de deux produits.

          Un seul choix à la fois de chaque côté, parce que la requête des
          entreprises combine ses facettes par un ET là où celle des projets les
          combine par un OU.

          CHANGER DE SECTEUR EMPORTE LE SOUS-SECTEUR qu'on y avait précisé : le
          laisser filtrer depuis un secteur qu'on vient de quitter serait un
          filtre actif que plus rien n'explique à l'écran. Le composant partagé
          ne peut pas le faire lui-même ici — les deux valeurs tiennent dans un
          seul état, et deux écritures dans la même closure s'écraseraient. */}
      <FacetteSecteurs unique secteurs={per.secteurs} sousSecteurs={per.sous_secteurs}
        choixSec={filtres.secteur ? [filtres.secteur] : []}
        setChoixSec={v => onChange({ ...filtres, secteur: v[0] ?? "", sousSecteur: "" })}
        choixSous={filtres.sousSecteur
          ? [{ secteur: filtres.secteur, nom: filtres.sousSecteur }] : []}
        setChoixSous={v => onChange({ ...filtres, sousSecteur: v[0]?.nom ?? "" })} />
      {/* L'activité dit ce que l'entreprise vient FAIRE — usine, siège,
          logistique — indépendamment de son secteur. Les deux se croisent :
          un équipementier télécom qui ouvre un centre de R&D n'est pas le même
          prospect que le même équipementier qui ouvre un entrepôt. */}
      <FacetteUnique titre="Activité prévue" options={per.activites} valeur={filtres.activite}
        onChange={v => onChange({ ...filtres, activite: v })}
        vide="Toutes les activités" />
    </>
  );
}

export default function VueEntreprisesPubliques({ filtres, onChange }: {
  filtres: FiltresEntreprises; onChange: (f: FiltresEntreprises) => void;
}) {
  const [page, setPage] = useState(1);
  // L'entreprise dont la fiche est ouverte, par sa clef de groupement. Elle est
  // montée hors de la grille : une modale enfant d'une carte hériterait de son
  // curseur et de son clic.
  const [ouverte, setOuverte] = useState<Entreprise | null>(null);
  const recherche = useDebounced(filtres.recherche, 300);

  // Un changement de filtre ramène au premier écran : rester en page 12 d'un
  // résultat qui n'en compte plus qu'une n'aurait aucun sens.
  const clef = `${filtres.secteur}|${filtres.sousSecteur}|${filtres.activite}|${recherche}`;
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
            style={{ width: "100%", padding: "8px 10px 8px 34px", borderRadius: 999,
              border: "1px solid var(--bordure-forte)", background: "var(--carte)",
              fontSize: 12.5, color: "var(--encre)", outline: "none",
              fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const }} />
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
              onOuvrir={() => setOuverte(e)} />
          ))}
        </div>
      )}

      {ouverte && <FicheEntreprise e={ouverte} onClose={() => setOuverte(null)} />}

      {d.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, marginTop: 28 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={boutonPage(page > 1)}>Précédentes</button>
          <span style={{ fontSize: 12.5, color: "var(--gris)" }}>
            Page {d.page} sur {d.pages}
          </span>
          <button disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}
            style={boutonPage(page < d.pages)}>Suivantes</button>
        </div>
      )}
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
function CarteEntreprise({ e, onOuvrir }: { e: Entreprise; onOuvrir: () => void }) {
  return (
    <article onClick={onOuvrir} role="button" tabIndex={0}
      onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOuvrir(); } }}
      style={{ display: "flex", flexDirection: "column", background: "var(--carte)",
        border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16,
        padding: "15px 17px 13px", cursor: "pointer",
        transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s" }}
      onMouseEnter={ev => { ev.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.38)";
        ev.currentTarget.style.boxShadow = "0 4px 16px rgb(var(--ombre-rgb) / 0.10)";
        ev.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={ev => { ev.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)";
        ev.currentTarget.style.boxShadow = "none"; ev.currentTarget.style.transform = "none"; }}>

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

/** La fiche d'un investisseur : tout ce que les projets annoncés en disent.

    ELLE SE DEMANDE, elle ne se déduit pas de la carte. La carte ne porte que
    deux nombres ; les listes qui font l'intérêt de la fiche — où l'entreprise
    est allée, dans quoi elle a investi, ce qu'elle y est venue faire — supposent
    de regrouper TOUS ses projets, ce que la liste paginée n'a jamais eu en
    main. Un aller-retour à l'ouverture, donc, et pas un octet de plus dans la
    grille.

    LA CLEF EST LE COUPLE (NOM, PAYS D'ORIGINE) — celui du groupement. C'est ce
    couple que la carte porte, et c'est lui qui part dans la requête : sans le
    pays, deux entités homonymes venues de deux pays seraient fondues en une.

    ELLE N'EST PAS FILTRÉE. La colonne de gauche restreint la LISTE des
    entreprises ; une fois la fiche ouverte, elle dit l'entreprise ENTIÈRE. Y
    appliquer le filtre ferait varier « 54 projets » selon ce qui est coché à
    gauche, et deux lecteurs verraient deux fiches sous le même titre. */
function FicheEntreprise({ e, onClose }: { e: Entreprise; onClose: () => void }) {
  const url = useMemo(() => {
    const p = new URLSearchParams({ nom: e.nom });
    if (e.origine) p.set("origine", e.origine);
    return `${API}/fdi/public/entreprises/fiche?${p}`;
  }, [e.nom, e.origine]);
  const f = useDonnees<Fiche>(url, { garder: true }).data;

  const periode = !f || f.annees[0] == null ? null
    : f.annees[0] === f.annees[1] ? `${f.annees[0]}` : `${f.annees[0]} — ${f.annees[1]}`;

  return (
    <FicheModal maxWidth={620} onClose={onClose}
      titre={
        <span style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" as const }}>
          <span>{e.nom}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
            fontWeight: 600, color: "var(--gris)" }}>
            <DrapeauPays iso={e.origine_iso} nom={e.origine ?? ""} taille={15} sansIso="rien" />
            {e.origine ?? "Origine inconnue"}
          </span>
        </span>
      }>

      {/* Les deux nombres de la carte, en tête : la fiche s'ouvre sur ce que le
          lecteur venait de lire, pour qu'il reconnaisse où il a cliqué. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 34, flexWrap: "wrap" as const }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Projets annoncés</p>
          <GrandNombre n={f ? f.projets : e.projets} />
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--bordure)" }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Pays d&apos;implantation</p>
          <GrandNombre n={f ? f.pays : e.pays} />
        </div>
        {periode && (
          <>
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--bordure)" }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, color: "var(--gris)", marginBottom: 6 }}>Période</p>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--encre)",
                letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{periode}</span>
            </div>
          </>
        )}
      </div>

      {!f ? (
        <p style={{ fontSize: 13, color: "var(--gris)", padding: "24px 0" }}>Chargement…</p>
      ) : (
        <>
          {/* OÙ. Les pays d'arrivée, du plus fourni au moins fourni. */}
          <Groupe titre="Pays d'implantation" valeurs={f.destinations} />

          {/* DANS QUOI. Une entreprise peut investir dans plusieurs secteurs :
              les donner tous, avec leur compte, évite de faire passer un projet
              isolé pour une orientation. */}
          <Groupe titre="Secteurs d'investissement" valeurs={f.secteurs} />
          <Groupe titre="Sous-secteurs" valeurs={f.sous_secteurs} />

          {/* CE QU'ELLE VIENT FAIRE. C'est la liste la plus parlante des trois :
              la même entreprise fabrique ici, forme là, distribue ailleurs. */}
          <Groupe titre="Activités prévues" valeurs={f.activites} />
          <Groupe titre="Natures d'implantation" valeurs={f.types} />
        </>
      )}
    </FicheModal>
  );
}

/** Un nombre en tête de fiche : la valeur grande, sans unité — l'étiquette
    au-dessus la nomme déjà. */
const GrandNombre = ({ n }: { n: number }) => (
  <span style={{ fontSize: 30, fontWeight: 800, color: "var(--encre)",
    letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtNombre(n)}</span>
);

/** Une liste de valeurs comptées, en lignes de fiche.

    LE COMPTE EST À DROITE, dans la colonne des valeurs, et il est écrit en
    toutes lettres : « 41 projets », non « 41 ». Un nombre nu à côté d'un nom de
    secteur se lit aussi bien comme un rang que comme un compte, et le lecteur
    n'a pas à deviner lequel.

    Une liste vide ne s'affiche pas du tout : un intertitre suivi d'un tiret
    occupe autant de place qu'une vraie section et n'apprend rien. */
function Groupe({ titre, valeurs }: { titre: string; valeurs: Compte[] }) {
  if (valeurs.length === 0) return null;
  return (
    <div>
      <TitreFiche>{titre}</TitreFiche>
      {valeurs.map(v => (
        <LigneFiche key={v.nom} label={v.nom}>
          <span style={{ color: "var(--gris)", fontWeight: 600 }}>
            {fmtNombre(v.nb)} projet{v.nb > 1 ? "s" : ""}
          </span>
        </LigneFiche>
      ))}
    </div>
  );
}
