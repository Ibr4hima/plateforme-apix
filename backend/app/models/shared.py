"""
Modèles SQLAlchemy partagés entre plusieurs modules.
"""
from sqlalchemy import Column, String, Boolean, Integer, SmallInteger, ForeignKey, Text, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class RefPays(Base):
    __tablename__ = "ref_pays"
    id               = Column(Integer, primary_key=True)
    code_iso2        = Column(String(2))
    code_iso3        = Column(String(3), unique=True)
    nom_fr           = Column(String(100))
    continent        = Column(String(50))
    region_geo       = Column(String(100))
    niveau_revenu    = Column(String(50))
    est_industrialise= Column(Boolean, default=False)
    est_emergent     = Column(Boolean, default=False)
    nom_cnuced       = Column(String(100))
    actif            = Column(Boolean, default=True)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RefGroupement(Base):
    __tablename__ = "ref_groupements"
    id          = Column(Integer, primary_key=True)
    code        = Column(String(20), unique=True, nullable=False)
    nom_fr      = Column(String(200), nullable=False)
    nom_en      = Column(String(200))
    description = Column(Text)
    pays_ids    = Column(ARRAY(Integer), nullable=False, server_default="{}")
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RefPaysGroupement(Base):
    __tablename__ = "ref_pays_groupements"
    pays_id       = Column(Integer, ForeignKey("ref_pays.id", ondelete="CASCADE"), primary_key=True)
    groupement_id = Column(Integer, ForeignKey("ref_groupements.id", ondelete="CASCADE"), primary_key=True)
