// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { render as montar } from 'preact';
import { App } from '../../app/src/ui/App';
import { subirFotosPendientes } from '../../app/src/estado/fotos-envio';
import { Sincronizador } from '../../app/src/estado/sincronizador';
import { clienteHttp } from '../../app/src/estado/cliente';
import type { ClienteReceptor, RespuestaFotoCliente } from '../../app/src/estado/cliente';
import { arrancar, programarSincronizacion } from '../../app/src/arranque';
import { persistenciaMemoria } from '../../app/src/estado/persistencia';
import type { Motor } from '../../app/src/estado/motor';
import { motorDePrueba, conCarnet, reunionCon, tokenDePrueba } from './ayuda';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const sinc = (): ClienteReceptor['sincronizar'] => async () => ({ ok: true, resultados: [], folios: {}, cambios: { rev: 0, tablas: {}, usuarios: [] } });

async function conFotos(n: number, tipo = 'image/jpeg'): Promise<{ m: Motor; ids: string[] }> {
  const m = await motorDePrueba();
  const r = reunionCon(m, conCarnet(m));
  for (let i = 0; i < n; i++) await m.agregarFoto(r, new Blob([`f${i}`], { type: tipo }), `foto ${i}`);
  m.base = { ...m.base, anexos: m.almacen.filas('anexos') };
  return { m, ids: m.almacen.filas('anexos').map(a => String(a.id)) };
}

describe('revisión: envío de fotos', () => {
  it('una foto rechazada para siempre se registra en Problemas y no se reenvía', async () => {
    const { m } = await conFotos(1);
    let envios = 0;
    const c: ClienteReceptor = { sincronizar: sinc(), subirFoto: async () => { envios++; return { ok: false, error: 'solicitud_invalida', mensaje: 'Tipo de imagen no permitido' }; } };
    await subirFotosPendientes(m, c, 't', async b => b);
    await subirFotosPendientes(m, c, 't', async b => b);
    expect(envios).toBe(1);
    expect(m.problemas.map(p => p.motivo)).toEqual(['Tipo de imagen no permitido']);
  });

  it('un formato no compatible (HEIC) no se sube y se explica', async () => {
    const { m } = await conFotos(1, 'image/heic');
    let envios = 0;
    const c: ClienteReceptor = { sincronizar: sinc(), subirFoto: async () => { envios++; return { ok: true, drive_url: 'x' }; } };
    await subirFotosPendientes(m, c, 't', async b => b);
    expect(envios).toBe(0);
    expect(m.problemas[0].motivo).toMatch(/formato/i);
  });

  it('si la sesión vence o la cuenta no está autorizada, deja de enviar las demás', async () => {
    for (const error of ['sesion_vencida', 'no_autorizado'] as const) {
      const { m } = await conFotos(3);
      let envios = 0;
      const c: ClienteReceptor = { sincronizar: sinc(), subirFoto: async (): Promise<RespuestaFotoCliente> => { envios++; return { ok: false, error, mensaje: '' }; } };
      await subirFotosPendientes(m, c, 't', async b => b);
      expect(envios).toBe(1);
      expect(m.problemas).toEqual([]);
    }
  });
});

describe('revisión: las fotos no se suben dos veces a la vez', () => {
  it('mientras se suben las fotos, otra sincronización no arranca y los errores no escapan', async () => {
    const m = await motorDePrueba(false);
    await m.iniciarSesionGoogle(tokenDePrueba());
    let llamadas = 0;
    let liberar!: () => void;
    const s = new Sincronizador(m, { sincronizar: async (...a) => { llamadas++; return sinc()(...a); }, subirFoto: async () => ({ ok: false, error: 'sin_red', mensaje: '' }) }, {
      alTerminar: () => new Promise<void>((_, rechazar) => { liberar = () => rechazar(new Error('IDB')); }),
    });
    const primera = s.sincronizar();
    await vi.waitFor(() => expect(liberar).toBeTypeOf('function'));
    await s.sincronizar();
    expect(llamadas).toBe(1);
    liberar();
    await expect(primera).resolves.toMatchObject({ fase: 'al_dia' });
  });
});

describe('revisión: Problemas muestra qué se rechazó', () => {
  it('muestra el contenido y pide confirmar antes de descartar', async () => {
    const m = await motorDePrueba();
    m.problemas.push({ op: { op_id: 'o1', tipo: 'crear', entidad: 'acuerdo', id: 'a1', ts: m.ts(), datos: { reunion_id: 'r1', texto: 'Cita con la Fiscal el viernes', persona_ids: 'p1' } }, motivo: 'La reunión ya está sellada', fecha: m.ts() });
    render(<App motor={m} inicio={{ p: 'problemas' }} />);
    expect(screen.getByText(/Cita con la Fiscal el viernes/)).toBeTruthy();
    expect(screen.queryByText(/r1/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(m.problemas).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    await waitFor(() => expect(m.problemas).toEqual([]));
  });
});

describe('revisión: sesión y receptor', () => {
  it('si la sesión venció y hay señal, intenta renovarla sola y vuelve a enviar', async () => {
    const p = persistenciaMemoria();
    await p.guardarSesion({ correo: 'ana.torres@ejemplo.mx', nombre: 'Ana', cargo: '', token: 'viejo', expira: 1 });
    const llamadas: string[] = [];
    const cliente: ClienteReceptor = { sincronizar: async t => { llamadas.push(t); return sinc()(t, 0, []); }, subirFoto: async () => ({ ok: false, error: 'sin_red', mensaje: '' }) };
    const nuevo = tokenDePrueba('ana.torres@ejemplo.mx', 'Ana', 9_999_999_999);
    const acceso = { mostrarBoton() { /* no se usa */ }, renovar: (recibir: (j: string) => void) => recibir(nuevo) };
    const raiz = document.createElement('div');
    const m = await arrancar(raiz, p, async () => true, { config: { receptorUrl: 'https://r', clientId: 'c' }, cliente, acceso });
    await vi.waitFor(() => expect(llamadas).toEqual([nuevo]));
    expect(m!.sesion?.token).toBe(nuevo);
    montar(null, raiz);
  });

  it('una respuesta que no es JSON (receptor mal publicado) no se confunde con falta de señal', async () => {
    const html = (async () => new Response('<html>Inicia sesión</html>')) as unknown as typeof fetch;
    expect(await clienteHttp('https://r', html).sincronizar('t', 0, [])).toMatchObject({ ok: false, error: 'error_interno', mensaje: /receptor/ });
  });

  it('al regresar a la app (pestaña visible) se sincroniza', () => {
    const s = vi.fn();
    const doc = new EventTarget() as unknown as Document & { visibilityState: string };
    Object.defineProperty(doc, 'visibilityState', { value: 'visible', configurable: true });
    const p = programarSincronizacion(s, { cadaMs: 1_000_000, ventana: new EventTarget() as unknown as Window, documento: doc });
    expect(s).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(s).toHaveBeenCalledTimes(2);
    p.detener();
  });
});
