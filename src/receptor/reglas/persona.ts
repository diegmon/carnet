import { Contexto, Rechazo } from '../contexto';
import { filaVacia } from '../almacen';
import { limpiar, texto, enLista, existente } from './comun';
import { TIPOS_PERSONA, verdadero, Fila } from '../../dominio/tipos';
import type { OpActualizar, OpCrear } from '../../dominio/operaciones';

const CAMPOS = ['nombre', 'tipo', 'colectivo', 'contacto', 'alcaldia_zona', 'cargo', 'institucion'] as const;

function validarInstitucion(ctx: Contexto, d: Fila): void {
  if (d.institucion) ctx.exigir('instituciones', String(d.institucion), 'Institución');
}

export function crearPersona(ctx: Contexto, op: OpCrear): void {
  const previa = existente(ctx, 'personas', op);
  if (previa) {
    if (previa.folio) ctx.folios[op.id] = String(previa.folio);
    return;
  }
  const d = limpiar(op.datos, CAMPOS);
  texto(d, 'nombre');
  const tipo = enLista(d.tipo, TIPOS_PERSONA, 'tipo');
  validarInstitucion(ctx, d);
  const fila: Fila = { ...filaVacia('personas'), ...d, id: op.id, creado_por: ctx.usuario, creado_en: op.ts };
  if (tipo === 'Atendida') {
    fila.folio = ctx.siguienteFolio();
    ctx.folios[op.id] = String(fila.folio);
  }
  ctx.insertar('personas', fila);
}

export function actualizarPersona(ctx: Contexto, op: OpActualizar): void {
  const actual = ctx.exigir('personas', op.id, 'Persona');
  if (verdadero(actual.anulado)) throw new Rechazo('La persona está anulada');
  const c = limpiar(op.cambios, CAMPOS);
  if ('nombre' in c) texto(c, 'nombre');
  if ('tipo' in c) {
    const nuevo = enLista(c.tipo, TIPOS_PERSONA, 'tipo');
    const permitido = nuevo === actual.tipo || (actual.tipo === 'Acompañante' && nuevo === 'Atendida');
    if (!permitido) throw new Rechazo(`No se puede cambiar de ${actual.tipo} a ${nuevo}`);
  }
  validarInstitucion(ctx, c);
  const cambios: Fila = {};
  for (const [k, v] of Object.entries(c)) {
    if (actual[k] === v) continue;
    cambios[k] = v;
    ctx.insertar('personas_versiones', {
      ...filaVacia('personas_versiones'),
      id: `${op.op_id}:${k}`, creado_por: ctx.usuario, creado_en: op.ts,
      persona_id: op.id, campo: k, valor_anterior: String(actual[k] ?? ''), valor_nuevo: String(v),
    });
  }
  if (cambios.tipo === 'Atendida' && !actual.folio) {
    cambios.folio = ctx.siguienteFolio();
    ctx.folios[op.id] = String(cambios.folio);
  }
  ctx.modificar('personas', op.id, cambios);
}
