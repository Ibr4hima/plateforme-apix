# Classification fDi Markets

La nomenclature sectorielle de fDi Markets (Financial Times), en anglais et en
français : **37 secteurs**, **270 sous-secteurs**, **17 activités économiques**
(*business activities*).

## Ce que sont ces trois nomenclatures

**Secteurs et sous-secteurs** décrivent *ce que produit* l'entreprise —
« Food & Beverages » → « Dairy products ». Deux niveaux, pas trois.

**Les activités économiques** ne prolongent pas cet arbre : elles disent *ce
que l'entreprise vient faire* dans le pays — usine, siège, centre de R&D,
logistique, centre d'appels. Un même projet porte donc **un sous-secteur ET une
activité**, sans lien entre les deux. C'est cette colonne qui distingue une
implantation industrielle d'un simple bureau de vente, donc la valeur ajoutée
réellement captée.

## Le piège de cette nomenclature

**Un libellé de sous-secteur n'identifie rien à lui seul.** fDi réutilise les
mêmes intitulés sous plusieurs secteurs :

| Libellé | Nombre de secteurs |
|---|---|
| `Other` | 24 |
| `Furniture & related products` | 3 |
| `Wholesale Trade`, `Audio & video equipment`, `Motor vehicle & parts dealers`… | 2 |

La source les distingue en suffixant le secteur entre parenthèses —
« Other (Aerospace) », « Other (Metals) ». Le schéma en tire trois colonnes de
libellé anglais :

- `libelle_en` — **verbatim**, parenthèse comprise. C'est la forme que porteront
  les exports de projets ; elle est unique et sert de clé directe. Elle inclut
  les coquilles de la source (« Computing infrastucture providers ») : les
  corriger casserait l'appariement.
- `libelle_en_base` — le même, sans la parenthèse, pour les exports qui ne la
  portent pas.
- `cle_appariement` — `libelle_en_base` normalisé (minuscules, sans accent,
  `&` → `and`), pour absorber les écarts de casse et de ponctuation.

L'unicité porte sur **(secteur, clé)**, jamais sur la clé seule.

### Une entorse de la source, à connaître

`Support activities for mining` existe sous **Metals** *et* sous **Minerals**,
mais seule la première porte sa parenthèse ; la seconde s'écrit `Support
Activities for Mining`, en capitales de titre. Un export portant ce libellé nu
ne peut donc être rattaché **qu'avec sa colonne secteur**, et l'appariement doit
ignorer la casse — deux propriétés que le schéma garantit déjà. Un test gèle ce
cas : si fDi corrige un jour l'oubli, il tombera, et ce sera une bonne nouvelle
constatée plutôt qu'une surprise à l'import.

## Fichiers

| Fichier | Rôle |
|---|---|
| `source/*.xlsx` | Les deux classeurs d'origine, versionnés pour que la dérivation soit rejouable |
| `generer_csv.py` | Dérive les CSV depuis les classeurs, avec sept contrôles bloquants |
| `fdi_secteurs.csv`, `fdi_sous_secteurs.csv`, `fdi_business_activites.csv` | **Ce qui fait foi pour l'import** |
| `importer.py` | Écrit en base, en upsert |

Ce sont les **CSV** qui font foi, pas les classeurs : ils se relisent dans une
revue de code, se comparent d'une version à l'autre, et n'imposent pas de
dépendance Excel au conteneur backend.

## Mettre à jour la nomenclature

```bash
# 1. remplacer les classeurs dans source/, puis régénérer
python backend/scripts/fdi/generer_csv.py

# 2. relire le diff des CSV — c'est la revue qui compte
git diff backend/scripts/fdi/*.csv

# 3. vérifier les invariants sans base
cd backend && python -m pytest tests/test_fdi_classification.py

# 4. importer
docker compose exec -T backend python scripts/fdi/importer.py
```

L'import est **idempotent** (upsert sur le code) : le rejouer ne duplique rien.
Un poste présent en base mais absent des CSV est **signalé, jamais supprimé** —
une nomenclature qui perd un poste est une décision à prendre, pas un effet de
bord d'import.

## Codes

Fabriqués par nous, jamais repris de fDi : le fournisseur peut renuméroter sa
nomenclature sans que nos URL ni nos jointures bougent.

- secteur : slug du libellé anglais — `coal_oil_gas`
- sous-secteur : `<secteur>__<slug du libellé, 40 caractères>` —
  `aerospace__other`, `metals__support_activities_for_mining`
- activité : slug du libellé anglais — `research_and_development`

Le générateur refuse d'écrire si la troncature à 40 caractères crée une
collision dans un secteur.
