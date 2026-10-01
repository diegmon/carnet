import type { Almacen } from './almacen';
import { TABLAS, columnas, NombreTabla } from '../dominio/esquema';
import type { Fila } from '../dominio/tipos';
import { escaparCelda, normalizarLeido } from './celdas';

type Hoja = GoogleAppsScript.Spreadsheet.Sheet;

/** Lee cada hoja una vez por solicitud y escribe celda por celda (los volúmenes son pequeños). */
export class AlmacenSheets implements Almacen {
  private cache = new Map<NombreTabla, { hoja: Hoja; cabecera: string[]; filas: Fila[] }>();

  constructor(private libro: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  private cargar(t: NombreTabla) {
    let c = this.cache.get(t);
    if (!c) {
      const hoja = this.libro.getSheetByName(TABLAS[t].hoja);
      if (!hoja) throw new Error(`Falta la hoja ${TABLAS[t].hoja}; corre setup()`);
      const valores = hoja.getDataRange().getValues();
      const cabecera = valores[0].map(String);
      const filas = valores.slice(1).map(r => Object.fromEntries(cabecera.map((k, j) => [k, normalizarLeido(r[j])])) as Fila);
      c = { hoja, cabecera, filas };
      this.cache.set(t, c);
    }
    return c;
  }

  filas(t: NombreTabla): Fila[] {
    return this.cargar(t).filas.map(f => ({ ...f }));
  }

  /** Vacía la caché: se llama al tomar el candado para leer contadores frescos. */
  refrescar(): void {
    this.cache.clear();
  }

  /** Escribe un renglón nuevo con formato de texto aplicado ANTES de los valores, para que Sheets no los convierta. */
  private anexar(hoja: Hoja, valores: Fila[string][]): void {
    hoja.getRange(hoja.getLastRow() + 1, 1, 1, valores.length).setNumberFormat('@').setValues([valores.map(escaparCelda)]);
  }

  agregar(t: NombreTabla, fila: Fila): void {
    const c = this.cargar(t);
    this.anexar(c.hoja, c.cabecera.map(k => fila[k] ?? ''));
    c.filas.push({ ...fila });
  }

  actualizar(t: NombreTabla, id: string, cambios: Fila): void {
    const c = this.cargar(t);
    const i = c.filas.findIndex(f => f.id === id);
    if (i < 0) throw new Error(`No existe ${id} en ${t}`);
    for (const [k, v] of Object.entries(cambios)) {
      const j = c.cabecera.indexOf(k);
      if (j < 0) throw new Error(`Columna desconocida ${k} en ${t}`);
      c.hoja.getRange(i + 2, j + 1).setValue(escaparCelda(v));
    }
    Object.assign(c.filas[i], cambios);
  }

  config(clave: string): string {
    const f = this.cargar('config').filas.find(x => x.clave === clave);
    return f === undefined ? '' : String(f.valor);
  }

  setConfig(clave: string, valor: string): void {
    const c = this.cargar('config');
    const i = c.filas.findIndex(x => x.clave === clave);
    if (i < 0) {
      this.anexar(c.hoja, [clave, valor]);
      c.filas.push({ clave, valor });
    } else {
      c.hoja.getRange(i + 2, c.cabecera.indexOf('valor') + 1).setValue(escaparCelda(valor));
      c.filas[i].valor = valor;
    }
  }
}

/** Crea las hojas que falten con su cabecera y fuerza formato de texto para que Sheets no convierta fechas ni números. */
export function prepararLibro(libro: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
  for (const t of Object.keys(TABLAS) as NombreTabla[]) {
    const nombre = TABLAS[t].hoja;
    const hoja = libro.getSheetByName(nombre) ?? libro.insertSheet(nombre);
    const cols = columnas(t);
    if (hoja.getLastRow() === 0) {
      hoja.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      hoja.setFrozenRows(1);
    }
    hoja.getRange(1, 1, hoja.getMaxRows(), cols.length).setNumberFormat('@');
  }
}
