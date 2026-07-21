# Commerce extérieur du Sénégal (Bulletin ANSD) — import du PDF du
# bulletin (extraction auto-vérifiée) et lecture des flux bruts.
# Les dérivés (cumuls, variations, VU, parts, balance) sont calculés
# à la volée selon les règles ANSD, jamais stockés.
import tempfile
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.bmce_extraction import BRUTS, Bulletin

router = APIRouter(prefix="/bmce", tags=["commerce-exterieur"])

# Tableau du bulletin → (catégorie, sens, porte)
TABLES = {
    1:  ("ensemble", "export"), 2: ("ensemble", "import"),
    3:  ("groupe_utilisation", "export"), 4: ("groupe_utilisation", "export"),
    7:  ("groupe_utilisation", "import"), 8: ("groupe_utilisation", "import"),
    11: ("produit_regroupe", "export"), 12: ("produit_regroupe", "export"),
    15: ("produit_regroupe", "import"), 16: ("produit_regroupe", "import"),
    19: ("chapitre", "export"), 20: ("chapitre", "export"),
    23: ("chapitre", "import"), 24: ("chapitre", "import"),
    27: ("pays", "export"), 29: ("pays", "import"),
}
EN_VALEUR = {1, 2, 3, 7, 11, 15, 19, 23, 27, 29}   # sinon : poids
MOIS_FR = {"janv": 1, "févr": 2, "mars": 3, "avr": 4, "mai": 5, "juin": 6,
           "juil": 7, "août": 8, "sept": 9, "oct": 10, "nov": 11, "déc": 12}


def _date_de(mois: str) -> date:
    nom, annee = mois.split("-")
    return date(2000 + int(annee), MOIS_FR[nom], 1)


@router.post("/importer")
async def importer_bmce(
    fichier: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if not (fichier.filename or "").lower().endswith(".pdf"):
        raise HTTPException(422, "Le bulletin doit être un PDF ANSD.")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await fichier.read())
        chemin = Path(tmp.name)
    try:
        bulletin = Bulletin(chemin)
    except FileNotFoundError:
        chemin.unlink(missing_ok=True)
        raise HTTPException(500,
            "pdftotext est introuvable sur le serveur. Installer poppler-utils "
            "(macOS : brew install poppler · Debian/Ubuntu : apt-get install poppler-utils · "
            "Docker : reconstruire l'image backend, le paquet y est désormais inclus).")
    try:
        bulletin.extraire()
        rapport = bulletin.verifier()   # lève si l'extraction n'est pas fiable
    except SystemExit as e:
        raise HTTPException(422, f"Extraction refusée : {e}")
    except Exception as e:
        raise HTTPException(422, f"Bulletin illisible : {e}")
    finally:
        chemin.unlink(missing_ok=True)

    mois = [_date_de(m) for m in bulletin.mois[1:]]   # les 4 mois retenus
    periode_bulletin = mois[-1]

    # Lot d'import (un bulletin ré-importé remplace son journal)
    await db.execute(text("DELETE FROM bmce_bulletins WHERE periode = :p"), {"p": periode_bulletin})
    res = await db.execute(text(
        "INSERT INTO bmce_bulletins (periode, fichier_nom, mois_couverts, rapport) "
        "VALUES (:p, :f, :m, :r) RETURNING id"),
        {"p": periode_bulletin, "f": fichier.filename, "m": mois, "r": "\n".join(rapport)})
    bulletin_id = res.scalar_one()

    # Fusion valeur/poids par (tableau logique, libellé, mois) puis upsert
    nb_valeurs = nb_revisions = 0
    lots: dict[tuple[str, str, str], dict[date, dict]] = {}
    for num in BRUTS:
        categorie, sens = TABLES[num]
        porte = "valeur_fcfa" if num in EN_VALEUR else "poids_kg"
        facteur = 1.0 if num in (1, 2) else (1e6 if porte == "valeur_fcfa" else 1e3)
        for ordre, (libelle, vals) in enumerate(bulletin.tables[num].items()):
            if libelle.upper() == "TOTAL":
                continue
            lib = "ENSEMBLE" if categorie == "ensemble" else libelle
            cle = (categorie, sens, lib)
            lots.setdefault(cle, {})
            for m, v in zip(mois, vals[1:5]):
                lots[cle].setdefault(m, {"ordre": ordre})
                lots[cle][m][porte] = None if v is None else v * facteur

    for (categorie, sens, libelle), par_mois in lots.items():
        ordre = next(iter(par_mois.values()))["ordre"]
        res = await db.execute(text(
            "INSERT INTO bmce_rubriques (categorie, sens, libelle, ordre) "
            "VALUES (:c, :s, :l, :o) "
            "ON CONFLICT (categorie, sens, libelle) DO UPDATE SET ordre = EXCLUDED.ordre "
            "RETURNING id"),
            {"c": categorie, "s": sens, "l": libelle, "o": ordre})
        rubrique_id = res.scalar_one()
        for m, champs in par_mois.items():
            res = await db.execute(text(
                "INSERT INTO bmce_flux (rubrique_id, periode, valeur_fcfa, poids_kg, bulletin_id) "
                "VALUES (:r, :p, :v, :k, :b) "
                "ON CONFLICT (rubrique_id, periode) DO UPDATE SET "
                "  valeur_fcfa = EXCLUDED.valeur_fcfa, poids_kg = EXCLUDED.poids_kg, "
                "  bulletin_id = EXCLUDED.bulletin_id "
                "RETURNING (xmax <> 0) AS revise"),
                {"r": rubrique_id, "p": m, "v": champs.get("valeur_fcfa"), "k": champs.get("poids_kg"), "b": bulletin_id})
            nb_valeurs += 1
            if res.scalar_one():
                nb_revisions += 1

    await db.execute(text(
        "UPDATE bmce_bulletins SET nb_valeurs = :v, nb_revisions = :r WHERE id = :i"),
        {"v": nb_valeurs, "r": nb_revisions, "i": bulletin_id})
    await db.commit()
    return {
        "bulletin": str(periode_bulletin), "mois_couverts": [str(m) for m in mois],
        "valeurs": nb_valeurs, "revisions": nb_revisions,
        "rapport": rapport[0], "avertissements": [l for l in rapport[1:] if l.startswith("⚠")],
    }


