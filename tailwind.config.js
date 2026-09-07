/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#161412',
        panel: '#211E1A',
        ivory: '#F4F1EA',
        mist: '#8F887C',
        bronze: '#C3A46B'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '4px'
      }
    }
  },
  plugins: []
}
