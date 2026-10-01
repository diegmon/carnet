import { AlmacenMemoria, filaVacia } from '../../src/receptor/almacen';
import type { Fila } from '../../src/dominio/tipos';
import type { EntidadActualizable, EntidadCreable, EntidadQuitable, Operacion } from '../../src/dominio/operaciones';

export const USUARIO = 'ana.torres@ejemplo.mx';
export const OTRO = 'luis.vega@ejemplo.mx';
export const TS = '2026-09-30T17:00:00-06:00';

export function almacenBase(): AlmacenMemoria {
  return new AlmacenMemoria({
    usuarios: [
      { correo: USUARIO, nombre: 'Ana Torres', cargo: 'Enlace territorial', activo: true },
      { correo: OTRO, nombre: 'Luis Vega', cargo: 'Enlace territorial', activo: 'TRUE' },
    ],
    config: [
      { clave: 'ultimo_folio', valor: '0' },
      { clave: 'ultimo_rev', valor: '0' },
      { clave: 'client_id', valor: 'cliente-123' },
    ],
    instituciones: [
      { ...filaVacia('instituciones'), id: 'fiscalia', nombre: 'Fiscalía', siglas: 'FISCALÍA', tipo: 'Autónomo', usos: 0, _rev: 0 },
      { ...filaVacia('instituciones'), id: 'fiscalia-mp', nombre: 'Ministerio Público', siglas: 'MP', tipo: 'Área', area_de: 'fiscalia', usos: 0, _rev: 0 },
    ],
  });
}

export function reloj(): () => string {
  let s = 0;
  return () => new Date(Date.UTC(2026, 8, 30, 23, 0, s++)).toISOString();
}

let contador = 0;
const sig = () => `op-${++contador}`;
export const crear = (entidad: EntidadCreable, id: string, datos: Fila, ts = TS): Operacion =>
  ({ op_id: sig(), tipo: 'crear', entidad, id, datos, ts });
export const actualizar = (entidad: EntidadActualizable, id: string, cambios: Fila, ts = TS): Operacion =>
  ({ op_id: sig(), tipo: 'actualizar', entidad, id, cambios, ts });
export const quitar = (entidad: EntidadQuitable, id: string): Operacion =>
  ({ op_id: sig(), tipo: 'quitar', entidad, id, ts: TS });
export const sellar = (id: string): Operacion => ({ op_id: sig(), tipo: 'sellar', entidad: 'reunion', id, ts: TS });
