import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        apix: {
          orange:       "#ca631f",
          "orange-light": "#e07a3a",
          "orange-dark":  "#a84e18",
          blue:         "#004f91",
          "blue-light":   "#1a6ab0",
          "blue-dark":    "#003a6e",
        },
        surface: {
          DEFAULT: "#0a0f1a",
          "1":     "#0f1623",
          "2":     "#151d2e",
          "3":     "#1c2640",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body:    ["var(--font-dm-sans)", "sans-serif"],
      },
      backgroundImage: {
        "gradient-orange": "linear-gradient(135deg, #ca631f 0%, #a84e18 100%)",
        "gradient-blue":   "linear-gradient(135deg, #004f91 0%, #003a6e 100%)",
        "gradient-card":   "linear-gradient(145deg, #151d2e 0%, #0f1623 100%)",
      },
      boxShadow: {
        "apix-orange": "0 0 30px rgba(202, 99, 31, 0.25)",
        "apix-blue":   "0 0 30px rgba(0, 79, 145, 0.35)",
        "card":        "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover":  "0 8px 40px rgba(0,0,0,0.6)",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up":  "fadeUp 0.6s ease forwards",
        "fade-in":  "fadeIn 0.4s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
