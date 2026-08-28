"use client";

// Consultation de la classification sectorielle fDi Markets.
//
// Écran de LECTURE, sans exception : la nomenclature vient des CSV versionnés
// (backend/scripts/fdi/), que le déploiement rejoue à chaque mise en ligne.
// Un bouton d'édition ici produirait une correction écrasée au déploiement
// suivant, sans trace — le bandeau du haut dit donc où l'on corrige vraiment.
//
// Ce que l'écran doit permettre, et qui a dicté sa forme :
//   1. vérifier une traduction — d'où les deux langues côte à côte, jamais
//      l'une à la place de l'autre ;
//   2. retrouver un poste par n'importe quel bout : libellé français, anglais
//      ou code — d'où une recherche qui balaie les trois ;
//   3. comprendre pourquoi « Other » revient partout — d'où la pastille
//      « partagé » et son explication.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { Avis, Carte, ChampRecherche, Compteur, Segments } from "@/components/admin/UIAdmin";

type SousSecteur = {
  id: number; code: string; libelle_en: string; libelle_fr: string;
  libelle_en_base: string; partage: boolean; ordre: number;
};
type Secteur = {
  id: number; code: string; libelle_en: string; libelle_fr: string; ordre: number;
  sous_secteurs: SousSecteur[];
};
type Activite = { id: number; code: string; libelle_en: string; libelle_fr: string; ordre: number };
type Classification = {
  secteurs: Secteur[];
  activites: Activite[];
  totaux: { secteurs: number; sous_secteurs: number; activites: number; libelles_partages: number };
};

/** Insensible à la casse ET aux accents : on cherche « energies » et on trouve
    « Énergies renouvelables ». */
const norm = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CODE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10.5, color: "var(--gris)", whiteSpace: "nowrap",
};

function Pastille({ children, couleur = "var(--bleu)", titre }: {
  children: React.ReactNode; couleur?: string; titre?: string;
}) {
  return (
    <span title={titre} style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: couleur, background: `rgb(var(--bleu-rgb) / 0.09)`, padding: "2px 7px",
      borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</span>
  );
}

