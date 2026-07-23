"use client";

// Rapport d'analyse du commerce extérieur — briefing exécutif une page,
// alimenté en direct par les bulletins ANSD importés (API /bmce/rapport).
// Conçu pour les communications officielles (Présidence, Directions).

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SkeletonKPIs, SkeletonRows } from "@/components/shared/Skeleton";
import NavActions from "@/components/layout/NavActions";
import ErreurChargement from "@/components/shared/ErreurChargement";
import GrapheMultiPays from "@/components/shared/GrapheMultiPays";
import { drapeauEmoji } from "@/lib/drapeaux";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Top = { libelle: string; code_iso2: string | null; valeur: number; part_pct: number | null };
type Rapport = {
  disponible: boolean; annee?: number; annees?: number[]; maj?: string | null;
  mois?: string[]; mois_provisoires?: string[];
  serie?: { periode: string; export?: number | null; import?: number | null }[];
  cumul?: { export: number; import: number };
  precedent?: { export: number; import: number } | null;
  produits?: { export: Top[]; import: Top[] };
  pays?: { export: Top[]; import: Top[] };
  continents?: { continent: string; export: number; import: number }[];
};

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";
const nf = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });
function fmtMd(v: number | null | undefined, d = 1): string {
  if (v === null || v === undefined) return "—";
  return `${nf(v / 1e9, d)} Md`;
}
function moisLongPlage(mois: string[]): string {
  if (!mois.length) return "";
  const l = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
  };
  return mois.length === 1 ? l(mois[0]) : `${l(mois[0])} – ${l(mois[mois.length - 1])}`;
}
function varPct(v: number | null | undefined, p: number | null | undefined): number | null {
  return v == null || p == null || p === 0 ? null : ((v - p) / p) * 100;
}
function Delta({ v, surFonce = false }: { v: number | null; surFonce?: boolean }) {
  if (v === null) return null;
  const pos = v > 0, neg = v < 0;
  const col = surFonce ? (pos ? "#7be3a2" : neg ? "#ffb3ab" : "rgba(255,255,255,0.7)")
    : (pos ? "#188038" : neg ? "#dc2626" : "#9aa5b4");
  return (
    <span style={{ fontSize: 12, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {pos ? "▲" : neg ? "▼" : "="}&nbsp;{nf(Math.abs(v))} %
    </span>
  );
}
// Drapeaux : emoji de la liste validée (mêmes règles que l'app mobile) ;
// pays hors liste → image flagcdn ; sans ISO2 → espace réservé.
function Drapeau({ iso, nom }: { iso: string | null; nom: string }) {
  if (!iso) return <span style={{ width: 21, display: "inline-block" }} />;
  const emoji = drapeauEmoji(iso);
  if (emoji) return <span title={nom} style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`} alt="" title={nom}
    style={{ width: 21, height: 15, objectFit: "cover", borderRadius: 2.5, boxShadow: "0 0 0 1px rgba(15,40,80,0.14)", flexShrink: 0 }} />;
}

const MOIS_FR = ["", "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

const TITRE_SEC: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 14px" };

function ContenuRapport() {
  const params = useSearchParams();
  const anneeParam = Number(params.get("annee")) || new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeParam);
  const [r, setR] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/bmce/rapport?annee=${annee}`)
      .then(x => { if (!x.ok) throw new Error(); return x.json(); })
      .then(setR).catch(() => setErreur(true)).finally(() => setLoading(false));
    window.history.replaceState(null, "", `/statistiques/rapport-commerce?annee=${annee}`);
  }, [annee, tick]);

  // Messages « À retenir » générés depuis les données (déterministes)
  const aRetenir = useMemo(() => {
    if (!r?.disponible || !r.cumul) return [];
    const msgs: string[] = [];
    const exp = r.cumul.export, imp = r.cumul.import;
    const p1e = r.pays?.export?.[0], p1i = r.pays?.import?.[0];
    const pr1 = r.produits?.export?.[0];
    if (p1e?.part_pct != null) msgs.push(`${p1e.libelle} est la 1ʳᵉ destination des exportations (${nf(p1e.part_pct)} % du total).`);
    if (p1i?.part_pct != null) msgs.push(`${p1i.libelle} est la 1ʳᵉ source des importations (${nf(p1i.part_pct)} %).`);
    if (pr1?.part_pct != null) msgs.push(`Les exportations sont tirées par « ${pr1.libelle.toLowerCase()} » (${nf(pr1.part_pct)} % des ventes).`);
    if (imp > 0) msgs.push(`Le taux de couverture des importations par les exportations s'établit à ${nf(exp / imp * 100)} %.`);
    if (r.precedent) {
      const soldeN = exp - imp, soldeP = r.precedent.export - r.precedent.import;
      if (soldeP !== 0) {
        const evol = Math.abs(soldeN) < Math.abs(soldeP) ? "se réduit" : "se creuse";
        msgs.push(`Le solde commercial ${evol} : ${fmtMd(soldeN)} FCFA contre ${fmtMd(soldeP)} FCFA un an plus tôt.`);
      }
    }
    return msgs.slice(0, 4);
  }, [r]);

  if (loading) return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={4} /><SkeletonRows n={10} h={34} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  if (!r || !r.disponible) return (
    <div style={{ maxWidth: 720, margin: "60px auto", textAlign: "center", color: "#6b7684", fontFamily: "var(--font-google-sans)" }}>
      Aucune donnée du commerce extérieur pour {annee}. Importez d&apos;abord les bulletins ANSD.
      {(r?.annees?.length ?? 0) > 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center" }}>
          {r!.annees!.map(a => (
            <button key={a} onClick={() => setAnnee(a)}
              style={{ padding: "6px 16px", borderRadius: 999, border: "1px solid var(--ds-bordure)", background: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "var(--font-google-sans)" }}>{a}</button>
          ))}
        </div>
      )}
    </div>
  );

  const exp = r.cumul!.export, imp = r.cumul!.import;
  const solde = exp - imp;
  const taux = imp !== 0 ? (exp / imp) * 100 : null;
  const prec = r.precedent;
  const kpis: { l: string; tag: string | null; txt: string; d: number | null; rouge?: boolean }[] = [
    { l: "Exportations", tag: "FAB", txt: `${fmtMd(exp)} FCFA`, d: varPct(exp, prec?.export) },
    { l: "Importations", tag: "CAF", txt: `${fmtMd(imp)} FCFA`, d: varPct(imp, prec?.import) },
    { l: "Balance commerciale", tag: "FAB − CAF", txt: `${fmtMd(solde)} FCFA`, d: null, rouge: solde < 0 },
    { l: "Taux de couverture", tag: null, txt: taux != null ? `${nf(taux)} %` : "—", d: null },
  ];
  // Séries mensuelles pour les deux graphes signature (x = numéro du mois)
  const serieDe = (s: "export" | "import") =>
    (r.serie || []).map(p => ({ annee: Number(p.periode.slice(5, 7)), valeur: p[s] ?? null }));
  const plage = moisLongPlage(r.mois || []);
  const totCont = (c: { export: number; import: number }) => c.export + c.import;

  const Th = ({ children, droite = false }: { children: React.ReactNode; droite?: boolean }) => (
    <th style={{ padding: "7px 10px", textAlign: droite ? "right" : "left", fontSize: 9.5, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", borderBottom: "2px solid #E6E9EF" }}>{children}</th>
  );

  const TableauPays = ({ titre, lignes, couleur }: { titre: string; lignes: Top[]; couleur: string }) => {
    const totalTop = lignes.reduce((s, x) => s + x.valeur, 0);
    const partTop = lignes.reduce((s, x) => s + (x.part_pct || 0), 0);
    return (
      <div className="ds-carte" style={{ padding: "20px 22px", breakInside: "avoid" }}>
        <p style={TITRE_SEC}>{titre}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><Th>#</Th><Th>Pays</Th><Th droite>Md FCFA</Th><Th droite>Part</Th></tr></thead>
          <tbody>
            {lignes.map((x, i) => (
              <tr key={x.libelle} style={{ borderBottom: "1px solid #F3F5F8", background: i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
                <td style={{ padding: "6.5px 10px", width: 34 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 21, height: 21, borderRadius: 999, background: i < 3 ? couleur : "#EEF1F6", color: i < 3 ? "#fff" : "#5c6675", fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
                </td>
                <td style={{ padding: "6.5px 10px", fontWeight: 650, color: ENCRE }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Drapeau iso={x.code_iso2} nom={x.libelle} />{x.libelle}</span>
                </td>
                <td className="ds-donnee" style={{ padding: "6.5px 10px", textAlign: "right", fontWeight: 750, color: ENCRE, whiteSpace: "nowrap" }}>{nf(x.valeur / 1e9)}</td>
                <td className="ds-donnee" style={{ padding: "6.5px 10px", textAlign: "right", color: "#6b7684", whiteSpace: "nowrap" }}>{x.part_pct != null ? `${nf(x.part_pct)} %` : "—"}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 800, color: "#3a4553", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total top {lignes.length}</td>
              <td className="ds-donnee" style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: ENCRE }}>{nf(totalTop / 1e9)}</td>
              <td className="ds-donnee" style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: ENCRE }}>{nf(partTop)} %</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const ColonneProduits = ({ titre, lignes, couleur }: { titre: string; lignes: Top[]; couleur: string }) => {
    const partAutres = Math.max(0, 100 - lignes.reduce((s, x) => s + (x.part_pct || 0), 0));
    const maxPart = Math.max(1, ...lignes.map(x => x.part_pct || 0), partAutres);
    const Ligne = ({ nom, part, estompe = false }: { nom: string; part: number; estompe?: boolean }) => (
      <div style={{ padding: "6px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: estompe ? "#8a93a3" : "#3a4553", lineHeight: 1.3 }}>{nom}</span>
          <span className="ds-donnee" style={{ fontSize: 12, fontWeight: 800, color: estompe ? "#8a93a3" : ENCRE, whiteSpace: "nowrap" }}>{nf(part)} %</span>
        </div>
        <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(1, part / maxPart * 100)}%`, height: "100%", borderRadius: 4, background: estompe ? "#c5ccd8" : couleur }} />
        </div>
      </div>
    );
    return (
      <div className="ds-carte" style={{ padding: "20px 22px", breakInside: "avoid" }}>
        <p style={TITRE_SEC}>{titre} <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· % du total</span></p>
        {lignes.map(x => <Ligne key={x.libelle} nom={x.libelle} part={x.part_pct || 0} />)}
        <Ligne nom="Autres produits" part={partAutres} estompe />
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      <style>{`
        @keyframes anneeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rapport-annee-in { animation: anneeIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .rapport-annee-in { animation: none; } }
        @media print {
          nav, header, footer, .no-print { display: none !important; }
          body { background: #fff !important; }
          .rapport-page { padding: 0 !important; }
          .rapport-annee-in { animation: none !important; }
          .ds-carte { box-shadow: none !important; border: 1px solid #E2E6EC !important; }
        }
      `}</style>

      {/* ── Bandeau exécutif ── */}
      <div data-bandeau style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "34px 40px 88px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "0 0 10px" }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", margin: 0 }}>
                  Rapport d&apos;analyse
                </p>
                {(r.annees?.length ?? 0) > 1 && (
                  <div role="tablist" aria-label="Année" style={{ display: "inline-flex", gap: 3, padding: 3, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999 }}>
                    {r.annees!.map(a => {
                      const actif = a === r.annee;
                      return (
                        <button key={a} role="tab" aria-selected={actif} onClick={() => setAnnee(a)}
                          style={{ padding: "4px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
                            background: actif ? "#fff" : "transparent", color: actif ? BLEU : "rgba(255,255,255,0.75)",
                            transition: "background 0.16s, color 0.16s", fontFamily: "var(--font-google-sans)" }}>
                          {a}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                Le Sénégal dans le commerce mondial
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "10px 0 0", fontWeight: 500 }}>
                Échanges de biens · Exportations FAB · Importations CAF — <b style={{ color: "#fff" }}>{plage} {r.annee}</b>
              </p>
            </div>
            <div className="no-print" style={{ flexShrink: 0 }}>
              <NavActions onDark home flouTotal />
            </div>
          </div>
        </div>
      </div>

      <div key={annee} className="rapport-page rapport-annee-in" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px 70px" }}>
        {/* ── KPIs chevauchant le bandeau ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: -52 }}>
          {kpis.map(k => (
            <div key={k.l} className="ds-carte" style={{ padding: "18px 20px", boxShadow: "var(--ombre-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: 0 }}>{k.l}</p>
                {k.tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#8a93a3", background: "#EEF1F6", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{k.tag}</span>}
              </div>
              <p className="ds-donnee" style={{ fontSize: "1.65rem", fontWeight: 800, color: k.rouge ? "#dc2626" : ENCRE, margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                {k.txt}
              </p>
              <div style={{ marginTop: 8, minHeight: 15, display: "flex", alignItems: "center", gap: 6 }}>
                <Delta v={k.d} />
                {k.d !== null && <span style={{ fontSize: 10, color: "#9aa5b4" }}>vs même période {r.annee! - 1}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── À retenir ── */}
        {aRetenir.length > 0 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px", background: "linear-gradient(180deg, rgba(0,79,145,0.05), rgba(0,79,145,0.02))", border: "1px solid rgba(0,79,145,0.14)", breakInside: "avoid" }}>
            <p style={TITRE_SEC}>À retenir</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "10px 28px" }}>
              {aRetenir.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: BLEU, marginTop: 6, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "#2c3646", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Évolution mensuelle : deux graphes signature (courbes D3, glow,
            curseur aimanté, pic historique) — export et import séparés ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 18 }}>
          {([
            { titre: "Exportations (FAB)", sens: "export" as const, couleur: BLEU },
            { titre: "Importations (CAF)", sens: "import" as const, couleur: ORANGE },
          ]).map(g => (
            <div key={g.sens} className="ds-carte" style={{ padding: "22px 24px 14px", breakInside: "avoid" }}>
              <p style={TITRE_SEC}>{g.titre} <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· mensuel {r.annee}</span></p>
              <GrapheMultiPays height={230}
                series={[{ nom: g.titre, couleur: g.couleur, data: serieDe(g.sens) }]}
                fmt={v => v === null ? "—" : `${fmtMd(v)} FCFA`}
                fmtX={m => MOIS_FR[m] || String(m)} />
            </div>
          ))}
        </div>

        {/* ── Produits ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginTop: 18 }}>
          <ColonneProduits titre="Principaux produits exportés" lignes={r.produits?.export || []} couleur={BLEU} />
          <ColonneProduits titre="Principaux produits importés" lignes={r.produits?.import || []} couleur={ORANGE} />
        </div>

        {/* ── Top pays ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginTop: 18 }}>
          <TableauPays titre="Principales destinations des exportations" lignes={r.pays?.export || []} couleur={BLEU} />
          <TableauPays titre="Principales sources des importations" lignes={r.pays?.import || []} couleur={ORANGE} />
        </div>

        {/* ── Échanges par continent ── */}
        {(r.continents?.length ?? 0) > 0 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px", breakInside: "avoid" }}>
            <p style={TITRE_SEC}>Échanges par continent <span style={{ color: "#9aa5b4", letterSpacing: "0.06em" }}>· pays identifiés, milliards de FCFA</span></p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><Th>Continent</Th><Th droite>Exportations (FAB)</Th><Th droite>Importations (CAF)</Th><Th droite>Total</Th><Th droite>Poids des échanges</Th></tr></thead>
              <tbody>
                {r.continents!.map(c => {
                  const t = totCont(c);
                  const maxT = totCont(r.continents![0]) || 1;
                  return (
                    <tr key={c.continent} style={{ borderBottom: "1px solid #F3F5F8" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: ENCRE }}>{c.continent}</td>
                      <td className="ds-donnee" style={{ padding: "8px 10px", textAlign: "right", color: "#2c3646" }}>{nf(c.export / 1e9)}</td>
                      <td className="ds-donnee" style={{ padding: "8px 10px", textAlign: "right", color: "#2c3646" }}>{nf(c.import / 1e9)}</td>
                      <td className="ds-donnee" style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: ENCRE }}>{nf(t / 1e9)}</td>
                      <td style={{ padding: "8px 10px 8px 24px", width: "26%" }}>
                        <div style={{ height: 8, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(2, t / maxT * 100)}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${BLEU}, #1a6ab0)` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pied méthodologique ── */}
        <div style={{ marginTop: 22, padding: "14px 4px 0", borderTop: "1px solid #E2E6EC", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            <b style={{ color: "#5c6675" }}>Source :</b> ANSD — Bulletin Mensuel des Statistiques du Commerce Extérieur (BMSCE).
          </p>
          <p style={{ fontSize: 10.5, color: "#8a93a3", margin: 0, whiteSpace: "nowrap" }}>
            Mise à jour le {new Date(r.maj || Date.now()).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RapportCommercePage() {
  return (
    <Suspense fallback={null}>
      <ContenuRapport />
    </Suspense>
  );
}
