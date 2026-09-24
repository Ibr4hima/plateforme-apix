# Édition 2025 — saisie en cours

Ce dossier reçoit les fichiers de l'édition 2025 (années 2021–2025) au fil de
leur saisie, famille par famille. **L'import de déploiement ne le lit pas** :
`importer_csv` ne cherche que `edition_XXXX_*.csv` à la racine de
`scripts/nace`.

**Tout passe à la racine EN MÊME TEMPS, une fois toutes les familles
saisies et vérifiées.** Une famille seule ne suffit pas : essayé en base de
travail avec les principaux produits complets, la page prend 2025 comme
année par défaut (le curseur va jusqu'à la dernière année disponible) et
les sections Zone géographique, Partenaires par continent et Partenaires
par groupement restent vides à 2025, faute de données ; « À retenir » perd
ses lignes premier client / premier fournisseur. Publier famille par
famille donnerait cette page en production.

Vérification d'une famille, dans ce dossier :

    python3 ../verifier_principaux_produits.py .

## Principaux produits (tableaux 6 à 9) — COMPLET

Saisie ligne à ligne : `saisie_2025_principaux_produits.py`, qui écrit les
deux CSV à côté de lui. Libellés d'import normalisés comme dans les éditions
précédentes (« Machines et Appareils » → « Machines et appareils », etc.).

- Somme des lignes = TOTAL imprimé : 20/20 conformes, écart d'arrondi ≤ 1.
- **Exportations** : aucune révision de 2021–2024 (52 couples identiques,
  TOTAL identiques). Nouveau produit **« Gaz naturel liquéfié »** (2025 :
  115 868 MFCFA / 593 346 t), « - » de 2021 à 2024 stocké vide (NULL =
  absence de flux, distinct de 0).
- **Importations : 36 valeurs révisées sur 44** (9 produits sur 11 ;
  « Huiles brutes de pétrole » et « Huiles et graisses » inchangées).
  - 2021, 2022, 2023 : TOTAL identiques à l'édition 2024 — le rapport
    RÉPARTIT autrement entre produits (ex. 2021 : Machines et appareils
    −30 050, Matériels de transport +23 372), la somme de l'année ne bouge
    pas. Une erreur de lecture ne tiendrait pas cet équilibre.
  - 2024 : TOTAL revu à la baisse, **7 161 394 → 7 012 377 MFCFA
    (−149 017)** et 15 539 032 → 15 520 015 t (−19 017), presque tout sur
    « Matériels de transport et pièces détachées » (721 298 → 571 196).
    La saisie retombe exactement sur le nouveau TOTAL imprimé.
  - Conséquence sur la page : balance 2024 −3 252,3 → −3 103,3 Md FCFA,
    taux de couverture 2024 54,6 % → 55,7 %.
  - À recouper avec les autres familles de l'édition 2025 : leur total
    import 2024 doit être 7 012 377 lui aussi.
- Chargement réel en base de travail (importer.py) puis lecture API et page
  vérifiés, base remise en l'état ensuite.

## Produits regroupés — exportations (tableaux 10 et 11) : saisies

Saisie ligne à ligne : `saisie_2025_produits_regroupes.py`. Libellés du
rapport (capitales sans accents) ramenés à ceux, normalisés, des éditions
précédentes, dans l'ordre du rapport.

- Somme des lignes = TOTAL imprimé : 10/10 conformes, écarts de −2 à +3
  (32 lignes arrondies une à une, tolérance ±6).
- Aucune révision de 2021–2024 : 124 couples produit × année identiques à
  l'édition 2024, aucun poste disparu.
- Nouveau poste : **« Gaz liquéfiés naturels »** (libellé du rapport
  « GAZ LIQUEFIES NATURELS »), « - » de 2021 à 2024 : 32 postes export au
  lieu de 31. Même montant que « Gaz naturel liquéfié » des principaux
  produits.
- « 0 » et « - » distingués comme imprimés : farine de froment 2024 = 0,
  2025 = « - » (vide) ; huile raffinée d'arachide 2023 = 0, 2025 = « - ».
- **Recoupement indépendant avec les tableaux 6–7** (saisis séparément) :
  110 concordances, 0 écart, sur 11 postes présents dans les deux
  nomenclatures, valeur et poids, 2021–2025 — dont les sommes Titane +
  Zirconium = « Titane et zircon » et Coton en masse + Tissus en coton =
  « Cotons et tissus en coton ».
- Chargement en base de travail et lecture API vérifiés, base remise en
  l'état ensuite.

## Produits regroupés — importations (tableaux 12 et 13) : famille COMPLÈTE

Mêmes 56 postes, même ordre que l'édition 2024 (440 lignes au total pour la
famille, export compris).

