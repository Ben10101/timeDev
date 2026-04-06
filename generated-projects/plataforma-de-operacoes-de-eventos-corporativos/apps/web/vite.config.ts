import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins: [react()],
 server: {
  proxy: {
   '/api': {
    target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
    changeOrigin: true,
   },
  },
 },
 build: {
 rollupOptions: {
 output: {
 manualChunks(id) {
 if (!id.includes('node_modules')) return;
 if (id.includes('react-router-dom')) return 'router';
 if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
 },
 },
 },
 },
});
