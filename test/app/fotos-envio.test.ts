import { describe, it, expect } from 'vitest';
import { aBase64, comprimirFoto, subirFotosPendientes } from '../../app/src/estado/fotos-envio';
import type { ClienteReceptor } from '../../app/src/estado/cliente';
import { motorDePrueba, conCarnet, reunionCon } from './ayuda';

describe('fotos', () => {
  it('aBase64 convierte bytes, también grandes', async () => {
    expect(await aBase64(new Blob(['ABC']))).toBe('QUJD');
    const grande = new Uint8Array(200_000).fill(65);
    expect((await aBase64(new Blob([grande]))).length).toBe(Math.ceil(200_000 / 3) * 4);
  });

  it('sin APIs de imagen, comprimir devuelve la original', async () => {
    const b = new Blob(['x'], { type: 'image/jpeg' });
    expect(await comprimirFoto(b)).toBe(b);
  });

  it('sube solo las fotos confirmadas por el receptor y sin liga; se detiene sin red', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    await m.agregarFoto(r, new Blob(['uno'], { type: 'image/jpeg' }), 'a');
    await m.agregarFoto(r, new Blob(['dos'], { type: 'image/jpeg' }), 'b');
    const [a1, a2] = m.almacen.filas('anexos').map(x => String(x.id));
    m.base = { ...m.base, anexos: m.almacen.filas('anexos') };
    const subidas: string[] = [];
    const cliente: ClienteReceptor = {
      sincronizar: async () => ({ ok: false, error: 'sin_red', mensaje: '' }),
      subirFoto: async (_t, id, tipo, b64) => {
        subidas.push(`${id}:${tipo}:${b64}`);
        return id === a1 ? { ok: true, drive_url: `https://drive.example/${id}` } : { ok: false, error: 'sin_red', mensaje: '' };
      },
    };
    const n = await subirFotosPendientes(m, cliente, 'tok', async b => b);
    expect(n).toBe(1);
    expect(subidas).toEqual([`${a1}:image/jpeg:dW5v`, `${a2}:image/jpeg:ZG9z`]);
    expect(m.almacen.filas('anexos').find(x => x.id === a1)!.drive_url).toBe(`https://drive.example/${a1}`);
    subidas.length = 0;
    await subirFotosPendientes(m, cliente, 'tok', async b => b);
    expect(subidas).toEqual([`${a2}:image/jpeg:ZG9z`]);
  });
});
