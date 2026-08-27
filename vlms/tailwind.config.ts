import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3f8', 100: '#d6e2ee', 200: '#adc4dc', 300: '#7fa2c5',
          400: '#4d7ba9', 500: '#2b5b8c', 600: '#1c4570', 700: '#12304f',
          800: '#0d2440', 900: '#0a1b31',
        },
        teal: {
          50: '#e9f6f7', 100: '#c7e9eb', 200: '#8fd3d8', 300: '#52b7bf',
          400: '#2596a0', 500: '#0e7c86', 600: '#0b636c', 700: '#094f56',
          800: '#073c42', 900: '#052a2f',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
