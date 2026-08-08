import React from "react";

const VARIANTS = {
  green:      { bg:"rgb(var(--vert-rgb) / 0.1)",    text:"var(--vert-fonce)", border:"rgb(var(--vert-rgb) / 0.2)"    },
  blue:       { bg:"rgb(var(--bleu-rgb) / 0.1)",     text:"var(--bleu-profond)", border:"rgb(var(--bleu-rgb) / 0.2)"     },
  orange:     { bg:"rgb(var(--orange-rgb) / 0.1)",    text:"var(--orange-profond)", border:"rgb(var(--orange-rgb) / 0.2)"    },
  yellow:     { bg:"rgba(228,217,111,0.28)", text:"var(--orange-profond)", border:"rgba(200,185,50,0.35)"  },
  teal:       { bg:"rgba(168,195,188,0.3)",  text:"var(--cyan-fonce)", border:"rgba(140,175,165,0.45)" },
  purple:     { bg:"rgb(var(--violet-rgb) / 0.1)",   text:"var(--violet-action)", border:"rgb(var(--violet-rgb) / 0.2)"   },
  lavender:   { bg:"rgba(211,211,255,0.45)", text:"var(--violet-action)", border:"rgba(180,180,255,0.55)" },
  red:        { bg:"rgb(var(--danger-rgb) / 0.1)",    text:"var(--danger-action)", border:"rgb(var(--danger-rgb) / 0.2)"    },
  gray:       { bg:"rgb(var(--gris-rgb) / 0.1)",  text:"var(--texte)", border:"rgb(var(--gris-rgb) / 0.2)"  },
  navy:       { bg:"rgb(var(--encre-rgb) / 0.08)",    text:"var(--encre)", border:"rgb(var(--encre-rgb) / 0.15)"    },
  // ── Palette APIX ──────────────────────────────────────────────────────────
  vert:       { bg:"rgb(var(--vert-rgb) / 0.08)",   text:"var(--vert-fonce)", border:"rgb(var(--vert-rgb) / 0.2)"    },
  terracotta: { bg:"rgb(var(--orange-rgb) / 0.08)",   text:"var(--danger-action)", border:"rgb(var(--orange-rgb) / 0.2)"    },
  bleu:       { bg:"rgb(var(--bleu-rgb) / 0.08)",   text:"var(--bleu-action)", border:"rgb(var(--bleu-rgb) / 0.2)"    },
  rouille:    { bg:"rgb(var(--orange-rgb) / 0.08)",   text:"var(--orange-action)", border:"rgb(var(--orange-rgb) / 0.2)"    },
  jaune:      { bg:"rgb(var(--alerte-rgb) / 0.12)",   text:"var(--orange-profond)", border:"rgb(var(--alerte-rgb) / 0.35)"   },
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

// ── Couleurs pures APIX ────────────────────────────────────────────────────
// Utiliser ces constantes partout où l'on a besoin de la couleur seule
export const COLORS = {
  vert:       "var(--vert-fonce)",
  terracotta: "#E35336",
  bleu:       "#0F52BA",
  rouille:    "#B7410E",
  jaune:      "#FBBC04",
  jaune_text: "#8A6100", // version contrastée pour texte sur fond clair
} as const;

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "xs" | "sm" | "md";
  style?: React.CSSProperties;
}

export default function Badge({ children, variant = "gray", size = "md", style }: BadgeProps) {
  const v = VARIANTS[variant];
  const fontSize = size === "xs" ? 10 : size === "sm" ? 11 : 12;
  const padding  = size === "xs" ? "2px 8px" : size === "sm" ? "3px 10px" : "4px 13px";

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize,
      fontWeight: 700,
      padding,
      borderRadius: 999,
      color: v.text,
      background: v.bg,
      border: `1px solid ${v.border}`,
      lineHeight: 1.4,
      whiteSpace: "nowrap",
      fontFamily: "var(--font-google-sans)",
      ...style,
    }}>
      {children}
    </span>
  );
}
