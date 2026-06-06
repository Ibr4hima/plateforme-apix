import React from "react";

const VARIANTS = {
  green:   { bg:"rgba(24,128,56,0.1)",    text:"#0d5c1a", border:"rgba(24,128,56,0.2)"    },
  blue:    { bg:"rgba(0,79,145,0.1)",     text:"#003f7a", border:"rgba(0,79,145,0.2)"     },
  orange:  { bg:"rgba(202,99,31,0.1)",    text:"#7a3d10", border:"rgba(202,99,31,0.2)"    },
  yellow:  { bg:"rgba(228,217,111,0.28)", text:"#5c4100", border:"rgba(200,185,50,0.35)"  },
  teal:    { bg:"rgba(168,195,188,0.3)",  text:"#1a4a40", border:"rgba(140,175,165,0.45)" },
  purple:  { bg:"rgba(124,58,237,0.1)",   text:"#5c20b8", border:"rgba(124,58,237,0.2)"   },
  lavender:{ bg:"rgba(211,211,255,0.45)", text:"#4b0082", border:"rgba(180,180,255,0.55)" },
  red:     { bg:"rgba(220,38,38,0.1)",    text:"#991b1b", border:"rgba(220,38,38,0.2)"    },
  gray:    { bg:"rgba(107,114,128,0.1)",  text:"#374151", border:"rgba(107,114,128,0.2)"  },
  navy:    { bg:"rgba(26,26,46,0.08)",    text:"#1a1a2e", border:"rgba(26,26,46,0.15)"    },
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

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
