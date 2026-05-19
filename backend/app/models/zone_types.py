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
class ZoneZES(ZoneMixin, Base):
    __tablename__ = "zones_zes"

    id = Column(String(20), primary_key=True)

    fichiers    = relationship("ZoneZESFichier",    back_populates="zone", cascade="all, delete-orphan")
    entreprises = relationship("ZoneZESEntreprise", back_populates="zone", cascade="all, delete-orphan")


class ZoneZESFichier(Base):
    __tablename__ = "zone_zes_fichiers"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id     = Column(String(20), ForeignKey("zones_zes.id", ondelete="CASCADE"), nullable=False)
    titre       = Column(String(500))
    fichier_nom = Column(String(500))
    fichier_path= Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone        = relationship("ZoneZES", back_populates="fichiers")


class ZoneZESEntreprise(Base):
    __tablename__ = "zone_zes_entreprises"
    __table_args__ = {"extend_existing": True}
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id       = Column(String(20), ForeignKey("zones_zes.id", ondelete="CASCADE"), nullable=False)
    entreprise_id = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone          = relationship("ZoneZES", back_populates="entreprises")
    entreprise    = relationship("EntrepriseIntallee", lazy="joined")


# ── ZAI ───────────────────────────────────────────────────────────────────────
class ZoneZAI(ZoneMixin, Base):
    __tablename__ = "zones_zai"

    id = Column(String(20), primary_key=True)

    fichiers    = relationship("ZoneZAIFichier",    back_populates="zone", cascade="all, delete-orphan")
    entreprises = relationship("ZoneZAIEntreprise", back_populates="zone", cascade="all, delete-orphan")


class ZoneZAIFichier(Base):
    __tablename__ = "zone_zai_fichiers"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id     = Column(String(20), ForeignKey("zones_zai.id", ondelete="CASCADE"), nullable=False)
    titre       = Column(String(500))
    fichier_nom = Column(String(500))
    fichier_path= Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone        = relationship("ZoneZAI", back_populates="fichiers")


class ZoneZAIEntreprise(Base):
    __tablename__ = "zone_zai_entreprises"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id       = Column(String(20), ForeignKey("zones_zai.id", ondelete="CASCADE"), nullable=False)
    entreprise_id = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone          = relationship("ZoneZAI", back_populates="entreprises")
    entreprise    = relationship("EntrepriseIntallee", lazy="joined")


# ── ZFI ───────────────────────────────────────────────────────────────────────
class ZoneZFI(ZoneMixin, Base):
    __tablename__ = "zones_zfi"

    id = Column(String(20), primary_key=True)

    fichiers    = relationship("ZoneZFIFichier",    back_populates="zone", cascade="all, delete-orphan")
    entreprises = relationship("ZoneZFIEntreprise", back_populates="zone", cascade="all, delete-orphan")


class ZoneZFIFichier(Base):
    __tablename__ = "zone_zfi_fichiers"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id     = Column(String(20), ForeignKey("zones_zfi.id", ondelete="CASCADE"), nullable=False)
    titre       = Column(String(500))
    fichier_nom = Column(String(500))
    fichier_path= Column(Text)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone        = relationship("ZoneZFI", back_populates="fichiers")


class ZoneZFIEntreprise(Base):
    __tablename__ = "zone_zfi_entreprises"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id       = Column(String(20), ForeignKey("zones_zfi.id", ondelete="CASCADE"), nullable=False)
    entreprise_id = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), server_default=func.now())
    zone          = relationship("ZoneZFI", back_populates="entreprises")
    entreprise    = relationship("EntrepriseIntallee", lazy="joined")
