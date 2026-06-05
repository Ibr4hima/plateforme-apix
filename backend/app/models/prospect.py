from sqlalchemy import Column, String, Boolean, Text, Integer, ForeignKey, Date
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class Prospect(Base):
    __tablename__ = "prospects"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    type             = Column(String(10), default="physique")
    nom              = Column(String(255), nullable=False)
    prenom           = Column(String(150), nullable=True)
    pays_origine_id  = Column(Integer, ForeignKey("ref_pays.id"), nullable=True)
    siege_id         = Column(Integer, ForeignKey("ref_pays.id"), nullable=True)
    adresse          = Column(Text)
    telephones       = Column(ARRAY(String), default=[])
    mails            = Column(ARRAY(String), default=[])
    siteweb          = Column(Text)
    secteur_ids      = Column(ARRAY(Integer), default=[])
    branche_ids      = Column(ARRAY(Integer), default=[])
    activite_ids     = Column(ARRAY(Integer), default=[])
    point_entree     = Column(Text)
    details          = Column(Text)
    est_publie       = Column(Boolean, default=True)
    is_deleted       = Column(Boolean, default=False)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Objet du ciblage
    objet_projet              = Column(Boolean, default=False)
    objet_projet_id           = Column(Integer, ForeignKey("projets.id"), nullable=True)
    objet_intentions_etranger = Column(Boolean, default=False)
    objet_intentions_secteur_ids  = Column(ARRAY(Integer), default=[])
    objet_intentions_branche_ids  = Column(ARRAY(Integer), default=[])
    objet_intentions_activite_ids = Column(ARRAY(Integer), default=[])
    objet_intentions_details  = Column(Text)
    objet_adequation_senegal  = Column(Boolean, default=False)
    objet_adequation_secteur_ids  = Column(ARRAY(Integer), default=[])
    objet_adequation_branche_ids  = Column(ARRAY(Integer), default=[])
    objet_adequation_activite_ids = Column(ARRAY(Integer), default=[])
    objet_adequation_details  = Column(Text)
    objet_commentaires        = Column(Text)

    pays_origine  = relationship("RefPays", foreign_keys=[pays_origine_id], lazy="joined")
    siege         = relationship("RefPays", foreign_keys=[siege_id], lazy="joined")
    points_focaux = relationship("ProspectPointFocal", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectPointFocal.id")
    echanges      = relationship("ProspectEchange", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectEchange.date_echange")


class ProspectPointFocal(Base):
    __tablename__ = "prospect_points_focaux"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    prenom      = Column(String(150))
    nom         = Column(String(150), nullable=False)
    telephones  = Column(ARRAY(String), default=[])
    mails       = Column(ARRAY(String), default=[])
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="points_focaux")


class ProspectEchange(Base):
    __tablename__ = "prospect_echanges"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id   = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    date_echange  = Column(Date, nullable=False)
    commentaire   = Column(Text)
    contact_par   = Column(String(255), nullable=False)
    enregistre_le = Column(TIMESTAMP(timezone=True), server_default=func.now())
    # Immuable : pas de updated_at, pas de is_deleted

    prospect = relationship("Prospect", back_populates="echanges")
