/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        base: "#0B0F14",
        surface: "#151B24",
        card: "#1A202C",
        elevated: "#1E2530",

        // Accents
        royal: "#8338EC",
        "royal-soft": "#9B5DE5",
        "royal-deep": "#6A2DC8",

        // CTA
        orange: "#FB5607",
        "orange-soft": "#FF7B3D",

        // Gold
        gold: "#F5C542",
        "gold-soft": "#FDE68A",

        // Text
        hi: "#F8F9FA",
        mid: "#A0A4B8",
        low: "#6B7280",

        // Semantic
        green: "#22C55E",
        red: "#EF4444",

        // Borders
        line: "#1E293B",
        "line-light": "#334155",
      },
    },
  },
  plugins: [],
};