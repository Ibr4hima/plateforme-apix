import os, shutil, uuid as uuid_lib
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import require_admin
from app.models.code_investissement import CodePdf, CodeChapitre, CodeSection, CodeArticle
from app.core.uploads import lire_pdf

router = APIRouter(prefix="/code-investissement", tags=["Code des investissements"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/code_investissement")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LOAD_OPTS = [
    selectinload(CodeChapitre.sections),
    selectinload(CodeChapitre.articles).selectinload(CodeArticle.section),
]


# ── Numérotation ordinale française ───────────────────────────────────────────
def to_roman(n: int) -> str:
    vals = [(1000,"M"),(900,"CM"),(500,"D"),(400,"CD"),(100,"C"),(90,"XC"),
            (50,"L"),(40,"XL"),(10,"X"),(9,"IX"),(5,"V"),(4,"IV"),(1,"I")]
    r = ""
    for v, s in vals:
        while n >= v: r += s; n -= v
    return r

def num_chapitre(n: int) -> str:
    return "premier" if n == 1 else to_roman(n)

def num_section(n: int) -> str:
    return "première" if n == 1 else to_roman(n)

def num_article(n: int) -> str:
    return "premier" if n == 1 else str(n)


# ── Sérialisation ─────────────────────────────────────────────────────────────
def article_to_dict(a: CodeArticle) -> dict:
    return {
        "id":          str(a.id),
        "numero":      a.numero,
        "num_display": num_article(a.numero),
        "titre":       a.titre,
        "contenu":     a.contenu,
        "section_id":  str(a.section_id) if a.section_id else None,
        "chapitre_id": str(a.chapitre_id),
    }

def section_to_dict(s: CodeSection, articles: list) -> dict:
    return {
        "id":          str(s.id),
        "numero":      s.numero,
        "num_display": num_section(s.numero),
        "titre":       s.titre,
        "contenu":     s.contenu or "",
        "chapitre_id": str(s.chapitre_id),
        "articles":    [article_to_dict(a) for a in articles if a.section_id == s.id],
    }

def chapitre_to_dict(c: CodeChapitre) -> dict:
    direct = [a for a in c.articles if not a.section_id]
    return {
        "id":          str(c.id),
        "numero":      c.numero,
        "num_display": num_chapitre(c.numero),
        "titre":       c.titre,
        "contenu":     c.contenu or "",
        "sections":    [section_to_dict(s, c.articles) for s in c.sections],
        "articles":    [article_to_dict(a) for a in direct],
    }


# ── PDF ───────────────────────────────────────────────────────────────────────
@router.get("/pdf/info")
async def get_pdf_info(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CodePdf).order_by(CodePdf.created_at.desc()).limit(1))
    p   = res.scalar_one_or_none()
    if not p: return None
    return {"id": str(p.id), "titre": p.titre, "version": p.version, "fichier_nom": p.fichier_nom}

@router.post("/pdf", status_code=201)
async def upload_pdf(
    titre:   str        = Form("Code des investissements du Sénégal"),
    version: str        = Form(""),
    fichier: UploadFile = File(...),
    db:      AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    contenu = await lire_pdf(fichier)
    with open(dest, "wb") as f: f.write(contenu)
    # Remplacer l'ancien PDF s'il existe
    res = await db.execute(select(CodePdf).order_by(CodePdf.created_at.desc()).limit(1))
    old = res.scalar_one_or_none()
    if old:
        # Supprime toujours l'ancienne fiche, même si son fichier est déjà absent
        # (sinon des lignes s'accumulent et l'ancienne peut rester servie).
        if old.fichier_path and os.path.exists(old.fichier_path):
            os.remove(old.fichier_path)
        await db.delete(old)
    pdf = CodePdf(titre=titre, version=version or None, fichier_nom=fichier.filename, fichier_path=dest)
    db.add(pdf)
    await db.flush()
    return {"id": str(pdf.id), "titre": pdf.titre, "version": pdf.version, "fichier_nom": pdf.fichier_nom}

@router.patch("/pdf/{pdf_id}")
async def renommer_pdf(pdf_id: UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodePdf).where(CodePdf.id == pdf_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "PDF introuvable")
    if "titre"   in payload: p.titre   = payload["titre"]   or p.titre
    if "version" in payload: p.version = payload["version"] or None
    await db.flush()
    return {"id": str(p.id), "titre": p.titre, "version": p.version, "fichier_nom": p.fichier_nom}


@router.get("/pdf/download")
async def download_pdf(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CodePdf).order_by(CodePdf.created_at.desc()).limit(1))
    p   = res.scalar_one_or_none()
    if not p or not p.fichier_path: raise HTTPException(404, "PDF non disponible")
    # Le chemin enregistré peut être un chemin absolu propre à la machine où le
    # PDF a été téléversé. On retombe sur le nom de fichier dans le dossier
    # d'uploads courant pour rester indépendant de la machine et éviter un 500.
    path = p.fichier_path
    if not os.path.exists(path):
        path = os.path.join(UPLOAD_DIR, os.path.basename(p.fichier_path))
    if not os.path.exists(path):
        raise HTTPException(404, "Fichier PDF introuvable sur le serveur")
    return FileResponse(path, filename=p.fichier_nom, media_type="application/pdf",
                        headers={"Cache-Control": "no-store"})


