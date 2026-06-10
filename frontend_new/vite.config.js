import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react(),
    basicSsl()   // ← 启用 HTTPS
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:53840',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:53840',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})