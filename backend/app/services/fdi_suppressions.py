"""Supprimer une ligne fDi depuis l'administration — et la rétablir.

UNE SUPPRESSION QUI TIENT. Effacer une ligne du relevé ne suffisait pas : le
réimport la ramenait dès que sa page, ou le code qui la lit, changeait, et la
capture suivante de sa page la proposait de nouveau comme « nouvelle ». La
ligne supprimée laisse donc une trace (`fdi_lignes_supprimees`, migration
160) :

  · l'import la saute — un projet tant que son rang décrit le même projet
    (`fdi_projets.meme_projet`), un signal tant que son contenu est le même
    (son empreinte) ;
  · la capture la reconnaît et ne la verse plus (statut « supprimée ») ;
  · l'écran peut la rétablir telle qu'elle était, valeurs rattachées comprises.

Une saisie manuelle n'a pas de source qui la ramènerait : sa trace sert
seulement à la rétablir, et ne bloque rien.
"""
TABLES = {"projets": "fdi_projets", "signaux": "fdi_signaux_investisseurs"}

# Ce qu'un signal emporte avec lui (clés étrangères en cascade) — à garder dans
# la trace pour pouvoir le rétablir entier.
VALEURS_SIGNAL = ("fdi_signal_destinations", "fdi_signal_secteurs",
                  "fdi_signal_activites", "fdi_signal_natures")


class LigneIntrouvable(LookupError):
    pass


class RetablissementImpossible(ValueError):
    pass


async def supprimer(db, base: str, ligne_id: int, utilisateur: str | None) -> dict:
    """Supprime la ligne et pose sa trace. Sans valider : l'appelant commet.
    Rend {id, trace, origine, lot}."""
    from sqlalchemy import text

    table = TABLES[base]
    l = (await db.execute(text(f"""
        SELECT t.id, t.lot_id, t.ligne, t.annee, t.mois, t.origine, lo.libelle AS lot,
               {"t.empreinte" if base == "signaux" else "NULL::text"} AS empreinte,
               to_jsonb(t.*) AS ligne_json
          FROM {table} t JOIN fdi_lots_import lo ON lo.id = t.lot_id
         WHERE t.id = :i"""), {"i": ligne_id})).first()
    if not l:
        raise LigneIntrouvable(ligne_id)

    donnees: dict = {"ligne": l.ligne_json}
    if base == "signaux":
        donnees["valeurs"] = {}
        for t in VALEURS_SIGNAL:
            donnees["valeurs"][t] = (await db.execute(text(
                f"SELECT coalesce(jsonb_agg(to_jsonb(x.*) ORDER BY x.rang), '[]'::jsonb) "
                f"  FROM {t} x WHERE x.signal_id = :i"), {"i": ligne_id})).scalar_one()

    # Une seule trace par projet du relevé (son rang) et par signal (son
    # contenu) : supprimer de nouveau ce qui était revenu la remplace.
    conflit = ""
    if l.origine == "import":
        conflit = ("ON CONFLICT (lot_libelle, ligne) WHERE base = 'projets' AND origine = 'import'"
                   if base == "projets" else
                   "ON CONFLICT (empreinte) WHERE base = 'signaux' AND origine = 'import'")
        conflit += (" DO UPDATE SET donnees = EXCLUDED.donnees, annee = EXCLUDED.annee, "
                    "mois = EXCLUDED.mois, supprime_le = now(), supprime_par = EXCLUDED.supprime_par")
    trace = (await db.execute(text(f"""
        INSERT INTO fdi_lignes_supprimees
            (base, origine, lot_libelle, ligne, empreinte, annee, mois, donnees, supprime_par)
        VALUES (:b, :o, :lot, :ligne, :e, :a, :m, CAST(:d AS jsonb), :u)
        {conflit}
        RETURNING id"""),
        {"b": base, "o": l.origine, "lot": l.lot, "ligne": l.ligne, "e": l.empreinte,
         "a": l.annee, "m": l.mois, "d": _json(donnees), "u": utilisateur})).scalar_one()

    await db.execute(text(f"DELETE FROM {table} WHERE id = :i"), {"i": ligne_id})
    await db.execute(text(
        f"UPDATE fdi_lots_import SET nb_lignes = (SELECT count(*) FROM {table} WHERE lot_id = :l) "
        f" WHERE id = :l"), {"l": l.lot_id})
    return {"id": ligne_id, "trace": trace, "origine": l.origine, "lot": l.lot}


