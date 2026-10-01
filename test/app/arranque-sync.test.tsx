// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as montar } from 'preact';
import { arrancar, programarSincronizacion } from '../../app/src/arranque';
import { persistenciaMemoria } from '../../app/src/estado/persistencia';
import type { ClienteReceptor } from '../../app/src/estado/cliente';
import { tokenDePrueba } from './ayuda';

afterEach(() => vi.useRealTimers());

describe('programarSincronizacion', () => {
  it('dispara al iniciar, al volver la señal, cada intervalo y tras cambios locales', () => {
    vi.useFakeTimers();
    const ventana = new EventTarget() as unknown as Window;
    const sinc = vi.fn();
    const p = programarSincronizacion(sinc, { cadaMs: 100_000, ventana });
    expect(sinc).toHaveBeenCalledTimes(1);
    ventana.dispatchEvent(new Event('online'));
    expect(sinc).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(100_000);
    expect(sinc).toHaveBeenCalledTimes(3);
    p.cambioLocal(); p.cambioLocal();
    vi.advanceTimersByTime(4999);
    expect(sinc).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1);
    expect(sinc).toHaveBeenCalledTimes(4);
    p.detener();
    vi.advanceTimersByTime(1_000_000);
    expect(sinc).toHaveBeenCalledTimes(4);
  });
});

describe('arrancar con sincronización', () => {
  it('conecta el sincronizador: enviar ahora llega al receptor', async () => {
    const p = persistenciaMemoria();
    await p.guardarSesion({ correo: 'ana.torres@ejemplo.mx', nombre: 'Ana', cargo: '', token: tokenDePrueba(), expira: 9_999_999_999 });
    const llamadas: number[] = [];
    const cliente: ClienteReceptor = {
      sincronizar: async (_t, _c, ops) => { llamadas.push(ops.length); return { ok: true, resultados: [], folios: {}, cambios: { rev: 0, tablas: {}, usuarios: [] } }; },
      subirFoto: async () => ({ ok: false, error: 'pendiente', mensaje: '' }),
    };
    const raiz = document.createElement('div');
    const m = await arrancar(raiz, p, async () => true, {
      config: { receptorUrl: 'https://r.example', clientId: 'c' }, cliente,
    });
    await vi.waitFor(() => expect(m!.estadoSync.fase).toBe('al_dia'));
    m!.alPedirSincronizacion!();
    await vi.waitFor(() => expect(llamadas.length).toBeGreaterThanOrEqual(2));
    montar(null, raiz);
  });

  it('en solo lectura no sincroniza', async () => {
    const llamadas: number[] = [];
    const cliente: ClienteReceptor = { sincronizar: async () => { llamadas.push(1); return { ok: false, error: 'sin_red', mensaje: '' }; }, subirFoto: async () => ({ ok: false, error: 'sin_red', mensaje: '' }) };
    const raiz = document.createElement('div');
    const m = await arrancar(raiz, persistenciaMemoria(), async () => false, { config: { receptorUrl: 'https://r', clientId: 'c' }, cliente });
    expect(m?.alPedirSincronizacion).toBeUndefined();
    expect(llamadas).toEqual([]);
    montar(null, raiz);
  });
});
