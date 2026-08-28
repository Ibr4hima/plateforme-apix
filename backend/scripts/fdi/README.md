# Classification fDi Markets

Les nomenclatures de fDi Markets (Financial Times), en anglais et en français :
**37 secteurs**, **270 sous-secteurs**, **17 activités économiques**
(*business activities*), **5 signaux d'investisseur** (*investor signals*) et
**3 types de projet**.

## Ce que sont ces cinq nomenclatures

**Secteurs et sous-secteurs** décrivent *ce que produit* l'entreprise —
« Food & Beverages » → « Dairy products ». Deux niveaux, pas trois.

**Les activités économiques** ne prolongent pas cet arbre : elles disent *ce
que l'entreprise vient faire* dans le pays — usine, siège, centre de R&D,
logistique, centre d'appels. Un même projet porte donc **un sous-secteur ET une
activité**, sans lien entre les deux. C'est cette colonne qui distingue une
implantation industrielle d'un simple bureau de vente, donc la valeur ajoutée
réellement captée.

**Les signaux d'investisseur** sont la nomenclature la plus prospective : ils ne
décrivent pas un projet annoncé mais une entreprise qui *pourrait* en annoncer
un — un projet à l'étude, une levée de fonds, une nomination régionale, un
contrat décroché à l'étranger. Pour une agence de promotion, c'est la matière
première du démarchage.

Ils sont les seuls à porter une **définition**, dans les deux langues, et elle
fait partie de la donnée : « New Personnel » désigne la nomination d'un
responsable régional qui laisse présager une implantation — sans sa définition,
on y lirait un simple recrutement. Leur **ordre** est celui de la source, du
signal le plus concret au plus faible ; il n'est pas alphabétique, et un test
le gèle.

**Les types de projet** — *New*, *Expansion*, *Co-location* — disent ce que le
projet fait à l'existant. La distinction est décisive pour lire les chiffres :
une **extension** prolonge un investisseur déjà présent, c'est du suivi ; une
**implantation nouvelle** est une conquête. Les additionner sans les distinguer
masquerait précisément ce qu'une agence de promotion cherche à mesurer.

C'est la seule nomenclature **sans classeur source** : ses trois postes sont
saisis à la main dans `fdi_types_projet.csv`, versionné comme les CSV dérivés.
Le générateur ne le produit pas et n'y touche pas ; deux tests tiennent lieu de
garde-fou à sa place, en vérifiant que le code et la clé d'appariement dérivent
bien du libellé anglais.

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
| `source/*.xlsx` | Les quatre classeurs d'origine, versionnés pour que la dérivation soit rejouable. Les signaux viennent de deux classeurs parallèles — un par langue — appariés par leur numéro d'ordre, seule clé commune |
| `generer_csv.py` | Dérive les CSV depuis les classeurs, avec sept contrôles bloquants |
| `fdi_secteurs.csv`, `fdi_sous_secteurs.csv`, `fdi_business_activites.csv`, `fdi_signaux.csv` | **Ce qui fait foi pour l'import**, dérivé des classeurs |
| `fdi_types_projet.csv` | Fait foi aussi, mais **saisi à la main** : pas de classeur source |
| `importer.py` | Écrit en base, en upsert |

Ce sont les **CSV** qui font foi, pas les classeurs : ils se relisent dans une
revue de code, se comparent d'une version à l'autre, et n'imposent pas de
dépendance Excel au conteneur backend.

## Qui fait autorité : le dépôt ou la base ?

Les deux, ligne par ligne — c'est ce que tranche la colonne `origine` :

| `origine` | Sens | Comportement de l'import |
|---|---|---|
| `depot` | La ligne vient des CSV | Elle les suit : une correction apportée aux fichiers se propage au prochain déploiement |
| `admin` | Elle a été créée ou corrigée dans l'écran d'administration | L'import **ne la touche plus**. La décision humaine l'emporte sur le fichier |

Le rapport d'import distingue donc trois populations : les **ajouts** faits à
l'écran, les lignes **protégées** (présentes dans les CSV *et* corrigées à
l'écran — dépôt et base divergent, à arbitrer un jour sciemment), et les
**orphelines** (issues du dépôt, disparues des CSV).

### Renommer, ajouter — mais jamais supprimer

Un projet portera l'**identifiant** du secteur, jamais son libellé. Renommer
est donc un simple `UPDATE` : tous les projets rattachés, même ceux de 2010,
affichent aussitôt le nouveau nom. Rien à propager.

Le `code`, en revanche, ne change **jamais** après création : c'est l'identité
stable de la ligne, ce à quoi les imports de projets s'apparient.

La suppression n'existe pas, et ce n'est pas un oubli : un poste supprimé
emporterait le rattachement de tous les projets qui le référencent. Un poste que
fDi ne publie plus reste en base, où il continue de décrire le passé.

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
Il ne touche pas les lignes d'`origine = 'admin'`, et signale sans jamais
supprimer les postes présents en base mais absents des CSV.

## Codes

Fabriqués par nous, jamais repris de fDi : le fournisseur peut renuméroter sa
nomenclature sans que nos URL ni nos jointures bougent.

- secteur : slug du libellé anglais — `coal_oil_gas`
- sous-secteur : `<secteur>__<slug du libellé, 40 caractères>` —
  `aerospace__other`, `metals__support_activities_for_mining`
- activité : slug du libellé anglais — `research_and_development`
- signal : slug du libellé anglais — `new_investment_strategy`
- type de projet : slug du libellé anglais — `co_location`

Le générateur refuse d'écrire si la troncature à 40 caractères crée une
collision dans un secteur.
