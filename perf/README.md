# Banc de mesure

Mesure la plateforme comme en production, sur une base au volume d'une grande
organisation : des milliers d'agents, des centaines de milliers de lignes, des
centaines de requêtes simultanées. Il sert à savoir où sont les lenteurs, et à
vérifier, après chaque correction, que les chiffres s'améliorent.

Résultats de la première campagne : [RESULTATS-2026-11-07.md](RESULTATS-2026-11-07.md).

## Ce qu'il faut

- Un Postgres local jetable (16 ou plus, avec PostGIS), sur un port libre :
  le banc ne touche à aucune autre base, et refuse de remplir une table qui
  contient déjà des lignes.
- Les dépendances de l'API, plus `pip install aiohttp psutil` pour le banc.
- Playwright (déjà présent dans les environnements de travail).

## Les étapes

```bash
# 1. La base : migrations, référentiel des pays, imports réels (NACE, fDi)
PGPORT=5600 bash perf/monter_base.sh

# 2. Le volume « grande organisation » (5 000 agents, 20 000 prospects,
#    2 millions de flux commerciaux…) ; --echelle 0.1 pour un essai rapide
python perf/generer_donnees.py --base apixbanc --port 5600 --echelle 1

# 3. L'API comme en production : 2 processus, même pool de connexions
cd backend && POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5600 POSTGRES_DB=apixbanc \
  POSTGRES_USER=apix POSTGRES_PASSWORD=apix SECRET_KEY=banc AUTH_ENFORCED=false DEBUG=false \
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2

# 4. Le site construit (next build), servi comme en production
cd frontend && NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1 npx next build
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
cd .next/standalone && PORT=3200 HOSTNAME=127.0.0.1 AUTH_SECRET=banc AUTH_TRUST_HOST=true node server.js

# 5. La carte des requêtes de chaque page (et de ses onglets)
node perf/cartographier.js http://127.0.0.1:3200 perf/pages.json

# 6. Les mesures
python perf/charge.py routes  --sortie perf/resultats/AAAA-MM-JJ/routes.json   # chaque adresse seule
python perf/charge.py pages   --sortie perf/resultats/AAAA-MM-JJ/pages.json    # chaque page, une personne
python perf/charge.py paliers --agents 10,25,50,100,200 --duree 60 \
  --sortie perf/resultats/AAAA-MM-JJ/paliers.json                              # agents sans pause
python perf/charge.py journee --agents 100,300,1000 --duree 90 --pause 20 \
  --sortie perf/resultats/AAAA-MM-JJ/journee.json                              # agents qui lisent
node perf/poids_pages.js http://127.0.0.1:3200 perf/resultats/AAAA-MM-JJ/poids.json

# 7. Le ménage : la base de banc se supprime
dropdb -h 127.0.0.1 -p 5600 -U postgres apixbanc
```

`--simuler-pagination` (paliers et journée) ne garde que la première page des
listes aujourd'hui téléchargées en entier : une projection de la plateforme
une fois ces listes paginées côté serveur.

## À savoir pour lire les chiffres

- Le banc, l'API, la base et le site tournent sur la même machine : les
  valeurs absolues sont plus sévères qu'un serveur dédié. La comparaison
  avant/après, elle, est juste, à machine égale.
- Une requête qui dépasse 60 s compte comme abandonnée (`--delai`).
- Les données générées sont inventées mais respectent le schéma : les
  requêtes suivent les mêmes chemins qu'en production.
