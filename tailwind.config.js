/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stuw: {
          obsidian: '#131413',
          obsidianLight: '#1C1D1B',
          canvas: '#FBF9F5',
          sand: '#EFECE5',
          sandLight: '#F5F2EB',
          sandDark: '#DFDAD0',
          sage: '#586255',
          sageLight: '#E8ECE6',
          sageDark: '#3E463C',
          champagne: '#B8A28E',
          champagneLight: '#F3EFEA',
          border: '#E5E0D7',
          borderDark: '#2E302D',
          slate: '#7C827D'
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'luxury-sm': '0 4px 20px -2px rgba(19, 20, 19, 0.04)',
        'luxury-md': '0 12px 32px -4px rgba(19, 20, 19, 0.06)',
        'luxury-lg': '0 24px 48px -8px rgba(19, 20, 19, 0.08)',
      }
    },
  },
  plugins: [],
};
