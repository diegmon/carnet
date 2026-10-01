import type { Motor } from './motor';
import type { ClienteReceptor } from './cliente';
import { verdadero } from '../../../src/dominio/tipos';

/** Reduce la foto a máximo 1600 px y JPEG; si el navegador no puede, se envía la original. */
export async function comprimirFoto(b: Blob, max = 1600, calidad = 0.8): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return b;
  try {
    const img = await createImageBitmap(b);
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    const ctx = lienzo.getContext('2d');
    if (!ctx) return b;
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return await new Promise<Blob>(res => lienzo.toBlob(x => res(x ?? b), 'image/jpeg', calidad));
  } catch {
    return b;
  }
}

export async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function subirFotosPendientes(
  motor: Motor, cliente: ClienteReceptor, token: string, comprimir: (b: Blob) => Promise<Blob> = comprimirFoto,
): Promise<number> {
  const pendientes = (motor.base.anexos ?? []).filter(a => !a.drive_url && !verdadero(a.quitado));
  let subidas = 0;
  for (const anexo of pendientes) {
    const id = String(anexo.id);
    const original = await motor.persistencia.leerFoto(id);
    if (!original) continue;
    const foto = await comprimir(original);
    const r = await cliente.subirFoto(token, id, foto.type || 'image/jpeg', await aBase64(foto));
    if (r.ok) {
      motor.marcarFotoSubida(id, r.drive_url);
      subidas++;
    } else if (r.error === 'sin_red') {
      break;
    }
  }
  return subidas;
}
