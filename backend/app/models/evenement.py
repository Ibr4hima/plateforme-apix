from sqlalchemy import Column, String, Boolean, Integer, Date, Numeric, Text, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base
import uuid


class Evenement(Base):
    __tablename__ = "evenements"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom_event                   = Column(String(500), nullable=False)
    edition                     = Column(Integer, CheckConstraint("edition > 0", name="chk_evenements_edition_positive"))
    type_evenement              = Column(String(50), nullable=False)
    organisateur                = Column(String(255))
    role_apix                   = Column(String(50))
    description                 = Column(Text)
    lien_site_officiel          = Column(Text)

    date_debut                  = Column(Date, nullable=False)
    date_fin                    = Column(Date, nullable=False)

    est_recurrent               = Column(Boolean, default=False)
    frequence                   = Column(String(30))
    date_prochaine_edition      = Column(Date)

    pays_nom                    = Column(String(100))
    ville                       = Column(String(100))
    lieu_nom                    = Column(String(255))
    est_virtuel                 = Column(Boolean, default=False)
    lien_virtuel                = Column(Text)

    thematiques                 = Column(Text)
    pays_invites                = Column(Text)
    entreprises_invitees        = Column(Text)

    nombre_participants         = Column(Integer)
    nombre_prospects_rencontres = Column(Integer)
    montant_intentions_usd      = Column(Numeric(18, 2))
    rapport_disponible          = Column(Boolean, default=False)
    lien_rapport                = Column(Text)

    statut                      = Column(String(30), default="planifie")
    est_publie                  = Column(Boolean, default=True)
    note_interne                = Column(Text)

    created_at                  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at                  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by                  = Column(String(100))
    is_deleted                  = Column(Boolean, default=False)
