"use client";

// fDi Markets — les trois bases du fournisseur, sous leur nom d'origine.
//
//   PROJECT DATABASE   les projets annoncés. Seule base chargée à ce jour.
//   INVESTOR SIGNALS   les intentions déclarées, en amont du projet.
//   COMPANY DATABASE   les entreprises investisseuses.
//
// Les deux dernières sont annoncées avant d'être remplies, et le disent : un
// onglet qui n'existe pas laisse croire que la source s'arrête là.
//
// Sous « Project database », trois vues, deux natures de travail :
//
//   PROJETS       ce qui est entré. Les montants et effectifs estimés par
//                 l'algorithme du Financial Times y sont marqués : afficher une
//                 estimation comme un fait exposerait à une contradiction
//                 publique.
//
//   ENTREPRISES   l'arbitrage des noms tronqués par la source. La décision
//                 porte sur TOUS les projets qui portent le même texte brut —
//                 « Banque de dévelo… » en couvre quatre, c'est une seule
//                 décision, pas quatre.
//
//   DESCRIPTIONS  la saisie de ce que le tableau de la source ne donne pas. Il
//                 y en a des centaines : cette vue est faite pour la série, un
//                 projet à la fois, sans jamais quitter le clavier.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, Carte, ChampRecherche, Compteur, Segments, btnPrincipal, btnSecondaire, IS, TH, TD } from "@/components/admin/UIAdmin";

type Projet = {
  id: number; lot: string; ligne: number; periode: string;
  entreprise: string | null; entreprise_brut: string | null; entreprise_tronquee: boolean;
  parent: string | null; statut_entreprise: "resolu" | "propose" | "en_attente";
  source: string | null; destination: string | null;
  source_resolue: boolean; destination_resolue: boolean;
  secteur: string | null; sous_secteur: string | null; activite: string | null; type_projet: string | null;
  capex_musd: number | null; capex_estime: boolean | null;
  emplois: number | null; emplois_estime: boolean | null;
  description_en: string | null; description_fr: string | null;
};
type Candidat = { id: number; nom: string; origine: "memoire" | "prefixe" };
type Groupe = {
  brut: string; tronque: boolean; nb_projets: number;
  entreprise_id: number | null; entreprise_nom: string | null;
  candidats: Candidat[];
  projets: { id: number; ligne: number; periode: string; lot: string;
             secteur: string | null; type: string | null; capex_musd: number | null }[];
};

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Un montant estimé ne se lit pas comme un montant déclaré. Le « ≈ » le dit
    sans bruit, l'infobulle l'explique. */
function Valeur({ v, estime, unite }: { v: number | null; estime: boolean | null; unite?: string }) {
  if (v == null) return <span style={{ color: "var(--gris)" }}>—</span>;
  return (
    <span title={estime ? "Valeur estimée par l'algorithme du Financial Times, non déclarée" : "Valeur déclarée"}
      style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
        color: estime ? "var(--gris-fort)" : "var(--encre)" }}>
      {estime && <span style={{ color: "var(--orange)", fontWeight: 700 }}>≈ </span>}
      {nf.format(v)}{unite ? ` ${unite}` : ""}
    </span>
  );
}

/** Un pays du référentiel s'écrit en français. Un pays que le rapprochement
    n'a pas atteint garde le libellé anglais de la source, en gris et signalé :
    la lacune se voit, et personne ne prend « Turkey » pour un nom canonique. */
function Pays({ nom, resolu }: { nom: string | null; resolu: boolean }) {
  if (!nom) return <span style={{ color: "var(--gris)" }}>—</span>;
  if (resolu) return <>{nom}</>;
  return (
    <span title="Libellé de la source, non rapproché du référentiel pays."
      style={{ color: "var(--gris-fort)", fontStyle: "italic" }}>{nom}</span>
  );
}

function Pastille({ children, couleur, titre }: {
  children: React.ReactNode; couleur: string; titre?: string;
}) {
  return (
    <span title={titre} style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: couleur, background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
      padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
    }}>{children}</span>
  );
}

