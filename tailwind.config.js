const colors = require("./types/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,tsx}", "./src/features/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
