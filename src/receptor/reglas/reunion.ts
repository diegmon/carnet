import { Contexto, Rechazo } from '../contexto';
import { filaVacia } from '../almacen';
import { limpiar, texto, enLista, fecha, hora, fechaHora, lista, existente } from './comun';
import { MODALIDADES, PAPELES, verdadero, Fila } from '../../dominio/tipos';
import type { NombreTabla } from '../../dominio/esquema';
import type { EntidadQuitable, OpActualizar, OpCrear, OpQuitar, OpSellar } from '../../dominio/operaciones';

const CAMPOS_REUNION = ['fecha', 'hora', 'modalidad', 'sede', 'tema', 'orden_del_dia', 'narrativo'] as const;

type Hijo = EntidadQuitable;
const TABLA_HIJO: Record<Hijo, NombreTabla> = {
  asistente: 'asistentes', peticion: 'peticiones', acuerdo: 'acuerdos', anexo: 'anexos',
};
const CAMPOS_HIJO: Record<Hijo, readonly string[]> = {
  asistente: ['reunion_id', 'persona_id', 'papel', 'parentesco_o_cargo'],
  peticion: ['reunion_id', 'texto', 'persona_ids'],
  acuerdo: ['reunion_id', 'texto', 'persona_ids', 'instituciones', 'responsable', 'fecha_acordada', 'sustituye_a'],
  anexo: ['reunion_id', 'descripcion'],
};

function validarReunion(d: Fila): void {
  if ('fecha' in d) fecha(d.fecha, 'fecha');
  if (d.hora) hora(d.hora);
  if (d.modalidad) enLista(d.modalidad, MODALIDADES, 'modalidad');
}

function reunionEnBorrador(ctx: Contexto, id: string): Fila {
  const r = ctx.exigir('reuniones', id, 'Reunión');
  if (r.estado !== 'Borrador') throw new Rechazo('La reunión ya está sellada');
  return r;
}

export function enlazarSustituto(ctx: Contexto, anuladoId: string, nuevoId: string): void {
  const anulacion = ctx.almacen.filas('anulaciones').find(f => f.registro_id === anuladoId);
  if (anulacion) ctx.modificar('anulaciones', String(anulacion.id), { sustituido_por: nuevoId });
}

function exigirAnulado(ctx: Contexto, t: NombreTabla, id: string): void {
  const f = ctx.exigir(t, id, 'Registro sustituido');
  if (!verdadero(f.anulado)) throw new Rechazo('Solo se puede sustituir un registro anulado');
  const anulacion = ctx.almacen.filas('anulaciones').find(n => n.registro_id === id);
  if (anulacion?.sustituido_por) throw new Rechazo('Ese registro ya tiene corrección');
}

export function crearReunion(ctx: Contexto, op: OpCrear): void {
  const previa = existente(ctx, 'reuniones', op);
  if (previa) {
    if (previa.sustituye_a) enlazarSustituto(ctx, String(previa.sustituye_a), op.id);
    return;
  }
  const d = limpiar(op.datos, [...CAMPOS_REUNION, 'sustituye_a']);
  fecha(d.fecha, 'fecha');
  validarReunion(d);
  if (d.sustituye_a) exigirAnulado(ctx, 'reuniones', String(d.sustituye_a));
  ctx.insertar('reuniones', {
    ...filaVacia('reuniones'), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts, estado: 'Borrador',
  });
  if (d.sustituye_a) enlazarSustituto(ctx, String(d.sustituye_a), op.id);
}

export function actualizarReunion(ctx: Contexto, op: OpActualizar): void {
  reunionEnBorrador(ctx, op.id);
  const c = limpiar(op.cambios, CAMPOS_REUNION);
  validarReunion(c);
  ctx.modificar('reuniones', op.id, c);
}

function exigirPersonas(ctx: Contexto, v: Fila[string] | undefined, obligatorio: boolean): void {
  const ids = lista(v);
  if (obligatorio && ids.length === 0) throw new Rechazo('El acuerdo necesita al menos un carnet');
  for (const id of ids) {
    const p = ctx.exigir('personas', id, 'Persona');
    if (verdadero(p.anulado)) throw new Rechazo(`${String(p.nombre)} está anulada`);
    if (p.tipo !== 'Atendida') throw new Rechazo(`${String(p.nombre)} no tiene carnet`);
  }
}

function validarHijo(ctx: Contexto, hijo: Hijo, d: Fila, creando: boolean, actual: Fila = {}): void {
  if (hijo === 'asistente') {
    if (creando || 'papel' in d) enLista(d.papel, PAPELES, 'papel');
    if (creando || 'persona_id' in d || 'papel' in d) {
      // Se valida el resultado de aplicar los cambios, no solo los campos que cambian.
      const resultado = { ...actual, ...d };
      const p = ctx.exigir('personas', texto(resultado, 'persona_id'), 'Persona');
      if (verdadero(p.anulado)) throw new Rechazo('La persona está anulada');
      if (resultado.papel === 'Atendida' && p.tipo !== 'Atendida') throw new Rechazo('Primero dale carnet a la persona');
      if (creando || 'persona_id' in d) d.nombre = p.nombre;
    }
  }
  if (hijo === 'peticion') {
    if (creando || 'texto' in d) texto(d, 'texto');
    exigirPersonas(ctx, d.persona_ids, false);
  }
  if (hijo === 'acuerdo') {
    if (creando || 'texto' in d) texto(d, 'texto');
    if (creando || 'persona_ids' in d) exigirPersonas(ctx, d.persona_ids, true);
    if (creando || 'instituciones' in d) {
      const claves = lista(d.instituciones);
      if (claves.length === 0) throw new Rechazo('El acuerdo necesita al menos una institución');
      for (const k of claves) ctx.exigir('instituciones', k, 'Institución');
    }
    if (creando || 'responsable' in d) {
      const correo = texto(d, 'responsable').toLowerCase();
      const u = ctx.almacen.filas('usuarios').find(x => String(x.correo).toLowerCase() === correo);
      if (!u || !verdadero(u.activo)) throw new Rechazo('El responsable debe ser alguien del equipo');
      d.responsable = correo;
    }
    if (d.fecha_acordada) fechaHora(d.fecha_acordada);
    if (d.sustituye_a) exigirAnulado(ctx, 'acuerdos', String(d.sustituye_a));
  }
}

