/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from https://<user>.github.io/tars-gesture-robotics/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tars-gesture-robotics/' : '/',
  plugins: [react()],
  server: { port: 5173, host: 'localhost' },
  build: { chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
