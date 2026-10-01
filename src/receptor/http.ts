import type { Almacen } from './almacen';
import { aplicarOperaciones } from './aplicar';
import { cambiosDesde, Cambios } from './cambios';
import { Claims, ErrorAcceso, exigirUsuarioActivo, validarClaims } from './acceso';
import { validarForma, Folios, Operacion, ResultadoOp } from '../dominio/operaciones';
import { procesarFoto, RespuestaFoto } from './fotos';

export const MAX_OPS = 200;

export interface Dependencias {
  almacen: Almacen;
  obtenerClaims(token: string): Claims;
  ahora(): string;
  ahoraSeg(): number;
  candado<T>(fn: () => T): T;
  /** Guarda un archivo (base64) en la carpeta de Drive y devuelve su URL. */
  guardarArchivo?(nombre: string, tipo: string, base64: string): string;
}

export type Respuesta =
  | { ok: true; resultados: ResultadoOp[]; folios: Folios; cambios: Cambios }
  | { ok: false; error: 'sesion_vencida' | 'no_autorizado' | 'solicitud_invalida' | 'error_interno'; mensaje: string };

const invalida = (mensaje: string): Respuesta => ({ ok: false, error: 'solicitud_invalida', mensaje });

export function procesarSolicitud(cuerpo: string, deps: Dependencias): Respuesta {
  let s: Record<string, unknown>;
  try {
    const x = JSON.parse(cuerpo);
    if (typeof x !== 'object' || x === null) return invalida('Solicitud vacía');
    s = x;
  } catch {
    return invalida('JSON inválido');
  }
  if (s.accion !== 'sincronizar') return invalida('Acción desconocida');
  if (typeof s.id_token !== 'string' || s.id_token === '') {
    return { ok: false, error: 'sesion_vencida', mensaje: 'Vuelve a iniciar sesión para sincronizar' };
  }
  if (!Array.isArray(s.ops) || s.ops.length > MAX_OPS) return invalida(`Se esperan entre 0 y ${MAX_OPS} operaciones`);
  const cursor = Number(s.cursor ?? 0);
  if (!Number.isInteger(cursor) || cursor < 0) return invalida('Cursor inválido');
  // Cada operación se valida sola: una mal formada se rechaza sin bloquear al resto de la cola.
  const ops: Operacion[] = [];
  const previos: (ResultadoOp | null)[] = [];
  for (const x of s.ops as unknown[]) {
    try {
      ops.push(validarForma(x));
      previos.push(null);
    } catch (e) {
      const opId = typeof x === 'object' && x !== null ? (x as Record<string, unknown>).op_id : undefined;
      if (typeof opId !== 'string' || opId === '') return invalida('Operación sin op_id');
      previos.push({ op_id: opId, estado: 'rechazada', motivo: (e as Error).message });
    }
  }
  const token = s.id_token;
  try {
    const correo = validarClaims(deps.obtenerClaims(token), deps.almacen.config('client_id'), deps.ahoraSeg());
    return deps.candado(() => {
      deps.almacen.refrescar?.();
      exigirUsuarioActivo(deps.almacen, correo);
      const aplicadas = aplicarOperaciones(deps.almacen, correo, ops, deps.ahora);
      let k = 0;
      const resultados = previos.map(p => p ?? aplicadas.resultados[k++]);
      const folios = aplicadas.folios;
      return { ok: true as const, resultados, folios, cambios: cambiosDesde(deps.almacen, cursor) };
    });
  } catch (e) {
    if (e instanceof ErrorAcceso) return { ok: false, error: e.codigo, mensaje: e.message };
    throw e;
  }
}

/** Punto de entrada: despacha según la acción solicitada. */
export function procesar(cuerpo: string, deps: Dependencias): Respuesta | RespuestaFoto {
  try {
    const s = JSON.parse(cuerpo);
    if (s && typeof s === 'object' && s.accion === 'subir_foto') return procesarFoto(s as Record<string, unknown>, deps);
  } catch {
    /* procesarSolicitud responde JSON inválido */
  }
  return procesarSolicitud(cuerpo, deps);
}
