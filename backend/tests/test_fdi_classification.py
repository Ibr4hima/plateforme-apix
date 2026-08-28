"""La classification fDi versionnée décrit-elle une nomenclature exploitable ?

Ces tests portent sur les CSV du dépôt, pas sur la base : ils tournent sans
PostgreSQL et attrapent au plus tôt ce qui, sinon, casserait un import de
projets des mois plus tard — un libellé dédoublé, une traduction manquante,
un sous-secteur orphelin.
"""
import re

import pytest

from app.services.fdi_classification import (
    ClassificationInvalide,
    lire_csv,
    verifier,
)


@pytest.fixture(scope="module")
def tables():
    return lire_csv()


def test_effectifs_de_la_nomenclature(tables):
    """Les volumes de la source fDi, figés : un écart doit se remarquer."""
    rapport = verifier(tables)
    assert rapport["secteurs"] == 37
    assert rapport["sous_secteurs"] == 270
    assert rapport["activites"] == 17


def test_chaque_secteur_a_au_moins_un_sous_secteur(tables):
    assert verifier(tables)["secteurs_sans_sous_secteur"] == []


def test_un_libelle_partage_est_toujours_tranche_par_son_secteur(tables):
    """« Other » revient sous 24 secteurs, « Furniture & related products » sous 3.

    L'invariant qui rend l'appariement possible n'est pas que la source
    désambiguïse — elle ne le fait pas partout, voir le test suivant — mais
    que deux postes de même clé appartiennent toujours à des secteurs
    DIFFÉRENTS. Le couple (secteur, clé) reste donc discriminant, et c'est lui
    que la base contraint.
    """
    from collections import defaultdict
    par_cle = defaultdict(list)
    for s in tables["sous_secteurs"]:
        par_cle[s["cle_appariement"]].append(s["secteur_code"])
    partages = {c: v for c, v in par_cle.items() if len(v) > 1}
    assert partages, "aucun libellé partagé : la source a changé de convention"
    for cle, secteurs in partages.items():
        assert len(secteurs) == len(set(secteurs)), f"« {cle} » deux fois dans le même secteur"


def test_exception_connue_support_activities_for_mining(tables):
    """La seule entorse de la source à sa propre convention, gardée sous les yeux.

    fDi suffixe le secteur entre parenthèses quand un libellé sert à plusieurs
    secteurs — sauf ici : « Support activities for mining (Metals) » porte son
    secteur, mais son jumeau des Minéraux s'écrit « Support Activities for
    Mining », sans parenthèse et en capitales de titre.

    Deux conséquences, qui sont précisément ce que le schéma prévoit : un
    export de projets portant ce libellé nu ne peut être rattaché qu'avec sa
    colonne secteur, et l'appariement doit ignorer la casse. Si la source
    corrige un jour l'oubli, ce test tombera — et ce sera une bonne nouvelle à
    constater plutôt qu'une surprise à l'import.
    """
    nus = [
        s for s in tables["sous_secteurs"]
        if "(" not in s["libelle_en"]
        and sum(1 for x in tables["sous_secteurs"]
                if x["cle_appariement"] == s["cle_appariement"]) > 1
    ]
    assert [s["code"] for s in nus] == ["minerals__support_activities_for_mining"]


def test_le_libelle_verbatim_identifie_un_seul_sous_secteur(tables):
    """La forme verbatim est la clé d'appariement directe des exports fDi."""
    libelles = [s["libelle_en"] for s in tables["sous_secteurs"]]
    assert len(libelles) == len(set(libelles))


def test_toutes_les_traductions_sont_presentes(tables):
    for famille, lignes in tables.items():
        for l in lignes:
            assert l["libelle_fr"].strip(), f"{famille} : {l['code']} sans libellé français"
            assert l["libelle_en"].strip(), f"{famille} : {l['code']} sans libellé anglais"


def test_les_libelles_sont_propres(tables):
    """Ni espace en bordure ni espace double : ils fausseraient l'appariement."""
    for famille, lignes in tables.items():
        for l in lignes:
            for champ in ("libelle_en", "libelle_fr"):
                v = l[champ]
                assert v == v.strip() and "  " not in v, f"{famille}/{l['code']} : « {v} »"


def test_la_cle_dapariement_est_normalisee(tables):
    """Minuscules, sans accent, sans ponctuation : la forme qui absorbe les
    écarts de casse d'un export à l'autre."""
    for l in tables["sous_secteurs"] + tables["activites"]:
        cle = l["cle_appariement"]
        assert cle == cle.lower()
        assert re.fullmatch(r"[a-z0-9 ]+", cle), f"clé non normalisée : « {cle} »"
        assert "&" not in cle and "  " not in cle


def test_la_base_est_le_libelle_sans_sa_parenthese(tables):
    for s in tables["sous_secteurs"]:
        attendu = re.sub(r"\s*\([^)]*\)\s*$", "", s["libelle_en"]).strip()
        assert s["libelle_en_base"] == attendu


def test_les_codes_derivent_du_secteur_parent(tables):
    """Un code de sous-secteur porte son secteur : lisible dans une URL, et
    stable si fDi renumérote sa nomenclature."""
    codes = {s["code"] for s in tables["secteurs"]}
    for s in tables["sous_secteurs"]:
        assert s["secteur_code"] in codes
        assert s["code"].startswith(f"{s['secteur_code']}__")
        assert re.fullmatch(r"[a-z0-9_]+", s["code"])


def test_ordre_contigu_par_famille(tables):
    for famille, lignes in tables.items():
        ordres = sorted(l["ordre"] for l in lignes)
        assert ordres == list(range(1, len(lignes) + 1)), f"{famille} : ordre troué"


def test_verifier_refuse_un_sous_secteur_orphelin(tables):
    corrompu = {k: [dict(l) for l in v] for k, v in tables.items()}
    corrompu["sous_secteurs"][0]["secteur_code"] = "secteur_inexistant"
    with pytest.raises(ClassificationInvalide, match="secteur inconnu"):
        verifier(corrompu)


def test_verifier_refuse_un_doublon_dans_un_secteur(tables):
    corrompu = {k: [dict(l) for l in v] for k, v in tables.items()}
    a, b = corrompu["sous_secteurs"][0], corrompu["sous_secteurs"][1]
    b["secteur_code"], b["cle_appariement"] = a["secteur_code"], a["cle_appariement"]
    with pytest.raises(ClassificationInvalide, match="clé d'appariement"):
        verifier(corrompu)
