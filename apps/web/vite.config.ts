import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Deja al lado de cada fichero de texto su version .br y .gz. Fastify los sirve
 * tal cual (`preCompressed` en apps/server/src/web.ts): comprimir una vez al
 * construir sale gratis, y en cada peticion costaria CPU. Sin esto el JS viaja
 * crudo, 450 KB donde bastan 120.
 */
function comprimir(): Plugin {
  let dir = '';
  return {
    name: 'camorra-comprimir',
    apply: 'build',
    configResolved(config) {
      dir = config.build.outDir.startsWith('/')
        ? config.build.outDir
        : join(config.root, config.build.outDir);
    },
    closeBundle() {
      const recorrer = (carpeta: string): void => {
        for (const nombre of readdirSync(carpeta)) {
          const ruta = join(carpeta, nombre);
          if (statSync(ruta).isDirectory()) recorrer(ruta);
          else if (/\.(js|css|svg|json|txt)$/.test(nombre) && statSync(ruta).size > 1024) {
            const datos = readFileSync(ruta);
            writeFileSync(
              `${ruta}.br`,
              brotliCompressSync(datos, {
                params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
              }),
            );
            writeFileSync(`${ruta}.gz`, gzipSync(datos, { level: 9 }));
          }
        }
      };
      recorrer(dir);
    },
  };
}

export default defineConfig({
  plugins: [react(), comprimir()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
    // Vite rechaza cabeceras Host que no conoce. Esto deja pasar los tuneles de
    // ngrok para poder mirarlo desde el movil. Solo afecta al servidor de
    // desarrollo: en produccion sirve Fastify.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
  },
});
