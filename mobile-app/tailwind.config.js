/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        base: "#09090B",
        card: "#18181B",
        "card-soft": "#1C1C21",
        line: "#27272A",
        royal: "#5B21B6",
        "royal-soft": "#4C1D95",
        "royal-deep": "#2E1065",
        "royal-tint": "#C4B5FD",
        gold: "#FACC15",
        "gold-soft": "#FDE68A",
        orange: "#F97316",
        green: "#22C55E",
        hi: "#FAFAFA",
        mid: "#A1A1AA",
        low: "#71717A",
      },
    },
  },
  plugins: [],
};