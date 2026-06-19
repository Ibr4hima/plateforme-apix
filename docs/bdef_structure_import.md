# BDEF — Structure du fichier source et logique d'import

Document de référence pour le développement de l'import des fichiers Excel BDEF
(Base de Données Économiques et Financières, source ANSD — Agence Nationale de la
Statistique et de la Démographie).

Basé sur l'analyse de `ANNEXE_BDEF_2024.xlsx` (édition officielle, exercices
2018–2024). Un fichier combiné multi-années (depuis 1999) est attendu — sa
structure pourra différer ; ce document décrit la structure de référence connue.

---

## 1. Feuilles du classeur

| Feuille | Rôle | Utilisée à l'import ? |
|---|---|---|
| `EDITIONS COMPTES` | Bilan (Actif/Passif) + Compte de résultat (Charges/Produits) | **Oui** — source primaire |
| `EDITIONS RATIOS` | Ratios (C), CAF/trésorerie (D), autres indicateurs (E) | **Oui** — source primaire |
| `Analyse` | Tableau de bord agrégé par macro-secteur (déjà calculé) | Non — dérivé |

---

## 2. Hiérarchie sectorielle — alignement BDEF ↔ base

Le fichier BDEF mélange **4 niveaux** de codes dans une même feuille. Ils
correspondent exactement à notre hiérarchie en base :

| Codes BDEF | Nb | Niveau | Table / `bdef_valeurs.niveau` |
|---|---|---|---|
| `0` | 1 | Global | `global` (aucune FK) |
| `1`–`35` | 35 | Secteur détaillé | `bdef_secteurs` / `secteur` |
| `101`–`109` | 9 | Groupe | `bdef_groupes` / `groupe` |
| `201`–`204` | 4 | Macro-secteur | `bdef_macro_secteurs` / `macro_secteur` |

### ⚠️ Les codes NE coïncident PAS entre BDEF et notre base

La numérotation diffère totalement d'une source à l'autre. Exemple réel :

| Secteur | Code BDEF 2024 | Code en base |
|---|---|---|
| Industries extractives | `3` | `012` |
| Production de viande et de poissons | `4` | `003` |

**Conséquence : le code ne doit JAMAIS servir à identifier un secteur.** Il sert
uniquement à déterminer le *niveau* de lecture (`detecter_niveau`). L'identité se
résout sur le **libellé** (cf. `bdef_matching.py`), au sein du niveau détecté —
ce qui lève aussi l'ambiguïté entre le groupe « Commerce » (105) et le
macro-secteur « Commerce » (203).

### Fautes présentes dans le document officiel

Le fichier source contient des coquilles qui imposent le fuzzy matching :
`TRANSFORTION` (Transformation), `FABRITION` (Fabrication), `METALLLIQUES`
(triple L), `INDUSTRIES  TEXTILES` (double espace). Validation : sur les 48
secteurs non-globaux, **46 matchent avec certitude, 2 en revue** (libellés
tronqués en base, matchs corrects sous le seuil AUTO).

---

## 3. Feuille `EDITIONS COMPTES` — lecture par code `Réf.`

Chaque secteur produit 4 blocs, repérés par une ligne d'en-tête :

```
TABLEAU : <code>-A  ACTIF        → Bilan, partie Actif
TABLEAU : <code>-A  PASSIF       → Bilan, partie Passif
TABLEAU : <code>-B  CHARGES      → Compte de résultat, Charges
TABLEAU : <code>-B  PRODUITS     → Compte de résultat, Produits
```

Structure d'un bloc :
- Ligne `TABLEAU : <code>-<lettre>  <TYPE>`
- ~3 lignes plus bas : `<code> | - | <NOM DU SECTEUR>`
- Ligne d'en-tête colonnes : libellé du poste | `Réf.` | années…
- Ligne des années : `… | 2018 | 2019 | … | 2024`
- Lignes de données : `<libellé poste> | <réf> | <valeur 2018> … <valeur 2024>`

La colonne **`Réf.`** porte les codes SYSCOHADA standardisés, stables, qui
servent de clé de lecture fiable. Exemples confirmés (bloc PRODUITS) :

| Réf. | Poste |
|---|---|
| `TI` | Chiffre d'affaires |
| `TN` | Valeur ajoutée |
| `TQ` | Excédent brut d'exploitation (EBE) |
| `TX` | Résultat d'exploitation |
| `AZ` | Total actif immobilisé (bloc ACTIF) |
| `RS` | Dotations aux amortissements (bloc CHARGES) |

→ Ces codes correspondent au champ `source_ref` de `bdef_indicateurs`
(migration 076).

**Unité** : valeurs en millions de francs CFA.

---

## 4. Feuille `EDITIONS RATIOS` — lecture par libellé

Trois types de tableaux par secteur :

### Tableau D — CAF et trésorerie
Indicateurs à libellé simple, valeur sur la même ligne :
`Capacité d'Autofinancement`, `Excédent de Trésorerie`, variations globales.

### Tableau E — Autres indicateurs
`Production`, `Valeur Ajoutée Globale (VAG)` — libellé simple, valeur sur la ligne.

### Tableau C — Ratios (modèle fraction)
**Chaque ratio s'étale sur deux lignes** : numérateur (porte la valeur calculée)
puis dénominateur (sans valeur). Le ratio est identifié par la **paire**
(numérateur, dénominateur). Exemples :

| Numérateur (ligne valeur) | Dénominateur (ligne suivante) | Ratio |
|---|---|---|
| `VALEUR AJOUTEE` | `PRODUCTION` | Taux de valeur ajoutée |
| `EBE` | `VALEUR AJOUTEE` | Taux de marge |
| `RESULTAT NET` | `CAPITAUX PROPRES` | Rentabilité financière |
| `CREANCES CLIENTS*360` | `CHIFFRE D'AFFAIRES TTC` | Délai clients |

### Alignement des colonnes
La colonne de la première valeur varie (C ou D selon les lignes). **Ne pas
présumer une colonne fixe** : repérer la ligne des années (`2018 … 2024`) dans
chaque bloc et lire les valeurs sous ces colonnes.

---

## 5. Stratégie d'import (résumé)

1. **Découper** chaque feuille en blocs `TABLEAU`.
2. **Détecter le niveau** depuis le code (`detecter_niveau`).
3. **Matcher le secteur** par libellé, au sein du niveau (`matcher_secteur`).
   - Incertain → file de revue `bdef_import_revue` (import **bloquant** : rien
     n'est écrit tant qu'il reste des lignes à valider).
   - Validé une fois → alias `bdef_secteur_alias`, réutilisé ensuite.
4. **Détecter les années** depuis la ligne d'en-tête de chaque bloc.
5. **Lire les valeurs** :
   - COMPTES → par code `Réf.` (`source_ref`).
   - RATIOS C → par paire numérateur/dénominateur.
   - RATIOS D/E → par libellé simple.
6. **Calculer** les indicateurs en mode `calcule` / fallback `lu_ou_calcule`
   (cf. `formule` / `formule_vars` de `bdef_indicateurs`).
7. **Écrire** dans `bdef_valeurs` (polymorphe selon le niveau).
