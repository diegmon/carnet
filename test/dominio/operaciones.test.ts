import { describe, it, expect } from 'vitest';
import { validarForma, TABLA_DE } from '../../src/dominio/operaciones';

const TS = '2026-09-30T17:00:00-06:00';

describe('validarForma', () => {
  it('acepta una operación crear completa', () => {
    const op = validarForma({ op_id: 'o1', tipo: 'crear', entidad: 'persona', id: 'p1', ts: TS, datos: { nombre: 'Ana' } });
    expect(op).toEqual({ op_id: 'o1', tipo: 'crear', entidad: 'persona', id: 'p1', ts: TS, datos: { nombre: 'Ana' } });
  });
  it('acepta actualizar, quitar y sellar', () => {
    expect(validarForma({ op_id: 'o2', tipo: 'actualizar', entidad: 'reunion', id: 'r1', ts: TS, cambios: { tema: 'x' } }).tipo).toBe('actualizar');
    expect(validarForma({ op_id: 'o3', tipo: 'quitar', entidad: 'asistente', id: 'a1', ts: TS }).tipo).toBe('quitar');
    expect(validarForma({ op_id: 'o4', tipo: 'sellar', entidad: 'reunion', id: 'r1', ts: '2026-09-30T23:00:00Z' }).tipo).toBe('sellar');
  });
  it('rechaza formas inválidas', () => {
    expect(() => validarForma(null)).toThrow();
    expect(() => validarForma({ tipo: 'crear', entidad: 'persona', id: 'p1', ts: TS, datos: {} })).toThrow(/op_id/);
    expect(() => validarForma({ op_id: 'o', tipo: 'crear', entidad: 'persona', id: 'p1', ts: '30/09/2026', datos: {} })).toThrow(/Fecha/);
    expect(() => validarForma({ op_id: 'o', tipo: 'crear', entidad: 'usuario', id: 'p1', ts: TS, datos: {} })).toThrow(/Entidad/);
    expect(() => validarForma({ op_id: 'o', tipo: 'crear', entidad: 'persona', id: 'p1', ts: TS, datos: [] })).toThrow(/datos/);
    expect(() => validarForma({ op_id: 'o', tipo: 'actualizar', entidad: 'anulacion', id: 'x', ts: TS, cambios: {} })).toThrow(/Entidad/);
    expect(() => validarForma({ op_id: 'o', tipo: 'quitar', entidad: 'reunion', id: 'x', ts: TS })).toThrow(/Entidad/);
    expect(() => validarForma({ op_id: 'o', tipo: 'sellar', entidad: 'acuerdo', id: 'x', ts: TS })).toThrow(/Entidad/);
    expect(() => validarForma({ op_id: 'o', tipo: 'borrar', entidad: 'persona', id: 'x', ts: TS })).toThrow(/Tipo/);
    expect(() => validarForma({ op_id: 'x'.repeat(201), tipo: 'sellar', entidad: 'reunion', id: 'r', ts: TS })).toThrow(/op_id/);
  });
  it('mapea cada entidad a su tabla', () => {
    expect(TABLA_DE.estado_acuerdo).toBe('historial_estados');
    expect(TABLA_DE.anulacion).toBe('anulaciones');
    expect(TABLA_DE.persona).toBe('personas');
  });
});
