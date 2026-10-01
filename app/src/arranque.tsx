import { render } from 'preact';
import { App } from './ui/App';
import { Motor } from './estado/motor';
import type { Persistencia } from './estado/persistencia';
import { PERFIL } from '../../src/dominio/perfil';

/**
 * Abre el almacenamiento del teléfono y monta la app. Si otra pestaña o ventana ya tiene la
 * escritura, esta queda en solo lectura. Si el almacenamiento no abre, lo explica en pantalla.
 */
export async function arrancar(raiz: HTMLElement, persistencia: Persistencia, tomarEscritura: () => Promise<boolean>): Promise<Motor | undefined> {
  let motor: Motor;
  try {
    motor = await Motor.abrir(persistencia);
  } catch {
    render(
      <div class="bienvenida">
        <p class="marca">{PERFIL.institucion}</p>
        <h1>Carnet de Atención</h1>
        <p class="aviso">No se pudo abrir el almacenamiento de este teléfono. Revisa que no estés en modo privado y que el navegador permita guardar datos, y vuelve a abrir Carnet de Atención.</p>
      </div>,
      raiz,
    );
    return undefined;
  }
  motor.soloLectura = !(await tomarEscritura());
  render(<App motor={motor} />, raiz);
  return motor;
}

/** Una sola pestaña o ventana escribe a la vez: retiene un candado del navegador mientras la página viva. */
export function tomarEscrituraConCandado(): Promise<boolean> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(true);
  return new Promise(resolver => {
    locks.request('carnet-escritura', { ifAvailable: true }, candado => {
      resolver(!!candado);
      return candado ? new Promise<void>(() => { /* se retiene hasta cerrar la página */ }) : undefined;
    });
  });
}
