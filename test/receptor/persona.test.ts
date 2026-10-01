import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, crear, actualizar } from './ayuda';
import type { Operacion } from '../../src/dominio/operaciones';
import type { AlmacenMemoria } from '../../src/receptor/almacen';

const aplicar = (a: AlmacenMemoria, ...ops: Operacion[]) => aplicarOperaciones(a, USUARIO, ops, reloj());

describe('personas', () => {
  it('una persona atendida recibe folio; un acompañante no', () => {
    const a = almacenBase();
    const r = aplicar(a,
      crear('persona', 'p1', { nombre: 'María Fernanda Ríos', tipo: 'Atendida', colectivo: 'Colectivo Raíces' }),
      crear('persona', 'p2', { nombre: 'Jorge Ríos', tipo: 'Acompañante' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['aplicada', 'aplicada']);
    expect(r.folios).toEqual({ p1: 'CA-001' });
    const [p1, p2] = a.filas('personas');
    expect(p1).toMatchObject({ folio: 'CA-001', creado_por: USUARIO, anulado: false });
    expect(p2.folio).toBe('');
  });

  it('la misma operación enviada dos veces no duplica ni gasta folio (Review Focus 2)', () => {
    const a = almacenBase();
    const op = crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' });
    aplicar(a, op);
    const segunda = aplicar(a, op);
    expect(segunda.resultados).toEqual([{ op_id: op.op_id, estado: 'aplicada' }]);
    expect(a.filas('personas')).toHaveLength(1);
    expect(a.config('ultimo_folio')).toBe('1');
  });

  it('dos teléfonos sincronizando uno tras otro obtienen folios distintos (Review Focus 3)', () => {
    const a = almacenBase();
    const tel1 = aplicar(a, crear('persona', 'pa', { nombre: 'Rosa', tipo: 'Atendida' }));
    const tel2 = aplicarOperaciones(a, 'luis.vega@ejemplo.mx', [crear('persona', 'pb', { nombre: 'Alex', tipo: 'Atendida' })], reloj());
    expect(tel1.folios.pa).toBe('CA-001');
    expect(tel2.folios.pb).toBe('CA-002');
  });

  it('rechaza con motivo legible y recuerda el rechazo', () => {
    const a = almacenBase();
    const mala = crear('persona', 'p1', { nombre: 'X', tipo: 'Atendida', inventado: 'y' });
    const r1 = aplicar(a, mala, crear('persona', 'p2', { nombre: '', tipo: 'Atendida' }), crear('persona', 'p3', { nombre: 'Y', tipo: 'Jefa' }));
    expect(r1.resultados.map(x => x.estado)).toEqual(['rechazada', 'rechazada', 'rechazada']);
    expect(r1.resultados[0].motivo).toMatch(/inventado/);
    expect(r1.resultados[1].motivo).toMatch(/nombre/);
    expect(r1.resultados[2].motivo).toMatch(/tipo/);
    expect(aplicar(a, mala).resultados[0]).toMatchObject({ estado: 'rechazada', motivo: r1.resultados[0].motivo });
    expect(a.filas('personas')).toHaveLength(0);
    expect(a.config('ultimo_folio')).toBe('0');
  });

  it('rechaza un id repetido y una institución que no existe', () => {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p1', { nombre: 'A', tipo: 'Acompañante' }));
    const r = aplicar(a,
      crear('persona', 'p1', { nombre: 'B', tipo: 'Acompañante' }, '2026-09-30T18:00:00-06:00'),
      crear('persona', 'g1', { nombre: 'Lic. C', tipo: 'Gobierno', institucion: 'no-existe' }));
    expect(r.resultados[0].motivo).toMatch(/Ya existe/);
    expect(r.resultados[1].motivo).toMatch(/Institución/);
  });

  it('actualizar guarda versiones y un acompañante puede volverse carnet', () => {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p2', { nombre: 'Jorge Ríos', tipo: 'Acompañante', contacto: '55 1111 2222' }));
    const r = aplicar(a, actualizar('persona', 'p2', { contacto: '55 3333 4444', tipo: 'Atendida' }));
    expect(r.folios).toEqual({ p2: 'CA-001' });
    const p = a.filas('personas')[0];
    expect(p).toMatchObject({ contacto: '55 3333 4444', tipo: 'Atendida', folio: 'CA-001' });
    const versiones = a.filas('personas_versiones');
    expect(versiones.map(v => [v.campo, v.valor_anterior, v.valor_nuevo])).toEqual([
      ['contacto', '55 1111 2222', '55 3333 4444'],
      ['tipo', 'Acompañante', 'Atendida'],
    ]);
  });

  it('no permite cambios de tipo distintos a Acompañante → Atendida', () => {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }));
    const r = aplicar(a, actualizar('persona', 'p1', { tipo: 'Gobierno' }));
    expect(r.resultados[0].motivo).toMatch(/No se puede cambiar/);
  });
});
