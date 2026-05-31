/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
        mono: ['var(--font-roboto-mono)', 'var(--font-noto-sans-kr)', 'monospace'],
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