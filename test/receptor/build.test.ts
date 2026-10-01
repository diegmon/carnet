import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('empaquetado del receptor', () => {
  it('genera un archivo que Apps Script puede cargar con doPost, doGet y setup globales', () => {
    execSync('node scripts/build-receptor.mjs', { stdio: 'pipe' });
    const codigo = readFileSync('receptor-dist/receptor.js', 'utf8');
    expect(codigo).not.toMatch(/\brequire\(|\bimport\s/);
    const globales = new Function(`${codigo}; return { doPost: typeof doPost, doGet: typeof doGet, setup: typeof setup };`)();
    expect(globales).toEqual({ doPost: 'function', doGet: 'function', setup: 'function' });
    const manifiesto = JSON.parse(readFileSync('receptor-dist/appsscript.json', 'utf8'));
    expect(manifiesto.timeZone).toBe('America/Mexico_City');
    expect(manifiesto.webapp.access).toBe('ANYONE_ANONYMOUS');
  });
});
