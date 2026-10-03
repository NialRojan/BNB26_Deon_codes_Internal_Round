import autoprefixer from 'autoprefixer'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Contract ABI + addresses shared with the backend (source of truth: contracts/, Member 2)
      '@heirloom/contracts': fileURLToPath(new URL('../../../packages/shared/src/contracts/index.ts', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  build: {
    cssMinify: 'esbuild',
  },
})
