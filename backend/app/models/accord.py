from sqlalchemy import Column, String, Boolean, Date, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base
import uuid


class Accord(Base):
    __tablename__ = "accords_traites"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre                   = Column(String(500), nullable=False)
    reference               = Column(String(100))
    type_accord             = Column(String(100))
    pays_signataires        = Column(Text)
    organisation_partenaire = Column(String(255))
    date_signature          = Column(Date)
    date_ratification       = Column(Date)
    date_entree_vigueur     = Column(Date)
    date_expiration         = Column(Date)
    secteur_activite        = Column(String(100))
    branche_activite        = Column(Text)
    commentaires            = Column(Text)
    domaines_couverts       = Column(Text)
    avantages_principaux    = Column(Text)
    statut                  = Column(String(50), default="en_vigueur")
    fichier_nom             = Column(String(255))
    fichier_path            = Column(Text)
    lien_texte_officiel     = Column(Text)
    est_publie              = Column(Boolean, default=True)
    note_interne            = Column(Text)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by              = Column(String(100))
    is_deleted              = Column(Boolean, default=False)
