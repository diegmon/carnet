import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { formatearFolioProvisional, esFolioProvisional } from '../../src/dominio/tipos';
import { almacenBase, reloj, USUARIO, crear } from './ayuda';

describe('folio provisional', () => {
  it('con formato provisional, el folio local no se confunde con uno definitivo', () => {
    const a = almacenBase();
    const r = aplicarOperaciones(a, USUARIO, [crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' })], reloj(),
      { formatoFolio: formatearFolioProvisional });
    expect(r.folios).toEqual({ p1: 'PROV-001' });
    expect(a.filas('personas')[0].folio).toBe('PROV-001');
  });
  it('reconoce folios provisionales', () => {
    expect(esFolioProvisional('PROV-001')).toBe(true);
    expect(esFolioProvisional('CA-001')).toBe(false);
    expect(esFolioProvisional('')).toBe(false);
  });
  it('sin opciones sigue usando el folio definitivo', () => {
    const a = almacenBase();
    const r = aplicarOperaciones(a, USUARIO, [crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' })], reloj());
    expect(r.folios.p1).toBe('CA-001');
  });
});

describe('prefijo de folio configurable', () => {
  it('usa el prefijo de CONFIG', () => {
    const a = almacenBase();
    a.setConfig('prefijo_folio', 'XYZ-');
    const r = aplicarOperaciones(a, USUARIO, [crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' })], reloj());
    expect(r.folios.p1).toBe('XYZ-001');
  });
  it('sembrar pone el prefijo y el cargo del perfil', async () => {
    const { sembrar } = await import('../../src/receptor/semillas');
    const { AlmacenMemoria } = await import('../../src/receptor/almacen');
    const a = new AlmacenMemoria();
    sembrar(a, reloj(), 'c');
    expect(a.config('prefijo_folio')).toBe('CA-');
    expect(a.config('para_cargo')).toBe('Titular de la institución');
  });
});
