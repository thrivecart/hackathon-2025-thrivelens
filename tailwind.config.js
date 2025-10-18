/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color scheme matching the original design
        'bg': 'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        'text': 'var(--text)',
        'muted': 'var(--muted)',
        'border': 'var(--border)',
        'accent': 'var(--accent)',
        'accent-2': 'var(--accent-2)',
      },
      fontFamily: {
        sans: [
          'Manrope',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      maxWidth: {
        'container': '960px',
        'chat': '820px',
      },
      borderRadius: {
        'card': '14px',
        'button': '10px',
        'composer': '16px',
        'message': '14px',
      },
      spacing: {
        'container': '24px',
      }
    },
  },
}
