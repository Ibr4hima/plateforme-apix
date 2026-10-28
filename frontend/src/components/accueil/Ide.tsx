"use client";

// Les investissements directs étrangers du Sénégal — juste au-dessus des
// investissements annoncés : deux chiffres, puis la place du Sénégal dans son
// groupement. Le plus haut flux entrant jamais reçu (et son année), le flux
// net de la dernière année connue dans les deux sens, et le classement de
// l'Afrique occidentale — les cartes mêmes du tableau de bord.
//
// Les séries sont celles de la vedette, le classement celui du tableau de
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

const ZONE = ZONES_SEN.find(z => z.cle === "afrique_ouest")!;

export default function Ide() {
  const { entrants, sortants, qEnt } = useFluxIde();
  const [dir, setDir] = useState<"entrant" | "sortant">("entrant");

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

  // Le classement de l'Afrique occidentale, à la dernière année des flux
  const qGrp = useDonnees<Groupement[]>(`${API}/ide/monde/groupements`);
  const grp = useMemo(() => (Array.isArray(qGrp.data) ? qGrp.data : []).find(ZONE.trouve) ?? null, [qGrp.data]);
  const annee = entrants.at(-1)?.annee ?? null;
  const qClass = useDonnees<Classement>(grp && annee != null
    ? `${API}/ide/monde/global?indicateur=flux&code=${encodeURIComponent(grp.code)}&annees=${annee}` : null);

  return (
    <section className="acc-cadre acc-section">
      <div className="acc-section-tete">
        <h2 className="acc-h2">Investissements directs étrangers</h2>
        <Link href="/ide" className="acc-lien">Investissements privés <ArrowRight size={14} /></Link>
      </div>
      <div className="acc-ide-kpis">
        <KpiCarte label="Maximum flux entrants" tag={pic ? String(pic.annee) : undefined}
          valeur={fmtMillionsUSD(pic?.valeur)}
          sousLabel={qEnt.isPending ? undefined : entrants.length ? `Plus haut niveau depuis ${entrants[0].annee}` : "Données indisponibles"} />
        <KpiCarte label="Flux nets" tag={net ? String(net.annee) : undefined}
          valeur={fmtMillionsUSD(net?.valeur)} delta={deltaNet} refAnnee={netAvant?.annee}
          sousLabel={net && deltaNet == null ? "Flux entrants moins flux sortants" : undefined} />
      </div>
      <TableauZoneSenegal titre={ZONE.titre} nomComplet={grp?.nom_fr} tag={annee != null ? String(annee) : undefined}
        rows={qClass.data?.tops?.[dir] ?? []} chargement={!qClass.data && !qClass.isError && !qGrp.isError && !qEnt.isError}
        dir={dir} onDir={setDir} />
    </section>
  );
}
