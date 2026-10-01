import type { Respuesta } from '../../../src/receptor/http';
import type { RespuestaFoto } from '../../../src/receptor/fotos';
import type { Operacion } from '../../../src/dominio/operaciones';

type SinRed = { ok: false; error: 'sin_red'; mensaje: string };
export type RespuestaSync = Respuesta | SinRed;
export type RespuestaFotoCliente = RespuestaFoto | SinRed;

export interface ClienteReceptor {
  sincronizar(token: string, cursor: number, ops: Operacion[]): Promise<RespuestaSync>;
  subirFoto(token: string, anexoId: string, tipo: string, base64: string): Promise<RespuestaFotoCliente>;
}

const SIN_RED: SinRed = { ok: false, error: 'sin_red', mensaje: 'Sin conexión con el receptor' };

/** Habla con el receptor de Apps Script. Texto plano para evitar la verificación previa de CORS. */
export function clienteHttp(url: string, f: typeof fetch = (...a) => fetch(...a)): ClienteReceptor {
  async function enviar<T>(cuerpo: object): Promise<T | SinRed | { ok: false; error: 'error_interno'; mensaje: string }> {
    let res: Response;
    try {
      res = await f(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cuerpo),
      });
    } catch {
      return SIN_RED;
    }
    if (!res.ok) return { ok: false, error: 'error_interno', mensaje: `El receptor respondió ${res.status}` };
    try {
      return (await res.json()) as T;
    } catch {
      return SIN_RED;
    }
  }
  return {
    sincronizar: (token, cursor, ops) => enviar<Respuesta>({ accion: 'sincronizar', id_token: token, cursor, ops }) as Promise<RespuestaSync>,
    subirFoto: (token, anexoId, tipo, base64) =>
      enviar<RespuestaFoto>({ accion: 'subir_foto', id_token: token, anexo_id: anexoId, tipo, datos: base64 }) as Promise<RespuestaFotoCliente>,
  };
}
