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
          bg:      "#F6F1E8",
          dark:    "#124E40",
          DEFAULT: "#1E8C6E",
          light:   "#D4EDE5",
          text:    "#233029",
          muted:   "#3A4A42",
          gold:    "#D4A24C",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["ui-serif", "Georgia", "serif"],
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

