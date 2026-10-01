import type { Almacen } from './almacen';
import { Contexto, Rechazo } from './contexto';
import { aplicarUna } from './reglas';
import type { Folios, Operacion, ResultadoOp } from '../dominio/operaciones';

/**
 * Aplica operaciones en orden. Cada una es idempotente por op_id: si ya se procesó,
 * devuelve el mismo resultado sin volver a escribir. Un Rechazo no detiene el lote.
 * Cualquier otro error se propaga (el teléfono reintentará; lo ya aplicado no se duplica).
 */
export function aplicarOperaciones(
  almacen: Almacen, usuario: string, ops: Operacion[], ahora: () => string,
  opciones: { formatoFolio?: (n: number, prefijo: string) => string } = {},
): { resultados: ResultadoOp[]; folios: Folios } {
  const ctx = new Contexto(almacen, usuario, ahora, '', opciones.formatoFolio);
  const resultados = ops.map((op): ResultadoOp => {
    const previa = almacen.filas('ops').find(f => f.op_id === op.op_id);
    if (previa) {
      return previa.estado === 'rechazada'
        ? { op_id: op.op_id, estado: 'rechazada', motivo: String(previa.motivo) }
        : { op_id: op.op_id, estado: 'aplicada' };
    }
    ctx.opId = op.op_id;
    let r: ResultadoOp;
    try {
      aplicarUna(ctx, op);
      r = { op_id: op.op_id, estado: 'aplicada' };
    } catch (e) {
      if (!(e instanceof Rechazo)) throw e;
      r = { op_id: op.op_id, estado: 'rechazada', motivo: e.message };
    }
    almacen.agregar('ops', { op_id: op.op_id, usuario, estado: r.estado, motivo: r.motivo ?? '', aplicada_en: ahora() });
    return r;
  });
  return { resultados, folios: ctx.folios };
}
