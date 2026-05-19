import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
    // No proxy needed: VITE_API_URL points directly to the Node.js backend.
    // Keep this block if you ever want to fall back to Cloudflare wrangler:
    // proxy: { '/api': { target: 'http://localhost:8788', changeOrigin: true } },
  },
  build: {
    outDir: '../dist',     // repo-root dist/, sibling to functions/
    emptyOutDir: true,
    // pdfjs-dist v4 ships with top-level await in its worker; needs es2022.
    target: 'es2022',
  },
  optimizeDeps: {
    // Same reason — Vite's pre-bundle step needs to allow tla too.
    esbuildOptions: { target: 'es2022', supported: { 'top-level-await': true } },
  },
});
