import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Motor } from '../estado/motor';

export type Ruta =
  | { p: 'seguimiento' } | { p: 'carnets' } | { p: 'documentos' } | { p: 'anulaciones' } | { p: 'problemas' }
  | { p: 'carnet'; id: string } | { p: 'reunion'; id: string }
  | { p: 'nuevo-acuerdo'; reunionId: string; sustituyeA?: string } | { p: 'acuerdo'; id: string };

export interface Nav { ruta: Ruta; ir(r: Ruta): void; atras(): void; pestana(r: Ruta): void }

export const MotorCtx = createContext<Motor | null>(null);
export const NavCtx = createContext<Nav | null>(null);

/** Devuelve el motor y vuelve a dibujar el componente en cada cambio. */
export function useMotor(): Motor {
  const m = useContext(MotorCtx);
  if (!m) throw new Error('Falta MotorCtx');
  const [, setVersion] = useState(0);
  useEffect(() => m.suscribir(() => setVersion(v => v + 1)), [m]);
  return m;
}

export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('Falta NavCtx');
  return n;
}
