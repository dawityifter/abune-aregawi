/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626', // Main Tigray red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
        },
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#fbbf24',
          700: '#f59e0b',
          800: '#d97706',
        },
        accent: {
          50: '#f5f3ef',
          100: '#ede9e3',
          200: '#e7d8c9',
          300: '#d6bfa7',
          400: '#bfa07a',
          500: '#92400e', // Deep ceremonial brown
          600: '#78350f',
          700: '#451a03',
        },
        neutral: {
          50: '#ffffff',
          100: '#fef7cd',
          200: '#fef3c7',
          300: '#f9fafb',
          400: '#e5e7eb',
          500: '#6b7280',
          600: '#374151',
        },
      },
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'tigrigna': ['Noto Sans Ethiopic', 'serif'],
      },
      fontSize: {
        'h1': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'h2': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'h3': ['1.375rem', { lineHeight: '2rem', fontWeight: '600' }],
        'h4': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '500' }],
        'body': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'nav': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

