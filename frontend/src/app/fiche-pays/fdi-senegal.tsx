"use client";

// fDi Markets dans la Fiche Pays — ce que le pays partenaire investit, ou
// compte investir, au Sénégal. Deux tableaux, repris des vues Projets et
// Signaux de la page Investissements privés, au dessin des tableaux du
// rapport : rang, colonnes triables, dix lignes puis « Afficher la suite ».
//
// LA SECTION N'EXISTE QUE POUR UNE FICHE « SÉNÉGAL × X ». Les relevés fDi ont
// été constitués du point de vue du Sénégal ; une fiche Mali × France n'a
// rien à en dire, et la page n'appelle même pas le service.

import { useMemo, useState } from "react";
import { ArrowRight, Building2, Radar } from "lucide-react";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { BoutonSuite, CEL, ENT_RAP, EnteteTri, FENETRE_RAPPORT, fmtNombre, fmtVal,
         PastilleRang } from "@/app/ide/partage";
import { FicheProjet, PastilleType, type Projet } from "@/app/ide/onglet-fdi";
import { FicheSignal, PastilleStade, type Signal } from "@/app/ide/vue-signaux-publics";
import { fmtUSD } from "@/lib/format";

const BLEU = "var(--bleu)";

/** Bandeau de rubrique — icône dans un carré voilé, capitales bleues, filet
    jusqu'au bord. Le même que celui des rubriques du tableau comparatif et des
    échanges bilatéraux : toute la fiche se découpe de la même façon. */
export function Rubrique({ Icone, titre, compte, children }: {
  Icone: any; titre: string; compte?: number; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "26px 0 14px", flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 7, alignItems: "center",
        justifyContent: "center", background: "var(--bleu-voile)", color: BLEU, flexShrink: 0 }}>
        <Icone size={13} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: BLEU, letterSpacing: "0.12em", textTransform: "uppercase" }}>{titre}</span>
      {compte != null && (
        <span style={{ fontSize: 10, fontWeight: 800, color: BLEU, background: "rgb(var(--bleu-rgb) / 0.14)",
          padding: "1px 8px", borderRadius: 999 }}>{compte}</span>
      )}
      <span style={{ flex: 1, height: 1, background: "var(--filet)", marginLeft: 6, minWidth: 20 }} />
      {children}
    </div>
  );
}

type Sens = "asc" | "desc";

/** Le tri des deux tableaux : clic sur une colonne = décroissant, second clic
    = croissant. LES VALEURS MANQUANTES RESTENT EN QUEUE dans les deux sens —
    un signal dont on ignore le montant n'en annonce pas zéro. La période
    (« AAAA-MM ») se compare comme un texte, le reste comme des nombres. */
function useTri<T, K extends keyof T>(rows: T[], defaut: K) {
  const [col, setCol] = useState<K>(defaut);
  const [sens, setSens] = useState<Sens>("desc");
  const trierPar = (c: K) => {
    if (c === col) setSens(s => (s === "desc" ? "asc" : "desc"));
    else { setCol(c); setSens("desc"); }
  };
  const lignes = useMemo(() => [...rows].sort((a, b) => {
    const x = a[col] as unknown, y = b[col] as unknown;
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const d = typeof x === "string" || typeof y === "string"
      ? String(x).localeCompare(String(y)) : (x as number) - (y as number);
    return sens === "desc" ? -d : d;
  }), [rows, col, sens]);
  return { lignes, col, sens, trierPar };
}

/** Une ligne cliquable : elle ouvre la fiche du projet ou du signal — la même
    que dans les vues de la page Investissements privés. */
function survolLigne(ouvrir: () => void) {
  return {
    onClick: ouvrir, role: "button" as const, tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
    },
    onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.04)"; },
    onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "transparent"; },
    style: { cursor: "pointer", transition: "background .12s" },
  };
}

const chiffre = (actif: boolean) => ({ ...CEL, textAlign: "right" as const, whiteSpace: "nowrap" as const,
  fontVariantNumeric: "tabular-nums" as const, fontWeight: actif ? 800 : undefined,
  color: actif ? "var(--vert)" : undefined });

/** Le « ≈ » d'une valeur estimée par le Financial Times — ligne à ligne, comme
    dans le rapport : chaque montant est déclaré ou estimé, on peut le dire. */
const Approx = ({ si }: { si: boolean | null | undefined }) =>
  si ? <span style={{ fontWeight: 800 }}>≈ </span> : null;

