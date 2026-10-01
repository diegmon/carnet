import { Contexto, Rechazo } from '../contexto';
import { filaVacia } from '../almacen';
import { limpiar, texto, enLista, existente } from './comun';
import { ENTIDADES_ANULABLES, ESTADOS_ACUERDO, ESTADOS_CON_NOTA, MIN_NOTA_ACLARATORIA, verdadero } from '../../dominio/tipos';
import { TABLA_DE, OpCrear } from '../../dominio/operaciones';

export function crearEstado(ctx: Contexto, op: OpCrear): void {
  const previo = existente(ctx, 'historial_estados', op);
  if (previo) return recalcularVigente(ctx, String(previo.acuerdo_id));
  const d = limpiar(op.datos, ['acuerdo_id', 'estado', 'nota']);
  const acuerdoId = texto(d, 'acuerdo_id');
  const acuerdo = ctx.exigir('acuerdos', acuerdoId, 'Acuerdo');
  if (verdadero(acuerdo.anulado) || verdadero(acuerdo.quitado)) throw new Rechazo('El acuerdo está anulado');
  const estado = enLista(d.estado, ESTADOS_ACUERDO, 'estado');
  if (ESTADOS_CON_NOTA.includes(estado) && !d.nota) throw new Rechazo(`El estado ${estado} requiere una nota`);
  ctx.insertar('historial_estados', {
    ...filaVacia('historial_estados'), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts,
  });
  recalcularVigente(ctx, acuerdoId);
}

function recalcularVigente(ctx: Contexto, acuerdoId: string): void {
  const historial = ctx.almacen.filas('historial_estados')
    .filter(h => h.acuerdo_id === acuerdoId)
    .sort((x, y) => (Date.parse(String(x.creado_en)) - Date.parse(String(y.creado_en))) || (Number(x._rev) - Number(y._rev)));
  ctx.modificar('acuerdos', acuerdoId, { estado_vigente: String(historial[historial.length - 1].estado) });
}

export function crearAnulacion(ctx: Contexto, op: OpCrear): void {
  const previa = existente(ctx, 'anulaciones', op);
  if (previa) {
    const tPrevia = TABLA_DE[enLista(previa.entidad, ENTIDADES_ANULABLES, 'entidad')];
    return ctx.modificar(tPrevia, String(previa.registro_id), { anulado: true });
  }
  const d = limpiar(op.datos, ['entidad', 'registro_id', 'nota_aclaratoria']);
  const entidad = enLista(d.entidad, ENTIDADES_ANULABLES, 'entidad');
  const t = TABLA_DE[entidad];
  const registroId = texto(d, 'registro_id');
  const registro = ctx.exigir(t, registroId, 'Registro');
  if (verdadero(registro.anulado)) throw new Rechazo('El registro ya está anulado');
  const nota = String(d.nota_aclaratoria ?? '');
  if (nota.length < MIN_NOTA_ACLARATORIA) {
    throw new Rechazo(`La nota aclaratoria debe explicar el motivo (mínimo ${MIN_NOTA_ACLARATORIA} caracteres)`);
  }
  ctx.insertar('anulaciones', {
    ...filaVacia('anulaciones'), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts,
  });
  ctx.modificar(t, registroId, { anulado: true });
}
