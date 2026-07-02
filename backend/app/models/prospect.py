from sqlalchemy import Column, String, Boolean, Text, Integer, ForeignKey, Date
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class Prospect(Base):
    __tablename__ = "prospects"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    type             = Column(String(10), default="morale")
    nom              = Column(String(255), nullable=False)
    siege_id         = Column(Integer, ForeignKey("ref_pays.id"), nullable=True)
    adresse          = Column(Text)
    telephones       = Column(ARRAY(String), default=[])
    mails            = Column(ARRAY(String), default=[])
    siteweb          = Column(Text)
    linkedin         = Column(Text)
    issue            = Column(String(20), nullable=True)  # NULL | installe | decline
    issue_commentaire = Column(Text, nullable=True)
    issue_conclu_le  = Column(TIMESTAMP(timezone=True), nullable=True)
    agent_id         = Column(Integer, nullable=True)  # ownership (auth à venir)
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

    siege         = relationship("RefPays", foreign_keys=[siege_id], lazy="joined")
    points_focaux = relationship("ProspectPointFocal", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectPointFocal.id")
    echanges      = relationship("ProspectEchange", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectEchange.date_echange")
    contraintes   = relationship("ProspectContrainte", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectContrainte.created_at")
    contacts      = relationship("ProspectContact", back_populates="prospect",
                                 cascade="all, delete-orphan")
    cycles        = relationship("ProspectCycle", back_populates="prospect",
                                 cascade="all, delete-orphan", order_by="ProspectCycle.cycle_num")


class ProspectContact(Base):
    """Coordonnée normalisée (téléphone / mail / site / linkedin) pour la
    déduplication. Unicité globale garantie par UNIQUE(type, valeur_normalisee)."""
    __tablename__ = "prospect_contacts"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id       = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    type              = Column(String(20), nullable=False)   # telephone | email | siteweb | linkedin
    valeur_normalisee = Column(Text, nullable=False)
    valeur_affichee   = Column(Text, nullable=False)
    origine           = Column(String(20), default="entreprise")
    created_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="contacts")


class ProspectCycle(Base):
    """Conclusion archivée d'un cycle de prospection passé. Créé quand une
    entreprise « Déclinée » est re-contactée : la conclusion courante est
    versée ici, puis le prospect repart à zéro tout en gardant son historique."""
    __tablename__ = "prospect_cycles"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id       = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    cycle_num         = Column(Integer, nullable=False)
    issue             = Column(String(20), nullable=False)   # installe | decline
    issue_commentaire = Column(Text, nullable=True)
    conclu_le         = Column(TIMESTAMP(timezone=True), nullable=True)
    recontacte_le     = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="cycles")


class ProspectPointFocal(Base):
    __tablename__ = "prospect_points_focaux"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    prenom      = Column(String(150))
    nom         = Column(String(150), nullable=False)
    telephones  = Column(ARRAY(String), default=[])
    mails       = Column(ARRAY(String), default=[])
    est_principal = Column(Boolean, default=False)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="points_focaux")


class ProspectEchange(Base):
    __tablename__ = "prospect_echanges"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id     = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    date_echange    = Column(Date, nullable=False)
    commentaire     = Column(Text)
    contact_par     = Column(String(255), nullable=True)   # agent APIX (manuel jusqu'à l'auth)
    interlocuteur   = Column(Text, nullable=True)          # qui côté investisseur
    canal           = Column(String(50), nullable=True)    # Mail, Appel téléphonique, WhatsApp, …
    canal_contact   = Column(String(255), nullable=True)   # coordonnée associée au canal
    point_focal_id  = Column(Integer, ForeignKey("prospect_points_focaux.id", ondelete="SET NULL"), nullable=True)
    enregistre_le   = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect    = relationship("Prospect", back_populates="echanges")
    point_focal = relationship("ProspectPointFocal")
    fichiers    = relationship("ProspectEchangeFichier", back_populates="echange",
                               cascade="all, delete-orphan", order_by="ProspectEchangeFichier.created_at")


class ProspectEchangeFichier(Base):
    __tablename__ = "prospect_echange_fichiers"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    echange_id  = Column(Integer, ForeignKey("prospect_echanges.id", ondelete="CASCADE"), nullable=False)
    titre       = Column(String(255), nullable=False)
    nom_fichier = Column(String(255), nullable=False)
    chemin      = Column(Text, nullable=False)
    categorie   = Column(String(20), nullable=False, server_default="autre")
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    echange = relationship("ProspectEchange", back_populates="fichiers")


class ProspectContrainte(Base):
    __tablename__ = "prospect_contraintes"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    prospect_id         = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    cycle_num           = Column(Integer, default=0, nullable=False)
    description         = Column(Text, nullable=False)
    solution_preconisee = Column(Text)
    statut              = Column(String(20), default="en_cours")
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    prospect = relationship("Prospect", back_populates="contraintes")