// Le NOM tient sur une ligne (coupé au besoin, entier dans l'infobulle) : c'est
// par lui qu'on parcourt la colonne. Secteur et activité, eux, passent à la
// ligne — les couper rendrait « Logistique, distribution et… » illisible, et
// les garder sur une ligne poussait la période hors du cadre.
const NOM = { ...CEL, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const };
const TEXTE = { ...CEL, minWidth: 120, lineHeight: 1.35 };

// ── Projets ─────────────────────────────────────────────────────────────────

const COLS_PROJET = [
  { cle: "capex_musd", libelle: "Montant" },
  { cle: "emplois", libelle: "Emplois" },
  { cle: "periode", libelle: "Période" },
] as const;

function TableauProjets({ rows, onOuvrir }: { rows: Projet[]; onOuvrir: (p: Projet) => void }) {
  const { lignes, col, sens, trierPar } = useTri(rows, "capex_musd" as keyof Projet);
  const [tout, setTout] = useState(false);
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...ENT_RAP, width: 34, textAlign: "left" }}>#</th>
              {["Entreprise", "Type", "Secteur", "Activité"].map(t => (
                <th key={t} style={{ ...ENT_RAP, textAlign: "left" }}>{t}</th>
              ))}
              {COLS_PROJET.map(c => (
                <EnteteTri key={c.cle} libelle={c.libelle} sens={sens}
                  actif={col === c.cle} onClick={() => trierPar(c.cle)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(tout ? lignes : lignes.slice(0, FENETRE_RAPPORT)).map((p, i) => (
              <tr key={p.id} {...survolLigne(() => onOuvrir(p))}>
                {/* LE RANG SUIT LE TRI : il dit la place dans l'ordre qu'on a
                    sous les yeux. */}
                <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                <td style={{ ...NOM, fontWeight: 600, color: "var(--encre)" }} title={p.entreprise ?? undefined}>{p.entreprise ?? "—"}</td>
                <td style={CEL}><PastilleType type={p.type_projet} /></td>
                <td style={TEXTE}>{p.secteur ?? "—"}</td>
                <td style={TEXTE}>{p.activite ?? "—"}</td>
                <td style={chiffre(col === "capex_musd")}><Approx si={p.capex_estime} />{fmtVal(p.capex_musd)}</td>
                <td style={chiffre(col === "emplois")}><Approx si={p.emplois_estime} />{p.emplois == null ? "—" : fmtNombre(p.emplois)}</td>
                <td style={chiffre(col === "periode")}>{p.periode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BoutonSuite reste={lignes.length - FENETRE_RAPPORT} tout={tout} onBasculer={() => setTout(v => !v)} />
    </>
  );
}

// ── Signaux ─────────────────────────────────────────────────────────────────

const COLS_SIGNAL = [
  { cle: "capex_musd", libelle: "Investissement" },
  { cle: "funding_musd", libelle: "Fonds levés" },
  { cle: "periode", libelle: "Période" },
] as const;

function TableauSignaux({ rows, onOuvrir }: { rows: Signal[]; onOuvrir: (s: Signal) => void }) {
  const { lignes, col, sens, trierPar } = useTri(rows, "capex_musd" as keyof Signal);
  const [tout, setTout] = useState(false);
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...ENT_RAP, width: 34, textAlign: "left" }}>#</th>
              {["Entreprise", "Stade", "Destination"].map(t => (
                <th key={t} style={{ ...ENT_RAP, textAlign: "left" }}>{t}</th>
              ))}
              {COLS_SIGNAL.map(c => (
                <EnteteTri key={c.cle} libelle={c.libelle} sens={sens}
                  actif={col === c.cle} onClick={() => trierPar(c.cle)} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(tout ? lignes : lignes.slice(0, FENETRE_RAPPORT)).map((s, i) => {
              const dest = s.destinations;
              return (
                <tr key={s.id} {...survolLigne(() => onOuvrir(s))}>
                  <td style={{ ...CEL, padding: "8px 10px" }}><PastilleRang n={i + 1} /></td>
                  <td style={{ ...NOM, fontWeight: 600, color: "var(--encre)" }} title={s.entreprise ?? undefined}>{s.entreprise ?? "—"}</td>
                  <td style={CEL}>{s.natures[0] ? <PastilleStade v={s.natures[0]} /> : "—"}</td>
                  {/* LA DESTINATION LA PLUS PROCHE D'ABORD — le Sénégal, puis
                      l'Afrique de l'Ouest, puis le continent : le service les
                      range ainsi. Les autres restent comptées, et l'infobulle
                      les nomme toutes. */}
                  <td style={{ ...CEL, whiteSpace: "nowrap" }} title={dest.map(v => v.libelle).join(" · ")}>
                    {dest.length === 0 ? "—" : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {dest[0].libelle}
                        {dest.length > 1 && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: BLEU,
                            background: "rgb(var(--bleu-rgb) / 0.10)", borderRadius: 999, padding: "1px 7px" }}>
                            +{dest.length - 1}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td style={chiffre(col === "capex_musd")}><Approx si={s.capex_estime} />{s.capex_musd == null ? "—" : fmtVal(s.capex_musd)}</td>
                  <td style={chiffre(col === "funding_musd")}><Approx si={s.funding_estime} />{s.funding_musd == null ? "—" : fmtVal(s.funding_musd)}</td>
                  <td style={chiffre(col === "periode")}>{s.periode}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <BoutonSuite reste={lignes.length - FENETRE_RAPPORT} tout={tout} onBasculer={() => setTout(v => !v)} />
    </>
  );
}

// ── La section ──────────────────────────────────────────────────────────────

/** Le résumé d'une rubrique, à droite de son titre : ce que le tableau
    contient, en une ligne. Les sommes portent l'astérisque des rapports — elles
    mêlent montants déclarés et estimés. */
const Resume = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 11.5, color: "var(--gris)", fontVariantNumeric: "tabular-nums" }}>{children}</span>
);

export default function FdiSenegal({ partenaire, senegal, donnees }: {
  partenaire: { nom: string; code_iso2?: string | null };
  senegal: { nom: string; code_iso2?: string | null };
  donnees: { projets: Projet[]; signaux: Signal[] };
}) {
  const [projet, setProjet] = useState<Projet | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const { projets, signaux } = donnees;
  if (!projets.length && !signaux.length) return null;

  const somme = (l: (number | null)[]) => l.reduce<number>((t, v) => t + (v ?? 0), 0);
  const capex = somme(projets.map(p => p.capex_musd));
  const emplois = somme(projets.map(p => p.emplois));

  return (
    <div className="ds-carte" style={{ marginTop: 18, padding: "22px 26px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: BLEU, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
          Investissements au {senegal.nom}
          <span style={{ color: "var(--gris)", letterSpacing: "0.06em" }}> · fDi Markets</span>
        </p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700,
          color: "var(--encre)", background: "var(--carte-douce)", border: "1px solid var(--filet)",
          borderRadius: 999, padding: "5px 12px" }}>
          <DrapeauPays iso={partenaire.code_iso2} nom={partenaire.nom} taille={14} sansIso="rien" />
          {partenaire.nom}
          <ArrowRight size={12} style={{ color: "var(--gris)" }} />
          <DrapeauPays iso={senegal.code_iso2} nom={senegal.nom} taille={14} sansIso="rien" />
          {senegal.nom}
        </span>
      </div>

      {projets.length > 0 && (
        <>
          <Rubrique Icone={Building2} titre="Projets d'investissement" compte={projets.length}>
            <Resume>{capex > 0 && <>{fmtUSD(capex * 1e6)}*</>}{capex > 0 && emplois > 0 && " · "}{emplois > 0 && <>{fmtNombre(emplois)} emplois*</>}</Resume>
          </Rubrique>
          <TableauProjets rows={projets} onOuvrir={setProjet} />
        </>
      )}

      {signaux.length > 0 && (
        <>
          <Rubrique Icone={Radar} titre="Signaux d'investissement" compte={signaux.length}>
            <Resume>visant le {senegal.nom}, l&apos;Afrique de l&apos;Ouest ou l&apos;Afrique</Resume>
          </Rubrique>
          <TableauSignaux rows={signaux} onOuvrir={setSignal} />
        </>
      )}

      <p style={{ fontSize: 10.5, color: "var(--gris)", margin: "14px 2px 0", lineHeight: 1.6 }}>
        ≈ et * : comprend des valeurs estimées par l&apos;algorithme du Financial Times, non déclarées par l&apos;entreprise.
      </p>

      {projet && <FicheProjet p={projet} onClose={() => setProjet(null)} />}
      {signal && <FicheSignal s={signal} onClose={() => setSignal(null)} />}
    </div>
  );
}
