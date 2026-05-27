import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [react(), devvit()],
  server: {
    hmr: false, // Disable HMR to avoid CSP blob: script violations in Devvit webview
  },
  build: {
    sourcemap: false, // Disable sourcemaps to reduce CSP issues
  },
});
