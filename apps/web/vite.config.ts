import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:4420';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      host: '0.0.0.0',
      port: 5420,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
    preview: { port: 5421 },
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
              return 'react';
            if (/[\\/](recharts|d3-[a-z]+|victory-vendor)[\\/]/.test(id)) return 'charts';
            if (id.includes('@telegram-apps')) return 'telegram';
            return undefined;
          },
        },
      },
    },
  };
});
