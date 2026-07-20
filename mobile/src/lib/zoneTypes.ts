// Métadonnées des types de zones — port de components/shared/zoneTypes du
// site : source unique de vérité pour les couleurs ZES / ZAI / ZFI.

export type ZoneTypeMeta = { label: string; color: string };

export const ZONE_TYPE_META: Record<string, ZoneTypeMeta> = {
  ZES: { label: "Zones Économiques Spéciales",           color: "#004f91" },
  ZAI: { label: "Zones Aménagées pour l'Investissement", color: "#ca631f" },
  ZFI: { label: "Zones Franches Industrielles",          color: "#188038" },
};

export const ZONE_TYPE_ORDER = ["ZES", "ZAI", "ZFI"];

export const zoneTypeMeta = (type?: string): ZoneTypeMeta =>
  (type && ZONE_TYPE_META[type]) || { label: type || "", color: "#64748b" };
