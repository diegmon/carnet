import { createStore, get, set, setMany } from 'idb-keyval';
import { TABLAS, NombreTabla } from '../../../src/dominio/esquema';
import type { Fila } from '../../../src/dominio/tipos';
import type { Operacion } from '../../../src/dominio/operaciones';
import type { Almacen } from '../../../src/receptor/almacen';

export type Instantanea = Partial<Record<NombreTabla, Fila[]>>;
export interface Sesion { correo: string; nombre: string; cargo: string }
export interface Cargado { tablas: Instantanea; cola: Operacion[]; sesion?: Sesion }

export interface Persistencia {
  cargar(): Promise<Cargado>;
  guardar(tablas: Instantanea, cola: Operacion[]): Promise<void>;
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
      const [tablas, cola, sesion] = await Promise.all([
        get<Instantanea>('tablas', store), get<Operacion[]>('cola', store), get<Sesion>('sesion', store),
      ]);
      return { tablas: tablas ?? {}, cola: cola ?? [], sesion };
    },
    async guardar(tablas, cola) {
      await setMany([['tablas', tablas], ['cola', cola]], store);
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
      return {
        tablas: (datos.get('tablas') as Instantanea) ?? {},
        cola: (datos.get('cola') as Operacion[]) ?? [],
        sesion: datos.get('sesion') as Sesion | undefined,
      };
    },
    async guardar(tablas, cola) { datos.set('tablas', copia(tablas)); datos.set('cola', copia(cola)); },
    async guardarSesion(s) { datos.set('sesion', copia(s)); },
    async guardarFoto(id, archivo) { datos.set(`foto:${id}`, archivo); },
    async leerFoto(id) { return datos.get(`foto:${id}`) as Blob | undefined; },
  };
}
