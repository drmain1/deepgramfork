import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // secure: false, // Uncomment if backend is on https with self-signed cert
        // rewrite: (path) => path.replace(/^\/api/, '') // Use if backend doesn't expect /api
      },
    }
  }
})
