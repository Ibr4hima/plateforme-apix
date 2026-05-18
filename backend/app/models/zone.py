from sqlalchemy import Column, String, Boolean, Date, Text, ForeignKey, UniqueConstraint, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
import uuid
from app.core.database import Base


class ZoneInvestissement(Base):
    __tablename__ = "zones_investissement"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    denomination = Column(String(500), nullable=False)
    type_zone    = Column(String(10),  nullable=False)
    description  = Column(Text)
    thematiques  = Column(Text)

    # Localisation FK — strings uniquement, pas de relationship (évite conflits avec entreprise.py)
    region_id         = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id    = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id = Column(Integer, ForeignKey("ref_arrondissements.id"))

    est_publie   = Column(Boolean, default=True)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by   = Column(String(100))
    is_deleted   = Column(Boolean, default=False)

    entreprises  = relationship("ZoneEntreprise", back_populates="zone", cascade="all, delete-orphan")
    fichiers     = relationship("ZoneFichier",    back_populates="zone", cascade="all, delete-orphan")


class ZoneEntreprise(Base):
    __tablename__ = "zone_entreprises"
    __table_args__ = (UniqueConstraint("zone_id", "entreprise_id"),)

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id        = Column(UUID(as_uuid=True), ForeignKey("zones_investissement.id", ondelete="CASCADE"), nullable=False)
    entreprise_id  = Column(UUID(as_uuid=True), ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    date_installation = Column(Date)
    created_at     = Column(TIMESTAMP(timezone=True), server_default=func.now())

    zone       = relationship("ZoneInvestissement", back_populates="entreprises")
    entreprise = relationship("EntrepriseIntallee", lazy="joined")


class ZoneFichier(Base):
    __tablename__ = "zone_fichiers"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id      = Column(UUID(as_uuid=True), ForeignKey("zones_investissement.id", ondelete="CASCADE"), nullable=False)
    titre        = Column(String(500))
    fichier_nom  = Column(String(500))
    fichier_path = Column(Text)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())

    zone = relationship("ZoneInvestissement", back_populates="fichiers")
