"use client";

// Rapport d'analyse du commerce extérieur du Sénégal — document exhaustif,
// alimenté par GET /nace/rapport (Note d'Analyse du Commerce Extérieur de
// l'ANSD, éditions 2019 à 2024, couvrant 2015–2024).
//
// Conçu pour être lu à l'écran ET imprimé tel quel : les commandes disparaissent
// à l'impression, les cartes ne se coupent pas entre deux pages.
//
// Une année pilote tout le document, contrairement à l'onglet « Commerce
// extérieur » où chaque section a son curseur : un rapport est un instantané,
// il doit être daté d'un seul millésime.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { SkeletonKPIs, SkeletonRows } from "@/components/shared/Skeleton";
import NavActions from "@/components/layout/NavActions";
import ErreurChargement from "@/components/shared/ErreurChargement";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import { drapeauEmoji } from "@/lib/drapeaux";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BLEU = "#004f91", ORANGE = "#ca631f", ENCRE = "#101a2e";
const VERT = "#188038", ROUGE = "#dc2626", GRIS = "#8a93a3";

// ── Formes de la réponse ──────────────────────────────────────────────────────
type Rang = {
  nom: string; valeur: number; poids?: number | null;
  part: number | null; variation: number | null;
  iso2?: string | null; region?: string;
};
type Famille = {
  symetrique: boolean; modalites: { export: number; import: number };
  reste: { export: { nom: string; valeur: number; part: number | null };
           import: { nom: string; valeur: number; part: number | null } } | null;
  export: Rang[]; import: Rang[];
};
type Zone = {
  nom: string; export: number; import: number; solde: number;
  part_export: number | null; part_import: number | null;
  var_export: number | null; var_import: number | null; continent: string | null;
};
type Annee = {
  annee: number; export: number; import: number; solde: number;
  couverture: number | null; export_poids: number; import_poids: number;
};
type Rapport = {
  disponible: boolean; annee?: number; annees?: number[]; edition?: number | null;
  serie?: Annee[]; totaux?: Annee | null; precedent?: Annee | null;
  produits?: Record<"principaux" | "groupes" | "regroupes" | "chapitres", Famille>;
  geo?: {
    continents: Zone[]; regions: Zone[];
    pays: { export: Rang[]; import: Rang[] };
    par_continent: { continent: string; export: number; import: number;
                     clients: Rang[]; fournisseurs: Rang[] }[];
  };
};

// ── Formatage ─────────────────────────────────────────────────────────────────
const nf = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });
// Les valeurs de la NACE sont en millions de FCFA. On passe au milliard au-delà
// de mille millions, mais on garde le million en dessous : arrondir Samoa ou
// Tonga à « 0 Md » laisserait croire à une absence d'échange.
const fmtMd = (v: number | null | undefined) =>
  v == null ? "—" : Math.abs(v) >= 1000 ? `${nf(v / 1000)} Md` : `${nf(v, 0)} M`;
const fmtPct = (v: number | null | undefined, d = 1) => v == null ? "—" : `${nf(v, d)} %`;
const fmtT = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `${nf(v / 1e6, 2)} Mt`;
  if (Math.abs(v) >= 1e3) return `${nf(v / 1e3)} kt`;
  return `${nf(v, 0)} t`;
};

