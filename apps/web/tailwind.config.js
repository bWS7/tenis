/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-clash)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#f0faf4",
          100: "#d9f3e4",
          200: "#b2e6c9",
          300: "#7dd1a8",
          400: "#46b582",
          500: "#25976A",
          600: "#1a7a54",
          700: "#16623f",
          800: "#144e34",
          900: "#12402b",
          950: "#092518",
        },
        court: {
          clay:  "#C84B31",
          hard:  "#2563EB",
          grass: "#16A34A",
          sand:  "#D97706",
        }
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out",
        "slide-up":   "slideUp 0.35s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideDown: { "0%": { opacity: "0", transform: "translateY(-8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
}
