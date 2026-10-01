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

/** Bytes de un Blob; usa FileReader donde no existe Blob.arrayBuffer (iOS anteriores a 14). */
async function bytesDe(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return new Uint8Array(await b.arrayBuffer());
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(new Uint8Array(lector.result as ArrayBuffer));
    lector.onerror = () => rechazar(lector.error);
    lector.readAsArrayBuffer(b);
  });
}

export async function aBase64(b: Blob): Promise<string> {
  const bytes = await bytesDe(b);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const TIPOS_SUBIBLES = ['image/jpeg', 'image/png', 'image/webp'];

export async function subirFotosPendientes(
  motor: Motor, cliente: ClienteReceptor, token: string, comprimir: (b: Blob) => Promise<Blob> = comprimirFoto,
): Promise<number> {
  const conProblema = new Set(motor.problemas.map(p => p.op.op_id));
  const pendientes = (motor.base.anexos ?? [])
    .filter(a => !a.drive_url && !verdadero(a.quitado) && !conProblema.has(`foto:${a.id}`));
  let subidas = 0;
  for (const anexo of pendientes) {
    const id = String(anexo.id);
    const descripcion = String(anexo.descripcion ?? '');
    const original = await motor.persistencia.leerFoto(id);
    if (!original) continue;
    const foto = await comprimir(original);
    const tipo = foto.type || 'image/jpeg';
    if (!TIPOS_SUBIBLES.includes(tipo)) {
      motor.registrarProblemaFoto(id, descripcion, 'Formato de foto no compatible (por ejemplo, HEIC). Vuelve a tomarla con la cámara desde la app.');
      continue;
    }
    const r = await cliente.subirFoto(token, id, tipo, await aBase64(foto));
    if (r.ok) {
      motor.marcarFotoSubida(id, r.drive_url);
      subidas++;
    } else if (r.error === 'sin_red' || r.error === 'sesion_vencida' || r.error === 'no_autorizado') {
      break;
    } else if (r.error === 'solicitud_invalida') {
      // Rechazo definitivo: se avisa en Problemas y no se vuelve a enviar.
      motor.registrarProblemaFoto(id, descripcion, r.mensaje);
    }
    // 'pendiente' y 'error_interno' se reintentan en la siguiente sincronización.
  }
  return subidas;
}
