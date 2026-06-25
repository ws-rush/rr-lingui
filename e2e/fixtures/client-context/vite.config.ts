import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

// Minimal Vite setup. Catalogs are plain objects in app/lib/i18n.ts (predictable
// ids, no Lingui macro/hashing), so no Lingui Vite plugin is needed.
export default defineConfig({
  plugins: [reactRouter()],
  cacheDir: './.vite',
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@lingui/core',
      '@lingui/react',
      'rr-lingui',
    ],
  },
})