- Somme des lignes = TOTAL imprimé : 10/10 conformes, écarts de −5 à +3
  (56 lignes arrondies une à une, tolérance ±6).
- **Recoupement indépendant avec les tableaux 8–9** : 9 correspondances
  sur 10 concordent à l'arrondi près sur les 10 valeurs (valeur et poids,
  2021–2025), dont trois par sommes de plusieurs postes :
  Froment + Maïs + Riz + Mil + Autres céréales = « Produits céréaliers » ;
  les 5 postes machines = « Machines et appareils » ; Automobiles +
  Camions + Pièces + Autres véhicules + Autres matériels = « Matériels de
  transport et pièces détachées ». La dixième (« Métaux communs et
  ouvrages » contre les 6 postes métalliques) ne concorde pas — mais
  l'écart est le même dans l'édition 2024 déjà validée (2021 : 409 217
  contre 485 040) : c'est une différence de périmètre entre les deux
  nomenclatures, non une erreur de saisie.
- **Révisions 2021–2024 : 107 couples sur 224**, dans la continuité des
  principaux produits :
  - 2021, 2022, 2023 : les révisions se compensent (somme ±2) — le
    rapport répartit autrement, les totaux ne bougent pas ;
  - 2024 : −149 020 MFCFA et −19 017 t au total, dont **« Autres
    matériels de transport » 210 980 → 61 963 (−149 017)** — exactement la
    baisse du TOTAL import 2024 constatée dans les tableaux 8–9 : la
    révision est confirmée par deux tableaux distincts.
