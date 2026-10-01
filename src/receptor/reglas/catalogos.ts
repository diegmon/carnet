import { Contexto, Rechazo } from '../contexto';
import { filaVacia } from '../almacen';
import { limpiar, texto, enLista, existente } from './comun';
import { normalizar } from '../../dominio/texto';
import type { OpCrear } from '../../dominio/operaciones';

export const TIPOS_INSTITUCION = ['Dependencia', 'Órgano desconcentrado', 'Organismo', 'Autónomo', 'Alcaldía', 'Área', 'Federal', 'Otro'] as const;

export function crearColectivo(ctx: Contexto, op: OpCrear): void {
  if (existente(ctx, 'colectivos', op)) return;
  const d = limpiar(op.datos, ['nombre']);
  const nombre = texto(d, 'nombre');
  if (ctx.almacen.filas('colectivos').some(c => normalizar(String(c.nombre)) === normalizar(nombre))) {
    throw new Rechazo('El colectivo ya existe');
  }
  ctx.insertar('colectivos', { ...filaVacia('colectivos'), id: op.id, creado_por: ctx.usuario, creado_en: op.ts, nombre });
}

export function crearInstitucion(ctx: Contexto, op: OpCrear): void {
  if (existente(ctx, 'instituciones', op)) return;
  const d = limpiar(op.datos, ['nombre', 'siglas', 'tipo', 'area_de']);
  const nombre = texto(d, 'nombre');
  enLista(d.tipo, TIPOS_INSTITUCION, 'tipo');
  const areaDe = String(d.area_de ?? '');
  if (areaDe) ctx.exigir('instituciones', areaDe, 'Institución');
  const repetida = ctx.almacen.filas('instituciones').some(i =>
    String(i.area_de ?? '') === areaDe && normalizar(String(i.nombre)) === normalizar(nombre));
  if (repetida) throw new Rechazo('La institución ya existe');
  ctx.insertar('instituciones', {
    ...filaVacia('instituciones'), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts, usos: 0,
  });
}
