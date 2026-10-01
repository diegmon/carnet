const p2 = (n: number) => String(n).padStart(2, '0');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha y hora del teléfono con su zona: 2026-09-30T23:30:00-06:00. */
export function isoLocal(d: Date): string {
  const off = -d.getTimezoneOffset();
  const signo = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
    + `${signo}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}

export function hoyLocal(d: Date): string { return isoLocal(d).slice(0, 10); }
export function horaLocal(d: Date): string { return isoLocal(d).slice(11, 16); }

function partes(f: string): [number, number, number] {
  const [y, m, d] = f.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}
function numeroDia(f: string): number {
  const [y, m, d] = partes(f);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function diasEntre(desde: string, hasta: string): number {
  return numeroDia(hasta) - numeroDia(desde);
}

export function fechaLarga(f: string): string {
  const [y, m, d] = partes(f);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function fechaCorta(f: string): string {
  const [, m, d] = partes(f);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

export function textoFechaAcordada(fecha: string, hoy: string): string {
  if (!fecha) return 'Sin fecha acordada';
  const n = diasEntre(hoy, fecha);
  const hora = fecha.includes('T') ? `, ${fecha.slice(11, 16)}` : '';
  let t: string;
  if (n < -1) t = `hace ${-n} días`;
  else if (n === -1) t = 'ayer';
  else if (n === 0) t = 'hoy';
  else if (n === 1) t = 'mañana';
  else if (n < 7) {
    const [y, m, d] = partes(fecha);
    t = `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${fechaCorta(fecha)}`;
  } else t = fechaCorta(fecha);
  return `Fecha acordada: ${t}${hora}`;
}