- Chargement en base de travail et lecture API vérifiés (import 2024 =
  7 012 373, soit le nouveau TOTAL à l'arrondi près), base remise en
  l'état ensuite.

## Groupes d'utilisation — exportations (tableaux 14 et 15) : saisies

Saisie ligne à ligne : `saisie_2025_groupes_utilisation.py`. Mêmes 9 groupes
exhaustifs que l'édition 2024 (leur somme est le total des exportations).

- Somme des 9 groupes = TOTAL imprimé : 10/10 conformes, écarts de −2 à +2.
- Aucune révision de 2021–2024 : 36 couples identiques à l'édition 2024.
- « Or industriel » identique à la ligne des tableaux 6–7, valeur et poids,
  2021–2025 (recoupement indépendant).
- Chargement en base de travail vérifié (45 lignes, sommes conformes), base
  remise en l'état ensuite.

## Groupes d'utilisation — importations (tableaux 16 et 17) : famille COMPLÈTE

- Somme des 9 groupes = TOTAL imprimé : 10/10 conformes, écarts de −2 à +2
  (import valeur et poids 2024 : exacts, 7 012 377 et 15 520 015).
- **Une seule révision sur 36 couples** : 2024, « Produits finis destinés à
  l'industrie », 1 385 170 → 1 236 153 MFCFA (**−149 017**) et 401 092 →
  382 075 t (**−19 017**). Ce sont exactement les deux baisses du TOTAL
  import 2024 relevées dans les principaux produits et les produits
  regroupés : **la révision 2024 est confirmée par trois familles
  distinctes**, et localisée (matériels de transport, qui relèvent des
  produits finis destinés à l'industrie). Les réaffectations entre produits
  de 2021–2023 ne se voient pas ici : elles restent dans les mêmes groupes.
- Chargement en base de travail vérifié (90 lignes, sommes conformes), base
  remise en l'état ensuite.

## Continents — exportations (tableaux 23 et 24) : saisies

Saisie ligne à ligne : `saisie_2025_continents.py`. Mêmes 6 modalités
exhaustives que l'édition 2024 (libellés du rapport « EUROPE »,
« AMERIQUE »… ramenés aux formes courtes).

- Somme des 6 continents = TOTAL imprimé : 10/10 conformes, écarts de −1 à
  +1 (2025 exact en valeur et en poids).
- Aucune révision de 2021–2024 : 24 couples identiques à l'édition 2024.
- Contrôle indépendant à venir : Σ régions d'un continent = continent,
  une fois les tableaux par région saisis.
- Chargement en base de travail vérifié, base remise en l'état ensuite.

## Continents — importations (tableaux 25 et 26) : famille COMPLÈTE

- Somme des 6 continents = TOTAL imprimé : 10/10 conformes, écarts de −2 à
  0. Le TOTAL 2022 en valeur est imprimé 7 549 365 (7 549 364 dans les
  autres tableaux) : repris tel quel, comme l'édition 2024 le faisait.
- **Révisions : 4 couples sur 24, tous en 2024**, somme −149 016 MFCFA et
  −19 017 t — la même révision du TOTAL que dans les trois familles
  précédentes (à 1 d'arrondi près). Répartition :
  - Europe 3 226 226 → 3 083 585 (−142 641 ; poids −15 106) ;
  - Asie 2 228 256 → 2 221 881 (−6 375 ; poids −3 911) ;
  - **Afrique +227 264 et Amérique −227 264** (poids ±548 517 t, au
    chiffre près) : un transfert d'un partenaire américain vers un
    partenaire africain, sans effet sur le total. À identifier dans les
    tableaux par pays.
- Chargement en base de travail vérifié (60 lignes), base remise en l'état.

## Régions — exportations (tableaux 19 et 20) : saisies

Nouveauté de l'édition 2025 : les régions ont leurs propres tableaux (jusqu'en
2024, elles n'existaient que comme sous-totaux des tableaux par pays). Saisie
ligne à ligne : `saisie_2025_regions.py`, libellés ramenés aux 12 régions
stables (REGIONS_ORDRE de app/api/routes/nace.py).

**Deux particularités, établies contre le détail par pays de l'édition 2024 :**

1. **Étiquettes des deux régions d'Amérique interverties dans le rapport.**
   Les montants de la ligne « AMERIQUE DU NORD » sont exactement ceux de
   l'Amérique centrale et du Sud de l'édition 2024, et inversement : 16
   égalités sur 16 (4 années × 2 régions × valeur et poids). L'Amérique du
   Nord, c'est États-Unis + Canada — 69 439 + 1 302 = 70 741 MFCFA en 2021 —
   alors que la ligne ainsi étiquetée porte 43 412. Chaque montant est saisi
   sous sa vraie région. À reconfirmer avec les tableaux par pays 2025.
2. **Le Royaume-Uni sort de l'Union européenne (Brexit).** La région perd
   chaque année exactement les exportations britanniques de l'édition 2024,
   à 1 près (2021 : 40 863 ; 2022 : 45 762 ; 2023 : 58 614 ; 2024 : 59 021),
   et « Autres pays d'Europe » gagne le même montant. Changement réel,
   conservé. Conséquence : la série « Union européenne » de la page change de
   périmètre en 2021 (Royaume-Uni compris jusqu'en 2020, lu sur les éditions
   antérieures).

Contrôles :
- Σ 12 régions = TOTAL imprimé : 10/10 conformes, écarts de −1 à +2.
- **Σ régions d'un continent = tableaux 23–24** (saisis séparément) :
  60/60 concordances.
- Contre l'édition 2024 : hors Royaume-Uni, seuls écarts de 1 à 3 unités sur
  « Divers » (sous-totaux que l'extraction 2024 avait recalculés sur le
  détail par pays). **Aucune révision à l'export** une fois les étiquettes
  remises en place.
- Chargement en base de travail vérifié (60 lignes ; Amérique du Nord 2021
  = 70 741), base remise en l'état ensuite.

## Régions — importations (tableaux 21 et 22) : famille COMPLÈTE

Même interversion des deux lignes d'Amérique qu'à l'export (2021–2023 :
égalités exactes avec l'édition 2024 une fois remises ; États-Unis + Canada
2021 = 178 183, sur la ligne imprimée « Centre et Sud » 178 182).

- Σ 12 régions = TOTAL imprimé : 10/10 conformes, écarts ±1.
- Σ régions d'un continent = tableaux 25–26 : 60/60 concordances.
- Contre l'édition 2024 :
  - 2021–2024 : Royaume-Uni transféré de l'UE vers « Autres pays d'Europe »,
    au chiffre près (2024 : 59 556 MFCFA / 48 987 t) ;
  - « Divers » : écarts de 1 à 3 unités (arrondis déjà arbitrés en 2024) ;
  - **2024, la révision du TOTAL import (−149 017 MFCFA, −19 017 t)
    s'explique entièrement** : UE −142 641 (hors Royaume-Uni) et Autres pays
    d'Asie −6 376, qui sont les baisses Europe et Asie des tableaux 25–26 ;
    plus un transfert Amérique centrale et du Sud → Afrique occidentale de
    227 264 MFCFA / 548 517 t, sans effet sur le total.
  - **Ce transfert est très probablement le NICARAGUA** : l'édition 2024 lui
    attribuait 229 696 MFCFA / 558 469 t d'importations en 2024 (contre 2 223
    en 2023), montant invraisemblable pour ce partenaire. Erreur de codage
    corrigée par l'ANSD (le Nigeria serait le candidat naturel) — à
    confirmer avec les tableaux par pays 2025.
