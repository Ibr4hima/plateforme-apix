"""Signaux d'investisseur — consultation et complétion depuis l'administration.

CE QUE CET ÉCRAN SERT, et qui n'existe pas côté projets : la COMPLÉTION. Le
tableau de fDi n'affiche qu'une destination, un secteur, une activité et une
nature par signal, et cache les autres. Le relevé porte ce qui est visible ;
c'est ici qu'on ajoute le reste, valeur par valeur.

Toute valeur ajoutée ici porte l'origine « saisie », et le réimport du relevé
ne réécrit que les siennes. C'est la condition sans laquelle la méthode ne
tiendrait pas : une mise à jour du relevé effacerait des heures de travail.

CE QUE CET ÉCRAN NE PRÉTEND PAS : l'exhaustivité. Un décompte « signaux citant
le Sénégal » est un PLANCHER tant que la complétion n'est pas faite, et les
écrans doivent le dire plutôt que de laisser croire à un total.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.fdi_projets import est_tronque, normaliser

# « signaux-investisseurs » et non « signaux » : /fdi/signaux appartient déjà à
# la NOMENCLATURE des types de signal, qui se gère dans l'écran des
# classifications. Les méthodes HTTP suffiraient à les départager, mais deux
# ressources différentes sous un même chemin finissent toujours par tromper
# quelqu'un. Le nom repris est celui que fDi donne à cette base.
router = APIRouter(prefix="/fdi", tags=["fdi"])

# Les quatre familles multiples : leur table, la colonne qui porte le
# rattachement, et le référentiel où le choisir. Tout passe par ce tableau —
# une famille de plus se déclare ici et nulle part ailleurs.
FAMILLES = {
    "destination": {"table": "fdi_signal_destinations", "colonnes": ("pays_id", "region_id")},
    "secteur":     {"table": "fdi_signal_secteurs",     "colonnes": ("secteur_id",)},
    "activite":    {"table": "fdi_signal_activites",    "colonnes": ("activite_id",)},
    "nature":      {"table": "fdi_signal_natures",      "colonnes": ("nature_id",)},
}

# Ce qui fait qu'un signal « vise l'Afrique » : un pays du continent, ou la
# région du monde « Africa » de fDi. Écrit une seule fois, employé par le
# filtre de complétion et par le drapeau de chaque ligne, pour que les deux ne
# puissent pas diverger.
VISE_AFRIQUE = """
    EXISTS (SELECT 1 FROM fdi_signal_destinations d
              LEFT JOIN ref_pays p ON p.id = d.pays_id
              LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
             WHERE d.signal_id = s.id
               AND (p.continent = 'Afrique' OR r.libelle_en = 'Africa'))
"""

# Les libellés affichés d'une famille, dans l'ordre de la source puis des
# ajouts. Le français du référentiel, le brut de la source en secours : un
# libellé non rattaché s'affiche tel que fDi l'écrit, ce qui rend la lacune
# visible plutôt que muette.
LISTES = """
    (SELECT coalesce(json_agg(json_build_object(
                'id', d.id, 'rang', d.rang, 'brut', d.brut, 'origine', d.origine,
                'libelle', coalesce(p.nom_fr, r.libelle_fr, d.brut),
                'nature', CASE WHEN d.pays_id IS NOT NULL THEN 'pays'
                               WHEN d.region_id IS NOT NULL THEN 'region' END,
                'resolu', (d.pays_id IS NOT NULL OR d.region_id IS NOT NULL))
             ORDER BY d.rang), '[]'::json)
       FROM fdi_signal_destinations d
       LEFT JOIN ref_pays p ON p.id = d.pays_id
       LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
      WHERE d.signal_id = s.id) AS destinations,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                'resolu', v.secteur_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_secteurs v LEFT JOIN fdi_secteurs n ON n.id = v.secteur_id
      WHERE v.signal_id = s.id) AS secteurs,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                'resolu', v.activite_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_activites v LEFT JOIN fdi_activites n ON n.id = v.activite_id
      WHERE v.signal_id = s.id) AS activites,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                -- L'étiquette courte, pour les cartes publiques où le libellé
                -- long tiendrait trois lignes. L'administration, elle, affiche
                -- le long : la place ne lui manque pas et le sens exact compte.
                'court', coalesce(nullif(n.libelle_court_fr, ''), n.libelle_fr, v.brut),
                'resolu', v.nature_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_natures v LEFT JOIN fdi_signaux n ON n.id = v.nature_id
      WHERE v.signal_id = s.id) AS natures
