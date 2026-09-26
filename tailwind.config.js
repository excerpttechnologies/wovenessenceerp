// /** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: [
//     './app/**/*.{js,jsx}',
//     './components/**/*.{js,jsx}',
//     './config/**/*.{js,jsx}',
//   ],
//   theme: {
//     extend: {
//       colors: {
//         // pulled from the live Orbit ERP UI
//         sidebar: {
//           DEFAULT: '#1e2a4a',
//           active: '#2a3860',
//           hover: '#24314f',
//           text: '#cfd6e6',
//           muted: '#97a3bd',
//           track: '#16203a',
//         },
//         page: '#eef1f7',
//         ink: '#223047',
//         inkmuted: '#6b7a94',
//         cell: '#46556f',
//         line: '#e3e8f0',
//         linestrong: '#d5dce8',
//         brand: {
//           DEFAULT: '#2b57b0',
//           hover: '#244a97',
//           link: '#3b6fd4',
//           logo: '#1c3f7c',
//         },
//         thead: '#f7f9fc',
//         rowalt: '#fafbfd',
//         okgreen: '#1f9254',
//         okgreenbg: '#e6f5ec',
//         pillgrey: '#eceff4',
//         danger: '#d3372f',
//         warnyellow: '#e5b100',
//       },
//       fontFamily: {
//         sans: ['"Nunito Sans"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
//       },
//       spacing: { sidebar: '280px', topbar: '64px' },
//       boxShadow: { pop: '0 8px 24px rgba(20,30,60,.14)' },
//     },
//   },
//   plugins: [],
// };




/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./config/**/*.{js,jsx}",
  ],
  /* PILL COLOURS ARE BUILT BY CONCATENATION, so the scanner never sees
     them. ListView's `badges` column format renders
     "pill pill-" + col.tone(value), and ReportView does the same - which
     means the finished class name exists nowhere in the source and
     Tailwind strips the rule out of @layer components as unused. The pill
     then renders with no background at all.

     pill-green and pill-red survive today only because a few screens
     happen to write them out in full (roles-permissions/fields.js). This
     list makes that reliable for every tone rather than accidental. */
  safelist: ["pill-green", "pill-grey", "pill-blue", "pill-red", "pill-yellow"],
  theme: {
    extend: {
      colors: {
        // pulled from the live Orbit ERP UI
        sidebar: {
          DEFAULT: "#030531",
          active: "#2a3860",
          hover: "#24314f",
          text: "#cfd6e6",
          muted: "#97a3bd",
          track: "#16203a",
        },
        page: "#eef1f7",
        ink: "#223047",
        inkmuted: "#6b7a94",
        cell: "#46556f",
        line: "#e3e8f0",
        linestrong: "#d5dce8",
        brand: {
          DEFAULT: "#2b57b0",
          hover: "#244a97",
          link: "#3b6fd4",
          logo: "#1c3f7c",
        },
        thead: "#f7f9fc",
        rowalt: "#fafbfd",
        okgreen: "#1f9254",
        okgreenbg: "#e6f5ec",
        pillgrey: "#eceff4",
        danger: "#d3372f",
        warnyellow: "#e5b100",
      },
      fontFamily: {
        sans: [
          '"Nunito Sans"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      spacing: { sidebar: "280px", topbar: "64px" },
      boxShadow: {
        pop: "0 8px 24px rgba(20,30,60,.14)",
        "purple-glow": "0 20px 60px -20px rgba(79,70,229,0.15)",
        "purple-glow-lg": "0 30px 80px -20px rgba(79,70,229,0.25)",
      },
      animation: {
        // Floating effects
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float-delayed 7s ease-in-out infinite",

        // Pulsing effects
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",

        // Gradient animations
        gradient: "gradient-shift 3s ease-in-out infinite",
        "gradient-slow": "gradient-shift 6s ease-in-out infinite",

        // Entrance animations
        "fade-in": "fade-in 0.8s ease-out forwards",
        "fade-up": "fade-up 0.8s ease-out forwards",
        "fade-down": "fade-down 0.8s ease-out forwards",
        "slide-up": "slide-up 0.6s ease-out forwards",
        "slide-down": "slide-down 0.6s ease-out forwards",
        "slide-left": "slide-left 0.6s ease-out forwards",
        "slide-right": "slide-right 0.6s ease-out forwards",

        // Scale animations
        "scale-in": "scale-in 0.5s ease-out forwards",
        "scale-in-soft": "scale-in-soft 0.7s ease-out forwards",

        // Pattern animations
        pattern: "pattern-shift 20s linear infinite",
        "pattern-slow": "pattern-shift 30s linear infinite",

        // Shimmer effect
        shimmer: "shimmer 2s ease-in-out infinite",

        // Rotate effects
        "spin-slow": "spin 8s linear infinite",
        "spin-reverse": "spin 4s linear infinite reverse",

        // Bounce effects
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",

        // Text effects
        typing: "typing 3s steps(40) 1s forwards",
        blink: "blink 1s step-end infinite",

        // Loading effects
        "loading-pulse": "loading-pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        // Floating animations
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },

        // Pulsing animations
        "pulse-slow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },

        // Gradient animations
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },

        // Entrance animations
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-left": {
          from: { opacity: "0", transform: "translateX(30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-right": {
          from: { opacity: "0", transform: "translateX(-30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },

        // Scale animations
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.8)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-in-soft": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },

        // Pattern animations
        "pattern-shift": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "48px 48px" },
        },

        // Shimmer effect
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },

        // Bounce effects
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },

        // Text effects
        typing: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },

        // Loading effects
        "loading-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.95)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        "bounce-custom": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        2000: "2000ms",
        3000: "3000ms",
      },
      transformOrigin: {
        "center-center": "center center",
      },
      rotate: {
        2: "2deg",
        "-2": "-2deg",
      },
    },
  },
  plugins: [],
};
