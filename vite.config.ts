import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { rutaPerfil, leerPerfil } from './scripts/perfil.mjs';

const perfil = leerPerfil();

export default defineConfig({
  root: 'app',
  base: './',
  build: { outDir: '../app-dist', emptyOutDir: true },
  resolve: { alias: { '@perfil': rutaPerfil() } },
  plugins: [
    preact(),
    { name: 'perfil-html', transformIndexHtml: (html: string) => html.replace('__COLOR_PRIMARIO__', perfil.colores.primario) },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Carnet de Atención',
        short_name: 'Carnet',
        description: 'Gestión de casos y seguimiento de acuerdos para el servicio público.',
        lang: 'es-MX',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FBF8F3',
        theme_color: perfil.colores.primario,
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,webmanifest}'], navigateFallback: 'index.html' },
    }),
  ],
});