"""


def _ligne(r) -> dict:
    return {
        "id": r.id,
        "periode": f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee),
        "entreprise": r.entreprise_nom or r.entreprise_brut,
        "entreprise_brut": r.entreprise_brut,
        "parent": r.parent_nom or r.parent_brut,
        "statut_entreprise": r.statut_entreprise,
        "source": r.pays_source or r.pays_source_brut,
        "source_resolue": r.pays_source is not None,
        "capex_musd": float(r.capex_musd) if r.capex_musd is not None else None,
        "capex_estime": r.capex_estime,
        "funding_musd": float(r.funding_musd) if r.funding_musd is not None else None,
        "funding_estime": r.funding_estime,
        "destinations": r.destinations, "secteurs": r.secteurs,
        "activites": r.activites, "natures": r.natures,
        # Le signal vise-t-il l'Afrique d'après ce qu'on en sait ? « Non » ne
        # veut pas dire qu'il ne la vise pas — seulement que le tableau ne le
        # montrait pas et que personne ne l'a encore complété.
        "vise_afrique": r.vise_afrique,
        "description_en": r.description_en, "description_fr": r.description_fr,
        "lot": r.lot,
    }


@router.get("/signaux-investisseurs/referentiels")
async def referentiels_signaux(db: AsyncSession = Depends(get_db)):
    """Ce dans quoi on choisit une valeur à ajouter.

    Les pays ET les régions du monde de fDi vivent dans la même liste de
    destinations, distingués par leur nature : ce sont deux référentiels, mais
    un seul geste pour qui complète.
    """
    from app.services.fdi_projets import libelles_pays_en

    async def q(sql):
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]

    # ON PROPOSE EN ANGLAIS, ON AFFICHE EN FRANÇAIS. C'est l'écran de fDi qu'on
    # a sous les yeux en complétant : chercher « Middle East » dans une liste
    # française obligerait à traduire de tête à chaque ligne. Une fois choisie,
    # la valeur se lit en français partout ailleurs, par la correspondance.
    en = libelles_pays_en()
    pays = [{**p, "libelle_en": en.get(p.pop("code_iso3") or "") or p["libelle"]}
            for p in await q("SELECT id, nom_fr AS libelle, code_iso3 FROM ref_pays "
                             " WHERE actif ORDER BY nom_fr")]
    regions = await q("SELECT id, libelle_fr AS libelle, libelle_en "
                      "  FROM fdi_regions_monde ORDER BY ordre")
    return {
        "destinations": ([{**r, "nature": "region"} for r in regions]
                         + [{**p, "nature": "pays"} for p in pays]),
        "secteurs":  await q("SELECT id, libelle_fr AS libelle, libelle_en FROM fdi_secteurs ORDER BY ordre"),
        "activites": await q("SELECT id, libelle_fr AS libelle, libelle_en FROM fdi_activites ORDER BY ordre"),
        "natures":   await q("SELECT id, libelle_fr AS libelle, libelle_en FROM fdi_signaux ORDER BY ordre"),
    }


@router.get("/signaux-investisseurs")
async def lister_signaux(
    q: str = "",
    page: int = 1,
    par_page: int = 15,
    a_completer: bool = False,
    a_arbitrer: bool = False,
    sans_description: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Une page de signaux, avec leurs quatre listes.

    Même règle que le tableau des projets : ON COUPE AVANT DE JOINDRE. La
    sélection et le découpage se font sur la seule table des signaux, et les
    listes ne sont construites que pour les quinze lignes retenues.
    """
    where = ["1 = 1"]
    params: dict = {}
    if a_completer:
        where.append(f"NOT {VISE_AFRIQUE}")
    if a_arbitrer:
        where.append("s.statut_entreprise <> 'resolu'")
    if sans_description:
        where.append("coalesce(s.description_fr, '') = ''")
    if q.strip():
        # Recherche sur ce que le tableau montre en propre. Les valeurs
        # multiples ne sont pas fouillées ici : elles le seront le jour où le
        # relevé sera complété, et prétendre les chercher aujourd'hui donnerait
        # des résultats qui dépendent de l'avancement de la saisie.
        where.append("""(
            EXISTS (SELECT 1 FROM fdi_entreprises e2 WHERE e2.id IN (s.entreprise_id, s.parent_id)
                      AND lower(e2.nom) LIKE '%' || lower(:q) || '%')
            OR lower(coalesce(s.entreprise_brut, '')) LIKE '%' || lower(:q) || '%'
            OR lower(coalesce(s.parent_brut, ''))     LIKE '%' || lower(:q) || '%')""")
        params["q"] = q.strip()

    par_page = max(1, min(par_page, 200))
    page = max(1, page)
    params |= {"n": par_page, "o": (page - 1) * par_page}
    filtre = " AND ".join(where)

    lignes = (await db.execute(text(f"""
        WITH choisis AS MATERIALIZED (
            SELECT s.id FROM fdi_signaux_investisseurs s
             WHERE {filtre}
             ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.lot_id, s.ligne
             LIMIT :n OFFSET :o
        )
        SELECT s.id, s.annee, s.mois, s.entreprise_brut, s.parent_brut,
               s.statut_entreprise, s.pays_source_brut,
               s.capex_musd, s.capex_estime, s.funding_musd, s.funding_estime,
               s.description_en, s.description_fr,
               e.nom AS entreprise_nom, pa.nom AS parent_nom,
               ps.nom_fr AS pays_source, l.libelle AS lot,
               {VISE_AFRIQUE} AS vise_afrique,
               {LISTES}
        FROM fdi_signaux_investisseurs s
        JOIN choisis c ON c.id = s.id
        LEFT JOIN fdi_entreprises e  ON e.id  = s.entreprise_id
        LEFT JOIN fdi_entreprises pa ON pa.id = s.parent_id
        LEFT JOIN ref_pays ps ON ps.id = s.pays_source_id
        JOIN fdi_lots_import l ON l.id = s.lot_id
        ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.lot_id, s.ligne
    """), params)).fetchall()

    retenues = (await db.execute(text(
        f"SELECT count(*) FROM fdi_signaux_investisseurs s WHERE {filtre}"), params)).scalar_one()

    totaux = (await db.execute(text(f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE NOT {VISE_AFRIQUE}) AS a_completer,
               count(*) FILTER (WHERE s.statut_entreprise <> 'resolu') AS a_arbitrer,
               count(*) FILTER (WHERE coalesce(s.description_fr, '') = '') AS sans_description
        FROM fdi_signaux_investisseurs s"""))).first()

    return {
        "signaux": [_ligne(r) for r in lignes],
        "page": page,
        "pages": max(1, -(-retenues // par_page)),
        "retenues": retenues,
        "totaux": {"total": totaux.total, "a_completer": totaux.a_completer,
                   "a_arbitrer": totaux.a_arbitrer,
                   "sans_description": totaux.sans_description},
    }


class Choix(BaseModel):
    """Une valeur choisie. Pour une destination, l'un des deux identifiants —
    un pays OU une région du monde, jamais les deux."""
    pays_id: int | None = None
    region_id: int | None = None
    poste_id: int | None = None


class ValeurIn(BaseModel):
    """UN ENVOI, PLUSIEURS VALEURS. Compléter un signal, c'est presque toujours
    en ajouter plusieurs d'un coup — quatre destinations, deux secteurs. Une
    requête par valeur obligeait à rouvrir la liste à chaque fois, et sur des
    milliers de lignes cela seul décide qu'un outil est tenable ou non."""
    famille: str
    valeurs: list[Choix]


@router.post("/signaux-investisseurs/{signal_id}/valeurs", status_code=201)
async def ajouter_valeurs(signal_id: int, body: ValeurIn,
                          db: AsyncSession = Depends(get_db),
                          user: dict = Depends(require_admin)):
    """Ajoute une ou plusieurs valeurs que le tableau de fDi ne montrait pas.

    Elles prennent les rangs suivants et portent l'origine « saisie » : le
    réimport du relevé les laissera en place.

    UN DOUBLON EST IGNORÉ, NON REFUSÉ. Sur un ajout groupé, rejeter tout
    l'envoi parce qu'une valeur sur cinq était déjà là ferait perdre les quatre
    autres. Le rapport dit combien ont été écartées, et pourquoi.
    """
    famille = FAMILLES.get(body.famille)
    if not famille:
        raise HTTPException(400, "Famille inconnue.")
    if not body.valeurs:
        raise HTTPException(400, "Aucune valeur choisie.")
    if not (await db.execute(text(
        "SELECT 1 FROM fdi_signaux_investisseurs WHERE id = :i"), {"i": signal_id})).first():
        raise HTTPException(404, "Signal introuvable.")

    table = famille["table"]
    colonnes = ("pays_id", "region_id") if body.famille == "destination" else famille["colonnes"]
    rang = (await db.execute(text(
        f"SELECT coalesce(max(rang), 0) FROM {table} WHERE signal_id = :s"),
        {"s": signal_id})).scalar_one()

    ajoutes, deja = [], 0
    for choix in body.valeurs:
        if body.famille == "destination":
            if (choix.pays_id is None) == (choix.region_id is None):
                raise HTTPException(400, "Une destination est un pays OU une région du monde.")
            valeurs = {"pays_id": choix.pays_id, "region_id": choix.region_id}
        else:
            if choix.poste_id is None:
                raise HTTPException(400, "Aucun poste choisi.")
            valeurs = {colonnes[0]: choix.poste_id}

        # Deux fois la même valeur ne dit rien de plus qu'une fois, et la
        # laisser entrer fausserait tout décompte fondé sur ces listes.
        conditions = " AND ".join(f"{c} IS NOT DISTINCT FROM :{c}" for c in colonnes)
        if (await db.execute(text(
            f"SELECT 1 FROM {table} WHERE signal_id = :s AND {conditions}"),
            {"s": signal_id, **valeurs})).first():
            deja += 1
            continue

        rang += 1
        champs = ", ".join(colonnes)
        marques = ", ".join(f":{c}" for c in colonnes)
        ajoutes.append((await db.execute(text(
            f"INSERT INTO {table} (signal_id, rang, brut, {champs}, origine) "
            f"VALUES (:s, :rang, NULL, {marques}, 'saisie') RETURNING id"),
            {"s": signal_id, "rang": rang, **valeurs})).scalar_one())

    await db.execute(text(
        "UPDATE fdi_signaux_investisseurs SET modifie_le = :d, modifie_par = :u WHERE id = :i"),
        {"d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"), "i": signal_id})
    await db.commit()
    return {"ajoutes": ajoutes, "deja_presentes": deja}


@router.delete("/signaux-investisseurs/{signal_id}/valeurs/{famille}/{valeur_id}")
async def retirer_valeur(signal_id: int, famille: str, valeur_id: int,
                         db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Retire une valeur AJOUTÉE À LA MAIN.

    Une valeur du relevé ne se retire pas ici : elle dit ce que la source
    affichait, et l'effacer ferait mentir le relevé. Si elle est fautive, c'est
    le fichier de relevé qu'il faut corriger, puis réimporter.
    """
    f = FAMILLES.get(famille)
    if not f:
        raise HTTPException(400, "Famille inconnue.")
    r = (await db.execute(text(
        f"DELETE FROM {f['table']} WHERE id = :v AND signal_id = :s AND origine = 'saisie' "
        f"RETURNING id"), {"v": valeur_id, "s": signal_id})).first()
    if not r:
        raise HTTPException(
            404, "Valeur introuvable, ou issue du relevé — celle-là se corrige dans le fichier.")
    await db.execute(text(
        "UPDATE fdi_signaux_investisseurs SET modifie_le = :d, modifie_par = :u WHERE id = :i"),
        {"d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"), "i": signal_id})
    await db.commit()
    return {"retire": valeur_id}


class DescriptionIn(BaseModel):
    description_en: str | None = None
    description_fr: str | None = None


@router.patch("/signaux-investisseurs/{signal_id}/description")
async def decrire_signal(signal_id: int, body: DescriptionIn,
                         db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Écrit les deux descriptions d'un signal.

    AUCUN VERROU N'EST POSÉ, et ce n'est pas un oubli : la source ne fournit
    pas de description, donc rien dans le relevé ne peut l'écraser. Le réimport
    les préserve déjà tant que la ligne décrit le même signal.

    Une chaîne vide vaut « pas de description » et non « chaîne vide » : sans
    cela le compteur des signaux à décrire tiendrait pour faits ceux qu'on a
    seulement ouverts.
    """
    def _texte(v: str | None) -> str | None:
        return (v or "").strip() or None

    r = (await db.execute(text(
        "UPDATE fdi_signaux_investisseurs "
        "   SET description_en = :en, description_fr = :fr, "
        "       modifie_le = :d, modifie_par = :u "
        " WHERE id = :i RETURNING id"),
        {"en": _texte(body.description_en), "fr": _texte(body.description_fr),
         "d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"),
         "i": signal_id})).first()
    if not r:
        raise HTTPException(404, "Signal introuvable.")
    await db.commit()
    return {"id": signal_id}


class EntrepriseIn(BaseModel):
    nom: str


@router.patch("/signaux-investisseurs/{signal_id}/entreprise")
async def nommer_entreprise(signal_id: int, body: EntrepriseIn,
                            db: AsyncSession = Depends(get_db),
                            user: dict = Depends(require_admin)):
    """Complète le nom tronqué de l'entreprise d'UN signal.

    UNE FILE D'ARBITRAGE SÉPARÉE DE CELLE DES PROJETS, et une décision qui ne
    porte que sur cette ligne-ci. C'est un choix, pas une facilité :

    · AUCUN ALIAS N'EST ÉCRIT. Un alias est une mémoire partagée — il dirait
      « ce texte tronqué désigne cette entreprise » à tout ce qui lit la base,
      projets compris. Les deux relevés partagent la table des entreprises ;
      poser ici une mémoire ferait rattacher d'office, au prochain import des
      projets, des lignes que personne n'a examinées. Une file séparée doit le
      rester.

    · LA DÉCISION NE VAUT QUE POUR CETTE LIGNE. On a le signal sous les yeux —
      sa date, son pays, son secteur — et c'est ce contexte qui dit de quelle
      entreprise il s'agit. Étendre la décision aux autres lignes portant le
      même texte tronqué, sans les avoir regardées, est précisément l'erreur
      qui a fait confondre « Standard Chartered Bank » et « Standard Chartered
      Kenya Bank » côté projets.

    L'ENTREPRISE, ELLE, EST PARTAGÉE : si le nom existe déjà, on s'y rattache
    plutôt que d'en créer une jumelle. C'est ce qui permet aux deux relevés de
    parler du même investisseur.
    """
    nom = " ".join((body.nom or "").split())
    if not nom:
        raise HTTPException(400, "Le nom complet est obligatoire.")
    if est_tronque(nom):
        raise HTTPException(400, "Ce nom est lui-même tronqué : saisir le nom complet.")

    ligne = (await db.execute(text(
        "SELECT entreprise_brut, parent_brut, entreprise_id "
        "  FROM fdi_signaux_investisseurs WHERE id = :i"),
        {"i": signal_id})).first()
    if not ligne:
        raise HTTPException(404, "Signal introuvable.")

    cle = normaliser(nom)
    signataire = str(user.get("email") or "admin")
    r = (await db.execute(text(
        "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": cle})).first()
    if not r:
        r = (await db.execute(text(
            "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_le, modifie_par) "
            "VALUES (:n, :c, 'complet', :d, :u) RETURNING id"),
            {"n": nom, "c": cle, "d": datetime.now(timezone.utc), "u": signataire})).first()

    # La maison mère suit SEULEMENT si elle porte exactement le même texte : ce
    # sont alors deux affichages du même nom coupé, et les laisser diverger
    # obligerait à trancher deux fois la même chose. Un texte différent, lui,
    # désigne peut-être une autre société : on n'en décide pas ici.
    meme_parent = (ligne.parent_brut or "") == (ligne.entreprise_brut or "")
    await db.execute(text(
        "UPDATE fdi_signaux_investisseurs "
        "   SET entreprise_id = :e, statut_entreprise = 'resolu', "
        f"      parent_id = {':e' if meme_parent else 'parent_id'}, "
        "       modifie_le = :d, modifie_par = :u "
        " WHERE id = :i"),
        {"e": r.id, "d": datetime.now(timezone.utc), "u": signataire, "i": signal_id})

    # ON SE TROMPE, ET UNE COQUILLE NE DOIT PAS SURVIVRE À SA CORRECTION.
    # Corriger « Indonesie » en « Indonesia » laissait la faute en base comme
    # entreprise sans aucune ligne — et l'appariement par préfixe l'aurait
    # ensuite PROPOSÉE, rejouant l'erreur qu'on venait de réparer.
    #
    # La suppression est étroitement bornée : on ne retire que l'entreprise
    # qu'on vient de quitter, et seulement si PLUS RIEN ne la désigne — aucune
    # ligne des deux relevés, ni comme entreprise ni comme maison mère, et
    # aucun alias. Une entreprise que quelque chose référence reste, même vide
    # de lignes : elle a peut-être été créée à dessein.
    abandonnee = ligne.entreprise_id
    if abandonnee and abandonnee != r.id:
        await db.execute(text("""
            DELETE FROM fdi_entreprises e
             WHERE e.id = :a
               AND NOT EXISTS (SELECT 1 FROM fdi_signaux_investisseurs x
                                WHERE x.entreprise_id = :a OR x.parent_id = :a)
               AND NOT EXISTS (SELECT 1 FROM fdi_projets x
                                WHERE x.entreprise_id = :a OR x.parent_id = :a)
               AND NOT EXISTS (SELECT 1 FROM fdi_entreprise_alias x
                                WHERE x.entreprise_id = :a)"""), {"a": abandonnee})

    await db.commit()
    return {"entreprise_id": r.id, "nom": nom, "parent_suivi": meme_parent}


# ── Créer un signal à la main ────────────────────────────────────────────────
class DestinationIn(BaseModel):
    """Un pays OU une région du monde, jamais les deux — comme en base."""
    pays_id: int | None = None
    region_id: int | None = None


class SignalIn(BaseModel):
    """Un signal saisi depuis l'administration.

    TOUT EST CHOISI, RIEN N'EST RETAPÉ — sauf les deux noms d'entreprise, qui
    n'appartiennent à aucun référentiel. C'est le point qui a fait refaire ce
    formulaire : recopier « New Funding/Resour… » à la main, c'était inviter la
    faute de frappe sur la valeur qui sert justement à rattacher la ligne.

    On reçoit donc des IDENTIFIANTS de référentiel. Le libellé stocké est celui
    du poste, en anglais — la langue de la source — de sorte qu'une ligne saisie
    se lit comme une ligne importée.

    LES QUATRE COLONNES MULTIPLES LE SONT ICI AUSSI. La source n'en montre
    qu'une par case, mais elle en cache d'autres : pouvoir les poser dès la
    saisie évite d'avoir à rouvrir la ligne pour la compléter.
    """
    annee: int
    mois: int
    entreprise: str
    parent: str | None = None
    pays_source_id: int | None = None
    destinations: list[DestinationIn] = []
    secteurs: list[int] = []
    activites: list[int] = []
    natures: list[int] = []
    funding_musd: float | None = None
    funding_estime: bool = False
    capex_musd: float | None = None
    capex_estime: bool = False


# Le lot des signaux saisis à la main. Il en faut un : la colonne est
# obligatoire, et ces lignes n'appartiennent à aucune page de fDi.
LOT_SAISIE = "Signaux · saisie manuelle"

# Les mois tels que fDi les écrit. La saisie choisit un mois et une année ; on
# reconstruit la date de la source pour que le lecteur partagé l'interprète.
MOIS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.post("/signaux-investisseurs", status_code=201)
async def creer_signal(body: SignalIn,
                       db: AsyncSession = Depends(get_db),
                       user: dict = Depends(require_admin)):
    """Ajoute un signal que la source vient de publier, sans passer par un import.

    POURQUOI CETTE PORTE EXISTE. fDi publie quelques signaux par semaine. Les
    faire entrer par le relevé demandait de réexporter, découper, redéployer —
    pour trois lignes. On les saisit ici, et l'écran les montre aussitôt.

    L'IDENTITÉ EST CELLE DU CONTENU, comme pour une ligne importée, et elle
    porte les POSTES rattachés plutôt que leurs libellés. C'est ce qui permet à
    une saisie et à un import de se reconnaître : la source écrit ses libellés
    tronqués, le formulaire connaît les entiers, et les deux désignent le même
    poste. Le jour où un export apporte ce signal, l'import le retrouve au lieu
    de le dupliquer, et ce qui aura été complété entre-temps reste en place.
    """
    from app.services.fdi_projets import lire_pays_csv
    from app.services.fdi_signaux import (LIAISONS, cle_signal, referentiels,
                                          resoudre_ligne, signature_releve)

    if not 1 <= body.mois <= 12:
        raise HTTPException(422, "Mois attendu entre 1 et 12.")
    if not 1990 <= body.annee <= 2100:
        raise HTTPException(422, "Année hors des bornes plausibles.")
    if not body.entreprise.strip():
        raise HTTPException(422, "Le nom de l'entreprise est obligatoire.")

    # LES LIBELLÉS DES POSTES CHOISIS, en anglais. Une requête par famille : on
    # écrit le libellé en base pour que la ligne se lise comme une ligne
    # importée, et un identifiant qui n'existe pas doit être refusé ici plutôt
    # que de produire une valeur muette.
    async def libelles(table: str, ids: list[int]) -> dict[int, str]:
        if not ids:
            return {}
        lignes = (await db.execute(text(
            f"SELECT id, libelle_en FROM {table} WHERE id = ANY(:ids)"),
            {"ids": list(set(ids))})).fetchall()
        trouves = {r.id: r.libelle_en for r in lignes}
        manquants = sorted(set(ids) - set(trouves))
        if manquants:
            raise HTTPException(422, f"{table} : identifiant(s) inconnu(s) {manquants}.")
        return trouves

    pays_ids = [d.pays_id for d in body.destinations if d.pays_id]
    region_ids = [d.region_id for d in body.destinations if d.region_id]
    if any(d.pays_id and d.region_id for d in body.destinations):
        raise HTTPException(422, "Une destination est un pays OU une région, pas les deux.")
    if any(not d.pays_id and not d.region_id for d in body.destinations):
        raise HTTPException(422, "Une destination sans pays ni région n'a pas de sens.")

    from app.services.fdi_projets import libelles_pays_en
    en_pays = libelles_pays_en()
    besoins = list({*pays_ids, *([body.pays_source_id] if body.pays_source_id else [])})
    iso = {r.id: (r.code_iso3, r.nom_fr) for r in (await db.execute(text(
        "SELECT id, code_iso3, nom_fr FROM ref_pays WHERE id = ANY(:ids)"),
        {"ids": besoins})).fetchall()} if besoins else {}
    inconnus = sorted(set(besoins) - set(iso))
    if inconnus:
        raise HTTPException(422, f"ref_pays : identifiant(s) inconnu(s) {inconnus}.")
    nom_pays = {i: (en_pays.get(c or "") or n) for i, (c, n) in iso.items()}

    regions = await libelles("fdi_regions_monde", region_ids)
    secteurs = await libelles("fdi_secteurs", body.secteurs)
    activites = await libelles("fdi_activites", body.activites)
    natures = await libelles("fdi_signaux", body.natures)

    lot_id = (await db.execute(text(
        "SELECT id FROM fdi_lots_import WHERE libelle = :l AND base = 'signaux'"),
        {"l": LOT_SAISIE})).scalar_one_or_none()
    if lot_id is None:
        lot_id = (await db.execute(text(
            "INSERT INTO fdi_lots_import (libelle, perimetre, sens, base, source, importe_par)"
            " VALUES (:l, 'Saisie', 'destination', 'signaux', 'saisie', :u) RETURNING id"),
            {"l": LOT_SAISIE, "u": str(user.get("email") or "admin")})).scalar_one()

    # Le rang n'identifie plus rien — il range les saisies dans leur lot, dans
    # l'ordre où elles sont arrivées.
    rang = 1 + (await db.execute(text(
        "SELECT coalesce(max(ligne), 0) FROM fdi_signaux_investisseurs WHERE lot_id = :i"),
        {"i": lot_id})).scalar_one()

    # LE MÊME LECTEUR QUE L'IMPORT pour la partie scalaire — période, maison
    # mère, entreprise, pays d'origine. Les quatre colonnes multiples lui sont
    # passées vides : elles ne viennent pas d'un texte à apparier mais de choix
    # déjà faits, qu'on pose juste après. Partager ce lecteur n'est pas une
    # économie : c'est la garantie qu'une entreprise saisie se rattache comme
    # une entreprise importée, alias compris.
    ref = await referentiels(db)
    ligne = {
        "ligne": rang,
        "date": f"{MOIS_EN[body.mois - 1]} {body.annee}",
        "parent": (body.parent or "").strip() or None,
        "entreprise": body.entreprise.strip(),
        "source": nom_pays.get(body.pays_source_id or 0),
        "destination": "-", "secteur": "-", "activite": "-", "signal": "-",
        "funding": "-", "capex": "-",
    }
    r = await resoudre_ligne(db, ligne, ref, lire_pays_csv(),
                             str(user.get("email") or "admin"))
    r.pop("manques")
    for nom, _, _ in LIAISONS:
        r.pop(nom)

    r["funding_musd"] = body.funding_musd
    r["funding_estime"] = body.funding_estime if body.funding_musd is not None else None
    r["capex_musd"] = body.capex_musd
    r["capex_estime"] = body.capex_estime if body.capex_musd is not None else None

    listes = {
        "destinations": [
            ({"rang": i, "brut": nom_pays[d.pays_id], "pays_id": d.pays_id, "region_id": None}
             if d.pays_id else
             {"rang": i, "brut": regions[d.region_id], "pays_id": None, "region_id": d.region_id})
            for i, d in enumerate(body.destinations, 1)],
        "secteurs":  [{"rang": i, "brut": secteurs[x], "secteur_id": x}
                      for i, x in enumerate(body.secteurs, 1)],
        "activites": [{"rang": i, "brut": activites[x], "activite_id": x}
                      for i, x in enumerate(body.activites, 1)],
        "natures":   [{"rang": i, "brut": natures[x], "nature_id": x}
                      for i, x in enumerate(body.natures, 1)],
    }

    r["empreinte"] = cle_signal(
        r["annee"], r["mois"], r["parent_brut"], r["entreprise_brut"],
        r["pays_source_brut"], r["funding_musd"], r["capex_musd"],
        signature_releve(listes))

    # DÉJÀ LÀ ? On refuse, et l'on dit où le trouver. Insérer un second
    # exemplaire ferait deux fiches pour un seul signal, chacune à compléter.
    existe = (await db.execute(text(
        "SELECT id FROM fdi_signaux_investisseurs WHERE empreinte = :e"),
        {"e": r["empreinte"]})).first()
    if existe:
        raise HTTPException(409, "Ce signal est déjà enregistré — il porte exactement "
                                 "la même période, la même entreprise et les mêmes "
                                 "valeurs.")

    signal_id = (await db.execute(text("""
        INSERT INTO fdi_signaux_investisseurs
            (lot_id, ligne, empreinte, annee, mois, parent_brut, parent_id,
             entreprise_brut, entreprise_id, statut_entreprise,
             pays_source_brut, pays_source_id,
             capex_musd, capex_estime, funding_musd, funding_estime,
             origine, modifie_le, modifie_par)
        VALUES (:lot, :ligne, :empreinte, :annee, :mois, :parent_brut, :parent_id,
                :entreprise_brut, :entreprise_id, :statut_entreprise,
                :pays_source_brut, :pays_source_id,
                :capex_musd, :capex_estime, :funding_musd, :funding_estime,
                'saisie', now(), :u)
        RETURNING id"""),
        {**r, "lot": lot_id, "u": str(user.get("email") or "admin")})).scalar_one()

    # Les valeurs portent l'origine « import » MÊME ICI, et ce n'est pas une
    # coquetterie : l'origine dit de quelle COLONNE du relevé vient la valeur,
    # pas qui l'a tapée. Le jour où un export rapporte ce signal, l'import
    # remplacera celles-là — ce sont les siennes — et laissera intactes celles
    # qu'on aura ajoutées ensuite en complétion.
    for nom, table, colonnes in LIAISONS:
        for v in listes[nom]:
            champs = ", ".join(colonnes)
            valeurs = ", ".join(f":{c}" for c in colonnes)
            await db.execute(text(
                f"INSERT INTO {table} (signal_id, rang, brut, {champs}, origine) "
                f"VALUES (:s, :rang, :brut, {valeurs}, 'import')"),
                {"s": signal_id, **v})

    await db.commit()
    return {"id": signal_id}


@router.delete("/signaux-investisseurs/{signal_id}", status_code=204)
async def supprimer_signal(signal_id: int,
                           db: AsyncSession = Depends(get_db),
                           user: dict = Depends(require_admin)):
    """Retire un signal de la base.

    POURQUOI IL LE FAUT. Depuis que l'identité tient au contenu, l'import ne
    supprime plus rien : une ligne absente d'une page a presque toujours glissé
    vers la suivante, et l'effacer pour la réinsérer lui ferait perdre tout ce
    qu'un humain y a posé. Restent deux cas où il faut pouvoir trancher à la
    main — une saisie fautive, et un signal que la source a retiré.

    Les valeurs rattachées partent avec, par les clés étrangères.
    """
    supprime = (await db.execute(text(
        "DELETE FROM fdi_signaux_investisseurs WHERE id = :i RETURNING id"),
        {"i": signal_id})).first()
    if not supprime:
        raise HTTPException(404, "Signal introuvable.")
    await db.commit()
