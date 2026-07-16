"""
Modèles pour les 3 tables de zones d'investissement :
  - zones_zes  → IDs ZES-1, ZES-2, …
  - zones_zai  → IDs ZAI-1, ZAI-2, …
  - zones_zfi  → IDs ZFI-1, ZFI-2, …
"""
from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, ARRAY, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
import uuid
from app.core.database import Base


# ── Pôles territoires ─────────────────────────────────────────────────────────
class PoleTerritoire(Base):
    __tablename__ = "poles_territoires"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    pole_territoire = Column(String(200), nullable=False, unique=True)
    region_ids      = Column(ARRAY(Integer), default=[])
    entreprise_ids = Column(ARRAY(Integer), default=[])
    localisation    = Column(String(500))
    description     = Column(Text)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ── Mixin commun ──────────────────────────────────────────────────────────────
class ZoneMixin:
    nom_zone          = Column(String(500), nullable=False)
    pole_id           = Column(Integer, ForeignKey("poles_territoires.id"))
    region_id         = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id    = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id = Column(Integer, ForeignKey("ref_arrondissements.id"))

    # NAEMA — tableaux pour multi-sélection
    secteur_ids       = Column(ARRAY(Integer), default=[])
    branche_ids       = Column(ARRAY(Integer), default=[])
    activite_ids      = Column(ARRAY(Integer), default=[])

    # Infos officielles
    date_creation     = Column(Date)
    decret_creation   = Column(String(500))
    superficie        = Column(Numeric(12, 2))

    description       = Column(Text)
    created_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())
    is_deleted        = Column(Boolean, default=False)


# ── ZES ───────────────────────────────────────────────────────────────────────
