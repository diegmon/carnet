import type { Valor } from '../dominio/tipos';

/** Un texto que empieza con = + - @ se guardaría como fórmula; el apóstrofo lo fuerza a texto. */
export function escaparCelda(v: Valor): Valor {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

export function normalizarLeido(v: unknown): Valor {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const medianoche = v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0 && v.getMilliseconds() === 0;
    if (medianoche) {
      const p = (n: number) => String(n).padStart(2, '0');
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return v.toISOString();
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}
