import { describe, it, expect } from 'vitest';
import { Sincronizador } from '../../app/src/estado/sincronizador';
import type { ClienteReceptor, RespuestaSync } from '../../app/src/estado/cliente';
import { procesarSolicitud } from '../../src/receptor/http';
import { AlmacenMemoria } from '../../src/receptor/almacen';
import { sembrar } from '../../src/receptor/semillas';
import { motorDePrueba, conCarnet, reunionCon, tokenDePrueba, USUARIA } from './ayuda';
import type { Motor } from '../../app/src/estado/motor';

/** Cliente que habla con un receptor real en memoria (mismas reglas que Apps Script). */
function clienteEnMemoria(opciones: { perderRespuestas?: number } = {}) {
  const almacen = new AlmacenMemoria({
    usuarios: [{ correo: USUARIA.correo, nombre: 'Ana Torres', cargo: '', activo: true },
      { correo: 'luis.vega@ejemplo.mx', nombre: 'Luis Vega', cargo: '', activo: true }],
    config: [{ clave: 'client_id', valor: 'cliente' }],
  });
  sembrar(almacen, () => '2026-10-01T00:00:00.000Z', '');
  let perder = opciones.perderRespuestas ?? 0;
  const llamadas: number[] = [];
  const cliente: ClienteReceptor & { almacen: AlmacenMemoria; llamadas: number[]; como(correo: string): ClienteReceptor } = {
    almacen, llamadas,
    async sincronizar(token, cursor, ops) {
      llamadas.push(ops.length);
      const r = procesarSolicitud(JSON.stringify({ accion: 'sincronizar', id_token: token, cursor, ops }), {
        almacen, obtenerClaims: () => ({ aud: 'cliente', email: USUARIA.correo, email_verified: true, exp: 9e9 }),
        ahora: () => '2026-10-01T17:00:00.000Z', ahoraSeg: () => 1_790_000_000, candado: fn => fn(),
      });
      if (perder > 0) { perder--; return { ok: false, error: 'sin_red', mensaje: 'se cayó' }; }
      return r as RespuestaSync;
    },
    async subirFoto() { return { ok: false, error: 'pendiente', mensaje: '' }; },
    como(correo) {
      return { ...cliente, async sincronizar(token, cursor, ops) {
        return procesarSolicitud(JSON.stringify({ accion: 'sincronizar', id_token: token, cursor, ops }), {
          almacen, obtenerClaims: () => ({ aud: 'cliente', email: correo, email_verified: true, exp: 9e9 }),
          ahora: () => '2026-10-01T18:00:00.000Z', ahoraSeg: () => 1_790_000_000, candado: fn => fn(),
        }) as RespuestaSync;
      } };
    },
  };
  return cliente;
}

async function conSesion(): Promise<Motor> {
  const m = await motorDePrueba(false);
  await m.iniciarSesionGoogle(tokenDePrueba());
  return m;
}

