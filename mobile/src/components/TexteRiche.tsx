// Rendu riche du HTML produit par l'éditeur de la plateforme
// (contenteditable + execCommand) : gras, italique, souligné, listes à
// puces, listes à tirets cadratins (ul.dash-list), listes numérotées,
// indentation (blockquote), paragraphes. Remplace l'aplatissement
// htmlEnTexte qui perdait tout le formatage voulu à l'upload.
import { memo, useMemo } from "react";
import { Text, TextStyle, View } from "react-native";
import { POLICE } from "@/theme";

type Noeud =
  | { type: "el"; tag: string; classe: string; enfants: Noeud[] }
  | { type: "txt"; texte: string };

const VIDES = new Set(["br", "hr", "img"]);
const BLOCS = new Set(["p", "div", "blockquote", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"]);

function decoder(t: string): string {
  return t
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, "\"");
}

// Parseur minimal à pile — suffisant pour le HTML de l'éditeur maison
function parser(html: string): Noeud[] {
  const racine: Noeud = { type: "el", tag: "racine", classe: "", enfants: [] };
  const pile: Extract<Noeud, { type: "el" }>[] = [racine];
  const re = /<\/?[a-zA-Z][^>]*>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok[0] !== "<") {
      const texte = decoder(tok);
      if (texte) pile[pile.length - 1].enfants.push({ type: "txt", texte });
      continue;
    }
    const fermante = tok[1] === "/";
    const tag = (tok.match(/^<\/?\s*([a-zA-Z0-9]+)/)?.[1] || "").toLowerCase();
    if (!tag) continue;
    if (fermante) {
      // remonte jusqu'à la balise ouvrante correspondante
      for (let i = pile.length - 1; i > 0; i--) {
        if (pile[i].tag === tag) { pile.length = i; break; }
      }
    } else {
      const classe = tok.match(/class\s*=\s*["']([^"']*)["']/i)?.[1] || "";
      const el: Noeud = { type: "el", tag, classe, enfants: [] };
      pile[pile.length - 1].enfants.push(el);
      if (!VIDES.has(tag) && !tok.endsWith("/>")) pile.push(el as any);
    }
  }
  return racine.enfants;
}

const estBloc = (n: Noeud) => n.type === "el" && (BLOCS.has(n.tag));
const estVide = (n: Noeud) =>
  n.type === "txt" ? !n.texte.trim()
  : n.tag === "br" ? true
  : n.enfants.every(estVide);

// ── Rendu ────────────────────────────────────────────────────────────────────
type Ctx = { couleur: string; fontSize: number; lineHeight: number };

function rendreInline(noeuds: Noeud[], ctx: Ctx, herite: TextStyle, cle = "i"): React.ReactNode[] {
  return noeuds.map((n, i) => {
    if (n.type === "txt") return n.texte;
    if (n.tag === "br") return "\n";
    let style: TextStyle = { ...herite };
    if (n.tag === "b" || n.tag === "strong") style = { ...style, fontFamily: POLICE.gras };
    if (n.tag === "i" || n.tag === "em") style = { ...style, fontStyle: "italic" };
    if (n.tag === "u") style = { ...style, textDecorationLine: "underline" };
    return <Text key={`${cle}${i}`} style={style}>{rendreInline(n.enfants, ctx, style, `${cle}${i}`)}</Text>;
  });
}

function Paragraphe({ noeuds, ctx, dernier }: { noeuds: Noeud[]; ctx: Ctx; dernier: boolean }) {
  return (
    <Text style={{
      fontFamily: POLICE.normal, color: ctx.couleur, fontSize: ctx.fontSize,
      lineHeight: ctx.lineHeight, marginBottom: dernier ? 0 : ctx.fontSize * 0.55,
    }}>
      {rendreInline(noeuds, ctx, {})}
    </Text>
  );
}