# ── Lecture complète ──────────────────────────────────────────────────────────
@router.get("")
async def get_code(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(CodeChapitre).options(*LOAD_OPTS).order_by(CodeChapitre.numero)
    )
    chapitres = res.scalars().all()
    return [chapitre_to_dict(c) for c in chapitres]


# ── Recherche full-text ───────────────────────────────────────────────────────
@router.get("/search")
async def search_code(q: str, db: AsyncSession = Depends(get_db)):
    if len(q) < 2: return []
    res = await db.execute(text("""
        SELECT a.id, a.numero, a.titre, a.contenu, a.chapitre_id, a.section_id,
               ts_headline('french', a.contenu, plainto_tsquery('french', :q),
                   'MaxWords=20, MinWords=5, StartSel=<mark>, StopSel=</mark>') AS extrait
        FROM code_articles a
        WHERE to_tsvector('french', coalesce(a.titre,'') || ' ' || a.contenu)
              @@ plainto_tsquery('french', :q)
        ORDER BY a.numero LIMIT 20
    """), {"q": q})
    rows = res.fetchall()
    return [{"id": str(r[0]), "numero": r[1], "num_display": num_article(r[1]),
             "titre": r[2], "extrait": r[6], "chapitre_id": str(r[4])} for r in rows]


# ── CRUD Chapitres ────────────────────────────────────────────────────────────
@router.post("/chapitres", status_code=201)
async def creer_chapitre(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    c = CodeChapitre(numero=payload["numero"], titre=payload["titre"])
    db.add(c); await db.flush()
    res = await db.execute(select(CodeChapitre).options(*LOAD_OPTS).where(CodeChapitre.id == c.id))
    return chapitre_to_dict(res.scalar_one())

@router.patch("/chapitres/{chap_id}")
async def modifier_chapitre(chap_id: UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeChapitre).where(CodeChapitre.id == chap_id))
    c   = res.scalar_one_or_none()
    if not c: raise HTTPException(404)
    if "numero" in payload: c.numero = payload["numero"]
    if "titre"  in payload: c.titre  = payload["titre"]
    if "contenu" in payload: c.contenu = payload["contenu"] or None
    await db.flush()
    res = await db.execute(select(CodeChapitre).options(*LOAD_OPTS).where(CodeChapitre.id == chap_id))
    return chapitre_to_dict(res.scalar_one())

@router.delete("/chapitres/{chap_id}", status_code=204)
async def supprimer_chapitre(chap_id: UUID, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeChapitre).where(CodeChapitre.id == chap_id))
    c   = res.scalar_one_or_none()
    if not c: raise HTTPException(404)
    await db.delete(c); await db.flush()


# ── CRUD Sections ─────────────────────────────────────────────────────────────
@router.post("/chapitres/{chap_id}/sections", status_code=201)
async def creer_section(chap_id: UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    s = CodeSection(chapitre_id=chap_id, numero=payload["numero"], titre=payload["titre"])
    db.add(s); await db.flush()
    return {"id": str(s.id), "numero": s.numero, "num_display": num_section(s.numero), "titre": s.titre, "chapitre_id": str(chap_id), "articles": []}

@router.patch("/sections/{sec_id}")
async def modifier_section(sec_id: UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeSection).where(CodeSection.id == sec_id))
    s   = res.scalar_one_or_none()
    if not s: raise HTTPException(404)
    if "numero" in payload: s.numero = payload["numero"]
    if "titre"  in payload: s.titre  = payload["titre"]
    if "contenu" in payload: s.contenu = payload["contenu"] or None
    await db.flush()
    return {"id": str(s.id), "numero": s.numero, "num_display": num_section(s.numero), "titre": s.titre, "contenu": s.contenu or ""}

@router.delete("/sections/{sec_id}", status_code=204)
async def supprimer_section(sec_id: UUID, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeSection).where(CodeSection.id == sec_id))
    s   = res.scalar_one_or_none()
    if not s: raise HTTPException(404)
    await db.delete(s); await db.flush()


# ── CRUD Articles ─────────────────────────────────────────────────────────────
@router.post("/articles", status_code=201)
async def creer_article(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    a = CodeArticle(
        chapitre_id = payload["chapitre_id"],
        section_id  = payload.get("section_id") or None,
        numero      = payload["numero"],
        titre       = payload.get("titre") or None,
        contenu     = payload.get("contenu") or "",
    )
    db.add(a); await db.flush()
    return article_to_dict(a)

@router.patch("/articles/{art_id}")
async def modifier_article(art_id: UUID, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeArticle).where(CodeArticle.id == art_id))
    a   = res.scalar_one_or_none()
    if not a: raise HTTPException(404)
    for f in ["titre", "contenu", "numero", "section_id"]:
        if f in payload: setattr(a, f, payload[f] or None if f in ["titre","section_id"] else payload[f])
    await db.flush()
    return article_to_dict(a)

@router.delete("/articles/{art_id}", status_code=204)
async def supprimer_article(art_id: UUID, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(select(CodeArticle).where(CodeArticle.id == art_id))
    a   = res.scalar_one_or_none()
    if not a: raise HTTPException(404)
    await db.delete(a); await db.flush()
