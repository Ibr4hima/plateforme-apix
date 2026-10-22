// Formatage des numéros de téléphone en notation internationale.
// Séparé de lib/format pour ne pas embarquer libphonenumber-js dans les pages
// qui n'affichent pas de téléphones.
//
// UN NUMÉRO SANS INDICATIF EST SÉNÉGALAIS : saisi au format national
// (« 33 869 98 40 ») ou précédé de 00, il restait brut à l'écran, et le lien
// d'appel composait sans indicatif — injoignable depuis l'étranger.
import { parsePhoneNumber } from "libphonenumber-js";
import { Linking } from "react-native";

const lire = (raw: string) => parsePhoneNumber(raw.trim().replace(/^00/, "+"), "SN");

export function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return lire(raw).formatInternational(); } catch { return raw; }
}

/** Le numéro à composer, au format E.164 (« +221338699840 »). */
export function versTel(raw: string): string {
  try { return lire(raw).number; } catch { return raw.replace(/[^\d+]/g, ""); }
}

/** Appeler un numéro. */
export const ouvrirTel = (t: string) => Linking.openURL(`tel:${versTel(t)}`).catch(() => {});
