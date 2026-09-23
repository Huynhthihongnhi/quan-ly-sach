import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { defineConfig } from 'vite';

const port = Number(process.env.CMS_PORT ?? 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('CMS_PORT must be an integer between 1 and 65535');
}

export default defineConfig({
  base: '/cms/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      src: path.resolve(__dirname, './src'),
    },
  },
  server: {
    port,
    strictPort: true,
    host: true,
    // Cho phep cloudflared quick tunnel (https://<random>.trycloudflare.com) toi dev server.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
