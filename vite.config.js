import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '127.0.0.1',
    warmup: {
      clientFiles: [
        './src/pages/Login.jsx',
        './src/lib/AuthContext.jsx',
        './src/components/LanguageProvider.jsx',
      ],
    },
    proxy: {
      "/yahoo-chart": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/yahoo-chart/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('framer-motion')) return 'motion';
        },
      },
    },
  },
});
