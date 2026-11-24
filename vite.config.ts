import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  root: 'apps/web',
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    // Phaser is loaded as a separate chunk only when entering the workshop.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
