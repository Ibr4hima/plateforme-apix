from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, ARRAY, Text, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class RefDevise(Base):
    __tablename__ = "ref_devises"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    code_iso = Column(String(10), nullable=False, unique=True)
    nom      = Column(String(100), nullable=False)
    symbole  = Column(String(5))
    actif    = Column(Boolean, default=True)
    code     = Column(String(10))


class ProjetMoa(Base):
    __tablename__ = "projet_moa"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    projet_id  = Column(Integer, ForeignKey("projets.id", ondelete="CASCADE"), nullable=False)
    nom        = Column(String(500))
    telephone  = Column(String(50))
    mail       = Column(String(255))
    ordre      = Column(Integer, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    projet     = relationship("Projet", back_populates="moa_list")


class ProjetCoordinateur(Base):
    __tablename__ = "projet_coordinateurs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    projet_id  = Column(Integer, ForeignKey("projets.id", ondelete="CASCADE"), nullable=False)
    civilite   = Column(String(20))
    nom        = Column(String(200))
    prenom     = Column(String(200))
    telephone  = Column(String(50))
    mail       = Column(String(255))
    ordre      = Column(Integer, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    projet     = relationship("Projet", back_populates="coordinateurs")


class Projet(Base):
    __tablename__ = "projets"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    titre_projet        = Column(String(500), nullable=False)
    description         = Column(Text)
    region_id           = Column(Integer, ForeignKey("ref_regions.id"))
    departement_id      = Column(Integer, ForeignKey("ref_departements.id"))
    arrondissement_id   = Column(Integer, ForeignKey("ref_arrondissements.id"))
    zone_investissement = Column(String(20))
    pole_id             = Column(Integer, ForeignKey("poles_territoires.id"))
    secteur_ids         = Column(ARRAY(Integer), default=[])
    branche_ids         = Column(ARRAY(Integer), default=[])
    activite_ids        = Column(ARRAY(Integer), default=[])
    investissement              = Column(Numeric(20, 2))
    investissement_min          = Column(Numeric(20, 2))
    investissement_max          = Column(Numeric(20, 2))
    investissement_est_intervalle = Column(Boolean, default=False)
    devise_id                   = Column(Integer, ForeignKey("ref_devises.id"))
    porteur_projet      = Column(String(500))
    moa_id              = Column(Integer, nullable=True)
    date_attribution    = Column(Date, nullable=True)
    date_fin_prevue     = Column(Date, nullable=True)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())
    is_deleted          = Column(Boolean, default=False)
    est_publie          = Column(Boolean, default=True)

    moa_list      = relationship("ProjetMoa",          back_populates="projet",
                                 order_by="ProjetMoa.ordre", cascade="all, delete-orphan")
    coordinateurs = relationship("ProjetCoordinateur", back_populates="projet",
                                 order_by="ProjetCoordinateur.ordre", cascade="all, delete-orphan")
    fichiers      = relationship("ProjetFichier",      back_populates="projet",
                                 order_by="ProjetFichier.created_at", cascade="all, delete-orphan")
    devise        = relationship("RefDevise", foreign_keys=[devise_id], lazy="joined")


class ProjetFichier(Base):
    __tablename__ = "projet_fichiers"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    projet_id    = Column(Integer, ForeignKey("projets.id", ondelete="CASCADE"), nullable=False)
    titre        = Column(String(500))
    fichier_nom  = Column(String(500))
    fichier_path = Column(Text)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    projet       = relationship("Projet", back_populates="fichiers")
