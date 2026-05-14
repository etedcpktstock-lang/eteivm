import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('jspdf') || id.includes('autotable') || id.includes('file-saver')) return 'vendor-pdf-export'
          if (id.includes('html2canvas')) return 'vendor-capture'
          if (id.includes('@zxing') || id.includes('qr-scanner')) return 'vendor-scan'
          if (id.includes('dompurify')) return 'vendor-sanitize'
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
