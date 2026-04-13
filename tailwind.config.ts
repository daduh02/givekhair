/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          sand: "#F8F5EF",
          primary: "#0F766E",
          primaryDark: "#115E59",
          primarySoft: "#CCFBF1",
          gold: "#D4A017",
          goldSoft: "#FEF3C7",
          ink: "#0F172A",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        xl:  "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 4px 24px rgba(18,78,64,0.08)",
      },
    },
  },
  plugins: [],
};
