import { describe, it, expect, vi, afterEach } from 'vitest';
import { Motor, nuevoId } from '../../app/src/estado/motor';
import { persistenciaMemoria } from '../../app/src/estado/persistencia';
import { motorDePrueba, conCarnet, USUARIA, HOY } from './ayuda';

afterEach(() => vi.unstubAllGlobals());

describe('Motor', () => {
  it('configurarSesion registra al usuario y siembra el catálogo de instituciones', async () => {
    const m = await motorDePrueba();
    expect(m.sesion).toEqual(USUARIA);
    expect(m.almacen.filas('usuarios')).toEqual([{ ...USUARIA, activo: true }]);
    expect(m.almacen.filas('instituciones').length).toBeGreaterThan(5);
  });

  it('aplica con las reglas del receptor, da folio provisional y encola lo aplicado', async () => {
    const m = await motorDePrueba();
    const op = m.crear('persona', { nombre: 'María', tipo: 'Atendida' });
    const r = m.ejecutar(op);
    expect(r.ok).toBe(true);
    expect(m.almacen.filas('personas')[0].folio).toBe('PROV-001');
    expect(m.cola).toEqual([op]);
    expect(op.ts).toMatch(/^2026-09-30T17:00:00[+-]\d{2}:\d{2}$/);
  });

  it('se detiene en el primer rechazo y no encola lo rechazado', async () => {
    const m = await motorDePrueba();
    const buena = m.crear('colectivo', { nombre: 'Colectivo Raíces' });
    const mala = m.crear('persona', { nombre: '', tipo: 'Atendida' });
    const nunca = m.crear('colectivo', { nombre: 'Otro' });
    const r = m.ejecutar(buena, mala, nunca);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/nombre/);
    expect(r.resultados).toHaveLength(2);
    expect(m.cola).toEqual([buena]);
  });

  it('avisa a los suscriptores en cada ejecución', async () => {
    const m = await motorDePrueba();
    const fn = vi.fn();
    const quitar = m.suscribir(fn);
    m.ejecutar(m.crear('colectivo', { nombre: 'Raíces' }));
    quitar();
    m.ejecutar(m.crear('colectivo', { nombre: 'Huellas' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cerrar y reabrir la app no pierde nada (Review Focus 1)', async () => {
    const p = persistenciaMemoria();
    const m = await motorDePrueba(true, p);
    const id = conCarnet(m);
    await m.esperarGuardado();
    const otra = await Motor.abrir(p, () => HOY);
    expect(otra.sesion).toEqual(USUARIA);
    expect(otra.almacen.filas('personas').map(x => x.id)).toEqual([id]);
    expect(otra.cola).toEqual(m.cola);
    expect(otra.ejecutar(otra.crear('persona', { nombre: 'Rosa', tipo: 'Atendida' })).ok).toBe(true);
    expect(otra.almacen.filas('personas')[1].folio).toBe('PROV-002');
  });

  it('guarda la foto y crea su anexo', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const r = m.crear('reunion', { fecha: '2026-09-30' });
    m.ejecutar(r, m.crear('asistente', { reunion_id: r.id, persona_id: pid, papel: 'Atendida' }));
    const e = await m.agregarFoto(r.id, new Blob(['x'], { type: 'image/jpeg' }), 'Campamento');
    expect(e.ok).toBe(true);
    const anexo = m.almacen.filas('anexos')[0];
    expect(anexo).toMatchObject({ reunion_id: r.id, descripcion: 'Campamento' });
    expect(await m.persistencia.leerFoto(String(anexo.id))).toBeTruthy();
  });

  it('sin crypto.randomUUID (http en red local) igual genera ids únicos (Review Focus 4)', () => {
    const reales = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => reales.getRandomValues(b) });
    const ids = new Set(Array.from({ length: 50 }, () => nuevoId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sin sesión no permite ejecutar', async () => {
    const m = await motorDePrueba(false);
    expect(() => m.ejecutar(m.crear('colectivo', { nombre: 'x' }))).toThrow(/sesión/);
  });
});