- Chargement en base de travail vérifié (120 lignes), base remise en l'état.

## Pays — exportations en valeur (tableau 31) : saisies

177 partenaires dans `donnees_2025_pays.py` (libellés BRUTS en capitales,
clés du rapprochement avec le référentiel ; régions ramenées aux 12 libellés
stables). Le CSV `edition_2025_pays.csv` sera écrit quand valeur et poids
seront saisis pour les deux sens.

- **Les tableaux par pays confirment l'interversion des tableaux 19–22** :
  ici « AMERIQUE DU NORD » (70 741 en 2021) détaille bien États-Unis +
  Canada, et « AMERIQUE CENTRALE ET DU SUD » (43 412) le Mexique, le Brésil…
- **Royaume-Uni sous « Autres pays de l'Europe »** : seul changement de
  région par rapport à l'édition 2024 (Brexit).
- Σ pays d'une région = sous-total imprimé : 30 exacts sur 55, les 25
  autres à 1–3 unités (arrondis ; tolérance 6 comme verifier_pays.py).
- **Sous-total « DIVERS » fautif dans ce tableau** : 76 655 / 113 794 /
  136 327 / 191 227 / 92 915, soit chaque année exactement le sous-total
  « Afrique du Nord » de moins que la vraie valeur (86 830 / 133 485 /
  162 901 / 229 230 / 176 863). La vraie valeur est attestée trois fois :
  tableau 19 (régions), tableau 23 (continents) et TOTAL du tableau 31
  lui-même (Σ sous-totaux + écart = TOTAL). « Divers » étant imprimé sans
  détail, la règle d'arbitrage déjà en place (une seule région sans
  ventilation porte l'écart au TOTAL) donne la même correction.
- **Aucune révision** : 692 valeurs 2021–2024 identiques à l'édition 2024.
- Libellés : GROENLAND, ILES CANARIES, JAMAIQUE, REUNION reviennent (déjà
  connus des éditions antérieures et de l'arbitrage) ; MALDIVES sort (aucune
  exportation depuis 2020).

## Pays — exportations en poids (tableau 32) : INUTILISABLE, signalé à l'ANSD

Le tableau 32 de l'édition 2025 est une reprise de l'édition 2023 : colonnes
« 2020, 2021, 2022, 2023 » identiques à nos données, 5e colonne étiquetée
« 2022 » qui recopie la colonne 2022, Royaume-Uni imprimé deux fois (UE et
Autres Europe). Il ne contient ni 2024 ni 2025. Vérifié sur France,
Pays-Bas, Mali, Inde, Royaume-Uni, États-Unis. L'utilisateur a signalé le
défaut à l'ANSD ; la famille pays attend le tableau corrigé.

## Pays — importations en valeur (tableau 33) : saisies

~180 fournisseurs dans `donnees_2025_pays.py` (IMPORT_VALEUR).

- **Le tableau 33 range le ROYAUME UNI sous l'Union européenne**, contre
  les tableaux 21 et 31 (Brexit). Il est rangé sous « Autres pays
  d'Europe » comme partout ailleurs : 10 régions sur 11 concordent alors
  avec le tableau 21 à ±4.
- **DIVERS imprimé surévalué** (2022 : 59 696 au lieu de 57 222), du
  montant exact manquant au sous-total « Autres pays d'Europe » (Σ pays −
  sous-total : 2 474 / 979 / 1 483 / 2 474) : même défaut que les éditions
  2023–2024, même arbitrage (le détail fait foi). Valeur reconstituée =
  tableau 21.
