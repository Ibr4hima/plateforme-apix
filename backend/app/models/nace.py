"""
Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
(NACE, ANSD, rapport annuel).

Tableaux 8 à 11 des annexes : principaux produits exportés/importés en
valeur (millions FCFA) et poids net (tonnes). Une ligne = un produit ×
un sens × une année × une édition. Chaque édition N couvre les années
N-4..N ; les fenêtres se chevauchent et une année peut être révisée
d'une édition à l'autre — la lecture retient l'édition la plus récente
disponible pour chaque année.
"""
from sqlalchemy import Column, Integer, Numeric, Text, UniqueConstraint
from app.core.database import Base


class NacePrincipalProduit(Base):
    __tablename__ = "nace_principaux_produits"
    __table_args__ = (UniqueConstraint("produit", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    produit = Column(Text, nullable=False)      # libellé normalisé (fautes du PDF corrigées)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T8/T10)
    poids   = Column(Numeric)                   # tonnes (T9/T11)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source