@router.get("/bulletins")
async def lister_bulletins(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT periode, fichier_nom, importe_le, mois_couverts, nb_valeurs, nb_revisions, rapport "
        "FROM bmce_bulletins ORDER BY periode DESC"))
    return [dict(r._mapping) for r in res]


@router.get("/flux")
async def lire_flux(categorie: str, sens: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT r.libelle, r.ordre, f.periode, f.valeur_fcfa, f.poids_kg "
        "FROM bmce_flux f JOIN bmce_rubriques r ON r.id = f.rubrique_id "
        "WHERE r.categorie = :c AND r.sens = :s ORDER BY r.ordre, f.periode"),
        {"c": categorie, "s": sens})
    return [dict(r._mapping) for r in res]


# ── Lecture publique : dérivés calculés selon les règles ANSD ────────────────
# Variation depuis zéro/absence = indéfinie (null) ; -100 % légitime ;
# VU = valeur/poids ; VU du cumul = Σ valeurs / Σ poids ; part = valeur/ensemble.

def _variation(v, prec):
    """Règles ANSD : prec nul ou absent → indéfinie (None) ; v absent → -100."""
    if prec is None or prec == 0:
        return None
    if v is None:
        v = 0.0
    return round((float(v) - float(prec)) / abs(float(prec)) * 100.0, 2)


