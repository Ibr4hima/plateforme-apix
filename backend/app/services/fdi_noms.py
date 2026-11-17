"""Nommer l'entreprise d'une ligne, depuis les tableaux d'administration.

LE GESTE. Dans Project database comme dans Investor signals, on clique sur un
nom — société mère ou entreprise —, le texte se sélectionne, on tape, Entrée.
Les deux tableaux passent par ici : un même geste ne doit pas avoir deux effets
selon l'onglet.

CE QUE LE NOM ATTEINT dépend de ce qu'on corrige :

  · UN NOM COUPÉ, ENCORE À TRANCHER, qu'on complète — ou dont on garde la
    partie visible : il vaut PARTOUT où ce texte coupé attend encore son nom,
    projets et signaux, entreprise et société mère. C'est la règle des
    captures (cf. `fdi_captures.appliquer_nom`) : corriger « Aya Gold &
    Silver (… » sur une ligne et le retrouver sous ses points de suspension sur
    les cinq autres faisait de chaque correction une corvée à répéter.

  · UN NOM DÉJÀ TRANCHÉ, ou un nom qui ne prolonge pas le texte de fDi : la
    décision ne vaut que pour CETTE ligne. On corrige alors un rattachement —
    « Standard Chartered Bank » qui était en fait la filiale kényane — et
    l'étendre aux autres lignes de la même entreprise défairait des décisions
    prises à la main.

LA SOCIÉTÉ MÈRE ET L'ENTREPRISE D'UNE LIGNE. Quand fDi écrit le même texte
dans les deux colonnes, c'est le plus souvent la même société : nommer l'une
nomme aussi l'autre, tant que cette autre n'a PAS ENCORE DE NOM. Mais le même
texte peut cacher deux sociétés — « deVere Group » et sa filiale « deVere &
Partners » — et l'on donne alors à chaque case le sien. Un nom déjà donné ne
change donc que si l'on corrige cette case-là : sans cette règle, corriger
l'entreprise réécrivait la société mère, corriger la mère réécrivait
l'entreprise, et deux noms différents étaient impossibles à poser.

Dans les deux cas l'entreprise est PARTAGÉE : un nom déjà connu (même clef
normalisée) est repris plutôt que doublé, et sa graphie devient celle qu'on
vient de taper — « Nestlé » contre « Nestle » n'est pas une autre entreprise.
"""
from app.services import fdi_projets as P
from app.services.fdi_captures import accepter_nom, appliquer_nom, entreprise_nommee

TABLES = {"projets": "fdi_projets", "signaux": "fdi_signaux_investisseurs"}
ROLES = ("entreprise", "parent")


class NomRefuse(ValueError):
    """Un nom vide, lui-même coupé, ou une case qui n'a rien à nommer."""


class LigneIntrouvable(LookupError):
    pass


async def effacer_orphelines(db, ids) -> None:
    """Retire les entreprises qu'une correction vient de quitter, si PLUS RIEN
    ne les désigne — aucune ligne des deux relevés, ni comme entreprise ni
    comme société mère, et aucun alias. Une coquille corrigée ne doit pas
    survivre à sa correction : l'appariement par préfixe la proposerait
    ensuite, rejouant l'erreur qu'on vient de réparer. Ce que quelque chose
    désigne encore reste, même sans ligne : cela a peut-être été voulu."""
    from sqlalchemy import text

    for a in {i for i in ids if i}:
        await db.execute(text("""
            DELETE FROM fdi_entreprises e
             WHERE e.id = :a
               AND NOT EXISTS (SELECT 1 FROM fdi_signaux_investisseurs x
                                WHERE x.entreprise_id = :a OR x.parent_id = :a)
               AND NOT EXISTS (SELECT 1 FROM fdi_projets x
                                WHERE x.entreprise_id = :a OR x.parent_id = :a)
               AND NOT EXISTS (SELECT 1 FROM fdi_entreprise_alias x
                                WHERE x.entreprise_id = :a)"""), {"a": a})


