import { describe, it, expect } from 'vitest';
import { leerConfig } from '../../app/src/config';
import { clienteHttp } from '../../app/src/estado/cliente';

describe('leerConfig', () => {
  it('exige URL segura y client id', () => {
    expect(leerConfig({})).toBeUndefined();
    expect(leerConfig({ VITE_RECEPTOR_URL: 'http://ejemplo.mx/exec', VITE_GOOGLE_CLIENT_ID: 'c' })).toBeUndefined();
    expect(leerConfig({ VITE_RECEPTOR_URL: 'https://script.google.com/macros/s/X/exec', VITE_GOOGLE_CLIENT_ID: 'c.apps.googleusercontent.com' }))
      .toEqual({ receptorUrl: 'https://script.google.com/macros/s/X/exec', clientId: 'c.apps.googleusercontent.com' });
    expect(leerConfig({ VITE_RECEPTOR_URL: 'http://localhost:8787', VITE_GOOGLE_CLIENT_ID: 'x' })?.receptorUrl).toBe('http://localhost:8787');
  });
});

describe('clienteHttp', () => {
  it('envía texto plano con la acción y regresa la respuesta', async () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify({ ok: true, resultados: [], folios: {}, cambios: { rev: 3, tablas: {}, usuarios: [] } }));
    }) as unknown as typeof fetch;
    const r = await clienteHttp('https://r.example/exec', f).sincronizar('tok', 2, []);
    expect(r).toMatchObject({ ok: true, cambios: { rev: 3 } });
    expect(llamadas[0].init.method).toBe('POST');
    expect((llamadas[0].init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({ accion: 'sincronizar', id_token: 'tok', cursor: 2, ops: [] });
  });

  it('sin red responde sin_red; una respuesta ilegible o un HTTP 500 es error_interno', async () => {
    const caido = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await clienteHttp('https://r', caido).sincronizar('t', 0, [])).toMatchObject({ ok: false, error: 'sin_red' });
    const html = (async () => new Response('<html>')) as unknown as typeof fetch;
    expect(await clienteHttp('https://r', html).subirFoto('t', 'a', 'image/jpeg', 'QQ==')).toMatchObject({ ok: false, error: 'error_interno' });
    const fallo = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    expect(await clienteHttp('https://r', fallo).sincronizar('t', 0, [])).toMatchObject({ ok: false, error: 'error_interno' });
  });
});
