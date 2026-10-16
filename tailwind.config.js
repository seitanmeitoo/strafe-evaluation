/** @type {import('tailwindcss').Config} */

// Theme colors are CSS variables (RGB channels) defined in src/App.css for the light
// theme (:root) and the dark theme (.dark), so Tailwind opacity modifiers keep working.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: token("surface"),
        panel: token("panel"),
        card: token("card"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        key: token("key"),
        "key-edge": token("key-edge"),
        "key-on": token("key-on"),
      },
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
