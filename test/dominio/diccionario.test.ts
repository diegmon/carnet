import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generarDiccionario } from '../../src/dominio/diccionario';
import { TABLAS } from '../../src/dominio/esquema';

describe('diccionario de datos', () => {
  it('documenta cada hoja y columna', () => {
    const md = generarDiccionario();
    for (const t of Object.values(TABLAS)) {
      expect(md).toContain(`## ${t.hoja}`);
      for (const c of t.columnas) expect(md).toContain(`| \`${c.nombre}\` |`);
    }
  });
  it('el archivo publicado está al día (correr npm run diccionario si falla)', () => {
    expect(readFileSync('docs/DICCIONARIO_DE_DATOS.md', 'utf8')).toBe(generarDiccionario());
  });
});
