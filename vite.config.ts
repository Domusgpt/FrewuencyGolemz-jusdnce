import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Get API key from environment variable (GitHub Actions) or .env file (local dev)
    const apiKey = process.env.API_KEY || env.GEMINI_API_KEY || env.API_KEY || '';
    return {
      // GitHub Pages base path - update 'FrewuencyGolemz-jusdnce' to match your repo name
      base: mode === 'production' ? '/FrewuencyGolemz-jusdnce/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: true
      }
    };
});
