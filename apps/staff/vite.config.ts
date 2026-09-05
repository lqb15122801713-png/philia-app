import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: '菲丽亚员工端',
        short_name: '菲丽亚员工',
        description: '菲丽亚宠物服务平台 · 员工端（服务执行）',
        theme_color: '#FBF7F2',
        background_color: '#FBF7F2',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      }),
    }),
  ],
  server: {
    host: true,
    port: 7102,
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
