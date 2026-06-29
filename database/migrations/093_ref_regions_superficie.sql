-- Migration 093 : superficie (km²) des régions, pour la densité d'entreprises
ALTER TABLE ref_regions ADD COLUMN IF NOT EXISTS superficie INTEGER;

UPDATE ref_regions SET superficie = CASE nom
    WHEN 'Dakar'        THEN 547
    WHEN 'Ziguinchor'   THEN 7352
    WHEN 'Diourbel'     THEN 4824
    WHEN 'Saint-Louis'  THEN 19241
    WHEN 'Tambacounda'  THEN 42364
    WHEN 'Kaolack'      THEN 5357
    WHEN 'Thiès'        THEN 6670
    WHEN 'Louga'        THEN 24889
    WHEN 'Fatick'       THEN 6849
    WHEN 'Kolda'        THEN 13771
    WHEN 'Matam'        THEN 29445
    WHEN 'Kaffrine'     THEN 11262
    WHEN 'Kédougou'     THEN 16800
    WHEN 'Sédhiou'      THEN 7341
    ELSE superficie
END
WHERE nom IN ('Dakar','Ziguinchor','Diourbel','Saint-Louis','Tambacounda','Kaolack',
              'Thiès','Louga','Fatick','Kolda','Matam','Kaffrine','Kédougou','Sédhiou');
