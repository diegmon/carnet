import type { Dependencias } from './http';
import { Contexto } from './contexto';
import { ErrorAcceso, exigirUsuarioActivo, validarClaims } from './acceso';
import { verdadero } from '../dominio/tipos';

export const TIPOS_FOTO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_FOTO_BASE64 = 14_000_000;

export type RespuestaFoto =
  | { ok: true; drive_url: string }
  | { ok: false; error: 'sesion_vencida' | 'no_autorizado' | 'solicitud_invalida' | 'pendiente' | 'error_interno'; mensaje: string };

export function procesarFoto(s: Record<string, unknown>, deps: Dependencias): RespuestaFoto {
  if (typeof s.id_token !== 'string' || s.id_token === '') {
    return { ok: false, error: 'sesion_vencida', mensaje: 'Vuelve a iniciar sesión para enviar las fotos' };
  }
  const anexoId = s.anexo_id;
  const tipo = s.tipo;
  const datos = s.datos;
  if (typeof anexoId !== 'string' || !anexoId) return { ok: false, error: 'solicitud_invalida', mensaje: 'Falta anexo_id' };
  if (typeof tipo !== 'string' || !TIPOS_FOTO[tipo]) return { ok: false, error: 'solicitud_invalida', mensaje: 'Tipo de imagen no permitido' };
  if (typeof datos !== 'string' || !datos || datos.length > MAX_FOTO_BASE64) {
    return { ok: false, error: 'solicitud_invalida', mensaje: 'La foto está vacía o es demasiado grande' };
  }
  const guardar = deps.guardarArchivo;
  if (!guardar) return { ok: false, error: 'error_interno', mensaje: 'El receptor no puede guardar archivos' };
  try {
    const correo = validarClaims(deps.obtenerClaims(s.id_token), deps.almacen.config('client_id'), deps.ahoraSeg());
    return deps.candado((): RespuestaFoto => {
      deps.almacen.refrescar?.();
      exigirUsuarioActivo(deps.almacen, correo);
      const anexo = deps.almacen.filas('anexos').find(a => a.id === anexoId);
      if (!anexo) return { ok: false, error: 'pendiente', mensaje: 'El registro de la foto aún no llega; se reintentará' };
      if (verdadero(anexo.quitado)) return { ok: false, error: 'solicitud_invalida', mensaje: 'La foto fue quitada de la reunión' };
      if (anexo.drive_url) return { ok: true, drive_url: String(anexo.drive_url) };
      const url = guardar(`${anexoId}.${TIPOS_FOTO[tipo]}`, tipo, datos);
      new Contexto(deps.almacen, correo, deps.ahora, `foto:${anexoId}`).modificar('anexos', anexoId, { drive_url: url });
      return { ok: true, drive_url: url };
    });
  } catch (e) {
    if (e instanceof ErrorAcceso) return { ok: false, error: e.codigo, mensaje: e.message };
    throw e;
  }
}
