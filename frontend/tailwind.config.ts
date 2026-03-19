import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        insta: {
          orange: "#F58529",
          pink: "#DD2A7B",
          purple: "#8134AF",
        },
        voxa: {
          primary: "#0A0A0F",
          card: "#12121A",
          "card-hover": "#16161F",
          accent: "#7C3AED",
          "accent-hover": "#6D28D9",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-instagram":
          "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
        "gradient-voxa":
          "linear-gradient(135deg, #7C3AED 0%, #0A0A0F 100%)",
        "gradient-story":
          "linear-gradient(45deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
