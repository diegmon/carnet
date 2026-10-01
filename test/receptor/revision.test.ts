import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { procesarSolicitud, Dependencias } from '../../src/receptor/http';
import { AlmacenMemoria, Almacen } from '../../src/receptor/almacen';
import { AlmacenSheets } from '../../src/receptor/sheets';
import type { NombreTabla } from '../../src/dominio/esquema';
import type { Fila } from '../../src/dominio/tipos';
import { almacenBase, reloj, USUARIO, crear, actualizar, sellar } from './ayuda';

/** Imita a AlmacenSheets: guarda CONFIG en caché la primera vez que se lee. */
class AlmacenConCache implements Almacen {
  private cache?: Map<string, string>;
  constructor(private base: AlmacenMemoria) {}
  filas(t: NombreTabla) { return this.base.filas(t); }
  agregar(t: NombreTabla, f: Fila) { this.base.agregar(t, f); }
  actualizar(t: NombreTabla, id: string, c: Fila) { this.base.actualizar(t, id, c); }
  config(k: string) {
    if (!this.cache) this.cache = new Map(this.base.filas('config').map(f => [String(f.clave), String(f.valor)]));
    return this.cache.get(k) ?? '';
  }
  setConfig(k: string, v: string) { this.base.setConfig(k, v); this.cache?.set(k, v); }
  refrescar() { this.cache = undefined; }
}

/** Falla una vez al registrar en _OPS: simula un error de Sheets a mitad de una operación. */
class AlmacenQueFalla implements Almacen {
  fallar = true;
  constructor(private base: AlmacenMemoria) {}
  filas(t: NombreTabla) { return this.base.filas(t); }
  agregar(t: NombreTabla, f: Fila) {
    if (t === 'ops' && this.fallar) { this.fallar = false; throw new Error('Service Spreadsheets failed'); }
    this.base.agregar(t, f);
  }
  actualizar(t: NombreTabla, id: string, c: Fila) { this.base.actualizar(t, id, c); }
  config(k: string) { return this.base.config(k); }
  setConfig(k: string, v: string) { this.base.setConfig(k, v); }
}

const claims = { aud: 'cliente-123', email: USUARIO, email_verified: true, exp: 9_999_999_999 };
const deps = (a: Almacen): Dependencias =>
  ({ almacen: a, obtenerClaims: () => claims, ahora: reloj(), ahoraSeg: () => 1_790_000_000, candado: fn => fn() });
const cuerpo = (ops: unknown[]) => JSON.stringify({ accion: 'sincronizar', id_token: 't', cursor: 0, ops });

describe('revisión: sincronizaciones simultáneas', () => {
  it('relee CONFIG dentro del candado: dos sincronizaciones traslapadas no repiten folio ni _rev', () => {
    const base = almacenBase();
    const a = new AlmacenConCache(base);
    const b = new AlmacenConCache(base);
    b.config('client_id'); // B leyó CONFIG antes de que A tomara el candado
    procesarSolicitud(cuerpo([crear('persona', 'pa', { nombre: 'Rosa', tipo: 'Atendida' })]), deps(a));
    const r = procesarSolicitud(cuerpo([crear('persona', 'pb', { nombre: 'Alex', tipo: 'Atendida' })]), deps(b));
    expect(r.ok && r.folios).toEqual({ pb: 'CA-002' });
    const revs = base.filas('personas').map(p => p._rev);
    expect(new Set(revs).size).toBe(revs.length);
  });
});

