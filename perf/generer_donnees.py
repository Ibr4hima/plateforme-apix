"""Banc de mesure — le volume « à l'échelle ».

    python perf/generer_donnees.py --base apixbanc --port 5600 [--echelle 1]

Remplit une base JETABLE (montée par perf/monter_base.sh) au volume d'une
grande organisation qui se sert de la plateforme depuis des années : des
milliers d'agents, des dizaines de milliers de prospects et d'entreprises, des
centaines de milliers d'échanges et d'indicateurs, des millions de lignes de
commerce bilatéral. Les relevés réels importés par monter_base.sh (fDi, NACE)
restent tels quels.

Les valeurs sont inventées, mais elles respectent les contraintes du schéma
(statuts, clés étrangères, unicités) et des répartitions plausibles : les
requêtes suivent donc les mêmes chemins qu'en production. Le tirage est fixé
(graine) : deux bases générées avec la même échelle sont identiques.

Refuse de remplir une table qui contient déjà des lignes : une base de
production n'a jamais rien à craindre de ce script.
"""

import argparse
import datetime as dt
import io
import random
import sys
import time

import psycopg2

R = random.Random(20261107)

MOTS = ("investissement agro-industrie énergie solaire port logistique textile transformation export "
        "partenariat financement zone économique spéciale infrastructure numérique formation emploi "
        "mines phosphate pêche tourisme hôtellerie santé pharmacie agriculture irrigation riz anacarde "
        "arachide ciment acier assemblage automobile télécommunications banque assurance immobilier "
        "logement transport aéroport chemin de fer électricité gaz pétrole raffinerie eau assainissement "
        "éducation recherche innovation startup incubateur coopération accord bilatéral protection "
        "promotion facilitation guichet unique délai fiscalité exonération douane franchise").split()
PRENOMS = ("Aminata Moussa Fatou Ibrahima Awa Mamadou Mariama Cheikh Ndeye Ousmane Khady Abdoulaye "
           "Aïssatou Modou Seynabou Babacar Coumba Alioune Bineta Pape Marie Jean Sophie Thomas Anna "
           "Wei Li Mehmet Elif Ahmed Leila Carlos Ana David Sarah").split()
NOMS = ("Diop Ndiaye Fall Sow Ba Diallo Gueye Sarr Faye Mbaye Cissé Kane Sy Thiam Niang Dieng Seck "
        "Diouf Camara Touré Martin Dubois Bernard Müller Rossi Garcia Wang Zhang Yilmaz Haddad "
        "Silva Smith Johnson").split()
REGIONS = ["Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou", "Kolda", "Louga",
           "Matam", "Saint-Louis", "Sédhiou", "Tambacounda", "Thiès", "Ziguinchor"]


def phrase(nmin=6, nmax=14):
    return " ".join(R.choice(MOTS) for _ in range(R.randint(nmin, nmax))).capitalize() + "."


def texte(nmin=2, nmax=6):
    return " ".join(phrase() for _ in range(R.randint(nmin, nmax)))


def personne():
    return R.choice(PRENOMS), R.choice(NOMS)


def date_entre(a, b):
    return a + dt.timedelta(days=R.randint(0, (b - a).days))


def sous_ensemble(ids, kmin=1, kmax=3):
    return R.sample(ids, min(len(ids), R.randint(kmin, kmax)))


# ── COPY ─────────────────────────────────────────────────────────────────────

def _champ(v):
    if v is None:
        return r"\N"
    if isinstance(v, bool):
        return "t" if v else "f"
    if isinstance(v, (list, tuple)):
        elems = []
        for e in v:
            if e is None:
                elems.append("NULL")
            elif isinstance(e, (int, float)):
                elems.append(str(e))
            else:
                elems.append('"' + str(e).replace("\\", "\\\\").replace('"', '\\"') + '"')
        v = "{" + ",".join(elems) + "}"
    s = str(v)
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def copier(cur, table, colonnes, lignes, lot=100_000):
    """COPY par lots : lignes est un itérable de tuples."""
    n = 0
    buf = io.StringIO()
    for ligne in lignes:
        buf.write("\t".join(_champ(v) for v in ligne))
        buf.write("\n")
        n += 1
        if n % lot == 0:
            buf.seek(0)
            cur.copy_expert(f"COPY {table} ({', '.join(colonnes)}) FROM STDIN", buf)
            buf = io.StringIO()
    if buf.tell():
        buf.seek(0)
        cur.copy_expert(f"COPY {table} ({', '.join(colonnes)}) FROM STDIN", buf)
    return n


