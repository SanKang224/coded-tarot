/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#000000',
          green: '#00FF41',
          white: '#FFFFFF',
        }
      },
      fontFamily: {
        mono: ['var(--font-roboto-mono)', 'monospace'],
        kr: ['var(--font-noto-sans-kr)', 'sans-serif'],
      },
      borderRadius: {
        terminal: '45px',
      }
    },
  },
  plugins: [],
};
export default config;