import { describe, it, expect } from 'vitest';
import { procesarSolicitud, Dependencias } from '../../src/receptor/http';
import { validarClaims, ErrorAcceso, Claims } from '../../src/receptor/acceso';
import { cambiosDesde } from '../../src/receptor/cambios';
import { AlmacenMemoria } from '../../src/receptor/almacen';
import { almacenBase, reloj, USUARIO, crear } from './ayuda';

const AHORA = 1_790_000_000;
const claimsBuenos: Claims = { aud: 'cliente-123', email: 'Ana.Torres@ejemplo.mx', email_verified: 'true', exp: String(AHORA + 600) };

function deps(a: AlmacenMemoria, claims: Claims = claimsBuenos): Dependencias {
  return { almacen: a, obtenerClaims: () => claims, ahora: reloj(), ahoraSeg: () => AHORA, candado: fn => fn() };
}
const cuerpo = (x: object) => JSON.stringify({ accion: 'sincronizar', id_token: 'tok', cursor: 0, ops: [], ...x });
function codigo(fn: () => unknown): string {
  try { fn(); return 'sin error'; } catch (e) { return e instanceof ErrorAcceso ? e.codigo : 'otro error'; }
}

describe('validarClaims', () => {
  it('acepta token vigente de esta app y devuelve el correo en minúsculas', () => {
    expect(validarClaims(claimsBuenos, 'cliente-123', AHORA)).toBe(USUARIO);
  });
  it('distingue sesión vencida de no autorizado', () => {
    expect(codigo(() => validarClaims({}, 'cliente-123', AHORA))).toBe('sesion_vencida');
    expect(codigo(() => validarClaims({ ...claimsBuenos, exp: AHORA - 1 }, 'cliente-123', AHORA))).toBe('sesion_vencida');
    expect(codigo(() => validarClaims({ ...claimsBuenos, aud: 'otra' }, 'cliente-123', AHORA))).toBe('no_autorizado');
    expect(codigo(() => validarClaims({ ...claimsBuenos, email_verified: 'false' }, 'cliente-123', AHORA))).toBe('no_autorizado');
    expect(codigo(() => validarClaims(claimsBuenos, '', AHORA))).toBe('no_autorizado');
  });
});

describe('procesarSolicitud', () => {
  it('aplica operaciones y devuelve resultados, folios y cambios', () => {
    const a = almacenBase();
    const r = procesarSolicitud(cuerpo({ ops: [crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' })] }), deps(a));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultados[0].estado).toBe('aplicada');
    expect(r.folios).toEqual({ p1: 'CA-001' });
    expect(r.cambios.tablas.personas).toHaveLength(1);
    expect(r.cambios.usuarios).toContainEqual({ correo: USUARIO, nombre: 'Ana Torres', cargo: 'Enlace territorial', activo: true });
  });

  it('el cursor solo devuelve lo nuevo', () => {
    const a = almacenBase();
    procesarSolicitud(cuerpo({ ops: [crear('colectivo', 'c1', { nombre: 'Raíces' })] }), deps(a));
    const rev = cambiosDesde(a, 0).rev;
    const r = procesarSolicitud(cuerpo({ cursor: rev }), deps(a));
    expect(r.ok && Object.keys(r.cambios.tablas)).toEqual([]);
    expect(r.ok && r.cambios.rev).toBe(rev);
  });

  it('rechaza correo no registrado sin aplicar nada', () => {
    const a = almacenBase();
    const r = procesarSolicitud(cuerpo({ ops: [crear('colectivo', 'c1', { nombre: 'Raíces' })] }),
      deps(a, { ...claimsBuenos, email: 'extrano@ejemplo.mx' }));
    expect(r).toEqual({ ok: false, error: 'no_autorizado', mensaje: 'Tu cuenta no está autorizada en Carnet de Atención' });
    expect(a.filas('colectivos')).toHaveLength(0);
  });

  it('rechaza usuario marcado inactivo', () => {
    const b = new AlmacenMemoria({
      usuarios: [{ correo: 'luis.vega@ejemplo.mx', nombre: 'Luis', cargo: '', activo: false }],
      config: [{ clave: 'client_id', valor: 'cliente-123' }],
    });
    const r = procesarSolicitud(cuerpo({}), deps(b, { ...claimsBuenos, email: 'luis.vega@ejemplo.mx' }));
    expect(r.ok ? '' : r.error).toBe('no_autorizado');
  });

  it('responde solicitud_invalida ante JSON roto, acción desconocida, demasiadas ops u op sin op_id', () => {
    const a = almacenBase();
    const err = (c: string) => { const r = procesarSolicitud(c, deps(a)); return r.ok ? 'ok' : r.error; };
    expect(err('{')).toBe('solicitud_invalida');
    expect(err('null')).toBe('solicitud_invalida');
    expect(err(JSON.stringify({ accion: 'borrar_todo' }))).toBe('solicitud_invalida');
    expect(err(cuerpo({ ops: new Array(201).fill(crear('colectivo', 'c', { nombre: 'x' })) }))).toBe('solicitud_invalida');
    expect(err(cuerpo({ ops: [{ tipo: 'crear' }] }))).toBe('solicitud_invalida');
    expect(err(cuerpo({ cursor: -1 }))).toBe('solicitud_invalida');
  });

  it('sin token responde sesion_vencida', () => {
    const r = procesarSolicitud(JSON.stringify({ accion: 'sincronizar', cursor: 0, ops: [] }), deps(almacenBase()));
    expect(r.ok ? '' : r.error).toBe('sesion_vencida');
  });
});
