from sqlalchemy import Column, String, Integer, SmallInteger, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Classification sectorielle fDi Markets ────────────────────────────────────
# 37 secteurs → 270 sous-secteurs, et 17 « business activities » à part.
#
# Les activités ne prolongent pas l'arbre sectoriel : elles disent ce que
# l'entreprise vient faire dans le pays (usine, siège, R&D, logistique…),
# indépendamment de son secteur. Deux tables sans lien, donc.
#
# Le schéma complet et sa justification sont dans
# database/migrations/130_fdi_classification.sql ; l'essentiel tient en une
# phrase : un libellé de sous-secteur n'identifie rien hors de son secteur —
# « Other » revient sous 24 secteurs sur 37.
class FdiSecteur(Base):
    __tablename__ = "fdi_secteurs"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    code           = Column(Text, nullable=False, unique=True)
    libelle_en     = Column(Text, nullable=False, unique=True)
    libelle_fr     = Column(Text, nullable=False)
    ordre          = Column(SmallInteger, nullable=False)
    sous_secteurs  = relationship("FdiSousSecteur", back_populates="secteur",
                                  cascade="all, delete-orphan", order_by="FdiSousSecteur.ordre")


class FdiSousSecteur(Base):
    __tablename__ = "fdi_sous_secteurs"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    code            = Column(Text, nullable=False, unique=True)
    secteur_id      = Column(Integer, ForeignKey("fdi_secteurs.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    # Verbatim de la source, parenthèse de désambiguïsation comprise : c'est la
    # forme que porteront les exports de projets fDi.
    libelle_en      = Column(Text, nullable=False, unique=True)
    libelle_fr      = Column(Text, nullable=False)
    # Le même, sans la parenthèse — pour les exports qui ne la portent pas.
    libelle_en_base = Column(Text, nullable=False)
    # libelle_en_base normalisé (minuscules, sans accent, « & » → « and ») :
    # unique dans son secteur seulement, d'où la contrainte composite.
    cle_appariement = Column(Text, nullable=False)
    ordre           = Column(SmallInteger, nullable=False)
    secteur         = relationship("FdiSecteur", back_populates="sous_secteurs")

    __table_args__ = (
        UniqueConstraint("secteur_id", "cle_appariement", name="uq_fdi_sous_secteur_cle"),
        Index("idx_fdi_sous_secteurs_cle", "cle_appariement"),
    )


class FdiActivite(Base):
    __tablename__ = "fdi_activites"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    code            = Column(Text, nullable=False, unique=True)
    libelle_en      = Column(Text, nullable=False, unique=True)
    libelle_fr      = Column(Text, nullable=False)
    cle_appariement = Column(Text, nullable=False, unique=True)
    ordre           = Column(SmallInteger, nullable=False)
