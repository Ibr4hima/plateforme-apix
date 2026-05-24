import uuid
from sqlalchemy import Column, String, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from app.core.database import Base


class CodePdf(Base):
    __tablename__ = "code_investissement_pdf"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre        = Column(String(500), default="Code des investissements du Sénégal")
    fichier_nom  = Column(String(500))
    fichier_path = Column(Text)
    version      = Column(String(100))
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())


class CodeChapitre(Base):
    __tablename__ = "code_chapitres"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero     = Column(Integer, nullable=False)
    titre      = Column(String(500), nullable=False)
    contenu    = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    sections = relationship("CodeSection", back_populates="chapitre",
                            order_by="CodeSection.numero", cascade="all, delete-orphan")
    articles = relationship("CodeArticle", back_populates="chapitre",
                            order_by="CodeArticle.numero", cascade="all, delete-orphan")


class CodeSection(Base):
    __tablename__ = "code_sections"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapitre_id  = Column(UUID(as_uuid=True), ForeignKey("code_chapitres.id", ondelete="CASCADE"), nullable=False)
    numero       = Column(Integer, nullable=False)
    titre        = Column(String(500), nullable=False)
    contenu      = Column(Text, nullable=True)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())

    chapitre = relationship("CodeChapitre", back_populates="sections")
    articles = relationship("CodeArticle",  back_populates="section",
                            order_by="CodeArticle.numero")


class CodeArticle(Base):
    __tablename__ = "code_articles"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapitre_id = Column(UUID(as_uuid=True), ForeignKey("code_chapitres.id", ondelete="CASCADE"), nullable=False)
    section_id  = Column(UUID(as_uuid=True), ForeignKey("code_sections.id",  ondelete="SET NULL"), nullable=True)
    numero      = Column(Integer, nullable=False, unique=True)
    titre       = Column(String(500))
    contenu     = Column(Text, nullable=False, default="")
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    chapitre = relationship("CodeChapitre", back_populates="articles")
    section  = relationship("CodeSection",  back_populates="articles")
