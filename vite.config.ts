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
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-router-dom")) return "reactRouter";
              if (id.includes("react") || id.includes("react-dom"))
                return "reactCore";
              if (id.includes("motion")) return "animations";
              if (id.includes("firebase")) return "firebase";
              if (id.includes("recharts")) return "recharts";
              if (id.includes("@stripe") || id.includes("stripe-js"))
                return "stripe";
              if (id.includes("twilio")) return "twilio";
              if (id.includes("@react-google-maps")) return "googleMaps";
              if (id.includes("@google/genai")) return "genai";
              if (id.includes("date-fns")) return "dateFns";
              if (id.includes("lucide-react")) return "lucide";
              return "vendor";
            }
          },
        },
      },
    },
  };
});
