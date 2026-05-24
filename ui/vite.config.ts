import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'

// When VITE_USE_CDN=true, Vite rewrites all asset URLs in HTML to point at the CDN.
// Set VITE_BASE_URL to the CDN origin (e.g. https://pub-xxx.r2.dev/ui).
// Defaults to false so Railway deployments serve assets from filesystem by default.
// The SSR build (isSsrBuild=true) always uses base:'/' — CDN asset URLs are
// irrelevant for the server-side render bundle.
export default defineConfig(({ isSsrBuild }) => {
  const useCDN = process.env.VITE_USE_CDN === 'true'
  const cdnBase = (process.env.VITE_BASE_URL || '').replace(/\/$/, '')
  const base = (!isSsrBuild && useCDN && cdnBase) ? `${cdnBase}/` : '/'

  return {
    base,
    plugins: [
      react(),
      // Compression only for the client bundle — SSR bundle is build-time only, never served
      ...(!isSsrBuild ? [
        compression({ algorithm: 'brotliCompress', exclude: [/\.(png|webp|jpg|gif|svg|woff2)$/], deleteOriginalAssets: false }),
        compression({ algorithm: 'gzip', exclude: [/\.(png|webp|jpg|gif|svg|woff2)$/], deleteOriginalAssets: false }),
      ] : []),
    ],
    server: {
      fs: { allow: ['..'] },
      proxy: {
        '/api': 'http://localhost:8000',
        '/slack': 'http://localhost:8000',
        '/health': 'http://localhost:8000',
      },
    },
    build: {
      outDir: 'dist',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          format: 'es',
          manualChunks(id) {
            // Core React runtime — cached forever, almost never changes
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
              return 'vendor-react'
            }
            // Router — changes only with react-router updates
            if (id.includes('/node_modules/react-router') || id.includes('/node_modules/@remix-run/')) {
              return 'vendor-router'
            }
            // Data-fetching — stable, changes infrequently
            if (id.includes('/node_modules/@tanstack/')) {
              return 'vendor-query'
            }
            // Icon library — large, tree-shaken per icon but still significant
            if (id.includes('/node_modules/lucide-react/')) {
              return 'vendor-lucide'
            }
            // Charting library — huge, only used in Analytics (already lazy)
            if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-') || id.includes('/node_modules/victory-') ) {
              return 'vendor-charts'
            }
            // Helmet for SEO
            if (id.includes('/node_modules/react-helmet')) {
              return 'vendor-helmet'
            }
          },
        },
      },
    },
  }
})
