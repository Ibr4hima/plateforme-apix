from sqlalchemy import Column, String, Integer, SmallInteger, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class RefClassification(Base):
    __tablename__ = "ref_classifications"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    code     = Column(String(20), nullable=False, unique=True)
    nom_fr   = Column(String(200), nullable=False)
    nom_en   = Column(String(200), nullable=False)
    version  = Column(String(20))
    zone_geo = Column(String(100))
    items    = relationship("RefClassificationItem", back_populates="classification",
                            cascade="all, delete-orphan")


class RefClassificationItem(Base):
    __tablename__ = "ref_classification_items"
    __table_args__ = (UniqueConstraint("classification_id", "code"),)
    id                = Column(Integer, primary_key=True, autoincrement=True)
    classification_id = Column(Integer, ForeignKey("ref_classifications.id", ondelete="CASCADE"), nullable=False)
    code              = Column(String(20), nullable=False)
    libelle_fr        = Column(String(500), nullable=False)
    libelle_en        = Column(String(500), nullable=False)
    niveau            = Column(SmallInteger, nullable=False)
    parent_id         = Column(Integer, ForeignKey("ref_classification_items.id"), nullable=True)
    classification    = relationship("RefClassification", back_populates="items")
    children          = relationship("RefClassificationItem",
                                     foreign_keys=[parent_id], lazy="select")


class RefCorrespondanceNaema(Base):
    __tablename__ = "ref_correspondances_naema"
    __table_args__ = (UniqueConstraint("naema_type", "naema_id", "classification_item_id"),)
    id                     = Column(Integer, primary_key=True, autoincrement=True)
    naema_type             = Column(String(20), nullable=False)
    naema_id               = Column(Integer, nullable=False)
    classification_item_id = Column(Integer, ForeignKey("ref_classification_items.id", ondelete="CASCADE"), nullable=False)
    note                   = Column(Text)
    item = relationship("RefClassificationItem")
