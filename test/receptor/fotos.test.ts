import { describe, it, expect } from 'vitest';
import { procesar, Dependencias } from '../../src/receptor/http';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, crear } from './ayuda';
import type { AlmacenMemoria } from '../../src/receptor/almacen';

const claims = { aud: 'cliente-123', email: USUARIO, email_verified: true, exp: 9_999_999_999 };
function deps(a: AlmacenMemoria, guardados: string[] = []): Dependencias {
  return {
    almacen: a, obtenerClaims: () => claims, ahora: reloj(), ahoraSeg: () => 1_790_000_000, candado: fn => fn(),
    guardarArchivo: (nombre, tipo, b64) => { guardados.push(`${nombre}|${tipo}|${b64}`); return `https://drive.example/${nombre}`; },
  };
}
const foto = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ accion: 'subir_foto', id_token: 't', anexo_id: 'x1', tipo: 'image/jpeg', datos: 'QUJD', ...extra });

function conAnexo(a: AlmacenMemoria) {
  aplicarOperaciones(a, USUARIO, [
    crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }),
    crear('reunion', 'r1', { fecha: '2026-09-30' }),
    crear('anexo', 'x1', { reunion_id: 'r1', descripcion: 'Campamento' }),
  ], reloj());
}

describe('subir_foto', () => {
  it('guarda la foto en Drive, anota la liga con bitácora y no la guarda dos veces', () => {
    const a = almacenBase();
    conAnexo(a);
    const guardados: string[] = [];
    expect(procesar(foto(), deps(a, guardados))).toEqual({ ok: true, drive_url: 'https://drive.example/x1.jpg' });
    expect(a.filas('anexos')[0].drive_url).toBe('https://drive.example/x1.jpg');
    expect(a.filas('changelog').some(c => c.campo === 'drive_url')).toBe(true);
    expect(procesar(foto(), deps(a, guardados))).toEqual({ ok: true, drive_url: 'https://drive.example/x1.jpg' });
    expect(guardados).toEqual(['x1.jpg|image/jpeg|QUJD']);
  });

  it('si el anexo aún no llega, responde pendiente', () => {
    const r = procesar(foto(), deps(almacenBase()));
    expect(r).toMatchObject({ ok: false, error: 'pendiente' });
  });

  it('valida tipo, tamaño, sesión y usuario', () => {
    const a = almacenBase();
    conAnexo(a);
    expect(procesar(foto({ tipo: 'application/pdf' }), deps(a))).toMatchObject({ error: 'solicitud_invalida' });
    expect(procesar(foto({ datos: 'A'.repeat(14_000_001) }), deps(a))).toMatchObject({ error: 'solicitud_invalida' });
    expect(procesar(foto({ id_token: '' }), deps(a))).toMatchObject({ error: 'sesion_vencida' });
    const otro = { ...deps(a), obtenerClaims: () => ({ ...claims, email: 'nadie@ejemplo.mx' }) };
    expect(procesar(foto(), otro)).toMatchObject({ error: 'no_autorizado' });
  });

  it('sin guardarArchivo configurado responde error_interno', () => {
    const a = almacenBase();
    conAnexo(a);
    const sin = { ...deps(a), guardarArchivo: undefined };
    expect(procesar(foto(), sin)).toMatchObject({ ok: false, error: 'error_interno' });
  });

  it('procesar sigue atendiendo sincronizar', () => {
    const r = procesar(JSON.stringify({ accion: 'sincronizar', id_token: 't', cursor: 0, ops: [] }), deps(almacenBase()));
    expect(r.ok).toBe(true);
  });
});