function Delta({ v, surFonce = false }: { v: number | null | undefined; surFonce?: boolean }) {
  if (v == null) return <span style={{ color: surFonce ? "rgba(255,255,255,0.5)" : "#C5BFBB", fontSize: 11.5 }}>—</span>;
  const pos = v > 0, neg = v < 0;
  const col = surFonce ? (pos ? "#7be3a2" : neg ? "#ffb3ab" : "rgba(255,255,255,0.7)")
    : (pos ? VERT : neg ? ROUGE : GRIS);
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {pos ? "▲" : neg ? "▼" : "="}&nbsp;{nf(Math.abs(v))} %
    </span>
  );
}
function Solde({ v, taille = 12 }: { v: number; taille?: number }) {
  return (
    <span className="ds-donnee" style={{ fontSize: taille, fontWeight: 800, whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums", color: v > 0 ? VERT : v < 0 ? ROUGE : GRIS }}>
      {v > 0 ? "+" : v < 0 ? "−" : ""}{fmtMd(Math.abs(v))}
    </span>
  );
}
function Drapeau({ iso, nom }: { iso?: string | null; nom: string }) {
  if (!iso) return <span title={nom} style={{ width: 21, display: "inline-block", textAlign: "center", fontSize: 13 }}>🌐</span>;
  const emoji = drapeauEmoji(iso);
  if (emoji) return <span title={nom} style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`} alt="" title={nom}
    style={{ width: 21, height: 15, objectFit: "cover", borderRadius: 2.5, boxShadow: "0 0 0 1px rgba(15,40,80,0.14)", flexShrink: 0 }} />;
}

// ── Briques de mise en page ───────────────────────────────────────────────────
const TITRE_SEC: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: BLEU,
  letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 13px" };

function EnTeteChapitre({ n, titre, note }: { n: number; titre: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, margin: "34px 0 16px", breakAfter: "avoid" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(0,79,145,0.09)", color: BLEU,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800,
        flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
      <h2 style={{ margin: 0, fontSize: "1.12rem", fontWeight: 800, color: ENCRE, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{titre}</h2>
      {note && <span style={{ fontSize: 11.5, color: GRIS, fontWeight: 600 }}>{note}</span>}
      <div style={{ flex: 1, height: 1, background: "rgba(16,26,46,0.12)" }} />
    </div>
  );
}
const Th = ({ children, droite = false, largeur }: { children?: React.ReactNode; droite?: boolean; largeur?: number | string }) => (
  <th style={{ padding: "7px 9px", textAlign: droite ? "right" : "left", width: largeur,
    fontSize: 9, fontWeight: 800, color: GRIS, textTransform: "uppercase", letterSpacing: "0.08em",
    whiteSpace: "nowrap", borderBottom: "1.5px solid #E6E9EF" }}>{children}</th>
);
const Td = ({ children, droite = false, gras = false, couleur }: {
  children?: React.ReactNode; droite?: boolean; gras?: boolean; couleur?: string;
}) => (
  <td className={droite ? "ds-donnee" : undefined}
    style={{ padding: "6px 9px", textAlign: droite ? "right" : "left", whiteSpace: droite ? "nowrap" : undefined,
      fontSize: 12, fontWeight: gras ? 800 : 600, color: couleur ?? ENCRE,
      fontVariantNumeric: droite ? "tabular-nums" : undefined }}>{children}</td>
);
const Carte = ({ children, padding = "18px 20px" }: { children: React.ReactNode; padding?: string }) => (
  <div className="ds-carte" style={{ padding, breakInside: "avoid" }}>{children}</div>
);
// Rang en pastille : les trois premiers portent la couleur du sens.
const Pastille = ({ n, couleur }: { n: number; couleur: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20,
    borderRadius: 999, background: n <= 3 ? couleur : "#EEF1F6", color: n <= 3 ? "#fff" : "#5c6675",
    fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{n}</span>
);

// ── Classement de modalités (produits ou pays) ────────────────────────────────
function Classement({ titre, lignes, couleur, drapeaux, reste, unite = "valeur" }: {
  titre: string; lignes: Rang[]; couleur: string; drapeaux?: boolean;
  reste?: { nom: string; valeur: number; part: number | null } | null;
  unite?: "valeur" | "poids";
}) {
  const max = Math.max(1, ...lignes.map(l => l.valeur));
  const fmt = unite === "valeur" ? fmtMd : fmtT;
  return (
    <Carte>
      <p style={TITRE_SEC}>{titre}</p>
      {/* Mise en page fixe : sans elle, la somme des colonnes chiffrées et de
          la barre dépasse la largeur de la carte, et la barre en sort. */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead><tr>
          <Th largeur={30}>#</Th>{drapeaux && <Th largeur={26} />}<Th />
          <Th droite largeur={86}>{unite === "valeur" ? "Valeur" : "Poids"}</Th>
          <Th droite largeur={50}>Part</Th><Th droite largeur={60}>vs n-1</Th><Th largeur="15%" />
        </tr></thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.nom} style={{ background: i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
              <Td><Pastille n={i + 1} couleur={couleur} /></Td>
              {drapeaux && <Td><Drapeau iso={l.iso2} nom={l.nom} /></Td>}
              <Td>
                <span title={l.nom} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
              </Td>
              <Td droite gras>{fmt(unite === "valeur" ? l.valeur : l.poids)}</Td>
              <Td droite couleur="#4a5568">{fmtPct(l.part)}</Td>
              <Td droite><Delta v={l.variation} /></Td>
              <td style={{ padding: "6px 0 6px 14px" }}>
                <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, l.valeur / max * 100)}%`, height: "100%", borderRadius: 4,
                    background: couleur, opacity: i < 3 ? 0.95 : 0.6 }} />
                </div>
              </td>
            </tr>
          ))}
          {/* Fourre-tout de la nomenclature : hors classement, car ce n'est pas
              une modalité — mais sa part dit ce que le classement ne couvre pas. */}
          {reste && (
            <tr>
              <Td />{drapeaux && <Td />}
              <Td couleur={GRIS}><span style={{ fontStyle: "italic", fontWeight: 600 }}>{reste.nom}</span></Td>
              <Td droite couleur={GRIS}>{fmtMd(reste.valeur)}</Td>
              <Td droite couleur={GRIS}>{fmtPct(reste.part)}</Td>
              <Td /><td />
            </tr>
          )}
        </tbody>
      </table>
    </Carte>
  );
}

