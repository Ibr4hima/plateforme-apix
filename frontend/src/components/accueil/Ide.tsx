"use client";

// Les investissements directs étrangers du Sénégal — sous la vedette et les
// signaux, sur les deux mêmes colonnes, juste au-dessus des investissements
// annoncés. À gauche, deux chiffres (le plus haut flux entrant jamais reçu et
// son année, le flux net de la dernière année connue dans les deux sens),
// puis le classement de l'Afrique occidentale ; à droite, l'un sous l'autre,
// ceux de la CEDEAO et de l'UEMOA. Les cartes mêmes du tableau de bord, à
// leur taille.
//
// Les séries sont celles de la vedette, les classements ceux du tableau de
// bord : mêmes adresses, même cache.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useDonnees } from "@/lib/donnees";
import { fmtMillionsUSD } from "@/lib/format";
import KpiCarte from "@/components/shared/KpiCarte";
import TableauZoneSenegal, { ZONES_SEN, type LigneTopZone } from "@/components/shared/ClassementZone";
import { useFluxIde, type Point } from "@/components/accueil/Vedette";

type Groupement = { code: string; nom_fr: string; categorie: string };
type Classement = { tops?: { entrant: LigneTopZone[]; sortant: LigneTopZone[] } };
type Zone = (typeof ZONES_SEN)[number];

const zone = (cle: string) => ZONES_SEN.find(z => z.cle === cle)!;
const AFRIQUE_OUEST = zone("afrique_ouest"), CEDEAO = zone("cedeao"), UEMOA = zone("uemoa");

/** Le classement d'un groupement à l'année des flux, avec sa propre bascule
    entrants / sortants, comme au tableau de bord. Il prend la hauteur que lui
    laisse sa colonne : les deux colonnes finissent ainsi à la même ligne. */
function ClassementGroupement({ zone, groupements, annee, enAttente, top }: {
  zone: Zone; groupements: Groupement[] | undefined; annee: number | null; enAttente: boolean; top?: number;
}) {
  const [dir, setDir] = useState<"entrant" | "sortant">("entrant");
  const grp = useMemo(() => (Array.isArray(groupements) ? groupements : []).find(zone.trouve) ?? null, [groupements, zone]);
  const q = useDonnees<Classement>(grp && annee != null
    ? `${API}/ide/monde/global?indicateur=flux&code=${encodeURIComponent(grp.code)}&annees=${annee}` : null);
  return (
    <TableauZoneSenegal titre={zone.titre} nomComplet={grp?.nom_fr} tag={annee != null ? String(annee) : undefined}
      rows={q.data?.tops?.[dir] ?? []} chargement={enAttente || (grp != null && annee != null && q.isPending)}
      dir={dir} onDir={setDir} top={top} etire />
  );
}

export default function Ide() {
  const { entrants, sortants, qEnt } = useFluxIde();

  // Le pic : la plus haute valeur de toute la série, et son année
  const pic = useMemo(() => entrants.reduce<Point | null>((m, p) => (!m || p.valeur > m.valeur ? p : m), null), [entrants]);
  // Les flux nets, sur les seules années où les DEUX sens sont connus :
  // soustraire une valeur manquante reviendrait à la compter pour zéro
  const nets = useMemo(() => {
    const sort = new Map(sortants.map(p => [p.annee, p.valeur]));
    return entrants.filter(p => sort.has(p.annee)).map(p => ({ annee: p.annee, valeur: p.valeur - sort.get(p.annee)! }));
  }, [entrants, sortants]);
  const net = nets.at(-1) ?? null, netAvant = nets.length > 1 ? nets[nets.length - 2] : null;
  const deltaNet = net && netAvant && netAvant.valeur ? ((net.valeur - netAvant.valeur) / Math.abs(netAvant.valeur)) * 100 : null;

  // Les classements, à la dernière année des flux. Les groupements donnent
  // les codes, la série l'année : tant qu'ils chargent, les tableaux attendent
  const qGrp = useDonnees<Groupement[]>(`${API}/ide/monde/groupements`);
  const annee = entrants.at(-1)?.annee ?? null;
  const classement = { groupements: qGrp.data, annee, enAttente: qGrp.isPending || qEnt.isPending };

  return (
    <section className="acc-cadre acc-section">
      <div className="acc-section-tete">
        <h2 className="acc-h2">Investissements directs étrangers</h2>
        <Link href="/ide" className="acc-lien">Investissements privés <ArrowRight size={14} /></Link>
      </div>
      {/* Les colonnes de la vedette et des signaux : à gauche les deux
          chiffres, à la taille de ceux du tableau de bord, puis l'Afrique
          occidentale (top 10) ; à droite la CEDEAO (top 5) puis l'UEMOA
          (top 4), plus le Sénégal — ou le pays suivant s'il y est déjà. Ces
          nombres font finir les deux colonnes presque à la même ligne ; le
          reste, quelques pixels, se répartit entre les lignes de la colonne
          la plus courte. */}
      <div className="acc-ide">
        <div className="acc-ide-colonne">
          <div className="acc-ide-kpis">
            <KpiCarte label="Maximum flux entrants" tag={pic ? String(pic.annee) : undefined}
              valeur={fmtMillionsUSD(pic?.valeur)}
              sousLabel={qEnt.isPending ? undefined : entrants.length ? `Plus haut niveau depuis ${entrants[0].annee}` : "Données indisponibles"} />
            <KpiCarte label="Flux nets" tag={net ? String(net.annee) : undefined}
              valeur={fmtMillionsUSD(net?.valeur)} delta={deltaNet} refAnnee={netAvant?.annee}
              sousLabel={net && deltaNet == null ? "Flux entrants moins flux sortants" : undefined} />
          </div>
          <ClassementGroupement zone={AFRIQUE_OUEST} {...classement} />
        </div>
        <div className="acc-ide-colonne">
          <ClassementGroupement zone={CEDEAO} top={5} {...classement} />
          <ClassementGroupement zone={UEMOA} top={4} {...classement} />
        </div>
      </div>
    </section>
  );
}
