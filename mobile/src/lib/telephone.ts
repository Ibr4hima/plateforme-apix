// Formatage des numéros de téléphone en notation internationale.
// Séparé de lib/format pour ne pas embarquer libphonenumber-js dans les pages
// qui n'affichent pas de téléphones.
import { parsePhoneNumber } from "libphonenumber-js";

export function fmtPhone(raw: string): string {
  if (!raw) return raw;
  try { return parsePhoneNumber(raw.trim()).formatInternational(); } catch { return raw; }
}
