import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/@tanstack/react-router/') || id.includes('/@tanstack/react-query/')) {
            return 'vendor-router';
          }
          if (id.includes('/@tremor/')) return 'vendor-charts';
          if (
            id.includes('/@radix-ui/') ||
            id.includes('/lucide-react/') ||
            id.includes('/class-variance-authority/') ||
            id.includes('/clsx/') ||
            id.includes('/tailwind-merge/')
          ) {
            return 'vendor-ui';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: Number.parseInt(process.env.FM_WORKBENCH_WEB_PORT || '4700', 10),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.FM_SERVER_PORT || '3700'}`,
        changeOrigin: true,
      },
    },
  },
});