async def nommer(db, base: str, ligne_id: int, role: str, nom: str,
                 utilisateur: str | None) -> dict:
    """Donne ce nom à la société mère ou à l'entreprise d'une ligne. Sans
    valider : l'appelant commet.

    Rend {nom, lignes, partout, renomme, suivie} : le nom tel qu'il est en
    base, le nombre de lignes qui le portent désormais, s'il a valu au delà de
    cette ligne, l'ancienne graphie d'une entreprise connue qu'il a renommée,
    et l'autre case de la ligne quand elle a suivi (« parent », « entreprise »).
    """
    from sqlalchemy import text

    table = TABLES[base]
    if role not in ROLES:
        raise NomRefuse("Case inconnue : société mère ou entreprise.")
    nom = " ".join(str(nom or "").split())
    if not nom:
        raise NomRefuse("Le nom complet est obligatoire.")
    if P.est_tronque(nom):
        raise NomRefuse("Ce nom est lui-même coupé : saisir le nom complet.")

    l = (await db.execute(text(f"""
        SELECT t.entreprise_brut, t.parent_brut, t.entreprise_id, t.parent_id,
               t.statut_entreprise, m.statut_nom AS statut_parent
          FROM {table} t LEFT JOIN fdi_entreprises m ON m.id = t.parent_id
         WHERE t.id = :i"""), {"i": ligne_id})).first()
    if not l:
        raise LigneIntrouvable(ligne_id)
    brut = l.entreprise_brut if role == "entreprise" else l.parent_brut
    if not brut:
        raise NomRefuse("Cette ligne n'a pas de société mère à nommer." if role == "parent"
                        else "Cette ligne n'a pas d'entreprise à nommer.")
    # Une case « à trancher » n'a pas encore de nom : l'entreprise n'est pas
    # résolue, la société mère n'est rattachée à rien, ou à un nom coupé.
    ent_a_trancher = l.statut_entreprise != "resolu"
    mere_a_trancher = l.parent_id is None or l.statut_parent == "tronque"
    a_trancher = ent_a_trancher if role == "entreprise" else mere_a_trancher

    if a_trancher and P.est_tronque(brut) and accepter_nom(brut, nom):
        # `appliquer_nom` ne touche que ce qui attend encore son nom : l'autre
        # case de la ligne suit si elle porte ce texte et n'en a pas.
        lignes, renomme = await appliquer_nom(db, brut, nom, utilisateur)
        return {"nom": nom, "lignes": lignes, "partout": True, "renomme": renomme,
                "suivie": None}

    eid, renomme = await entreprise_nommee(db, nom, utilisateur)

    # Cette ligne seulement. L'autre case suit si elle porte le même texte ET
    # n'a pas encore de nom — jamais quand on lui en a déjà donné un.
    meme_libelle = (l.parent_brut or "") == (l.entreprise_brut or "")
    ent = role == "entreprise" or (meme_libelle and ent_a_trancher)
    mere = role == "parent" or (meme_libelle and mere_a_trancher)
    await db.execute(text(f"""
        UPDATE {table}
           SET entreprise_id = CASE WHEN :ent THEN :e ELSE entreprise_id END,
               statut_entreprise = CASE WHEN :ent THEN 'resolu' ELSE statut_entreprise END,
               parent_id = CASE WHEN :mere THEN :e ELSE parent_id END,
               modifie_le = now(), modifie_par = :u
         WHERE id = :i"""),
        {"e": eid, "ent": ent, "mere": mere, "u": utilisateur, "i": ligne_id})
    await effacer_orphelines(db, [x for x, pris in ((l.entreprise_id, ent), (l.parent_id, mere))
                                   if pris and x != eid])
    suivie = ("parent" if role == "entreprise" and mere
              else "entreprise" if role == "parent" and ent else None)
    return {"nom": nom, "lignes": 1, "partout": False, "renomme": renomme, "suivie": suivie}
