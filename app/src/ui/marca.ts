import type { Perfil } from '../../../src/dominio/perfil';

/** Aplica los colores del perfil a la app (variables CSS y color de la barra del navegador). */
export function aplicarColores(colores: Perfil['colores'], doc: Document = document): void {
  const raiz = doc.documentElement.style;
  raiz.setProperty('--primario', colores.primario);
  raiz.setProperty('--primario-osc', colores.primarioOscuro);
  raiz.setProperty('--acento', colores.acento);
  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    doc.head.appendChild(meta);
  }
  meta.setAttribute('content', colores.primario);
}
