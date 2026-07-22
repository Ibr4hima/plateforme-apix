// Lexique de l'investissement — termes techniques et leur définition, pour
// aider les agents à mieux appréhender le monde de l'investissement.
// Contenu de départ, extensible : ajouter/éditer les entrées ci-dessous.

export type Terme = { terme: string; definition: string; categorie: Categorie };

export type Categorie =
  | "Investissement"
  | "Commerce extérieur"
  | "Fiscalité & douane"
  | "Juridique"
  | "Zones & aménagement"
  | "Finance"
  | "Macro-économie";

// Couleur d'accent par catégorie (pastilles)
export const CAT_COULEUR: Record<Categorie, string> = {
  "Investissement": "#004f91",
  "Commerce extérieur": "#ca631f",
  "Fiscalité & douane": "#188038",
  "Juridique": "#6A1B9A",
  "Zones & aménagement": "#0e7490",
  "Finance": "#be185d",
  "Macro-économie": "#4338ca",
};

export const LEXIQUE: Terme[] = [
  { terme: "Agrément", categorie: "Juridique", definition: "Décision administrative par laquelle l'État accorde à un investisseur le bénéfice des avantages prévus par le Code des investissements, en contrepartie d'engagements précis." },
  { terme: "Amortissement", categorie: "Finance", definition: "Constatation comptable de la perte de valeur d'un investissement (matériel, bâtiment…) répartie sur sa durée d'utilisation." },
  { terme: "Balance commerciale", categorie: "Commerce extérieur", definition: "Solde entre la valeur des exportations et celle des importations de biens d'un pays sur une période. Elle est excédentaire quand on exporte plus qu'on n'importe, déficitaire dans le cas inverse." },
  { terme: "Balance des paiements", categorie: "Macro-économie", definition: "Document comptable retraçant l'ensemble des flux économiques et financiers entre un pays et le reste du monde (biens, services, capitaux)." },
  { terme: "Business plan", categorie: "Investissement", definition: "Document présentant un projet d'investissement : marché visé, stratégie, prévisions financières et besoins de financement. Il sert à convaincre partenaires et bailleurs." },
  { terme: "CAF (Coût, Assurance, Fret)", categorie: "Commerce extérieur", definition: "Mode d'évaluation des importations incluant le prix de la marchandise, l'assurance et le transport jusqu'à la frontière du pays importateur." },
  { terme: "Capital-risque", categorie: "Finance", definition: "Financement en fonds propres de jeunes entreprises à fort potentiel mais risquées, en échange d'une prise de participation et d'une plus-value espérée à la revente." },
  { terme: "Cash-flow (flux de trésorerie)", categorie: "Finance", definition: "Flux net de trésorerie généré par l'activité d'une entreprise sur une période. Indicateur clé de sa capacité à s'autofinancer." },
  { terme: "Climat des affaires", categorie: "Investissement", definition: "Ensemble des conditions (réglementaires, fiscales, administratives, sécuritaires) qui facilitent ou freinent l'activité des entreprises et l'attraction des investisseurs." },
  { terme: "Concession", categorie: "Juridique", definition: "Contrat par lequel l'État confie à une entreprise privée la construction et/ou l'exploitation d'un ouvrage ou service public pour une durée déterminée." },
  { terme: "Convention de non double imposition", categorie: "Fiscalité & douane", definition: "Accord entre deux États évitant qu'un même revenu soit imposé deux fois, dans le pays de la source et dans celui de résidence de l'investisseur." },
  { terme: "Crédit d'impôt", categorie: "Fiscalité & douane", definition: "Avantage fiscal venant en déduction de l'impôt dû ; s'il dépasse l'impôt, l'excédent peut être remboursé ou reporté." },
  { terme: "Due diligence", categorie: "Investissement", definition: "Audit approfondi mené avant un investissement ou une acquisition pour vérifier la situation réelle d'une cible (comptable, juridique, fiscale, technique)." },
  { terme: "Dividende", categorie: "Finance", definition: "Part des bénéfices d'une société distribuée à ses actionnaires en rémunération de leur apport en capital." },
  { terme: "Droits de douane", categorie: "Fiscalité & douane", definition: "Taxes perçues sur les marchandises qui franchissent une frontière, généralement à l'importation. Ils protègent la production locale et alimentent les recettes publiques." },
  { terme: "Effet de levier", categorie: "Finance", definition: "Recours à l'endettement pour financer un investissement et augmenter la rentabilité des fonds propres — au prix d'un risque accru." },
  { terme: "Exonération", categorie: "Fiscalité & douane", definition: "Dispense totale ou partielle du paiement d'un impôt ou d'un droit, souvent accordée pour encourager un investissement." },
  { terme: "FAB (Franco à bord)", categorie: "Commerce extérieur", definition: "Mode d'évaluation des exportations à la frontière du pays exportateur, hors coût du transport et de l'assurance internationaux." },
  { terme: "Fonds propres", categorie: "Finance", definition: "Ressources appartenant en propre à l'entreprise (capital, réserves, bénéfices non distribués), par opposition aux dettes." },
  { terme: "Franchise", categorie: "Juridique", definition: "Contrat par lequel une entreprise (franchiseur) concède à une autre (franchisé) le droit d'exploiter sa marque et son savoir-faire contre rémunération." },
  { terme: "Fusion-acquisition (M&A)", categorie: "Investissement", definition: "Opération de rapprochement d'entreprises : fusion (regroupement en une seule entité) ou acquisition (rachat d'une société par une autre). En IDE, elle s'oppose au greenfield." },
  { terme: "Greenfield", categorie: "Investissement", definition: "Investissement créant une installation entièrement nouvelle (usine, site) à partir de zéro, générateur d'emplois et de capacités nouvelles." },
  { terme: "Guichet unique", categorie: "Juridique", definition: "Dispositif regroupant en un seul point les formalités administratives (création d'entreprise, agrément…) pour simplifier et accélérer les démarches des investisseurs." },
  { terme: "IDE (Investissement Direct Étranger)", categorie: "Investissement", definition: "Investissement durable réalisé par une entité d'un pays dans une entreprise située dans un autre pays, avec une influence significative sur la gestion (souvent ≥ 10 % du capital)." },
  { terme: "Incitations fiscales", categorie: "Fiscalité & douane", definition: "Mesures fiscales (exonérations, réductions, crédits d'impôt) destinées à orienter et encourager les investissements vers certains secteurs ou territoires." },
  { terme: "Investissement de portefeuille", categorie: "Finance", definition: "Placement financier en titres (actions, obligations) sans volonté de contrôle de l'entreprise, contrairement à l'IDE. Plus liquide et plus volatil." },
  { terme: "Joint-venture (coentreprise)", categorie: "Investissement", definition: "Entreprise commune créée par plusieurs partenaires qui partagent capital, risques et bénéfices d'un projet, souvent local et étranger." },
  { terme: "Partenariat public-privé (PPP)", categorie: "Juridique", definition: "Contrat de long terme associant une entité publique et une entreprise privée pour financer, réaliser et exploiter un projet d'intérêt général." },
  { terme: "PIB (Produit Intérieur Brut)", categorie: "Macro-économie", definition: "Valeur totale des biens et services produits sur le territoire d'un pays pendant une période. Principal indicateur de la taille et de la croissance d'une économie." },
  { terme: "Point mort (seuil de rentabilité)", categorie: "Finance", definition: "Niveau d'activité à partir duquel les recettes couvrent exactement les charges : en dessous l'entreprise perd, au-dessus elle gagne." },
  { terme: "Rapatriement des bénéfices", categorie: "Juridique", definition: "Possibilité pour un investisseur étranger de transférer librement vers son pays les bénéfices, dividendes et capitaux issus de son investissement — garantie clé de l'attractivité." },
  { terme: "Rentabilité", categorie: "Finance", definition: "Capacité d'un investissement à générer un gain rapporté aux capitaux engagés. Elle mesure l'efficacité économique du projet." },
  { terme: "ROI (retour sur investissement)", categorie: "Investissement", definition: "Indicateur mesurant le gain net d'un investissement rapporté à son coût, exprimé en pourcentage. Sert à comparer la performance de projets." },
  { terme: "Subvention", categorie: "Fiscalité & douane", definition: "Aide financière accordée par une autorité publique à une entreprise ou un projet, sans contrepartie de remboursement." },
  { terme: "Taux de couverture", categorie: "Commerce extérieur", definition: "Rapport entre exportations et importations (en %). Il indique dans quelle mesure les exportations financent les importations ; au-dessus de 100 %, la balance est excédentaire." },
  { terme: "Termes de l'échange", categorie: "Commerce extérieur", definition: "Rapport entre le prix des exportations et celui des importations d'un pays. Leur amélioration accroît le pouvoir d'achat extérieur." },
  { terme: "TVA (Taxe sur la Valeur Ajoutée)", categorie: "Fiscalité & douane", definition: "Impôt indirect sur la consommation, prélevé à chaque étape de la production et supporté in fine par le consommateur." },
  { terme: "Valeur ajoutée", categorie: "Macro-économie", definition: "Richesse réellement créée par une entreprise : différence entre la valeur de sa production et celle des consommations intermédiaires nécessaires pour la produire." },
  { terme: "Zone d'aménagement industriel (ZAI)", categorie: "Zones & aménagement", definition: "Espace équipé et viabilisé, réservé à l'accueil d'unités industrielles, pour concentrer les activités et mutualiser les infrastructures." },
  { terme: "Zone économique spéciale (ZES)", categorie: "Zones & aménagement", definition: "Territoire délimité bénéficiant d'un régime dérogatoire (fiscal, douanier, réglementaire) avantageux pour attirer les investisseurs et doper les exportations." },
];