// ── Tableau des zones (continents ou régions) ─────────────────────────────────
function TableauZones({ titre, zones, note }: { titre: string; zones: Zone[]; note?: string }) {
  const maxEch = Math.max(1, ...zones.map(z => z.export + z.import));
  return (
    <Carte>
      <p style={TITRE_SEC}>{titre}{note && <span style={{ color: GRIS, letterSpacing: "0.06em" }}> · {note}</span>}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead><tr>
          <Th>Zone</Th>
          <Th droite largeur={88}>Export</Th><Th droite largeur={46}>Part</Th><Th droite largeur={58}>vs n-1</Th>
          <Th droite largeur={88}>Import</Th><Th droite largeur={46}>Part</Th><Th droite largeur={58}>vs n-1</Th>
          <Th droite largeur={96}>Balance</Th><Th largeur="10%" />
        </tr></thead>
        <tbody>
          {zones.map((z, i) => (
            <tr key={z.nom} style={{ background: i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
              <Td gras>
                {z.nom}
                {z.continent && <span style={{ fontSize: 9.5, fontWeight: 700, color: GRIS, marginLeft: 7 }}>{z.continent}</span>}
              </Td>
              <Td droite couleur={BLEU} gras>{fmtMd(z.export)}</Td>
              <Td droite couleur="#4a5568">{fmtPct(z.part_export)}</Td>
              <Td droite><Delta v={z.var_export} /></Td>
              <Td droite couleur={ORANGE} gras>{fmtMd(z.import)}</Td>
              <Td droite couleur="#4a5568">{fmtPct(z.part_import)}</Td>
              <Td droite><Delta v={z.var_import} /></Td>
              <Td droite><Solde v={z.solde} /></Td>
              <td style={{ padding: "6px 0 6px 12px" }}>
                <div style={{ height: 7, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, (z.export + z.import) / maxEch * 100)}%`, height: "100%",
                    borderRadius: 4, background: `linear-gradient(90deg, ${BLEU}, #1a6ab0)` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Carte>
  );
}

// ── Corps du rapport ──────────────────────────────────────────────────────────
function ContenuRapport() {
  const params = useSearchParams();
  const [annee, setAnnee] = useState<number | null>(Number(params.get("annee")) || null);
  const [r, setR] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/nace/rapport${annee ? `?annee=${annee}` : ""}`)
      .then(x => { if (!x.ok) throw new Error(); return x.json(); })
      .then(setR).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [annee, tick]);

  // L'URL porte l'année pour que le rapport soit partageable en l'état.
  useEffect(() => {
    if (r?.annee) window.history.replaceState(null, "", `/statistiques/rapport-commerce?annee=${r.annee}`);
  }, [r?.annee]);

  const imprimer = useCallback(() => window.print(), []);

  // Faits saillants : tous déduits des données, aucun texte en dur qui
  // pourrait démentir les chiffres affichés juste à côté.
  const aRetenir = useMemo(() => {
    if (!r?.disponible || !r.totaux) return [];
    const t = r.totaux, p = r.precedent, g = r.geo, pr = r.produits;
    const m: string[] = [];
    if (p) {
      const dExp = p.export ? (t.export - p.export) / Math.abs(p.export) * 100 : null;
      const dImp = p.import ? (t.import - p.import) / Math.abs(p.import) * 100 : null;
      if (dExp != null && dImp != null)
        m.push(`Les exportations ${dExp >= 0 ? "progressent" : "reculent"} de ${nf(Math.abs(dExp))} % et les importations ${dImp >= 0 ? "de" : "reculent de"} ${nf(Math.abs(dImp))} % par rapport à ${p.annee}.`);
      const creuse = Math.abs(t.solde) > Math.abs(p.solde);
      m.push(`Le déficit commercial ${creuse ? "se creuse" : "se réduit"} : ${fmtMd(t.solde)} FCFA contre ${fmtMd(p.solde)} FCFA en ${p.annee}, soit un taux de couverture de ${fmtPct(t.couverture)}.`);
    }
    const pe = pr?.principaux.export[0], pi = pr?.principaux.import[0];
    if (pe) m.push(`Le premier poste d'exportation est « ${pe.nom.toLowerCase()} », ${fmtPct(pe.part)} des ventes à l'étranger.`);
    if (pi) m.push(`Le premier poste d'importation est « ${pi.nom.toLowerCase()} », ${fmtPct(pi.part)} des achats.`);
    const ce = g?.pays.export[0], ci = g?.pays.import[0];
    if (ce) m.push(`${ce.nom} est le premier client du Sénégal, avec ${fmtPct(ce.part)} des exportations.`);
    if (ci) m.push(`${ci.nom} est le premier fournisseur, avec ${fmtPct(ci.part)} des importations.`);
    // Concentration : combien de partenaires font la moitié des ventes.
    if (g?.pays.export.length) {
      let c = 0, n = 0;
      for (const x of g.pays.export) { c += x.part ?? 0; n++; if (c >= 50) break; }
      if (c >= 50) m.push(`Les exportations sont concentrées : ${n} client${n > 1 ? "s" : ""} en absorbe${n > 1 ? "nt" : ""} la moitié.`);
    }
    const cont = g?.continents.slice().sort((a, b) => b.export - a.export)[0];
    // Tournure sans article, qui dépendrait du genre du continent.
    if (cont) m.push(`Premier débouché continental : ${cont.nom}, ${fmtPct(cont.part_export)} des exportations, pour une balance de ${fmtMd(cont.solde)} FCFA.`);
    return m.slice(0, 8);
  }, [r]);

  if (loading) return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={4} /><SkeletonRows n={12} h={32} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  if (!r?.disponible || !r.totaux || !r.geo || !r.produits) return (
    <div style={{ maxWidth: 720, margin: "80px auto", textAlign: "center", color: "#6b7684",
      fontFamily: "var(--font-google-sans)", fontSize: 14, lineHeight: 1.7 }}>
      Aucune donnée du commerce extérieur disponible.<br />
      Importez d&apos;abord les annexes de la NACE (<code>POST /nace/importer</code>).
    </div>
  );

  const t = r.totaux, p = r.precedent, serie = r.serie ?? [], geo = r.geo, prod = r.produits;
  const varDe = (v: number, prec: number | undefined) =>
    prec ? (v - prec) / Math.abs(prec) * 100 : null;
  const kpis = [
    { l: "Exportations", tag: "FAB", txt: `${fmtMd(t.export)} FCFA`, d: varDe(t.export, p?.export), rouge: false },
    { l: "Importations", tag: "CAF", txt: `${fmtMd(t.import)} FCFA`, d: varDe(t.import, p?.import), rouge: false },
    { l: "Balance commerciale", tag: "FAB − CAF", txt: `${fmtMd(t.solde)} FCFA`, d: null, rouge: t.solde < 0,
      sous: p ? `${fmtMd(p.solde)} FCFA en ${p.annee}` : null },
    { l: "Taux de couverture", tag: null, txt: fmtPct(t.couverture), d: null, rouge: false,
      sous: p ? `${fmtPct(p.couverture)} en ${p.annee}` : null },
  ];
  const NOMENCLATURES: { cle: keyof typeof prod; titre: string; note: string }[] = [
    { cle: "principaux", titre: "Principaux produits", note: "les postes phares du rapport" },
    { cle: "groupes", titre: "Groupes d'utilisation", note: "9 groupes exhaustifs — leur somme est le total" },
    { cle: "regroupes", titre: "Produits regroupés", note: "nomenclature détaillée de l'ANSD" },
    { cle: "chapitres", titre: "Chapitres du Système Harmonisé", note: "nomenclature douanière la plus fine" },
  ];

  return (
    <div style={{ fontFamily: "var(--font-google-sans)", background: "var(--ds-fond, #F7F6F5)", minHeight: "100vh" }}>
      <style>{`
        @keyframes rapIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .rap-in { animation: rapIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .rap-curseur { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px;
          background: rgba(255,255,255,0.28); outline: none; cursor: pointer; }
        .rap-curseur::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
          border-radius: 50%; background: #fff; border: none; box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: grab; }
        .rap-curseur::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: #fff;
          border: none; box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: grab; }
        @media (prefers-reduced-motion: reduce) { .rap-in { animation: none; } }
        @media print {
          nav, header, footer, .no-print { display: none !important; }
          body { background: #fff !important; }
          .rap-page { padding: 0 !important; }
          .rap-in { animation: none !important; }
          .ds-carte { box-shadow: none !important; border: 1px solid #E2E6EC !important; }
          [data-bandeau] { background: #003a6e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Bandeau exécutif ── */}
      <div data-bandeau style={{ background: "linear-gradient(155deg,#002a52 0%,#003a6e 35%,#004f91 70%,#1a6ab0 100%)", color: "#fff", padding: "34px 40px 90px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)", margin: "0 0 10px" }}>Rapport d&apos;analyse</p>
              <h1 style={{ fontSize: "1.95rem", fontWeight: 800, margin: 0, lineHeight: 1.14, letterSpacing: "-0.015em" }}>
                Le commerce extérieur du Sénégal
              </h1>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.78)", margin: "10px 0 0", fontWeight: 500 }}>
                Exportations FAB · Importations CAF · <b style={{ color: "#fff" }}>Année {t.annee}</b>
                {r.edition ? <> — source NACE {r.edition}</> : null}
              </p>
              {/* Curseur d'année : un rapport est un instantané, une seule
                  année pilote donc tout le document. */}
              <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
              {(r.annees?.length ?? 0) > 1 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>{r.annees![0]}</span>
                  <input type="range" min={r.annees![0]} max={r.annees![r.annees!.length - 1]} step={1} value={t.annee}
                    onChange={e => setAnnee(Number(e.target.value))}
                    className="rap-curseur" aria-label="Année du rapport" style={{ width: 240 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: BLEU, background: "#fff", padding: "4px 13px",
                    borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>{t.annee}</span>
                </div>
              )}
                <button onClick={imprimer} title="Imprimer ou enregistrer en PDF"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.12)", color: "#fff",
                    cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap" }}>
                  <Printer size={14} /> Imprimer
                </button>
              </div>
            </div>
            <div className="no-print" style={{ flexShrink: 0 }}>
              <NavActions onDark home flouTotal />
            </div>
          </div>
        </div>
      </div>

      <div key={t.annee} className="rap-page rap-in" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 40px 70px" }}>
        {/* ── KPIs chevauchant le bandeau ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 13, marginTop: -54 }}>
          {kpis.map(k => (
            <div key={k.l} className="ds-carte" style={{ padding: "17px 19px", boxShadow: "var(--ombre-2)", breakInside: "avoid" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9, flexWrap: "wrap" }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", color: BLEU, textTransform: "uppercase", margin: 0 }}>{k.l}</p>
                {k.tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: GRIS, background: "#EEF1F6", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{k.tag}</span>}
              </div>
              <p className="ds-donnee" style={{ fontSize: "1.55rem", fontWeight: 800, color: k.rouge ? ROUGE : ENCRE,
                margin: 0, lineHeight: 1.1, whiteSpace: "nowrap" }}>{k.txt}</p>
              <div style={{ marginTop: 7, minHeight: 15, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {k.d != null && <><Delta v={k.d} /><span style={{ fontSize: 10, color: "#9aa5b4" }}>vs {p?.annee}</span></>}
                {"sous" in k && k.sous && <span style={{ fontSize: 10, color: "#9aa5b4" }}>{k.sous}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── À retenir ── */}
        {aRetenir.length > 0 && (
          <div className="ds-carte" style={{ marginTop: 18, padding: "20px 24px", breakInside: "avoid",
            background: "linear-gradient(180deg, rgba(0,79,145,0.05), rgba(0,79,145,0.02))", border: "1px solid rgba(0,79,145,0.14)" }}>
            <p style={TITRE_SEC}>À retenir</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "10px 28px" }}>
              {aRetenir.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: BLEU, marginTop: 6.5, flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: "#2c3646", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 01 · Évolution ── */}
        <EnTeteChapitre n={1} titre="Évolution des échanges"
          note={`${serie[0]?.annee} à ${serie[serie.length - 1]?.annee}`} />
        <Carte padding="20px 22px 12px">
          <GrapheSignature height={260} type="line" dualAxis={false}
            fmt={(v: number | null) => v == null ? "—" : `${fmtMd(v)} FCFA`}
            series={[
              { nom: "Exportations", couleur: BLEU, data: serie.map(s => ({ annee: s.annee, valeur: s.export })) },
              { nom: "Importations", couleur: ORANGE, data: serie.map(s => ({ annee: s.annee, valeur: s.import })) },
              { nom: "Balance", couleur: ROUGE, dash: "6,4", data: serie.map(s => ({ annee: s.annee, valeur: s.solde })) },
            ]} />
        </Carte>
        <div style={{ marginTop: 14 }}>
          <Carte>
            <p style={TITRE_SEC}>Série annuelle <span style={{ color: GRIS, letterSpacing: "0.06em" }}>· valeurs en FCFA, poids en tonnes</span></p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <Th>Année</Th><Th droite>Export</Th><Th droite>Import</Th><Th droite>Balance</Th>
                <Th droite>Couverture</Th><Th droite>Export (poids)</Th><Th droite>Import (poids)</Th>
              </tr></thead>
              <tbody>
                {serie.map((s, i) => {
                  const courant = s.annee === t.annee;
                  return (
                    <tr key={s.annee} style={{ background: courant ? "rgba(0,79,145,0.07)" : i % 2 ? "rgba(15,40,80,0.018)" : "transparent" }}>
                      <Td gras={courant}>{s.annee}</Td>
                      <Td droite couleur={BLEU} gras>{fmtMd(s.export)}</Td>
                      <Td droite couleur={ORANGE} gras>{fmtMd(s.import)}</Td>
                      <Td droite><Solde v={s.solde} /></Td>
                      <Td droite couleur="#4a5568">{fmtPct(s.couverture)}</Td>
                      <Td droite couleur="#4a5568">{fmtT(s.export_poids)}</Td>
                      <Td droite couleur="#4a5568">{fmtT(s.import_poids)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Carte>
        </div>

        {/* ── 02 · Produits, une section par nomenclature ── */}
        <EnTeteChapitre n={2} titre="Structure par produit"
          note="quatre nomenclatures de l'ANSD, de la plus synthétique à la plus fine" />
        {NOMENCLATURES.map(({ cle, titre, note }) => {
          const f = prod[cle];
          if (!f?.export.length && !f?.import.length) return null;
          return (
            <div key={cle} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: ENCRE, margin: 0 }}>{titre}</h3>
                <span style={{ fontSize: 11, color: GRIS, fontWeight: 600 }}>
                  {note} · {f.modalites.export} postes à l&apos;export, {f.modalites.import}{" "}à l&apos;import
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14 }}>
                <Classement titre="Exportations" lignes={f.export} couleur={BLEU} reste={f.reste?.export} />
                <Classement titre="Importations" lignes={f.import} couleur={ORANGE} reste={f.reste?.import} />
              </div>
            </div>
          );
        })}

        {/* ── 03 · Géographie ── */}
        <EnTeteChapitre n={3} titre="Orientation géographique"
          note="du continent au pays partenaire" />
        <div style={{ display: "grid", gap: 14 }}>
          <TableauZones titre="Échanges par continent" zones={geo.continents}
            note="6 zones exhaustives, « Divers » comprise" />
          <TableauZones titre="Échanges par région" zones={geo.regions}
            note="sous-totaux du rapport, 12 zones" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginTop: 14 }}>
          <Classement titre="Premiers clients du Sénégal" lignes={geo.pays.export} couleur={BLEU} drapeaux />
          <Classement titre="Premiers fournisseurs du Sénégal" lignes={geo.pays.import} couleur={ORANGE} drapeaux />
        </div>

        {/* ── 04 · Partenaires dans chaque continent ── */}
        <EnTeteChapitre n={4} titre="Partenaires par continent"
          note="parts calculées sur le continent, non sur le total mondial" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14 }}>
          {geo.par_continent.map(c => (
            <Carte key={c.continent}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <p style={{ ...TITRE_SEC, margin: 0 }}>{c.continent}</p>
                <span style={{ fontSize: 11, color: GRIS, fontWeight: 600, whiteSpace: "nowrap" }}>
                  <b style={{ color: BLEU }}>{fmtMd(c.export)}</b> export · <b style={{ color: ORANGE }}>{fmtMd(c.import)}</b> import
                </span>
              </div>
              {/* Clients et fournisseurs empilés plutôt que côte à côte : sur une
                  carte de demi-page, deux colonnes ne laissaient qu'une centaine
                  de pixels au nom, qui se tronquait dès « Émirats arabes unis ». */}
              <div style={{ display: "grid", gap: 14 }}>
                {([{ l: "Clients", lignes: c.clients, coul: BLEU }, { l: "Fournisseurs", lignes: c.fournisseurs, coul: ORANGE }]).map(bloc => (
                  <div key={bloc.l}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: GRIS, letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 7px" }}>{bloc.l}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {bloc.lignes.length === 0 && <span style={{ fontSize: 11.5, color: GRIS }}>Aucun échange.</span>}
                      {bloc.lignes.map((x, i) => (
                        <div key={x.nom} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <Pastille n={i + 1} couleur={bloc.coul} />
                          <Drapeau iso={x.iso2} nom={x.nom} />
                          <span title={x.nom} style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 650, color: ENCRE,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nom}</span>
                          <span className="ds-donnee" style={{ fontSize: 11, fontWeight: 800, color: bloc.coul, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtMd(x.valeur)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", width: 40, textAlign: "right", whiteSpace: "nowrap" }}>{fmtPct(x.part, 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Carte>
          ))}
        </div>

        {/* ── Pied méthodologique ── */}
        <div style={{ marginTop: 26, padding: "16px 4px 0", borderTop: "1px solid #E2E6EC",
          display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <p style={{ fontSize: 10.5, color: GRIS, margin: 0, lineHeight: 1.65, maxWidth: 760 }}>
            <b style={{ color: "#5c6675" }}>Source :</b> ANSD — Note d&apos;Analyse du Commerce Extérieur, annexes des
            éditions {r.annees?.[0] != null ? `couvrant ${r.annees![0]}–${r.annees![r.annees!.length - 1]}` : ""}.
            Chaque édition couvre cinq années et peut réviser les précédentes ; l&apos;année affichée est lue dans
            l&apos;édition la plus récente qui la couvre{r.edition ? ` (ici NACE ${r.edition})` : ""}.
            <br />
            <b style={{ color: "#5c6675" }}>Lecture :</b> exportations en valeur FAB, importations en valeur CAF.
            Les partenaires absents du référentiel — territoires d&apos;outre-mer, régions administratives spéciales,
            entités disparues — sont regroupés sous « Autres pays » de leur région et exclus des classements par pays ;
            la ligne « Divers » du rapport (provisions de bord, or monétaire, origines non déterminées) n&apos;est pas
            un continent et n&apos;apparaît donc pas dans les partenaires par continent.
          </p>
          <p style={{ fontSize: 10.5, color: GRIS, margin: 0, whiteSpace: "nowrap" }}>
            Édité le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
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
