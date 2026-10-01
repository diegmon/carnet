import { describe, it, expect } from 'vitest';
import { TABLAS, TABLAS_SINCRONIZADAS, columnas, NombreTabla } from '../../src/dominio/esquema';
import { formatearFolio, verdadero } from '../../src/dominio/tipos';
import { normalizar } from '../../src/dominio/texto';

describe('esquema', () => {
  it('toda tabla sincronizada tiene las columnas base', () => {
    for (const t of TABLAS_SINCRONIZADAS) {
      expect(columnas(t).slice(0, 5)).toEqual(['id', 'creado_por', 'creado_en', 'servidor_en', '_rev']);
    }
  });
  it('no hay columnas repetidas y todas tienen descripción', () => {
    for (const t of Object.keys(TABLAS) as NombreTabla[]) {
      const cols = columnas(t);
      expect(new Set(cols).size).toBe(cols.length);
      for (const c of TABLAS[t].columnas) expect(c.descripcion.length).toBeGreaterThan(3);
    }
  });
  it('las hojas tienen nombres en mayúsculas únicos', () => {
    const hojas = Object.values(TABLAS).map(t => t.hoja);
    expect(new Set(hojas).size).toBe(hojas.length);
    for (const h of hojas) expect(h).toBe(h.toUpperCase());
  });
  it('usuarios, changelog, config y ops no se sincronizan', () => {
    for (const t of ['usuarios', 'changelog', 'config', 'ops'] as NombreTabla[]) {
      expect(TABLAS_SINCRONIZADAS).not.toContain(t);
    }
  });
});

describe('tipos y texto', () => {
  it('formatea folios con mínimo tres dígitos', () => {
    expect(formatearFolio(1)).toBe('CA-001');
    expect(formatearFolio(17)).toBe('CA-017');
    expect(formatearFolio(1234)).toBe('CA-1234');
  });
  it('reconoce verdadero en los formatos que devuelve Sheets', () => {
    expect(verdadero(true)).toBe(true);
    expect(verdadero('TRUE')).toBe(true);
    expect(verdadero('true')).toBe(true);
    expect(verdadero(false)).toBe(false);
    expect(verdadero('')).toBe(false);
    expect(verdadero(undefined)).toBe(false);
  });
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(normalizar('  María   Ríos ')).toBe('maria rios');
    expect(normalizar('ÁLVARO OBREGÓN')).toBe('alvaro obregon');
  });
});
