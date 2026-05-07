/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tell Tailwind which files to scan for class names.
  // Anything not found in these files won't be in the output CSS.
  content: [
    './src/**/*.html',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        brand:   { DEFAULT: '#7c3aed', dark: '#563b82' },
        teal:    { DEFAULT: '#0d9488', dark: '#0f766e' },
        danger:  { DEFAULT: '#dc3545', light: '#ef4444' },
        success: { DEFAULT: '#10b981', dark: '#059669' },
        text:    { primary: '#1a1a2e', secondary: '#64748b', tertiary: '#475569', muted: '#94a3b8' },
        surface: '#f8f9fa',
        subtle:  '#f8fafc',
        border:  { DEFAULT: '#e9ecef', light: '#e2e8f0', subtle: '#f1f5f9', medium: '#cbd5e1' },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        elevated: '0 4px 24px rgba(0,0,0,0.08)',
        heavy: '0 8px 25px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        card: '12px',
        pill: '24px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
    },
  },
  plugins: [],
};