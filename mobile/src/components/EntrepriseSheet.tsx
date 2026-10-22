// Fiche entreprise — une fiche de contact, pas un modal de back-office.
//
// Le gain décisif du téléphone sur le web : il sait APPELER. La fiche mène
// donc par l'action — une rangée Appeler · E-mail · Site web sous l'identité,
// l'idiome de la fiche Contacts d'iOS et de Google Contacts — et chaque
// numéro ou adresse des points focaux est lui-même tappable (tel: / mailto:).
//
// Structure éditoriale, comme les autres fiches : identité (nom en grand,
// une ligne de méta forme · pôle · région), actions, puis sections plates —
// rangées clé-valeur, activités NAEMA, points focaux.
import { Text, View } from "react-native";
import ArbreNaema, { useNaema } from "@/components/ArbreNaema";
import { Bloc, EnTeteSection, Groupe, Ligne, LigneValeur, TuilesActions } from "@/components/ListeIOS";
import { ouvrirLien, ouvrirMail, proposer } from "@/lib/liens";
import { Feuille } from "@/components/ui";
import { fmtDateLong } from "@/lib/format";
import { fmtPhone, ouvrirTel } from "@/lib/telephone";
import { FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

// La fiche prend la grammaire de la fiche Contacts, sur iOS comme sur
// Android (ListeIOS) : les tuiles d'action, les informations en lignes
// groupées (la valeur bleue quand elle appelle, écrit ou ouvre), un groupe
// par point focal.

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{children}</View>;
}

function Rangee({ label, valeur, onPress }: { label: string; valeur?: string | null; onPress?: () => void }) {
  if (!valeur) return null;
  return <LigneValeur label={label} valeur={valeur} onPress={onPress} />;
}

const decouper = (v: string | null | undefined) => (v || "").split(",").map(x => x.trim()).filter(Boolean);

// Le site s'ouvre dans Safari intégré à l'app sur iOS (voir ouvrirLien)
const ouvrirSite = (u: string) => ouvrirLien(u);

export default function EntrepriseSheet({ entreprise: e, onClose }: { entreprise: any; onClose: () => void }) {
  const { secteurs } = useNaema();

  const secIds: number[] = e.secteur_ids || [];
  const braIds: number[] = e.branche_ids || [];
  const actIds: number[] = e.activite_ids || [];
  const hasNaema = secIds.length > 0 || braIds.length > 0 || actIds.length > 0;
  const locStr = [e.arrondissement_nom, e.departement_nom, e.region_nom].filter(Boolean).join(", ");
  const paysStr = e.siege_pays_nom || e.pays || null;
  const focaux: any[] = Array.isArray(e.points_focaux) ? e.points_focaux : [];

  const telephones: string[] = (e.telephone || "").split(",").map((t: string) => t.trim()).filter(Boolean);
  const mails: string[] = (e.mail || "").split(",").map((m: string) => m.trim()).filter(Boolean);
  const meta = [
    (e.forme_juridique || "").replace(/\s*\([^)]*\)\s*$/, ""),
    e.pole_territoire_nom,
    e.region_nom ? `Région de ${e.region_nom}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={e.nom}
      sousEntete={meta ? <Text style={s.meta}>{meta}</Text> : undefined}>

      {/* ── Agir : appeler, écrire, visiter — l'atout du téléphone ── */}
      <TuilesActions actions={[
        telephones.length > 0 && { sf: "phone", materiel: "call", label: "Appeler",
          onPress: () => proposer("Appeler", telephones.map(fmtPhone), i => ouvrirTel(telephones[i])) },
        mails.length > 0 && { sf: "envelope", materiel: "mail", label: "E-mail",
          onPress: () => proposer("Écrire à", mails, i => ouvrirMail(mails[i])) },
        !!e.siteweb && { sf: "safari", materiel: "language", label: "Site web", onPress: () => ouvrirSite(e.siteweb) },
      ]} />

      {/* ── Informations ── */}
      <Section titre="Informations">
        <Groupe>
          <Rangee label="Création" valeur={e.date_creation ? fmtDateLong(e.date_creation) : null} />
          <Rangee label="Pays du siège" valeur={paysStr} />
          <Rangee label="Localisation" valeur={locStr || null} />
          <Rangee label="Adresse" valeur={e.adresse} />
          {telephones.map((t, i) => (
            <Rangee key={`t${i}`} label={i === 0 ? (telephones.length > 1 ? "Téléphones" : "Téléphone") : ""}
              valeur={fmtPhone(t)} onPress={() => ouvrirTel(t)} />
          ))}
          {mails.map((m, i) => (
            <Rangee key={`m${i}`} label={i === 0 ? (mails.length > 1 ? "E-mails" : "E-mail") : ""}
              valeur={m} onPress={() => ouvrirMail(m)} />
          ))}
          <Rangee label="Site web" valeur={e.siteweb} onPress={e.siteweb ? () => ouvrirSite(e.siteweb) : undefined} />
        </Groupe>
      </Section>

      {/* ── Activités (hiérarchie NAEMA existante) ── */}
      {hasNaema && secteurs.length > 0 ? (
        <Section titre="Activités de l'entreprise">
          <Bloc><ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} /></Bloc>
        </Section>
      ) : null}

      {/* ── Points focaux : les personnes, avec leurs actions ── */}
      {focaux.length > 0 ? (
        <Section titre="Points focaux">
          {/* Un groupe par personne — son nom et son poste, puis ses numéros
              et adresses, chacun d'un toucher */}
          <View style={{ gap: 12 }}>
            {focaux.map((pf: any, i: number) => (
              <Groupe key={i}>
                <Ligne gras label={[pf.civilite, pf.prenom, pf.nom].filter(Boolean).join(" ")}
                  legende={pf.poste || undefined}
                  accessoire={pf.est_principal ? <Text style={s.principal}>Principal</Text> : undefined} />
                {decouper(pf.telephone).map((t, ti) => (
                  <LigneValeur key={`t${ti}`} label="Téléphone" valeur={fmtPhone(t)} onPress={() => ouvrirTel(t)} />
                ))}
                {decouper(pf.mail).map((m, mi) => (
                  <LigneValeur key={`m${mi}`} label="E-mail" valeur={m} onPress={() => ouvrirMail(m)} />
                ))}
              </Groupe>
            ))}
          </View>
        </Section>
      ) : null}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7 },
  principal: { fontSize: 12.5, ...FONTE.demi, color: T.orange },
}));
