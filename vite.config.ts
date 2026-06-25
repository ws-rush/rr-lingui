import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-router',
        '@lingui/core',
        '@lingui/react',
        'react/jsx-runtime',
        'react-dom/server',
      ],
    },
    sourcemap: true,
    minify: false,
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.build.json',
      rollupTypes: true,
    }),
  ],
})
