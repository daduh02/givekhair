import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        green: {
          50:  "#E1F5EE",
          100: "#9FE1CB",
          200: "#5DCAA5",
          500: "#1D9E75",
          600: "#0F6E56",
          700: "#0F6E56",
          800: "#085041",
          900: "#04342C",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
