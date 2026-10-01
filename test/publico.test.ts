import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Guardia del repositorio público: nada versionado puede mencionar a la institución que usa
 * Carnet de Atención ni catálogos locales. Eso vive en el perfil privado (privado/perfil.json).
 */
const PROHIBIDO = /secgob|secretar[ií]a de gobierno|caibp|fipede|cdmx|ciudad de m[eé]xico|iztapalapa|inegi/i;
const EXCLUIDOS = new Set(['package-lock.json', 'test/publico.test.ts']);

describe('repositorio público', () => {
  it('ningún archivo versionado menciona a la institución ni catálogos locales', () => {
    const archivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f && !EXCLUIDOS.has(f));
    const hallazgos: string[] = [];
    for (const f of archivos) {
      if (PROHIBIDO.test(f)) hallazgos.push(`${f} (nombre de archivo)`);
      let contenido: Buffer;
      try { contenido = readFileSync(f); } catch { continue; }
      if (contenido.includes(0)) continue;
      contenido.toString('utf8').split('\n').forEach((linea, i) => { if (PROHIBIDO.test(linea)) hallazgos.push(`${f}:${i + 1}`); });
    }
    expect(hallazgos).toEqual([]);
  });
});
