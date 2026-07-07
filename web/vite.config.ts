import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/ — set VITE_BASE at build time.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // forward API + SSE stream to the orchestration server
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