export function crearHijo(ctx: Contexto, op: OpCrear & { entidad: Hijo }): void {
  const t = TABLA_HIJO[op.entidad];
  const previa = existente(ctx, t, op);
  if (previa) {
    if (op.entidad === 'acuerdo') completarAcuerdo(ctx, op, previa);
    return;
  }
  const d = limpiar(op.datos, CAMPOS_HIJO[op.entidad]);
  const reunionId = texto(d, 'reunion_id');
  const sustituido = op.entidad === 'acuerdo' && d.sustituye_a ? ctx.buscar('acuerdos', String(d.sustituye_a)) : undefined;
  // Excepción a "lo sellado no cambia": la corrección de un acuerdo anulado de esta misma reunión se agrega a ella.
  const correccion = !!sustituido && sustituido.reunion_id === reunionId && ctx.buscar('reuniones', reunionId)?.estado === 'Sellada';
  if (!correccion) reunionEnBorrador(ctx, reunionId);
  validarHijo(ctx, op.entidad, d, true);
  const fila: Fila = { ...filaVacia(t), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts };
  if (correccion) {
    if (verdadero(ctx.buscar('reuniones', reunionId)?.anulado)) throw new Rechazo('La reunión está anulada');
    fila.numero = `${sustituido!.numero}-C`;
    fila.carnets = folios(ctx, lista(d.persona_ids));
  }
  if (op.entidad === 'acuerdo') fila.estado_vigente = 'Por iniciar';
  ctx.insertar(t, fila);
  if (op.entidad === 'acuerdo') {
    for (const k of lista(d.instituciones)) {
      const inst = ctx.exigir('instituciones', k, 'Institución');
      ctx.modificar('instituciones', k, { usos: Number(inst.usos || 0) + 1 });
    }
    completarAcuerdo(ctx, op, fila);
  }
}

/** Pasos posteriores a guardar un acuerdo; son idempotentes para poder completarlos en un reintento. */
function completarAcuerdo(ctx: Contexto, op: OpCrear, fila: Fila): void {
  if (!ctx.buscar('historial_estados', `${op.id}:inicial`)) {
    ctx.insertar('historial_estados', {
      ...filaVacia('historial_estados'), id: `${op.id}:inicial`, creado_por: ctx.usuario, creado_en: op.ts,
      acuerdo_id: op.id, estado: 'Por iniciar', nota: '',
    });
  }
  if (fila.sustituye_a) enlazarSustituto(ctx, String(fila.sustituye_a), op.id);
}

export function actualizarHijo(ctx: Contexto, op: OpActualizar & { entidad: Hijo }): void {
  const t = TABLA_HIJO[op.entidad];
  const actual = ctx.exigir(t, op.id, 'Registro');
  reunionEnBorrador(ctx, String(actual.reunion_id));
  if (verdadero(actual.quitado)) throw new Rechazo('El registro fue quitado');
  const permitidos = CAMPOS_HIJO[op.entidad].filter(k => k !== 'reunion_id' && k !== 'sustituye_a');
  const c = limpiar(op.cambios, permitidos);
  validarHijo(ctx, op.entidad, c, false, actual);
  ctx.modificar(t, op.id, c);
}

export function quitarHijo(ctx: Contexto, op: OpQuitar): void {
  const t = TABLA_HIJO[op.entidad];
  const actual = ctx.exigir(t, op.id, 'Registro');
  reunionEnBorrador(ctx, String(actual.reunion_id));
  ctx.modificar(t, op.id, { quitado: true });
}

/** En orden de captura: las filas se guardan en orden de inserción (_rev cambia al editar, por eso no se usa). */
function vivos(ctx: Contexto, t: NombreTabla, reunionId: string): Fila[] {
  return ctx.almacen.filas(t).filter(f => f.reunion_id === reunionId && !verdadero(f.quitado) && !verdadero(f.anulado));
}

function folios(ctx: Contexto, ids: string[]): string {
  return ids.map(id => String(ctx.buscar('personas', id)?.folio ?? '')).filter(Boolean).join(', ');
}

export function sellarReunion(ctx: Contexto, op: OpSellar): void {
  reunionEnBorrador(ctx, op.id);
  const atendidos = vivos(ctx, 'asistentes', op.id).filter(a => a.papel === 'Atendida').map(a => String(a.persona_id));
  if (atendidos.length === 0) throw new Rechazo('La reunión necesita al menos una persona atendida');
  for (const t of ['peticiones', 'acuerdos'] as NombreTabla[]) {
    vivos(ctx, t, op.id).forEach((f, i) => {
      ctx.modificar(t, String(f.id), { numero: String(i + 1).padStart(2, '0'), carnets: folios(ctx, lista(f.persona_ids)) });
    });
  }
  ctx.modificar('reuniones', op.id, { estado: 'Sellada', sellada_en: ctx.ahora(), carnets: folios(ctx, atendidos) });
}
