import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // Raise warning threshold (optional)
      chunkSizeWarningLimit: 1500,

      rollupOptions: {
        // ✅ merge everything here
        external: ["react-helmet-async"],
        output: {
manualChunks: {
  vendor: ["react", "react-dom"],
  emailService: [path.resolve(__dirname, "src/services/emailService.ts")],
  smsService: [path.resolve(__dirname, "src/services/smsService.ts")],
}
        },
      },
    },
  };
});
