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
      },
      backgroundImage: {
        "gradient-instagram":
          "linear-gradient(45deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
