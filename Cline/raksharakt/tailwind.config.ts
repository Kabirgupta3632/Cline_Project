// Tailwind theme config: RakshaRakt red/white medical palette shared by every
// screen (hospital dashboard, donor mobile UI, demo panel). Shared infra file.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Primary "blood red" brand color used for CTAs, SOS badges, alerts.
        raksha: {
          50: "#fff1f1",
          100: "#ffdfdf",
          200: "#ffc5c5",
          300: "#ff9d9d",
          400: "#fd6565",
          500: "#f33a3a",
          600: "#e01e1e",
          700: "#bc1414",
          800: "#9b1414",
          900: "#801818",
        },
        critical: "#d90429",
        success: "#15803d",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;

