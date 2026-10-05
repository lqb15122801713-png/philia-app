import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      // 离线兜底（体验批片 4 开口项 3 裁，实证修正）：SPA 壳 navigateFallback='/index.html'
      // ——字面「navigateFallback→静态离线页」在 SPA 下会接管全部深链导航（review-e2e 抓到
      // /appointments/:id 渲染离线页的实证），故裁为双轨：壳预缓存离线可开 + offline.html
      // 预缓存直连（/offline.html 直访=品牌离线页；净网导航回退壳，壳内 ErrorState 兜数据态）。
      // API/trpc 请求不兜底（denylist），预缓存范围限定静态产物（含 offline.html）
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/trpc\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: '菲丽亚宠物',
        short_name: '菲丽亚宠物',
        description: '菲丽亚宠物服务平台 · 客户端',
        theme_color: '#F6F1E3',
        background_color: '#F6F1E3',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 7100,
    // 开发代理：签名图片等相对 /api 路径转发到后端（生产由同源反代处理）
    proxy: {
      '/api': { target: 'http://localhost:7200', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
