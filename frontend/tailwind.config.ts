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
        // Azerbaijan flag colors
        az: {
          blue: "#0092BC",
          red: "#EF3340",
          green: "#00B140",
        },
        brand: {
          DEFAULT: "#003DA5",
          dark: "#002d7a",
          light: "#1a57c2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