- **La révision 2024 des importations, pays par pays** (contre l'édition
  2024, 696 valeurs comparées, 4 révisées) :
  - CROATIE 145 502 → 2 861 (−142 641) : erreur de l'ancienne donnée ;
  - REPUBLIQUE POPULAIRE DE CHINE 848 242 → 841 867 (−6 375) ;
  - NICARAGUA 229 696 → 12 497 et NIGERIA 314 782 → 531 981 (±217 199) :
    l'erreur de codage soupçonnée est confirmée.
- **Point non résolu, 2024 seulement : 10 065 MFCFA** entre Afrique
  occidentale et Amérique centrale et du Sud. Le tableau 33 (détail, dont
  les sous-totaux bouclent : Afrique occidentale 666 027) garde 12 497 au
  Nicaragua ; les tableaux 21 et 25 placent l'Afrique occidentale à 676 091,
  soit un Nicaragua d'environ 2 432. Contradiction interne du rapport, à
  soumettre à l'ANSD avec le tableau 32.
- Nouveau libellé : LESOTHO (2025).

## Pays — importations en poids (tableau 34) : saisie PARTIELLE

Captures reçues jusqu'à NICARAGUA, puis à partir de CHINE : manquent la fin
d'« Amérique centrale et du Sud », « Amérique du Nord », « Asie
occidentale » et le début d'« Autres pays d'Asie ».

- Régions complètes (UE, Afrique centrale, du Nord, occidentale, orientale
  et du Sud, Océanie) : sous-totaux = tableau 22 exactement, Σ pays =
  sous-total à ±2.
- « Autres pays d'Europe » : sous-total imprimé amputé du Royaume-Uni (et
  du transfert récurrent vers Divers) ; DIVERS surévalué du même montant.
  Reconstitués sur le détail, les deux égalent le tableau 22.
- Révisions contre l'édition 2024 (484 poids comparés, 4 révisés), les
  mêmes qu'en valeur : CROATIE −15 106 t, CHINE −3 911 t, NICARAGUA →
  NIGERIA 548 518 t (le transfert COMPLET, comme les tableaux 21, 22, 25).

### Décision : Nicaragua 2024 = 2 432 MFCFA, Nigeria 2024 = 542 046 MFCFA

Retenue avec l'utilisateur, contre la valeur imprimée au tableau 33 :

| Nicaragua | valeur | poids | prix moyen |
|---|---|---|---|
| 2021 | 114 | 425 | 268 FCFA/kg |
| 2023 | 2 223 | 9 070 | 245 FCFA/kg |
| 2024 selon le tableau 33 | 12 497 | 9 951 | 1 256 FCFA/kg |
| **2024 selon les tableaux 21/25** | **2 432** | **9 951** | **244 FCFA/kg** |

Le poids 2024 (9 951 t, tableau 34) et les tableaux 21, 22, 25 et 34
décrivent tous un transfert complet ; seule la valeur du tableau 33 n'a été
corrigée qu'en partie (217 199 au lieu de 227 264 MFCFA). Nigeria 2024 =
531 981 + 10 065 = 542 046, soit exactement l'ancienne valeur (314 782) plus
le montant mal codé (227 264). Question transmise à l'ANSD par
l'utilisateur ; à corriger si sa réponse diffère.

## Chapitres SH — exportations en valeur (tableau 35) : saisies

`saisie_2025_chapitres.py` : 96 chapitres, même ordre et mêmes chapitres que
l'édition 2024 ; chaque ligne reçoit le libellé normalisé de 2024.

- Σ 96 chapitres = TOTAL imprimé : écarts −2 à +3 (tolérance 12).
- 2021–2024 : 384 valeurs identiques à l'édition 2024 — ce qui prouve aussi
  l'alignement ligne à ligne de la saisie.
- Recoupements 2025 : chapitre 71 (perles, métaux précieux) 978 701 contre
  or industriel 977 997 ; chapitre 27 (combustibles) 2 504 516 contre huile
  brute + autres produits pétroliers + GNL 2 504 511.

## Reste à saisir
- Pays (tableaux hiérarchiques : Σ pays d'une région = sous-total ; à
  confronter aux tableaux régions ci-dessus), et chapitres SH si le rapport
  les contient encore.
