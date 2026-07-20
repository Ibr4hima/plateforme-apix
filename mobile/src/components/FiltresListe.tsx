// Boîte à outils des feuilles de filtres des pages de listes — mêmes
// filtres que les barres latérales de la plateforme, appliqués en direct
// (pas de brouillon) : sections à coches multi, cascade Thématiques
// (secteur → branche → activité) et cascade Localisation (région →
// département → arrondissement), pied Réinitialiser / Terminé.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feuille, Tapable } from "@/components/ui";
import { succes, tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

export const basculer = (liste: string[], v: string) =>
  liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v];
export const basculerNum = (liste: number[], v: number) =>
  liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v];

export function TitreSection({ titre, nb }: { titre: string; nb?: number }) {
  return (
    <View style={s.secLigne}>
      <Text style={s.secTitre}>{titre.toUpperCase()}</Text>
      {nb ? <Text style={s.secBadge}>{nb}</Text> : null}
    </View>
  );
}

// Rangée à coche ronde (le point bleu de la plateforme)
export function Coche({ label, sel, onPress, retrait = 0 }: {
  label: string; sel: boolean; onPress: () => void; retrait?: number;
}) {
  return (
    <Pressable onPress={() => { tick(); onPress(); }}
      style={({ pressed }) => [s.coche, { paddingLeft: 8 + retrait }, pressed && { backgroundColor: T.champ }]}>
      <View style={[s.point, sel && { borderColor: T.bleu, backgroundColor: T.bleu }]} />
      <Text style={[s.cocheTexte, sel && { fontFamily: POLICE.gras, color: T.encre }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// Cadre doux : contient une liste défilante, rien ne déborde sur la suite
function CadreListe({ hauteurMax, children }: { hauteurMax: number; children: React.ReactNode }) {
  return (
    <View style={s.cadre}>
      <ScrollView style={{ maxHeight: hauteurMax }} nestedScrollEnabled showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

// Section multi-sélection simple (avec recherche au-delà de 12 options)
export function SectionCoches({ titre, options, sel, onBascule }: {
  titre: string; options: string[]; sel: string[]; onBascule: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const visibles = t ? options.filter(o => o.toLowerCase().includes(t)) : options;
  return (
    <View>
      <TitreSection titre={titre} nb={sel.length} />
      {options.length > 12 && (
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={T.gris}
          autoCorrect={false} style={s.champ} />
      )}
      <CadreListe hauteurMax={248}>
        {visibles.map(o => (
          <Coche key={o} label={o} sel={sel.includes(o)} onPress={() => onBascule(o)} />
        ))}
        {!visibles.length && <Text style={s.tronque}>Aucune option ne correspond.</Text>}
      </CadreListe>
    </View>
  );
}

// ── Cascade Thématiques : secteur → branche → activité (multi par noms) ──────
export type SecteurArbre = { nom: string; branches: { nom: string; activites: { nom: string }[] }[] };

export function CascadeThema({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs: SecteurArbre[];
  secteursSel: string[]; branchesSel: string[]; activitesSel: string[];
  onSecteur: (v: string) => void; onBranche: (v: string) => void; onActivite: (v: string) => void;
}) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const plier = (cle: string) => setOuverts(p => { const n = new Set(p); n.has(cle) ? n.delete(cle) : n.add(cle); return n; });
  return (
    <View>
      <TitreSection titre="Thématiques" nb={secteursSel.length + branchesSel.length + activitesSel.length} />
      <CadreListe hauteurMax={300}>
      {secteurs.map(sec => (
        <View key={sec.nom}>
          <View style={s.rangeePliable}>
            <View style={{ flex: 1 }}>
              <Coche label={sec.nom} sel={secteursSel.includes(sec.nom)} onPress={() => onSecteur(sec.nom)} />
            </View>
            {sec.branches.length > 0 && (
              <Pressable hitSlop={8} onPress={() => plier(sec.nom)} style={s.chevron}>
                <Text style={s.chevronTexte}>{ouverts.has(sec.nom) ? "−" : "+"}</Text>
              </Pressable>
            )}
          </View>
          {ouverts.has(sec.nom) && sec.branches.map(bra => (
            <View key={bra.nom}>
              <View style={s.rangeePliable}>
                <View style={{ flex: 1 }}>
                  <Coche label={bra.nom} sel={branchesSel.includes(bra.nom)} onPress={() => onBranche(bra.nom)} retrait={16} />
                </View>
                {bra.activites.length > 0 && (
                  <Pressable hitSlop={8} onPress={() => plier(`${sec.nom}|${bra.nom}`)} style={s.chevron}>
                    <Text style={s.chevronTexte}>{ouverts.has(`${sec.nom}|${bra.nom}`) ? "−" : "+"}</Text>
                  </Pressable>
                )}
              </View>
              {ouverts.has(`${sec.nom}|${bra.nom}`) && bra.activites.map(act => (
                <Coche key={act.nom} label={act.nom} sel={activitesSel.includes(act.nom)}
                  onPress={() => onActivite(act.nom)} retrait={32} />
              ))}
            </View>
          ))}
        </View>
      ))}
      </CadreListe>
    </View>
  );
}

// ── Cascade Localisation : région → département → arrondissement ─────────────
export type RegionArbre = { nom: string; departements: { nom: string; arrondissements: string[] }[] };

// Arbre Localisation construit depuis les données d'une liste
// (region_nom → departement_nom → arrondissement_nom uniques, tri français)
export function construireArbreGeo(items: any[]): RegionArbre[] {
  const regions = new Map<string, Map<string, Set<string>>>();
  for (const e of items) {
    if (!e.region_nom) continue;
    if (!regions.has(e.region_nom)) regions.set(e.region_nom, new Map());
    if (!e.departement_nom) continue;
    const depts = regions.get(e.region_nom)!;
    if (!depts.has(e.departement_nom)) depts.set(e.departement_nom, new Set());
    if (e.arrondissement_nom) depts.get(e.departement_nom)!.add(e.arrondissement_nom);
  }
  const triFr = (a: string, b: string) => a.localeCompare(b, "fr");
  return [...regions.entries()].sort((a, b) => triFr(a[0], b[0])).map(([nom, depts]) => ({
    nom,
    departements: [...depts.entries()].sort((a, b) => triFr(a[0], b[0])).map(([dep, arrs]) => ({
      nom: dep, arrondissements: [...arrs].sort(triFr),
    })),
  }));
}

export function CascadeGeo({ regions, regionsSel, deptsSel, arrsSel, onRegion, onDept, onArr }: {
  regions: RegionArbre[];
  regionsSel: string[]; deptsSel: string[]; arrsSel: string[];
  onRegion: (v: string) => void; onDept: (v: string) => void; onArr: (v: string) => void;
}) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const plier = (cle: string) => setOuverts(p => { const n = new Set(p); n.has(cle) ? n.delete(cle) : n.add(cle); return n; });
  return (
    <View>
      <TitreSection titre="Localisation" nb={regionsSel.length + deptsSel.length + arrsSel.length} />
      <CadreListe hauteurMax={300}>
      {regions.map(reg => (
        <View key={reg.nom}>
          <View style={s.rangeePliable}>
            <View style={{ flex: 1 }}>
              <Coche label={reg.nom} sel={regionsSel.includes(reg.nom)} onPress={() => onRegion(reg.nom)} />
            </View>
            {reg.departements.length > 0 && (
              <Pressable hitSlop={8} onPress={() => plier(reg.nom)} style={s.chevron}>
                <Text style={s.chevronTexte}>{ouverts.has(reg.nom) ? "−" : "+"}</Text>
              </Pressable>
            )}
          </View>
          {ouverts.has(reg.nom) && reg.departements.map(dep => (
            <View key={dep.nom}>
              <View style={s.rangeePliable}>
                <View style={{ flex: 1 }}>
                  <Coche label={dep.nom} sel={deptsSel.includes(dep.nom)} onPress={() => onDept(dep.nom)} retrait={16} />
                </View>
                {dep.arrondissements.length > 0 && (
                  <Pressable hitSlop={8} onPress={() => plier(`${reg.nom}|${dep.nom}`)} style={s.chevron}>
                    <Text style={s.chevronTexte}>{ouverts.has(`${reg.nom}|${dep.nom}`) ? "−" : "+"}</Text>
                  </Pressable>
                )}
              </View>
              {ouverts.has(`${reg.nom}|${dep.nom}`) && dep.arrondissements.map(arr => (
                <Coche key={arr} label={arr} sel={arrsSel.includes(arr)} onPress={() => onArr(arr)} retrait={32} />
              ))}
            </View>
          ))}
        </View>
      ))}
      </CadreListe>
    </View>
  );
}

// ── Plage d'années (période de création des entreprises) ─────────────────────
export function PlageAnnees({ titre, min, max, debut, fin, onChange }: {
  titre: string; min: number; max: number; debut: number; fin: number;
  onChange: (debut: number, fin: number) => void;
}) {
  return (
    <View>
      <TitreSection titre={titre} nb={debut > min || fin < max ? 1 : 0} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput defaultValue={String(debut)} keyboardType="number-pad" maxLength={4}
          onEndEditing={e => { const v = parseInt(e.nativeEvent.text, 10); if (!isNaN(v)) onChange(Math.max(min, Math.min(v, fin)), fin); }}
          style={[s.champ, { flex: 1, marginBottom: 0, textAlign: "center" }]} />
        <Text style={{ alignSelf: "center", color: T.gris, fontFamily: POLICE.normal }}>—</Text>
        <TextInput defaultValue={String(fin)} keyboardType="number-pad" maxLength={4}
          onEndEditing={e => { const v = parseInt(e.nativeEvent.text, 10); if (!isNaN(v)) onChange(debut, Math.min(max, Math.max(v, debut))); }}
          style={[s.champ, { flex: 1, marginBottom: 0, textAlign: "center" }]} />
      </View>
    </View>
  );
}

// ── La feuille : filtres appliqués en direct, pied Réinitialiser / Terminé ───
export function FeuilleFiltres({ onClose, onReinitialiser, children }: {
  onClose: () => void; onReinitialiser: () => void; children: React.ReactNode;
}) {
  return (
    <Feuille onClose={onClose} titre="Filtres" hauteur="88%" ecart={22}
      pied={
        <View style={s.pied}>
          <Tapable onPress={() => { tick(); onReinitialiser(); }} style={s.boutonSecondaire}>
            <Text style={s.boutonSecondaireTexte}>Réinitialiser</Text>
          </Tapable>
          <Tapable onPress={() => { succes(); onClose(); }} style={s.boutonPrincipal}>
            <Text style={s.boutonPrincipalTexte}>Terminé</Text>
          </Tapable>
        </View>
      }>
      {children}
    </Feuille>
  );
}

const s = StyleSheet.create({
  secLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  secTitre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6 },
  secBadge: {
    fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, backgroundColor: T.blocBord,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
  cadre: {
    backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce,
    borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4, overflow: "hidden",
  },
  coche: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingRight: 8, borderRadius: 8 },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: T.grisClair },
  cocheTexte: { flex: 1, fontSize: 13, fontFamily: POLICE.normal, color: T.texte },
  rangeePliable: { flexDirection: "row", alignItems: "center" },
  chevron: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: T.filet },
  chevronTexte: { fontSize: 15, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 18 },
  champ: {
    backgroundColor: T.champ, borderWidth: 1, borderColor: T.bordure, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: POLICE.normal, color: T.encre, marginBottom: 8,
  },
  tronque: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, paddingVertical: 6, paddingLeft: 8 },
  pied: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.filet, paddingBottom: 26 },
  boutonSecondaire: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: T.bordure, backgroundColor: T.carte,
  },
  boutonSecondaireTexte: { fontSize: 13.5, fontFamily: POLICE.demi, color: T.texte },
  boutonPrincipal: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: T.bleuAction },
  boutonPrincipalTexte: { fontSize: 13.5, fontFamily: POLICE.gras, color: "#fff" },
});
