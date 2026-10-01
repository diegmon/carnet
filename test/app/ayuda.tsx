import { render } from '@testing-library/preact';
import { Motor } from '../../app/src/estado/motor';
import { persistenciaMemoria, Persistencia } from '../../app/src/estado/persistencia';
import { AlmacenMemoria } from '../../src/receptor/almacen';

export const USUARIA = { correo: 'ana.torres@ejemplo.mx', nombre: 'Ana Torres', cargo: 'Enlace territorial' };
export const HOY = new Date(2026, 8, 30, 17, 0, 0);

export async function motorDePrueba(conSesion = true, persistencia: Persistencia = persistenciaMemoria()): Promise<Motor> {
  const m = new Motor(new AlmacenMemoria(), [], undefined, persistencia, () => HOY);
  if (conSesion) await m.configurarSesion(USUARIA);
  return m;
}

/** Crea una persona con carnet y devuelve su id. */
export function conCarnet(m: Motor, nombre = 'María Fernanda Ríos'): string {
  const op = m.crear('persona', { nombre, tipo: 'Atendida' });
  if (!m.ejecutar(op).ok) throw new Error('no se creó la persona');
  return op.id;
}

/** Crea una reunión en borrador con la persona atendida y devuelve su id. */
export function reunionCon(m: Motor, personaId: string): string {
  const r = m.crear('reunion', { fecha: '2026-09-30', hora: '17:00' });
  if (!m.ejecutar(r, m.crear('asistente', { reunion_id: r.id, persona_id: personaId, papel: 'Atendida' })).ok) throw new Error('no se creó la reunión');
  return r.id;
}

export { render };

/** JWT sin firma con el contenido que usa la app (solo para pruebas). */
export function tokenDePrueba(correo = USUARIA.correo, nombre = USUARIA.nombre, expira = Math.floor(HOY.getTime() / 1000) + 3600): string {
  const b64 = (o: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64({ email: correo, name: nombre, exp: expira, email_verified: true })}.firma`;
}
