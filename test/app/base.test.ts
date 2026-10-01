import { describe, it, expect } from 'vitest';
import { normalizarFila, fusionar, reconstruir } from '../../app/src/estado/base';
import type { Operacion } from '../../src/dominio/operaciones';

const SESION = { correo: 'ana.torres@ejemplo.mx', nombre: 'Ana Torres', cargo: '' };
const ahora = () => '2026-10-01T16:00:00.000Z';
const TS = '2026-10-01T10:00:00-06:00';
const persona = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id, creado_por: SESION.correo, creado_en: TS, servidor_en: TS, _rev: '3', folio: '', nombre, tipo: 'Atendida',
  colectivo: '', contacto: '', alcaldia_zona: '', cargo: '', institucion: '', anulado: 'FALSE', ...extra,
});
const cambios = (tablas: Record<string, unknown[]>, rev = 10, usuarios = [{ correo: SESION.correo, nombre: 'Ana Torres', cargo: 'Enlace', activo: true }]) =>
  ({ rev, tablas, usuarios }) as never;

describe('normalizarFila (Review Focus 4)', () => {
  it('convierte los valores que devuelve Sheets', () => {
    const f = normalizarFila('personas', { ...persona('p1', 'María'), anulado: 'FALSE', _rev: '5', extra: 'x' });
    expect(f.anulado).toBe(false);
    expect(f._rev).toBe(5);
    expect(f).not.toHaveProperty('extra');
    expect(normalizarFila('instituciones', { id: 'a', usos: '7' }).usos).toBe(7);
    expect(normalizarFila('usuarios', { correo: 'x', activo: 'TRUE' }).activo).toBe(true);
    expect(normalizarFila('reuniones', { id: 'r', fecha: '2026-09-30', anulado: true }).anulado).toBe(true);
  });
});

describe('fusionar', () => {
  it('inserta, actualiza por id y reemplaza usuarios', () => {
    let base = fusionar({}, cambios({ personas: [persona('p1', 'María', { folio: 'CA-001' })] }));
    base = fusionar(base, cambios({ personas: [persona('p1', 'María F.', { folio: 'CA-001', _rev: '11' }), persona('p2', 'Rosa')] }, 12));
    expect(base.personas!.map(p => [p.nombre, p._rev])).toEqual([['María F.', 11], ['Rosa', 3]]);
    expect(base.usuarios).toEqual([{ correo: SESION.correo, nombre: 'Ana Torres', cargo: 'Enlace', activo: true }]);
  });
});

describe('reconstruir', () => {
  it('la base trae el folio definitivo; lo que sigue en cola se reaplica con folio provisional', () => {
    const base = fusionar({}, cambios({ personas: [persona('p1', 'María', { folio: 'CA-017' })] }));
    const cola: Operacion[] = [{ op_id: 'o2', tipo: 'crear', entidad: 'persona', id: 'p2', ts: TS, datos: { nombre: 'Rosa', tipo: 'Atendida' } }];
    const { almacen, noAplicadas } = reconstruir(base, cola, SESION, ahora);
    expect(almacen.filas('personas').map(p => p.folio)).toEqual(['CA-017', 'PROV-001']);
    expect(noAplicadas).toEqual([]);
    expect(Number(almacen.filas('personas')[1]._rev)).toBeGreaterThan(3);
  });

  it('sin base agrega a la persona como usuaria y siembra el catálogo', () => {
    const { almacen } = reconstruir({}, [], SESION, ahora);
    expect(almacen.filas('usuarios')[0]).toMatchObject({ correo: SESION.correo, activo: true });
    expect(almacen.filas('instituciones').length).toBeGreaterThan(5);
  });

  it('una operación ya incluida en la base no se duplica al reaplicarla', () => {
    const op: Operacion = { op_id: 'o1', tipo: 'crear', entidad: 'persona', id: 'p1', ts: TS, datos: { nombre: 'María', tipo: 'Atendida' } };
    const base = fusionar({}, cambios({ personas: [persona('p1', 'María', { folio: 'CA-001' })] }));
    const { almacen, noAplicadas } = reconstruir(base, [op], SESION, ahora);
    expect(almacen.filas('personas')).toHaveLength(1);
    expect(noAplicadas).toEqual([]);
  });

  it('informa las operaciones que ya no aplican sobre la base', () => {
    const base = fusionar({}, cambios({ reuniones: [{ id: 'r1', creado_por: SESION.correo, creado_en: TS, servidor_en: TS, _rev: 4, estado: 'Sellada', fecha: '2026-09-30', anulado: false }] }));
    const cola: Operacion[] = [{ op_id: 'o9', tipo: 'actualizar', entidad: 'reunion', id: 'r1', ts: TS, cambios: { tema: 'x' } }];
    expect(reconstruir(base, cola, SESION, ahora).noAplicadas).toEqual(['o9']);
  });
});
