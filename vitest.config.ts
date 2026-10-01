// Las pruebas corren en una zona fija (no UTC) para que las de fechas locales no pasen por casualidad.
process.env.TZ = 'America/Mexico_City';

import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [preact()],
  // Las pruebas siempre usan el perfil genérico de ejemplo.
  resolve: { alias: { '@perfil': fileURLToPath(new URL('./perfil.ejemplo.json', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts', 'test/**/*.test.tsx'] },
});
