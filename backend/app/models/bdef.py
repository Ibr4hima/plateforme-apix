from sqlalchemy import (
    Column, String, Integer, SmallInteger, Numeric, ForeignKey,
    UniqueConstraint, CheckConstraint, Index,
)
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── Hiérarchie sectorielle BDEF (source ANSD) ─────────────────────────────────
# 4 macro-secteurs → 9 groupes → 35 secteurs d'activité
class BdefMacroSecteur(Base):
    __tablename__ = "bdef_macro_secteurs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    code       = Column(String(10), nullable=False, unique=True)
    libelle    = Column(String(200), nullable=False)
    ordre      = Column(SmallInteger)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    groupes    = relationship("BdefGroupe", back_populates="macro_secteur",
                              cascade="all, delete-orphan")


class BdefGroupe(Base):
    __tablename__ = "bdef_groupes"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    code             = Column(String(10), nullable=False, unique=True)
    libelle          = Column(String(200), nullable=False)
    macro_secteur_id = Column(Integer, ForeignKey("bdef_macro_secteurs.id", ondelete="CASCADE"),
                              nullable=False, index=True)
    ordre            = Column(SmallInteger)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())
    macro_secteur    = relationship("BdefMacroSecteur", back_populates="groupes")
    secteurs         = relationship("BdefSecteur", back_populates="groupe",
                                    cascade="all, delete-orphan")


class BdefSecteur(Base):
    __tablename__ = "bdef_secteurs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    code       = Column(String(10), nullable=False, unique=True)
    libelle    = Column(String(500), nullable=False)
    groupe_id  = Column(Integer, ForeignKey("bdef_groupes.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    ordre      = Column(SmallInteger)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    groupe     = relationship("BdefGroupe", back_populates="secteurs")


# ── Indicateurs ───────────────────────────────────────────────────────────────
# 6 catégories : Activités · Efficacité · Investissement · Liquidité ·
#                Rentabilité · Structure financière
class BdefIndicateurCategorie(Base):
    __tablename__ = "bdef_indicateur_categories"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(40), nullable=False, unique=True)
    libelle     = Column(String(100), nullable=False)
    ordre       = Column(SmallInteger)
    indicateurs = relationship("BdefIndicateur", back_populates="categorie")


class BdefIndicateur(Base):
    __tablename__ = "bdef_indicateurs"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    code         = Column(String(60), unique=True)
    libelle      = Column(String(300), nullable=False)
    unite        = Column(String(20), nullable=False)   # FCFA | ratio | % | jours
    categorie_id = Column(Integer, ForeignKey("bdef_indicateur_categories.id", ondelete="RESTRICT"),
                          nullable=False, index=True)
    ordre        = Column(SmallInteger)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    categorie    = relationship("BdefIndicateurCategorie", back_populates="indicateurs")


# ── Valeurs annuelles ─────────────────────────────────────────────────────────
# Polymorphe : une valeur appartient à un seul niveau de lecture.
#   niveau = global        → aucune FK (englobe les macro-secteurs)
#   niveau = macro_secteur → macro_secteur_id
#   niveau = groupe        → groupe_id
#   niveau = secteur       → secteur_id
class BdefValeur(Base):
    __tablename__ = "bdef_valeurs"
    __table_args__ = (
        CheckConstraint(
            "(niveau = 'global'        AND macro_secteur_id IS NULL     AND groupe_id IS NULL     AND secteur_id IS NULL) OR "
            "(niveau = 'macro_secteur' AND macro_secteur_id IS NOT NULL AND groupe_id IS NULL     AND secteur_id IS NULL) OR "
            "(niveau = 'groupe'        AND macro_secteur_id IS NULL     AND groupe_id IS NOT NULL AND secteur_id IS NULL) OR "
            "(niveau = 'secteur'       AND macro_secteur_id IS NULL     AND groupe_id IS NULL     AND secteur_id IS NOT NULL)",
            name="bdef_valeurs_niveau_chk",
        ),
        Index("idx_bdef_valeurs_indic_annee", "indicateur_id", "annee"),
    )
    id               = Column(Integer, primary_key=True, autoincrement=True)
    indicateur_id    = Column(Integer, ForeignKey("bdef_indicateurs.id", ondelete="CASCADE"),
                              nullable=False)
    niveau           = Column(String(15), nullable=False)   # global|macro_secteur|groupe|secteur
    macro_secteur_id = Column(Integer, ForeignKey("bdef_macro_secteurs.id", ondelete="CASCADE"))
    groupe_id        = Column(Integer, ForeignKey("bdef_groupes.id", ondelete="CASCADE"))
    secteur_id       = Column(Integer, ForeignKey("bdef_secteurs.id", ondelete="CASCADE"))
    annee            = Column(SmallInteger, nullable=False)
    valeur           = Column(Numeric(20, 4))
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())
    indicateur       = relationship("BdefIndicateur")
