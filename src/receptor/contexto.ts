import type { Almacen } from './almacen';
import type { NombreTabla } from '../dominio/esquema';
import { formatearFolio, PREFIJO_FOLIO_OMISION, Fila, Valor } from '../dominio/tipos';
import type { Folios } from '../dominio/operaciones';

/** Error esperado: la operación se rechaza con un motivo legible y el lote continúa. */
export class Rechazo extends Error {}

export class Contexto {
  readonly folios: Folios = {};

  constructor(
    readonly almacen: Almacen,
    readonly usuario: string,
    readonly ahora: () => string,
    public opId = '',
    private formatoFolio: (n: number, prefijo: string) => string = formatearFolio,
  ) {}

  buscar(t: NombreTabla, id: string): Fila | undefined {
    return this.almacen.filas(t).find(f => f.id === id);
  }

  exigir(t: NombreTabla, id: string, que: string): Fila {
    const f = this.buscar(t, id);
    if (!f) throw new Rechazo(`${que} no existe: ${id}`);
    return f;
  }

  private siguiente(clave: string): number {
    const n = Number(this.almacen.config(clave) || 0) + 1;
    this.almacen.setConfig(clave, String(n));
    return n;
  }

  siguienteFolio(): string {
    const prefijo = this.almacen.config('prefijo_folio') || PREFIJO_FOLIO_OMISION;
    return this.formatoFolio(this.siguiente('ultimo_folio'), prefijo);
  }

  insertar(t: NombreTabla, fila: Fila): void {
    this.almacen.agregar(t, { ...fila, servidor_en: this.ahora(), _rev: this.siguiente('ultimo_rev') });
    this.bitacora(t, String(fila.id), '*', '', JSON.stringify(fila));
  }

  modificar(t: NombreTabla, id: string, cambios: Fila): void {
    const actual = this.exigir(t, id, 'Registro');
    const efectivos: Fila = {};
    for (const [k, v] of Object.entries(cambios)) {
      if (actual[k] !== v) {
        efectivos[k] = v;
        this.bitacora(t, id, k, actual[k] ?? '', v);
      }
    }
    if (Object.keys(efectivos).length === 0) return;
    this.almacen.actualizar(t, id, { ...efectivos, servidor_en: this.ahora(), _rev: this.siguiente('ultimo_rev') });
  }

  private bitacora(t: NombreTabla, id: string, campo: string, antes: Valor, ahora: Valor): void {
    this.almacen.agregar('changelog', {
      fecha: this.ahora(), tabla: t, registro_id: id, campo,
      antes: String(antes), ahora: String(ahora), usuario: this.usuario, op_id: this.opId,
    });
  }
}
