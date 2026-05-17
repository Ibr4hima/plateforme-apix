from sqlalchemy import Column, String, Boolean, Date, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base
import uuid


class Accord(Base):
    __tablename__ = "accords_traites"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre                   = Column(String(500), nullable=False)
    reference               = Column(String(200))
    pays_signataires        = Column(Text)
    date_signature          = Column(Date)
    date_entree_vigueur     = Column(Date)
    date_expiration         = Column(Date)
    secteur_activite        = Column(Text)
    branche_activite        = Column(Text)
    commentaires            = Column(Text)
    domaines_couverts       = Column(Text)
    avantages_principaux    = Column(Text)
    statut                  = Column(String(50), default="en_vigueur")
    fichier_nom             = Column(String(255))
    fichier_path            = Column(Text)
    est_publie              = Column(Boolean, default=True)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by              = Column(String(100))
    is_deleted              = Column(Boolean, default=False)


class AccordFichier(Base):
    __tablename__ = "accord_fichiers"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    accord_id   = Column(UUID(as_uuid=True), ForeignKey("accords_traites.id"), nullable=False)
    titre       = Column(String(255), nullable=False)
    nom_fichier = Column(String(255), nullable=False)
    chemin      = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
