import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  // @foodbook/shared e un workspace CJS (buildul lui trebuie sa ramana
  // CommonJS pentru backend/NestJS) - fara asta, Vite il trateaza ca sursa
  // proprie si nu ii poate rezolva static export-urile numite.
  optimizeDeps: {
    include: ['@foodbook/shared'],
  },
})
