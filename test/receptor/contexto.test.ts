import { describe, it, expect } from 'vitest';
import { AlmacenMemoria, filaVacia } from '../../src/receptor/almacen';
import { Contexto, Rechazo } from '../../src/receptor/contexto';
import { almacenBase, reloj, USUARIO } from './ayuda';

describe('AlmacenMemoria', () => {
  it('rechaza columnas que no existen en la tabla', () => {
    const a = new AlmacenMemoria();
    expect(() => a.agregar('colectivos', { id: 'c1', inventado: 'x' })).toThrow(/inventado/);
  });
  it('devuelve copias, no referencias', () => {
    const a = new AlmacenMemoria({ colectivos: [{ ...filaVacia('colectivos'), id: 'c1', nombre: 'Raíces' }] });
    a.filas('colectivos')[0].nombre = 'cambiado';
    expect(a.filas('colectivos')[0].nombre).toBe('Raíces');
  });
  it('lee y escribe config', () => {
    const a = new AlmacenMemoria();
    expect(a.config('nada')).toBe('');
    a.setConfig('x', '5');
    a.setConfig('x', '6');
    expect(a.config('x')).toBe('6');
  });
  it('filaVacia pone anulado y quitado en false', () => {
    expect(filaVacia('acuerdos').anulado).toBe(false);
    expect(filaVacia('acuerdos').quitado).toBe(false);
    expect(filaVacia('acuerdos').texto).toBe('');
  });
});

describe('Contexto', () => {
  it('insertar asigna _rev creciente, servidor_en y escribe bitácora', () => {
    const a = almacenBase();
    const ctx = new Contexto(a, USUARIO, reloj(), 'op-x');
    ctx.insertar('colectivos', { ...filaVacia('colectivos'), id: 'c1', nombre: 'Raíces' });
    ctx.insertar('colectivos', { ...filaVacia('colectivos'), id: 'c2', nombre: 'Huellas' });
    const filas = a.filas('colectivos');
    expect(filas.map(f => f._rev)).toEqual([1, 2]);
    expect(filas[0].servidor_en).toMatch(/^2026-09-30T23:00:0\d\.000Z$/);
    const log = a.filas('changelog');
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ tabla: 'colectivos', registro_id: 'c1', campo: '*', usuario: USUARIO, op_id: 'op-x' });
  });
  it('modificar solo registra campos que cambian', () => {
    const a = almacenBase();
    const ctx = new Contexto(a, USUARIO, reloj(), 'op-y');
    ctx.insertar('colectivos', { ...filaVacia('colectivos'), id: 'c1', nombre: 'Raíces' });
    ctx.modificar('colectivos', 'c1', { nombre: 'Raíces' });
    expect(a.filas('changelog')).toHaveLength(1);
    ctx.modificar('colectivos', 'c1', { nombre: 'Raíces del Sur' });
    const log = a.filas('changelog');
    expect(log[1]).toMatchObject({ campo: 'nombre', antes: 'Raíces', ahora: 'Raíces del Sur' });
    expect(a.filas('colectivos')[0]._rev).toBe(2);
  });
  it('siguienteFolio es consecutivo y persiste en config', () => {
    const a = almacenBase();
    const ctx = new Contexto(a, USUARIO, reloj());
    expect(ctx.siguienteFolio()).toBe('CA-001');
    expect(ctx.siguienteFolio()).toBe('CA-002');
    expect(a.config('ultimo_folio')).toBe('2');
  });
  it('exigir lanza Rechazo si no existe', () => {
    const ctx = new Contexto(almacenBase(), USUARIO, reloj());
    expect(() => ctx.exigir('personas', 'nadie', 'Persona')).toThrow(Rechazo);
  });
});
