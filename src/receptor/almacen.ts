import { columnas, NombreTabla } from '../dominio/esquema';
import type { Fila } from '../dominio/tipos';

export interface Almacen {
  filas(t: NombreTabla): Fila[];
  agregar(t: NombreTabla, fila: Fila): void;
  actualizar(t: NombreTabla, id: string, cambios: Fila): void;
  config(clave: string): string;
  setConfig(clave: string, valor: string): void;
  /** Descarta lecturas en caché (opcional; AlmacenSheets la usa al tomar el candado). */
  refrescar?(): void;
}

export function filaVacia(t: NombreTabla): Fila {
  const fila: Fila = {};
  for (const col of columnas(t)) fila[col] = col === 'anulado' || col === 'quitado' ? false : '';
  return fila;
}

function revisarColumnas(t: NombreTabla, fila: Fila): void {
  const cols = columnas(t);
  const extra = Object.keys(fila).filter(k => !cols.includes(k));
  if (extra.length) throw new Error(`Columnas desconocidas en ${t}: ${extra.join(', ')}`);
}

export class AlmacenMemoria implements Almacen {
  private datos = new Map<NombreTabla, Fila[]>();

  constructor(inicial: Partial<Record<NombreTabla, Fila[]>> = {}) {
    for (const [t, filas] of Object.entries(inicial)) {
      this.datos.set(t as NombreTabla, (filas ?? []).map(f => ({ ...f })));
    }
  }

  filas(t: NombreTabla): Fila[] {
    return (this.datos.get(t) ?? []).map(f => ({ ...f }));
  }

  agregar(t: NombreTabla, fila: Fila): void {
    revisarColumnas(t, fila);
    const lista = this.datos.get(t) ?? [];
    lista.push({ ...fila });
    this.datos.set(t, lista);
  }

  actualizar(t: NombreTabla, id: string, cambios: Fila): void {
    revisarColumnas(t, cambios);
    const fila = (this.datos.get(t) ?? []).find(f => f.id === id);
    if (!fila) throw new Error(`No existe ${id} en ${t}`);
    Object.assign(fila, cambios);
  }

  config(clave: string): string {
    const f = (this.datos.get('config') ?? []).find(x => x.clave === clave);
    return f === undefined ? '' : String(f.valor);
  }

  setConfig(clave: string, valor: string): void {
    const lista = this.datos.get('config') ?? [];
    const f = lista.find(x => x.clave === clave);
    if (f) f.valor = valor;
    else lista.push({ clave, valor });
    this.datos.set('config', lista);
  }
}
