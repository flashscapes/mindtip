import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        // Without this, the service worker's SPA fallback catches every
        // browser navigation that doesn't match a precached asset --
        // including a direct visit to an /api/ route -- and serves the
        // cached index.html shell instead of ever reaching the function.
        // Only affects direct browser navigation to a URL; fetch() calls
        // from within the running app were never affected by this.
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: 'MindTip',
        short_name: 'MindTip',
        description: 'A memory-driven wellbeing companion that remembers what actually helps you.',
        theme_color: '#E9F5F3',
        background_color: '#E9F5F3',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': '/src' }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
