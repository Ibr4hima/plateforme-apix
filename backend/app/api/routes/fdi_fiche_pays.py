"""fDi Markets dans la Fiche Pays — ce qu'un pays investit, ou compte investir,
au Sénégal.

UNE SEULE LECTURE, CELLE DE L'APIX. La Fiche Pays compare deux pays
quelconques, mais les relevés fDi n'ont été constitués que du point de vue du
Sénégal : ce service ne répond donc que pour un PARTENAIRE du Sénégal, et la
page ne l'appelle que pour une fiche « Sénégal × X ». Une fiche Mali × France
n'a pas de section fDi, et c'est voulu.

DEUX LISTES, ET DEUX RÈGLES DIFFÉRENTES :

  · LES PROJETS vont du partenaire VERS LE SÉNÉGAL, et vers lui seul. Un projet
    est un fait localisé : il a une destination, et c'est elle qu'on lit.

  · LES SIGNAUX partent du partenaire et visent le Sénégal, un pays d'Afrique
    de l'Ouest, ou l'Afrique en général. Un signal est une intention, souvent
    formulée à l'échelle d'une région — « s'étendre en Afrique de l'Ouest » —,
    et c'est précisément à ce stade que la prospection a prise : une
    entreprise qui vise Abidjan ou le continent est une entreprise que l'APIX
    peut chercher à attirer à Dakar. fDi n'a pas de région « Afrique de
    l'Ouest » ; la zone se lit donc sur les PAYS visés, via le référentiel
    (`ref_pays.region_geo`), comme partout ailleurs sur la plateforme.

LES LISTES SONT RENDUES ENTIÈRES. L'écran les trie sur chaque colonne et en
montre dix à la fois : une liste coupée ici sur un critère puis retriée
là-bas sur un autre perdrait des lignes sans le dire. Leur taille reste
modeste — les projets d'UN pays vers UN pays.

Les lignes sont sérialisées par les MÊMES fonctions que les vues Projets et
Signaux : la fiche qui s'ouvre au clic est celle de ces vues, et elle doit
trouver les mêmes champs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.routes.fdi_public import COLONNES_PROJET, JOINTURES, serialiser_projet
from app.api.routes.fdi_signaux import LISTES, ORDRE_SIGNAUX
from app.api.routes.fdi_signaux_public import destinations_publiques

router = APIRouter(prefix="/fdi/public", tags=["fdi"])

# Le Sénégal est désigné par son code ISO, non par son identifiant : ce dernier
# dépend de l'ordre de chargement du référentiel et diffère d'une base à l'autre.
SENEGAL = "SEN"

# LA CIBLE D'UN SIGNAL, du plus précis au plus large. « Afrique » est la seule
# région fDi qui contienne le Sénégal ; son code est stable, là où le libellé
# se traduit.
CIBLE_SIGNAL = """
    EXISTS (SELECT 1 FROM fdi_signal_destinations d
              LEFT JOIN ref_pays dp ON dp.id = d.pays_id
              LEFT JOIN fdi_regions_monde dr ON dr.id = d.region_id
             WHERE d.signal_id = s.id
               AND (dp.id = :sen
                    OR dp.region_geo = 'Afrique de l''Ouest'
                    OR dr.code = 'africa'))
"""


@router.get("/fiche-pays")
async def fdi_fiche_pays(partenaire_id: int, db: AsyncSession = Depends(get_db)):
    """Les projets du partenaire au Sénégal, et ses signaux vers la zone."""
    sen = (await db.execute(text("SELECT id FROM ref_pays WHERE code_iso3 = :c"),
                            {"c": SENEGAL})).scalar()
    if sen is None or partenaire_id == sen:
        return {"projets": [], "signaux": []}

    # Sens « destination » : le pays observé est le Sénégal, le partenaire est
    # l'origine — les mêmes jointures que la vue Projets.
    observe, partenaire = "pays_dest", "pays_source"
    projets = (await db.execute(text(f"""
        SELECT {COLONNES_PROJET.format(observe=observe, partenaire=partenaire)}
        {JOINTURES.format(observe=observe, partenaire=partenaire)}
        WHERE p.pays_dest_id = :sen AND p.pays_source_id = :part
        ORDER BY p.capex_musd DESC NULLS LAST, p.annee DESC, p.mois DESC NULLS LAST, p.id"""),
        {"sen": sen, "part": partenaire_id})).fetchall()

    signaux = (await db.execute(text(f"""
        SELECT s.id, s.annee, s.mois,
               s.capex_musd, s.capex_estime, s.funding_musd, s.funding_estime,
               s.description_fr, s.description_en,
               e.nom AS entreprise, pa.nom AS parent,
               p.nom_fr AS origine, p.code_iso2 AS origine_iso,
               {LISTES}
        FROM fdi_signaux_investisseurs s
        LEFT JOIN fdi_entreprises e  ON e.id  = s.entreprise_id
        LEFT JOIN fdi_entreprises pa ON pa.id = s.parent_id
        LEFT JOIN ref_pays p ON p.id = s.pays_source_id
        WHERE s.pays_source_id = :part AND {CIBLE_SIGNAL}
        ORDER BY {ORDRE_SIGNAUX}"""), {"sen": sen, "part": partenaire_id})).fetchall()

    def _f(v):
        return float(v) if v is not None else None

    return {
        "projets": [serialiser_projet(r) for r in projets],
        # Même forme que la liste de la vue Signaux, champ pour champ.
        "signaux": [{
            "id": r.id, "periode": f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee),
            "entreprise": r.entreprise, "parent": r.parent,
            "origine": r.origine, "origine_iso": r.origine_iso,
            "capex_musd": _f(r.capex_musd), "capex_estime": r.capex_estime,
            "funding_musd": _f(r.funding_musd), "funding_estime": r.funding_estime,
            "description_fr": r.description_fr, "description_en": r.description_en,
            "destinations": destinations_publiques(r.destinations), "secteurs": r.secteurs,
            "activites": r.activites, "natures": r.natures,
        } for r in signaux],
    }
