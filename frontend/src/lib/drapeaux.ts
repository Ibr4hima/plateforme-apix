// Drapeaux emoji — la liste validée pour l'app. Chaque drapeau régional
// (paire d'indicateurs régionaux) est décodé en code ISO2 ; un pays de la
// base dont le code figure ici reçoit son emoji, sinon on garde le
// drapeau image actuel (les drapeaux hors base sont simplement ignorés).
const SUITE = "🇦🇫🇿🇦🇦🇱🇩🇿🇩🇪🇦🇩🇦🇴🇦🇮🇦🇶🇦🇬🇸🇦🇮🇴🇦🇷🇦🇲🇦🇼🇦🇺🇦🇹🇦🇿🇧🇸🇧🇭🇧🇩🇧🇧🇧🇪🇧🇿🇧🇯🇧🇲🇧🇹🇧🇾🇧🇴🇧🇦🇧🇼🇧🇷🇧🇳🇧🇬🇧🇫🇧🇮🇰🇭🇨🇲🇨🇦🇨🇻🇨🇱🇨🇳🇨🇾🇨🇴🇰🇲🇨🇬🇨🇩🇰🇵🇰🇷🇨🇷🇨🇮🇭🇷🇨🇺🇨🇼🇩🇰🇩🇯🇩🇲🇪🇬🇦🇪🇪🇨🇪🇷🇪🇸🇪🇪🇸🇿🇻🇦🇺🇸🇪🇹🇫🇯🇫🇮🇫🇷🇬🇦🇬🇲🇬🇪🇬🇸🇬🇭🇬🇮🇬🇷🇬🇩🇬🇱🇬🇵🇬🇺🇬🇹🇬🇬🇬🇳🇬🇶🇬🇼🇬🇾🇬🇫🇭🇹🇭🇳🇭🇰🇭🇺🇨🇽🇮🇲🇳🇫🇦🇽🇰🇾🇮🇨🇨🇨🇨🇰🇫🇴🇫🇰🇲🇵🇲🇭🇵🇳🇸🇧🇹🇨🇻🇬🇻🇮🇮🇳🇮🇩🇮🇶🇮🇷🇮🇪🇮🇸🇮🇱🇮🇹🇯🇲🇯🇵🇯🇪🇯🇴🇰🇿🇰🇪🇰🇬🇰🇮🇽🇰🇰🇼🇷🇪🇱🇦🇱🇸🇱🇻🇱🇧🇱🇷🇱🇾🇱🇮🇱🇹🇱🇺🇲🇴🇲🇰🇲🇬🇲🇾🇲🇼🇲🇻🇲🇱🇲🇹🇲🇦🇲🇶🇲🇺🇲🇷🇾🇹🇲🇽🇫🇲🇲🇩🇲🇨🇲🇳🇲🇪🇲🇸🇲🇿🇲🇲🇳🇦🇳🇷🇳🇵🇳🇮🇳🇪🇳🇬🇳🇺🇳🇴🇳🇨🇳🇿🇴🇲🇺🇬🇺🇿🇵🇰🇵🇼🇵🇦🇵🇬🇵🇾🇳🇱🇧🇶🇵🇪🇵🇭🇵🇱🇵🇫🇵🇷🇵🇹🇶🇦🇨🇫🇩🇴🇷🇴🇬🇧🇷🇺🇷🇼🇪🇭🇧🇱🇰🇳🇸🇲🇸🇽🇵🇲🇻🇨🇸🇭🇱🇨🇸🇻🇼🇸🇦🇸🇸🇹🇸🇳🇷🇸🇨🇶🇸🇨🇸🇱🇸🇬🇸🇰🇸🇮🇸🇴🇸🇩🇸🇸🇱🇰🇸🇪🇨🇭🇸🇷🇸🇾🇹🇯🇹🇼🇹🇿🇹🇩🇨🇿🇹🇫🇵🇸🇹🇭🇹🇱🇹🇬🇹🇰🇹🇴🇹🇹🇹🇳🇹🇲🇹🇷🇹🇻🇺🇦🇺🇾🇻🇺🇻🇪🇻🇳🇿🇼🇿🇲🇾🇪🇼🇫";

// Décodage : chaque paire d'indicateurs régionaux (U+1F1E6…U+1F1FF) → ISO2
const AUTORISES = new Set<string>();
{
  const pts = [...SUITE].map(c => c.codePointAt(0)!);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a >= 0x1f1e6 && a <= 0x1f1ff && b >= 0x1f1e6 && b <= 0x1f1ff) {
      AUTORISES.add(String.fromCharCode(65 + a - 0x1f1e6, 65 + b - 0x1f1e6));
      i++;
    }
  }
}

// Emoji du pays, ou null si son drapeau n'est pas dans la liste validée
// (dans ce cas l'appelant garde son rendu actuel).
export function drapeauEmoji(iso2?: string | null): string | null {
  if (!iso2 || iso2.length !== 2) return null;
  const code = iso2.toUpperCase();
  if (!AUTORISES.has(code)) return null;
  return String.fromCodePoint(
    0x1f1e6 + code.charCodeAt(0) - 65,
    0x1f1e6 + code.charCodeAt(1) - 65,
  );
}
