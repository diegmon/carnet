import { Contexto, Rechazo } from '../contexto';
import type { Operacion } from '../../dominio/operaciones';
import { crearPersona, actualizarPersona } from './persona';
import { crearEstado, crearAnulacion } from './acuerdo';
import { crearColectivo, crearInstitucion } from './catalogos';
import { crearReunion, actualizarReunion, sellarReunion, crearHijo, actualizarHijo, quitarHijo } from './reunion';

export function aplicarUna(ctx: Contexto, op: Operacion): void {
  const descripcion = `${op.tipo} ${op.entidad}`;
  switch (op.tipo) {
    case 'crear':
      switch (op.entidad) {
        case 'persona': return crearPersona(ctx, op);
        case 'reunion': return crearReunion(ctx, op);
        case 'asistente': case 'peticion': case 'acuerdo': case 'anexo':
          return crearHijo(ctx, { ...op, entidad: op.entidad });
        case 'colectivo': return crearColectivo(ctx, op);
        case 'institucion': return crearInstitucion(ctx, op);
        case 'estado_acuerdo': return crearEstado(ctx, op);
        case 'anulacion': return crearAnulacion(ctx, op);
      }
      break;
    case 'actualizar':
      switch (op.entidad) {
        case 'persona': return actualizarPersona(ctx, op);
        case 'reunion': return actualizarReunion(ctx, op);
        default: return actualizarHijo(ctx, { ...op, entidad: op.entidad });
      }
    case 'quitar': return quitarHijo(ctx, op);
    case 'sellar': return sellarReunion(ctx, op);
  }
  throw new Rechazo(`Operación no soportada: ${descripcion}`);
}
