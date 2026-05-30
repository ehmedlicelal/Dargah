import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Design system (Nərimanov Digital) ─────────────────────────────
        "primary":                    "#05152b",
        "on-primary":                 "#ffffff",
        "primary-container":          "#1b2a41",
        "on-primary-container":       "#8291ad",
        "primary-fixed":              "#d5e3ff",
        "primary-fixed-dim":          "#b8c7e5",
        "on-primary-fixed":           "#0c1c32",
        "on-primary-fixed-variant":   "#394760",
        "inverse-primary":            "#b8c7e5",

        "secondary":                  "#006876",
        "on-secondary":               "#ffffff",
        "secondary-container":        "#8aebff",
        "on-secondary-container":     "#006b79",
        "secondary-fixed":            "#a1efff",
        "secondary-fixed-dim":        "#73d4e8",
        "on-secondary-fixed":         "#001f25",
        "on-secondary-fixed-variant": "#004e5a",

        "tertiary":                   "#0a161f",
        "on-tertiary":                "#ffffff",
        "tertiary-container":         "#1f2b34",
        "on-tertiary-container":      "#86929e",
        "tertiary-fixed":             "#d8e4f1",
        "tertiary-fixed-dim":         "#bcc8d4",
        "on-tertiary-fixed":          "#111d26",
        "on-tertiary-fixed-variant":  "#3c4852",

        "background":                 "#fef8f6",
        "on-background":              "#1d1b1a",

        "surface":                    "#fef8f6",
        "surface-dim":                "#ded9d7",
        "surface-bright":             "#fef8f6",
        "surface-variant":            "#e7e1df",
        "surface-tint":               "#505f79",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#f8f2f0",
        "surface-container":          "#f3edeb",
        "surface-container-high":     "#ede7e5",
        "surface-container-highest":  "#e7e1df",

        "on-surface":                 "#1d1b1a",
        "on-surface-variant":         "#44474d",
        "inverse-surface":            "#32302f",
        "inverse-on-surface":         "#f5efed",

        "outline":                    "#75777e",
        "outline-variant":            "#c5c6ce",

        "error":                      "#ba1a1a",
        "on-error":                   "#ffffff",
        "error-container":            "#ffdad6",
        "on-error-container":         "#93000a",

        // ── Legacy brand alias (keeps admin pages working) ─────────────────
        brand: {
          DEFAULT: "#1b2a41",
          dark:    "#05152b",
          light:   "#394760",
        },
      },

      borderRadius: {
        DEFAULT: "0.25rem",   // 4px  — design system default
        sm:      "0.125rem",  // 2px
        lg:      "0.5rem",    // 8px  — cards
        xl:      "0.75rem",   // 12px — large containers
        "2xl":   "1rem",
        full:    "9999px",    // pills / FAB
      },

      spacing: {
        xs:              "4px",
        sm:              "12px",
        md:              "24px",
        lg:              "48px",
        xl:              "80px",
        gutter:          "24px",
        "margin-mobile": "16px",
        "margin-desktop":"64px",
        base:            "8px",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },

      fontSize: {
        "headline-xl":       ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg":       ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg-mobile":["28px", { lineHeight: "36px", fontWeight: "700" }],
        "headline-md":       ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg":           ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md":           ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-md":          ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-sm":          ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
      },

      maxWidth: {
        "8xl": "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