export default function AdminFdiProjets() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [totaux, setTotaux] = useState({ total: 0, sans_description: 0, a_arbitrer: 0 });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [base, setBase] = useState<"projets" | "signaux" | "entreprises">("projets");
  const [vue, setVue] = useState<"projets" | "entreprises" | "descriptions">("projets");
  const [recherche, setRecherche] = useState("");

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try {
      const [p, a] = await Promise.all([
        fetch(`${API_BASE}/fdi/projets`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch(`${API_BASE}/fdi/arbitrage`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      ]);
      setProjets(p.projets); setTotaux(p.totaux); setGroupes(a.groupes);
    } catch {
      setErreur("Projets indisponibles. Vérifier que la migration 134 est appliquée et qu'un lot a été importé.");
    } finally { setChargement(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const annoncer = (t: string) => { setMessage(t); setTimeout(() => setMessage(null), 4000); };

  const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const projetsFiltres = useMemo(() => {
    const q = norm(recherche.trim());
    if (!q) return projets;
    return projets.filter(p => [p.entreprise, p.parent, p.secteur, p.sous_secteur,
      p.source, p.destination, p.type_projet].some(v => v && norm(v).includes(q)));
  }, [projets, recherche]);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1280, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--encre)", marginBottom: 4 }}>
        fDi Markets
      </h1>
      <p style={{ fontSize: 13, color: "var(--gris)", lineHeight: 1.6, marginBottom: 18 }}>
        Les investissements <em>annoncés</em>, relevés dans la base du Financial Times.
        Ils disent ce qui a été décidé, quand la CNUCED mesure ce qui est entré.
      </p>

      {/* Les trois bases du fournisseur, sous leur nom d'origine : c'est celui
          que les analystes lisent dans fDi, et le traduire ferait chercher. */}
      <div style={{ marginBottom: 18 }}>
        <Segments
          options={[
            { v: "projets" as const,     l: "Project database" },
            { v: "signaux" as const,     l: "Investor signals" },
            { v: "entreprises" as const, l: "Company database" },
          ]}
          value={base} onChange={setBase}
        />
      </div>

      {base !== "projets" ? (
        <ABientot base={base} />
      ) : (
      <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <Compteur n={totaux.total} mot="projet" />
        {totaux.a_arbitrer > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange)",
            background: "color-mix(in srgb, var(--orange) 8%, transparent)",
            padding: "3px 11px", borderRadius: 999 }}>
            {totaux.a_arbitrer} entreprise{totaux.a_arbitrer > 1 ? "s" : ""} à arbitrer
          </span>
        )}
        {totaux.sans_description > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gris-fort)",
            background: "rgb(var(--gris-rgb) / 0.12)", padding: "3px 11px", borderRadius: 999 }}>
            {totaux.sans_description} sans description
          </span>
        )}
      </div>

      {erreur && <div style={{ marginBottom: 18 }}><Avis ton="erreur">{erreur}</Avis></div>}
      {message && <div style={{ marginBottom: 18 }}><Avis ton="ok">{message}</Avis></div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Segments
          options={[
            { v: "projets" as const,      l: "Projets",       n: totaux.total },
            { v: "entreprises" as const,  l: "Entreprises",   n: groupes.length },
            { v: "descriptions" as const, l: "Descriptions",  n: totaux.sans_description },
          ]}
          value={vue} onChange={setVue}
        />
        {vue === "projets" && (
          <ChampRecherche value={recherche} onChange={setRecherche}
            placeholder="Rechercher une entreprise, un secteur, un pays…"
            style={{ flex: 1, minWidth: 240 }} />
        )}
      </div>

      {chargement ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "70px 0", color: "var(--gris)" }}>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : vue === "projets" ? (
        <VueProjets projets={projetsFiltres} recherche={recherche} />
      ) : vue === "entreprises" ? (
        <VueEntreprises groupes={groupes} onFait={async (t) => { annoncer(t); await charger(); }} />
      ) : (
        <VueDescriptions projets={projets} onFait={async (t) => { annoncer(t); await charger(); }} />
      )}
      </>
      )}
    </div>
  );
}

/** Une base annoncée, pas encore chargée. Dire ce qu'elle contient vaut mieux
    qu'un onglet vide : le lecteur sait ce qui viendra, et ce qui manque. */
function ABientot({ base }: { base: "signaux" | "entreprises" }) {
  const t = base === "signaux"
    ? { titre: "Investor signals",
        quoi: "Les intentions déclarées par les investisseurs — recrutement, recherche de site, levée de fonds — en amont de tout projet annoncé.",
        ou: "La nomenclature des signaux est déjà en base, et se consulte dans « Classification fDi Markets »." }
    : { titre: "Company database",
        quoi: "Les entreprises investisseuses : siège, secteur, historique de leurs implantations.",
        ou: "Les entreprises rencontrées dans les projets sont déjà tenues à jour par l'arbitrage des noms, sous « Project database »." };
  return (
    <Carte titre={t.titre}>
      <div style={{ padding: "30px 4px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--gris-fort)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 10px" }}>
          {t.quoi}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--gris)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto" }}>
          Base non encore chargée. {t.ou}
        </p>
      </div>
    </Carte>
  );
}