function rendreBlocs(noeuds: Noeud[], ctx: Ctx, cle = "b"): React.ReactNode[] {
  const sortie: React.ReactNode[] = [];
  let tampon: Noeud[] = [];
  const utiles = noeuds.filter((n, i) => !(estVide(n) && n.type === "el" && n.tag !== "br") || !estBloc(n));
  const vider = (dernier: boolean) => {
    if (tampon.length && !tampon.every(estVide)) {
      sortie.push(<Paragraphe key={`${cle}p${sortie.length}`} noeuds={tampon} ctx={ctx} dernier={dernier} />);
    }
    tampon = [];
  };
  utiles.forEach((n, i) => {
    const dernierNoeud = i === utiles.length - 1;
    if (!estBloc(n)) { tampon.push(n); if (dernierNoeud) vider(true); return; }
    vider(false);
    const el = n as Extract<Noeud, { type: "el" }>;
    if (estVide(el)) return;
    const k = `${cle}${i}`;
    if (el.tag === "ul" || el.tag === "ol") {
      sortie.push(<Liste key={k} el={el} ctx={ctx} dernier={dernierNoeud} />);
    } else if (el.tag === "blockquote") {
      // execCommand("indent") : niveau d'indentation supplémentaire
      sortie.push(
        <View key={k} style={{ marginLeft: 18, marginBottom: dernierNoeud ? 0 : ctx.fontSize * 0.3 }}>
          {rendreBlocs(el.enfants, ctx, k)}
        </View>
      );
    } else if (el.tag === "li") {
      sortie.push(...rendreBlocs(el.enfants, ctx, k));
    } else {
      // p / div / h* : un paragraphe
      sortie.push(<Paragraphe key={k} noeuds={el.enfants} ctx={ctx} dernier={dernierNoeud} />);
    }
  });
  return sortie;
}

function Liste({ el, ctx, dernier, profondeur = 0 }: {
  el: Extract<Noeud, { type: "el" }>; ctx: Ctx; dernier: boolean; profondeur?: number;
}) {
  const tirets = /\bdash-list\b/.test(el.classe);
  const nume = el.tag === "ol";
  const items = el.enfants.filter((n): n is Extract<Noeud, { type: "el" }> => n.type === "el" && n.tag === "li" && !estVide(n));
  let num = 0;
  return (
    <View style={{ marginBottom: dernier ? 0 : ctx.fontSize * 0.55, gap: ctx.fontSize * 0.22 }}>
      {items.map((li, i) => {
        num += 1;
        const marqueur = nume ? `${num}.` : tirets ? "—" : "•";
        // Sous-listes imbriquées dans l'item (indentation de liste)
        const sousListes = li.enfants.filter(n => n.type === "el" && (n.tag === "ul" || n.tag === "ol"));
        const contenu = li.enfants.filter(n => !(n.type === "el" && (n.tag === "ul" || n.tag === "ol")));
        return (
          <View key={i}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{
                fontFamily: POLICE.normal, color: ctx.couleur, fontSize: ctx.fontSize,
                lineHeight: ctx.lineHeight, width: nume ? ctx.fontSize * 1.5 : ctx.fontSize * 1.15,
              }}>{marqueur}</Text>
              <Text style={{
                flex: 1, fontFamily: POLICE.normal, color: ctx.couleur,
                fontSize: ctx.fontSize, lineHeight: ctx.lineHeight,
              }}>
                {rendreInline(contenu, ctx, {})}
              </Text>
            </View>
            {sousListes.map((sl, si) => (
              <View key={si} style={{ marginLeft: 18, marginTop: ctx.fontSize * 0.22 }}>
                <Liste el={sl as any} ctx={ctx} dernier profondeur={profondeur + 1} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function TexteRiche({ html, couleur, fontSize, lineHeight, style }: {
  html: string; couleur: string; fontSize: number; lineHeight: number; style?: any;
}) {
  const noeuds = useMemo(() => parser(html), [html]);
  const ctx: Ctx = { couleur, fontSize, lineHeight };
  return <View style={style}>{rendreBlocs(noeuds, ctx)}</View>;
}

export default memo(TexteRiche);
