from sqlalchemy import Column, String, Boolean, Text, Integer, ForeignKey, Date
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class Prospect(Base):
    __tablename__ = "prospects"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    type             = Column(String(10), default="physique")      # physique | morale
    nom              = Column(String(255), nullable=False)
    prenom           = Column(String(150), nullable=True)
    pays_origine_id  = Column(Integer, ForeignKey("ref_pays.id"), nullable=True)
    siege_id         = Column(Integer, ForeignKey("ref_pays.id"), nullable=True)
    adresse          = Column(Text)
    telephone        = Column(String(500))
    mail             = Column(String(500))
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

    pays_origine     = relationship("RefPays", foreign_keys=[pays_origine_id], lazy="joined")
    siege            = relationship("RefPays", foreign_keys=[siege_id], lazy="joined")
    contacts         = relationship("ProspectContact", back_populates="prospect",
                                   cascade="all, delete-orphan", order_by="ProspectContact.created_at")


class ProspectContact(Base):
    __tablename__ = "prospect_contacts"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id          = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    projet_nom           = Column(String(255), nullable=False)
    projet_description   = Column(Text)
    date_premier_contact = Column(Date, nullable=False)
    etat_avancement      = Column(String(50), default="en_cours")
    commentaires         = Column(Text)
    contraintes          = Column(Text)
    is_deleted           = Column(Boolean, default=False)
    created_at           = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at           = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect    = relationship("Prospect", back_populates="contacts")
    historique  = relationship("ProspectContactHistorique", back_populates="contact",
                               cascade="all, delete-orphan", order_by="ProspectContactHistorique.date_changement")


class ProspectContactHistorique(Base):
    __tablename__ = "prospect_contacts_historique"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    contact_id      = Column(Integer, ForeignKey("prospect_contacts.id", ondelete="CASCADE"), nullable=False)
    etat            = Column(String(50), nullable=False)
    commentaire     = Column(Text)
    date_changement = Column(TIMESTAMP(timezone=True), server_default=func.now())

    contact = relationship("ProspectContact", back_populates="historique")