def recaler_sequence(cur, table):
    cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s AND column_name = 'id'", (table,))
    if not cur.fetchone():
        return
    cur.execute("SELECT pg_get_serial_sequence(%s, 'id')", (table,))
    seq = cur.fetchone()[0]
    if seq:
        cur.execute(f"SELECT setval(%s, GREATEST((SELECT COALESCE(MAX(id), 0) FROM {table}), 1))", (seq,))


def vide(cur, table):
    cur.execute(f"SELECT EXISTS (SELECT 1 FROM {table})")
    return not cur.fetchone()[0]


# ── Génération ───────────────────────────────────────────────────────────────

def generer(cur, e):
    N = lambda n: max(1, int(n * e))  # noqa: E731
    debut = time.time()
    bilan = {}

    def etape(table, colonnes, lignes):
        if not vide(cur, table):
            print(f"  {table} : déjà rempli, laissé tel quel")
            return
        t = time.time()
        n = copier(cur, table, colonnes, lignes)
        recaler_sequence(cur, table)
        bilan[table] = n
        print(f"  {table:32s} {n:>10,} lignes  ({time.time() - t:5.1f} s)".replace(",", " "))

    cur.execute("SELECT id FROM ref_pays ORDER BY id")
    pays = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT id, nom_fr FROM ref_pays ORDER BY id")
    noms_pays = dict(cur.fetchall())
    cur.execute("SELECT id FROM ref_pays WHERE code_iso3 = 'SEN'")
    senegal = cur.fetchone()[0]
    aujourd_hui = dt.date(2026, 11, 7)

    # Nomenclatures et géographie : à la taille du réel
    etape("ref_secteurs", ["id", "code", "nom", "description", "actif"],
          [(i, f"S{i:02d}", f"Secteur {i} — {R.choice(MOTS)}", phrase(), True) for i in range(1, 21)])
    branches = [(i, R.randint(1, 20)) for i in range(1, 121)]
    etape("ref_branches", ["id", "secteur_id", "code", "nom", "actif"],
          [(i, s, f"B{i:03d}", f"Branche {i} — {R.choice(MOTS)} {R.choice(MOTS)}", True) for i, s in branches])
    activites = [(i, R.randint(1, 120)) for i in range(1, 701)]
    etape("ref_activites", ["id", "branche_id", "code", "nom", "actif"],
          [(i, b, f"A{i:04d}", f"Activité {i} : {phrase(3, 7)}", True) for i, b in activites])
    secteurs = list(range(1, 21)); branche_ids = list(range(1, 121)); activite_ids = list(range(1, 701))
    etape("ref_regions", ["id", "nom", "actif", "superficie"],
          [(i + 1, n, True, R.randint(500, 60000)) for i, n in enumerate(REGIONS)])
    deps = [(i, R.randint(1, 14)) for i in range(1, 47)]
    etape("ref_departements", ["id", "region_id", "nom", "actif"], [(i, r, f"Département {i}", True) for i, r in deps])
    arrs = [(i, R.randint(1, 46)) for i in range(1, 134)]
    etape("ref_arrondissements", ["id", "departement_id", "nom", "actif"], [(i, d, f"Arrondissement {i}", True) for i, d in arrs])
    geo_dep = dict(deps); geo_arr = dict(arrs)

    def lieu():
        a = R.randint(1, 133); d = geo_arr[a]
        return geo_dep[d], d, a

    devises = [("XOF", "Franc CFA", "FCFA"), ("EUR", "Euro", "€"), ("USD", "Dollar américain", "$"), ("GBP", "Livre sterling", "£"),
               ("CNY", "Yuan", "¥"), ("JPY", "Yen", "¥"), ("MAD", "Dirham marocain", "DH"), ("NGN", "Naira", "₦")]
    etape("ref_devises", ["id", "code_iso", "nom", "symbole", "actif", "code"],
          [(i + 1, c, n, s, True, c) for i, (c, n, s) in enumerate(devises)])
    etape("poles_territoires", ["id", "pole_territoire", "region_ids", "localisation", "description"],
          [(i, f"Pôle {i} — {REGIONS[i % 14]}", sous_ensemble(list(range(1, 15)), 1, 3), REGIONS[i % 14], texte(1, 3))
           for i in range(1, 9)])
    poles = list(range(1, 9))

    # Les agents
    roles = ["agent"] * 90 + ["admin"] * 5 + ["admin_plus"] * 3 + ["dev"] * 2
    modules = ["tableau-de-bord", "statistiques", "ide", "prospects", "opportunites"]
    etape("users", ["id", "email", "hashed_password", "is_active", "role", "modules", "prenom", "nom"],
          [(i, f"agent{i}@apix.sn", "$2b$12$banc.banc.banc.banc.banc.banc.banc.banc.banc.banc.ban", R.random() > .03,
            R.choice(roles), sous_ensemble(modules, 2, 5), *personne()) for i in range(1, N(5000) + 1)])
    agents = list(range(1, N(5000) + 1))

    # Projets (avant les prospects, qui peuvent s'y rattacher)
    def projets():
        for i in range(1, N(6000) + 1):
            r, d, a = lieu()
            lo = R.choice([None, R.randint(1, 500) * 1e6])
            intervalle = lo is not None and R.random() < .4
            yield (i, f"Projet {i} : {phrase(3, 6)}", r, d, a, R.choice(["Dakar", "Diamniadio", "Sandiara", None]), R.choice(poles),
                   sous_ensemble(secteurs, 1, 2), sous_ensemble(branche_ids, 1, 2), sous_ensemble(activite_ids, 1, 3),
                   R.random() < .02, texte(), None if intervalle else lo, R.randint(1, 8),
                   lo if intervalle else None, lo * R.uniform(1.2, 3) if intervalle else None, intervalle, R.random() < .8,
                   date_entre(dt.date(2015, 1, 1), aujourd_hui))
    etape("projets", ["id", "titre_projet", "region_id", "departement_id", "arrondissement_id", "zone_investissement", "pole_id",
                      "secteur_ids", "branche_ids", "activite_ids", "is_deleted", "description", "investissement", "devise_id",
                      "investissement_min", "investissement_max", "investissement_est_intervalle", "est_publie", "date_debut"], projets())
    nb_projets = N(6000)
    etape("porteurs_projets", ["id", "nom", "ordre", "projet_id", "telephones", "mails"],
          [(i, " ".join(personne()), 1, i, [f"+221 77 {R.randint(100, 999)} {R.randint(10, 99)} {R.randint(10, 99)}"],
            [f"porteur{i}@exemple.sn"]) for i in range(1, nb_projets + 1)])
    etape("projets_points_focaux", ["id", "projet_id", "civilite", "nom", "prenom", "telephones", "mails", "ordre"],
          [(i, R.randint(1, nb_projets), R.choice(["M.", "Mme"]), *reversed(personne()), [f"+221 70 {R.randint(100, 999)} 00 00"],
            [f"pf{i}@exemple.sn"], 1) for i in range(1, N(8000) + 1)])

    # Prospects, leurs points focaux, échanges et coordonnées
    nb_prospects = N(20000)

    def prospects():
        for i in range(1, nb_prospects + 1):
            issue = R.choices([None, "installe", "decline"], [75, 15, 10])[0]
            yield (i, R.choice(["morale", "morale", "morale", "physique", None]), f"Prospect {i} {R.choice(NOMS)} {R.choice(['SA', 'SAS', 'Ltd', 'GmbH', 'Group'])}",
                   R.choice(pays), f"{R.randint(1, 200)} rue {R.choice(NOMS)}", [f"+33 1 {R.randint(10, 99)} {R.randint(10, 99)} {R.randint(10, 99)} {R.randint(10, 99)}"],
                   [f"contact{i}@prospect{i}.com"], f"https://prospect{i}.com", sous_ensemble(secteurs, 1, 2), sous_ensemble(branche_ids, 1, 3),
                   sous_ensemble(activite_ids, 1, 4), R.choice(["Salon", "Ambassade", "Recommandation", "Site web", "Mission"]), texte(1, 4),
                   True, R.random() < .02, R.random() < .3, R.randint(1, nb_projets) if R.random() < .1 else None, R.random() < .4, phrase(),
                   R.random() < .5, phrase(), texte(1, 2), f"https://linkedin.com/company/prospect{i}", R.choice(agents),
                   issue, phrase() if issue else None, dt.datetime(2025, 1, 1) + dt.timedelta(days=R.randint(0, 600)) if issue else None)
    etape("prospects", ["id", "type", "nom", "siege_id", "adresse", "telephones", "mails", "siteweb", "secteur_ids", "branche_ids",
                        "activite_ids", "point_entree", "details", "est_publie", "is_deleted", "objet_projet", "objet_projet_id",
                        "objet_intentions_etranger", "objet_intentions_details", "objet_adequation_senegal", "objet_adequation_details",
                        "objet_commentaires", "linkedin", "agent_id", "issue", "issue_commentaire", "issue_conclu_le"], prospects())
    nb_pf = N(30000)
    etape("prospect_points_focaux", ["id", "prospect_id", "prenom", "nom", "telephones", "mails", "est_principal"],
          [(i, R.randint(1, nb_prospects), *personne(), [f"+33 6 {R.randint(10, 99)} {R.randint(10, 99)} {R.randint(10, 99)} {R.randint(10, 99)}"],
            [f"pf{i}@prospect.com"], R.random() < .5) for i in range(1, nb_pf + 1)])
    # Deux prospects sur trois ont été contactés, avec un nombre d'échanges très inégal
    contactes = R.sample(range(1, nb_prospects + 1), int(nb_prospects * .66))

    def echanges():
        i = 0
        while i < N(120000):
            p = R.choice(contactes)
            for _ in range(R.choice([1, 1, 2, 3, 5, 8])):
                i += 1
                d = date_entre(dt.date(2019, 1, 1), aujourd_hui)
                yield (i, p, d, texte(1, 3), " ".join(personne()), dt.datetime.combine(d, dt.time(R.randint(8, 18))), " ".join(personne()),
                       R.randint(1, nb_pf) if R.random() < .5 else None, R.choice(["telephone", "mail", "rencontre", "visio"]),
                       R.choice([None, "+33 1 00 00 00 00", "contact@exemple.com"]))
    etape("prospect_echanges", ["id", "prospect_id", "date_echange", "commentaire", "contact_par", "enregistre_le", "interlocuteur",
                                "point_focal_id", "canal", "canal_contact"], echanges())
    etape("prospect_contacts", ["id", "prospect_id", "type", "valeur_normalisee", "valeur_affichee", "origine"],
          [(i, R.randint(1, nb_prospects), t, v, v, R.choice(["fiche", "echange", "point_focal"]))
           for i in range(1, N(40000) + 1)
           for t, v in [R.choice([("telephone", f"+33{100000000 + i}"), ("mail", f"c{i}@exemple.com")])]])

    # Entreprises installées, zones
    nb_ent = N(12000)

    def entreprises():
        for i in range(1, nb_ent + 1):
            r, d, a = lieu()
            yield (i, f"Entreprise {i} {R.choice(NOMS)} {R.choice(['SA', 'SARL', 'SAS', 'SUARL'])}", R.choice(["SA", "SARL", "SAS", "SUARL", "GIE"]),
                   date_entre(dt.date(1980, 1, 1), aujourd_hui), noms_pays[R.choice(pays)], f"Zone {R.randint(1, 50)}, {REGIONS[r - 1]}",
                   f"+221 33 {R.randint(100, 999)} {R.randint(10, 99)} {R.randint(10, 99)}", f"info@entreprise{i}.sn", f"https://entreprise{i}.sn",
                   R.random() < .85, "banc", R.random() < .02, r, d, a, R.choice(pays), sous_ensemble(secteurs, 1, 2), sous_ensemble(branche_ids, 1, 2),
                   sous_ensemble(activite_ids, 1, 3), R.choice(poles + [None]))
    etape("entreprises_installees", ["id", "nom", "forme_juridique", "date_creation", "pays", "adresse", "telephone", "mail", "siteweb",
                                     "est_publie", "created_by", "is_deleted", "region_id", "departement_id", "arrondissement_id", "siege_pays_id",
                                     "secteur_ids", "branche_ids", "activite_ids", "pole_id"], entreprises())
    etape("entreprises_points_focaux", ["id", "entreprise_id", "nom", "prenom", "poste", "telephone", "mail", "est_principal", "civilite"],
          [(i, R.randint(1, nb_ent), *reversed(personne()), R.choice(["DG", "DAF", "Responsable RH", "Directeur technique"]),
            "+221 77 000 00 00", f"pf{i}@entreprise.sn", R.random() < .5, R.choice(["M.", "Mme"])) for i in range(1, N(15000) + 1)])
    zones = []
    for i in range(1, N(300) + 1):
        r, d, a = lieu()
        zones.append((f"Z{i:04d}", R.choice(["ZES", "ZAI", "ZFI"]), f"Zone {i} — {REGIONS[r - 1]}", R.choice(poles), r, d, a, texte(1, 3),
                      date_entre(dt.date(2000, 1, 1), aujourd_hui), f"Décret n° {R.randint(2000, 2026)}-{R.randint(1, 999)}",
                      R.randint(5, 2000), sous_ensemble(secteurs), sous_ensemble(branche_ids), sous_ensemble(activite_ids),
                      sous_ensemble(list(range(1, nb_ent + 1)), 0, 8), True, False))
    etape("zones", ["id", "type_zone", "nom_zone", "pole_id", "region_id", "departement_id", "arrondissement_id", "description", "date_creation",
                    "decret_creation", "superficie", "secteur_ids", "branche_ids", "activite_ids", "entreprise_ids", "est_publie", "is_deleted"], zones)
    paires = set()
    while len(paires) < N(15000):
        paires.add((R.choice(zones)[0], R.randint(1, nb_ent)))
    etape("zone_entreprises", ["id", "zone_id", "entreprise_id", "statut"],
          [(i + 1, z, en, R.choice(["eligible", "installee"])) for i, (z, en) in enumerate(sorted(paires))])

    # Accords, événements, opportunités
    def accords():
        for i in range(1, N(2500) + 1):
            s = date_entre(dt.date(1970, 1, 1), aujourd_hui)
            yield (i, f"Accord {i} entre le Sénégal et {noms_pays[R.choice(pays)]}", "Sénégal, " + noms_pays[R.choice(pays)], s,
                   s + dt.timedelta(days=R.randint(30, 900)), s + dt.timedelta(days=R.randint(3650, 9000)) if R.random() < .6 else None,
                   texte(1, 2), R.choice(["en_vigueur", "signe_non_ratifie", "expire", "suspendu", "negocie"]), R.random() < .9, "banc",
                   R.random() < .01, f"ACC-{i:05d}", sous_ensemble(secteurs), sous_ensemble(branche_ids), sous_ensemble(activite_ids),
                   [senegal, R.choice(pays)], R.choice(["tbi", "inter"]))
    etape("accords_traites", ["id", "titre", "parties_signataires", "date_signature", "date_entree_vigueur", "date_expiration", "commentaires",
                              "statut", "est_publie", "created_by", "is_deleted", "reference", "secteur_ids", "branche_ids", "activite_ids",
                              "parties_pays_ids", "type_accord"], accords())

    def evenements():
        for i in range(1, N(3000) + 1):
            d = date_entre(dt.date(2010, 1, 1), dt.date(2028, 12, 31))
            rec = R.random() < .3
            yield (i, f"{R.choice(['Forum', 'Salon', 'Sommet', 'Mission', 'Conférence'])} {R.choice(MOTS)} {i}", R.randint(1, 20),
                   f"Organisateur {R.randint(1, 200)}", R.choice(["Organisateur", "Co-organisateur", "Participant", "Partenaire", "Sponsor", "Invité"]),
                   texte(2, 5), d, d + dt.timedelta(days=R.randint(0, 4)), R.choice(["Dakar", "Paris", "Dubaï", "Abidjan", "Casablanca", "Londres"]),
                   ", ".join(f"Entreprise {R.randint(1, nb_ent)}" for _ in range(R.randint(0, 6))), R.random() < .9, R.random() < .01,
                   R.choice(pays), rec, "annuel" if rec else None, 1 if rec else None, sous_ensemble(secteurs), sous_ensemble(branche_ids),
                   sous_ensemble(activite_ids), sous_ensemble(pays, 0, 6), R.randint(1, 28) if rec else None, R.randint(1, 12) if rec else None,
                   R.randint(2026, 2028) if rec else None, R.randint(1, 5))
    etape("evenements", ["id", "nom_event", "edition", "organisateur", "role_apix", "description", "date_debut", "date_fin", "ville",
                         "entreprises_invitees", "est_publie", "is_deleted", "pays_hote_id", "est_recurrent", "frequence_type",
                         "frequence_valeur", "secteur_ids", "branche_ids", "activite_ids", "pays_invites_ids", "prochain_jour",
                         "prochain_mois", "prochain_annee", "duree_jours"], evenements())

    def potentialites():
        for i in range(1, N(5000) + 1):
            r, d, a = lieu()
            yield (i, f"Potentialité {i} : {phrase(3, 6)}", R.choice(poles), r, d, a, sous_ensemble(secteurs), sous_ensemble(branche_ids),
                   sous_ensemble(activite_ids), True, R.random() < .02, texte())
    etape("potentialites", ["id", "titre", "pole_id", "region_id", "departement_id", "arrondissement_id", "secteur_ids", "branche_ids",
                            "activite_ids", "est_publie", "is_deleted", "description"], potentialites())
    etape("avantages_incitations", ["id", "secteur_id", "branche_id", "activite_id", "avantages", "est_publie", "is_deleted"],
          [(i, R.choice(secteurs), R.choice(branche_ids), R.choice(activite_ids), texte(2, 5), True, False) for i in range(1, N(2000) + 1)])

    # IDE CNUCED : toutes les séries, pour tous les pays
    def cnuced():
        i = 0
        for p in pays:
            base = R.uniform(1, 50_000)  # millions de dollars, comme la CNUCED
            for annee in range(1970, 2026):
                for direction in ("entrant", "sortant"):
                    for indic in ("flux", "stock"):
                        i += 1
                        v = base * (1 + (annee - 1970) * .06) * R.uniform(.5, 1.5) * (1 if direction == "entrant" else .4)
                        if indic == "stock":
                            v *= 12
                        yield (i, noms_pays[p], annee, direction, indic, round(v, 2), "CNUCED", p)
    etape("ide_cnuced", ["id", "pays", "annee", "direction", "indicateur", "valeur", "source", "ref_pays_id"], cnuced())

    # Statistiques économiques et commerce bilatéral
    indicateurs = ["pib", "population", "pib_hab", "croissance_pib", "inflation", "importations_marchandises", "exportations_marchandises",
                   "balance_marchandises", "importations_services", "exportations_services", "balance_services"] + \
                  [f"indicateur_{k}" for k in range(1, 20)]
    etape("stat_indicateurs", ["code", "libelle", "unite", "categorie", "ordre", "derive"],
          [(c, c.replace("_", " ").capitalize(), R.choice(["USD", "%", "habitants", "Md USD"]), R.choice(["Économie", "Démographie", "Commerce extérieur"]),
            k, c.startswith("balance")) for k, c in enumerate(indicateurs)])
    etape("stat_pays", ["pays_id", "annee", "indicateur", "valeur"],
          ((p, a, c, R.uniform(1, 1e12)) for p in pays for a in range(1990, 2025) for c in indicateurs))
    ressources = [f"Ressource {k}" for k in range(1, 61)]
    etape("stat_ressources", ["nom_en", "libelle"], [(r, r) for r in ressources])

    def transactions():
        i = 0
        cible = N(2_000_000)
        while i < cible:
            a = R.randint(2000, 2024); ex = R.choice(pays)
            for _ in range(50):
                i += 1
                yield (i, a, ex, R.choice(pays), R.choice(ressources), R.uniform(1e3, 1e9))
    etape("stat_transactions", ["id", "annee", "exportateur_id", "importateur_id", "ressource", "valeur"], transactions())

    # BDEF (comptes économiques du Sénégal)
    etape("bdef_indicateur_categories", ["id", "code", "libelle", "ordre"], [(k, f"CAT{k}", f"Catégorie {k}", k) for k in range(1, 7)])
    etape("bdef_indicateurs", ["id", "code", "libelle", "unite", "categorie_id", "ordre"],
          [(k, f"IND{k:03d}", f"Indicateur {k}", R.choice(["Md FCFA", "%", "indice"]), R.randint(1, 6), k) for k in range(1, 81)])
    etape("bdef_macro_secteurs", ["id", "code", "libelle", "ordre"], [(k, f"MS{k}", f"Macro-secteur {k}", k) for k in range(1, 6)])
    etape("bdef_groupes", ["id", "code", "libelle", "macro_secteur_id", "ordre"], [(k, f"G{k:02d}", f"Groupe {k}", R.randint(1, 5), k) for k in range(1, 21)])
    etape("bdef_secteurs", ["id", "code", "libelle", "groupe_id", "ordre"], [(k, f"BS{k:02d}", f"Secteur BDEF {k}", R.randint(1, 20), k) for k in range(1, 61)])

    def bdef():
        i = 0
        for ind in range(1, 81):
            for annee in range(2000, 2026):
                niveaux = [("global", None, None, None)] + [("macro_secteur", m, None, None) for m in range(1, 6)] + \
                          [("groupe", None, g, None) for g in range(1, 21)] + [("secteur", None, None, s) for s in range(1, 61)]
                for niv, m, g, s in niveaux:
                    i += 1
                    v = R.uniform(1, 1e4)
                    yield (i, ind, niv, m, g, s, annee, v, v)
    etape("bdef_valeurs", ["id", "indicateur_id", "niveau", "macro_secteur_id", "groupe_id", "secteur_id", "annee", "valeur", "valeur_initiale"], bdef())

    # BMCE (bulletins mensuels du commerce extérieur)
    mois = [dt.date(2021 + k // 12, k % 12 + 1, 1) for k in range(60)]
    etape("bmce_bulletins", ["id", "periode", "fichier_nom", "mois_couverts", "nb_valeurs", "nb_revisions"],
          [(k + 1, m, f"bmce_{m:%Y_%m}.pdf", [m.isoformat()], 400, 0) for k, m in enumerate(mois)])
    rubriques = [(k + 1, c, s, f"{c} {k}", k, R.choice(pays) if c == "pays" else None)
                 for k, (c, s) in enumerate((c, s) for c in ["ensemble", "groupe_utilisation", "produit_regroupe", "chapitre", "pays"]
                                            for s in ["export", "import"] for _ in range(40))]
    etape("bmce_rubriques", ["id", "categorie", "sens", "libelle", "ordre", "pays_id"], rubriques)
    etape("bmce_flux", ["id", "rubrique_id", "periode", "valeur_fcfa", "poids_kg", "bulletin_id"],
          [(k * 60 + j + 1, r[0], m, R.uniform(1e6, 1e11), R.uniform(1e3, 1e8), j + 1) for k, r in enumerate(rubriques) for j, m in enumerate(mois)])

    print(f"\n  {sum(bilan.values()):,} lignes générées en {time.time() - debut:.0f} s".replace(",", " "))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="apixbanc")
    ap.add_argument("--hote", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=5600)
    ap.add_argument("--echelle", type=float, default=1.0,
                    help="1 = grande organisation (5 000 agents, 20 000 prospects…) ; 0.1 pour un essai rapide")
    a = ap.parse_args()
    if a.base in ("apix", "apix_prod", "postgres"):
        sys.exit("Refus : ce script ne remplit qu'une base de banc jetable.")
    cx = psycopg2.connect(host=a.hote, port=a.port, dbname=a.base, user="apix", password="apix")
    cx.autocommit = False
    with cx.cursor() as cur:
        generer(cur, a.echelle)
        cur.execute("ANALYZE")
    cx.commit()
    cx.close()


if __name__ == "__main__":
    main()
