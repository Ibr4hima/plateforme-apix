-- 121_lexique.sql — Lexique de l'investissement éditable depuis l'admin.
-- Table + amorçage avec les termes initiaux (auparavant statiques côté front).

CREATE TABLE IF NOT EXISTS lexique (
    id         SERIAL PRIMARY KEY,
    terme      VARCHAR(200) NOT NULL,
    categorie  VARCHAR(60)  NOT NULL,
    definition TEXT         NOT NULL,
    ordre      INTEGER      NOT NULL DEFAULT 0,
    actif      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexique_terme ON lexique (terme);

-- Amorçage unique : on n'insère que si la table est vide.
INSERT INTO lexique (terme, categorie, definition, ordre)
SELECT * FROM (VALUES
  ('Agrément', 'Juridique', 'Décision administrative par laquelle l''État accorde à un investisseur le bénéfice des avantages prévus par le Code des investissements, en contrepartie d''engagements précis.', 0),
  ('Amortissement', 'Finance', 'Constatation comptable de la perte de valeur d''un investissement (matériel, bâtiment…) répartie sur sa durée d''utilisation.', 10),
  ('Balance commerciale', 'Commerce extérieur', 'Solde entre la valeur des exportations et celle des importations de biens d''un pays sur une période. Elle est excédentaire quand on exporte plus qu''on n''importe, déficitaire dans le cas inverse.', 20),
  ('Balance des paiements', 'Macro-économie', 'Document comptable retraçant l''ensemble des flux économiques et financiers entre un pays et le reste du monde (biens, services, capitaux).', 30),
  ('Business plan', 'Investissement', 'Document présentant un projet d''investissement : marché visé, stratégie, prévisions financières et besoins de financement. Il sert à convaincre partenaires et bailleurs.', 40),
  ('CAF (Coût, Assurance, Fret)', 'Commerce extérieur', 'Mode d''évaluation des importations incluant le prix de la marchandise, l''assurance et le transport jusqu''à la frontière du pays importateur.', 50),
  ('Capital-risque', 'Finance', 'Financement en fonds propres de jeunes entreprises à fort potentiel mais risquées, en échange d''une prise de participation et d''une plus-value espérée à la revente.', 60),
  ('Cash-flow (flux de trésorerie)', 'Finance', 'Flux net de trésorerie généré par l''activité d''une entreprise sur une période. Indicateur clé de sa capacité à s''autofinancer.', 70),
  ('Climat des affaires', 'Investissement', 'Ensemble des conditions (réglementaires, fiscales, administratives, sécuritaires) qui facilitent ou freinent l''activité des entreprises et l''attraction des investisseurs.', 80),
  ('Concession', 'Juridique', 'Contrat par lequel l''État confie à une entreprise privée la construction et/ou l''exploitation d''un ouvrage ou service public pour une durée déterminée.', 90),
  ('Convention de non double imposition', 'Fiscalité & douane', 'Accord entre deux États évitant qu''un même revenu soit imposé deux fois, dans le pays de la source et dans celui de résidence de l''investisseur.', 100),
  ('Crédit d''impôt', 'Fiscalité & douane', 'Avantage fiscal venant en déduction de l''impôt dû ; s''il dépasse l''impôt, l''excédent peut être remboursé ou reporté.', 110),
  ('Due diligence', 'Investissement', 'Audit approfondi mené avant un investissement ou une acquisition pour vérifier la situation réelle d''une cible (comptable, juridique, fiscale, technique).', 120),
  ('Dividende', 'Finance', 'Part des bénéfices d''une société distribuée à ses actionnaires en rémunération de leur apport en capital.', 130),
  ('Droits de douane', 'Fiscalité & douane', 'Taxes perçues sur les marchandises qui franchissent une frontière, généralement à l''importation. Ils protègent la production locale et alimentent les recettes publiques.', 140),
  ('Effet de levier', 'Finance', 'Recours à l''endettement pour financer un investissement et augmenter la rentabilité des fonds propres — au prix d''un risque accru.', 150),
  ('Exonération', 'Fiscalité & douane', 'Dispense totale ou partielle du paiement d''un impôt ou d''un droit, souvent accordée pour encourager un investissement.', 160),
  ('FAB (Franco à bord)', 'Commerce extérieur', 'Mode d''évaluation des exportations à la frontière du pays exportateur, hors coût du transport et de l''assurance internationaux.', 170),
  ('Fonds propres', 'Finance', 'Ressources appartenant en propre à l''entreprise (capital, réserves, bénéfices non distribués), par opposition aux dettes.', 180),
  ('Franchise', 'Juridique', 'Contrat par lequel une entreprise (franchiseur) concède à une autre (franchisé) le droit d''exploiter sa marque et son savoir-faire contre rémunération.', 190),
  ('Fusion-acquisition (M&A)', 'Investissement', 'Opération de rapprochement d''entreprises : fusion (regroupement en une seule entité) ou acquisition (rachat d''une société par une autre). En IDE, elle s''oppose au greenfield.', 200),
  ('Greenfield', 'Investissement', 'Investissement créant une installation entièrement nouvelle (usine, site) à partir de zéro, générateur d''emplois et de capacités nouvelles.', 210),
  ('Guichet unique', 'Juridique', 'Dispositif regroupant en un seul point les formalités administratives (création d''entreprise, agrément…) pour simplifier et accélérer les démarches des investisseurs.', 220),
  ('IDE (Investissement Direct Étranger)', 'Investissement', 'Investissement durable réalisé par une entité d''un pays dans une entreprise située dans un autre pays, avec une influence significative sur la gestion (souvent ≥ 10 % du capital).', 230),
  ('Incitations fiscales', 'Fiscalité & douane', 'Mesures fiscales (exonérations, réductions, crédits d''impôt) destinées à orienter et encourager les investissements vers certains secteurs ou territoires.', 240),
  ('Investissement de portefeuille', 'Finance', 'Placement financier en titres (actions, obligations) sans volonté de contrôle de l''entreprise, contrairement à l''IDE. Plus liquide et plus volatil.', 250),
  ('Joint-venture (coentreprise)', 'Investissement', 'Entreprise commune créée par plusieurs partenaires qui partagent capital, risques et bénéfices d''un projet, souvent local et étranger.', 260),
  ('Partenariat public-privé (PPP)', 'Juridique', 'Contrat de long terme associant une entité publique et une entreprise privée pour financer, réaliser et exploiter un projet d''intérêt général.', 270),
  ('PIB (Produit Intérieur Brut)', 'Macro-économie', 'Valeur totale des biens et services produits sur le territoire d''un pays pendant une période. Principal indicateur de la taille et de la croissance d''une économie.', 280),
  ('Point mort (seuil de rentabilité)', 'Finance', 'Niveau d''activité à partir duquel les recettes couvrent exactement les charges : en dessous l''entreprise perd, au-dessus elle gagne.', 290),
  ('Rapatriement des bénéfices', 'Juridique', 'Possibilité pour un investisseur étranger de transférer librement vers son pays les bénéfices, dividendes et capitaux issus de son investissement — garantie clé de l''attractivité.', 300),
  ('Rentabilité', 'Finance', 'Capacité d''un investissement à générer un gain rapporté aux capitaux engagés. Elle mesure l''efficacité économique du projet.', 310),
  ('ROI (retour sur investissement)', 'Investissement', 'Indicateur mesurant le gain net d''un investissement rapporté à son coût, exprimé en pourcentage. Sert à comparer la performance de projets.', 320),
  ('Subvention', 'Fiscalité & douane', 'Aide financière accordée par une autorité publique à une entreprise ou un projet, sans contrepartie de remboursement.', 330),
  ('Taux de couverture', 'Commerce extérieur', 'Rapport entre exportations et importations (en %). Il indique dans quelle mesure les exportations financent les importations ; au-dessus de 100 %, la balance est excédentaire.', 340),
  ('Termes de l''échange', 'Commerce extérieur', 'Rapport entre le prix des exportations et celui des importations d''un pays. Leur amélioration accroît le pouvoir d''achat extérieur.', 350),
  ('TVA (Taxe sur la Valeur Ajoutée)', 'Fiscalité & douane', 'Impôt indirect sur la consommation, prélevé à chaque étape de la production et supporté in fine par le consommateur.', 360),
  ('Valeur ajoutée', 'Macro-économie', 'Richesse réellement créée par une entreprise : différence entre la valeur de sa production et celle des consommations intermédiaires nécessaires pour la produire.', 370),
  ('Zone d''aménagement industriel (ZAI)', 'Zones & aménagement', 'Espace équipé et viabilisé, réservé à l''accueil d''unités industrielles, pour concentrer les activités et mutualiser les infrastructures.', 380),
  ('Zone économique spéciale (ZES)', 'Zones & aménagement', 'Territoire délimité bénéficiant d''un régime dérogatoire (fiscal, douanier, réglementaire) avantageux pour attirer les investisseurs et doper les exportations.', 390)
) AS v(terme, categorie, definition, ordre)
WHERE NOT EXISTS (SELECT 1 FROM lexique);