describe('Sincronizador', () => {
  it('envía la cola, trae folios definitivos y queda al día', async () => {
    const m = await conSesion();
    const pid = conCarnet(m);
    const c = clienteEnMemoria();
    const e = await new Sincronizador(m, c).sincronizar();
    expect(e.fase).toBe('al_dia');
    expect(e.ultimaVez).toMatch(/^2026-09-30T17:00/);
    expect(m.cola).toEqual([]);
    expect(m.almacen.filas('personas').find(p => p.id === pid)!.folio).toBe('CA-001');
  });

  it('envía en lotes y siempre consulta aunque no haya cola', async () => {
    const m = await conSesion();
    for (let i = 0; i < 120; i++) m.ejecutar(m.crear('colectivo', { nombre: `Colectivo ${i}` }));
    const c = clienteEnMemoria();
    await new Sincronizador(m, c).sincronizar();
    expect(c.llamadas).toEqual([50, 50, 20]);
    await new Sincronizador(m, c).sincronizar();
    expect(c.llamadas).toEqual([50, 50, 20, 0]);
  });

  it('si se pierde la respuesta, reenviar no duplica (Review Focus 2)', async () => {
    const m = await conSesion();
    conCarnet(m);
    const c = clienteEnMemoria({ perderRespuestas: 1 });
    expect((await new Sincronizador(m, c).sincronizar()).fase).toBe('sin_red');
    expect(m.cola).toHaveLength(1);
    expect((await new Sincronizador(m, c).sincronizar()).fase).toBe('al_dia');
    expect(c.almacen.filas('personas')).toHaveLength(1);
    expect(m.almacen.filas('personas')).toHaveLength(1);
  });

  it('sin token vigente pide sesión y conserva todo (Review Focus 3)', async () => {
    const m = await conSesion();
    m.sesion = { ...m.sesion!, expira: 1 };
    conCarnet(m);
    const c = clienteEnMemoria();
    expect((await new Sincronizador(m, c).sincronizar()).fase).toBe('requiere_sesion');
    expect(c.llamadas).toEqual([]);
    expect(m.cola).toHaveLength(1);
  });

  it('lo rechazado por cambios de otra persona va a Problemas (Review Focus 5)', async () => {
    const m = await conSesion();
    const r = reunionCon(m, conCarnet(m));
    const c = clienteEnMemoria();
    await new Sincronizador(m, c).sincronizar();
    m.ejecutar(m.actualizar('reunion', r, { tema: 'Cambio mío' }));
    await c.como('luis.vega@ejemplo.mx').sincronizar('t', 0, [{ op_id: 'sello-luis', tipo: 'sellar', entidad: 'reunion', id: r, ts: '2026-10-01T11:00:00-06:00' }]);
    const e = await new Sincronizador(m, c).sincronizar();
    expect(e.fase).toBe('al_dia');
    expect(m.cola).toEqual([]);
    expect(m.problemas.map(p => p.motivo)).toEqual(['La reunión ya está sellada']);
    expect(m.almacen.filas('reuniones')[0].estado).toBe('Sellada');
  });

  it('no autorizado, error del receptor, solo lectura y llamadas simultáneas', async () => {
    const m = await conSesion();
    const respuestas: RespuestaSync[] = [
      { ok: false, error: 'no_autorizado', mensaje: 'Tu cuenta no está autorizada en Carnet de Atención' },
      { ok: false, error: 'error_interno', mensaje: 'No se pudo sincronizar; se reintentará sola' },
    ];
    const c: ClienteReceptor = { sincronizar: async () => respuestas.shift()!, subirFoto: async () => ({ ok: false, error: 'sin_red', mensaje: '' }) };
    const s = new Sincronizador(m, c);
    expect(await s.sincronizar()).toMatchObject({ fase: 'no_autorizado', mensaje: /no está autorizada/ });
    expect(await s.sincronizar()).toMatchObject({ fase: 'error', mensaje: /se reintentará/ });
    m.soloLectura = true;
    expect((await s.sincronizar()).fase).toBe('error');
    m.soloLectura = false;
    let liberar!: () => void;
    const lento: ClienteReceptor = { ...c, sincronizar: () => new Promise(res => { liberar = () => res({ ok: true, resultados: [], folios: {}, cambios: { rev: 0, tablas: {}, usuarios: [] } }); }) };
    const s2 = new Sincronizador(m, lento);
    const primera = s2.sincronizar();
    expect((await s2.sincronizar()).fase).toBe('enviando');
    liberar();
    expect((await primera).fase).toBe('al_dia');
  });

  it('al terminar bien llama alTerminar (fotos)', async () => {
    const m = await conSesion();
    let llamado = false;
    await new Sincronizador(m, clienteEnMemoria(), { alTerminar: async () => { llamado = true; } }).sincronizar();
    expect(llamado).toBe(true);
  });
});
