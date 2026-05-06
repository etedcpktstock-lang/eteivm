/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#0046AD",
        "on-primary": "#ffffff",
        "primary-container": "#D8E2FF",
        "on-primary-container": "#001A41",
        "secondary": "#001F41",
        "on-secondary": "#ffffff",
        "secondary-container": "#D6E3FF",
        "on-secondary-container": "#001B3E",
        "surface": "#F8F9FF",
        "on-surface": "#191C20",
        "background": "#F8F9FF",
        "on-background": "#191C20",
        "outline": "#74777F",
        "outline-variant": "#C4C6D0",
        "error": "#BA1A1A",
      },
      fontFamily: {
        "sans": ["Inter", "IBM Plex Sans Thai", "Prompt", "sans-serif"],
        "desktop": ["IBM Plex Sans Thai", "Prompt", "Inter", "sans-serif"],
        "headline": ["Inter", "IBM Plex Sans Thai", "Prompt", "sans-serif"],
        "body": ["Inter", "IBM Plex Sans Thai", "Prompt", "sans-serif"],
        "label": ["Inter", "IBM Plex Sans Thai", "Prompt", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "full": "9999px"
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "corporate"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
}
