import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
