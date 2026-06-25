import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class ModalitesPdf(Base):
    __tablename__ = "modalites_pdf"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre        = Column(String(500), default="Modalités d'application du code des investissements")
    fichier_nom  = Column(String(500))
    fichier_path = Column(Text)
    version      = Column(String(100))
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ModalitesChapitre(Base):
    __tablename__ = "modalites_chapitres"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero     = Column(Integer, nullable=False)
    titre      = Column(String(500), nullable=False)
    contenu    = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    sections = relationship("ModalitesSection", back_populates="chapitre",
                            order_by="ModalitesSection.numero", cascade="all, delete-orphan")
    articles = relationship("ModalitesArticle", back_populates="chapitre",
                            order_by="ModalitesArticle.numero", cascade="all, delete-orphan")


class ModalitesSection(Base):
    __tablename__ = "modalites_sections"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapitre_id = Column(UUID(as_uuid=True), ForeignKey("modalites_chapitres.id", ondelete="CASCADE"), nullable=False)
    numero      = Column(Integer, nullable=False)
    titre       = Column(String(500), nullable=False)
    contenu     = Column(Text, nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    chapitre = relationship("ModalitesChapitre", back_populates="sections")
    articles = relationship("ModalitesArticle", back_populates="section",
                            order_by="ModalitesArticle.numero")


class ModalitesArticle(Base):
    __tablename__ = "modalites_articles"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapitre_id = Column(UUID(as_uuid=True), ForeignKey("modalites_chapitres.id", ondelete="CASCADE"), nullable=False)
    section_id  = Column(UUID(as_uuid=True), ForeignKey("modalites_sections.id", ondelete="SET NULL"), nullable=True)
    numero      = Column(Integer, nullable=False, unique=True)
    titre       = Column(String(500))
    contenu     = Column(Text, nullable=False, default="")
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    chapitre = relationship("ModalitesChapitre", back_populates="articles")
    section  = relationship("ModalitesSection",  back_populates="articles")
