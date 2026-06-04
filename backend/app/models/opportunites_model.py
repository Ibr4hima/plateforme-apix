from sqlalchemy import Column, String, Integer, Boolean, ARRAY, Text
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class Potentialite(Base):
    __tablename__ = "potentialites"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    titre             = Column(String(500), nullable=False)
    pole_id           = Column(Integer, nullable=True)
    region_id         = Column(Integer, nullable=True)
    departement_id    = Column(Integer, nullable=True)
    arrondissement_id = Column(Integer, nullable=True)
    secteur_ids       = Column(ARRAY(Integer), default=[])
    branche_ids       = Column(ARRAY(Integer), default=[])
    activite_ids      = Column(ARRAY(Integer), default=[])
    description       = Column(Text, nullable=True)
    est_publie  = Column(Boolean, default=True)
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class AvantageIncitation(Base):
    """Conservé pour compatibilité SQLAlchemy — table gérée via text() dans les routes."""
    __tablename__ = "avantages_incitations"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    secteur_id  = Column(Integer, nullable=True)
    branche_id  = Column(Integer, nullable=True)
    activite_id = Column(Integer, nullable=False)
    avantages   = Column(Text, nullable=False)
    est_publie  = Column(Boolean, default=True)
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
