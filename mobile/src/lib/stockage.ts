// Le cache persisté de l'app (app/_layout), rangé EN TRANCHES.
//
// Tout le cache de React Query tient dans une seule chaîne. Sous Android,
// AsyncStorage la range dans SQLite et la relit d'un seul tenant, dans une
// fenêtre de lecture de 2 Mo : au-delà, la lecture échoue (« Row too big to
// fit into CursorWindow »). Une fois les modules préchargés — textes de loi,
// entreprises, prospects… —, le cache peut dépasser cette taille : il serait
// perdu à chaque lancement, et l'app ne servirait jamais rien hors ligne.
//
// La chaîne est donc coupée en tranches d'un demi-million de caractères (un
// mégaoctet au plus, même tout en accents), rangées sous des clés numérotées ;
// la clé d'origine ne garde que leur nombre. Une valeur d'avant, d'un seul
// tenant, se relit telle quelle.
import AsyncStorage from "@react-native-async-storage/async-storage";

const TRANCHE = 500_000;
const ENTETE = /^__tranches:(\d+)$/;

const cleTranche = (cle: string, i: number) => `${cle}.${i}`;

/** Les tranches rangées sous `cle` au-delà de la n-ième : celles d'un cache
    plus grand, devenues orphelines. */
async function tranchesAuDela(cle: string, n: number): Promise<string[]> {
  const toutes = await AsyncStorage.getAllKeys();
  return toutes.filter(k => {
    if (!k.startsWith(`${cle}.`)) return false;
    const i = Number(k.slice(cle.length + 1));
    return Number.isInteger(i) && i >= n;
  });
}

export const stockageEnTranches = {
  async getItem(cle: string): Promise<string | null> {
    const entete = await AsyncStorage.getItem(cle);
    if (entete == null) return null;
    const m = ENTETE.exec(entete);
    if (!m) return entete;
    const n = Number(m[1]);
    const paires = await AsyncStorage.multiGet(Array.from({ length: n }, (_, i) => cleTranche(cle, i)));
    // Une tranche manque (écriture interrompue) : le cache ne se relit pas,
    // l'app repart des données du réseau
    if (paires.some(([, v]) => v == null)) return null;
    return paires.map(([, v]) => v).join("");
  },

  async setItem(cle: string, valeur: string): Promise<void> {
    const n = Math.max(1, Math.ceil(valeur.length / TRANCHE));
    await AsyncStorage.multiSet(Array.from({ length: n }, (_, i): [string, string] =>
      [cleTranche(cle, i), valeur.slice(i * TRANCHE, (i + 1) * TRANCHE)]));
    await AsyncStorage.setItem(cle, `__tranches:${n}`);
    const orphelines = await tranchesAuDela(cle, n);
    if (orphelines.length) await AsyncStorage.multiRemove(orphelines);
  },

  async removeItem(cle: string): Promise<void> {
    await AsyncStorage.multiRemove([cle, ...(await tranchesAuDela(cle, 0))]);
  },
};
