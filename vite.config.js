import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
        theme_color: '#BBAEE3',
        background_color: '#f1eef7',
        display: 'standalone',
        orientation: 'any',
        // 不設 start_url，iOS「加入主畫面」才會記住各入口頁網址（計時捷徑等）
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
    }),
    {
      name: 'strip-manifest-start-url',
      closeBundle() {
        const path = join('dist', 'manifest.webmanifest')
        const manifest = JSON.parse(readFileSync(path, 'utf8'))
        delete manifest.start_url
        writeFileSync(path, JSON.stringify(manifest))
      }
    }
  ]
})