// ── Vue 1 : les projets ───────────────────────────────────────────────────────
function VueProjets({ projets, recherche }: { projets: Projet[]; recherche: string }) {
  return (
    <Carte
      titre="Projets annoncés"
    >
      {projets.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          {recherche ? `Aucun projet ne correspond à « ${recherche} ».` : "Aucun projet importé."}
        </p>
      ) : (
        <div style={{ border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Période</th>
                  <th style={TH}>Entreprise</th>
                  <th style={TH}>Origine</th>
                  <th style={TH}>Destination</th>
                  <th style={TH}>Secteur</th>
                  <th style={TH}>Activité</th>
                  <th style={TH}>Type</th>
                  <th style={{ ...TH, textAlign: "right" }}>Capex (M$)</th>
                  <th style={{ ...TH, textAlign: "right" }}>Emplois</th>
                </tr>
              </thead>
              <tbody>
                {projets.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...TD, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p.periode}</td>
                    <td style={TD}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>{p.entreprise ?? "—"}</span>
                        {p.statut_entreprise !== "resolu" && (
                          <Pastille couleur="var(--orange)" titre={`Nom affiché tronqué par la source : « ${p.entreprise_brut} ». À arbitrer.`}>
                            à arbitrer
                          </Pastille>
                        )}
                        {p.parent && p.parent !== p.entreprise && (
                          <span style={{ fontSize: 11, color: "var(--gris)" }}>groupe {p.parent}</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      <Pays nom={p.source} resolu={p.source_resolue} />
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      <Pays nom={p.destination} resolu={p.destination_resolue} />
                    </td>
                    <td style={TD}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span>{p.secteur ?? "—"}</span>
                        <span style={{ fontSize: 11, color: "var(--gris)" }}>{p.sous_secteur ?? ""}</span>
                      </span>
                    </td>
                    <td style={TD}>{p.activite ?? "—"}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{p.type_projet ?? "—"}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <Valeur v={p.capex_musd} estime={p.capex_estime} />
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <Valeur v={p.emplois} estime={p.emplois_estime} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Carte>
  );
}

// ── Vue 2 : l'arbitrage des entreprises ───────────────────────────────────────
function VueEntreprises({ groupes, onFait }: { groupes: Groupe[]; onFait: (t: string) => void }) {
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const trancher = async (brut: string, corps: Record<string, unknown>) => {
    setEnvoi(brut); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/arbitrage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ brut, ...corps }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Refusé (HTTP ${r.status}).`);
      }
      const d = await r.json();
      onFait(`${d.projets_rattaches} projet${d.projets_rattaches > 1 ? "s" : ""} rattaché${d.projets_rattaches > 1 ? "s" : ""}.`);
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setEnvoi(null); }
  };

  if (groupes.length === 0) {
    return (
      <Carte titre="Entreprises">
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          Rien à arbitrer : toutes les entreprises des projets importés portent un nom complet.
        </p>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Entreprises à arbitrer"
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groupes.map(g => (
          <div key={g.brut} style={{ border: "1px solid var(--bordure)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{g.brut}</span>
              {g.tronque && <Pastille couleur="var(--orange)" titre="Nom coupé par la source">tronqué</Pastille>}
              <Compteur n={g.nb_projets} mot="projet" couleur="var(--violet)" />
            </div>

            {/* Le contexte : sans lui, impossible de deviner de quelle entreprise il s'agit. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {g.projets.map(p => (
                <span key={p.id} style={{ fontSize: 11, color: "var(--gris-fort)", background: "var(--carte-douce)",
                  border: "1px solid var(--filet)", borderRadius: 8, padding: "3px 9px", whiteSpace: "nowrap" }}>
                  {p.periode} · {p.secteur ?? "?"}{p.capex_musd != null ? ` · ${nf.format(p.capex_musd)} M$` : ""}
                  {p.type ? ` · ${p.type}` : ""}
                </span>
              ))}
            </div>

            {g.candidats.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "var(--gris)" }}>Déjà connu :</span>
                {g.candidats.map(c => (
                  <button key={c.id} disabled={envoi === g.brut}
                    onClick={() => trancher(g.brut, { mode: "rattacher", entreprise_id: c.id })}
                    title={c.origine === "memoire" ? "Ce texte a déjà été tranché ainsi" : "Le nom commence par ce texte"}
                    style={{ ...btnSecondaire, padding: "6px 12px", fontSize: 12,
                      borderColor: c.origine === "memoire" ? "rgb(var(--bleu-rgb) / 0.35)" : "var(--bordure-forte)" }}>
                    {c.nom}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                value={saisies[g.brut] ?? ""}
                onChange={e => setSaisies(s => ({ ...s, [g.brut]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === "Enter" && (saisies[g.brut] ?? "").trim()) {
                    trancher(g.brut, { mode: "nommer", nom: saisies[g.brut] });
                  }
                }}
                placeholder="Nom complet de l'entreprise…"
                style={{ ...IS, flex: 1, minWidth: 240 }}
              />
              <button
                disabled={envoi === g.brut || !(saisies[g.brut] ?? "").trim()}
                onClick={() => trancher(g.brut, { mode: "nommer", nom: saisies[g.brut] })}
                style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 7,
                  opacity: envoi === g.brut || !(saisies[g.brut] ?? "").trim() ? 0.5 : 1 }}>
                {envoi === g.brut ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                  : <Check size={13} />}
                Confirmer
              </button>
            </div>
          </div>
        ))}
      </div>
    </Carte>
  );
}

// ── Vue 3 : la saisie des descriptions, en série ──────────────────────────────
function VueDescriptions({ projets, onFait }: { projets: Projet[]; onFait: (t: string) => void }) {
  // On travaille sur la liste complète, mais en démarrant sur le premier projet
  // sans description : on peut ainsi revenir corriger une saisie passée sans
  // sortir de la vue.
  const [i, setI] = useState(() => Math.max(0, projets.findIndex(p => !p.description_en)));
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const p = projets[i];
  useEffect(() => {
    setEn(p?.description_en ?? ""); setFr(p?.description_fr ?? ""); setErreur(null);
  }, [p?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const restants = projets.filter(x => !x.description_en).length;

  const enregistrer = async (avancer: boolean) => {
    if (!p) return;
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/fdi/projets/${p.id}/description`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ description_en: en, description_fr: fr }),
      });
      if (!r.ok) throw new Error(`Refusé (HTTP ${r.status}).`);
      // La liste locale suit sans rechargement : enchaîner vingt saisies ne doit
      // pas déclencher vingt allers-retours de liste complète.
      p.description_en = en.trim() || null;
      p.description_fr = fr.trim() || null;
      if (avancer) {
        const suivant = projets.findIndex((x, k) => k > i && !x.description_en);
        setI(suivant >= 0 ? suivant : Math.min(i + 1, projets.length - 1));
      } else {
        onFait("Description enregistrée.");
      }
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally { setEnvoi(false); }
  };

  if (!p) {
    return (
      <Carte titre="Descriptions">
        <p style={{ fontSize: 13, color: "var(--gris)", textAlign: "center", padding: "34px 0" }}>
          Aucun projet importé.
        </p>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Saisie des descriptions"
      extra={
        <span style={{ fontSize: 11.5, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>
          {i + 1} / {projets.length} · {restants} sans description
        </span>
      }
    >
      {erreur && <div style={{ marginBottom: 14 }}><Avis ton="erreur">{erreur}</Avis></div>}

      {/* Le contexte du projet : on n'écrit pas une description à l'aveugle. */}
      <div style={{ border: "1px solid var(--bordure)", borderRadius: 12, padding: "12px 15px",
        background: "var(--carte-douce)", marginBottom: 14, display: "flex", flexWrap: "wrap",
        alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--encre)" }}>{p.entreprise ?? "—"}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.periode}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.source} → {p.destination}</span>
        <span style={{ fontSize: 12, color: "var(--gris-fort)" }}>{p.sous_secteur ?? p.secteur}</span>
        {p.type_projet && <Pastille couleur="var(--bleu)">{p.type_projet}</Pastille>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 12 }}>
          <span><Valeur v={p.capex_musd} estime={p.capex_estime} unite="M$" /></span>
          <span><Valeur v={p.emplois} estime={p.emplois_estime} unite="emplois" /></span>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--gris)" }}>Description (anglais)</span>
          <textarea value={en} onChange={e => setEn(e.target.value)} rows={7} autoFocus
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enregistrer(true); }}
            style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--gris)" }}>Description (français, facultatif)</span>
          <textarea value={fr} onChange={e => setFr(e.target.value)} rows={7}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enregistrer(true); }}
            style={{ ...IS, resize: "vertical", lineHeight: 1.6 }} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => setI(k => Math.max(0, k - 1))} disabled={i === 0}
          style={{ ...btnSecondaire, display: "inline-flex", alignItems: "center", gap: 6, opacity: i === 0 ? 0.5 : 1 }}>
          <ChevronLeft size={13} /> Précédent
        </button>
        <button onClick={() => setI(k => Math.min(projets.length - 1, k + 1))} disabled={i >= projets.length - 1}
          style={{ ...btnSecondaire, display: "inline-flex", alignItems: "center", gap: 6,
            opacity: i >= projets.length - 1 ? 0.5 : 1 }}>
          Suivant <ChevronRight size={13} />
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--gris)" }}>⌘/Ctrl + Entrée</span>
        <button onClick={() => enregistrer(false)} disabled={envoi} style={btnSecondaire}>
          Enregistrer
        </button>
        <button onClick={() => enregistrer(true)} disabled={envoi}
          style={{ ...btnPrincipal(true), display: "inline-flex", alignItems: "center", gap: 7, opacity: envoi ? 0.6 : 1 }}>
          {envoi ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
          Enregistrer et suivant
        </button>
      </div>
    </Carte>
  );
}
