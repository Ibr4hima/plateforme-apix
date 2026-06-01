from sqlalchemy import Column, String, Boolean, Integer, Date, Text, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.zone_types import PoleTerritoire  # noqa: F401 — requis pour la relationship


class RefSecteur(Base):
    __tablename__ = "ref_secteurs"
    id          = Column(Integer, primary_key=True)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(150), nullable=False)
    description = Column(Text)
    actif       = Column(Boolean, default=True)


class RefBranche(Base):
    __tablename__ = "ref_branches"
    id          = Column(Integer, primary_key=True)
    secteur_id  = Column(Integer, ForeignKey("ref_secteurs.id"), nullable=False)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(150), nullable=False)
    actif       = Column(Boolean, default=True)


class RefActivite(Base):
    __tablename__ = "ref_activites"
    id          = Column(Integer, primary_key=True)
    branche_id  = Column(Integer, ForeignKey("ref_branches.id"), nullable=False)
    code        = Column(String(20), unique=True, nullable=False)
    nom         = Column(String(255), nullable=False)
    actif       = Column(Boolean, default=True)


class EntreprisePointFocal(Base):
    __tablename__ = "entreprises_points_focaux"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    entreprise_id   = Column(Integer, ForeignKey("entreprises_installees.id", ondelete="CASCADE"), nullable=False)
    nom             = Column(String(255), nullable=False)
    prenom          = Column(String(255))
    civilite        = Column(String(20), default="Monsieur")
    poste           = Column(String(150))
    telephone       = Column(String(50))
    mail            = Column(String(255))
    est_principal   = Column(Boolean, default=False)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RefRegion(Base):
    __tablename__ = "ref_regions"
    id    = Column(Integer, primary_key=True)
    code  = Column(String(10))
    nom   = Column(String(100))
    actif = Column(Boolean, default=True)


class RefDepartement(Base):
    __tablename__ = "ref_departements"
    id        = Column(Integer, primary_key=True)
    region_id = Column(Integer, ForeignKey("ref_regions.id"))
    code      = Column(String(10))
    nom       = Column(String(100))
    actif     = Column(Boolean, default=True)


class RefArrondissement(Base):
    __tablename__ = "ref_arrondissements"
    id               = Column(Integer, primary_key=True)
    departement_id   = Column(Integer, ForeignKey("ref_departements.id"))
    code             = Column(String(10))
    nom              = Column(String(100))
    actif            = Column(Boolean, default=True)


class EntrepriseIntallee(Base):
    __tablename__ = "entreprises_installees"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    nom             = Column(String(255), nullable=False)
    forme_juridique = Column(String(100))
    date_creation   = Column(Date)

    siege_pays_id   = Column(Integer, ForeignKey("ref_pays.id"))
    pays            = Column(String(100), default="Sénégal")

    region_id           = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id      = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id   = Column(Integer, ForeignKey("ref_arrondissements.id"))
    adresse             = Column(Text)

    telephone       = Column(String(50))
    mail            = Column(String(255))
    siteweb         = Column(Text)

    secteur_ids     = Column(ARRAY(Integer), default=[])
    branche_ids     = Column(ARRAY(Integer), default=[])
    activite_ids    = Column(ARRAY(Integer), default=[])

    est_publie          = Column(Boolean, default=True)


    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by      = Column(String(100))
    is_deleted      = Column(Boolean, default=False)

    points_focaux = relationship("EntreprisePointFocal", backref="entreprise", lazy="selectin",
                                  foreign_keys=[EntreprisePointFocal.entreprise_id],
                                  cascade="all, delete-orphan")
    region       = relationship("RefRegion",        foreign_keys=[region_id],        lazy="joined")
    departement  = relationship("RefDepartement",   foreign_keys=[departement_id],   lazy="joined")
    arrondissement = relationship("RefArrondissement", foreign_keys=[arrondissement_id], lazy="joined")
