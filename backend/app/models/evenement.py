from sqlalchemy import Column, String, Boolean, Integer, Date, Text, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.shared import RefPays
import uuid


class Evenement(Base):
    __tablename__ = "evenements"

    # ── Identité ──
    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom_event           = Column(String(500), nullable=False)
    edition             = Column(Integer, CheckConstraint("edition > 0", name="chk_evenements_edition_positive"))
    type_evenement      = Column(String(50), nullable=False)
    organisateur        = Column(String(255))
    role_apix           = Column(String(50))
    description         = Column(Text)

    # ── Dates ──
    date_debut          = Column(Date, nullable=False)
    date_fin            = Column(Date, nullable=False)

    # ── Localisation ──
    pays_hote_id        = Column(Integer, ForeignKey("ref_pays.id"))
    ville               = Column(String(100))
    est_virtuel         = Column(Boolean, default=False)
    lien_virtuel        = Column(Text)

    # ── Participants ──
    pays_invites        = Column(Text)
    entreprises_invitees= Column(Text)

    # ── Thématiques (secteur:, branche:, activite:) ──
    thematiques_naema   = Column(Text)

    # ── Publication ──
    statut              = Column(String(30), default="planifie")
    est_publie          = Column(Boolean, default=True)

    # ── Métadonnées ──
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by          = Column(String(100))
    is_deleted          = Column(Boolean, default=False)

    # ── Relations ──
    pays_hote_obj       = relationship("RefPays", foreign_keys=[pays_hote_id], lazy="joined")


