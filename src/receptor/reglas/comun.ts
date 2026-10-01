import { Rechazo } from '../contexto';
import type { Fila, Valor } from '../../dominio/tipos';
import type { Contexto } from '../contexto';
import type { NombreTabla } from '../../dominio/esquema';
import type { OpCrear } from '../../dominio/operaciones';

/**
 * Si el id ya existe y lo escribió esta misma captura (mismo usuario y misma hora de captura),
 * la operación quedó a medias en un intento anterior: se devuelve la fila para completarla.
 * Si lo escribió otra captura, se rechaza.
 */
export function existente(ctx: Contexto, t: NombreTabla, op: OpCrear): Fila | undefined {
  const f = ctx.buscar(t, op.id);
  if (!f) return undefined;
  if (f.creado_por === ctx.usuario && f.creado_en === op.ts) return f;
  throw new Rechazo(`Ya existe: ${op.id}`);
}

const MAX_TEXTO = 5000;

export function limpiar(datos: unknown, permitidos: readonly string[]): Fila {
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) throw new Rechazo('Datos inválidos');
  const fuera: Fila = {};
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    if (!permitidos.includes(k)) throw new Rechazo(`Campo no permitido: ${k}`);
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > MAX_TEXTO) throw new Rechazo(`Texto demasiado largo en ${k}`);
      fuera[k] = t;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      fuera[k] = v;
    } else if (typeof v === 'boolean') {
      fuera[k] = v;
    } else {
      throw new Rechazo(`Valor inválido en ${k}`);
    }
  }
  return fuera;
}

export function texto(f: Fila, campo: string): string {
  const v = f[campo];
  if (typeof v !== 'string' || v === '') throw new Rechazo(`Falta ${campo}`);
  return v;
}

export function enLista<T extends string>(v: Valor | undefined, lista: readonly T[], campo: string): T {
  if (typeof v !== 'string' || !(lista as readonly string[]).includes(v)) throw new Rechazo(`${campo} inválido: ${String(v ?? '')}`);
  return v as T;
}

function fechaReal(s: string): boolean {
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s.slice(0, 10);
}

export function fecha(v: Valor | undefined, campo: string): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !fechaReal(v)) throw new Rechazo(`${campo} debe ser AAAA-MM-DD`);
  return v;
}

export function hora(v: Valor | undefined): string {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Rechazo('hora debe ser HH:MM');
  return v;
}

export function fechaHora(v: Valor | undefined): string {
  if (typeof v !== 'string') throw new Rechazo('fecha_acordada inválida');
  const [f, h] = v.split('T');
  fecha(f, 'fecha_acordada');
  if (h !== undefined) hora(h);
  return v;
}

export function lista(v: Valor | undefined): string[] {
  if (v === undefined || v === '') return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}
