// Investissements au Sénégal — ce que le pays partenaire investit, ou compte
// investir, au Sénégal (fDi Markets). Les deux rubriques du site :
//
//   · LES PROJETS d'investissement du partenaire au Sénégal ;
//   · SES SIGNAUX d'investissement, qui visent le Sénégal, l'Afrique de
//     l'Ouest ou l'Afrique.
//
// Le site les dresse en tableaux de sept colonnes, triables. Un téléphone
// n'en garde que l'essentiel, en listes d'iOS : le rang, le nom, le mois de
// l'annonce, le montant — la capsule du haut choisit l'ordre, cinq lignes puis
// la suite. Le secteur, l'activité, les destinations se lisent dans la fiche
// du projet ou du signal, celle des Investissements projetés, qu'ouvre le
// toucher.
//
// LA SECTION N'EXISTE QUE POUR UNE FICHE « SÉNÉGAL × X » : les relevés fDi
// ont été constitués du point de vue du Sénégal (voir le service
// fdi_fiche_pays) ; une fiche Mali × France n'a rien à en dire.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Chevron, Groupe, Ligne, SegmentsCapsule } from "@/components/ListeIOS";
import { SeparateurSection } from "@/components/ui";
import { FicheProjetFdi, FicheSignal } from "@/components/fdi/FichesFdi";
import { Rubrique, Suite, type PaysFiche } from "@/components/fichePays/AtomesFiche";
import { creerStyles } from "@/lib/apparence";
import { type ProjetFdi, type Signal, accorder, fmtEntier, moisEnClair } from "@/lib/fdi";
import { fmtMillionsUSD } from "@/lib/format";
import { auPays } from "@/lib/pays";
import { ECHELLE, FONTE, T } from "@/theme";

/** Les lignes montrées d'emblée — un écran de téléphone, pas un tableau. */
const FENETRE = 5;

type TriProjets = "capex_musd" | "emplois";
type TriSignaux = "capex_musd" | "funding_musd";

const TRIS_PROJETS: { cle: TriProjets; label: string }[] = [
  { cle: "capex_musd", label: "Montant" },
  { cle: "emplois", label: "Emplois" },
];
const TRIS_SIGNAUX: { cle: TriSignaux; label: string }[] = [
  { cle: "capex_musd", label: "Montant" },
  { cle: "funding_musd", label: "Fonds levés" },
];

/** Le tri des listes, celui des tableaux du site : décroissant, et LES
    VALEURS MANQUANTES EN QUEUE — un signal dont on ignore le montant n'en
    annonce pas zéro. */
function trier<E>(lignes: E[], cle: keyof E): E[] {
  return [...lignes].sort((a, b) => {
    const x = a[cle] as number | null, y = b[cle] as number | null;
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x;
  });
}

/** Un montant de ligne, en millions de dollars : « 412 M $ », « ≈ 1,2 Md $ ». */
const montant = (v: number | null, estime: boolean | null): string | null =>
  v == null ? null : `${estime ? "≈ " : ""}${fmtMillionsUSD(v)}`;

/** Une ligne de liste : le rang (il suit l'ordre affiché), le nom, le mois de
    l'annonce dessous, la valeur du tri au bout, puis le chevron de la fiche. */
function LigneFdi({ rang, titre, legende, valeur, onPress }: {
  rang: number; titre: string; legende: string; valeur: string | null; onPress: () => void;
}) {
  return (
    <Ligne label={titre} legende={legende} lignes={1} onPress={onPress}
      avant={<Text style={s.rang} maxFontSizeMultiplier={ECHELLE.compact}>{rang}</Text>}
      accessoire={
        <View style={s.bout}>
          {valeur ? <Text style={s.valeur} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.chiffre}>{valeur}</Text> : null}
          <Chevron />
        </View>
      } />
  );
}

