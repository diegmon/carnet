import { AlmacenMemoria } from '../../../src/receptor/almacen';
import { aplicarOperaciones } from '../../../src/receptor/aplicar';
import { sembrar } from '../../../src/receptor/semillas';
import { TABLAS_SINCRONIZADAS, columnas, NombreTabla } from '../../../src/dominio/esquema';
import { formatearFolioProvisional, verdadero, Fila, Valor } from '../../../src/dominio/tipos';
import type { Operacion } from '../../../src/dominio/operaciones';
import type { Cambios } from '../../../src/receptor/cambios';
import type { Instantanea, Sesion } from './persistencia';

export const TABLAS_BASE: NombreTabla[] = [...TABLAS_SINCRONIZADAS, 'usuarios'];
const BOOLEANAS = new Set(['anulado', 'quitado', 'activo']);
const NUMERICAS = new Set(['_rev', 'usos']);

/** Convierte una fila tal como llega de Sheets a los tipos que usa la app. */
export function normalizarFila(t: NombreTabla, fila: Record<string, unknown>): Fila {
  const fuera: Fila = {};
  for (const c of columnas(t)) {
    if (!(c in fila)) continue;
    const v = fila[c];
    if (BOOLEANAS.has(c)) fuera[c] = verdadero(v as Valor);
    else if (NUMERICAS.has(c)) fuera[c] = Number(v || 0);
    else fuera[c] = v === null || v === undefined ? '' : String(v);
  }
  return fuera;
}

/** Agrega a la base lo que llegó del receptor: inserta o actualiza por id; la lista de usuarios se reemplaza completa. */
export function fusionar(base: Instantanea, c: Cambios): Instantanea {
  const nueva: Instantanea = { ...base };
  for (const [t, filas] of Object.entries(c.tablas) as [NombreTabla, Fila[]][]) {
    const actuales = [...(nueva[t] ?? [])];
    for (const cruda of filas) {
      const fila = normalizarFila(t, cruda);
      const i = actuales.findIndex(x => x.id === fila.id);
      if (i >= 0) actuales[i] = fila;
      else actuales.push(fila);
    }
    nueva[t] = actuales;
  }
  nueva.usuarios = c.usuarios.map(u => normalizarFila('usuarios', u));
  return nueva;
}

/**
 * Vista local = base confirmada + cola reaplicada con las reglas del receptor.
 * Devuelve también las operaciones de la cola que ya no aplican sobre la base (el receptor decidirá).
 */
export function reconstruir(base: Instantanea, cola: Operacion[], sesion: Sesion, ahora: () => string):
  { almacen: AlmacenMemoria; noAplicadas: string[] } {
  const inicial: Instantanea = {};
  for (const t of TABLAS_BASE) inicial[t] = (base[t] ?? []).map(f => ({ ...f }));
  const a = new AlmacenMemoria(inicial);
  if (!a.filas('usuarios').some(u => u.correo === sesion.correo)) {
    a.agregar('usuarios', { correo: sesion.correo, nombre: sesion.nombre, cargo: sesion.cargo, activo: true });
  }
  const maxRev = Math.max(0, ...TABLAS_SINCRONIZADAS.flatMap(t => (base[t] ?? []).map(f => Number(f._rev) || 0)));
  a.setConfig('ultimo_rev', String(maxRev));
  sembrar(a, ahora, '');
  const noAplicadas: string[] = [];
  for (const op of cola) {
    const { resultados: [r] } = aplicarOperaciones(a, sesion.correo, [op], ahora, { formatoFolio: formatearFolioProvisional });
    if (r.estado === 'rechazada') noAplicadas.push(op.op_id);
  }
  return { almacen: a, noAplicadas };
}
