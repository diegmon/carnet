import { describe, it, expect } from 'vitest';
import { PERFIL } from '../../src/dominio/perfil';

describe('perfil (en pruebas siempre el de ejemplo)', () => {
  it('es el perfil genérico de ejemplo', () => {
    expect(PERFIL.institucion).toBe('MI INSTITUCIÓN');
    expect(PERFIL.prefijoFolio).toBe('CA-');
    expect(PERFIL.etiquetaZona).toBe('Zona');
  });
  it('tiene ids únicos y sus áreas apuntan a instituciones existentes', () => {
    const ids = PERFIL.instituciones.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of PERFIL.instituciones) if (i.area_de) expect(ids).toContain(i.area_de);
    expect(new Set(PERFIL.zonas.map(z => z.clave)).size).toBe(PERFIL.zonas.length);
  });
  it('colores en formato #RRGGBB', () => {
    for (const c of Object.values(PERFIL.colores)) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
