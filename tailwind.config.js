/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        // 以 #BBAEE3 為主色的柔和紫系
        ink: '#1c1826',
        mute: '#5c566c',
        line: '#e4e0ec',
        soft: '#f6f5fa',
        panel: '#f1eef7',
        brand: {
          DEFAULT: '#8f7cc8',
          soft: '#ebe6f6',
          deep: '#7463b0'
        },
        /** 選中／進度／圓環高亮 */
        accent: '#BBAEE3', // = SELECT_COLOR；日曆／行程篩選／本週／進度條務必用 inline 或此色
        status: {
          done: '#4a9b7a',
          progress: '#c4a035',
          todo: '#c96b6b'
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
        soft: '0 8px 30px rgba(47, 43, 58, 0.06)'
      }
    }
  },
  plugins: []
}