@router.get("/apercu")
async def apercu_bmce(db: AsyncSession = Depends(get_db)):
    """KPIs du dernier mois (X FAB, M CAF, balance, taux de couverture) +
    séries mensuelles de l'ensemble et cumuls de l'année en cours."""
    res = await db.execute(text(
        "SELECT r.sens, f.periode, f.valeur_fcfa, f.poids_kg "
        "FROM bmce_flux f JOIN bmce_rubriques r ON r.id = f.rubrique_id "
        "WHERE r.categorie = 'ensemble' ORDER BY f.periode"))
    lignes = [dict(r._mapping) for r in res]
    if not lignes:
        return {"disponible": False}
    par_mois: dict = {}
    for l in lignes:
        m = par_mois.setdefault(str(l["periode"]), {"periode": str(l["periode"])})
        m[l["sens"]] = {"valeur": float(l["valeur_fcfa"]) if l["valeur_fcfa"] is not None else None,
                        "poids": float(l["poids_kg"]) if l["poids_kg"] is not None else None}
    serie = [par_mois[k] for k in sorted(par_mois)]
    dernier, precedent = serie[-1], (serie[-2] if len(serie) > 1 else None)
    x = (dernier.get("export") or {}).get("valeur")
    m_ = (dernier.get("import") or {}).get("valeur")
    annee = dernier["periode"][:4]
    cumul_x = sum((p.get("export") or {}).get("valeur") or 0 for p in serie if p["periode"].startswith(annee))
    cumul_m = sum((p.get("import") or {}).get("valeur") or 0 for p in serie if p["periode"].startswith(annee))
    # Fraîcheur : quels mois sont encore révisables (couverts par le dernier bulletin) ?
    res = await db.execute(text("SELECT mois_couverts FROM bmce_bulletins ORDER BY periode DESC LIMIT 1"))
    couverts = res.scalar_one_or_none() or []
    return {
        "disponible": True,
        "dernier_mois": dernier["periode"],
        "exportations_fab": x, "importations_caf": m_,
        "balance": (x - m_) if x is not None and m_ is not None else None,
        "taux_couverture": round(x / m_ * 100.0, 2) if x and m_ else None,
        "variation_export": _variation(x, (precedent.get("export") or {}).get("valeur") if precedent else None),
        "variation_import": _variation(m_, (precedent.get("import") or {}).get("valeur") if precedent else None),
        "cumul_annee": {"annee": annee, "exportations_fab": cumul_x, "importations_caf": cumul_m,
                        "balance": cumul_x - cumul_m},
        "mois_provisoires": [str(c) for c in couverts],
        "serie": serie,
    }


@router.get("/series")
async def series_bmce(categorie: str, sens: str, db: AsyncSession = Depends(get_db)):
    """Séries mensuelles par rubrique avec dérivés ANSD : VU, variation
    mensuelle (null si indéfinie), part du total du mois, VU du cumul."""
    if categorie not in ("groupe_utilisation", "produit_regroupe", "chapitre", "pays"):
        raise HTTPException(422, "catégorie inconnue")
    if sens not in ("export", "import"):
        raise HTTPException(422, "sens inconnu")
    res = await db.execute(text(
        "SELECT r.libelle, r.ordre, f.periode, f.valeur_fcfa, f.poids_kg "
        "FROM bmce_flux f JOIN bmce_rubriques r ON r.id = f.rubrique_id "
        "WHERE r.categorie = :c AND r.sens = :s ORDER BY r.ordre, f.periode"),
        {"c": categorie, "s": sens})
    lignes = [dict(r._mapping) for r in res]
    # Ensemble du même sens : dénominateur des parts
    res = await db.execute(text(
        "SELECT f.periode, f.valeur_fcfa FROM bmce_flux f "
        "JOIN bmce_rubriques r ON r.id = f.rubrique_id "
        "WHERE r.categorie = 'ensemble' AND r.sens = :s"), {"s": sens})
    totaux = {str(r._mapping["periode"]): float(r._mapping["valeur_fcfa"])
              for r in res if r._mapping["valeur_fcfa"] is not None}

    rubriques: dict = {}
    for l in lignes:
        rub = rubriques.setdefault(l["libelle"], {"libelle": l["libelle"], "ordre": l["ordre"], "data": []})
        v = float(l["valeur_fcfa"]) if l["valeur_fcfa"] is not None else None
        k = float(l["poids_kg"]) if l["poids_kg"] is not None else None
        total = totaux.get(str(l["periode"]))
        rub["data"].append({
            "periode": str(l["periode"]), "valeur_fcfa": v, "poids_kg": k,
            "vu_fcfa_kg": round(v / k, 1) if v is not None and k else None,
            "part_pct": round(v / total * 100.0, 2) if v is not None and total else None,
        })
    for rub in rubriques.values():
        rub["data"].sort(key=lambda d: d["periode"])
        prec = None
        somme_v = somme_k = 0.0
        for point in rub["data"]:
            point["variation_pct"] = _variation(point["valeur_fcfa"], prec)
            prec = point["valeur_fcfa"]
            somme_v += point["valeur_fcfa"] or 0
            somme_k += point["poids_kg"] or 0
        # VU du cumul : rapport des cumuls (règle ANSD), jamais moyenne des VU
        rub["vu_cumul_fcfa_kg"] = round(somme_v / somme_k, 1) if somme_k else None
    return sorted(rubriques.values(), key=lambda r: r["ordre"])
