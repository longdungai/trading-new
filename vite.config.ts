import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lightweight-charts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('/src/services/ai/') || id.includes('\\src\\services\\ai\\')) {
            return 'kronos-ai-engine';
          }
        },
      },
    },
  },
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
      '/api/fapi': {
        target: 'https://fapi.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fapi/, ''),
        secure: false,
      },
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        secure: false,
      },
      '/api/entrade': {
        target: 'https://services.entrade.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/entrade/, ''),
        secure: false,
      },
      '/api/vndirect': {
        target: 'https://api-finfo.vndirect.com.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vndirect/, ''),
        secure: false,
      },
      '/api/simplize': {
        target: 'https://api2.simplize.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/simplize/, ''),
        secure: false,
      },
      '/api/fred': {
        target: 'https://fred.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fred/, ''),
        secure: false,
      },
      '/api/deribit': {
        target: 'https://www.deribit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deribit/, ''),
        secure: false,
      },
      '/api/cboe': {
        target: 'https://cdn.cboe.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cboe/, ''),
        secure: false,
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
        secure: false,
      },
      '/api/llama': {
        target: 'https://stablecoins.llama.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llama/, ''),
        secure: false,
      },
      '/api/nasdaq': {
        target: 'https://api.nasdaq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nasdaq/, ''),
        secure: false,
        headers: {
          Origin: 'https://www.nasdaq.com',
          Referer: 'https://www.nasdaq.com/',
        },
      },
    },
  },
});
