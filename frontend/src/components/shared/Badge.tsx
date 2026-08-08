import React from "react";

const VARIANTS = {
  green:      { bg:"rgb(var(--vert-rgb) / 0.1)",    text:"var(--vert-fonce)", border:"rgb(var(--vert-rgb) / 0.2)"    },
  blue:       { bg:"rgb(var(--bleu-rgb) / 0.1)",     text:"var(--bleu-profond)", border:"rgb(var(--bleu-rgb) / 0.2)"     },
  orange:     { bg:"rgb(var(--orange-rgb) / 0.1)",    text:"var(--orange-profond)", border:"rgb(var(--orange-rgb) / 0.2)"    },
  yellow:     { bg:"rgb(var(--or-rgb) / 0.22)", text:"var(--orange-profond)", border:"rgb(var(--or-rgb) / 0.35)"  },
  teal:       { bg:"rgb(var(--sarcelle-rgb) / 0.16)",  text:"var(--cyan-fonce)", border:"rgb(var(--sarcelle-rgb) / 0.30)" },
  purple:     { bg:"rgb(var(--violet-rgb) / 0.1)",   text:"var(--violet-action)", border:"rgb(var(--violet-rgb) / 0.2)"   },
  lavender:   { bg:"rgb(var(--indigo-rgb) / 0.14)", text:"var(--violet-action)", border:"rgb(var(--indigo-rgb) / 0.28)" },
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
  terracotta: "var(--terracotta)",
  bleu:       "var(--bleuroi)",
  rouille:    "var(--rouille)",
  jaune:      "var(--jaune)",
  jaune_text: "var(--ambre)", // version contrastée pour texte sur fond clair
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