async def retablir(db, trace_id: int) -> dict:
    """Remet la ligne telle qu'elle était, et efface sa trace. Sans valider.
    Rend {base, id}."""
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    t = (await db.execute(text(
        "SELECT base, lot_libelle, donnees FROM fdi_lignes_supprimees WHERE id = :i"),
        {"i": trace_id})).first()
    if not t:
        raise LigneIntrouvable(trace_id)
    table = TABLES[t.base]
    ligne = dict(t.donnees["ligne"])

    # Le lot se retrouve par son libellé : son identifiant a pu changer, s'il a
    # été recréé depuis.
    lot = (await db.execute(text(
        "SELECT id FROM fdi_lots_import WHERE libelle = :l AND base = :b"),
        {"l": t.lot_libelle, "b": t.base})).first()
    if not lot:
        raise RetablissementImpossible(f"Le lot « {t.lot_libelle} » n'existe plus : "
                                       "la ligne ne peut pas y revenir.")
    ligne["lot_id"] = lot.id
    # Une entreprise retirée entre-temps — elle n'avait plus de ligne : la
    # ligne revient sans elle, à trancher de nouveau, plutôt que pas du tout.
    for col in ("entreprise_id", "parent_id"):
        if ligne.get(col) and not (await db.execute(text(
                "SELECT 1 FROM fdi_entreprises WHERE id = :i"), {"i": ligne[col]})).first():
            ligne[col] = None
            if col == "entreprise_id":
                ligne["statut_entreprise"] = "en_attente"

    try:
        async with db.begin_nested():
            await db.execute(text(
                f"INSERT INTO {table} SELECT * FROM jsonb_populate_record(NULL::{table}, CAST(:d AS jsonb))"),
                {"d": _json(ligne)})
            for tv, valeurs in (t.donnees.get("valeurs") or {}).items():
                if tv in VALEURS_SIGNAL and valeurs:
                    await db.execute(text(
                        f"INSERT INTO {tv} SELECT * FROM jsonb_populate_recordset(NULL::{tv}, CAST(:d AS jsonb))"),
                        {"d": _json(valeurs)})
    except IntegrityError as e:
        raise RetablissementImpossible(
            "La ligne est revenue entre-temps, ou son rang est repris par une autre : "
            "rien n'a été rétabli.") from e

    await db.execute(text("DELETE FROM fdi_lignes_supprimees WHERE id = :i"), {"i": trace_id})
    await db.execute(text(
        f"UPDATE fdi_lots_import SET nb_lignes = (SELECT count(*) FROM {table} WHERE lot_id = :l) "
        f" WHERE id = :l"), {"l": lot.id})
    return {"base": t.base, "id": ligne["id"]}


async def projets_supprimes(db, libelle: str) -> dict[int, dict]:
    """{rang : trace} — les projets supprimés de ce lot, que l'import doit sauter."""
    from sqlalchemy import text

    return {r.ligne: {"id": r.id, "ligne": r.donnees["ligne"]} for r in (await db.execute(text(
        "SELECT id, ligne, donnees FROM fdi_lignes_supprimees "
        " WHERE base = 'projets' AND origine = 'import' AND lot_libelle = :l"),
        {"l": libelle})).fetchall()}


async def signaux_supprimes(db, empreintes: list[str] | None = None) -> dict[str, dict]:
    """{empreinte : trace} — les signaux supprimés, que l'import doit sauter et
    que la capture doit reconnaître. Restreint aux empreintes données s'il y en a."""
    from sqlalchemy import text

    filtre, params = "", {}
    if empreintes is not None:
        if not empreintes:
            return {}
        filtre, params = " AND empreinte = ANY(:e)", {"e": empreintes}
    return {r.empreinte: {"id": r.id, "le": r.supprime_le, "par": r.supprime_par}
            for r in (await db.execute(text(
                "SELECT id, empreinte, supprime_le, supprime_par FROM fdi_lignes_supprimees "
                f" WHERE base = 'signaux' AND origine = 'import'{filtre}"), params)).fetchall()}


def _json(v) -> str:
    import json
    return json.dumps(v, ensure_ascii=False, default=str)

