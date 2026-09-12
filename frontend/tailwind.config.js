/** @type {import('tailwindcss').Config} */

// "Brana" design tokens — see the design direction doc.
//
// The palette is borrowed from Ge'ez manuscript illumination and Tigray rock-church
// fresco rather than from generic church-website red: parchment ground, rubric
// vermilion, ochre gold, and a chalky blue-green that gives the palette a cool pole
// so "this is information" can look different from "this is an action".
//
// The scale NAMES are deliberately unchanged (primary/secondary/accent/neutral).
// `primary-*` alone appears ~430 times in this codebase, so re-pointing the scales
// restyles most of the app in one edit without touching a single component.
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Qeyih (ቀይሕ) — manuscript rubric red. Replaces Tailwind's #dc2626, which
        // is a browser-error red. 700 is the canonical vermilion and the one
        // .btn-primary and the nav use: white on it is 7.4:1.
        primary: {
          50: '#fcf4f2',
          100: '#f7e3df',
          200: '#edc8c1',
          300: '#dea79d',
          400: '#c97e72',
          500: '#b65349',
          600: '#a93a32',
          700: '#9e2b25', // canonical vermilion
          800: '#7e221d', // hover / gradient end
        },
        // Werq (ወርቂ) — ochre gold. The 400-600 steps are SURFACE colours and must
        // carry ink text, never white: white on 600 is 2.0:1, which is what the
        // old amber button was failing at. 700/800 are the text-safe steps for
        // ochre type on a light ground (5.2:1).
        secondary: {
          50: '#fdf7e9',
          100: '#f8ebc8',
          200: '#f0d99a',
          300: '#e3c066',
          400: '#d2a845',
          500: '#c89a3c', // gold surface — ink text is 6.3:1
          600: '#b8842b',
          700: '#8a5f16', // text-safe on light
          800: '#6b4810',
        },
        // The warm neutral ramp. Body text is text-accent-700 (ink) and borders are
        // border-accent-200, so this scale carries most of the app's quiet surface.
        accent: {
          50: '#fbf8f1',  // wax — raised surface
          100: '#f4efe3',
          200: '#e3dbc9', // borders
          300: '#cfc4ac',
          400: '#a99c88', // muted labels
          500: '#6f6557', // muted text
          600: '#4a4238',
          700: '#241f19', // ink — body text
        },
        neutral: {
          50: '#ede7d9',  // brana — the page ground
          100: '#f4efe3',
          200: '#e3dbc9',
          300: '#fbf8f1', // wax
          400: '#cfc4ac',
          500: '#6f6557',
          600: '#4a4238',
        },
        // Tsaeda — fresco verdigris. New scale, opt-in: nothing currently uses it,
        // so adding it disturbs nothing. This is the "informational, not an action"
        // pole the palette has never had.
        tsaeda: {
          50: '#eaf2f0',
          100: '#dbe7e4',
          200: '#b8cecb',
          300: '#8db3ae',
          400: '#5b918b',
          500: '#3c7a74',
          600: '#2e5e5a',
          700: '#25514d',
          800: '#1c3d3a',
        },
      },
      fontFamily: {
        // Literata is chosen to sit beside Noto Serif Ethiopic: both are vertical,
        // low-contrast and even in colour. Ethiopic picks the Latin face here, not
        // the other way round.
        'serif': ['Literata', 'Georgia', 'Times New Roman', 'serif'],
        // IBM Plex Sans ships tabular figures, which a dues-and-ledger app needs.
        'sans': ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        'tigrigna': ['Noto Serif Ethiopic', 'Literata', 'serif'],
        'tigrigna-sans': ['Noto Sans Ethiopic', 'IBM Plex Sans', 'sans-serif'],
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
      // Three shapes, not four radii applied by whoever wrote the component.
      // Square-ish is the default for everything; `full` stays for pills and
      // avatars; `arch` is the Aksumite window silhouette and is allowed on at
      // most one element per page.
      borderRadius: {
        'md': '3px',
        'lg': '3px',
        'xl': '4px',
        '2xl': '4px',
        '3xl': '6px',
        'arch': '46% 46% 6px 6px / 26% 26% 6px 6px',
      },
      // Two elevations. Flat for everything that sits on the page, raised for the
      // few things that genuinely float (sheets, modals, sticky bars).
      boxShadow: {
        'sm': '0 1px 2px rgba(36, 31, 25, 0.06)',
        'md': '0 1px 2px rgba(36, 31, 25, 0.06)',
        'lg': '0 1px 2px rgba(36, 31, 25, 0.06), 0 8px 24px -12px rgba(36, 31, 25, 0.22)',
        'xl': '0 1px 2px rgba(36, 31, 25, 0.06), 0 8px 24px -12px rgba(36, 31, 25, 0.22)',
        '2xl': '0 1px 2px rgba(36, 31, 25, 0.06), 0 8px 24px -12px rgba(36, 31, 25, 0.22)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        // The status-bar/Dynamic Island inset. index.html sets
        // viewport-fit=cover with a black-translucent status bar, so in the
        // installed PWA the page renders UNDERNEATH it — a fixed bar at top:0
        // is simply not visible. Mobile Safari hides this, because its own
        // chrome pushes content down; only a real notched device in
        // standalone mode shows it.
        'safe-t': 'env(safe-area-inset-top)',
        // Top nav height (4rem) plus that inset. Page wrappers use this to
        // clear the fixed nav; a literal pt-16 leaves their first 47-59px
        // hidden behind it on a notched phone.
        'top-nav': 'calc(4rem + env(safe-area-inset-top))',
        // Bar height (4rem) plus the home-indicator inset. Used as bottom
        // padding on page content so the bar never covers the last element.
        'bottom-nav': 'calc(4rem + env(safe-area-inset-bottom))',
        // Same, plus a small gap, for fixed/sticky page chrome (FABs, sticky
        // CTAs) that needs to clear the bar rather than sit flush under it.
        'above-nav': 'calc(4.5rem + env(safe-area-inset-bottom))',
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