export default function AdminFdiClassification() {
  const [data, setData]       = useState<Classification | null>(null);
  const [erreur, setErreur]   = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue]         = useState<"secteurs" | "activites">("secteurs");
  const [recherche, setRecherche]   = useState("");
  const [ouverts, setOuverts] = useState<Set<number>>(new Set());

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/classification`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) {
      setErreur(
        "Classification indisponible. Vérifier que la migration 130 est appliquée "
        + "et que scripts/fdi/importer.py a été exécuté."
      );
    } finally { setChargement(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Un secteur est retenu si LUI correspond (tous ses sous-secteurs restent
  // alors visibles) ou si l'un de ses sous-secteurs correspond (seuls
  // ceux-là s'affichent) : on ne perd jamais le contexte du parent.
  const secteursFiltres = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.secteurs;
    return data.secteurs.flatMap(s => {
      const secteurMatch = [s.libelle_fr, s.libelle_en, s.code].some(v => norm(v).includes(q));
      if (secteurMatch) return [s];
      const sous = s.sous_secteurs.filter(ss =>
        [ss.libelle_fr, ss.libelle_en, ss.code].some(v => norm(v).includes(q)));
      return sous.length ? [{ ...s, sous_secteurs: sous }] : [];
    });
  }, [data, recherche]);

  const activitesFiltrees = useMemo(() => {
    if (!data) return [];
    const q = norm(recherche.trim());
    if (!q) return data.activites;
    return data.activites.filter(a =>
      [a.libelle_fr, a.libelle_en, a.code].some(v => norm(v).includes(q)));
  }, [data, recherche]);

  const nbSousTrouves = secteursFiltres.reduce((n, s) => n + s.sous_secteurs.length, 0);

  // Une recherche déplie ce qu'elle trouve : sans cela, l'utilisateur verrait
  // des secteurs correspondants sans voir ce qui a correspondu.
  useEffect(() => {
    if (recherche.trim()) setOuverts(new Set(secteursFiltres.map(s => s.id)));
  }, [recherche, secteursFiltres]);

  const basculer = (id: number) => setOuverts(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toutOuvrir  = () => setOuverts(new Set(secteursFiltres.map(s => s.id)));
  const toutFermer  = () => setOuverts(new Set());

  const t = data?.totaux;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1180, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--encre)", marginBottom: 4 }}>
        Classification fDi Markets
      </h1>
      <p style={{ fontSize: 13, color: "var(--gris)", lineHeight: 1.6, marginBottom: 18 }}>
        La nomenclature sectorielle du Financial Times, en anglais et en français.
        Elle servira à rattacher chaque projet d&apos;investissement annoncé.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Compteur n={t?.secteurs ?? 0} mot="secteur" />
        <Compteur n={t?.sous_secteurs ?? 0} mot="sous-secteur" couleur="var(--violet)" />
        <Compteur n={t?.activites ?? 0} mot="activité" couleur="var(--orange)" />
      </div>

      <div style={{ marginBottom: 18 }}>
        <Avis ton="info">
          <strong>Consultation seule.</strong> La nomenclature est tenue dans les CSV versionnés
          du dépôt (<span style={CODE}>backend/scripts/fdi/</span>) et réimportée à chaque
          déploiement. Une correction saisie ici serait écrasée sans trace : elle se fait
          dans les fichiers, où elle se relit dans un diff.
        </Avis>
      </div>

      {erreur && <div style={{ marginBottom: 18 }}><Avis ton="erreur">{erreur}</Avis></div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Segments
          options={[
            { v: "secteurs" as const,  l: "Secteurs & sous-secteurs", n: t?.secteurs },
            { v: "activites" as const, l: "Activités économiques",    n: t?.activites },
          ]}
          value={vue} onChange={setVue}
        />
        <ChampRecherche
          value={recherche} onChange={setRecherche}
          placeholder="Rechercher en français, en anglais ou par code…"
          style={{ flex: 1, minWidth: 260 }}
        />
      </div>

      {chargement ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "70px 0", color: "var(--gris)" }}>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : vue === "secteurs" ? (
        <Carte
          titre="Arbre sectoriel"
          aide={
            <>
              Deux niveaux : secteur, puis sous-secteur. Un libellé marqué{" "}
              <Pastille>partagé</Pastille> sert à plusieurs secteurs — «&nbsp;Other&nbsp;» en sert
              24 sur 37. Un tel libellé n&apos;identifie donc rien à lui seul : le rattachement
              d&apos;un projet exigera toujours son secteur.
            </>
          }
          extra={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {recherche.trim() && (
                <span style={{ fontSize: 11.5, color: "var(--gris)" }}>
                  {secteursFiltres.length} secteur{secteursFiltres.length > 1 ? "s" : ""} ·{" "}
                  {nbSousTrouves} sous-secteur{nbSousTrouves > 1 ? "s" : ""}
                </span>
              )}
              <button onClick={ouverts.size ? toutFermer : toutOuvrir}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5,
                  fontWeight: 700, color: "var(--bleu)", fontFamily: "var(--font-google-sans)", padding: 0 }}>
                {ouverts.size ? "Tout replier" : "Tout déplier"}
              </button>
            </div>
          }
        >
          {secteursFiltres.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
              Aucun secteur ni sous-secteur ne correspond à « {recherche} ».
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {secteursFiltres.map(s => {
                const ouvert = ouverts.has(s.id);
                return (
                  <div key={s.id} style={{ border: "1px solid var(--bordure)", borderRadius: 12, overflow: "hidden" }}>
                    <button onClick={() => basculer(s.id)} aria-expanded={ouvert}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                        background: ouvert ? "var(--bleu-voile)" : "var(--carte)", border: "none", cursor: "pointer",
                        textAlign: "left", fontFamily: "var(--font-google-sans)", transition: "background 0.12s" }}
                      onMouseEnter={e => { if (!ouvert) e.currentTarget.style.background = "var(--carte-douce)"; }}
                      onMouseLeave={e => { if (!ouvert) e.currentTarget.style.background = "var(--carte)"; }}>
                      {ouvert ? <ChevronDown size={14} style={{ color: "var(--bleu)", flexShrink: 0 }} />
                              : <ChevronRight size={14} style={{ color: "var(--gris)", flexShrink: 0 }} />}
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--encre)" }}>{s.libelle_fr}</span>
                        <span style={{ fontSize: 11.5, color: "var(--gris-fort)" }}>{s.libelle_en}</span>
                      </span>
                      <span style={CODE}>{s.code}</span>
                      <Compteur n={s.sous_secteurs.length} mot="sous-secteur" couleur="var(--violet)" />
                    </button>

                    {ouvert && (
                      <div style={{ borderTop: "1px solid var(--bordure)" }}>
                        {s.sous_secteurs.map((ss, i) => (
                          <div key={ss.id} style={{ display: "flex", alignItems: "center", gap: 10,
                            padding: "9px 14px 9px 38px",
                            borderTop: i ? "1px solid var(--filet)" : "none",
                            background: i % 2 ? "var(--carte-douce)" : "var(--carte)" }}>
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 12.5, color: "var(--encre)", fontWeight: 600 }}>{ss.libelle_fr}</span>
                              <span style={{ fontSize: 11, color: "var(--gris-fort)" }}>{ss.libelle_en}</span>
                            </span>
                            {ss.partage && (
                              <Pastille titre={`« ${ss.libelle_en_base} » sert à plusieurs secteurs : le rattachement exige le secteur.`}>
                                partagé
                              </Pastille>
                            )}
                            <span style={CODE}>{ss.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Carte>
      ) : (
        <Carte
          titre="Activités économiques"
          aide={
            <>
              Elles ne prolongent pas l&apos;arbre sectoriel : elles disent ce que
              l&apos;entreprise vient <em>faire</em>{" "}dans le pays — usine, siège, centre de
              R&amp;D, logistique — et non ce qu&apos;elle produit. Un projet portera donc un
              sous-secteur <strong>et</strong>{" "}une activité. C&apos;est cette colonne qui
              distingue une implantation industrielle d&apos;un bureau de vente, donc la valeur
              ajoutée réellement captée.
            </>
          }
        >
          {activitesFiltrees.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
              Aucune activité ne correspond à « {recherche} ».
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
              {activitesFiltrees.map(a => (
                <div key={a.id} style={{ border: "1px solid var(--bordure)", borderRadius: 12, padding: "11px 14px",
                  display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--encre)" }}>{a.libelle_fr}</span>
                  <span style={{ fontSize: 11.5, color: "var(--gris-fort)" }}>{a.libelle_en}</span>
                  <span style={{ ...CODE, marginTop: 2 }}>{a.code}</span>
                </div>
              ))}
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}
