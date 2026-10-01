import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

describe('PWA', () => {
  it('el build produce manifiesto, service worker e íconos', () => {
    execSync('npm run build:app', { stdio: 'pipe', env: { ...process.env, PERFIL: 'perfil.ejemplo.json' } });
    const perfil = JSON.parse(readFileSync('perfil.ejemplo.json', 'utf8'));
    const manifiesto = JSON.parse(readFileSync('app-dist/manifest.webmanifest', 'utf8'));
    expect(manifiesto).toMatchObject({ name: 'Carnet de Atención', short_name: 'Carnet', display: 'standalone', theme_color: perfil.colores.primario, lang: 'es-MX' });
    expect(manifiesto.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(existsSync('app-dist/sw.js')).toBe(true);
    expect(readFileSync('app-dist/sw.js', 'utf8')).toMatch(/index\.html/);
    expect(readFileSync('app-dist/index.html', 'utf8')).toMatch(/manifest\.webmanifest/);
    for (const f of ['icono-192.png', 'icono-512.png', 'icono-maskable-512.png']) expect(existsSync(`app-dist/${f}`)).toBe(true);
  }, 60_000);
});
