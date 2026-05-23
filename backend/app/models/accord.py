from sqlalchemy import Column, String, Boolean, Date, Text, Integer, DateTime, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Accord(Base):
    __tablename__ = "accords_traites"

    id                      = Column(Integer, primary_key=True, autoincrement=True)
    titre                   = Column(String(500), nullable=False)
    reference               = Column(String(200))
    parties_signataires     = Column(Text)          # organisations libres (OMC, BM...)
    parties_pays_ids        = Column(ARRAY(Integer), default=[])  # FK vers ref_pays
    date_signature          = Column(Date)
    date_entree_vigueur     = Column(Date)
    date_expiration         = Column(Date)
    commentaires            = Column(Text)
    statut                  = Column(String(50), default="en_vigueur")
    fichier_nom             = Column(String(255))
    fichier_path            = Column(Text)
    est_publie              = Column(Boolean, default=True)
    is_deleted              = Column(Boolean, default=False)
    secteur_ids             = Column(ARRAY(Integer), default=[])
    branche_ids             = Column(ARRAY(Integer), default=[])
    activite_ids            = Column(ARRAY(Integer), default=[])
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by              = Column(String(100))

    fichiers = relationship("AccordFichier", back_populates="accord", cascade="all, delete-orphan")


class AccordFichier(Base):
    __tablename__ = "accord_fichiers"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    accord_id   = Column(Integer, ForeignKey("accords_traites.id", ondelete="CASCADE"), nullable=False)
    titre       = Column(String(255), nullable=False)
    nom_fichier = Column(String(255), nullable=False)
    chemin      = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    accord = relationship("Accord", back_populates="fichiers")
