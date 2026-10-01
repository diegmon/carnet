import type { Almacen } from './almacen';
import { TABLAS_SINCRONIZADAS, NombreTabla } from '../dominio/esquema';
import { verdadero, Fila } from '../dominio/tipos';

export interface Cambios {
  rev: number;
  tablas: Partial<Record<NombreTabla, Fila[]>>;
  usuarios: { correo: string; nombre: string; cargo: string; activo: boolean }[];
}

export function cambiosDesde(almacen: Almacen, cursor: number): Cambios {
  const tablas: Partial<Record<NombreTabla, Fila[]>> = {};
  for (const t of TABLAS_SINCRONIZADAS) {
    const filas = almacen.filas(t).filter(f => Number(f._rev) > cursor);
    if (filas.length) tablas[t] = filas;
  }
  return {
    rev: Number(almacen.config('ultimo_rev') || 0),
    tablas,
    usuarios: almacen.filas('usuarios').map(u => ({
      correo: String(u.correo).toLowerCase(), nombre: String(u.nombre), cargo: String(u.cargo), activo: verdadero(u.activo),
    })),
  };
}
