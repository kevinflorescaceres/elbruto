import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
    // Vite rechaza cabeceras Host que no conoce. Esto deja pasar los tuneles de
    // ngrok para poder mirarlo desde el movil. Solo afecta al servidor de
    // desarrollo: en produccion sirve Fastify.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
  },
});
