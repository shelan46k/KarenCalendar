import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 路徑：若 repo 名稱是 KarenCalendar，base 需為 '/KarenCalendar/'
// 部署到自訂網域或 username.github.io 根目錄時改為 '/'
export default defineConfig({
  base: '/KarenCalendar/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Karen Calendar — 高效管理',
        short_name: 'KarenCalendar',
        description: '個人計劃與週時程管理，資料同步至 GitHub 私有儲存庫',
        theme_color: '#3b82a0',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'any',
        start_url: '/KarenCalendar/',
        scope: '/KarenCalendar/',
        lang: 'zh-Hant',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
})
