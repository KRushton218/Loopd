import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at any URL (e.g. GitHub Pages subpath).
  base: './',
  server: { port: 5173 },
})
