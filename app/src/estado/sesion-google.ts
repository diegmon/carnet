import type { Sesion } from './persistencia';

function decodificar(parte: string): string {
  const b64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=');
  const binario = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

/** Lee el contenido del ID token de Google. La firma la verifica el receptor; aquí solo se usa para mostrar y saber cuándo vence. */
export function leerToken(jwt: string): { correo: string; nombre: string; expira: number } {
  const partes = jwt.split('.');
  if (partes.length !== 3) throw new Error('Token mal formado');
  const datos = JSON.parse(decodificar(partes[1])) as { email?: string; name?: string; exp?: number };
  if (!datos.email || !datos.exp) throw new Error('Token sin correo o sin vencimiento');
  return { correo: datos.email.toLowerCase(), nombre: datos.name ?? datos.email, expira: Number(datos.exp) };
}

export function tokenVigente(s: Sesion | undefined, ahora: Date, margenSeg = 60): string | undefined {
  if (!s?.token || !s.expira) return undefined;
  return s.expira - margenSeg > Math.floor(ahora.getTime() / 1000) ? s.token : undefined;
}
