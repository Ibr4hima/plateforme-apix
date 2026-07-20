// Arbre NAEMA secteur → branche → activité — même rendu que le site
// (points bleu / orange / vert, indentation à filet). Partagé entre la
// fiche entreprise et la fiche zone (« Activités autorisées »).
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

const OPTS = { staleTime: Infinity, gcTime: 24 * 3600 * 1000 } as const;

export function useNaema() {
  const secteurs  = useQuery({ queryKey: ["ref", "secteurs"],  queryFn: () => getJson<any[]>("/entreprises/ref/secteurs"),  ...OPTS }).data || [];
  const branches  = useQuery({ queryKey: ["ref", "branches"],  queryFn: () => getJson<any[]>("/entreprises/ref/branches"),  ...OPTS }).data || [];
  const activites = useQuery({ queryKey: ["ref", "activites"], queryFn: () => getJson<any[]>("/entreprises/ref/activites"), ...OPTS }).data || [];
  return { secteurs, branches, activites };
}

export default function ArbreNaema({ secIds, braIds, actIds }: { secIds: number[]; braIds: number[]; actIds: number[] }) {
  const { secteurs, branches, activites } = useNaema();
  if (!secteurs.length) return null;
  return (
    <View style={{ gap: 14 }}>
      {secIds.map((secId: number) => {
        const sec = secteurs.find((x: any) => x.id === secId);
        if (!sec) return null;
        const brasDuSec = branches.filter((b: any) => b.secteur_id === secId && braIds.includes(b.id));
        return (
          <View key={`sec-${secId}`} style={{ gap: 8 }}>
            <View style={s.ligne}>
              <View style={[s.point, { width: 8, height: 8, backgroundColor: T.bleu, marginTop: 5 }]} />
              <Text style={s.secteur}>{sec.nom}</Text>
            </View>
            {brasDuSec.length > 0 && (
              <View style={s.indent}>
                {brasDuSec.map((bra: any) => {
                  const actsDeBra = activites.filter((a: any) => a.branche_id === bra.id && actIds.includes(a.id));
                  return (
                    <View key={`bra-${bra.id}`} style={{ gap: 6 }}>
                      <View style={s.ligne}>
                        <View style={[s.point, { width: 6, height: 6, backgroundColor: T.orange, marginTop: 6 }]} />
                        <Text style={s.branche}>{bra.nom}</Text>
                      </View>
                      {actsDeBra.length > 0 && (
                        <View style={{ paddingLeft: 16, gap: 5 }}>
                          {actsDeBra.map((act: any) => (
                            <View key={`act-${act.id}`} style={s.ligne}>
                              <View style={[s.point, { width: 5, height: 5, backgroundColor: T.vert, marginTop: 6 }]} />
                              <Text style={s.activite}>{act.nom}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  point: { borderRadius: 99, flexShrink: 0 },
  indent: { paddingLeft: 17, borderLeftWidth: 1.5, borderLeftColor: T.bleuVoile, marginLeft: 3.5, gap: 8 },
  secteur: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, color: T.bleu, lineHeight: 18 },
  branche: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: "#c14a2e", lineHeight: 18 },
  activite: { flex: 1, fontSize: 12, fontFamily: POLICE.normal, color: "#4d8a63", lineHeight: 17 },
});
