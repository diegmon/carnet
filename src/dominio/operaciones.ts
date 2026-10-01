import type { Fila } from './tipos';
import type { NombreTabla } from './esquema';

export type EntidadCreable =
  | 'persona' | 'reunion' | 'asistente' | 'peticion' | 'acuerdo' | 'anexo'
  | 'estado_acuerdo' | 'anulacion' | 'colectivo' | 'institucion';
export type EntidadActualizable = 'persona' | 'reunion' | 'asistente' | 'peticion' | 'acuerdo';
export type EntidadQuitable = 'asistente' | 'peticion' | 'acuerdo' | 'anexo';

interface OpBase { op_id: string; id: string; ts: string }
export interface OpCrear extends OpBase { tipo: 'crear'; entidad: EntidadCreable; datos: Fila }
export interface OpActualizar extends OpBase { tipo: 'actualizar'; entidad: EntidadActualizable; cambios: Fila }
export interface OpQuitar extends OpBase { tipo: 'quitar'; entidad: EntidadQuitable }
export interface OpSellar extends OpBase { tipo: 'sellar'; entidad: 'reunion' }
export type Operacion = OpCrear | OpActualizar | OpQuitar | OpSellar;

export type ResultadoOp = { op_id: string; estado: 'aplicada' | 'rechazada'; motivo?: string };
export type Folios = Record<string, string>;

export const TABLA_DE: Record<EntidadCreable, NombreTabla> = {
  persona: 'personas', reunion: 'reuniones', asistente: 'asistentes', peticion: 'peticiones',
  acuerdo: 'acuerdos', anexo: 'anexos', estado_acuerdo: 'historial_estados',
  anulacion: 'anulaciones', colectivo: 'colectivos', institucion: 'instituciones',
};

const CREABLES = Object.keys(TABLA_DE) as EntidadCreable[];
const ACTUALIZABLES: EntidadActualizable[] = ['persona', 'reunion', 'asistente', 'peticion', 'acuerdo'];
const QUITABLES: EntidadQuitable[] = ['asistente', 'peticion', 'acuerdo', 'anexo'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function incluye<T extends string>(lista: readonly T[], v: string): v is T {
  return (lista as readonly string[]).includes(v);
}

export function validarForma(x: unknown): Operacion {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new Error('Operación inválida');
  const o = x as Record<string, unknown>;
  const cadena = (k: string): string => {
    const v = o[k];
    if (typeof v !== 'string' || v === '' || v.length > 200) throw new Error(`Operación sin ${k} válido`);
    return v;
  };
  const objeto = (k: string): Fila => {
    const v = o[k];
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`Operación sin ${k}`);
    return v as Fila;
  };
  const op_id = cadena('op_id');
  const id = cadena('id');
  const ts = cadena('ts');
  if (!ISO.test(ts)) throw new Error(`Fecha inválida en ${op_id}`);
  const entidad = cadena('entidad');
  switch (o.tipo) {
    case 'crear':
      if (!incluye(CREABLES, entidad)) throw new Error(`Entidad no válida para crear: ${entidad}`);
      return { op_id, tipo: 'crear', entidad, id, ts, datos: objeto('datos') };
    case 'actualizar':
      if (!incluye(ACTUALIZABLES, entidad)) throw new Error(`Entidad no válida para actualizar: ${entidad}`);
      return { op_id, tipo: 'actualizar', entidad, id, ts, cambios: objeto('cambios') };
    case 'quitar':
      if (!incluye(QUITABLES, entidad)) throw new Error(`Entidad no válida para quitar: ${entidad}`);
      return { op_id, tipo: 'quitar', entidad, id, ts };
    case 'sellar':
      if (entidad !== 'reunion') throw new Error(`Entidad no válida para sellar: ${entidad}`);
      return { op_id, tipo: 'sellar', entidad, id, ts };
    default:
      throw new Error(`Tipo de operación desconocido en ${op_id}`);
  }
}
