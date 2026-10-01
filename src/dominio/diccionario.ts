import { TABLAS } from './esquema';

export function generarDiccionario(): string {
  const partes = [
    '# Diccionario de datos · Carnet de Atención',
    '',
    'Generado desde `src/dominio/esquema.ts` (`npm run diccionario`). No editar a mano.',
    '',
    'Formatos: fechas ISO 8601, texto UTF-8, exportable a CSV. Las zonas usan las claves del catálogo del perfil.',
    'Este documento describe la estructura; **los datos personales nunca son datos abiertos**.',
    '',
  ];
  for (const t of Object.values(TABLAS)) {
    partes.push(`## ${t.hoja}`, '', t.descripcion, '', '| Columna | Descripción |', '|---|---|');
    for (const c of t.columnas) partes.push(`| \`${c.nombre}\` | ${c.descripcion.replace(/\|/g, '\\|')} |`);
    partes.push('');
  }
  return partes.join('\n');
}
