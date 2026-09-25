import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8081',
      '/healthz': 'http://127.0.0.1:8081',
      '/readyz': 'http://127.0.0.1:8081',
    },
  },
  build: { outDir: '../dist/client', emptyOutDir: true },
});
