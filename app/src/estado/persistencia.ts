import { createStore, get, set, setMany } from 'idb-keyval';
import { TABLAS, NombreTabla } from '../../../src/dominio/esquema';
import type { Fila } from '../../../src/dominio/tipos';
import type { Operacion } from '../../../src/dominio/operaciones';
import type { Almacen } from '../../../src/receptor/almacen';

export type Instantanea = Partial<Record<NombreTabla, Fila[]>>;
export interface Sesion { correo: string; nombre: string; cargo: string; token?: string; expira?: number }
export interface Problema { op: Operacion; motivo: string; fecha: string }
export interface Sincronia { base: Instantanea; cursor: number; problemas: Problema[] }
export interface Cargado { tablas: Instantanea; cola: Operacion[]; sesion?: Sesion; base: Instantanea; cursor: number; problemas: Problema[] }

export interface Persistencia {
  cargar(): Promise<Cargado>;
  guardar(tablas: Instantanea, cola: Operacion[], sincronia?: Sincronia): Promise<void>;
  guardarSesion(s: Sesion): Promise<void>;
  guardarFoto(id: string, archivo: Blob): Promise<void>;
  leerFoto(id: string): Promise<Blob | undefined>;
}

export function exportar(a: Almacen): Instantanea {
  const t: Instantanea = {};
  for (const nombre of Object.keys(TABLAS) as NombreTabla[]) t[nombre] = a.filas(nombre);
  return t;
}

/** Guarda todo en IndexedDB del teléfono. Las fotos se guardan como bytes + tipo. */
export function persistenciaIdb(nombre = 'carnet'): Persistencia {
  const store = createStore(nombre, 'datos');
  return {
    async cargar() {
      const [tablas, cola, sesion, sincronia] = await Promise.all([
        get<Instantanea>('tablas', store), get<Operacion[]>('cola', store), get<Sesion>('sesion', store), get<Sincronia>('sincronia', store),
      ]);
      return {
        tablas: tablas ?? {}, cola: cola ?? [], sesion,
        base: sincronia?.base ?? {}, cursor: sincronia?.cursor ?? 0, problemas: sincronia?.problemas ?? [],
      };
    },
    async guardar(tablas, cola, sincronia) {
      const entradas: [IDBValidKey, unknown][] = [['tablas', tablas], ['cola', cola]];
      if (sincronia) entradas.push(['sincronia', sincronia]);
      await setMany(entradas, store);
    },
    async guardarSesion(s) {
      await set('sesion', s, store);
    },
    async guardarFoto(id, archivo) {
      await set(`foto:${id}`, { tipo: archivo.type, datos: await archivo.arrayBuffer() }, store);
    },
    async leerFoto(id) {
      const f = await get<{ tipo: string; datos: ArrayBuffer }>(`foto:${id}`, store);
      return f ? new Blob([f.datos], { type: f.tipo }) : undefined;
    },
  };
}

/** Para pruebas: misma interfaz, en memoria. */
export function persistenciaMemoria(): Persistencia {
  const datos = new Map<string, unknown>();
  const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    async cargar() {
      const s = datos.get('sincronia') as Sincronia | undefined;
      return {
        tablas: (datos.get('tablas') as Instantanea) ?? {},
        cola: (datos.get('cola') as Operacion[]) ?? [],
        sesion: datos.get('sesion') as Sesion | undefined,
        base: s?.base ?? {}, cursor: s?.cursor ?? 0, problemas: s?.problemas ?? [],
      };
    },
    async guardar(tablas, cola, sincronia) {
      datos.set('tablas', copia(tablas));
      datos.set('cola', copia(cola));
      if (sincronia) datos.set('sincronia', copia(sincronia));
    },
    async guardarSesion(s) { datos.set('sesion', copia(s)); },
    async guardarFoto(id, archivo) { datos.set(`foto:${id}`, archivo); },
    async leerFoto(id) { return datos.get(`foto:${id}`) as Blob | undefined; },
  };
}
