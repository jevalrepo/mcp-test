/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        banorte: {
          950: "#610000",
          800: "#9c0720",
          600: "#dc143c",
          400: "#f1666d",
          200: "#ff9ea2",
        },
      },
    },
  },
  plugins: [],
}

