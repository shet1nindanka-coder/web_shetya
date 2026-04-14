import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      colors: {
        brand: {
          50: "#f0f8ff",
          100: "#d6ebff",
          200: "#add8ff",
          300: "#7fbfff",
          400: "#4a9fff",
          500: "#1a7ef0",
          600: "#105ec0",
          700: "#11488f",
          800: "#15345f",
          900: "#112341"
        },
        accent: {
          gold: "#ffcf66",
          mint: "#73dcb9"
        }
      },
      boxShadow: {
        glow: "0 24px 60px rgba(13, 31, 58, 0.22)"
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top left, rgba(26, 126, 240, 0.26), transparent 36%), radial-gradient(circle at 80% 10%, rgba(255, 207, 102, 0.18), transparent 28%), linear-gradient(180deg, #f6fbff 0%, #edf4ff 52%, #f7f2ea 100%)"
      }
    }
  },
  plugins: []
};

export default config;
