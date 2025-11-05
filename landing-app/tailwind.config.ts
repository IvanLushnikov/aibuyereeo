import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "neo-night": "#080B1A",
        "neo-card": "#10152A",
        "neo-glow": "#7D2FFF",
        "neo-electric": "#00E7FF",
        "neo-sunrise": "#FF5F8D",
        "neo-dawn": "#FFCF4D",
        "neo-mint": "#79FFB7",
      },
      backgroundImage: {
        "gradient-hero":
          "linear-gradient(135deg, rgba(125,47,255,0.9) 0%, rgba(0,231,255,0.85) 100%)",
        "gradient-cta":
          "linear-gradient(135deg, rgba(255,95,141,1) 0%, rgba(255,207,77,1) 100%)",
      },
      boxShadow: {
        neon: "0 20px 40px rgba(125,47,255,0.25)",
        "neon-soft": "0 12px 30px rgba(0,231,255,0.25)",
      },
      animation: {
        pulseGlow: "pulseGlow 4s ease-in-out infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 rgba(125,47,255,0.4)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 25px rgba(0,231,255,0.35)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      fontFamily: {
        display: ["var(--font-manrope)"],
        body: ["var(--font-inter)"],
      },
    },
  },
  plugins: [],
};

export default config;