function ListeProjets({ projets, onOuvrir }: { projets: ProjetFdi[]; onOuvrir: (p: ProjetFdi) => void }) {
  const [tri, setTri] = useState<TriProjets>("capex_musd");
  const [tout, setTout] = useState(false);
  const lignes = useMemo(() => trier(projets, tri), [projets, tri]);
  return (
    <>
      {projets.length > 3 && (
        <View style={s.tri}>
          <SegmentsCapsule compact options={TRIS_PROJETS} valeur={tri} onChange={c => setTri(c as TriProjets)} />
        </View>
      )}
      <Groupe>
        {(tout ? lignes : lignes.slice(0, FENETRE)).map((p, i) => (
          <LigneFdi key={p.id} rang={i + 1} titre={p.entreprise ?? "—"} legende={moisEnClair(p.periode)}
            valeur={tri === "emplois"
              ? (p.emplois == null ? null : `${p.emplois_estime ? "≈ " : ""}${fmtEntier(p.emplois)} ${accorder(p.emplois, "emploi")}`)
              : montant(p.capex_musd, p.capex_estime)}
            onPress={() => onOuvrir(p)} />
        ))}
        <Suite reste={lignes.length - FENETRE} tout={tout} onPress={() => setTout(v => !v)} />
      </Groupe>
    </>
  );
}

function ListeSignaux({ signaux, onOuvrir }: { signaux: Signal[]; onOuvrir: (s: Signal) => void }) {
  const [tri, setTri] = useState<TriSignaux>("capex_musd");
  const [tout, setTout] = useState(false);
  const lignes = useMemo(() => trier(signaux, tri), [signaux, tri]);
  return (
    <>
      {signaux.length > 3 && (
        <View style={s.tri}>
          <SegmentsCapsule compact options={TRIS_SIGNAUX} valeur={tri} onChange={c => setTri(c as TriSignaux)} />
        </View>
      )}
      <Groupe>
        {(tout ? lignes : lignes.slice(0, FENETRE)).map((sg, i) => (
          <LigneFdi key={sg.id} rang={i + 1} titre={sg.entreprise ?? "—"} legende={moisEnClair(sg.periode)}
            valeur={tri === "funding_musd" ? montant(sg.funding_musd, sg.funding_estime) : montant(sg.capex_musd, sg.capex_estime)}
            onPress={() => onOuvrir(sg)} />
        ))}
        <Suite reste={lignes.length - FENETRE} tout={tout} onPress={() => setTout(v => !v)} />
      </Groupe>
    </>
  );
}

export default function FdiSenegal({ senegal, projets, signaux }: {
  senegal: PaysFiche; projets: ProjetFdi[]; signaux: Signal[];
}) {
  const [projet, setProjet] = useState<ProjetFdi | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  if (!projets.length && !signaux.length) return null;

  // Ni le sens ni les totaux ne se répètent ici : les chiffres de tête de la
  // fiche les disent déjà (« France → Sénégal », le montant, les emplois)
  return (
    <View>
      <SeparateurSection titre={`INVESTISSEMENTS ${auPays(senegal.nom).toUpperCase()}`} couleur={T.bleu as string} />

      {projets.length > 0 && (
        <View style={s.premiere}>
          <Rubrique sf="building.2" materiel="apartment" titre="Projets d'investissement" compte={projets.length} />
          <ListeProjets projets={projets} onOuvrir={setProjet} />
        </View>
      )}

      {signaux.length > 0 && (
        <View style={projets.length > 0 ? s.rubrique : s.premiere}>
          <Rubrique sf="dot.radiowaves.left.and.right" materiel="radar" titre="Signaux d'investissement" compte={signaux.length} />
          <ListeSignaux signaux={signaux} onOuvrir={setSignal} />
        </View>
      )}

      {projet && <FicheProjetFdi p={projet} onClose={() => setProjet(null)} />}
      {signal && <FicheSignal s={signal} onClose={() => setSignal(null)} />}
    </View>
  );
}

const s = creerStyles(() => ({
  premiere: { marginTop: 4 },
  rubrique: { marginTop: 20 },
  tri: { marginBottom: 10 },
  rang: { fontSize: 13, ...FONTE.demi, color: T.gris, fontVariant: ["tabular-nums"], textAlign: "center" },
  bout: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, maxWidth: "48%" },
  valeur: { flexShrink: 1, fontSize: 14, ...FONTE.demi, color: T.encre, fontVariant: ["tabular-nums"] },
}));
