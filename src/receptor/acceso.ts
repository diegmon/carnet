import type { Almacen } from './almacen';
import { verdadero } from '../dominio/tipos';

export interface Claims { aud?: string; email?: string; email_verified?: string | boolean; exp?: string | number }

export class ErrorAcceso extends Error {
  constructor(readonly codigo: 'sesion_vencida' | 'no_autorizado', mensaje: string) { super(mensaje); }
}

export function validarClaims(c: Claims, clientId: string, ahoraSeg: number): string {
  if (!clientId) throw new ErrorAcceso('no_autorizado', 'Falta configurar client_id en CONFIG');
  if (!c.aud || !c.exp) throw new ErrorAcceso('sesion_vencida', 'Vuelve a iniciar sesión para sincronizar');
  if (Number(c.exp) <= ahoraSeg) throw new ErrorAcceso('sesion_vencida', 'Vuelve a iniciar sesión para sincronizar');
  if (c.aud !== clientId) throw new ErrorAcceso('no_autorizado', 'La sesión no es de Carnet de Atención');
  if (!(c.email_verified === true || c.email_verified === 'true') || !c.email) {
    throw new ErrorAcceso('no_autorizado', 'Tu cuenta no está verificada');
  }
  return c.email.toLowerCase();
}

export function exigirUsuarioActivo(almacen: Almacen, correo: string): void {
  const u = almacen.filas('usuarios').find(x => String(x.correo).toLowerCase() === correo);
  if (!u || !verdadero(u.activo)) throw new ErrorAcceso('no_autorizado', 'Tu cuenta no está autorizada en Carnet de Atención');
}
