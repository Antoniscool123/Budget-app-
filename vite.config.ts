import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // BASE_PATH sættes fx til "/mit-repo/" når appen ligger på GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Preview-miljøet kører appen i en iframe på en anden host.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