describe('revisión: operación escrita a medias', () => {
  it('al reintentar, una persona ya guardada cuenta como aplicada y devuelve su folio', () => {
    const base = almacenBase();
    const falla = new AlmacenQueFalla(base);
    const op = crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' });
    expect(() => aplicarOperaciones(falla, USUARIO, [op], reloj())).toThrow(/Service/);
    const r = aplicarOperaciones(falla, USUARIO, [op], reloj());
    expect(r.resultados).toEqual([{ op_id: op.op_id, estado: 'aplicada' }]);
    expect(r.folios).toEqual({ p1: 'CA-001' });
    expect(base.filas('personas')).toHaveLength(1);
  });

  it('al reintentar una anulación a medias, el registro queda anulado', () => {
    const base = almacenBase();
    aplicarOperaciones(base, USUARIO, [crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' })], reloj());
    const falla = new AlmacenQueFalla(base);
    const op = crear('anulacion', 'n1', { entidad: 'persona', registro_id: 'p1', nota_aclaratoria: 'Duplicado de otro carnet' });
    expect(() => aplicarOperaciones(falla, USUARIO, [op], reloj())).toThrow(/Service/);
    expect(aplicarOperaciones(falla, USUARIO, [op], reloj()).resultados[0].estado).toBe('aplicada');
    expect(base.filas('personas')[0].anulado).toBe(true);
  });

  it('el mismo id capturado por otra operación sigue rechazándose', () => {
    const base = almacenBase();
    aplicarOperaciones(base, USUARIO, [crear('persona', 'p1', { nombre: 'A', tipo: 'Acompañante' }, '2026-09-30T10:00:00-06:00')], reloj());
    const r = aplicarOperaciones(base, USUARIO, [crear('persona', 'p1', { nombre: 'B', tipo: 'Acompañante' }, '2026-09-30T11:00:00-06:00')], reloj());
    expect(r.resultados[0].motivo).toMatch(/Ya existe/);
  });
});

describe('revisión: operación mal formada', () => {
  it('se rechaza sola y no bloquea a las demás', () => {
    const a = almacenBase();
    const r = procesarSolicitud(cuerpo([
      { op_id: 'mala', tipo: 'crear', entidad: 'persona', id: 'x', ts: '2026-09-30T17:00:00', datos: {} },
      crear('colectivo', 'c1', { nombre: 'Raíces' }),
    ]), deps(a));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultados[0]).toMatchObject({ op_id: 'mala', estado: 'rechazada' });
    expect(r.resultados[1].estado).toBe('aplicada');
    expect(a.filas('colectivos')).toHaveLength(1);
  });

  it('sin op_id la solicitud completa es inválida', () => {
    const r = procesarSolicitud(cuerpo([{ tipo: 'crear' }]), deps(almacenBase()));
    expect(r.ok ? '' : r.error).toBe('solicitud_invalida');
  });
});

describe('revisión: papel Atendida al actualizar asistentes', () => {
  function base() {
    const a = almacenBase();
    aplicarOperaciones(a, USUARIO, [
      crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }),
      crear('persona', 'p2', { nombre: 'Jorge', tipo: 'Acompañante' }),
      crear('persona', 'g1', { nombre: 'Lic. Vega', tipo: 'Gobierno' }),
      crear('reunion', 'r1', { fecha: '2026-09-30' }),
      crear('asistente', 'a1', { reunion_id: 'r1', persona_id: 'p1', papel: 'Atendida' }),
      crear('asistente', 'a2', { reunion_id: 'r1', persona_id: 'p2', papel: 'Acompañante' }),
    ], reloj());
    return a;
  }
  it('no permite cambiar a Atendida a quien no tiene carnet', () => {
    const a = base();
    const r = aplicarOperaciones(a, USUARIO, [actualizar('asistente', 'a2', { papel: 'Atendida' })], reloj());
    expect(r.resultados[0].motivo).toMatch(/carnet/);
  });
  it('no permite poner a alguien sin carnet en un lugar de Atendida', () => {
    const a = base();
    const r = aplicarOperaciones(a, USUARIO, [actualizar('asistente', 'a1', { persona_id: 'g1' })], reloj());
    expect(r.resultados[0].motivo).toMatch(/carnet/);
  });
});

describe('revisión: anulados al sellar', () => {
  it('un asistente anulado no cuenta como persona atendida', () => {
    const a = almacenBase();
    aplicarOperaciones(a, USUARIO, [
      crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }),
      crear('reunion', 'r1', { fecha: '2026-09-30' }),
      crear('asistente', 'a1', { reunion_id: 'r1', persona_id: 'p1', papel: 'Atendida' }),
      crear('anulacion', 'n1', { entidad: 'asistente', registro_id: 'a1', nota_aclaratoria: 'Se capturó en la reunión equivocada' }),
    ], reloj());
    const r = aplicarOperaciones(a, USUARIO, [sellar('r1')], reloj());
    expect(r.resultados[0].motivo).toMatch(/atendida/);
  });
});

describe('revisión: formato de texto en renglones nuevos de Sheets', () => {
  it('aplica formato de texto antes de escribir los valores del renglón', () => {
    const registro: [string, number, unknown][] = [];
    const rango = (fila: number) => ({
      setNumberFormat(f: string) { registro.push(['formato', fila, f]); return this; },
      setValues(v: unknown[][]) { registro.push(['valores', fila, v[0]]); return this; },
      setValue(v: unknown) { registro.push(['valor', fila, v]); return this; },
    });
    const hoja = {
      getDataRange: () => ({ getValues: () => [['id', 'creado_por', 'creado_en', 'servidor_en', '_rev', 'nombre']] }),
      getLastRow: () => 1,
      getRange: (fila: number) => rango(fila),
    };
    const libro = { getSheetByName: () => hoja } as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet;
    new AlmacenSheets(libro).agregar('colectivos', { id: 'c1', creado_por: 'x', creado_en: '2026-09-30', servidor_en: '', _rev: 1, nombre: '=1+1' });
    expect(registro).toEqual([
      ['formato', 2, '@'],
      ['valores', 2, ['c1', 'x', '2026-09-30', '', 1, "'=1+1"]],
    ]);
  });
});
