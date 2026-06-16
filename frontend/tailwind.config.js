/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe",
          300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6",
          600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a",
        },
        slate: { 850: "#1a2035" },
        // ─── Reference-design tokens (sidebar + semantic) ───
        navy: {
          900: "#0F1E35", // sidebar base
          800: "#13233f",
          700: "#1b2d4d",
          600: "#243a63", // active item bg
        },
        ink: "#0F172A",      // main text
        muted: "#64748B",    // secondary text
        line: "#E5E7EB",     // soft borders
        canvas: "#F8FAFC",   // app background
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        cardHover: "0 8px 24px rgba(15,23,42,0.10)",
        panel: "0 2px 12px rgba(15,23,42,0.06)",
      },
      borderRadius: {
        xl: "12px", "2xl": "16px", "3xl": "18px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
