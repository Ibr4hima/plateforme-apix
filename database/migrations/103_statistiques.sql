-- 103 — Module Statistiques : indicateurs pays et séries temporelles.
CREATE TABLE IF NOT EXISTS stat_indicateurs (
  code TEXT PRIMARY KEY, libelle TEXT NOT NULL, unite TEXT, categorie TEXT,
  ordre INTEGER NOT NULL DEFAULT 0, derive BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS stat_pays (
  pays_id INTEGER NOT NULL REFERENCES ref_pays(id) ON DELETE CASCADE,
  annee SMALLINT NOT NULL, indicateur TEXT NOT NULL, valeur DOUBLE PRECISION,
  PRIMARY KEY (pays_id, annee, indicateur));
CREATE INDEX IF NOT EXISTS idx_stat_pays_ind ON stat_pays(indicateur);

INSERT INTO stat_indicateurs (code,libelle,unite,categorie,ordre,derive) VALUES
  ('population','Population','habitants','Démographie',1,FALSE),
  ('superficie','Superficie','km²','Géographie',2,FALSE),
  ('densite','Densité de population','hab/km²','Démographie',3,TRUE),
  ('pib','PIB (prix courants)','Md USD','Économie',4,FALSE),
  ('pib_hab','PIB par habitant','USD','Économie',5,TRUE),
  ('croissance_pib','Croissance du PIB','%','Économie',6,FALSE)
ON CONFLICT (code) DO UPDATE SET libelle=EXCLUDED.libelle,unite=EXCLUDED.unite,categorie=EXCLUDED.categorie,ordre=EXCLUDED.ordre,derive=EXCLUDED.derive;

INSERT INTO stat_pays (pays_id,annee,indicateur,valeur)
  SELECT id,2019,'population',16029902 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2019,'pib',26.47 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2019,'croissance_pib',4.6 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2020,'population',16446679 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2020,'pib',26.81 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2020,'croissance_pib',1.3 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2021,'population',16874293 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2021,'pib',28.55 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2021,'croissance_pib',6.5 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2022,'population',17313024 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2022,'pib',29.64 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2022,'croissance_pib',3.8 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2023,'population',17763163 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2023,'pib',31.0 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2023,'croissance_pib',4.6 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2019,'superficie',196722 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2020,'superficie',196722 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2021,'superficie',196722 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2022,'superficie',196722 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2023,'superficie',196722 FROM ref_pays WHERE code_iso3='SEN'
UNION ALL
  SELECT id,2019,'population',26055714 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2019,'pib',64.63 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2019,'croissance_pib',6.2 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2020,'population',26733163 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2020,'pib',65.73 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2020,'croissance_pib',1.7 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2021,'population',27428225 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2021,'pib',70.4 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2021,'croissance_pib',7.1 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2022,'population',28141359 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2022,'pib',74.76 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2022,'croissance_pib',6.2 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2023,'population',28873034 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2023,'pib',79.4 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2023,'croissance_pib',6.2 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2019,'superficie',322463 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2020,'superficie',322463 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2021,'superficie',322463 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2022,'superficie',322463 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2023,'superficie',322463 FROM ref_pays WHERE code_iso3='CIV'
UNION ALL
  SELECT id,2019,'population',25852000 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2019,'pib',44.33 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2019,'croissance_pib',3.5 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2020,'population',26524152 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2020,'pib',44.55 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2020,'croissance_pib',0.5 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2021,'population',27213780 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2021,'pib',46.16 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2021,'croissance_pib',3.6 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2022,'population',27921338 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2022,'pib',47.73 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2022,'croissance_pib',3.4 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2023,'population',28647293 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2023,'pib',49.3 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2023,'croissance_pib',3.3 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2019,'superficie',475442 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2020,'superficie',475442 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2021,'superficie',475442 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2022,'superficie',475442 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2023,'superficie',475442 FROM ref_pays WHERE code_iso3='CMR'
UNION ALL
  SELECT id,2019,'population',21020788 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2019,'pib',18.99 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2019,'croissance_pib',4.8 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2020,'population',21567329 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2020,'pib',18.76 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2020,'croissance_pib',-1.2 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2021,'population',22128079 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2021,'pib',19.34 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2021,'croissance_pib',3.1 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2022,'population',22703409 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2022,'pib',20.02 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2022,'croissance_pib',3.5 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2023,'population',23293698 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2023,'pib',20.9 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2023,'croissance_pib',4.4 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2019,'superficie',1240192 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2020,'superficie',1240192 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2021,'superficie',1240192 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2022,'superficie',1240192 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2023,'superficie',1240192 FROM ref_pays WHERE code_iso3='MLI'
UNION ALL
  SELECT id,2019,'population',20982694 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2019,'pib',17.83 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2019,'croissance_pib',5.7 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2020,'population',21528244 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2020,'pib',18.16 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2020,'croissance_pib',1.9 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2021,'population',22087979 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2021,'pib',19.42 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2021,'croissance_pib',6.9 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2022,'population',22662266 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2022,'pib',19.71 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2022,'croissance_pib',1.5 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2023,'population',23251485 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2023,'pib',20.3 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2023,'croissance_pib',3.0 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2019,'superficie',274222 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2020,'superficie',274222 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2021,'superficie',274222 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2022,'superficie',274222 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2023,'superficie',274222 FROM ref_pays WHERE code_iso3='BFA'
UNION ALL
  SELECT id,2019,'population',12805946 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2019,'pib',19.46 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2019,'croissance_pib',5.6 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2020,'population',13138901 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2020,'pib',20.38 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2020,'croissance_pib',4.7 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2021,'population',13480513 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2021,'pib',21.38 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2021,'croissance_pib',4.9 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2022,'population',13831006 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2022,'pib',22.23 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2022,'croissance_pib',4.0 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2023,'population',14190612 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2023,'pib',23.5 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2023,'croissance_pib',5.7 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2019,'superficie',245857 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2020,'superficie',245857 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2021,'superficie',245857 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2022,'superficie',245857 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2023,'superficie',245857 FROM ref_pays WHERE code_iso3='GIN'
UNION ALL
  SELECT id,2019,'population',12734133 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2019,'pib',15.5 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2019,'croissance_pib',6.9 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2020,'population',13065221 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2020,'pib',16.09 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2020,'croissance_pib',3.8 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2021,'population',13404917 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2021,'pib',17.25 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2021,'croissance_pib',7.2 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2022,'population',13753444 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2022,'pib',18.34 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2022,'croissance_pib',6.3 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2023,'population',14111034 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2023,'pib',19.4 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2023,'croissance_pib',5.8 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2019,'superficie',114763 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2020,'superficie',114763 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2021,'superficie',114763 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2022,'superficie',114763 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2023,'superficie',114763 FROM ref_pays WHERE code_iso3='BEN'
UNION ALL
  SELECT id,2019,'population',8170364 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2019,'pib',7.53 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2019,'croissance_pib',5.5 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2020,'population',8382793 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2020,'pib',7.68 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2020,'croissance_pib',2.0 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2021,'population',8600746 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2021,'pib',8.15 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2021,'croissance_pib',6.0 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2022,'population',8824365 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2022,'pib',8.62 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2022,'croissance_pib',5.8 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2023,'population',9053799 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2023,'pib',9.1 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2023,'croissance_pib',5.6 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2019,'superficie',56785 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2020,'superficie',56785 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2021,'superficie',56785 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2022,'superficie',56785 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2023,'superficie',56785 FROM ref_pays WHERE code_iso3='TGO'
UNION ALL
  SELECT id,2019,'population',23650703 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2019,'pib',14.01 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2019,'croissance_pib',5.9 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2020,'population',24265621 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2020,'pib',14.51 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2020,'croissance_pib',3.6 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2021,'population',24896528 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2021,'pib',14.71 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2021,'croissance_pib',1.4 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2022,'population',25543837 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2022,'pib',16.41 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2022,'croissance_pib',11.5 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2023,'population',26207977 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2023,'pib',16.8 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2023,'croissance_pib',2.4 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2019,'superficie',1267000 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2020,'superficie',1267000 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2021,'superficie',1267000 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2022,'superficie',1267000 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2023,'superficie',1267000 FROM ref_pays WHERE code_iso3='NER'
UNION ALL
  SELECT id,2019,'population',30792493 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2019,'pib',68.18 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2019,'croissance_pib',6.5 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2020,'population',31593097 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2020,'pib',68.52 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2020,'croissance_pib',0.5 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2021,'population',32414518 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2021,'pib',72.01 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2021,'croissance_pib',5.1 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2022,'population',33257295 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2022,'pib',74.25 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2022,'croissance_pib',3.1 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2023,'population',34121985 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2023,'pib',76.4 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2023,'croissance_pib',2.9 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2019,'superficie',238533 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2020,'superficie',238533 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2021,'superficie',238533 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2022,'superficie',238533 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2023,'superficie',238533 FROM ref_pays WHERE code_iso3='GHA'
UNION ALL
  SELECT id,2019,'population',201966634 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2019,'pib',335.49 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2019,'croissance_pib',2.2 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2020,'population',207217767 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2020,'pib',329.45 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2020,'croissance_pib',-1.8 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2021,'population',212605428 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2021,'pib',341.31 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2021,'croissance_pib',3.6 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2022,'population',218133170 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2022,'pib',352.58 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2022,'croissance_pib',3.3 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2023,'population',223804632 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2023,'pib',362.8 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2023,'croissance_pib',2.9 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2019,'superficie',923768 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2020,'superficie',923768 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2021,'superficie',923768 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2022,'superficie',923768 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2023,'superficie',923768 FROM ref_pays WHERE code_iso3='NGA'
UNION ALL
  SELECT id,2019,'population',34147758 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2019,'pib',134.93 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2019,'croissance_pib',2.9 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2020,'population',35035599 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2020,'pib',125.22 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2020,'croissance_pib',-7.2 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2021,'population',35946525 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2021,'pib',135.23 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2021,'croissance_pib',8.0 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2022,'population',36881135 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2022,'pib',136.99 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2022,'croissance_pib',1.3 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2023,'population',37840044 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2023,'pib',141.1 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2023,'croissance_pib',3.0 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2019,'superficie',446550 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2020,'superficie',446550 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2021,'superficie',446550 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2022,'superficie',446550 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2023,'superficie',446550 FROM ref_pays WHERE code_iso3='MAR'
UNION ALL
  SELECT id,2019,'population',11242597 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2019,'pib',48.86 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2019,'croissance_pib',1.6 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2020,'population',11534905 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2020,'pib',44.66 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2020,'croissance_pib',-8.6 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2021,'population',11834812 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2021,'pib',46.71 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2021,'croissance_pib',4.6 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2022,'population',12142518 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2022,'pib',47.92 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2022,'croissance_pib',2.6 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2023,'population',12458223 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2023,'pib',48.5 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2023,'croissance_pib',1.2 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2019,'superficie',163610 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2020,'superficie',163610 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2021,'superficie',163610 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2022,'superficie',163610 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2023,'superficie',163610 FROM ref_pays WHERE code_iso3='TUN'
UNION ALL
  SELECT id,2019,'population',49724082 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2019,'pib',90.88 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2019,'croissance_pib',5.1 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2020,'population',51016908 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2020,'pib',90.61 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2020,'croissance_pib',-0.3 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2021,'population',52343348 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2021,'pib',97.5 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2021,'croissance_pib',7.6 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2022,'population',53704275 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2022,'pib',102.27 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2022,'croissance_pib',4.9 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2023,'population',55100586 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2023,'pib',108.0 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2023,'croissance_pib',5.6 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2019,'superficie',580367 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2020,'superficie',580367 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2021,'superficie',580367 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2022,'superficie',580367 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2023,'superficie',580367 FROM ref_pays WHERE code_iso3='KEN'
UNION ALL
  SELECT id,2019,'population',12719378 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2019,'pib',11.14 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2019,'croissance_pib',9.5 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2020,'population',13050082 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2020,'pib',10.77 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2020,'croissance_pib',-3.4 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2021,'population',13389384 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2021,'pib',11.94 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2021,'croissance_pib',10.9 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2022,'population',13737508 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2022,'pib',12.92 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2022,'croissance_pib',8.2 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2023,'population',14094683 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2023,'pib',13.9 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2023,'croissance_pib',7.6 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2019,'superficie',26338 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2020,'superficie',26338 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2021,'superficie',26338 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2022,'superficie',26338 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2023,'superficie',26338 FROM ref_pays WHERE code_iso3='RWA'
UNION ALL
  SELECT id,2019,'population',54519480 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2019,'pib',374.47 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2019,'croissance_pib',0.3 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2020,'population',55936987 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2020,'pib',352.0 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2020,'croissance_pib',-6.0 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2021,'population',57391348 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2021,'pib',368.54 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2021,'croissance_pib',4.7 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2022,'population',58883523 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2022,'pib',375.55 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2022,'croissance_pib',1.9 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2023,'population',60414495 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2023,'pib',377.8 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2023,'croissance_pib',0.6 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2019,'superficie',1221037 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2020,'superficie',1221037 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2021,'superficie',1221037 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2022,'superficie',1221037 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2023,'superficie',1221037 FROM ref_pays WHERE code_iso3='ZAF'
UNION ALL
  SELECT id,2019,'population',114181035 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2019,'pib',124.14 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2019,'croissance_pib',8.4 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2020,'population',117149741 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2020,'pib',131.72 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2020,'croissance_pib',6.1 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2021,'population',120195635 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2021,'pib',140.01 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2021,'croissance_pib',6.3 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2022,'population',123320721 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2022,'pib',148.97 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2022,'croissance_pib',6.4 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2023,'population',126527060 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2023,'pib',159.7 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2023,'croissance_pib',7.2 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2019,'superficie',1104300 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2020,'superficie',1104300 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2021,'superficie',1104300 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2022,'superficie',1104300 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2023,'superficie',1104300 FROM ref_pays WHERE code_iso3='ETH'
UNION ALL
  SELECT id,2019,'population',101718145 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2019,'pib',334.33 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2019,'croissance_pib',5.6 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2020,'population',104362816 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2020,'pib',346.36 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2020,'croissance_pib',3.6 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2021,'population',107076249 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2021,'pib',357.79 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2021,'croissance_pib',3.3 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2022,'population',109860232 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2022,'pib',381.41 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2022,'croissance_pib',6.6 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2023,'population',112716598 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2023,'pib',395.9 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2023,'croissance_pib',3.8 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2019,'superficie',1002450 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2020,'superficie',1002450 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2021,'superficie',1002450 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2022,'superficie',1002450 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2023,'superficie',1002450 FROM ref_pays WHERE code_iso3='EGY'
UNION ALL
  SELECT id,2019,'population',61518439 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2019,'pib',2960.83 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2019,'croissance_pib',1.8 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2020,'population',63117918 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2020,'pib',2738.77 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2020,'croissance_pib',-7.5 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2021,'population',64758984 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2021,'pib',2927.74 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2021,'croissance_pib',6.9 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2022,'population',66442717 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2022,'pib',3003.87 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2022,'croissance_pib',2.6 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2023,'population',68170228 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2023,'pib',3030.9 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2023,'croissance_pib',0.9 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2019,'superficie',551695 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2020,'superficie',551695 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2021,'superficie',551695 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2022,'superficie',551695 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2023,'superficie',551695 FROM ref_pays WHERE code_iso3='FRA'
UNION ALL
  SELECT id,2019,'population',1273058327 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2019,'pib',14823.81 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2019,'croissance_pib',6.0 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2020,'population',1306157843 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2020,'pib',15149.94 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2020,'croissance_pib',2.2 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2021,'population',1340117947 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2021,'pib',16422.53 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2021,'croissance_pib',8.4 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2022,'population',1374961014 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2022,'pib',16915.21 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2022,'croissance_pib',3.0 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2023,'population',1410710000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2023,'pib',17794.8 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2023,'croissance_pib',5.2 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2019,'superficie',9600000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2020,'superficie',9600000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2021,'superficie',9600000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2022,'superficie',9600000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2023,'superficie',9600000 FROM ref_pays WHERE code_iso3='CHN'
UNION ALL
  SELECT id,2019,'population',302235184 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2019,'pib',25316.74 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2019,'croissance_pib',2.3 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2020,'population',310093298 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2020,'pib',24759.77 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2020,'croissance_pib',-2.2 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2021,'population',318155724 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2021,'pib',26195.84 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2021,'croissance_pib',5.8 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2022,'population',326427773 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2022,'pib',26693.56 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2022,'croissance_pib',1.9 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2023,'population',334914895 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2023,'pib',27360.9 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2023,'croissance_pib',2.5 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2019,'superficie',9831510 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2020,'superficie',9831510 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2021,'superficie',9831510 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2022,'superficie',9831510 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2023,'superficie',9831510 FROM ref_pays WHERE code_iso3='USA'
UNION ALL
  SELECT id,2019,'population',1289227653 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2019,'pib',2978.22 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2019,'croissance_pib',3.9 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2020,'population',1322747572 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2020,'pib',2805.48 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2020,'croissance_pib',-5.8 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2021,'population',1357139009 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2021,'pib',3077.61 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2021,'croissance_pib',9.7 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2022,'population',1392424623 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2022,'pib',3293.04 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2022,'croissance_pib',7.0 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2023,'population',1428627663 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2023,'pib',3549.9 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2023,'croissance_pib',7.8 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2019,'superficie',3287263 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2020,'superficie',3287263 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2021,'superficie',3287263 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2022,'superficie',3287263 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2023,'superficie',3287263 FROM ref_pays WHERE code_iso3='IND'
UNION ALL
  SELECT id,2019,'population',4388477 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2019,'pib',9.27 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2019,'croissance_pib',3.1 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2020,'population',4502578 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2020,'pib',9.23 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2020,'croissance_pib',-0.4 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2021,'population',4619645 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2021,'pib',9.45 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2021,'croissance_pib',2.4 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2022,'population',4739755 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2022,'pib',10.06 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2022,'croissance_pib',6.4 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2023,'population',4862989 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2023,'pib',10.4 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2023,'croissance_pib',3.4 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2019,'superficie',1030700 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2020,'superficie',1030700 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2021,'superficie',1030700 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2022,'superficie',1030700 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2023,'superficie',1030700 FROM ref_pays WHERE code_iso3='MRT'
UNION ALL
  SELECT id,2019,'population',2502573 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2019,'pib',1.97 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2019,'croissance_pib',6.2 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2020,'population',2567640 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2020,'pib',1.98 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2020,'croissance_pib',0.6 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2021,'population',2634398 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2021,'pib',2.08 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2021,'croissance_pib',5.3 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2022,'population',2702893 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2022,'pib',2.18 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2022,'croissance_pib',4.9 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2023,'population',2773168 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2023,'pib',2.3 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2023,'croissance_pib',5.3 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2019,'superficie',11295 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2020,'superficie',11295 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2021,'superficie',11295 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2022,'superficie',11295 FROM ref_pays WHERE code_iso3='GMB'
UNION ALL
  SELECT id,2023,'superficie',11295 FROM ref_pays WHERE code_iso3='GMB'
ON CONFLICT (pays_id,annee,indicateur) DO UPDATE SET valeur=EXCLUDED.valeur;
