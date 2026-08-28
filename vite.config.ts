import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/binance': {
        target: 'https://data-api.binance.vision',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/binance/, '/api/v3'),
        secure: false,
      },
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        secure: false,
      },
    },
  },
});
