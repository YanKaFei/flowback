import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1320px" },
    },
    extend: {
      colors: {
        canvas: "#F8F6F1",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#1B1C1E",
          soft: "#3B3D3A",
          muted: "#74766D",
          faint: "#A3A59B",
        },
        line: {
          DEFAULT: "#E6E2D8",
          strong: "#D5D0C3",
        },
        signal: {
          DEFAULT: "#C9F24E",
          strong: "#AEE31F",
          soft: "#F1FBD2",
          ink: "#3C4A12",
        },
        risk: {
          DEFAULT: "#DE5A26",
          strong: "#B84315",
          soft: "#FBEDE4",
          border: "#F0C9B3",
        },
        ok: {
          DEFAULT: "#2C7A4B",
          soft: "#E7F4EA",
          border: "#BFE0C9",
        },
        info: {
          DEFAULT: "#3F5F8A",
          soft: "#EDF2F9",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Noto Sans SC",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(27,28,30,0.04), 0 12px 32px -24px rgba(27,28,30,0.35)",
        lift: "0 2px 0 0 rgba(27,28,30,0.03), 0 22px 48px -28px rgba(27,28,30,0.45)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.6)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "sweep": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-dot": "pulse-dot 2.4s ease-in-out infinite",
        sweep: "sweep 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
