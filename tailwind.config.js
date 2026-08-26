/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        mute: '#6b7280',
        line: '#e5e7eb',
        soft: '#f3f4f6',
        panel: '#eef2f6',
        brand: {
          DEFAULT: '#3b82a0',
          soft: '#d7e8f0',
          deep: '#2a6a84'
        },
        status: {
          done: '#22a06b',
          progress: '#e2a100',
          todo: '#e24b4a'
        }
      },
      fontFamily: {
        sans: [
          '"Noto Sans TC"',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'sans-serif'
        ]
      },
      boxShadow: {
        soft: '0 8px 30px rgba(31, 41, 55, 0.06)'
      }
    }
  },
  plugins: []
}
