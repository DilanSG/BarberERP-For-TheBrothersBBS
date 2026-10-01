import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  publicDir: 'public',  // Explícitamente especificar el directorio public
  
  // Configuración de construcción optimizada
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: false,
    // exceljs (~939KB) se carga lazy solo al exportar Excel; el resto de chunks son < 500KB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react', 'react-toastify'],
          utils: ['date-fns'],
          // exceljs se carga dinámico via import() en Inventory — chunk separado (Fase 5)
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          let extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          } else if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            extType = 'fonts';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    }
  },
  
  // Configuración del servidor de desarrollo
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    cors: true,
    hmr: {
      port: 5173,
      host: 'localhost'
    },
    watch: {
      usePolling: false,
      interval: 100
    },
    // Proxy para desarrollo local si es necesario
    proxy: process.env.NODE_ENV === 'development' ? {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    } : undefined
  },
  
  // Configuración de dependencias optimizada para Vite 4.x
  optimizeDeps: {
    force: false,
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'date-fns',
      'lucide-react',
      'react-toastify',
      'react-calendar',
      'react-day-picker',
      'exceljs',
      'gsap',
      '@gsap/react'
    ]
  },
  
  // Configuración de resolución — fluido: path.resolve evita /src absoluto roto en CI/Docker
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@utils': path.resolve(__dirname, './src/shared/utils'),
      '@components': path.resolve(__dirname, './src/shared/components'),
      '@hooks': path.resolve(__dirname, './src/shared/hooks'),
      '@services': path.resolve(__dirname, './src/shared/services'),
      '@contexts': path.resolve(__dirname, './src/shared/contexts'),
      '@recurring-expenses': path.resolve(__dirname, './src/shared/recurring-expenses')
    }
  },
  
  // Variables de entorno
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  }
})
