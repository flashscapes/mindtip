/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#E9F5F3',
        panel: '#FFFFFF',
        ivory: '#14201F',
        mist: '#44605F',
        bronze: '#B8935A'
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
