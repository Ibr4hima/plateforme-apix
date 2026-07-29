"""
Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
(NACE, ANSD, rapport annuel).

Trois nomenclatures, même structure :
- « principaux produits » (tableaux 8–11 de l'édition 2019) : une
  quinzaine de postes par sens ;
- « produits regroupés » (tableaux 12–15) : nomenclature ANSD plus fine,
  une trentaine de postes à l'export, une cinquantaine à l'import ;
- « groupes d'utilisation » (tableaux 16–19) : 9 groupes exhaustifs
  (alimentation, énergie, matières premières, demi-produits, produits
  finis par destination, or industriel) ;
- « chapitres » (tableaux 38–41) : nomenclature la plus fine, jusqu'à
  97 chapitres du Système Harmonisé par sens, également exhaustive.

Dans les trois cas : une ligne = une modalité × un sens × une année ×
une édition, avec la valeur (millions FCFA) et le poids net (tonnes).
Chaque édition N couvre les années N-4..N ; les fenêtres se chevauchent
et une année peut être révisée d'une édition à l'autre — la lecture
retient l'édition la plus récente disponible pour chaque année.
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


class NaceProduitRegroupe(Base):
    __tablename__ = "nace_produits_regroupes"
    __table_args__ = (UniqueConstraint("produit", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    produit = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T12/T14)
    poids   = Column(Numeric)                   # tonnes (T13/T15)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceGroupeUtilisation(Base):
    __tablename__ = "nace_groupe_utilisation"
    __table_args__ = (UniqueConstraint("groupe", "sens", "annee", "edition"),)

    id      = Column(Integer, primary_key=True)
    groupe  = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens    = Column(Text, nullable=False)      # 'export' | 'import'
    annee   = Column(Integer, nullable=False)
    valeur  = Column(Numeric)                   # millions FCFA (T16/T18)
    poids   = Column(Numeric)                   # tonnes (T17/T19)
    edition = Column(Integer, nullable=False)   # année du rapport NACE source


class NaceChapitre(Base):
    __tablename__ = "nace_chapitres"
    __table_args__ = (UniqueConstraint("chapitre", "sens", "annee", "edition"),)

    id       = Column(Integer, primary_key=True)
    chapitre = Column(Text, nullable=False)      # libellé normalisé (le PDF est en capitales)
    sens     = Column(Text, nullable=False)      # 'export' | 'import'
    annee    = Column(Integer, nullable=False)
    valeur   = Column(Numeric)                   # millions FCFA (T38/T40)
    poids    = Column(Numeric)                   # tonnes (T39/T41)
    edition  = Column(Integer, nullable=False)   # année du rapport NACE source
